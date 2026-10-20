/**
 * The band screen (M4) — `bandPicks.ts` as a PURE module.
 *
 * Two kinds of test, on purpose (same split as townScreen.test.ts):
 *  - a hand-built `BandSource` (`fakeSource`), so each rule is pinned alone,
 *    with a control proving the rule can actually remove or reorder something;
 *  - the REAL session, so every rule is also shown to hold against the shipped
 *    sim — above all that `moveOk` agrees with `assignHero` IN BOTH DIRECTIONS.
 *
 * Every fixture has bands at DIFFERENT levels. A fixture where every hero
 * shares a level cannot express a band's own reading, a level that moves, or a
 * best fit that differs between bands — the six vacuous tests of this month.
 */
import { describe, expect, it } from 'vitest';
import { CampaignSession, type BoardEntry } from '@sim/campaign/session';
import { difficultyFor } from '@sim/campaign/difficulty';
import { RESOURCE_KINDS } from '@content/town';
import { starterParty } from '@sim/campaign/starterParty';
import {
  MAX_BANDS, bandName, bestFits, columnWidths, isBeyond, levelHint, moveOk, oddsKey, oddsLine,
  rankJobs, readBands, shortName, type BandCell, type BandView,
} from '../../src/ui/screens/bandPicks';
import { callBack, launchHeld, sendBand, DEFAULT_ORDERS, type BandActor } from '../../src/ui/screens/bandActions';
import { fakeSource, realGuild, type FakeHero } from './bandFixtures';

// ── synthetic board entries ─────────────────────────────────────────────────

function entry(questId: number, challenge: number, xp: number, level: number): BoardEntry {
  return {
    questId, name: `Job ${questId}`, minLevel: challenge, challenge,
    difficulty: difficultyFor(challenge, level), ease: 'fair', commission: false,
    regionId: 'region_haven', postedWeek: 1, expiresWeek: 9, rewardGold: 100, rewardXp: xp,
    pressureTier: 0, pos: { x: 0, y: 0 }, discovered: true,
  };
}
const ids = (list: readonly BoardEntry[]): number[] => list.map((e) => e.questId);

describe('rankJobs — the best-first order', () => {
  it('puts every non-Beyond job ahead of every Beyond job, whatever the XP', () => {
    // level 5: challenge 4 Measured, 6 Dangerous, 9 Beyond (huge XP)
    const board = [entry(1, 9, 5000, 5), entry(2, 6, 100, 5), entry(3, 4, 10, 5)];
    expect(ids(rankJobs(board))).toEqual([3, 2, 1]);
    // control: raise the level so job 1 is no longer Beyond — now its XP wins
    const raised = [entry(1, 9, 5000, 9), entry(2, 6, 100, 9), entry(3, 4, 10, 9)];
    expect(ids(rankJobs(raised))[0]).toBe(1);
  });

  it('ranks safe (Routine/Measured) ahead of Dangerous even when Dangerous pays more', () => {
    const board = [entry(1, 6, 900, 5), entry(2, 4, 100, 5), entry(3, 2, 50, 5)]; // Dangerous, Measured, Routine
    expect(board.map((e) => e.difficulty.id)).toEqual(['dangerous', 'measured', 'routine']);
    expect(ids(rankJobs(board))).toEqual([2, 3, 1]);
  });

  it('inside a group: most XP, then higher challenge, then lower quest id', () => {
    const board = [entry(7, 4, 100, 5), entry(3, 4, 100, 5), entry(5, 3, 100, 5), entry(9, 4, 300, 5)];
    expect(ids(rankJobs(board))).toEqual([9, 3, 7, 5]);
  });

  it('orders the Beyond jobs easiest first, so a forced choice is the least bad one', () => {
    const board = [entry(1, 12, 100, 3), entry(2, 6, 100, 3), entry(3, 9, 100, 3)];
    expect(board.every((e) => isBeyond(e.difficulty))).toBe(true);
    expect(ids(rankJobs(board))).toEqual([2, 3, 1]);
  });

  it('does not mutate its input', () => {
    const board = [entry(3, 4, 10, 5), entry(1, 4, 90, 5)];
    const snapshot = JSON.stringify(board);
    rankJobs(board);
    expect(JSON.stringify(board)).toBe(snapshot);
  });
});

