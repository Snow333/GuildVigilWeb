import { describe, expect, it } from 'vitest';
import { SCHEDULER } from '@content/world';
import {
  COMMISSION_QUEST_IDS, COMMISSIONS, EARLY_EASY_QUEST_IDS, EARLY_QUESTS,
} from '@content/earlyQuests';
import { quests as generatedQuests } from '@content/generated';
import { CampaignSession, type SessionSaveState } from '@sim/campaign/session';
import { questsById, storylineByQuestId } from '@sim/registry';
import { starterParty } from '../fixtures/party-fixture';

/**
 * Track Q (M2): the quest board holds up to 10, shows 4–6 regular notices a
 * week (seeded), always carries 2+ easy quests in weeks 1–4, and a Marshal
 * letter, once answered, posts a special commission.
 *
 * Every claim below is checked through the production path: advanceWeek,
 * board(), acceptQuest, launchDispatch, serialize/deserialize.
 */

const SEEDS = ['qa', 'qb', 'qc', 'qd', 'qe', 'qf', 'qg', 'qh'];

const newSession = (id: string): CampaignSession =>
  CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });

const regular = (s: CampaignSession): number => s.board().filter((b) => !b.commission).length;

describe('the board: up to 10, 4–6 a week, seeded', () => {
  it('weeks 1–4 show 4–6 regular notices for every seed, idle or playing; no week ever shows more than 6', () => {
    const seen = new Set<number>();
    for (const id of SEEDS) {
      for (const play of [false, true]) {
        const s = newSession(`${id}_${play ? 'p' : 'i'}`);
        for (let w = 1; w <= 12; w++) {
          s.advanceWeek();
          const n = regular(s);
          // Later weeks may show fewer when the level band runs out of quests
          // off cooldown (a content limit, reported) — never more than 6.
          if (w <= SCHEDULER.earlyWeeks) {
            expect(n, `${id} week ${w}`).toBeGreaterThanOrEqual(SCHEDULER.postingsPerWeek.min);
            seen.add(n);
          }
          expect(n, `${id} week ${w}`).toBeLessThanOrEqual(SCHEDULER.postingsPerWeek.max);
          if (play) playEasiest(s);
        }
      }
    }
    // Variance is the point (Steven: "for variance testing/feel").
    expect(seen.size).toBeGreaterThan(1);
  }, 60_000);

  it('never holds more than 10 regular notices across a 30-week career', () => {
    for (const id of SEEDS.slice(0, 4)) {
      const s = newSession(`cap_${id}`);
      for (let w = 0; w < 30; w++) {
        s.advanceWeek();
        expect(regular(s)).toBeLessThanOrEqual(SCHEDULER.maxOpenQuests);
        playEasiest(s);
      }
    }
  });

  it('is deterministic per seed, and different seeds give different boards', () => {
    const run = (id: string): number[][] => {
      const s = newSession(id);
      const out: number[][] = [];
      for (let w = 0; w < 8; w++) {
        s.advanceWeek();
        out.push(s.board().map((b) => b.questId));
      }
      return out;
    };
    expect(run('det_1')).toEqual(run('det_1'));
    expect(run('det_1')).not.toEqual(run('det_2'));
  });

  it('the storyline quest still posts first: week 1 always carries The Burned Granary', () => {
    for (const id of SEEDS) {
      const s = newSession(`arc_${id}`);
      s.advanceWeek();
      expect(s.board().some((b) => storylineByQuestId.has(b.questId))).toBe(true);
    }
  });
});

/** The autopilot's choice by hand: take the easiest posting the guild would survive. */
function playEasiest(s: CampaignSession): void {
  const pl = s.partyLevel();
  const pick = s.board().filter((b) => b.challenge <= pl + 1)
    .sort((a, b) => a.challenge - b.challenge || a.questId - b.questId)[0];
  if (!pick) return;
  s.acceptQuest(pick.questId);
  s.launchDispatch();
}

