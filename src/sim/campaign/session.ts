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
  applyLevelUp, BOOSTS_PER_MILESTONE, checkClassEligibility, isBoostLevel, maxSkillRanks,
  skillPointsForLevel, type LevelUpApplied, type LevelUpPlan,
} from '@sim/heroes/levelUp';
import {
  activeFeats, autoGrantsForLevel, featsById, offersForSlot, slotsForLevel, FEAT_SLOT_KINDS,
  type FeatOffer, type FeatSlotKind,
} from '@sim/heroes/feats';
import { takeLongRestParty } from '@sim/heroes/longRest';
import { castableSpells, spellOffers, spellsLearnedAtLevel, type SpellOffer } from '@sim/heroes/knownSpells';
import {
  addWhileRoom, buildSpellPlan, moveSpellRule, newlyGranted, preparedViolation, setSpellRule, togglePlanned,
  type SpellPlan,
} from '@sim/heroes/spellPlan';
import { withGrantedAbilities } from '@sim/heroes/autoLoadout';
import {
  blockersFor, hasEffect, levelOf, townView, upgradeCost,
  type BuildingLevels, type BuildingView,
} from './town';
import {
  RECRUIT_COST, RECRUIT_TIERS, RESOURCE_KINDS, STARTING_BUILDINGS, emptyStock,
  type RecruitTier, type ResourceKind, type ResourceStock,
} from '@content/town';
import { allSites, siteKey, type ResourceSite } from './sites';
import { isSiteQuest, siteForQuestId, siteQuestFor } from '@content/siteQuests';
import { defaultChoiceFor, musterHero } from '@sim/campaign/muster';
import {
  acLedger, attackLedger, attackPenaltyLedger, saveLedger, hpLedger, speedLedger,
  itemContributions, slotState,
  type ItemContribution, type SlotState, type StatLedger,
} from '@sim/heroes/attribution';
import {
  isConsumableUsable, isQuickSlottable, normalizeQuickSlots, reconcileQuickSlots, trackedMask,
  QUICK_SLOT_COUNT, type QuickSlots,
} from '@sim/heroes/quickSlots';
import { portraitKey, type AncestryId, type Gender } from '@sim/heroes/ancestry';
import { difficultyFor, type DifficultyBand } from './difficulty';
import { runBackfillChain } from '@sim/save/saveStore';
import { SAVE_BACKFILLS } from '@sim/save/backfills';
import { characterLevel, type AbilityKey, type HeroState } from '@sim/heroes/types';
import { awardXp, canLevelUp, CHARACTER_LEVEL_CAP, xpForNextLevel, xpToReachLevel, type XpProgress } from '@sim/heroes/xp';
import {
  ancestryNameById, buildingsById, classesById, contentXpResolver, npcsById, progressionFor, questsById,
  shopStockRows, skillNames, spellsById, storyDialogueRows, storylineByQuestId, storylinesById,
  worldRegionsById,
} from '@sim/registry';
import {
  COMMISSION_QUEST_IDS, COMMISSIONS, EARLY_EASY_QUEST_IDS, EARLY_ONLY_QUEST_IDS, type QuestRow,
} from '@content/earlyQuests';
import { generateWorld, type WorldMap } from '@sim/world/terrain';
import { planTravel, type TravelPlan } from '@sim/world/travel';
import { EscalationLedger, type EscalationFact } from '@sim/world/escalation';
import type { LoadoutCondition, LoadoutEntry, LoadoutTargetSpec } from '@sim/combat/loadout';
import { assembleHero, assembleParty, type HeroKit } from './assembly';
import type { DispatchHero } from '@sim/dungeon/checks';

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

/** The board's plain difficulty word (M2). */
export type Ease = 'easy' | 'fair' | 'hard';

