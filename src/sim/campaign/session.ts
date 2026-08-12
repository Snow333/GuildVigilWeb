/**
 * CampaignSession — brief #5's architecture decision: the ONE interactive
 * campaign state machine. Commands mutate (synchronous, deterministic),
 * queries derive (pure), serialize/deserialize is the SaveEnvelope body.
 * Live play, the career harness, and forecasting all drive THIS machine;
 * runCampaign (campaign.ts) is now an autopilot over it with the v1 policies.
 *
 * REFACTOR LOCK: the career-harness snapshot must be UNCHANGED. Every event
 * emission, RNG draw, and minute advance below is a line-for-line transplant
 * of the Phase 1 runCampaign body — reorder nothing without a harness diff
 * that justifies itself.
 */

import { CLOCK, ESCALATION, SCHEDULER, WORLD } from '@content/world';
import type { DungeonTier } from '@content/dungeon';
import { EventStream } from '@sim/core/events/stream';
import type { ItemInstance } from '@sim/core/events/types';
import { ArtKeys, Ids, Seeds } from '@sim/core/ids';
import { Rng } from '@sim/core/rng';
import { buildEnemy } from '@sim/combat/build';
import { hasCondition } from '@sim/combat/conditions';
import { healDying } from '@sim/combat/dying';
import { runEncounter } from '@sim/combat/encounter';
import {
  runDungeonDispatch,
  type Caution,
  type DungeonDispatchResult,
  type MissionProfile,
} from '@sim/dungeon/dispatch';
import { deriveItem, itemBasesById, type DerivedItem } from '@sim/heroes/equipment';
import { featEffectsById, partyDungeonBonus } from '@sim/heroes/featEffects';
import {
  applyLevelUp, checkClassEligibility, isBoostLevel, maxSkillRanks, skillPointsForLevel,
  type LevelUpApplied, type LevelUpPlan,
} from '@sim/heroes/levelUp';
import { portraitKey, type AncestryId, type Gender } from '@sim/heroes/ancestry';
import { difficultyFor, type DifficultyBand } from './difficulty';
import { runBackfillChain } from '@sim/save/saveStore';
import { SAVE_BACKFILLS } from '@sim/save/backfills';
import { characterLevel, type AbilityKey, type HeroState } from '@sim/heroes/types';
import { awardXp, canLevelUp, xpForNextLevel, type XpProgress } from '@sim/heroes/xp';
import {
  ancestryNameById, buildingsById, classesById, contentXpResolver, npcsById, progressionFor, questsById,
  shopStockRows, skillNames, spellsById, storyDialogueRows, storylineByQuestId, storylinesById,
  worldRegionsById,
} from '@sim/registry';
import { quests as questRows } from '@content/generated';
import { generateWorld, type WorldMap } from '@sim/world/terrain';
import { planTravel, type TravelPlan } from '@sim/world/travel';
import { EscalationLedger, type EscalationFact } from '@sim/world/escalation';
import type { LoadoutEntry } from '@sim/combat/loadout';
import { assembleHero, assembleParty, type HeroKit } from './assembly';

export interface SessionConfig {
  campaignId: string;
  seed: string;
  party: HeroKit[];
}

/** Team id rides every dispatch config now (ledger ⑥ stub) so multi-team is additive later. */
export interface DispatchConfig {
  profile: MissionProfile;
  caution: Caution;
  teamId?: string;
}

/** The level-up command's plan: hpPerLevel is a registry fact the session derives itself. */
export type SessionLevelUpPlan = Omit<LevelUpPlan, 'hpPerLevel'>;

/**
 * Brief #12: a fight that happened on the SURFACE, carried so it can be watched.
 * Dungeon fights need no carrier — `runDungeonDispatch` already absorbs them into
 * the dispatch stream, and `combatSegments()` splits them back out.
 */
export interface SurfaceFight {
  combatId: string;
  site: 'road' | 'camp';
  /** What the sheet header calls the place — presentation reads it, never derives it. */
  label: string;
  stream: EventStream;
}

export interface QuestRecord {
  week: number;
  questId: number;
  outcome: 'completed' | 'failed' | 'wiped' | 'ambushKilled';
  dispatch?: DungeonDispatchResult;
  /**
   * Surface fights, in the order they happened. Present even on the ambush
   * early-return: a road death is the case that most needs watching.
   * NOT persisted — `QuestRecord` lives in `lastLaunch`, never in
   * `SessionSaveState`, so widening it is not a save-format change.
   */
  fights?: SurfaceFight[];
}

export interface BoardEntry {
  questId: number;
  name: string;
  minLevel: number;
  /** Real difficulty (dungeon level where set) — what the accept decision weighs. */
  challenge: number;
  /**
   * What the guild would SAY about that challenge, relative to its own level
   * (brief #11). Derived here so the UI renders a judgement it never computes.
   */
  difficulty: DifficultyBand;
  regionId: string;
  postedWeek: number;
  expiresWeek: number;
  rewardGold: number;
  rewardXp: number;
  pressureTier: number;
  /** POI position (derived placement) — the world map draws tokens here. */
  pos: { x: number; y: number };
  /**
   * The guild has surveyed this destination — some completed quest resolved at
   * its POI (brief #8 step 5). Unsurveyed chart markers render "?" and must not
   * leak the name.
   */
  discovered: boolean;
}

/** Derived equipment view: the instance plus everything that recomputes from it. */
export interface EquippedView {
  slot: string;
  instance: ItemInstance;
  derived: DerivedItem;
}

export interface StashView {
  index: number;
  instance: ItemInstance;
  derived: DerivedItem;
  /** Sale price the shop would pay right now. */
  sellPrice: number;
}

/** The full derived character sheet — the UI never computes a modifier (brief §1). */
/** Identity fields every hero-bearing view carries — portrait wiring reads these, computes nothing. */
export interface HeroIdentityView {
  ancestry: AncestryId;
  /** Registry display name ("Half-Orc") — the label the portrait's desat is paired with. */
  ancestryName: string;
  gender: Gender;
  /** `hero-{slug}-{gender}` — the generated portraits module's key. */
  portraitKey: string;
}

export interface HeroSheet extends HeroIdentityView {
  id: string;
  name: string;
  status: HeroState['status'];
  level: number;
  xp: XpProgress;
  classes: { classId: number; name: string; level: number }[];
  abilities: Record<AbilityKey, { score: number; mod: number }>;
  maxHp: number;
  ac: number;
  attackBonus: number;
  damageDice: string;
  saves: { fort: number; ref: number; will: number };
  speed: number;
  initiativeBonus: number;
  skills: { name: string; ranks: number; total: number | null }[];
  feats: { featId: number; name: string }[];
  equipped: EquippedView[];
  loadout: LoadoutEntry[];
  wounded: number;
  canLevelUp: boolean;
}

