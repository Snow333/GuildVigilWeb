import { afterEach, describe, expect, it } from 'vitest';
import { SCHEDULER } from '@content/world';
import { XP_PER_LEVEL } from '@sim/heroes/xp';
import { MID_QUEST_IDS, MID_QUESTS, midReward } from '@content/midQuests';
import { quests as generatedQuests } from '@content/generated';
import { autoLevelHero } from '@sim/campaign/campaign';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '@sim/campaign/starterParty';
import { enemiesById, questsById, storylineByQuestId } from '@sim/registry';
import { freshPartyAtLevel } from './partyAtLevel';

/**
 * Track Q2 (M2): a guild at level 6–14 always sees a full, varied board.
 *
 * Steven's playtest: "from about week 17 the board shows only 1–3 jobs".
 * The generated table has one repeatable quest past level 7, and the weekly
 * draw only offers quests inside [partyLevel − 1, partyLevel + 2]. These tests
 * run REAL campaigns — advanceWeek, board(), acceptQuest, launchDispatch,
 * auto level-up — and read the board the player would see each week. They
 * never assert on the table they just wrote: the content tests only check the
 * rows are well-formed; whether the content REACHES the board is proven by
 * the simulation, and the control below proves the simulation can tell.
 */

const MIN_ROWS = SCHEDULER.postingsPerWeek.min;
const takeableCount = (s: CampaignSession): number => {
  const pl = s.partyLevel();
  return s.board().filter((b) => !b.commission && b.challenge <= pl + SCHEDULER.takeableAbove).length;
};

/** The autopilot's choice, by hand, so the board can be read BEFORE the pick. */
function playPick(s: CampaignSession): void {
  const pl = s.partyLevel();
  const pick = s.board()
    .filter((b) => b.challenge <= pl + SCHEDULER.takeableAbove)
    .sort((a, b) => a.challenge - b.challenge || a.questId - b.questId)[0];
  if (!pick) return;
  s.acceptQuest(pick.questId);
  s.launchDispatch();
}

interface WeekRead { week: number; level: number; rows: number; takeable: number; names: string[]; types: Set<string> }

/** A real career from level 1: read the board each week, play the easiest takeable job, level up. */
function career(id: string, weeks: number): WeekRead[] {
  const s = CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });
  const reads: WeekRead[] = [];
  for (let w = 1; w <= weeks; w++) {
    s.advanceWeek();
    const board = s.board().filter((b) => !b.commission);
    reads.push({
      week: w, level: s.partyLevel(), rows: board.length, takeable: takeableCount(s),
      names: board.map((b) => b.name), types: new Set(board.map((b) => questsById.get(b.questId)!.quest_type)),
    });
    playPick(s);
    for (const e of s.roster()) autoLevelHero(s, e.id);
  }
  return reads;
}

/** A guild held at one level (no level-ups) for `weeks`; it plays, or it sits idle. */
function heldAt(level: number, id: string, weeks: number, plays: boolean): WeekRead[] {
  const s = CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: freshPartyAtLevel(level) });
  const reads: WeekRead[] = [];
  for (let w = 1; w <= weeks; w++) {
    s.advanceWeek();
    const board = s.board().filter((b) => !b.commission);
    reads.push({
      week: w, level: s.partyLevel(), rows: board.length, takeable: takeableCount(s),
      names: board.map((b) => b.name), types: new Set(board.map((b) => questsById.get(b.questId)!.quest_type)),
    });
    if (plays) playPick(s);
  }
  return reads;
}