describe('weeks 1–4: easy quests a fresh guild can win', () => {
  it('every early week carries at least 2 easy notices, across seeds, idle or playing', () => {
    for (const id of SEEDS) {
      for (const play of [false, true]) {
        const s = newSession(`easy_${id}_${play ? 'p' : 'i'}`);
        for (let w = 1; w <= SCHEDULER.earlyWeeks; w++) {
          s.advanceWeek();
          const easy = s.board().filter((b) => EARLY_EASY_QUEST_IDS.has(b.questId));
          expect(easy.length, `${id} week ${w}`).toBeGreaterThanOrEqual(SCHEDULER.earlyEasyMin);
          for (const b of easy) expect(b.ease).toBe('easy');
          if (play) {
            s.acceptQuest(easy[0]!.questId);
            s.launchDispatch();
          }
        }
      }
    }
  });

  it('the hand-authored easy quests stop posting after week 4', () => {
    const early = new Set(EARLY_QUESTS.map((q) => q.id));
    for (const id of SEEDS.slice(0, 4)) {
      const s = newSession(`late_${id}`);
      for (let w = 1; w <= 16; w++) {
        s.advanceWeek();
        if (w <= SCHEDULER.earlyWeeks) continue;
        for (const b of s.board()) {
          // A week-4 posting may still hang on into week 5 before it expires.
          if (early.has(b.questId)) expect(b.postedWeek).toBeLessThanOrEqual(SCHEDULER.earlyWeeks);
        }
      }
    }
  });

  it('authored ids never collide with generated ids, and the registry finds them', () => {
    const generated = new Set<number>(generatedQuests.map((q) => q.id));
    for (const q of [...EARLY_QUESTS, ...COMMISSIONS.map((c) => c.quest)]) {
      expect(q.id).toBeGreaterThanOrEqual(900);
      expect(generated.has(q.id)).toBe(false);
      expect(questsById.get(q.id)).toBe(q);
    }
  });
});

/**
 * Put one quest on a fresh week-1 board through the SAVE path (the board is
 * just facts in the save), then accept and launch it for real.
 */
function launchFresh(questId: number, i: number): string {
  const s = newSession(`win_${questId}_${i}`);
  s.advanceWeek();
  const state: SessionSaveState = s.serialize();
  state.open = [{ questId, postedWeek: 1 }];
  // The camp fight is seeded from the dispatch number, not the campaign id. Without
  // this every one of the N launches below replayed the SAME fight (Track Q2 finding).
  state.dispatchN = i * 13;
  const live = CampaignSession.deserialize(state);
  live.acceptQuest(questId);
  return live.launchDispatch().outcome;
}

const N = 24;
const winRate = (questId: number): number => {
  let wins = 0;
  for (let i = 0; i < N; i++) if (launchFresh(questId, i) === 'completed') wins++;
  return wins / N;
};

describe('easy means easy: real launches with the default level-1 party', () => {
  const rates = new Map<number, number>();

  it('every early easy quest wins at least 80% of the time', () => {
    for (const id of EARLY_EASY_QUEST_IDS) rates.set(id, winRate(id));
    const report = [...rates].map(([id, r]) => `${id} ${questsById.get(id)!.name}: ${(r * 100).toFixed(0)}%`);
    console.log(`early easy win rates (n=${N}):\n  ${report.join('\n  ')}`);
    for (const [id, r] of rates) expect(r, `quest ${id}`).toBeGreaterThanOrEqual(0.8);
  }, 120_000);

  it('the letter-1 commission is also winnable for a level-1 party', () => {
    const id = COMMISSIONS.find((c) => c.dialogueId === 1)!.quest.id;
    const r = winRate(id);
    console.log(`commission ${id} win rate (n=${N}): ${(r * 100).toFixed(0)}%`);
    expect(r).toBeGreaterThanOrEqual(0.8);
  }, 30_000);

  it('CONTROL: the same harness reports a loss for a fight a level-1 party cannot win', () => {
    // Orc Raiding Party (3 orc warriors + 4 goblins) — if this reads as easy,
    // the harness is broken, not the quests.
    expect(winRate(7)).toBeLessThan(0.2);
  }, 30_000);
});