export interface LevelUpClassChoice {
  classId: number;
  name: string;
  met: boolean;
  reason: string;
  keyAbility: string;
  newClassLevel: number;
  hpPerLevel: number | null;
  skillPoints: number;
}

export interface LevelUpOptions {
  eligible: boolean;
  newCharacterLevel: number;
  /** Reaching this level grants an ability boost (player's choice of ability). */
  boostRequired: boolean;
  skillNames: readonly string[];
  /** Ranks already held, by skill — the wizard greys + at the cap. */
  currentRanks: Record<string, number>;
  /** Rank ceiling at the NEW level (= character level, PF2-style — finding #4). */
  maxRanks: number;
  classes: LevelUpClassChoice[];
}

export interface ShopOffer {
  /** Stable handle for buyItem within the current rotation week. */
  offerIndex: number;
  buildingId: number;
  buildingName: string;
  itemBaseId: string;
  derived: DerivedItem;
  price: number;
  /** null = unlimited stock this rotation. */
  remaining: number | null;
}

export interface ForecastConfig {
  profile: MissionProfile;
  caution: Caution;
}

/** Outcome distribution over n headless dispatches on forked seeds (brief §1, risk R5). */
export interface ForecastResult {
  n: number;
  completed: number;
  retreated: number;
  wiped: number;
  medianHaulGold: number;
  medianDurationMinutes: number;
  travelEtaMinutes: number | null;
}

/** A fired story beat, ready to render — speaker, their portrait slot, text, choices. */
export interface DialogueBeat {
  id: number;
  speaker: string;
  /** `npc-{name}` — silhouette until that NPC's bust is generated. */
  portraitKey: string;
  text: string;
  choices: { label: string }[];
}

export interface RosterEntry extends HeroIdentityView {
  id: string;
  name: string;
  level: number;
  status: HeroState['status'];
  xp: XpProgress;
  maxHp: number;
  wounded: number;
}

/** The five v1 regions (Haven's turf + compass quadrants from regionFor). */
export const REGION_IDS = ['region_haven', 'region_ne', 'region_nw', 'region_se', 'region_sw'] as const;

interface OpenQuest {
  questId: number;
  postedWeek: number;
  regionId: string;
  pos: { x: number; y: number };
}

interface ActiveQuest extends OpenQuest {
  /** The quest_accepted event's seq — cause link for the launch's travel leg. */
  acceptSeq: number;
}

/** Serialized state (constraint 7): facts only — terrain, prices, derived stats all recompute. */
export interface SessionSaveState {
  v: 1;
  campaignId: string;
  seed: string;
  week: number;
  minute: number;
  gold: number;
  dispatchN: number;
  /** Exact campaign-RNG state: ambush rolls continue mid-stream across reloads. */
  rngState: number;
  profile: MissionProfile;
  caution: Caution;
  party: HeroKit[];
  stash: ItemInstance[];
  /** Board postings; pos/region re-derive from the POI placement. */
  open: { questId: number; postedWeek: number }[];
  completed: [number, number][];
  /** Expiry-cooldown ledger (finding #2; absent in older saves — backfills empty). */
  expired?: [number, number][];
  active: { questId: number; postedWeek: number; acceptSeq: number } | null;
  escalation: { facts: EscalationFact[]; lastTier: [string, number][] };
  /** Shop purchases this rotation week (2.2+; absent in 2.0 saves — backfills empty). */
  shopSold?: { week: number; counts: [number, number][] };
}

/** Shop v1 tunables: weekly rotation size per building; sell-back fraction. */
export const SHOP = { rotationSlots: 6, sellFraction: 0.5 } as const;

/** Haven's home-turf radius in the coarse partition (shared with the chart's anchors). */
export const HAVEN_REGION_RADIUS = 12;

/** Coarse region partition v1: Haven's home turf, then compass quadrants. */
export function regionFor(pos: { x: number; y: number }): string {
  const dx = pos.x - WORLD.haven.x;
  const dy = pos.y - WORLD.haven.y;
  if (Math.hypot(dx, dy) <= HAVEN_REGION_RADIUS) return 'region_haven';
  return `region_${dy < 0 ? 'n' : 's'}${dx < 0 ? 'w' : 'e'}`;
}

