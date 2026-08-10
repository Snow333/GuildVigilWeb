/**
 * runCampaign — Phase 2 refactor: the campaign loop is now an AUTOPILOT driving
 * a CampaignSession with the v1 policies. One resolution path serves live play,
 * the career harness, and forecasting (constraint 3); the career-harness exact
 * snapshot is this refactor's proof — same numbers, or the extraction changed
 * behavior and must justify itself.
 *
 * v1 policies (deliberate, harness-facing; live play makes them player-driven):
 *  - one dispatch per week, easiest survivable open quest (lowest challenge,
 *    then lowest id); nothing takeable → idle week
 *  - full heal + wound treatment at the guild between weeks
 *  - auto level-up advances the PRIMARY class; boosts go to its key ability;
 *    skill points round-robin the party's priority list; optional feats skipped
 *  - wipes lose the haul; retreats keep it (the party walked out carrying it)
 */

import { EventStream } from '@sim/core/events/stream';
import type { ItemInstance } from '@sim/core/events/types';
import type { Caution, MissionProfile } from '@sim/dungeon/dispatch';
import { isBoostLevel, maxSkillRanks, skillPointsForLevel } from '@sim/heroes/levelUp';
import { characterLevel, type AbilityKey, type HeroState } from '@sim/heroes/types';
import { canLevelUp } from '@sim/heroes/xp';
import { classesById, progressionFor, skillNames } from '@sim/registry';
import type { WorldMap } from '@sim/world/terrain';
import type { EscalationLedger } from '@sim/world/escalation';
import type { HeroKit } from './assembly';
import { CampaignSession, type QuestRecord, type SessionLevelUpPlan } from './session';

export type { QuestRecord } from './session';

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

/**
 * Auto level-up policy: primary class, key-ability boosts, priority-list skills,
 * no optional feats. Returns the plan for the session to apply, or null at cap.
 */
export function buildAutoLevelUpPlan(
  hero: HeroState,
  priorities: readonly string[],
): SessionLevelUpPlan | null {
  const primary = hero.classLevels[0];
  if (!primary) return null;
  const prog = progressionFor(primary.classId, primary.level + 1);
  if (!prog) return null; // class cap
  const newCharLevel = characterLevel(hero) + 1;
  const classRow = classesById.get(primary.classId);
  const boost = isBoostLevel(newCharLevel) ? ((classRow?.key_ability ?? 'str') as AbilityKey) : undefined;
  const points = skillPointsForLevel(primary.classId, hero, boost);

  // Round-robin the priority list, RESPECTING the rank cap (= new character
  // level); capped skills spill to the rest of the registry in order. If every
  // skill is capped (16 × level ≥ points long before that), points are forfeit.
  const cap = maxSkillRanks(newCharLevel);
  const order = [...priorities, ...skillNames.filter((n) => !priorities.includes(n))];
  const skillRanks: Record<string, number> = {};
  const rankAfter = (skill: string): number => (hero.skills[skill] ?? 0) + (skillRanks[skill] ?? 0);
  let cursor = 0;
  for (let spent = 0; spent < points; ) {
    let placed = false;
    for (let probe = 0; probe < order.length; probe++) {
      const skill = order[(cursor + probe) % order.length]!;
      if (rankAfter(skill) < cap) {
        skillRanks[skill] = (skillRanks[skill] ?? 0) + 1;
        cursor = (cursor + probe + 1) % order.length;
        placed = true;
        break;
      }
    }
    if (!placed) break; // everything capped — forfeit the remainder
    spent++;
  }
  return {
    classId: primary.classId,
    ...(boost ? { boost } : {}),
    skillRanks,
    feats: [],
    autoGrantedFeatIds: [],
  };
}

/**
 * One autopilot week: advance, accept the EASIEST survivable open quest, launch,
 * auto-spend level-ups. The guild declines jobs whose real challenge (dungeon
 * level) outruns it — declined postings sit on the board and EXPIRE, and expiry
 * feeds escalation. Falling behind has teeth. Returns the launch record, or
 * null for an idle week; levelUps counts the plans applied.
 */
export function autopilotWeek(
  session: CampaignSession,
  priorities: readonly string[],
): { record: QuestRecord | null; levelUps: number } {
  session.advanceWeek();
  const pl = session.partyLevel();
  const takeable = session.board().filter((b) => b.challenge <= pl + 1);
  if (takeable.length === 0) return { record: null, levelUps: 0 }; // idle week — nothing the guild would survive

  const pick = takeable.reduce((a, b) =>
    b.challenge < a.challenge || (b.challenge === a.challenge && b.questId < a.questId) ? b : a,
  );
  session.acceptQuest(pick.questId);
  const record = session.launchDispatch();

  let levelUps = 0;
  for (const entry of session.roster()) {
    const hero = session.heroState(entry.id);
    while (canLevelUp(hero)) {
      const plan = buildAutoLevelUpPlan(hero, priorities);
      if (!plan) break;
      session.applyLevelUp(hero.id, plan);
      levelUps++;
    }
  }
  return { record, levelUps };
}

export function runCampaign(opts: CampaignOptions): CampaignResult {
  const session = CampaignSession.create({
    campaignId: opts.campaignId,
    seed: opts.seed,
    party: opts.party,
  });
  session.configureDispatch({
    profile: opts.profile ?? 'fullExplore',
    caution: opts.caution ?? 'standard',
  });
  const priorities = opts.skillPriorities ?? ['perception', 'athletics', 'thievery'];

  const records: QuestRecord[] = [];
  let levelUps = 0;
  for (let week = 1; week <= opts.weeks; week++) {
    const outcome = autopilotWeek(session, priorities);
    if (outcome.record) records.push(outcome.record);
    levelUps += outcome.levelUps;
  }

  return {
    world: session.world,
    map: session.map,
    ledger: session.ledger,
    records,
    gold: session.goldAmount(),
    items: [...session.stashItems()],
    levelUps,
    finalLevels: opts.party.map((k) => characterLevel(k.hero)),
  };
}