describe('bestFits — one star per band, never shared', () => {
  const board = (level: number): BoardEntry[] => [
    entry(1, 5, 700, level), entry(2, 4, 400, level), entry(3, 3, 200, level), entry(4, 9, 3000, level),
  ];

  it('gives each band its own top-ranked job', () => {
    expect(bestFits([board(5), board(3)])).toEqual([1, 3]);
    // band 2 reads job 2 (challenge 4, level 3) as Dangerous and job 3 as Measured: the safe one wins
  });

  it('never gives two bands the same job: a later band skips what an earlier one claimed', () => {
    // same level, so both bands' own top pick is job 1
    expect(bestFits([board(5), board(5)])).toEqual([1, 2]);
    expect(bestFits([board(5), board(5), board(5)])).toEqual([1, 2, 3]);
    // control: job 1 really IS the top rank for both, so the skip above is doing the work
    expect(rankJobs(board(5))[0]!.questId).toBe(1);
  });

  it('Band 1 chooses first', () => {
    const two = bestFits([board(5), board(5)]);
    expect(two[0]).toBe(1);
    expect(two[1]).not.toBe(1);
  });

  it('gives a band with nothing short of Beyond us NO star, and says so with null', () => {
    const hopeless = [entry(1, 9, 900, 1), entry(2, 8, 800, 1)];
    expect(hopeless.every((e) => isBeyond(e.difficulty))).toBe(true);
    expect(bestFits([hopeless])).toEqual([null]);
    // control: the same postings read by a strong band do get a star
    expect(bestFits([[entry(1, 9, 900, 9), entry(2, 8, 800, 9)]])).toEqual([1]);
  });

  it('gives a band that cannot take work (null reading: empty or out) no star and does not let it claim one', () => {
    expect(bestFits([null, board(5)])).toEqual([null, 1]);
    expect(bestFits([board(5), null, board(5)])).toEqual([1, null, 2]);
  });

  it('runs out gracefully: a third band with nothing unclaimed gets null', () => {
    const one = [entry(1, 4, 100, 5)];
    expect(bestFits([one, one, one])).toEqual([1, null, null]);
  });
});

describe('levelHint — the hall words', () => {
  it('says "stays N" when the level does not move', () => expect(levelHint(7, 7)).toBe('stays 7'));
  it('says "N → M" when it does, up or down', () => {
    expect(levelHint(7, 6)).toBe('7 → 6');
    expect(levelHint(3, 4)).toBe('3 → 4');
  });
  it('says "starts at N" for a band with nobody in it — never "1 → N"', () => {
    expect(levelHint(null, 5)).toBe('starts at 5');
  });
});

// ── moves ───────────────────────────────────────────────────────────────────

function band(index: number, over: Partial<BandView> = {}): BandView {
  return {
    index, name: bandName(index), heroes: [], level: 3, size: 2, capacity: 4,
    empty: false, full: false, out: null, freeSlots: 2, ...over,
  };
}
const OUT = { questId: 1, questName: 'Job 1', regionName: 'Somewhere' };

describe('moveOk — the guard that keeps the screen from offering a refusal', () => {
  it('allows an ordinary move', () => {
    expect(moveOk([band(0), band(1)], 0, 1)).toEqual({ ok: true, why: null });
    expect(moveOk([band(0), band(1)], null, 1)).toEqual({ ok: true, why: null });
    expect(moveOk([band(0), band(1)], 1, null)).toEqual({ ok: true, why: null });
  });

  it('refuses a move INTO a band that is out', () => {
    const r = moveOk([band(0), band(1, { out: OUT })], null, 1);
    expect(r.ok).toBe(false);
    expect(r.why).toBe('Band 2 is out on a job');
  });

  it('refuses a move OUT OF a band that is out — including to the hall', () => {
    const bands = [band(0, { out: OUT }), band(1)];
    expect(moveOk(bands, 0, 1)).toEqual({ ok: false, why: 'Band 1 is out on a job' });
    expect(moveOk(bands, 0, null)).toEqual({ ok: false, why: 'Band 1 is out on a job' });
  });

  it('refuses a move into a band that is full, naming the Guild Hall cap', () => {
    const r = moveOk([band(0), band(1, { full: true, size: 4 })], null, 1);
    expect(r).toEqual({ ok: false, why: 'Band 2 is full (4)' });
  });

  it('does not call a band "full" against a hero already in it', () => {
    expect(moveOk([band(0, { full: true })], 0, 0).ok).toBe(true);
  });

  it('refuses a band that is not unlocked', () => {
    expect(moveOk([band(0)], null, 2).ok).toBe(false);
  });

  it('the hall is always open to a hero who is free to leave', () => {
    expect(moveOk([band(0, { full: true })], 0, null).ok).toBe(true);
  });
});