/** A region's representative point + footprint on the chart, in CELL coordinates. */
export interface RegionAnchor {
  regionId: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/**
 * Chart geometry for the region partition (brief #8 step 5): where a region's
 * pressure wash and name sit on the chart. Lives beside regionFor so the
 * partition and the geometry drawn over it cannot drift apart — the anchor
 * test pins every anchor inside its own region. The UI reads this; it derives
 * nothing.
 */
export function regionAnchors(): RegionAnchor[] {
  const { haven, width, height } = WORLD;
  const quadrant = (regionId: string, x0: number, x1: number, y0: number, y1: number): RegionAnchor => ({
    regionId,
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    rx: ((x1 - x0) / 2) * 0.72,
    ry: ((y1 - y0) / 2) * 0.72,
  });
  return [
    { regionId: 'region_haven', cx: haven.x, cy: haven.y, rx: HAVEN_REGION_RADIUS, ry: HAVEN_REGION_RADIUS },
    quadrant('region_nw', 0, haven.x, 0, haven.y),
    quadrant('region_ne', haven.x, width, 0, haven.y),
    quadrant('region_sw', 0, haven.x, haven.y, height),
    quadrant('region_se', haven.x, width, haven.y, height),
  ];
}

/** Deterministic, reachable POI placement: farther out for higher-level quests. */
function placePoi(map: WorldMap, seed: string, minLevel: number): { x: number; y: number } {
  const rng = new Rng(seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    const radius = 8 + minLevel * 5 + rng.float(-3, 8);
    const angle = rng.float(0, Math.PI * 2);
    const x = Math.min(Math.max(Math.round(WORLD.haven.x + Math.cos(angle) * radius), 1), WORLD.width - 2);
    const y = Math.min(Math.max(Math.round(WORLD.haven.y + Math.sin(angle) * radius), 1), WORLD.height - 2);
    if (map.cost(x, y) >= 999) continue;
    if (planTravel(map, WORLD.haven, { x, y })) return { x, y };
  }
  return { x: WORLD.haven.x + 5, y: WORLD.haven.y }; // on the burned road, always reachable
}

function dungeonTierFor(dungeonLevel: number): DungeonTier {
  if (dungeonLevel <= 2) return 'tiny';
  if (dungeonLevel <= 4) return 'small';
  if (dungeonLevel <= 6) return 'medium';
  return 'large';
}

/** Deaths among a known roster → content ids (fled enemies award nothing). */
function killsFrom(
  stream: EventStream,
  instanceIds: readonly string[],
  contentIds: readonly number[],
): number[] {
  const died = new Set(stream.byType('combat.unit_died').map((e) => e.data.unitId));
  const out: number[] = [];
  instanceIds.forEach((id, i) => {
    if (died.has(id)) out.push(contentIds[i]!);
  });
  return out;
}

/** Road-ambush roster v1: goblins for low bands, orc warriors above (content grows in Phase 3). */
function ambushEnemyId(difficulty: number): number {
  return difficulty <= 2 ? 1 : 11;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class CampaignSession {
  readonly campaignId: string;
  readonly seed: string;
  readonly world: EventStream;
  readonly map: WorldMap;
  readonly ledger: EscalationLedger;

  private readonly kits: HeroKit[];
  private readonly heroes: HeroState[];
  private readonly rng: Rng;
  private readonly poiCache = new Map<string, { x: number; y: number }>();

  private week = 0;
  private minute = 0;
  private gold = 0;
  private stash: ItemInstance[] = [];
  private open: OpenQuest[] = [];
  /** questId → week completed; the board reposts it after a cooldown (the world restocks trouble). */
  private completed = new Map<number, number>();
  /**
   * questId → week expired; expired postings sit out the SAME cooldown before
   * reposting (playtest finding #2, Steven-approved: the neglected board
   * visibly breathes instead of silently cycling). Balance change, re-baselined.
   */
  private expired = new Map<number, number>();
  private active: ActiveQuest | null = null;
  private dispatchN = 0;
  private profile: MissionProfile = 'fullExplore';
  private caution: Caution = 'standard';
  /** Purchases against the current rotation week (stock itself derives from seeds). */
  private shopSoldWeek = 0;
  private shopSoldCounts = new Map<number, number>();

  private constructor(config: SessionConfig, rng: Rng, ledger: EscalationLedger) {
    this.campaignId = config.campaignId;
    this.seed = config.seed;
    this.kits = config.party;
    this.heroes = config.party.map((k) => k.hero);
    this.rng = rng;
    this.map = generateWorld(new Rng(config.seed).int(1, 2 ** 30));
    this.world = new EventStream('world', config.campaignId);
    this.ledger = ledger;
  }

  /** newCampaign: world gen + week 0. The first advanceWeek() opens week 1's board. */
  static create(config: SessionConfig): CampaignSession {
    return new CampaignSession(config, new Rng(Seeds.campaign(config.campaignId)), new EscalationLedger());
  }

  // ── Commands (mutate, synchronous, deterministic) ─────────────────────────

  /** Expiry sweep → posting. (Weekly economy tick lands with shop v1 in 2.2.) */
  advanceWeek(): void {
    this.week++;
    const week = this.week;
    this.minute = (week - 1) * CLOCK.minutesPerWeek;
    this.world.emit(this.minute, 'world.week_tick', { week });

    // ── Expiry sweep ──
    for (let i = this.open.length - 1; i >= 0; i--) {
      const q = this.open[i]!;
      if (week - q.postedWeek >= SCHEDULER.expiryWeeks) {
        this.open.splice(i, 1);
        this.expired.set(q.questId, week);
        this.world.emit(this.minute, 'world.quest_expired', { questId: String(q.questId), regionId: q.regionId });
        this.recordFact(week, q.regionId, 'quest_expired', String(q.questId));
      }
    }

    // ── Posting: authored pool, level band, region drift widens the top ──
    // Storyline quests scan FIRST (brief #6): the board is how the arc reaches
    // the player, and four filler slots must not drown the opener. Within each
    // group, table order — deterministic.
    const pl = this.partyLevel();
    const postingOrder = [...questRows].sort((a, b) => {
      const arcA = storylineByQuestId.has(a.id) && !this.completed.has(a.id) ? 0 : 1;
      const arcB = storylineByQuestId.has(b.id) && !this.completed.has(b.id) ? 0 : 1;
      return arcA - arcB || a.id - b.id;
    });
    for (const row of postingOrder) {
      if (this.open.length >= SCHEDULER.maxOpenQuests) break;
      const doneWeek = this.completed.get(row.id);
      if (doneWeek !== undefined && week - doneWeek < SCHEDULER.expiryWeeks) continue;
      const expiredWeek = this.expired.get(row.id);
      if (expiredWeek !== undefined && week - expiredWeek < SCHEDULER.expiryWeeks) continue;
      if (this.open.some((o) => o.questId === row.id)) continue;
      if (!this.storylineUnlocked(row.id)) continue; // arc quests post in sequence (brief #6)
      if (doneWeek !== undefined && storylineByQuestId.has(row.id)) continue; // arc beats happen ONCE
      if (this.active?.questId === row.id) continue; // live play: an accepted quest is off the board
      const pos = this.questPos(row);
      const regionId = regionFor(pos);
      const drift = this.ledger.effectsFor(regionId).questLevelDrift;
      if ((row.min_level as number) < pl - SCHEDULER.levelBandBelow) continue;
      if ((row.min_level as number) > pl + SCHEDULER.levelBandAbove + drift) continue;
      this.open.push({ questId: row.id, postedWeek: week, regionId, pos });
      this.world.emit(this.minute, 'world.quest_posted', {
        questId: String(row.id), regionId, kind: 'story', expiresWeek: week + SCHEDULER.expiryWeeks,
      });
    }
  }

  /** Moves board → active; does NOT launch. One active quest at a time (v1). */
  acceptQuest(questId: number): void {
    if (this.active) throw new Error(`acceptQuest: quest ${this.active.questId} is already active`);
    const idx = this.open.findIndex((o) => o.questId === questId);
    if (idx < 0) throw new Error(`acceptQuest: quest ${questId} is not on the board`);
    const q = this.open[idx]!;
    this.open.splice(idx, 1);
    const acceptEv = this.world.emit(this.minute, 'world.quest_accepted', {
      questId: String(q.questId), partyId: Ids.party(1),
    });
    this.active = { ...q, acceptSeq: acceptEv.seq };
  }

  /**
   * Return the active quest to the board, no penalty (playtest finding #1,
   * Steven's call: free return). The posting keeps its ORIGINAL week — you
   * cannot park a quest by accept/abandon cycling; its expiry clock never
   * stopped. Re-emits quest_posted so feeds see it reappear.
   */
  abandonQuest(): void {
    const q = this.active;
    if (!q) throw new Error('abandonQuest: no active quest');
    this.active = null;
    this.open.push({ questId: q.questId, postedWeek: q.postedWeek, regionId: q.regionId, pos: q.pos });
    this.world.emit(this.minute, 'world.quest_posted', {
      questId: String(q.questId), regionId: q.regionId, kind: 'story',
      expiresWeek: q.postedWeek + SCHEDULER.expiryWeeks,
    });
  }

  configureDispatch(cfg: DispatchConfig): void {
    this.profile = cfg.profile;
    this.caution = cfg.caution;
  }

  /**
   * Travel out → (ambush?) → mission → travel home → consequences. The whole
   * resolution is headless and synchronous; the returned record carries the
   * dispatch stream for playback. Level-ups are NOT applied here — XP is a sim
   * consequence, spending it is a player (or autopilot-policy) choice.
   */
  launchDispatch(): QuestRecord {
    const q = this.active;
    if (!q) throw new Error('launchDispatch: no active quest');
    const quest = questsById.get(q.questId)!;
    const week = this.week;
    const pl = this.partyLevel();
    let minute = this.minute;

    for (const h of this.heroes) h.wounded = 0;
    const party = assembleParty(this.kits);
    this.dispatchN++;
    const dispatchId = Ids.dispatch(this.dispatchN);

    // ── Travel out ──
    const plan = planTravel(this.map, WORLD.haven, q.pos);
    if (plan) {
      this.world.emit(minute, 'dispatch.travel_leg_started', {
        fromX: WORLD.haven.x, fromY: WORLD.haven.y, toX: q.pos.x, toY: q.pos.y, etaMinutes: plan.etaMinutes,
      }, q.acceptSeq);
      minute += plan.etaMinutes;
    }

    // Brief #12: surface fights are carried, not discarded. Both sites below
    // used `fight.stream` for killsFrom() XP and then dropped it, which is why
    // PlaybackScreen had nothing to show for a camp quest or a road death.
    const fights: SurfaceFight[] = [];

    // Ambush: base chance × the region's escalation multiplier.
    const effects = this.ledger.effectsFor(q.regionId);
    if (this.rng.chance(ESCALATION.baseAmbushChance * effects.ambushMult)) {
      const encounterId = `${dispatchId}:ambush`;
      this.world.emit(minute, 'dispatch.travel_ambushed', { regionId: q.regionId, encounterId });
      const difficulty = Math.max((quest.dungeon_level as number | null) ?? (quest.min_level as number), 1);
      const eid = ambushEnemyId(difficulty);
      // Roster scales with the ambusher's own level: many goblins or few orcs.
      const count = eid === 11 ? Math.min(1 + Math.floor(difficulty / 2), 3) : Math.min(2 + Math.ceil(difficulty / 2), 5);
      const ambushers = Array.from({ length: count }, (_, i) => buildEnemy(eid, `${encounterId}:e${i}`));
      const fight = runEncounter(encounterId, 'road', party.map((h) => h.c), ambushers, Seeds.ambush(this.campaignId, week));
      fights.push({ combatId: encounterId, site: 'road', label: 'the road', stream: fight.stream });
      minute += Math.ceil(fight.ticks / 600);
      this.awardMonsterXp(minute, killsFrom(fight.stream, ambushers.map((a) => a.id), ambushers.map(() => eid)));
      // Post-fight aid on the roadside, win or lose (wounded still ratchets).
      for (const h of party) if (hasCondition(h.c, 'dying')) healDying(h.c, 1);
      if (fight.result !== 'victory') {
        // The road won: quest failed before the dungeon; survivors limp home.
        this.world.emit(minute, 'world.quest_failed', { questId: String(q.questId), regionId: q.regionId });
        this.recordFact(week, q.regionId, 'quest_failed', String(q.questId), minute);
        this.active = null;
        this.minute = minute;
        return { week, questId: q.questId, outcome: 'ambushKilled', fights };
      }
    }
    this.world.emit(minute, 'dispatch.travel_arrived', {
      poiId: quest.poi_id !== null ? `poi_${quest.poi_id}` : `poi_q${q.questId}`,
    });

    // ── The mission itself ──
    let outcome: QuestRecord['outcome'];
    let dispatch: DungeonDispatchResult | undefined;

    if (quest.quest_type === 'combat' && quest.enemy_group) {
      // Camp-clearing quest: one stand-up fight against the authored group.
      const group = JSON.parse(quest.enemy_group as string) as { enemy_id: number; count: number }[];
      const roster: number[] = [];
      for (const g of group) for (let i = 0; i < g.count; i++) roster.push(g.enemy_id);
      const enemies = roster.map((id, i) => buildEnemy(id, `${dispatchId}:camp_e${i}`));
      const fight = runEncounter(`${dispatchId}:camp`, 'camp', party.map((h) => h.c), enemies, Seeds.combat(`${dispatchId}_camp`));
      fights.push({ combatId: `${dispatchId}:camp`, site: 'camp', label: 'the camp', stream: fight.stream });
      this.awardMonsterXp(minute, killsFrom(fight.stream, enemies.map((e) => e.id), roster));
      minute += Math.ceil(fight.ticks / 600); // 100ms ticks → game-minutes
      if (fight.result === 'victory') outcome = 'completed';
      else outcome = party.every((h) => h.c.hp <= 0 || h.c.conditions.has('dying') || h.c.conditions.has('unconscious')) ? 'wiped' : 'failed';
    } else {
      const dungeonLevel = Math.max((quest.dungeon_level as number | null) ?? (quest.min_level as number), 1);
      // Brief #6: a DUNGEON quest with an authored enemy_group pins its boss
      // room — the arc's climax is a guarantee, not a band roll.
      const bossRoster = quest.enemy_group
        ? (JSON.parse(quest.enemy_group as string) as { enemy_id: number; count: number }[])
            .flatMap((g) => Array.from({ length: g.count }, () => g.enemy_id))
        : undefined;
      dispatch = runDungeonDispatch({
        dispatchId,
        partyId: Ids.party(1),
        party,
        tier: dungeonTierFor(dungeonLevel),
        seed: Seeds.dispatch(dispatchId),
        profile: this.profile,
        caution: this.caution,
        difficulty: dungeonLevel,
        partyLevel: pl,
        questId: String(q.questId),
        regionId: q.regionId,
        ...(bossRoster ? { bossRoster } : {}),
        autoDetectTraps: partyDungeonBonus(
          this.kits.map((k) => ({ hero: k.hero, feats: k.hero.feats })),
          'auto_detect_traps_adjacent',
        ).found,
      });
      minute += Math.ceil(dispatch.ticks / 600);
      this.awardMonsterXp(minute, dispatch.killedEnemyIds);
      outcome = dispatch.outcome === 'completed' ? 'completed' : dispatch.outcome === 'wiped' ? 'wiped' : 'failed';
    }

    // ── Travel home + consequences ──
    if (plan) minute += plan.etaMinutes;

    if (outcome === 'completed') {
      const haul = dispatch ? dispatch.gold : 0;
      this.gold += (quest.reward_gold as number) + haul;
      if (dispatch) this.stash.push(...dispatch.items);
      const doneEv = this.world.emit(minute, 'world.quest_completed', {
        questId: String(q.questId), regionId: q.regionId,
        xp: quest.reward_xp as number, gold: quest.reward_gold as number, rep: quest.reward_reputation as number,
      });
      this.completed.set(q.questId, week);
      this.recordFact(week, q.regionId, 'quest_completed', String(q.questId), minute);
      this.awardQuestXp(minute, q.questId, doneEv.seq);
    } else {
      this.world.emit(minute, 'world.quest_failed', { questId: String(q.questId), regionId: q.regionId });
      if (outcome === 'wiped') {
        this.recordFact(week, q.regionId, 'dispatch_wiped', dispatchId, minute);
        // The haul stays in the dungeon; the guild drags its people home.
      } else {
        this.recordFact(week, q.regionId, 'quest_failed', String(q.questId), minute);
        if (dispatch) {
          this.gold += dispatch.gold; // retreats walk out with what they carried
          this.stash.push(...dispatch.items);
        }
      }
    }

    this.active = null;
    this.minute = minute;
    return { week, questId: q.questId, outcome, ...(dispatch ? { dispatch } : {}), ...(fights.length > 0 ? { fights } : {}) };
  }

  /** The existing atomic applyLevelUp with a player-chosen plan; hpPerLevel derives here. */
  applyLevelUp(heroId: string, plan: SessionLevelUpPlan): LevelUpApplied {
    const hero = this.heroes.find((h) => h.id === heroId);
    if (!hero) throw new Error(`applyLevelUp: unknown hero ${heroId}`);
    const nextClassLevel = (hero.classLevels.find((cl) => cl.classId === plan.classId)?.level ?? 0) + 1;
    const prog = progressionFor(plan.classId, nextClassLevel);
    if (!prog) throw new Error(`applyLevelUp: class ${plan.classId} has no level ${nextClassLevel}`);
    const applied = applyLevelUp(hero, { ...plan, hpPerLevel: prog.hp_per_level as number });
    this.world.emit(this.minute, 'hero.level_up_applied', {
      heroId: hero.id, newLevel: applied.newCharacterLevel, classId: String(applied.classId),
    });
    return applied;
  }

  /**
   * Stash → hero slot. Slot-compatibility is enforced HERE (brief §1) — the
   * base's slot field is the law; an occupied slot swaps its item back to stash.
   */
  equip(heroId: string, stashIndex: number): void {
    const kit = this.kitFor(heroId);
    const instance = this.stash[stashIndex];
    if (!instance) throw new Error(`equip: no stash item at index ${stashIndex}`);
    const slot = itemBasesById.get(instance.baseId)?.slot as string | null | undefined;
    if (!slot) throw new Error(`equip: ${instance.baseId} is not equippable (no slot)`);
    this.stash.splice(stashIndex, 1);
    const displaced = kit.equipped.findIndex((e) => (itemBasesById.get(e.baseId)?.slot as string | null) === slot);
    if (displaced >= 0) this.stash.push(...kit.equipped.splice(displaced, 1));
    kit.equipped.push(instance);
  }

  /** Hero slot → stash. */
  unequip(heroId: string, slot: string): void {
    const kit = this.kitFor(heroId);
    const idx = kit.equipped.findIndex((e) => (itemBasesById.get(e.baseId)?.slot as string | null) === slot);
    if (idx < 0) throw new Error(`unequip: nothing equipped in ${slot}`);
    this.stash.push(...kit.equipped.splice(idx, 1));
  }

  /** Ordered priorities (core-loop D4): the list IS the strategy. */
  setLoadout(heroId: string, entries: LoadoutEntry[]): void {
    const kit = this.kitFor(heroId);
    for (const entry of entries) {
      if (entry.action === 'cast' && !spellsById.has(entry.spellId)) {
        throw new Error(`setLoadout: unknown spell ${entry.spellId}`);
      }
    }
    kit.loadout = jsonClone(entries);
  }

  /** Buy from the current rotation. Derived pricing; finite rows deplete until the next rotation. */
  buyItem(offerIndex: number): void {
    const offer = this.shopStock().find((o) => o.offerIndex === offerIndex);
    if (!offer) throw new Error(`buyItem: no offer ${offerIndex} this rotation`);
    if (offer.remaining !== null && offer.remaining <= 0) throw new Error(`buyItem: ${offer.derived.displayName} is sold out`);
    if (this.gold < offer.price) throw new Error(`buyItem: need ${offer.price}g, have ${this.gold}g`);
    this.touchShopWeek();
    this.gold -= offer.price;
    this.shopSoldCounts.set(offerIndex, (this.shopSoldCounts.get(offerIndex) ?? 0) + 1);
    this.stash.push({
      baseId: offer.itemBaseId,
      tier: 'mundane',
      propertyIds: [],
      seed: `shop_${offer.buildingId}_w${this.week}_${offerIndex}_${this.shopSoldCounts.get(offerIndex)}`,
    });
  }

  /** Sell from the stash at the derived price × sell fraction. */
  sellItem(stashIndex: number): void {
    const instance = this.stash[stashIndex];
    if (!instance) throw new Error(`sellItem: no stash item at index ${stashIndex}`);
    this.stash.splice(stashIndex, 1);
    this.gold += Math.floor(deriveItem(instance).price * SHOP.sellFraction);
  }

  // ── Queries (pure, no mutation) ───────────────────────────────────────────

  currentWeek(): number {
    return this.week;
  }

  currentMinute(): number {
    return this.minute;
  }

  goldAmount(): number {
    return this.gold;
  }

  stashItems(): readonly ItemInstance[] {
    return this.stash;
  }

  /**
   * Mean character level, floored at 1. The empty-roster guard is load-bearing
   * since brief #11: an empty `heroes` divides by zero, and `Math.max(NaN, 1)`
   * is NaN, which would poison every difficulty band on the board.
   */
  partyLevel(): number {
    if (this.heroes.length === 0) return 1;
    return Math.max(Math.round(this.heroes.reduce((s, h) => s + characterLevel(h), 0) / this.heroes.length), 1);
  }

  roster(): RosterEntry[] {
    return this.heroes.map((h) => ({
      id: h.id,
      name: h.name,
      level: characterLevel(h),
      status: h.status,
      xp: xpForNextLevel(h),
      maxHp: h.maxHp,
      wounded: h.wounded,
      ancestry: h.ancestry,
      ancestryName: ancestryNameById.get(h.ancestry) ?? `ancestry_${h.ancestry}`,
      gender: h.gender,
      portraitKey: portraitKey(h.ancestry, h.gender),
    }));
  }

  /** Direct hero state access for the level-up policy / 2.1 hero panel plumbing. */
  heroState(heroId: string): HeroState {
    const hero = this.heroes.find((h) => h.id === heroId);
    if (!hero) throw new Error(`heroState: unknown hero ${heroId}`);
    return hero;
  }

  /** The full derived sheet — assembly does the math; the UI only renders it. */
  heroSheet(heroId: string): HeroSheet {
    const kit = this.kitFor(heroId);
    const hero = kit.hero;
    const assembled = assembleHero(kit);
    const c = assembled.c;

    const abilities = {} as HeroSheet['abilities'];
    for (const key of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as AbilityKey[]) {
      const score = hero.abilities[key];
      abilities[key] = { score, mod: Math.floor((score - 10) / 2) };
    }

    const skills = skillNames.map((name) => ({
      name,
      ranks: hero.skills[name] ?? 0,
      // Dungeon-check skills have full derived totals; others await their resolvers.
      total: name in assembled.skills ? assembled.skills[name as keyof typeof assembled.skills] : null,
    }));

    return {
      id: hero.id,
      name: hero.name,
      status: hero.status,
      ancestry: hero.ancestry,
      ancestryName: ancestryNameById.get(hero.ancestry) ?? `ancestry_${hero.ancestry}`,
      gender: hero.gender,
      portraitKey: portraitKey(hero.ancestry, hero.gender),
      level: characterLevel(hero),
      xp: xpForNextLevel(hero),
      classes: hero.classLevels.map((cl) => ({
        classId: cl.classId,
        name: classesById.get(cl.classId)?.name ?? `class_${cl.classId}`,
        level: cl.level,
      })),
      abilities,
      maxHp: c.maxHp,
      ac: c.ac,
      attackBonus: c.attackBonus,
      damageDice: c.damageDice,
      saves: { ...c.saves },
      speed: c.speed,
      initiativeBonus: c.initiativeBonus,
      skills,
      feats: hero.feats.map((f) => ({
        featId: f.featId,
        name: featEffectsById.get(f.featId)?.featName ?? `feat_${f.featId}`,
      })),
      equipped: kit.equipped.map((instance) => {
        const derived = deriveItem(instance);
        return { slot: derived.slot ?? 'none', instance: jsonClone(instance), derived };
      }),
      loadout: jsonClone(kit.loadout),
      wounded: hero.wounded,
      canLevelUp: canLevelUp(hero),
    };
  }

  /** The wizard's menu: every class with sim-judged eligibility (brief: eligibility from sim). */
  levelUpOptions(heroId: string): LevelUpOptions {
    const hero = this.heroState(heroId);
    const newCharacterLevel = characterLevel(hero) + 1;
    const boostRequired = isBoostLevel(newCharacterLevel);
    const choices: LevelUpClassChoice[] = [];
    for (const [classId, row] of classesById) {
      const elig = checkClassEligibility(hero, classId);
      const newClassLevel = (hero.classLevels.find((cl) => cl.classId === classId)?.level ?? 0) + 1;
      const prog = progressionFor(classId, newClassLevel);
      choices.push({
        classId,
        name: row.name,
        met: elig.met && prog !== null,
        reason: prog === null && elig.met ? 'No progression data at that level' : elig.reason,
        keyAbility: (row.key_ability ?? 'str') as string,
        newClassLevel,
        hpPerLevel: prog ? (prog.hp_per_level as number) : null,
        skillPoints: skillPointsForLevel(classId, hero),
      });
    }
    return {
      eligible: canLevelUp(hero),
      newCharacterLevel,
      boostRequired,
      skillNames,
      currentRanks: Object.fromEntries(skillNames.map((n) => [n, hero.skills[n] ?? 0])),
      maxRanks: maxSkillRanks(newCharacterLevel),
      classes: choices.sort((a, b) => a.classId - b.classId),
    };
  }

  /** Stash with derived views + live sell prices. */
  stashView(): StashView[] {
    return this.stash.map((instance, index) => {
      const derived = deriveItem(instance);
      return {
        index,
        instance: jsonClone(instance),
        derived,
        sellPrice: Math.floor(derived.price * SHOP.sellFraction),
      };
    });
  }

  /**
   * The week's shop rotation — pure derivation from Seeds.rotation(buildingId, week)
   * (constraint 7: never store what you can derive); only purchases are state.
   */
  shopStock(): ShopOffer[] {
    const offers: ShopOffer[] = [];
    const soldCounts = this.shopSoldWeek === this.week ? this.shopSoldCounts : new Map<number, number>();
    const byBuilding = new Map<number, typeof shopStockRows[number][]>();
    for (const row of shopStockRows) {
      if ((row.required_building_level as number) > 1) continue; // building levels arrive with the town systems
      const rows = byBuilding.get(row.building_id as number) ?? [];
      rows.push(row);
      byBuilding.set(row.building_id as number, rows);
    }
    for (const [buildingId, rows] of [...byBuilding.entries()].sort((a, b) => a[0] - b[0])) {
      const rng = new Rng(Seeds.rotation(buildingId, this.week));
      const rotation = rows.length <= SHOP.rotationSlots ? rows : rng.shuffle(rows).slice(0, SHOP.rotationSlots);
      const building = buildingsById.get(buildingId);
      const buildingName = (building?.shop_display_name as string | null) ?? building?.name ?? `building_${buildingId}`;
      for (const row of rotation) {
        const offerIndex = row.id as number; // stock-row id: stable across the rotation week
        const baseId = String(row.item_id);
        const derived = deriveItem({ baseId, tier: 'mundane', propertyIds: [], seed: `shop_preview_${offerIndex}` });
        const quantity = row.stock_quantity as number;
        const sold = soldCounts.get(offerIndex) ?? 0;
        offers.push({
          offerIndex,
          buildingId,
          buildingName,
          itemBaseId: baseId,
          derived,
          price: Math.max(1, Math.round(derived.price * (row.price_modifier as number))),
          remaining: quantity < 0 ? null : Math.max(quantity - sold, 0),
        });
      }
    }
    return offers;
  }

  /**
   * n headless dispatches on forked seeds (Seeds.forecast) → outcome distribution.
   * Forecast honesty (risk R5): forecast seeds ≠ live seed, SAME resolution path.
   * Consumes no campaign RNG and mutates no hero state — pure by construction.
   */
  forecast(questId: number, cfg: ForecastConfig, n: number): ForecastResult {
    const posting = this.open.find((o) => o.questId === questId) ??
      (this.active?.questId === questId ? this.active : null);
    if (!posting) throw new Error(`forecast: quest ${questId} is not available`);
    const quest = questsById.get(questId)!;
    const dungeonLevel = Math.max((quest.dungeon_level as number | null) ?? (quest.min_level as number), 1);
    const pl = this.partyLevel();
    const autoDetect = partyDungeonBonus(
      this.kits.map((k) => ({ hero: k.hero, feats: k.hero.feats })),
      'auto_detect_traps_adjacent',
    ).found;

    let completed = 0, retreated = 0, wiped = 0;
    const hauls: number[] = [];
    const durations: number[] = [];
    for (let i = 0; i < n; i++) {
      const result = runDungeonDispatch({
        dispatchId: `forecast_${i}`,
        partyId: Ids.party(1),
        party: assembleParty(this.kits), // fresh combatants per run — real heroes untouched
        tier: dungeonTierFor(dungeonLevel),
        seed: Seeds.forecast(this.kits.length, i),
        profile: cfg.profile,
        caution: cfg.caution,
        difficulty: dungeonLevel,
        partyLevel: pl,
        questId: String(questId),
        regionId: posting.regionId,
        autoDetectTraps: autoDetect,
      });
      if (result.outcome === 'completed') completed++;
      else if (result.outcome === 'wiped') wiped++;
      else retreated++;
      hauls.push(result.gold);
      durations.push(Math.ceil(result.ticks / 600));
    }
    hauls.sort((a, b) => a - b);
    durations.sort((a, b) => a - b);
    const plan = planTravel(this.map, WORLD.haven, posting.pos);
    return {
      n,
      completed,
      retreated,
      wiped,
      medianHaulGold: hauls[Math.floor(hauls.length / 2)] ?? 0,
      medianDurationMinutes: durations[Math.floor(durations.length / 2)] ?? 0,
      travelEtaMinutes: plan ? plan.etaMinutes : null,
    };
  }

  board(): BoardEntry[] {
    const partyLevel = this.partyLevel();
    return this.open.map((o) => {
      const row = questsById.get(o.questId)!;
      const challenge = Math.max((row.dungeon_level as number | null) ?? (row.min_level as number), 1);
      return {
        questId: o.questId,
        name: row.name as string,
        minLevel: row.min_level as number,
        challenge,
        difficulty: difficultyFor(challenge, partyLevel),
        regionId: o.regionId,
        postedWeek: o.postedWeek,
        expiresWeek: o.postedWeek + SCHEDULER.expiryWeeks,
        rewardGold: row.reward_gold as number,
        rewardXp: row.reward_xp as number,
        pressureTier: this.ledger.pressureFor(o.regionId).tier,
        pos: { ...o.pos },
        discovered: this.poiSurveyed(row),
      };
    });
  }

  /**
   * Chart discovery (brief #8 step 5): a destination is surveyed once ANY
   * completed quest resolved at its POI — authored POIs (poi_id) are shared
   * across quests; per-quest placements (null poi_id) count only their own
   * quest. Pure derivation from the completed map (constraint 7: no new stored
   * state), so saves need no migration and the flag can never desync.
   */
  private poiSurveyed(row: { id: number; poi_id: unknown }): boolean {
    const poiId = row.poi_id as number | null;
    if (poiId === null) return this.completed.has(row.id);
    for (const qid of this.completed.keys()) {
      if ((questsById.get(qid)?.poi_id as number | null | undefined) === poiId) return true;
    }
    return false;
  }

  activeQuest(): { questId: number; regionId: string } | null {
    return this.active ? { questId: this.active.questId, regionId: this.active.regionId } : null;
  }

  pressure(regionId: string): ReturnType<EscalationLedger['pressureFor']> {
    return this.ledger.pressureFor(regionId);
  }

  /** Authored region name (world_regions), falling back to the raw id. */
  regionName(regionId: string): string {
    return worldRegionsById.get(regionId)?.name ?? regionId;
  }

  /**
   * Dialogue beats whose triggers have fired, in sequence (brief #6). Pure
   * derivation from the completed map: trigger_value '' fires at arc start;
   * a quest id fires once that quest is completed. The UI renders the log.
   */
  pendingDialogue(): DialogueBeat[] {
    const out: DialogueBeat[] = [];
    for (const row of storyDialogueRows) {
      if (row.trigger_type !== 'quest') continue;
      const value = row.trigger_value as string;
      const storyline = storylinesById.get(row.storyline_id);
      const fired = value === ''
        ? storyline?.trigger_type === 'game_start'
        : this.completed.has(Number(value));
      if (!fired) continue;
      let choices: { label: string }[] = [];
      try {
        choices = row.choices ? (JSON.parse(row.choices as string) as { label: string }[]) : [];
      } catch {
        // malformed choices JSON renders as no choices — never fatal
      }
      const npc = npcsById.get(row.npc_id);
      const speaker = (row.speaker as string) || npc?.name || `npc_${row.npc_id}`;
      out.push({
        id: row.id,
        speaker,
        // Named-NPC portrait slot (brief #10 §5). No NPC art exists yet, so
        // this resolves to the silhouette today — the slot is wired so the
        // batch is a file drop, not a UI change.
        portraitKey: ArtKeys.npc(npc?.name ?? speaker),
        text: row.text as string,
        choices,
      });
    }
    return out;
  }

  worldMap(): WorldMap {
    return this.map;
  }

  /** A* path + ETA from Haven to a posted (or the active) quest's POI. */
  travelPreview(questId: number): TravelPlan | null {
    const q = this.open.find((o) => o.questId === questId) ?? (this.active?.questId === questId ? this.active : null);
    if (!q) return null;
    return planTravel(this.map, WORLD.haven, q.pos);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  serialize(): SessionSaveState {
    return jsonClone({
      v: 1 as const,
      campaignId: this.campaignId,
      seed: this.seed,
      week: this.week,
      minute: this.minute,
      gold: this.gold,
      dispatchN: this.dispatchN,
      rngState: this.rng.snapshot(),
      profile: this.profile,
      caution: this.caution,
      party: this.kits,
      stash: this.stash,
      open: this.open.map((o) => ({ questId: o.questId, postedWeek: o.postedWeek })),
      completed: [...this.completed.entries()],
      expired: [...this.expired.entries()],
      active: this.active
        ? { questId: this.active.questId, postedWeek: this.active.postedWeek, acceptSeq: this.active.acceptSeq }
        : null,
      escalation: this.ledger.serialize(),
      shopSold: { week: this.shopSoldWeek, counts: [...this.shopSoldCounts.entries()] },
    });
  }

  /**
   * Rebuild from facts: terrain, POI positions, and regions recompute; the world
   * event stream starts FRESH (events are presentation-facing history, not state
   * — the escalation ledger is the one sanctioned history, and it is restored).
   */
  static deserialize(state: SessionSaveState): CampaignSession {
    if (state.v !== 1) throw new Error(`CampaignSession.deserialize: unknown save version ${String(state.v)}`);
    // Constraint 8: the backfill chain runs over the CLONE, before anything
    // reads the state — so stages may mutate freely and the caller's object is
    // never touched. Stages are idempotent; running this on a current save is
    // a no-op walk.
    const data = runBackfillChain(jsonClone(state), SAVE_BACKFILLS) as SessionSaveState;
    const session = new CampaignSession(
      { campaignId: data.campaignId, seed: data.seed, party: data.party },
      Rng.fromSnapshot(data.rngState),
      EscalationLedger.deserialize(data.escalation),
    );
    session.week = data.week;
    session.minute = data.minute;
    session.gold = data.gold;
    session.dispatchN = data.dispatchN;
    session.profile = data.profile;
    session.caution = data.caution;
    session.stash = data.stash;
    session.open = data.open.map((o) => session.rehydrateQuest(o.questId, o.postedWeek));
    session.completed = new Map(data.completed);
    session.expired = new Map(data.expired ?? []); // pre-cooldown saves backfill empty
    session.active = data.active
      ? { ...session.rehydrateQuest(data.active.questId, data.active.postedWeek), acceptSeq: data.active.acceptSeq }
      : null;
    // Backfill (constraint 8 spirit): 2.0 saves predate the shop — empty ledger.
    session.shopSoldWeek = data.shopSold?.week ?? 0;
    session.shopSoldCounts = new Map(data.shopSold?.counts ?? []);
    return session;
  }

  /** Skill points for a prospective level-up, boost-aware (the fixed INT-boost ordering). */
  skillPointsFor(heroId: string, classId: number, boost?: AbilityKey): number {
    const hero = this.heroState(heroId);
    return skillPointsForLevel(classId, hero, boost);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private kitFor(heroId: string): HeroKit {
    const kit = this.kits.find((k) => k.hero.id === heroId);
    if (!kit) throw new Error(`unknown hero ${heroId}`);
    return kit;
  }

  /**
   * Storyline gating (brief #6): non-arc quests are always eligible; arc quests
   * post when the opener's storyline has begun (game_start) and their
   * predecessor is COMPLETED. Progress derives from the completed map
   * (constraint 7) — old saves simply meet the arc at its start.
   */
  private storylineUnlocked(questId: number): boolean {
    const membership = storylineByQuestId.get(questId);
    if (!membership) return true;
    if (membership.sequence === 1) {
      return storylinesById.get(membership.storylineId)?.trigger_type === 'game_start';
    }
    return membership.prevQuestId !== null && this.completed.has(membership.prevQuestId);
  }

  /** Purchases bind to a rotation week; entering a new week forgets the old ledger. */
  private touchShopWeek(): void {
    if (this.shopSoldWeek !== this.week) {
      this.shopSoldWeek = this.week;
      this.shopSoldCounts.clear();
    }
  }

  private rehydrateQuest(questId: number, postedWeek: number): OpenQuest {
    const row = questsById.get(questId);
    if (!row) throw new Error(`deserialize: unknown quest ${questId} in save`);
    const pos = this.questPos(row);
    return { questId, postedWeek, regionId: regionFor(pos), pos };
  }

  /**
   * Position for a quest's destination. Authored POIs (poi_id set) place via
   * Seeds.poi and share across quests; null-poi quests place PER QUEST via
   * Seeds.questPoi. (Phase 1 keyed the cache on poi_id alone, so all null-poi
   * quests shared one slot whose position depended on which quest claimed it
   * first — a reload could rehydrate a different claimant and desync resumes.
   * Found by the resume-determinism test when the expiry cooldown let the
   * posting scan reach the null-poi rows.)
   */
  private questPos(row: { id: number; poi_id: unknown; min_level: unknown }): { x: number; y: number } {
    const poiId = row.poi_id as number | null;
    const key = poiId !== null ? `p${poiId}` : `q${row.id}`;
    const cached = this.poiCache.get(key);
    if (cached) return cached;
    const seed = poiId !== null ? Seeds.poi(this.map.seed, poiId) : Seeds.questPoi(this.map.seed, row.id);
    const pos = placePoi(this.map, seed, row.min_level as number);
    this.poiCache.set(key, pos);
    return pos;
  }

  /** Escalation fact + tier-change event, one seam for every consequence. */
  private recordFact(week: number, regionId: string, kind: string, refId: string, minute = this.minute): void {
    const before = this.ledger.pressureFor(regionId).tier;
    const { crossedUpTo } = this.ledger.append({ week, regionId, kind, refId });
    const after = this.ledger.pressureFor(regionId).tier;
    if (after !== before) {
      this.world.emit(minute, 'world.escalation_changed', { regionId, oldTier: before, newTier: after });
    }
    // Villain beats (brief #6): upward crossings give the arc's villain a voice —
    // one beat per crossing, in order (escalation brief: fire once per crossing).
    for (const tier of crossedUpTo) {
      this.world.emit(minute, 'world.villain_beat_fired', {
        regionId, villainId: 'vanguard_captain_ruk_mor_tal', beatId: `vanguard_${regionId}_t${tier}`,
      });
    }
  }

  private awardQuestXp(minute: number, questId: number, cause: number): void {
    const result = awardXp(this.heroes, 'quest', questId, contentXpResolver);
    if ('error' in result || result.perHeroShare <= 0) return;
    for (const h of this.heroes) {
      if (h.status === 'dead') continue;
      this.world.emit(minute, 'hero.xp_awarded', { heroId: h.id, amount: result.perHeroShare, source: 'quest' }, cause);
    }
  }

  private awardMonsterXp(minute: number, enemyIds: readonly number[]): void {
    const totals = new Map<string, number>();
    for (const enemyId of enemyIds) {
      const result = awardXp(this.heroes, 'monster', enemyId, contentXpResolver);
      if ('error' in result || result.perHeroShare <= 0) continue;
      for (const h of this.heroes) {
        if (h.status !== 'dead') totals.set(h.id, (totals.get(h.id) ?? 0) + result.perHeroShare);
      }
    }
    for (const [heroId, amount] of totals) {
      this.world.emit(minute, 'hero.xp_awarded', { heroId, amount, source: 'combat' });
    }
  }
}
