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
import { Ids, Seeds } from '@sim/core/ids';
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
import { partyDungeonBonus } from '@sim/heroes/featEffects';
import { applyLevelUp, type LevelUpApplied, type LevelUpPlan } from '@sim/heroes/levelUp';
import { characterLevel, type HeroState } from '@sim/heroes/types';
import { awardXp, xpForNextLevel, type XpProgress } from '@sim/heroes/xp';
import { contentXpResolver, progressionFor, questsById } from '@sim/registry';
import { quests as questRows } from '@content/generated';
import { generateWorld, type WorldMap } from '@sim/world/terrain';
import { planTravel, type TravelPlan } from '@sim/world/travel';
import { EscalationLedger, type EscalationFact } from '@sim/world/escalation';
import { assembleParty, type HeroKit } from './assembly';

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

export interface QuestRecord {
  week: number;
  questId: number;
  outcome: 'completed' | 'failed' | 'wiped' | 'ambushKilled';
  dispatch?: DungeonDispatchResult;
}

export interface BoardEntry {
  questId: number;
  name: string;
  minLevel: number;
  /** Real difficulty (dungeon level where set) — what the accept decision weighs. */
  challenge: number;
  regionId: string;
  postedWeek: number;
  expiresWeek: number;
  rewardGold: number;
  rewardXp: number;
  pressureTier: number;
}

export interface RosterEntry {
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
  active: { questId: number; postedWeek: number; acceptSeq: number } | null;
  escalation: { facts: EscalationFact[]; lastTier: [string, number][] };
}

/** Coarse region partition v1: Haven's home turf, then compass quadrants. */
function regionFor(pos: { x: number; y: number }): string {
  const dx = pos.x - WORLD.haven.x;
  const dy = pos.y - WORLD.haven.y;
  if (Math.hypot(dx, dy) <= 12) return 'region_haven';
  return `region_${dy < 0 ? 'n' : 's'}${dx < 0 ? 'w' : 'e'}`;
}

/** Deterministic, reachable POI placement: farther out for higher-level quests. */
function placePoi(map: WorldMap, poiId: number, minLevel: number): { x: number; y: number } {
  const rng = new Rng(Seeds.poi(map.seed, poiId));
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
  private readonly poiCache = new Map<number, { x: number; y: number }>();

  private week = 0;
  private minute = 0;
  private gold = 0;
  private stash: ItemInstance[] = [];
  private open: OpenQuest[] = [];
  /** questId → week completed; the board reposts it after a cooldown (the world restocks trouble). */
  private completed = new Map<number, number>();
  private active: ActiveQuest | null = null;
  private dispatchN = 0;
  private profile: MissionProfile = 'fullExplore';
  private caution: Caution = 'standard';

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
        this.world.emit(this.minute, 'world.quest_expired', { questId: String(q.questId), regionId: q.regionId });
        this.recordFact(week, q.regionId, 'quest_expired', String(q.questId));
      }
    }

    // ── Posting: authored pool, level band, region drift widens the top ──
    const pl = this.partyLevel();
    for (const row of questRows) {
      if (this.open.length >= SCHEDULER.maxOpenQuests) break;
      const doneWeek = this.completed.get(row.id);
      if (doneWeek !== undefined && week - doneWeek < SCHEDULER.expiryWeeks) continue;
      if (this.open.some((o) => o.questId === row.id)) continue;
      if (this.active?.questId === row.id) continue; // live play: an accepted quest is off the board
      const pos = this.poiPos(row.poi_id as number, row.min_level as number);
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
        return { week, questId: q.questId, outcome: 'ambushKilled' };
      }
    }
    this.world.emit(minute, 'dispatch.travel_arrived', { poiId: `poi_${quest.poi_id}` });

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
      this.awardMonsterXp(minute, killsFrom(fight.stream, enemies.map((e) => e.id), roster));
      minute += Math.ceil(fight.ticks / 600); // 100ms ticks → game-minutes
      if (fight.result === 'victory') outcome = 'completed';
      else outcome = party.every((h) => h.c.hp <= 0 || h.c.conditions.has('dying') || h.c.conditions.has('unconscious')) ? 'wiped' : 'failed';
    } else {
      const dungeonLevel = Math.max((quest.dungeon_level as number | null) ?? (quest.min_level as number), 1);
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
    return { week, questId: q.questId, outcome, ...(dispatch ? { dispatch } : {}) };
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

  partyLevel(): number {
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
    }));
  }

  /** Direct hero state access for the level-up policy / 2.1 hero panel plumbing. */
  heroState(heroId: string): HeroState {
    const hero = this.heroes.find((h) => h.id === heroId);
    if (!hero) throw new Error(`heroState: unknown hero ${heroId}`);
    return hero;
  }

  board(): BoardEntry[] {
    return this.open.map((o) => {
      const row = questsById.get(o.questId)!;
      return {
        questId: o.questId,
        name: row.name as string,
        minLevel: row.min_level as number,
        challenge: Math.max((row.dungeon_level as number | null) ?? (row.min_level as number), 1),
        regionId: o.regionId,
        postedWeek: o.postedWeek,
        expiresWeek: o.postedWeek + SCHEDULER.expiryWeeks,
        rewardGold: row.reward_gold as number,
        rewardXp: row.reward_xp as number,
        pressureTier: this.ledger.pressureFor(o.regionId).tier,
      };
    });
  }

  activeQuest(): { questId: number; regionId: string } | null {
    return this.active ? { questId: this.active.questId, regionId: this.active.regionId } : null;
  }

  pressure(regionId: string): ReturnType<EscalationLedger['pressureFor']> {
    return this.ledger.pressureFor(regionId);
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
      active: this.active
        ? { questId: this.active.questId, postedWeek: this.active.postedWeek, acceptSeq: this.active.acceptSeq }
        : null,
      escalation: this.ledger.serialize(),
    });
  }

  /**
   * Rebuild from facts: terrain, POI positions, and regions recompute; the world
   * event stream starts FRESH (events are presentation-facing history, not state
   * — the escalation ledger is the one sanctioned history, and it is restored).
   */
  static deserialize(state: SessionSaveState): CampaignSession {
    if (state.v !== 1) throw new Error(`CampaignSession.deserialize: unknown save version ${String(state.v)}`);
    const data = jsonClone(state);
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
    session.active = data.active
      ? { ...session.rehydrateQuest(data.active.questId, data.active.postedWeek), acceptSeq: data.active.acceptSeq }
      : null;
    return session;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private rehydrateQuest(questId: number, postedWeek: number): OpenQuest {
    const row = questsById.get(questId);
    if (!row) throw new Error(`deserialize: unknown quest ${questId} in save`);
    const pos = this.poiPos(row.poi_id as number, row.min_level as number);
    return { questId, postedWeek, regionId: regionFor(pos), pos };
  }

  private poiPos(poiId: number, minLevel: number): { x: number; y: number } {
    const cached = this.poiCache.get(poiId);
    if (cached) return cached;
    const pos = placePoi(this.map, poiId, minLevel);
    this.poiCache.set(poiId, pos);
    return pos;
  }

  /** Escalation fact + tier-change event, one seam for every consequence. */
  private recordFact(week: number, regionId: string, kind: string, refId: string, minute = this.minute): void {
    const before = this.ledger.pressureFor(regionId).tier;
    this.ledger.append({ week, regionId, kind, refId });
    const after = this.ledger.pressureFor(regionId).tier;
    if (after !== before) {
      this.world.emit(minute, 'world.escalation_changed', { regionId, oldTier: before, newTier: after });
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