describe('the mid-level quests are well-formed rows', () => {
  it('ids start at 1000, never collide, and every row is in the registry the sim reads', () => {
    const generated = new Set<number>(generatedQuests.map((q) => q.id));
    expect(new Set(MID_QUESTS.map((q) => q.id)).size).toBe(MID_QUESTS.length);
    for (const q of MID_QUESTS) {
      expect(q.id).toBeGreaterThanOrEqual(1000);
      expect(generated.has(q.id)).toBe(false);
      expect(questsById.get(q.id)).toBe(q);
      expect(storylineByQuestId.has(q.id), `${q.name} must be repeatable`).toBe(false);
    }
    expect(MID_QUEST_IDS.size).toBe(MID_QUESTS.length);
  });

  it('every enemy exists, every group is a real fight, and no dungeon is deeper than the roster allows', () => {
    for (const q of MID_QUESTS) {
      if (q.enemy_group) {
        const g = JSON.parse(q.enemy_group) as { enemy_id: number; count: number }[];
        expect(g.length, q.name).toBeGreaterThan(0);
        for (const e of g) {
          expect(enemiesById.has(e.enemy_id), `${q.name}: enemy ${e.enemy_id}`).toBe(true);
          expect(e.count).toBeGreaterThan(0);
        }
      }
      if (q.quest_type === 'combat') {
        expect(q.enemy_group, `${q.name} needs a group`).not.toBeNull();
        expect(q.dungeon_level).toBeNull();
      } else {
        expect(q.quest_type).toBe('dungeon');
        // Past 10 the dungeon builder has no enemies in band and falls back to the whole low roster.
        expect(q.dungeon_level).toBeGreaterThanOrEqual(3);
        expect(q.dungeon_level).toBeLessThanOrEqual(10);
      }
    }
  });

  it('covers every quest level from 6 to 14 with at least 3 jobs, mixes both types, and is mostly dungeons', () => {
    for (let level = 6; level <= 14; level++) {
      const here = MID_QUESTS.filter((q) => q.min_level === level);
      expect(here.length, `level ${level}`).toBeGreaterThanOrEqual(3);
      expect(here.some((q) => q.quest_type === 'combat'), `level ${level} combat`).toBe(true);
      expect(here.some((q) => q.quest_type === 'dungeon'), `level ${level} dungeon`).toBe(true);
    }
    const combat = MID_QUESTS.filter((q) => q.quest_type === 'combat').length;
    const dungeon = MID_QUESTS.length - combat;
    expect(dungeon / combat).toBeGreaterThan(1.3); // the existing mix is about 2 : 1
    expect(dungeon / combat).toBeLessThan(3);
  });

  it('names and descriptions stay short and plain (the player is dyslexic)', () => {
    const names = new Set<string>();
    for (const q of MID_QUESTS) {
      expect(q.name.length, q.name).toBeLessThanOrEqual(32);
      expect(q.description.length, q.name).toBeLessThanOrEqual(110);
      expect(q.description.endsWith('.'), q.name).toBe(true);
      for (const sentence of q.description.split('. ')) {
        expect(sentence.split(' ').length, `${q.name}: "${sentence}"`).toBeLessThanOrEqual(16);
      }
      expect(names.has(q.name), `duplicate name ${q.name}`).toBe(false);
      names.add(q.name);
    }
    for (const q of generatedQuests) expect(names.has(q.name), `clashes with generated ${q.name}`).toBe(false);
  });
});

describe('rewards continue the curve the level 5–7 quests set', () => {
  const ratio = (q: { reward_xp: number; min_level: number }): number => q.reward_xp / q.min_level;

  it('a fair mid job pays about 100 XP per quest level, like the generated level 5–7 jobs', () => {
    const reference = generatedQuests.filter((q) => q.min_level >= 5 && q.min_level <= 7 && !storylineByQuestId.has(q.id));
    expect(reference.length).toBeGreaterThan(2);
    const refMean = reference.reduce((s, q) => s + ratio(q), 0) / reference.length;
    const mid = MID_QUESTS.reduce((s, q) => s + ratio(q), 0) / MID_QUESTS.length;
    expect(mid / refMean).toBeGreaterThan(0.8);
    expect(mid / refMean).toBeLessThan(1.3);
    for (const q of MID_QUESTS) {
      expect(ratio(q), q.name).toBeGreaterThanOrEqual(75);
      expect(ratio(q), q.name).toBeLessThanOrEqual(130);
      expect(q.reward_gold / q.reward_xp, q.name).toBeGreaterThan(1.1);
      expect(q.reward_gold / q.reward_xp, q.name).toBeLessThan(1.4);
    }
  });

  it('pay rises with level, and one job is a fair slice of a level — neither worthless nor a shortcut', () => {
    const mean = (levels: number[]): number => {
      const here = MID_QUESTS.filter((q) => levels.includes(q.min_level));
      return here.reduce((s, q) => s + q.reward_xp, 0) / here.length;
    };
    const pairs = [[6, 7], [8, 9], [10, 11], [12, 13], [14, 15]];
    for (let i = 1; i < pairs.length; i++) expect(mean(pairs[i]!), `levels ${pairs[i]}`).toBeGreaterThan(mean(pairs[i - 1]!));
    expect(mean([14, 15])).toBeGreaterThan(mean([6, 7]) * 1.8);
    expect(midReward(14, 'fair').xp).toBeGreaterThan(midReward(6, 'fair').xp);
    // The level step is XP_PER_LEVEL × level. A job pays 7–14% of it: about 8–14 jobs a level on
    // quest XP alone, with the monsters killed on the way making up the rest (measured below).
    for (const q of MID_QUESTS) {
      const share = q.reward_xp / (XP_PER_LEVEL * q.min_level);
      expect(share, q.name).toBeGreaterThanOrEqual(0.07);
      expect(share, q.name).toBeLessThanOrEqual(0.14);
    }
  });

  it('every job can be finished: a party at its quest level completes it within 8 real launches', () => {
    for (const q of MID_QUESTS) {
      let won = false;
      for (let i = 0; i < 8 && !won; i++) {
        const s = CampaignSession.create({ campaignId: `can_${q.id}_${i}`, seed: `w${i}`, party: freshPartyAtLevel(q.min_level) });
        s.advanceWeek();
        const state = s.serialize();
        state.open = [{ questId: q.id, postedWeek: 1 }];
        state.dispatchN = i * 13; // each launch is its own dispatch, as in a real campaign
        const live = CampaignSession.deserialize(state);
        live.acceptQuest(q.id);
        won = live.launchDispatch().outcome === 'completed';
      }
      expect(won, `${q.id} ${q.name} (level ${q.min_level})`).toBe(true);
    }
  }, 120_000);
});