describe("the Marshal's commission", () => {
  const LETTER = 1;
  const commissionId = COMMISSIONS.find((c) => c.dialogueId === LETTER)!.quest.id;

  it('answering the letter hides it and posts a marked, longer-lived, better-paid commission', () => {
    const s = newSession('com_1');
    s.advanceWeek();
    expect(s.pendingDialogue().some((d) => d.id === LETTER)).toBe(true);
    s.answerLetter(LETTER, 0);
    expect(s.pendingDialogue().some((d) => d.id === LETTER)).toBe(false);
    const entry = s.board().find((b) => b.questId === commissionId);
    expect(entry, 'the commission is on the board').toBeDefined();
    expect(entry!.commission).toBe(true);
    expect(entry!.expiresWeek).toBe(1 + SCHEDULER.commissionExpiryWeeks);
    expect(entry!.expiresWeek).toBeGreaterThan(1 + SCHEDULER.expiryWeeks);
    // A modest bonus over the granary job it grows out of.
    expect(entry!.rewardGold).toBeGreaterThan(questsById.get(100)!.reward_gold);
    // Regular postings never wear the seal.
    expect(s.board().filter((b) => b.commission).map((b) => b.questId)).toEqual([commissionId]);
  });

  it('one commission per letter: a second answer is refused', () => {
    const s = newSession('com_2');
    s.advanceWeek();
    s.answerLetter(LETTER);
    expect(() => s.answerLetter(LETTER)).toThrow(/not waiting/);
    expect(s.board().filter((b) => b.questId === commissionId)).toHaveLength(1);
  });

  it('does not count against the weekly postings: the regular board is unchanged', () => {
    let postingWeeks = 0;
    for (const seed of ['com_3', 'com_3b', 'com_3c', 'com_3d', 'com_3e', 'com_3f']) {
      const a = newSession(seed);
      const b = newSession(seed);
      a.advanceWeek();
      b.advanceWeek();
      a.answerLetter(LETTER);
      for (let w = 0; w < 3; w++) {
        const postedBefore = b.world.byType('world.quest_posted').length;
        a.advanceWeek();
        b.advanceWeek();
        // Only a week where new notices went up can show the commission eating a slot.
        if (b.world.byType('world.quest_posted').length > postedBefore) postingWeeks++;
        const regA = a.board().filter((x) => !x.commission).map((x) => x.questId);
        const regB = b.board().map((x) => x.questId);
        expect(regA, `${seed} week ${w + 2}`).toEqual(regB);
      }
      // ...and it is still up in week 4 (posted week 1, four-week expiry).
      expect(a.board().some((x) => x.questId === commissionId)).toBe(true);
      a.advanceWeek();
      expect(a.board().some((x) => x.questId === commissionId)).toBe(false);
    }
    expect(postingWeeks, 'some compared week actually posted').toBeGreaterThan(0);
  });

  it('is launchable, pays its reward into the treasury, and never reposts', () => {
    let done = false;
    for (let i = 0; i < 6 && !done; i++) {
      const s = newSession(`com_pay_${i}`);
      s.advanceWeek();
      s.answerLetter(LETTER);
      const before = s.goldAmount();
      s.acceptQuest(commissionId);
      const rec = s.launchDispatch();
      expect(rec.fights?.length ?? 0).toBeGreaterThan(0); // a real fight happened
      if (rec.outcome !== 'completed') continue;
      expect(s.goldAmount() - before).toBe(questsById.get(commissionId)!.reward_gold);
      for (let w = 0; w < 10; w++) {
        s.advanceWeek();
        expect(s.board().some((b) => b.questId === commissionId)).toBe(false);
      }
      done = true;
    }
    expect(done).toBe(true);
  });

  it('survives serialize → deserialize: letter stays answered, commission stays up', () => {
    const s = newSession('com_save');
    s.advanceWeek();
    s.answerLetter(LETTER);
    const wire = JSON.parse(JSON.stringify(s.serialize())) as SessionSaveState;
    const restored = CampaignSession.deserialize(wire);
    expect(restored.pendingDialogue().some((d) => d.id === LETTER)).toBe(false);
    const entry = restored.board().find((b) => b.questId === commissionId);
    expect(entry?.commission).toBe(true);
    expect(entry?.expiresWeek).toBe(1 + SCHEDULER.commissionExpiryWeeks);
    expect(restored.serialize()).toEqual(s.serialize());
    restored.acceptQuest(commissionId);
    expect(['completed', 'failed', 'wiped', 'ambushKilled']).toContain(restored.launchDispatch().outcome);
  });

  it('an older save with no answered list loads, and the letter shows again', () => {
    const s = newSession('com_old');
    s.advanceWeek();
    const state = s.serialize();
    delete state.answered;
    const restored = CampaignSession.deserialize(state);
    expect(restored.pendingDialogue().some((d) => d.id === LETTER)).toBe(true);
  });

  it('commissions never post on their own', () => {
    const s = newSession('com_never');
    for (let w = 0; w < 12; w++) {
      s.advanceWeek();
      for (const b of s.board()) expect(COMMISSION_QUEST_IDS.has(b.questId)).toBe(false);
    }
  });
});