// ── layout + small words ────────────────────────────────────────────────────

describe('columnWidths — they follow the band count', () => {
  it('sums to 100 for 1, 2 and 3 bands', () => {
    for (const n of [1, 2, 3]) {
      const w = columnWidths(n);
      expect(w.job + w.band * n + w.locked, `${n} bands`).toBeCloseTo(100, 6);
    }
  });
  it('two bands come out at the approved 31.5%, with the locked column at 12', () => {
    expect(columnWidths(2)).toEqual({ job: 25, band: 31.5, locked: 12 });
  });
  it('a third band gets a REAL share, and there is no locked column to steal from it', () => {
    expect(columnWidths(3)).toEqual({ job: 25, band: 25, locked: 0 });
    // the regression: the old fixed 12% would have left a third band at 12
    expect(columnWidths(3).band).toBeGreaterThan(columnWidths(2).locked * 2);
  });
});

describe('small words', () => {
  it('shortName is the first word', () => {
    expect(shortName('Aldric Vane')).toBe('Aldric');
    expect(shortName('  Wren  ')).toBe('Wren');
  });
  it('oddsLine words a forecast and flags wipes', () => {
    expect(oddsLine({ n: 20, completed: 17, wiped: 0 })).toEqual({ text: 'Wins 17 of 20 · no wipes', bad: false });
    expect(oddsLine({ n: 20, completed: 11, wiped: 3 })).toEqual({ text: 'Wins 11 of 20 · wiped 3', bad: true });
  });
});

// ── readBands over a hand-built source ──────────────────────────────────────

const H = (id: string, level: number, band: number | null, extra: Partial<FakeHero> = {}): FakeHero => ({ id, level, band, ...extra });

/** Band 1 = three L7, Band 2 = three L2, Band 3 empty; two heroes at the hall (L5 and L1). */
const BASE: FakeHero[] = [
  H('a1', 7, 0), H('a2', 7, 0), H('a3', 7, 0),
  H('b1', 2, 1), H('b2', 2, 1), H('b3', 2, 1),
  H('w1', 5, null), H('w2', 1, null),
];
const POSTINGS = [
  { questId: 10, challenge: 2, xp: 100 },
  { questId: 11, challenge: 5, xp: 400 },
  { questId: 12, challenge: 8, xp: 900 },
  { questId: 13, challenge: 11, xp: 1500 },
];
const cell = (v: ReturnType<typeof readBands>, questId: number, b: number): BandCell =>
  v.jobs.find((j) => j.questId === questId)!.cells[b]!;

