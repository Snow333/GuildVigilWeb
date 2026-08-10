/**
 * Campaign loop v1 — the Phase 1 finale: weeks tick, quests post and expire,
 * the party travels (A* over the generated world), fights through ambushes and
 * dungeons, and every consequence lands somewhere — gold, items, XP, level-ups,
 * and the escalation ledger.
 *
 * v1 policies (deliberate, harness-facing; the UI phase makes them player-driven):
 *  - one dispatch per week, lowest-id open quest in band
 *  - full heal + wound treatment at the guild between weeks
 *  - auto level-up advances the PRIMARY class; boosts go to its key ability;
 *    skill points round-robin the party's priority list; optional feats skipped
 *  - wipes lose the haul; retreats keep it (the party walked out carrying it)
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
import { isBoostLevel, applyLevelUp, skillPointsForLevel } from '@sim/heroes/levelUp';
import { characterLevel, type AbilityKey, type HeroState } from '@sim/heroes/types';
import { awardXp, canLevelUp } from '@sim/heroes/xp';
import { classesById, contentXpResolver, progressionFor, questsById } from '@sim/registry';
import { quests as questRows } from '@content/generated';
import { generateWorld, type WorldMap } from '@sim/world/terrain';
import { planTravel } from '@sim/world/travel';
import { EscalationLedger } from '@sim/world/escalation';
import { assembleParty, type HeroKit } from './assembly';

export interface CampaignOptions {
  campaignId: string;
  seed: string;
  weeks: number;
  party: HeroKit[];
  profile?: MissionProfile;
  caution?: Caution;
  /** Skill-point priorities for auto level-up (defaults to the dungeon trio). */
  skillPriorities?: string[];
}

export interface QuestRecord {
  week: number;
  questId: number;
  outcome: 'completed' | 'failed' | 'wiped' | 'ambushKilled';
  dispatch?: DungeonDispatchResult;
}

export interface CampaignResult {
  world: EventStream;
  map: WorldMap;
  ledger: EscalationLedger;
  records: QuestRecord[];
  gold: number;
  items: ItemInstance[];
  levelUps: number;
  finalLevels: number[];
}