export function easeFor(band: DifficultyBand): Ease {
  if (band.id === 'routine' || band.id === 'measured') return 'easy';
  if (band.id === 'dangerous') return 'fair';
  return 'hard';
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
  /**
   * M2: the ONE plain word the board leads with — "easy", "fair" or "hard".
   * Collapses the four bands above (routine/measured → easy, dangerous →
   * fair, beyond us → hard), so it can never disagree with them.
   */
  ease: Ease;
  /** A Marshal's commission (answered letter): red seal, bonus pay, longer expiry. */
  commission: boolean;
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


// Re-exported so the UI imports its view types from one place.
export type { StatLedger, ItemContribution, SlotState };

/** The eight slots the paperdoll draws, in layout order. */
export const PAPERDOLL_SLOTS: readonly string[] = [
  'head', 'accessory', 'main_hand', 'armor', 'off_hand', 'ring', 'boots',
];

export interface AttributionSlot {
  slot: string;
  state: SlotState;
  name: string | null;
  contributions: ItemContribution[];
  /** How many stash items would fit here (0 when the slot is filled). */
  stashOptions: number;
}

export interface HeroAttribution {
  ac: StatLedger;
  attack: StatLedger;
  /** Sums to `Combatant.weaponPenalty`, applied at roll time — not to attack. */
  attackPenalties: StatLedger;
  fort: StatLedger;
  ref: StatLedger;
  will: StatLedger;
  hp: StatLedger;
  speed: StatLedger;
  slots: AttributionSlot[];
  quickSlots: { index: number; name: string | null; usable: boolean }[];
  pouchOptions: { stashIndex: number; name: string; usable: boolean }[];
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
  /** Reaching this level grants ability boosts (player's choice of abilities). */
  boostRequired: boolean;
  /**
   * How many boosts this milestone grants — 4 at levels 5/10/15/20, else 0
   * (brief #22 M4). The wizard must read THIS, never assume one: the count is
   * a design knob and hardcoding it in the UI would silently desync.
   */
  boostCount: number;
  skillNames: readonly string[];
  /** Ranks already held, by skill — the wizard greys + at the cap. */
  currentRanks: Record<string, number>;
  /** Rank ceiling at the NEW level (= character level, PF2-style — finding #4). */
  maxRanks: number;
  classes: LevelUpClassChoice[];
}

/** One offered feat slot at a level-up: the kind, and everything on the menu. */
export interface FeatSlotOffer {
  kind: FeatSlotKind;
  /** How many picks of this kind this level grants. */
  count: number;
  /** Every candidate, selectable or greyed with a reason (brief #22 D1). */
  offers: FeatOffer[];
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
  /** Marshal letters the player answered (M2; absent in older saves — backfills empty). */
  answered?: number[];
  /**
   * M3 town state. All optional: a pre-M3 save backfills to a guild with a
   * level-1 Guild Hall, no other buildings, no resources and no reputation,
   * which is exactly the state M3 starts a new campaign in — so an old save
   * loads into the new systems instead of crashing.
   */
  buildingLevels?: [number, number][];
  resources?: [string, number][];
  reputation?: number;
  /** Secured resource sites, by the region they sit in. */
  sites?: { regionId: string; kind: string; securedWeek: number }[];
  /** M4: world tiles the party has stood on ("x,y"). Absent in older saves. */
  visited?: string[];
}

/** Shop v1 tunables: weekly rotation size per building; sell-back fraction. */
export const SHOP = { rotationSlots: 6, slotsPerLevel: 2, sellFraction: 0.5 } as const;

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
  /** Marshal letters (story_dialogue ids) the player has answered — they stop showing. */
  private answered = new Set<number>();
  private dispatchN = 0;
  /**
   * M3 — the town. Level 0 = never built; the Guild Hall starts at 1 because a
   * guild with no hall cannot send anyone anywhere (its level_1 effect IS the
   * starting party size of 4).
   */
  private buildingLevels: BuildingLevels = { ...STARTING_BUILDINGS };
  private resources: ResourceStock = emptyStock();
  /**
   * Reputation. ⚠ Quest completion already awarded `rep` into an event payload
   * and NOTHING stored it, so `buildings.reputation_required` had nothing to
   * check against. M3 keeps the running total.
   */
  private reputation = 0;
  /** Secured resource sites: regionId → the kind it pays, and when it was taken. */
  private sites: { regionId: string; kind: ResourceKind; securedWeek: number }[] = [];
  /**
   * M4 — every world tile the party has actually stood on, as "x,y".
   *
   * ⚠ THE VISIT LOG IS STATE; WHAT IT REVEALS IS DERIVED. Fog is computed from
   * these points plus the guild's sight range (`@sim/world/reveal`), so
   * widening sight with a Watchtower re-reveals history instead of leaving a
   * permanent hole where the player walked before building it.
   */
  private visited = new Set<string>();
  private profile: MissionProfile = 'fullExplore';
  private caution: Caution = 'standard';
  /** Purchases against the current rotation week (stock itself derives from seeds). */
  private shopSoldWeek = 0;
  private shopSoldCounts = new Map<number, number>();
  /** Dev panel: chart shows every destination. Session-only, never saved. */
  private devRevealAll = false;

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

    // ── Resource income (M3) ──
    // Secured sites pay before the board is drawn, so a player who just took a
    // timber camp can spend that timber the same week they see the new board.
    const income = this.weeklyIncome();
    const earned: string[] = [];
    for (const kind of RESOURCE_KINDS) {
      if (income[kind] > 0) {
        this.resources[kind] += income[kind];
        earned.push(`${income[kind]} ${kind}`);
      }
    }
    if (earned.length > 0) {
      this.world.emit(this.minute, 'town.site_income', { week, totals: earned.join(', ') });
    }

    // ── Expiry sweep ──
    for (let i = this.open.length - 1; i >= 0; i--) {
      const q = this.open[i]!;
      if (week - q.postedWeek >= this.expiryWeeksFor(q.questId)) {
        this.open.splice(i, 1);
        this.expired.set(q.questId, week);
        this.world.emit(this.minute, 'world.quest_expired', { questId: String(q.questId), regionId: q.regionId });
        this.recordFact(week, q.regionId, 'quest_expired', String(q.questId));
      }
    }

    // ── Posting: authored pool, level band, region drift widens the top ──
    // M2 (Steven): "expand the board to support more than 4, target 10, but
    // don't populate it fully each week — offering 4 to 6 a week". So the
    // board CAN hold 10, but each week a seeded draw picks how many regular
    // notices the guild sees (4–6) and new ones go up until the board reaches
    // that size. Fewer only when too few quests are eligible (a thin level
    // band). The draw uses its own child stream, so the campaign Rng (ambush
    // rolls) never moves because of the board.
    // Who gets a spot, in order:
    //   1. the storyline quest — even past this week's size, never past 10
    //      (brief #6: the arc must not wait behind filler),
    //   2. weeks 1–4: easy quests until at least 2 are up — same rule
    //      (a fresh guild needs wins),
    //   3. everything else eligible up to this week's size: takeable jobs before
    //      "beyond us" ones, a camp fight and a dungeon first if the board has
    //      neither, then the seeded shuffle.
    // Marshal's commissions never post here and never count toward either cap.
    const pl = this.partyLevel();
    const boardRng = Rng.child(Seeds.campaign(this.campaignId), 'board', week);
    const target = Math.min(
      boardRng.int(SCHEDULER.postingsPerWeek.min, SCHEDULER.postingsPerWeek.max),
      SCHEDULER.maxOpenQuests,
    );
    const regularOpen = (): number => this.open.filter((o) => !COMMISSION_QUEST_IDS.has(o.questId)).length;
    const candidates = [...questsById.values()]
      .filter((row) => this.postable(row, week, pl))
      .sort((a, b) => a.id - b.id);
    const isOpen = (id: number): boolean => this.open.some((o) => o.questId === id);
    const post = (row: QuestRow): void => {
      if (isOpen(row.id)) return;
      const pos = this.questPos(row);
      const regionId = regionFor(pos);
      this.open.push({ questId: row.id, postedWeek: week, regionId, pos });
      this.world.emit(this.minute, 'world.quest_posted', {
        questId: String(row.id), regionId, kind: 'story', expiresWeek: week + SCHEDULER.expiryWeeks,
      });
    };

    for (const row of candidates) {
      if (regularOpen() < SCHEDULER.maxOpenQuests && storylineByQuestId.has(row.id)) post(row);
    }
    const early = week <= SCHEDULER.earlyWeeks;
    if (early) {
      for (const row of boardRng.shuffle(candidates.filter((r) => EARLY_EASY_QUEST_IDS.has(r.id)))) {
        const easyUp = this.open.filter((o) => EARLY_EASY_QUEST_IDS.has(o.questId)).length;
        if (easyUp >= SCHEDULER.earlyEasyMin || regularOpen() >= SCHEDULER.maxOpenQuests) break;
        post(row);
      }
    }
    // In weeks 1–4 the easy pool is spent ONLY by the guarantee above, two at
    // a time — if the shuffle could post five of them in week 1, they would
    // all expire together in week 3 and leave the guarantee nothing to post.
    // Takeable postings go first (the shuffle stays the seeded tie-break), so a
    // "beyond us" job only takes a slot once nothing the guild can do is left.
    // Without this a level-10 board drew its rows from the whole band
    // [pl − 1, pl + 2] and one row in five was a job the guild would decline.
    const shuffled = boardRng.shuffle(candidates);
    const ordered = [...shuffled.filter((r) => this.takeable(r, pl)), ...shuffled.filter((r) => !this.takeable(r, pl))];
    // A varied board has both kinds of job. With dungeons outnumbering camp
    // fights two to one, a plain draw left 18% of mid-level weeks (up to 43% at
    // level 10) with no camp fight or no dungeon to pick; this rule: 0.5%. So a
    // kind missing from the board gets the first free slot — still drawn from
    // `ordered`, so still takeable-first.
    for (const kind of ['combat', 'dungeon']) {
      if (regularOpen() >= target) break;
      if (this.open.some((o) => !COMMISSION_QUEST_IDS.has(o.questId) && questsById.get(o.questId)?.quest_type === kind)) continue;
      const row = ordered.find((r) => r.quest_type === kind && !isOpen(r.id) && !(early && EARLY_EASY_QUEST_IDS.has(r.id)));
      if (row) post(row);
    }
    for (const row of ordered) {
      if (regularOpen() >= target) break;
      if (early && EARLY_EASY_QUEST_IDS.has(row.id)) continue;
      post(row);
    }
  }

  /**
   * May this row go up on the board this week? Cooldowns, arc gating, the
   * level band, and the early-weeks window for hand-authored easy quests.
   * Commissions never post through the weekly scan — only a letter posts them.
   */
  private postable(row: QuestRow, week: number, pl: number): boolean {
    if (COMMISSION_QUEST_IDS.has(row.id)) return false;
    /**
     * ⚠ A SITE EXPEDITION IS NEVER DRAWN ON THE BOARD. It lives in
     * `questsById` only because `launchDispatch` resolves quests through it;
     * the player chooses an expedition off the SITES list. Letting these post
     * would both flood the board (12 extra rows) and let a site be taken by
     * accident by someone browsing notices.
     */
    if (isSiteQuest(row.id)) return false;
    if (EARLY_ONLY_QUEST_IDS.has(row.id) && week > SCHEDULER.earlyWeeks) return false;
    const doneWeek = this.completed.get(row.id);
    if (doneWeek !== undefined && week - doneWeek < SCHEDULER.expiryWeeks) return false;
    const expiredWeek = this.expired.get(row.id);
    if (expiredWeek !== undefined && week - expiredWeek < SCHEDULER.expiryWeeks) return false;
    if (this.open.some((o) => o.questId === row.id)) return false;
    if (!this.storylineUnlocked(row.id)) return false; // arc quests post in sequence (brief #6)
    if (doneWeek !== undefined && storylineByQuestId.has(row.id)) return false; // arc beats happen ONCE
    if (this.active?.questId === row.id) return false; // live play: an accepted quest is off the board
    const regionId = regionFor(this.questPos(row));
    const drift = this.ledger.effectsFor(regionId).questLevelDrift;
    if (row.min_level < pl - SCHEDULER.levelBandBelow) return false;
    if (row.min_level > pl + SCHEDULER.levelBandAbove + drift) return false;
    return true;
  }

  /** The guild would take this job: its challenge is within reach of the party (see SCHEDULER.takeableAbove). */
  private takeable(row: QuestRow, partyLevel: number): boolean {
    const challenge = Math.max(row.dungeon_level ?? row.min_level, 1);
    return challenge <= partyLevel + SCHEDULER.takeableAbove;
  }

  /** Weeks a posting stays up: commissions linger longer than normal notices. */
  private expiryWeeksFor(questId: number): number {
    return COMMISSION_QUEST_IDS.has(questId) ? SCHEDULER.commissionExpiryWeeks : SCHEDULER.expiryWeeks;
  }

  /**
   * The player answers a Marshal letter (any of its choices). The letter is
   * marked answered — it stops showing, and that persists in the save — and
   * the letter's commission goes up on the board: a real quest with a bonus
   * reward and a longer expiry. One commission per letter, ever.
   */
  answerLetter(dialogueId: number, choiceIndex = 0): void {
    const letter = this.pendingDialogue().find((d) => d.id === dialogueId);
    if (!letter) throw new Error(`answerLetter: letter ${dialogueId} is not waiting for an answer`);
    if (letter.choices.length > 0 && (choiceIndex < 0 || choiceIndex >= letter.choices.length)) {
      throw new Error(`answerLetter: letter ${dialogueId} has no choice ${choiceIndex}`);
    }
    this.answered.add(dialogueId);
    const commission = COMMISSIONS.find((c) => c.dialogueId === dialogueId);
    if (!commission) return;
    const id = commission.quest.id;
    if (this.completed.has(id) || this.open.some((o) => o.questId === id) || this.active?.questId === id) return;
    const pos = this.questPos(commission.quest);
    const regionId = regionFor(pos);
    this.open.push({ questId: id, postedWeek: this.week, regionId, pos });
    this.world.emit(this.minute, 'world.quest_posted', {
      questId: String(id), regionId, kind: 'story', expiresWeek: this.week + SCHEDULER.commissionExpiryWeeks,
    });
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
      expiresWeek: q.postedWeek + this.expiryWeeksFor(q.questId),
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
    /**
     * ⚠ THE LONG REST HAPPENS HERE, AT THE HAVEN — NOT IN THE DUNGEON.
     * `dungeon/dispatch.ts` already has a rest and it declares itself SHORT
     * (`explore.rested` with `package: 'short'`): it heals a fraction of max HP
     * and is rationed by `PROFILES.roomsPerRestCharge`. If that path refreshed
     * long-rest charges too, the third limiter tier would collapse into the
     * second and a once-per-expedition ability would fire every few rooms.
     *
     * So the boundary is the dispatch: the party rests between expeditions,
     * at the same moment the wounded ratchet clears above.
     */
    takeLongRestParty(this.heroes);
    /**
     * ⚠ THE MASK IS TAKEN BEFORE THE DISPATCH, AND THAT ORDER IS LOAD-BEARING.
     * `toCombatQuickSlots` mirrors only the items the ENGINE can execute, so a
     * `buff` potion is null from the start. After the run, "null" alone cannot
     * distinguish "drunk" from "never tracked" — reading the mask afterwards
     * would therefore delete every inert consumable on the party's first fight.
     */
    const quickSlotMasks = this.kits.map((k) => trackedMask(normalizeQuickSlots(k.quickSlots)));
    const party = assembleParty(this.kits);
    this.dispatchN++;
    const dispatchId = Ids.dispatch(this.dispatchN);

    // ── Travel out ──
    // M4: the guild learns the land by walking it. Haven is always known.
    this.visited.add(`${WORLD.haven.x},${WORLD.haven.y}`);
    this.visited.add(`${q.pos.x},${q.pos.y}`);
    const plan = planTravel(this.map, WORLD.haven, q.pos);
    if (plan) {
      this.world.emit(minute, 'dispatch.travel_leg_started', {
        fromX: WORLD.haven.x, fromY: WORLD.haven.y, toX: q.pos.x, toY: q.pos.y, etaMinutes: plan.etaMinutes,
      }, q.acceptSeq);
      // Every tile on the road is seen in passing, not just the destination.
      for (const step of plan.path) this.visited.add(`${step.x},${step.y}`);
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
      /**
       * M3: the Library's xp_bonus_Npct applies here, and reputation is now
       * BANKED rather than only announced — `reputation_required` on the
       * buildings table had nothing to check against before this line.
       */
      const questXp = Math.round((quest.reward_xp as number) * this.xpMultiplier());
      const questRep = quest.reward_reputation as number;
      this.reputation += questRep;
      /**
       * ⚠ THIS IS THE ONLY LEGITIMATE WAY A SITE BECOMES SECURED IN PLAY.
       * `secureSite` is public for tests and dev tooling, but the earning path
       * is winning the expedition — the site is the reward, which is why the
       * gold purse on these rows is deliberately thin.
       */
      const siteLink = siteForQuestId(q.questId);
      if (siteLink) this.secureSite(siteLink.regionId, siteLink.kind, minute);
      if (dispatch) this.stash.push(...dispatch.items);
      const doneEv = this.world.emit(minute, 'world.quest_completed', {
        questId: String(q.questId), regionId: q.regionId,
        xp: questXp, gold: quest.reward_gold as number, rep: questRep,
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

    /**
     * ⚠ WITHOUT THIS THE PARTY HAS INFINITE POTIONS. The sim spends from the
     * Combatant mirror; this is the only place that spend becomes real. Runs
     * on EVERY outcome — victory, retreat, wipe — because a potion drunk in a
     * fight you then lost is still gone.
     */
    this.reconcilePartyQuickSlots(party, quickSlotMasks);

    this.active = null;
    this.minute = minute;
    return { week, questId: q.questId, outcome, ...(dispatch ? { dispatch } : {}), ...(fights.length > 0 ? { fights } : {}) };
  }

  /** Write each hero's consumed quick-slots back from the dispatch mirror. */
  private reconcilePartyQuickSlots(party: DispatchHero[], masks: readonly boolean[][]): void {
    party.forEach((h, i) => {
      const kit = this.kits[i];
      const mask = masks[i];
      if (!kit || !mask) return;
      const slots = normalizeQuickSlots(kit.quickSlots);
      reconcileQuickSlots(slots, h.c.quickSlots, mask);
      kit.quickSlots = slots;
    });
  }

  /**
   * The feat slots a prospective level-up grants, each with its full menu.
   *
   * ⚠ Returns EVERY slot kind the schedule grants, including kinds whose pool
   * is empty (D1: the ancestry track grants 5 per career against ZERO ancestry
   * feats). The UI greys those rather than hiding them, so the hole stays
   * legible instead of silently absent.
   */
  featSlotsFor(heroId: string, classId: number): FeatSlotOffer[] {
    const hero = this.heroState(heroId);
    const nextClassLevel = (hero.classLevels.find((cl) => cl.classId === classId)?.level ?? 0) + 1;
    const counts = slotsForLevel(classId, nextClassLevel);
    const out: FeatSlotOffer[] = [];
    for (const kind of FEAT_SLOT_KINDS) {
      const count = counts[kind];
      if (count <= 0) continue;
      out.push({ kind, count, offers: offersForSlot(hero, classId, kind) });
    }
    return out;
  }

  /** Feats auto-granted by the class features of a prospective level-up. */
  autoGrantsFor(heroId: string, classId: number): number[] {
    const hero = this.heroState(heroId);
    const nextClassLevel = (hero.classLevels.find((cl) => cl.classId === classId)?.level ?? 0) + 1;
    return autoGrantsForLevel(classId, nextClassLevel);
  }

  /** The existing atomic applyLevelUp with a player-chosen plan; hpPerLevel derives here. */
  applyLevelUp(heroId: string, plan: SessionLevelUpPlan): LevelUpApplied {
    const hero = this.heroes.find((h) => h.id === heroId);
    if (!hero) throw new Error(`applyLevelUp: unknown hero ${heroId}`);
    const nextClassLevel = (hero.classLevels.find((cl) => cl.classId === plan.classId)?.level ?? 0) + 1;
    const prog = progressionFor(plan.classId, nextClassLevel);
    if (!prog) throw new Error(`applyLevelUp: class ${plan.classId} has no level ${nextClassLevel}`);
    // Class features that name a real feat row are granted automatically — the
    // player never picks Reactive Strike, the Fighter class hands it over at
    // level 1. Merged with whatever the caller already passed, deduped downstream.
    const autoGranted = [...new Set([
      ...plan.autoGrantedFeatIds,
      ...autoGrantsForLevel(plan.classId, nextClassLevel),
    ])];
    const levelBefore = nextClassLevel - 1;
    const applied = applyLevelUp(hero, {
      ...plan,
      autoGrantedFeatIds: autoGranted,
      hpPerLevel: prog.hp_per_level as number,
    });
    // M1: spells learned this level join the fight — see heroes/autoLoadout.ts.
    // M2: prepared casters only while that spell level has a free slot; a
    // Cleric's newly GRANTED spells (whole divine list) are offered the same way.
    const candidates = [
      ...(plan.spells ?? []),
      ...newlyGranted(plan.classId, levelBefore, nextClassLevel),
    ];
    if (candidates.length > 0) {
      const kit = this.kitFor(heroId);
      kit.loadout = addWhileRoom(hero, kit.loadout, candidates);
    }
    // M2: a NON-STRIKE ability gained this level joins the fight plan, the way
    // a learned spell does — a bard's Inspire Courage must not need a trip to
    // a menu. Strike riders stay out; see heroes/autoLoadout.ts for the
    // measurement that separates the two.
    {
      const kit = this.kitFor(heroId);
      kit.loadout = withGrantedAbilities(
        kit.loadout,
        [...plan.feats.map((f) => f.featId), ...autoGranted],
      );
    }
    this.world.emit(this.minute, 'hero.level_up_applied', {
      heroId: hero.id, newLevel: applied.newCharacterLevel, classId: String(applied.classId),
    });
    return applied;
  }

  /** M1: spells this hero may learn when taking `classId` next, and how many to pick. */
  spellPicksFor(heroId: string, classId: number): { count: number; offers: SpellOffer[] } {
    const hero = this.heroState(heroId);
    const nextClassLevel = (hero.classLevels.find((cl) => cl.classId === classId)?.level ?? 0) + 1;
    const offers = spellOffers(hero, classId, nextClassLevel);
    const learnable = offers.filter((o) => o.selectable).length;
    return { count: Math.min(spellsLearnedAtLevel(classId, nextClassLevel), learnable), offers };
  }

  /**
   * Stash → the hero. ONE VERB FOR EVERYTHING THE HERO CAN CARRY.
   *
   * ⚠ CONSUMABLES ROUTE THEMSELVES TO THE POUCH. A potion has no gear slot,
   * so an earlier version threw "not equippable" and the UI grew a SECOND,
   * differently-named control for stocking one. Steven called that out: the
   * player does not care that the engine models a pouch differently from a
   * scabbard, and breaking the convention for one item type is just a thing
   * to re-learn. Same button, same verb, the sim works out where it goes.
   *
   * The gear/pouch DISTINCTION still exists where it matters — D3 still keeps
   * longswords out of quick-slots — it is only the player's vocabulary that
   * collapses to one word.
   */
  equip(heroId: string, stashIndex: number): void {
    const kit = this.kitFor(heroId);
    const instance = this.stash[stashIndex];
    if (!instance) throw new Error(`equip: no stash item at index ${stashIndex}`);

    if (isQuickSlottable(instance.baseId)) {
      const free = normalizeQuickSlots(kit.quickSlots).findIndex((q) => q === null);
      if (free < 0) throw new Error('equip: every pouch slot is full');
      this.setQuickSlot(heroId, free, stashIndex);
      return;
    }

    const slot = itemBasesById.get(instance.baseId)?.slot as string | null | undefined;
    if (!slot) throw new Error(`equip: ${instance.baseId} is not equippable (no slot)`);
    this.stash.splice(stashIndex, 1);
    const displaced = kit.equipped.findIndex((e) => (itemBasesById.get(e.baseId)?.slot as string | null) === slot);
    if (displaced >= 0) this.stash.push(...kit.equipped.splice(displaced, 1));
    kit.equipped.push(instance);
  }

  /**
   * What a STASH item would do for this hero, for the tooltip.
   *
   * ⚠ HERO-RELATIVE, because the same item is not worth the same to everyone:
   * a greatsword names its −4 for a wizard and not for a fighter. Computing it
   * against the hero who is looking at it is the whole point.
   */
  itemContributionsFor(heroId: string, stashIndex: number): ItemContribution[] {
    const instance = this.stash[stashIndex];
    if (!instance) return [];
    return itemContributions(this.kitFor(heroId).hero, instance);
  }

  /**
   * Can this stash item go anywhere on this hero right now?
   *
   * ⚠ THE UI ASKS THE SIM, IT DOES NOT RE-DERIVE THE RULE. A disabled button
   * whose reasoning lives in the component drifts from the verb it calls.
   */
  equipTarget(heroId: string, stashIndex: number): { kind: 'gear' | 'pouch' | 'none'; reason: string } {
    const instance = this.stash[stashIndex];
    if (!instance) return { kind: 'none', reason: 'no such item' };
    if (isQuickSlottable(instance.baseId)) {
      const kit = this.kitFor(heroId);
      const free = normalizeQuickSlots(kit.quickSlots).some((q) => q === null);
      return free
        ? { kind: 'pouch', reason: 'into the pouch' }
        : { kind: 'none', reason: 'the pouch is full' };
    }
    const slot = itemBasesById.get(instance.baseId)?.slot as string | null | undefined;
    return slot
      ? { kind: 'gear', reason: `into the ${slot.replace('_', ' ')} slot` }
      : { kind: 'none', reason: 'cannot be carried' };
  }

  /**
   * Stash → quick-slot (brief #23 M3). The pre-expedition pouch.
   *
   * ⚠ D3's rule is enforced HERE, not in the UI: `consumable` and `scroll`
   * only. Gear belongs in gear slots, and putting the check in the sim means
   * no future caller can quick-slot a longsword.
   *
   * An occupied slot swaps its item back to the stash, mirroring `equip()`.
   */
  setQuickSlot(heroId: string, slotIndex: number, stashIndex: number): void {
    if (slotIndex < 0 || slotIndex >= QUICK_SLOT_COUNT) {
      throw new Error(`setQuickSlot: slot ${slotIndex} is out of range (0-${QUICK_SLOT_COUNT - 1})`);
    }
    const kit = this.kitFor(heroId);
    const instance = this.stash[stashIndex];
    if (!instance) throw new Error(`setQuickSlot: no stash item at index ${stashIndex}`);
    if (!isQuickSlottable(instance.baseId)) {
      throw new Error(`setQuickSlot: ${instance.baseId} is not a consumable or scroll`);
    }
    const slots = normalizeQuickSlots(kit.quickSlots);
    this.stash.splice(stashIndex, 1);
    const displaced = slots[slotIndex];
    if (displaced) this.stash.push(displaced);
    slots[slotIndex] = instance;
    kit.quickSlots = slots;
  }

  /** Quick-slot → stash. */
  clearQuickSlot(heroId: string, slotIndex: number): void {
    const kit = this.kitFor(heroId);
    const slots = normalizeQuickSlots(kit.quickSlots);
    const instance = slots[slotIndex];
    if (!instance) throw new Error(`clearQuickSlot: slot ${slotIndex} is empty`);
    this.stash.push(instance);
    slots[slotIndex] = null;
    kit.quickSlots = slots;
  }

  /** The hero's pouch, always exactly QUICK_SLOT_COUNT entries. */
  quickSlotsFor(heroId: string): QuickSlots {
    return normalizeQuickSlots(this.kitFor(heroId).quickSlots);
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
    const bad = preparedViolation(this.heroState(heroId), entries);
    if (bad) throw new Error(`setLoadout: ${bad}`);
    kit.loadout = jsonClone(entries);
  }

  /** M2: the caster's spell page — usable spells by level, what is prepared, the order tried. */
  spellPlan(heroId: string): SpellPlan | null {
    return buildSpellPlan(this.heroState(heroId), this.kitFor(heroId).loadout);
  }

  /** M2: prepare / unprepare one spell. Throws when that spell level is full. */
  toggleSpellPlanned(heroId: string, spellId: number): void {
    const kit = this.kitFor(heroId);
    kit.loadout = togglePlanned(this.heroState(heroId), kit.loadout, spellId);
  }

  /** M2: move a planned spell up (-1) or down (+1) in the order it is tried. */
  moveSpellInPlan(heroId: string, loadoutIndex: number, dir: -1 | 1): void {
    const kit = this.kitFor(heroId);
    kit.loadout = moveSpellRule(kit.loadout, loadoutIndex, dir);
  }

  /** M2: change when, and at whom, a planned spell is cast. */
  setSpellPlanRule(heroId: string, loadoutIndex: number, condition: LoadoutCondition, target: LoadoutTargetSpec): void {
    const kit = this.kitFor(heroId);
    kit.loadout = setSpellRule(kit.loadout, loadoutIndex, condition, target);
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
    this.gold += Math.floor(deriveItem(instance).price * this.sellFraction());
  }

  // ── Dev panel commands (playtest tooling — output/working-agreement.md §7) ──
  // Real commands, not UI hacks, so they mutate the same state play does and
  // a save taken afterwards round-trips like any other.

  devAddGold(amount: number): void {
    if (!Number.isFinite(amount)) throw new Error('devAddGold: amount must be finite');
    this.gold = Math.max(0, this.gold + Math.trunc(amount));
  }

  /** Grants exactly enough XP for the hero to reach the NEXT level (the level-up itself stays a player act). */
  devGrantLevel(heroId: string): void {
    const hero = this.heroState(heroId);
    const level = characterLevel(hero);
    if (level >= CHARACTER_LEVEL_CAP) return;
    hero.xp = Math.max(hero.xp, xpToReachLevel(level + 1));
  }

  devHealAll(): void {
    for (const h of this.heroes) {
      if (h.status === 'dead') h.status = 'active';
      h.wounded = 0;
    }
  }

  devRevealMap(on: boolean): void {
    this.devRevealAll = on;
  }

  devMapRevealed(): boolean {
    return this.devRevealAll;
  }

  /** Clears an in-flight quest so the board is usable again. */
  devClearActive(): void {
    this.active = null;
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


  /**
   * THE CHARACTER SHEET'S ATTRIBUTION VIEW (brief #24, Variant G).
   *
   * ⚠ EVERY LEDGER HERE IS CHECKED AGAINST `assembleHero` BY TEST. The whole
   * value of this surface is that the explanation matches the number the sim
   * actually uses — a plausible-but-drifted breakdown is worse than none,
   * because it looks authoritative while being wrong.
   */
  heroAttribution(heroId: string): HeroAttribution {
    const kit = this.kitFor(heroId);
    const { hero, equipped } = kit;

    const bySlot = new Map<string, ItemInstance>();
    for (const instance of equipped) {
      const slot = deriveItem(instance).slot;
      if (slot) bySlot.set(slot, instance);
    }

    const slots: AttributionSlot[] = PAPERDOLL_SLOTS.map((slot) => {
      const instance = bySlot.get(slot) ?? null;
      return {
        slot,
        state: slotState(hero, instance),
        name: instance ? deriveItem(instance).displayName : null,
        contributions: instance ? itemContributions(hero, instance) : [],
        /**
         * ⚠ "Could this slot be filled from the stash?" is what turns an empty
         * box into an ACTIONABLE one. An empty ring slot with nothing to put in
         * it is not a problem the player can solve; one with a ring waiting in
         * the stash is.
         */
        stashOptions: instance ? 0 : this.stash.filter((i) => deriveItem(i).slot === slot).length,
      };
    });

    return {
      ac: acLedger(hero, equipped),
      attack: attackLedger(hero, equipped),
      attackPenalties: attackPenaltyLedger(hero, equipped),
      fort: saveLedger(hero, equipped, 'fort'),
      ref: saveLedger(hero, equipped, 'ref'),
      will: saveLedger(hero, equipped, 'will'),
      hp: hpLedger(hero, equipped),
      speed: speedLedger(hero, equipped),
      slots,
      quickSlots: normalizeQuickSlots(kit.quickSlots).map((inst, index) => ({
        index,
        name: inst ? (itemBasesById.get(inst.baseId)?.name as string) ?? inst.baseId : null,
        usable: inst ? isConsumableUsable(inst.baseId) : false,
      })),
      /** Stash items that can go in a pouch, for the quick-slot picker. */
      pouchOptions: this.stash
        .map((inst, stashIndex) => ({ inst, stashIndex }))
        .filter(({ inst }) => isQuickSlottable(inst.baseId))
        .map(({ inst, stashIndex }) => ({
          stashIndex,
          name: (itemBasesById.get(inst.baseId)?.name as string) ?? inst.baseId,
          usable: isConsumableUsable(inst.baseId),
        })),
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
      boostCount: boostRequired ? BOOSTS_PER_MILESTONE : 0,
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

  // ── THE TOWN (M3) ────────────────────────────────────────────────────────

  /** Every building, what it gives now, what the next level costs and why it is blocked. */
  town(): BuildingView[] {
    return townView(this.buildingLevels, this.gold, this.resources, this.reputation);
  }

  buildingLevel(buildingId: number): number {
    return levelOf(this.buildingLevels, buildingId);
  }

  resourceStock(): ResourceStock {
    return { ...this.resources };
  }

  reputationTotal(): number {
    return this.reputation;
  }

  securedSites(): { regionId: string; kind: ResourceKind; securedWeek: number }[] {
    return this.sites.map((s) => ({ ...s }));
  }

  /**
   * Every world tile the party has stood on. The fog layer turns these into a
   * revealed area; see `@sim/world/reveal`.
   */
  visitedTiles(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (const key of this.visited) {
      const [x, y] = key.split(',').map(Number);
      if (x !== undefined && y !== undefined) out.push({ x, y });
    }
    return out;
  }

  /**
   * Buy the next level of a building. Throws on anything the player could not
   * legitimately do, so the UI never has to guess — it reads `town()` for the
   * blockers and only calls this on an unblocked row.
   */
  upgradeBuilding(buildingId: number): { level: number; gold: number } {
    const blockers = blockersFor(
      buildingId, this.buildingLevels, this.gold, this.resources, this.reputation,
    );
    if (blockers.length > 0) {
      throw new Error(`upgradeBuilding ${buildingId}: ${blockers.map((b) => b.text).join(' ')}`);
    }
    const next = levelOf(this.buildingLevels, buildingId) + 1;
    const cost = upgradeCost(buildingId, next);
    this.gold -= cost.gold;
    for (const kind of RESOURCE_KINDS) {
      const need = cost.resources[kind] ?? 0;
      if (need > 0) this.resources[kind] -= need;
    }
    this.buildingLevels[buildingId] = next;
    this.world.emit(this.minute, 'town.building_upgraded', {
      buildingId: String(buildingId), level: next, goldSpent: cost.gold,
    });
    return { level: next, gold: this.gold };
  }

  /**
   * PARTY SIZE — the guild-hall ladder, and the first building effect with
   * teeth. `party_size_N` is read here and nowhere else.
   *
   * ⚠ Reads the EFFECT, not the level number. A Guild Hall at level 2 means 5
   * only because its `level_2` effect string says `party_size_5`; keying on
   * the level would silently diverge the moment the content changed.
   */
  maxPartySize(): number {
    for (const n of [6, 5, 4]) {
      if (hasEffect(this.buildingLevels, `party_size_${n}`)) return n;
    }
    return 4;
  }

  /** Market: what a sold item fetches, as a fraction of its worth. */
  sellFraction(): number {
    if (hasEffect(this.buildingLevels, 'sell_price_100pct')) return 1;
    if (hasEffect(this.buildingLevels, 'sell_price_90pct')) return 0.9;
    if (hasEffect(this.buildingLevels, 'sell_price_80pct')) return 0.8;
    return SHOP.sellFraction;
  }

  /** Library: a multiplier on quest XP. */
  xpMultiplier(): number {
    if (hasEffect(this.buildingLevels, 'xp_bonus_10pct')) return 1.1;
    if (hasEffect(this.buildingLevels, 'xp_bonus_5pct')) return 1.05;
    return 1;
  }

  /** Stables: a multiplier on travel time (lower is faster). */
  travelMultiplier(): number {
    if (hasEffect(this.buildingLevels, 'travel_speed_50pct')) return 0.5;
    if (hasEffect(this.buildingLevels, 'travel_speed_25pct')) return 0.75;
    return 1;
  }

  /**
   * Send the party to take a site. Sets it as the active objective; the player
   * then launches it with the ordinary `launchDispatch()`, so an expedition
   * travels, fights, pays XP and shows up in the report like any other job.
   *
   * ⚠ Does NOT secure the site. Winning does — see `launchDispatch`.
   */
  acceptSiteExpedition(regionId: string, kind: ResourceKind): number {
    const site = this.resourceSites().find((st) => st.regionId === regionId && st.kind === kind);
    if (!site) throw new Error(`acceptSiteExpedition: no ${kind} site in ${regionId}`);
    if (site.secured) throw new Error(`acceptSiteExpedition: the guild already holds the ${kind} site`);
    if (this.active) throw new Error('acceptSiteExpedition: the party is already out on a job');
    const link = siteQuestFor(regionId, kind);
    if (!link) throw new Error(`acceptSiteExpedition: no expedition exists for ${kind} in ${regionId}`);

    const ev = this.world.emit(this.minute, 'world.quest_accepted', {
      questId: String(link.questId), partyId: Ids.party(1),
    });
    this.active = {
      questId: link.questId,
      postedWeek: this.week,
      regionId,
      pos: site.pos,
      acceptSeq: ev.seq,
    };
    return link.questId;
  }

  /** The expeditions the guild could mount right now: every site it does not hold. */
  availableExpeditions(): { questId: number; site: ResourceSite }[] {
    const out: { questId: number; site: ResourceSite }[] = [];
    for (const site of this.resourceSites()) {
      if (site.secured) continue;
      const link = siteQuestFor(site.regionId, site.kind);
      if (link) out.push({ questId: link.questId, site });
    }
    return out;
  }

  /**
   * Every resource site in the world, with whether the guild holds it.
   *
   * Derived from the region table and the world seed each call; only the
   * `secured` flag is state. Cheapest first, so the list reads as a to-do.
   */
  resourceSites(): (ResourceSite & { secured: boolean })[] {
    const held = new Set(this.sites.map((st) => siteKey(st.regionId, st.kind)));
    return allSites(this.map, this.map.seed).map((site) => ({
      ...site,
      secured: held.has(siteKey(site.regionId, site.kind)),
    }));
  }

  /**
   * Take a site. The expedition itself is a dispatch the player already ran —
   * this banks the result.
   *
   * ⚠ Idempotent by (region, kind): securing a site twice does not double its
   * income, because the weekly payout iterates the stored list.
   */
  secureSite(regionId: string, kind: ResourceKind, atMinute = this.minute): void {
    const site = this.resourceSites().find((st) => st.regionId === regionId && st.kind === kind);
    if (!site) throw new Error(`secureSite: no ${kind} site in ${regionId}`);
    if (site.secured) return;
    this.sites.push({ regionId, kind, securedWeek: this.week });
    /**
     * ⚠ `atMinute` IS NOT OPTIONAL POLISH. `launchDispatch` tracks its own
     * local `minute` that runs ahead of `this.minute` for the whole expedition
     * (travel out, the fight, travel home), and `this.minute` is only
     * reconciled at the end. Emitting at `this.minute` from inside a dispatch
     * sends the event stream BACKWARDS, which its monotonic guard rejects
     * outright — measured: "time went backwards (30 -> 0)".
     */
    this.world.emit(atMinute, 'town.site_secured', { regionId, kind, yield: site.yield });
  }

  /** Units per week the guild currently earns, by kind. */
  weeklyIncome(): ResourceStock {
    const out = emptyStock();
    for (const site of this.resourceSites()) {
      if (site.secured) out[site.kind] += site.yield;
    }
    return out;
  }

  // ── RECRUITING (M3) ──────────────────────────────────────────────────────

  /**
   * Who the Tavern can introduce right now.
   *
   * ⚠ Gated on the Tavern's authored effect strings, not on its level number,
   * so re-authoring the Tavern re-aims this without touching the engine.
   */
  recruitPool(): { classId: number; className: string; tier: RecruitTier; cost: number }[] {
    const out: { classId: number; className: string; tier: RecruitTier; cost: number }[] = [];
    const tiers: RecruitTier[] = ['common', 'uncommon', 'rare'];
    for (const tier of tiers) {
      if (!hasEffect(this.buildingLevels, `recruit_${tier}`)) continue;
      for (const classId of RECRUIT_TIERS[tier]) {
        out.push({
          classId,
          className: classesById.get(classId)?.name ?? `class ${classId}`,
          tier,
          cost: RECRUIT_COST[tier],
        });
      }
    }
    return out;
  }

  /** Roster size, which is also the party that walks out of the gate. */
  rosterSize(): number {
    return this.kits.length;
  }

  /**
   * Hire a hero. Throws rather than silently failing, same contract as
   * `upgradeBuilding` — the UI reads `recruitPool()` and `maxPartySize()` and
   * only calls this when it is legal.
   */
  recruitHero(classId: number, name = ''): HeroKit {
    const offer = this.recruitPool().find((o) => o.classId === classId);
    if (!offer) {
      throw new Error(`recruitHero: no ${classId} available — the Tavern does not reach that tier yet`);
    }
    if (this.kits.length >= this.maxPartySize()) {
      throw new Error(
        `recruitHero: the guild hall holds ${this.maxPartySize()} — upgrade it before hiring a ${offer.className}`,
      );
    }
    if (this.gold < offer.cost) {
      throw new Error(`recruitHero: need ${offer.cost}g, have ${this.gold}g`);
    }
    this.gold -= offer.cost;
    /**
     * ⚠ INDEXED BY ROSTER LENGTH, WHICH IS SAFE ONLY BECAUSE NOTHING IS EVER
     * REMOVED FROM `kits`. A dead hero keeps their slot (status carries the
     * death), so ids stay unique. If removal is ever added, this needs a
     * monotonic counter instead or two heroes will share an id.
     */
    const choice = { ...defaultChoiceFor(classId), ...(name.trim() ? { name: name.trim() } : {}) };
    const kit = musterHero(choice, this.kits.length);
    this.kits.push(kit);
    this.heroes.push(kit.hero);
    this.world.emit(this.minute, 'town.hero_recruited', {
      heroId: kit.hero.id, className: offer.className, cost: offer.cost,
    });
    return kit;
  }

  /** Dev/testing: hand the guild resources without securing a site. */
  grantResources(amounts: Partial<ResourceStock>): void {
    for (const kind of RESOURCE_KINDS) {
      const add = amounts[kind] ?? 0;
      if (add !== 0) this.resources[kind] = Math.max(0, this.resources[kind] + Math.trunc(add));
    }
  }

  /** Dev/testing: move reputation. */
  grantReputation(amount: number): void {
    this.reputation = Math.max(0, this.reputation + Math.trunc(amount));
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
      // M3: the gate is the guild's actual building level. 45 of 105 rows sat
      // behind a hardcoded `continue` here — "building levels arrive with the
      // town systems" — and this is those systems arriving.
      if ((row.required_building_level as number) > levelOf(this.buildingLevels, row.building_id as number)) continue;
      const rows = byBuilding.get(row.building_id as number) ?? [];
      rows.push(row);
      byBuilding.set(row.building_id as number, rows);
    }
    for (const [buildingId, rows] of [...byBuilding.entries()].sort((a, b) => a[0] - b[0])) {
      const rng = new Rng(Seeds.rotation(buildingId, this.week));
      /**
       * M3 — THE SHELF GROWS WITH THE BUILDING. Measured: with a flat 6 slots,
       * upgrading the Blacksmith left the offer count at 12 and changed only
       * WHICH six rotated, so the thing the player just paid for was invisible.
       * Widening the rotation is what makes the unlocked rows actually surface.
       */
      const slots = SHOP.rotationSlots + (levelOf(this.buildingLevels, buildingId) - 1) * SHOP.slotsPerLevel;
      const rotation = rows.length <= slots ? rows : rng.shuffle(rows).slice(0, slots);
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
      const challenge = Math.max(row.dungeon_level ?? row.min_level, 1);
      return {
        questId: o.questId,
        name: row.name,
        minLevel: row.min_level,
        challenge,
        difficulty: difficultyFor(challenge, partyLevel),
        ease: easeFor(difficultyFor(challenge, partyLevel)),
        commission: COMMISSION_QUEST_IDS.has(o.questId),
        regionId: o.regionId,
        postedWeek: o.postedWeek,
        expiresWeek: o.postedWeek + this.expiryWeeksFor(o.questId),
        rewardGold: row.reward_gold,
        rewardXp: row.reward_xp,
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
    if (this.devRevealAll) return true;
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

  /** Authored quest name (quests table), falling back to "Quest #id". */
  questName(questId: number): string {
    return (questsById.get(questId)?.name as string | undefined) ?? `Quest #${questId}`;
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
      if (this.answered.has(row.id)) continue; // the player answered this letter
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
      answered: [...this.answered].sort((a, b) => a - b),
      // M3 town state. Sorted so a save is byte-stable for the save-format test.
      buildingLevels: Object.entries(this.buildingLevels)
        .map(([id, lvl]) => [Number(id), lvl] as [number, number])
        .sort((a, b) => a[0] - b[0]),
      resources: RESOURCE_KINDS.map((k) => [k, this.resources[k]] as [string, number]),
      reputation: this.reputation,
      sites: this.sites.map((st) => ({ ...st })),
      visited: [...this.visited].sort(),
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
    // M2: pre-commission saves have no answered letters — every letter shows again.
    session.answered = new Set(Array.isArray(data.answered) ? data.answered : []);
    // M3: the backfill stage guarantees these are present and well-shaped.
    session.buildingLevels = Object.fromEntries(data.buildingLevels ?? [[1, 1]]);
    session.resources = emptyStock();
    for (const [kind, n] of data.resources ?? []) {
      if ((RESOURCE_KINDS as readonly string[]).includes(kind)) session.resources[kind as ResourceKind] = n;
    }
    session.reputation = data.reputation ?? 0;
    // M4: a pre-M4 save has walked the world but never recorded it. Haven is
    // seeded so the map is never wholly black; the rest re-reveals as played.
    session.visited = new Set(
      (data.visited ?? []).filter((k) => typeof k === 'string' && /^\d+,\d+$/.test(k)),
    );
    session.visited.add(`${WORLD.haven.x},${WORLD.haven.y}`);
    session.sites = (data.sites ?? [])
      .filter((st) => (RESOURCE_KINDS as readonly string[]).includes(st.kind))
      .map((st) => ({ regionId: st.regionId, kind: st.kind as ResourceKind, securedWeek: st.securedWeek }));
    return session;
  }

  /** A feat's display name, for the auto-grant list and any picker label. */
  featName(featId: number): string {
    return featsById.get(featId)?.name ?? `Feat ${featId}`;
  }

  /**
   * What this hero can ADD to their loadout right now (brief #22 M3/M2) — the
   * pool half of core-loop D4, finally executable.
   *
   * ⚠ Both lists are already filtered to what the ENGINE can execute:
   * `castableSpells` drops the 140 inert rows, `activeFeats` drops every
   * unwired `combat_action`. The editor must never offer an entry the AI would
   * silently skip, because a loadout row that never fires is indistinguishable
   * from a bug at the table.
   */
  loadoutChoices(heroId: string): {
    spells: { spellId: number; name: string; spellLevel: number; effectType: string }[];
    abilities: { featId: number; name: string }[];
    consumables: { slotIndex: number; baseId: string; name: string; usable: boolean }[];
  } {
    const hero = this.heroState(heroId);
    const spellChoices = castableSpells(hero).map((id) => {
      const row = spellsById.get(id);
      return {
        spellId: id,
        name: (row?.name as string) ?? `Spell ${id}`,
        spellLevel: (row?.spell_level as number | null) ?? 0,
        effectType: (row?.effect_type as string | null) ?? '',
      };
    });
    const abilityChoices = activeFeats(hero.feats).map((featId) => ({
      featId,
      name: this.featName(featId),
    }));
    /**
     * ⚠ Quick-slots report UNUSABLE entries too, unlike spells and abilities.
     * A slot the player filled with a `buff` potion must still show — it is
     * THEIR item sitting in THEIR pouch, and hiding it would read as the game
     * having eaten it. The `usable` flag lets the editor grey the row instead.
     */
    const consumables = normalizeQuickSlots(this.kitFor(heroId).quickSlots)
      .map((inst, slotIndex) => {
        if (!inst) return null;
        return {
          slotIndex,
          baseId: inst.baseId,
          name: (itemBasesById.get(inst.baseId)?.name as string) ?? inst.baseId,
          usable: isConsumableUsable(inst.baseId),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
    return { spells: spellChoices, abilities: abilityChoices, consumables };
  }

  /**
   * Skill points for a prospective level-up, boost-aware (the fixed INT-boost
   * ordering). Takes the FULL pending boost selection — with four boosts per
   * milestone, projecting only the first would under-report whenever INT was
   * picked second, third or fourth.
   */
  skillPointsFor(heroId: string, classId: number, boost?: AbilityKey | readonly AbilityKey[]): number {
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
    /**
     * ⚠ A SITE EXPEDITION SITS WHERE THE SITE SITS. Placing it with `placePoi`
     * would put the mission somewhere other than the thing it is taking, so
     * the map would show two unrelated pins for one objective.
     */
    const link = siteForQuestId(row.id);
    if (link) {
      const site = this.resourceSites().find((st) => st.regionId === link.regionId && st.kind === link.kind);
      if (site) return site.pos;
    }
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
    const result = awardXp(this.heroes, 'quest', questId, contentXpResolver, { split: false });
    if ('error' in result || result.perHeroShare <= 0) return;
    for (const h of this.heroes) {
      if (h.status === 'dead') continue;
      this.world.emit(minute, 'hero.xp_awarded', { heroId: h.id, amount: result.perHeroShare, source: 'quest' }, cause);
    }
  }

  private awardMonsterXp(minute: number, enemyIds: readonly number[]): void {
    const totals = new Map<string, number>();
    for (const enemyId of enemyIds) {
      const result = awardXp(this.heroes, 'monster', enemyId, contentXpResolver, { split: false });
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