describe('readBands — each band reads the board through its own eyes', () => {
  const src = fakeSource({ heroes: BASE, postings: POSTINGS, bands: 3 });
  const v = readBands(src);

  it("shows each band's OWN word, verbatim from board(i), and the bands disagree", () => {
    for (const b of [0, 1]) {
      const own = src.board(b);
      for (const j of v.jobs) {
        expect(cell(v, j.questId, b).word, `band ${b + 1} job ${j.questId}`)
          .toEqual(own.find((e) => e.questId === j.questId)!.difficulty);
      }
    }
    // coverage: the fixture really does produce DIFFERENT words for one job, or this proves nothing
    const disagreements = v.jobs.filter((j) => cell(v, j.questId, 0).word!.id !== cell(v, j.questId, 1).word!.id);
    expect(disagreements.length).toBeGreaterThanOrEqual(3);
    const seen = new Set(v.jobs.flatMap((j) => [cell(v, j.questId, 0).word!.id, cell(v, j.questId, 1).word!.id]));
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('an EMPTY band has no Send, no word, no star and no level', () => {
    expect(v.bands[2]!.empty).toBe(true);
    expect(v.bands[2]!.level).toBeNull();
    for (const j of v.jobs) {
      const c = j.cells[2]!;
      expect(c.kind).toBe('empty');
      expect(c.canSend).toBe(false);
      expect(c.word).toBeNull();
      expect(c.best).toBe(false);
    }
    expect(v.bestByBand[2]).toBeNull();
  });

  it('canSend is true exactly on kind "send" — across every cell', () => {
    for (const j of v.jobs) for (const c of j.cells) expect(c.canSend, `${c.kind}`).toBe(c.kind === 'send');
  });

  it('stars one best fit per band and no two bands share one', () => {
    const stars = v.jobs.flatMap((j) => j.cells.filter((c) => c.best).map((c) => [c.band, c.questId] as const));
    expect(stars.length).toBeGreaterThanOrEqual(2);
    expect(new Set(stars.map(([b]) => b)).size).toBe(stars.length);
    expect(new Set(stars.map(([, q]) => q)).size).toBe(stars.length);
    expect(v.bestByBand).toEqual([11, 10, null]);
  });

  it('marks Beyond-us cells risky but still sendable', () => {
    const c = cell(v, 13, 1); // challenge 11 vs level 2
    expect(c.word!.id).toBe('beyond');
    expect(c.risky).toBe(true);
    expect(c.canSend).toBe(true);
    expect(cell(v, 10, 0).risky).toBe(false);
  });

  it('lists postings easiest first and offers the next locked band', () => {
    expect(v.jobs.map((j) => j.questId)).toEqual([10, 11, 12, 13]);
    expect(v.nextLocked).toBeNull(); // 3 bands = the ceiling
    expect(readBands(fakeSource({ heroes: BASE, postings: POSTINGS, bands: 2 })).nextLocked).toBe(2);
    expect(readBands(fakeSource({ heroes: BASE, postings: POSTINGS, bands: 1 })).nextLocked).toBe(1);
  });
});

describe('readBands — a band that is OUT', () => {
  const heroes = [...BASE];
  const src = fakeSource({ heroes, postings: POSTINGS, bands: 3, out: { 1: 12 } });
  const v = readBands(src);

  it('is locked, has no Send, and no star', () => {
    expect(v.bands[1]!.out?.questId).toBe(12);
    expect(v.bestByBand[1]).toBeNull();
    for (const j of v.jobs) {
      const c = j.cells[1]!;
      expect(c.canSend, `job ${j.questId}`).toBe(false);
      expect(['out', 'mine']).toContain(c.kind);
    }
  });

  it('puts the held job back as its own row, "mine" for the holder and "taken" for the rest', () => {
    const row = v.jobs.find((j) => j.questId === 12)!;
    expect(row.heldBy).toBe(1);
    expect(row.cells.map((c) => c.kind)).toEqual(['taken', 'mine', 'taken']);
    expect(row.cells[0]!.takenBy).toBe(1);
    expect(row.cells[0]!.canSend).toBe(false);
    // held rows sort after the open board
    expect(v.jobs[v.jobs.length - 1]!.questId).toBe(12);
  });

  it('a held job never counts as an open posting for the other bands', () => {
    expect(v.jobs.filter((j) => j.heldBy === null).map((j) => j.questId)).toEqual([10, 11, 13]);
    expect(v.bestByBand[0]).toBe(11);
  });

  it('locks the band in the roster editor', () => {
    expect(v.roster.map((c) => [c.band, c.locked])).toEqual([[0, false], [1, true], [2, false], [null, false]]);
  });
});

describe('readBands — the hall hints and which moves are live', () => {
  const src = fakeSource({ heroes: BASE, postings: POSTINGS, bands: 3 });
  const v = readBands(src);
  const hero = (id: string) => v.hall.find((h) => h.id === id)!;

  it('hints come from partyLevelIf and say "stays" only where the level truly stays', () => {
    const w1 = hero('w1'); // L5
    const toBand1 = w1.moves.find((m) => m.to === 0)!; // band 1: 7,7,7 + 5 → 6.5 → 7?  mean 6.5 rounds to 7 → stays 7
    expect(toBand1.levelAfter).toBe(src.partyLevelIf('w1', 0));
    expect(toBand1.hint).toBe(levelHint(7, src.partyLevelIf('w1', 0)));
    const toBand2 = w1.moves.find((m) => m.to === 1)!; // band 2: 2,2,2 + 5 → 2.75 → 3
    expect(toBand2.hint).toBe('2 → 3');
    // coverage: both a "stays" and an "→" really occur in this fixture
    const hints = v.hall.flatMap((h) => h.moves.map((m) => m.hint));
    expect(hints.some((x) => x.startsWith('stays'))).toBe(true);
    expect(hints.some((x) => x.includes('→'))).toBe(true);
  });

  it('a move into an empty band says "starts at N" with the hero\'s own level', () => {
    const m = hero('w1').moves.find((x) => x.to === 2)!;
    expect(m.levelNow).toBeNull();
    expect(m.hint).toBe('starts at 5');
  });

  it('a hall hero is offered every unlocked band and not the hall itself', () => {
    expect(hero('w1').moves.map((m) => m.to)).toEqual([0, 1, 2]);
  });

  it('disables a move into a full band and one into an out band, with the reason', () => {
    const full = readBands(fakeSource({ heroes: BASE, postings: POSTINGS, bands: 3, cap: 3 }));
    const intoFull = full.hall[0]!.moves.find((m) => m.to === 0)!;
    expect(intoFull.ok).toBe(false);
    expect(intoFull.why).toBe('Band 1 is full (3)');
    const out = readBands(fakeSource({ heroes: BASE, postings: POSTINGS, bands: 3, out: { 1: 12 } }));
    const intoOut = out.hall[0]!.moves.find((m) => m.to === 1)!;
    expect(intoOut).toMatchObject({ ok: false, why: 'Band 2 is out on a job' });
    // controls: the same hero's other moves stay live
    expect(out.hall[0]!.moves.find((m) => m.to === 0)!.ok).toBe(true);
  });

  it('the roster editor offers a band hero every OTHER band plus the hall', () => {
    const col = v.roster.find((c) => c.band === 0)!;
    expect(col.entries[0]!.moves.map((m) => m.to)).toEqual([1, 2, null]);
    expect(v.roster[v.roster.length - 1]!.band).toBeNull();
  });
});

describe('readBands — hero condition passes through as numbers', () => {
  it('carries wounded and status so the screen can word them', () => {
    const v = readBands(fakeSource({
      heroes: [H('a', 3, 0, { wounded: 4 }), H('b', 3, 0, { status: 'dead' }), H('c', 3, null)],
      postings: POSTINGS, bands: 1,
    }));
    expect(v.bands[0]!.heroes.map((h) => [h.wounded, h.status])).toEqual([[4, 'active'], [0, 'dead']]);
  });
});

describe('oddsKey — a stale forecast can never show', () => {
  it('changes when the band\'s heroes change, and between bands and jobs', () => {
    const a = readBands(fakeSource({ heroes: BASE, postings: POSTINGS, bands: 2 }));
    const moved = readBands(fakeSource({ heroes: BASE.map((h) => (h.id === 'w1' ? { ...h, band: 1 } : h)), postings: POSTINGS, bands: 2 }));
    expect(oddsKey(a, 1, 10)).not.toBe(oddsKey(moved, 1, 10));
    expect(oddsKey(a, 0, 10)).toBe(oddsKey(moved, 0, 10)); // band 1 did not change
    expect(oddsKey(a, 0, 10)).not.toBe(oddsKey(a, 0, 11));
    expect(oddsKey(a, 0, 10)).not.toBe(oddsKey(a, 1, 10));
  });
});

// ── against the REAL session ────────────────────────────────────────────────

describe('against the real session', () => {
  it('MAX_BANDS is the real ceiling: the fully built Barracks supports exactly that many bands', () => {
    const s = CampaignSession.create({ campaignId: 'cap', seed: 'world_cap', party: starterParty() });
    s.devAddGold(500_000);
    s.grantResources(Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 999])));
    s.grantReputation(100);
    for (let i = 0; i < 6; i++) { try { s.upgradeBuilding(2); } catch { /* already maxed */ } }
    expect(s.partyCount()).toBe(MAX_BANDS);
  });

  it("each band's word is the sim's own `board(i)` word, and the two bands really disagree", () => {
    const s = realGuild({ bands: 2, gains: [6, 0] });
    const v = readBands(s);
    expect(v.bands.map((b) => b.level)).toEqual([s.partyLevel(0), s.partyLevel(1)]);
    expect(v.bands[0]!.level).toBeGreaterThan(v.bands[1]!.level!);
    let differ = 0;
    for (const b of [0, 1]) {
      for (const e of s.board(b)) {
        const c = v.jobs.find((j) => j.questId === e.questId)!.cells[b]!;
        expect(c.word).toEqual(e.difficulty);
      }
    }
    for (const j of v.jobs) if (j.cells[0]!.word?.id !== j.cells[1]!.word?.id) differ++;
    expect(differ, 'the fixture must make the bands read at least one job differently').toBeGreaterThan(0);
  });

  it("the hall hint is what the band's level REALLY becomes after the move", () => {
    const s = realGuild({ bands: 2, seats: [3, 3], hall: 2, gains: [5, 1], hallLevels: [3, 0] });
    const v = readBands(s);
    expect(v.hall).toHaveLength(2);
    let moved = 0, shifted = 0, stayed = 0;
    for (const h of v.hall) {
      for (const m of h.moves) {
        if (!m.ok || m.to === null) continue;
        const before = s.partyLevel(m.to);
        s.assignHero(h.id, m.to);
        const after = s.partyLevel(m.to);
        expect(after, `${h.id} → band ${m.to + 1}`).toBe(m.levelAfter);
        expect(m.hint).toBe(after === before ? `stays ${before}` : `${before} → ${after}`);
        if (after === before) stayed++; else shifted++;
        s.assignHero(h.id, null); // put them back for the next probe
        moved++;
      }
    }
    expect(moved).toBe(4);
    // coverage: a real move that changes the level AND a real one that does not
    expect(shifted).toBeGreaterThan(0);
    expect(stayed).toBeGreaterThan(0);
  });

  it('moveOk agrees with assignHero IN BOTH DIRECTIONS: offered moves succeed, withheld moves throw', () => {
    // 3 bands: Band 1 full (4), Band 2 OUT on a job, Band 3 with room; two at the hall
    const s = realGuild({ bands: 3, seats: [4, 3, 2], hall: 2, gains: [3, 1, 0] });
    const job = s.board(1)[0]!.questId;
    s.acceptQuest(job, 1); // Band 2 is out
    const clone = (): CampaignSession => CampaignSession.deserialize(JSON.parse(JSON.stringify(s.serialize())));
    const before = readBands(s);
    expect(before.bands.map((b) => [b.full, b.out !== null])).toEqual([[true, false], [false, true], [false, false]]);

    let ok = 0, refused = 0;
    for (const col of before.roster) {
      for (const { hero, moves } of col.entries) {
        for (const m of moves) {
          const probe = clone();
          expect(probe.activeByParty()[1]).not.toBeNull(); // the clone kept Band 2 out
          if (m.ok) {
            expect(() => probe.assignHero(hero.id, m.to), `offered: ${hero.id} → ${m.to}`).not.toThrow();
            ok++;
          } else {
            expect(() => probe.assignHero(hero.id, m.to), `withheld: ${hero.id} → ${m.to} (${m.why})`).toThrow();
            refused++;
          }
        }
      }
    }
    // coverage: both arms of the claim were exercised
    expect(ok).toBeGreaterThan(5);
    expect(refused).toBeGreaterThan(5);
  });

  it('a band that is OUT shows its job, has no Send, and the held job is not on the open board', () => {
    const s = realGuild({ bands: 2, gains: [4, 0] });
    const job = s.board(1)[0]!.questId;
    s.acceptQuest(job, 1);
    const v = readBands(s);
    expect(v.bands[1]!.out?.questId).toBe(job);
    expect(v.bands[1]!.out?.questName).toBe(s.questName(job));
    expect(v.jobs.filter((j) => j.heldBy === null).map((j) => j.questId)).not.toContain(job);
    expect(v.jobs.find((j) => j.questId === job)!.heldBy).toBe(1);
    for (const j of v.jobs) expect(j.cells[1]!.canSend).toBe(false);
    expect(v.roster[1]!.locked).toBe(true);
  });

  it('an empty band is a legal state the screen respects: no Send, level null', () => {
    const s = realGuild({ bands: 2, seats: [4, 0], hall: 2 });
    const v = readBands(s);
    expect(v.bands[1]!.empty).toBe(true);
    expect(v.bands[1]!.level).toBeNull();
    for (const j of v.jobs) expect(j.cells[1]!.canSend).toBe(false);
    // and the sim agrees that sending it would be refused
    expect(() => s.acceptQuest(s.board(1)[0]!.questId, 1)).toThrow(/no heroes/);
    // hall heroes offer "starts at N" for it
    expect(v.hall[0]!.moves.find((m) => m.to === 1)!.hint).toMatch(/^starts at \d+$/);
  });

  it('readBands calls no mutator: reading twice leaves the session byte-identical', () => {
    const s = realGuild({ bands: 3, seats: [4, 3, 2], hall: 2, gains: [3, 1, 0] });
    const before = JSON.stringify(s.serialize());
    readBands(s); readBands(s);
    expect(JSON.stringify(s.serialize())).toBe(before);
  });
});