describe('the board stays full: real campaigns, party level 6–14', () => {
  it('a career from level 1 never drops below 4 takeable jobs while the party is level 5–14', () => {
    const seen = new Set<number>();
    const weeksPerLevel = new Map<number, number>();
    for (const id of ['mb1', 'mb2', 'mb3']) {
      for (const r of career(id, 90)) {
        weeksPerLevel.set(r.level, (weeksPerLevel.get(r.level) ?? 0) + 1);
        if (r.level < 5 || r.level > 14) continue;
        seen.add(r.level);
        expect(r.rows, `${id} week ${r.week} level ${r.level}: rows`).toBeGreaterThanOrEqual(MIN_ROWS);
        expect(r.takeable, `${id} week ${r.week} level ${r.level}: takeable rows`).toBeGreaterThanOrEqual(MIN_ROWS);
        expect(r.rows, `${id} week ${r.week}`).toBeLessThanOrEqual(SCHEDULER.maxOpenQuests);
      }
    }
    // The run really passed through the whole mid-level range.
    for (let level = 6; level <= 14; level++) expect(seen.has(level), `reached level ${level}`).toBe(true);
  }, 120_000);

  it('the level curve holds: no mid level flies past in under 2 weeks or drags past 9, on autopilot', () => {
    const perLevel = new Map<number, number[]>();
    for (const id of ['pace1', 'pace2']) {
      const counts = new Map<number, number>();
      for (const r of career(id, 90)) counts.set(r.level, (counts.get(r.level) ?? 0) + 1);
      for (const [level, n] of counts) perLevel.set(level, [...(perLevel.get(level) ?? []), n]);
    }
    for (let level = 7; level <= 13; level++) {
      const ns = perLevel.get(level) ?? [];
      expect(ns.length, `level ${level} reached`).toBeGreaterThan(0);
      const mean = ns.reduce((a, b) => a + b, 0) / ns.length;
      expect(mean, `weeks at level ${level}`).toBeGreaterThanOrEqual(2);
      expect(mean, `weeks at level ${level}`).toBeLessThanOrEqual(9);
    }
  }, 120_000);

  it('a guild HELD at each level 6–14 (playing, or sitting idle) keeps 4+ takeable jobs every week for 40 weeks', () => {
    for (let level = 6; level <= 14; level++) {
      for (const plays of [true, false]) {
        const reads = heldAt(level, `held_${level}_${plays ? 'p' : 'i'}`, 40, plays);
        for (const r of reads) {
          expect(r.level).toBe(level);
          expect(r.rows, `level ${level} ${plays ? 'playing' : 'idle'} week ${r.week}: rows`).toBeGreaterThanOrEqual(MIN_ROWS);
          expect(r.takeable, `level ${level} ${plays ? 'playing' : 'idle'} week ${r.week}: takeable`).toBeGreaterThanOrEqual(MIN_ROWS);
        }
      }
    }
  }, 240_000);

  it('the board is varied: both fight types appear, many different jobs, and the board changes week to week', () => {
    for (const level of [6, 8, 10, 12, 14]) {
      const reads = heldAt(level, `var_${level}`, 40, true);
      const distinct = new Set(reads.flatMap((r) => r.names));
      expect(distinct.size, `level ${level} distinct jobs in 40 weeks`).toBeGreaterThanOrEqual(10);
      const bothTypes = reads.filter((r) => r.types.size === 2).length;
      expect(bothTypes / reads.length, `level ${level} weeks showing a fight AND a dungeon`).toBeGreaterThanOrEqual(0.9);
      let same = 0;
      for (let i = 1; i < reads.length; i++) {
        if (reads[i]!.names.join('|') === reads[i - 1]!.names.join('|')) same++;
      }
      expect(same, `level ${level} weeks identical to the one before`).toBe(0);
    }
  }, 120_000);
});

describe('CONTROL: without the mid-level quests the same campaigns starve (so the tests above can fail)', () => {
  const saved = new Map(MID_QUESTS.map((q) => [q.id, q]));
  afterEach(() => {
    for (const [id, q] of saved) questsById.set(id, q);
  });

  it('with ids 1000+ removed from the registry, levels 8–14 show a thin board in most weeks', () => {
    for (const id of saved.keys()) questsById.delete(id);
    let thin = 0, total = 0;
    for (const level of [8, 10, 12, 14]) {
      for (const r of heldAt(level, `ctl_${level}`, 30, true)) {
        total++;
        if (r.takeable < MIN_ROWS) thin++;
      }
    }
    expect(thin / total, 'share of weeks with fewer than 4 takeable jobs').toBeGreaterThan(0.9);
  }, 120_000);

  it('and the registry is whole again afterwards', () => {
    for (const id of saved.keys()) expect(questsById.has(id)).toBe(true);
  });
});