interface OpenQuest {
  questId: number;
  postedWeek: number;
  regionId: string;
  pos: { x: number; y: number };
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

/** Auto level-up: primary class, key-ability boosts, priority-list skills, no optional feats. */
function autoLevelUp(hero: HeroState, priorities: readonly string[]): { newLevel: number; classId: number } | null {
  const primary = hero.classLevels[0];
  if (!primary) return null;
  const prog = progressionFor(primary.classId, primary.level + 1);
  if (!prog) return null; // class cap
  const newCharLevel = characterLevel(hero) + 1;
  const classRow = classesById.get(primary.classId);
  const boost = isBoostLevel(newCharLevel) ? ((classRow?.key_ability ?? 'str') as AbilityKey) : undefined;
  const points = skillPointsForLevel(primary.classId, hero, boost);
  const skillRanks: Record<string, number> = {};
  for (let i = 0; i < points; i++) {
    const skill = priorities[i % priorities.length]!;
    skillRanks[skill] = (skillRanks[skill] ?? 0) + 1;
  }
  const applied = applyLevelUp(hero, {
    classId: primary.classId,
    hpPerLevel: prog.hp_per_level as number,
    ...(boost ? { boost } : {}),
    skillRanks,
    feats: [],
    autoGrantedFeatIds: [],
  });
  return { newLevel: applied.newCharacterLevel, classId: applied.classId };
}

export function runCampaign(opts: CampaignOptions): CampaignResult {
  const rng = new Rng(Seeds.campaign(opts.campaignId));
  const map = generateWorld(new Rng(opts.seed).int(1, 2 ** 30));
  const world = new EventStream('world', opts.campaignId);
  const ledger = new EscalationLedger();
  const records: QuestRecord[] = [];
  const heroes = opts.party.map((k) => k.hero);
  const priorities = opts.skillPriorities ?? ['perception', 'athletics', 'thievery'];
  const profile = opts.profile ?? 'fullExplore';
  const caution = opts.caution ?? 'standard';

  let gold = 0;
  const items: ItemInstance[] = [];
  let levelUps = 0;
  const open: OpenQuest[] = [];
  /** questId → week completed; the board reposts it after a cooldown (the world restocks trouble). */
  const completed = new Map<number, number>();
  const poiCache = new Map<number, { x: number; y: number }>();
  let dispatchN = 0;

  const poiPos = (poiId: number, minLevel: number): { x: number; y: number } => {
    const cached = poiCache.get(poiId);
    if (cached) return cached;
    const pos = placePoi(map, poiId, minLevel);
    poiCache.set(poiId, pos);
    return pos;
  };

  const partyLevel = (): number =>
    Math.max(Math.round(heroes.reduce((s, h) => s + characterLevel(h), 0) / heroes.length), 1);

  /** Escalation fact + tier-change event, one seam for every consequence. */
  const recordFact = (minute: number, week: number, regionId: string, kind: string, refId: string): void => {
    const before = ledger.pressureFor(regionId).tier;
    ledger.append({ week, regionId, kind, refId });
    const after = ledger.pressureFor(regionId).tier;
    if (after !== before) {
      world.emit(minute, 'world.escalation_changed', { regionId, oldTier: before, newTier: after });
    }
  };

  const awardQuestXp = (minute: number, questId: number, cause: number): void => {
    const result = awardXp(heroes, 'quest', questId, contentXpResolver);
    if ('error' in result || result.perHeroShare <= 0) return;
    for (const h of heroes) {
      if (h.status === 'dead') continue;
      world.emit(minute, 'hero.xp_awarded', { heroId: h.id, amount: result.perHeroShare, source: 'quest' }, cause);
    }
  };

  const awardMonsterXp = (minute: number, enemyIds: readonly number[]): void => {
    const totals = new Map<string, number>();
    for (const enemyId of enemyIds) {
      const result = awardXp(heroes, 'monster', enemyId, contentXpResolver);
      if ('error' in result || result.perHeroShare <= 0) continue;
      for (const h of heroes) {
        if (h.status !== 'dead') totals.set(h.id, (totals.get(h.id) ?? 0) + result.perHeroShare);
      }
    }
    for (const [heroId, amount] of totals) {
      world.emit(minute, 'hero.xp_awarded', { heroId, amount, source: 'combat' });
    }
  };

  const applyLevelUps = (minute: number): void => {
    for (const h of heroes) {
      while (canLevelUp(h)) {
        const up = autoLevelUp(h, priorities);
        if (!up) break;
        levelUps++;
        world.emit(minute, 'hero.level_up_applied', {
          heroId: h.id, newLevel: up.newLevel, classId: String(up.classId),
        });
      }
    }
  };

  for (let week = 1; week <= opts.weeks; week++) {
    let minute = (week - 1) * CLOCK.minutesPerWeek;
    world.emit(minute, 'world.week_tick', { week });

    // ── Expiry sweep ──
    for (let i = open.length - 1; i >= 0; i--) {
      const q = open[i]!;
      if (week - q.postedWeek >= SCHEDULER.expiryWeeks) {
        open.splice(i, 1);
        world.emit(minute, 'world.quest_expired', { questId: String(q.questId), regionId: q.regionId });
        recordFact(minute, week, q.regionId, 'quest_expired', String(q.questId));
      }
    }

    // ── Posting: authored pool, level band, region drift widens the top ──
    const pl = partyLevel();
    for (const row of questRows) {
      if (open.length >= SCHEDULER.maxOpenQuests) break;
      const doneWeek = completed.get(row.id);
      if (doneWeek !== undefined && week - doneWeek < SCHEDULER.expiryWeeks) continue;
      if (open.some((o) => o.questId === row.id)) continue;
      const pos = poiPos(row.poi_id as number, row.min_level as number);
      const regionId = regionFor(pos);
      const drift = ledger.effectsFor(regionId).questLevelDrift;
      if ((row.min_level as number) < pl - SCHEDULER.levelBandBelow) continue;
      if ((row.min_level as number) > pl + SCHEDULER.levelBandAbove + drift) continue;
      open.push({ questId: row.id, postedWeek: week, regionId, pos });
      world.emit(minute, 'world.quest_posted', {
        questId: String(row.id), regionId, kind: 'story', expiresWeek: week + SCHEDULER.expiryWeeks,
      });
    }

    // ── Accept the EASIEST survivable open quest. The guild declines jobs whose
    // real challenge (dungeon level) outruns it — declined postings sit on the
    // board and EXPIRE, and expiry feeds escalation. Falling behind has teeth. ──
    const challengeOf = (questId: number): number => {
      const row = questsById.get(questId)!;
      return Math.max((row.dungeon_level as number | null) ?? (row.min_level as number), 1);
    };
    const takeable = open.filter((o) => challengeOf(o.questId) <= pl + 1);
    if (takeable.length === 0) continue; // idle week — nothing the guild would survive

    const q = takeable.reduce((a, b) => {
      const la = challengeOf(a.questId);
      const lb = challengeOf(b.questId);
      return lb < la || (lb === la && b.questId < a.questId) ? b : a;
    });
    const quest = questsById.get(q.questId)!;
    open.splice(open.indexOf(q), 1);
    const acceptEv = world.emit(minute, 'world.quest_accepted', {
      questId: String(q.questId), partyId: Ids.party(1),
    });
    for (const h of heroes) h.wounded = 0;
    const party = assembleParty(opts.party);
    dispatchN++;
    const dispatchId = Ids.dispatch(dispatchN);

    // ── Travel out ──
    const plan = planTravel(map, WORLD.haven, q.pos);
    if (plan) {
      world.emit(minute, 'dispatch.travel_leg_started', {
        fromX: WORLD.haven.x, fromY: WORLD.haven.y, toX: q.pos.x, toY: q.pos.y, etaMinutes: plan.etaMinutes,
      }, acceptEv.seq);
      minute += plan.etaMinutes;
    }

    // Ambush: base chance × the region's escalation multiplier.
    const effects = ledger.effectsFor(q.regionId);
    if (rng.chance(ESCALATION.baseAmbushChance * effects.ambushMult)) {
      const encounterId = `${dispatchId}:ambush`;
      world.emit(minute, 'dispatch.travel_ambushed', { regionId: q.regionId, encounterId });
      const difficulty = Math.max((quest.dungeon_level as number | null) ?? (quest.min_level as number), 1);
      const eid = ambushEnemyId(difficulty);
      // Roster scales with the ambusher's own level: many goblins or few orcs.
      const count = eid === 11 ? Math.min(1 + Math.floor(difficulty / 2), 3) : Math.min(2 + Math.ceil(difficulty / 2), 5);
      const ambushers = Array.from({ length: count }, (_, i) => buildEnemy(eid, `${encounterId}:e${i}`));
      const fight = runEncounter(encounterId, 'road', party.map((h) => h.c), ambushers, Seeds.ambush(opts.campaignId, week));
      minute += Math.ceil(fight.ticks / 600);
      awardMonsterXp(minute, killsFrom(fight.stream, ambushers.map((a) => a.id), ambushers.map(() => eid)));
      // Post-fight aid on the roadside, win or lose (wounded still ratchets).
      for (const h of party) if (hasCondition(h.c, 'dying')) healDying(h.c, 1);
      if (fight.result !== 'victory') {
        // The road won: quest failed before the dungeon; survivors limp home.
        world.emit(minute, 'world.quest_failed', { questId: String(q.questId), regionId: q.regionId });
        recordFact(minute, week, q.regionId, 'quest_failed', String(q.questId));
        records.push({ week, questId: q.questId, outcome: 'ambushKilled' });
        applyLevelUps(minute);
        continue;
      }
    }
    world.emit(minute, 'dispatch.travel_arrived', { poiId: `poi_${quest.poi_id}` });

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
      awardMonsterXp(minute, killsFrom(fight.stream, enemies.map((e) => e.id), roster));
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
        profile,
        caution,
        difficulty: dungeonLevel,
        partyLevel: pl,
        questId: String(q.questId),
        regionId: q.regionId,
        autoDetectTraps: partyDungeonBonus(
          opts.party.map((k) => ({ hero: k.hero, feats: k.hero.feats })),
          'auto_detect_traps_adjacent',
        ).found,
      });
      minute += Math.ceil(dispatch.ticks / 600);
      awardMonsterXp(minute, dispatch.killedEnemyIds);
      outcome = dispatch.outcome === 'completed' ? 'completed' : dispatch.outcome === 'wiped' ? 'wiped' : 'failed';
    }

    // ── Travel home + consequences ──
    if (plan) minute += plan.etaMinutes;

    if (outcome === 'completed') {
      const haul = dispatch ? dispatch.gold : 0;
      gold += (quest.reward_gold as number) + haul;
      if (dispatch) items.push(...dispatch.items);
      const doneEv = world.emit(minute, 'world.quest_completed', {
        questId: String(q.questId), regionId: q.regionId,
        xp: quest.reward_xp as number, gold: quest.reward_gold as number, rep: quest.reward_reputation as number,
      });
      completed.set(q.questId, week);
      recordFact(minute, week, q.regionId, 'quest_completed', String(q.questId));
      awardQuestXp(minute, q.questId, doneEv.seq);
    } else {
      world.emit(minute, 'world.quest_failed', { questId: String(q.questId), regionId: q.regionId });
      if (outcome === 'wiped') {
        recordFact(minute, week, q.regionId, 'dispatch_wiped', dispatchId);
        // The haul stays in the dungeon; the guild drags its people home.
      } else {
        recordFact(minute, week, q.regionId, 'quest_failed', String(q.questId));
        if (dispatch) {
          gold += dispatch.gold; // retreats walk out with what they carried
          items.push(...dispatch.items);
        }
      }
    }

    applyLevelUps(minute);
    records.push({ week, questId: q.questId, outcome, ...(dispatch ? { dispatch } : {}) });
  }

  return {
    world,
    map,
    ledger,
    records,
    gold,
    items,
    levelUps,
    finalLevels: heroes.map((h) => characterLevel(h)),
  };
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