// ── bandActions ─────────────────────────────────────────────────────────────

describe('bandActions', () => {
  it('Send takes the job AND marches: both bands can go in one week and the second sees the first one gone', () => {
    const s = realGuild({ bands: 2, gains: [3, 0] });
    const first = s.board(0)[0]!.questId;
    const r0 = sendBand(s, 0, first);
    expect(r0.questId).toBe(first);
    expect(s.activeByParty()).toEqual([null, null]); // marched and home
    expect(s.board(1).map((e) => e.questId)).not.toContain(first);
    const second = s.board(1)[0]!.questId;
    const r1 = sendBand(s, 1, second);
    expect(r1.questId).toBe(second);
  });

  it("Send for an empty band is refused with the sim's own sentence and leaves nothing held", () => {
    const s = realGuild({ bands: 2, seats: [4, 0], hall: 1 });
    expect(() => sendBand(s, 1, s.board(1)[0]!.questId)).toThrow('acceptQuest: party 2 has no heroes — assign someone before taking a job');
    expect(s.activeByParty()).toEqual([null, null]);
  });

  it('if the march fails after the job was taken, the job goes BACK and the error is rethrown untouched', () => {
    const calls: string[] = [];
    let held: unknown = null;
    const actor: BandActor = {
      acceptQuest: () => { calls.push('accept'); held = { questId: 7 }; },
      configureDispatch: () => { calls.push('configure'); },
      launchDispatch: () => { calls.push('launch'); throw new Error('launchDispatch: the road is closed'); },
      activeByParty: () => [held as never],
      abandonQuest: () => { calls.push('abandon'); held = null; },
      assignHero: () => undefined,
    };
    expect(() => sendBand(actor, 0, 7)).toThrow('launchDispatch: the road is closed');
    expect(calls).toEqual(['accept', 'configure', 'launch', 'abandon']);
    // control: when the accept itself fails there is nothing to give back
    const calls2: string[] = [];
    const refusing: BandActor = {
      ...actor,
      acceptQuest: () => { throw new Error('acceptQuest: nope'); },
      abandonQuest: () => { calls2.push('abandon'); },
      activeByParty: () => [null],
    };
    expect(() => sendBand(refusing, 0, 7)).toThrow('acceptQuest: nope');
    expect(calls2).toEqual([]);
  });

  it('launchHeld marches a band that holds a job; callBack returns the job to the board', () => {
    const s = realGuild({ bands: 2, gains: [2, 0] });
    const job = s.board(1)[0]!.questId;
    s.acceptQuest(job, 1);
    callBack(s, 1);
    expect(s.activeByParty()[1]).toBeNull();
    expect(s.board(1).map((e) => e.questId)).toContain(job);
    s.acceptQuest(job, 1);
    const rec = launchHeld(s, 1);
    expect(rec.questId).toBe(job);
    expect(s.activeByParty()[1]).toBeNull();
  });

  it('the default orders are the ones the Dispatch screen opens on', () => {
    expect(DEFAULT_ORDERS).toEqual({ profile: 'fullExplore', caution: 'standard' });
  });
});
