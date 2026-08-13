import { describe, expect, it } from 'vitest';
import { runDungeonDispatch } from '@sim/dungeon/dispatch';
import type { DungeonTier } from '@content/dungeon';
import { bracketProvider, partyAt, starterProvider, type GearProvider } from './gearBrackets';

/**
 * THE AT-LEVEL CONTRACT (brief #16, APPROVED).
 *
 * Steven's tuning target, and the thing all balance work is measured against:
 *
 *   "A level-N party of four in a level-N dungeon should complete about 80% of
 *    the time. Punching up one level should measurably lower that."
 *
 * ── Why there are two phases ─────────────────────────────────────────────────
 * This harness is the approved PREREQUISITE for brief #15's milestone, so it
 * lands BEFORE the changes that reach the target. Today's curve and the
 * contract are both correct; they describe different commits. Rather than ship
 * a harness with no absolute number in it, or a skipped test nobody reads (the
 * failure mode that let the 24-week career harness stay green through 922
 * failed dispatches), both number sets live here and `PHASE` selects one.
 *
 * >>> BRIEF #15's MILESTONE FLIPS `PHASE` TO 'target'. That flip is part of the
 * >>> milestone, not a follow-up, and the commit message must say so.
 *
 * ── Why 300 runs and why the floors sit where they do ────────────────────────
 * Measured (brief #16 §3): eight independent blocks of the SAME cell land 30
 * points apart at 30 runs, 8.0 apart at 100, and 7.0 apart at 300. The
 * arithmetic agrees — SE at n=300, p~0.55 is 2.87 points, so a difference
 * between two measurements carries +/-8 at 95%. Floors therefore sit ~7 points
 * below the measured value: tight enough to catch a real regression, loose
 * enough not to fire on an honest re-seed. NOTHING here may assert a difference
 * smaller than ~8 points, which is why the punch-up test checks sign and
 * magnitude rather than the measured -20 / -37 / -57.
 */

const RUNS = Number(process.env['GV_HARNESS_N'] ?? 300);

/**
 * ⚠ TWO TESTS IN THIS FILE MEASURE INSIDE THE `it()` BODY, AND THEY OUTGREW
 * VITEST'S 5 000 ms DEFAULT.
 *
 * Every other harness file precomputes in `describe` scope, so its cost lands
 * in vitest's COLLECT phase, which is untimed. This file is the exception: the
 * punch-up test and NC6's pooled control each call `measure()` from inside the
 * test, so their whole dispatch load is charged against the per-test timeout.
 * NC6 alone runs 6 × RUNS = 1 800 dispatches there.
 *
 * Measured in the cloud container 2026-08-13: NC6 5 412 ms, punch-up 5 112 ms,
 * against a 5 000 ms default — a coin-flip that failed 3 runs out of 3 and took
 * the punch-up test with it once. It passes on Steven's Windows box, which is
 * roughly 2× faster on this file, which is why it had never surfaced.
 *
 * This does NOT weaken any assertion — no threshold, band or n changed. It only
 * stops a correct test from being scored on wall-clock. The value carries REAL
 * headroom on purpose (~5× the observed time at the default n), because the
 * near-miss is what made this a flake instead of a clean failure: brief #19
 * moved NC6's band from d1–d3 to d3–d5 and deeper dungeons run more encounters,
 * so the next honest band move must not re-trip it. It scales with `RUNS`
 * because `GV_HARNESS_N` is an env knob and a raised n is a legitimate thing to
 * do to this harness.
 */
const HEAVY_IT_TIMEOUT_MS = Math.max(30_000, RUNS * 60);

type ContractPhase = 'preMilestone' | 'target';

/** Flipped to 'target' by brief #15's milestone, as that milestone required. */
const PHASE: ContractPhase = 'target';

interface ContractRow {
  tier: DungeonTier;
  difficulty: number;
  level: number;
  minCompletedPct: number;
  maxWipedPct: number;
}

/**
 * `target` floors are anchored to what the milestone ACTUALLY measured, minus
 * the §3 noise floor — not to brief #15 §11.1's predictions, which were taken
 * on an unequipped party and could not be assumed to survive the gear bracket.
 *
 * Verified against those predictions and consistent with them: measured
 * 91.7 / 85.3 / 80.7 against predicted 92.0 / 91.3 / 76.0. Every delta
 * (−0.3, −6.0, +4.7) sits inside the ±8-point bar.
 *
 * Steven's contract itself — "about 80% at level" — is asserted separately and
 * explicitly below, because a floor derived from a measurement drifts with the
 * measurement, and the target should not.
 */
const CONTRACT: Readonly<Record<ContractPhase, readonly ContractRow[]>> = {
  // Measured on THESE seeds: 72.3 / 58.7 / 42.3 completed, 9.0 / 18.0 / 25.7
  // wiped. Floors sit 7 points off, per the noise floor above.
  preMilestone: [
    { tier: 'tiny', difficulty: 1, level: 1, minCompletedPct: 65, maxWipedPct: 16 },
    { tier: 'tiny', difficulty: 2, level: 2, minCompletedPct: 51, maxWipedPct: 25 },
    { tier: 'tiny', difficulty: 3, level: 3, minCompletedPct: 35, maxWipedPct: 33 },
  ],
  // Measured post-milestone: 91.7 / 85.3 / 80.7 completed, 4.7 / 8.3 / 12.3 wiped.
  target: [
    { tier: 'tiny', difficulty: 1, level: 1, minCompletedPct: 84, maxWipedPct: 12 },
    { tier: 'tiny', difficulty: 2, level: 2, minCompletedPct: 78, maxWipedPct: 15 },
    { tier: 'tiny', difficulty: 3, level: 3, minCompletedPct: 73, maxWipedPct: 19 },
  ],
};

/**
 * STEVEN'S TARGET, in his own words: "a level-N party of four in a level-N
 * dungeon should complete about 80% of the time."
 *
 * Asserted on its own rather than folded into the floors above, because those
 * floors track the measurement and this number does not. If a future change
 * moves the curve down by a defensible amount, the floors get re-derived — and
 * this line is what still says whether the game is hitting its target.
 */
const TARGET_AT_LEVEL_PCT = 80;

/** Recorded, not gated: brief #14 §10.3 makes d4+ a CONTENT question. */
const RECORDED: readonly { tier: DungeonTier; difficulty: number; level: number }[] = [
  { tier: 'small', difficulty: 4, level: 4 },
  { tier: 'small', difficulty: 5, level: 5 },
];

/** Punching up: the same party one difficulty above its weight class. */
const PUNCH_UP: readonly { tier: DungeonTier; level: number; difficulty: number }[] = [
  { tier: 'tiny', level: 1, difficulty: 2 },
  { tier: 'tiny', level: 2, difficulty: 3 },
  { tier: 'small', level: 3, difficulty: 4 },
];

/** A punch-up must cost at least this much — sign plus magnitude, never a point value. */
const MIN_PUNCH_UP_COST_PCT = 10;

interface Outcome { completedPct: number; retreatedPct: number; wipedPct: number }

function measure(
  tier: DungeonTier,
  difficulty: number,
  level: number,
  provider: GearProvider,
  policyName: string,
): Outcome {
  let completed = 0, retreated = 0, wiped = 0;
  for (let i = 0; i < RUNS; i++) {
    const seed = `gvcurve_${policyName}_${tier}_d${difficulty}_L${level}_${i}`;
    const r = runDungeonDispatch({
      dispatchId: seed,
      partyId: 'party_1',
      party: partyAt(level, provider, policyName),
      tier,
      seed,
      profile: 'fullExplore',
      caution: 'standard',
      difficulty,
      partyLevel: level,
    });
    if (r.outcome === 'completed') completed++;
    else if (r.outcome === 'wiped') wiped++;
    else retreated++;
  }
  const pct = (n: number) => Math.round((n / RUNS) * 1000) / 10;
  return { completedPct: pct(completed), retreatedPct: pct(retreated), wipedPct: pct(wiped) };
}

const atLevel = (tier: DungeonTier, difficulty: number, level: number): Outcome =>
  measure(tier, difficulty, level, bracketProvider, 'bracket');

describe('the at-level contract — a level-N party in a level-N dungeon', () => {
  const rows = CONTRACT[PHASE];
  const measured = new Map<string, Outcome>();
  for (const row of rows) {
    measured.set(`d${row.difficulty}`, atLevel(row.tier, row.difficulty, row.level));
  }
  for (const r of RECORDED) {
    measured.set(`d${r.difficulty}`, atLevel(r.tier, r.difficulty, r.level));
  }

  it(`THE CONTRACT (phase: ${PHASE}): at-level completion clears its floor`, () => {
    const failures: string[] = [];
    for (const row of rows) {
      const m = measured.get(`d${row.difficulty}`)!;
      if (m.completedPct < row.minCompletedPct) {
        failures.push(
          `d${row.difficulty}/L${row.level}: completed ${m.completedPct}% < floor ${row.minCompletedPct}%`,
        );
      }
      if (m.wipedPct > row.maxWipedPct) {
        failures.push(`d${row.difficulty}/L${row.level}: wiped ${m.wipedPct}% > ceiling ${row.maxWipedPct}%`);
      }
    }
    expect(failures).toEqual([]);
  });

  /**
   * The tuning target itself. 80% minus the §3 noise floor: a cell has to be
   * genuinely below target, not unluckily seeded, before this fires.
   */
  it(`STEVEN'S TARGET: a level-N party in a level-N dungeon completes about ${TARGET_AT_LEVEL_PCT}% of the time`, () => {
    const shortfalls: string[] = [];
    for (const key of ['d1', 'd2', 'd3']) {
      const m = measured.get(key)!;
      if (m.completedPct < TARGET_AT_LEVEL_PCT - 7) {
        shortfalls.push(`${key}: ${m.completedPct}% — more than 7 points under the ${TARGET_AT_LEVEL_PCT}% target`);
      }
    }
    expect(shortfalls).toEqual([]);
  });

  /**
   * The curve must SLOPE DOWN. A flat curve would mean "at level" had stopped
   * meaning anything, which no single-cell threshold catches.
   */
  it('at-level difficulty is monotone: deeper is never easier', () => {
    const d1 = measured.get('d1')!, d2 = measured.get('d2')!, d3 = measured.get('d3')!;
    expect({
      d1: d1.completedPct, d2: d2.completedPct, d3: d3.completedPct,
      monotone: d1.completedPct >= d2.completedPct && d2.completedPct >= d3.completedPct,
    }).toMatchObject({ monotone: true });
  });

  it('THE BASELINE: the at-level curve, exact — drift must justify itself', () => {
    const snapshot: Record<string, Outcome> = {};
    for (const [k, v] of [...measured.entries()].sort()) snapshot[k] = v;
    expect({ phase: PHASE, runsPerCell: RUNS, gear: 'bracket', curve: snapshot }).toMatchSnapshot();
  });
});

describe('the risk gradient — punching above your weight class', () => {
  it(`costs at least ${MIN_PUNCH_UP_COST_PCT} points of completion at every level`, () => {
    const failures: string[] = [];
    for (const { tier, level, difficulty } of PUNCH_UP) {
      const own = atLevel(tier, level, level);
      const up = measure(tier, difficulty, level, bracketProvider, 'bracket');
      const cost = own.completedPct - up.completedPct;
      if (cost < MIN_PUNCH_UP_COST_PCT) {
        failures.push(
          `L${level}: at-level ${own.completedPct}% vs d${difficulty} ${up.completedPct}% — cost ${cost.toFixed(1)} pts`,
        );
      }
    }
    expect(failures).toEqual([]);
  }, HEAVY_IT_TIMEOUT_MS);
});

/**
 * NC6 — THE NEGATIVE CONTROL FOR THE GEAR POLICY ITSELF (brief #16 §8).
 *
 * This is the control a normal review skips, and the one that matters most. If
 * the bracket silently fails to apply — a mistyped item id, a rung that never
 * matches, `equipped` overwritten downstream — the harness would look exactly
 * like a healthy green baseline, because a permanently-unequipped party is the
 * precise thing this policy exists to STOP measuring. So the harness proves,
 * every run, that its own gear policy is load-bearing.
 */
describe('NC6 — the gear policy is wired in and measurably load-bearing', () => {
  /**
   * WHERE the control is taken matters, and this cost a correction to brief #16
   * §5.3. That section claimed the bracket was worth +10.6 points at BOTH d2
   * and d3. Re-measured on this harness's own seeds: +0.3 at d1, +1.3 at d2,
   * +12.3 at d3. The d2 figure was seed-selection luck — precisely the error
   * the noise floor exists to catch, caught here on the harness's first run.
   *
   * The corrected reading is a coherent one: at d1-d2 the wedge wins
   * comfortably either way and gear is slack; at d3 the fight is close enough
   * that gear decides it. So the control is taken at d3, where the signal is,
   * and on the POOLED wipe rate, where the lower base rate tightens the bar
   * (+/-3.8 points at n=900/side against an observed -7.4).
   */
  it('the bracket beats the founding kit where gear can decide a fight (d3)', () => {
    const bracket = measure('tiny', 3, 3, bracketProvider, 'bracket');
    const starter = measure('tiny', 3, 3, starterProvider, 'starter');
    const delta = Math.round((bracket.completedPct - starter.completedPct) * 10) / 10;
    expect({
      bracket: bracket.completedPct, starter: starter.completedPct, delta,
      loadBearing: delta > 8, // measured +12.3 against a +/-8-point bar
    }).toMatchObject({ loadBearing: true });
  });

  /**
   * ⚠ THE BAND MOVED FROM d1–d3 TO d3–d5, AND THE REASON IS BRIEF #19.
   *
   * This control pools three cells so the lower base rate of wipes tightens the
   * bar (±3.8 points at n=900/side). That only works while there are wipes to
   * avert. After the room + `aoo_count` + backstab pass, at-level wipes under
   * the bracket are 1.0 / 2.3 / 4.7 / 16.3 / 10.0 at d1–d5 — d1 and d2 have
   * collapsed into a floor, and a control taken there is measuring nothing.
   * Measured on the old d1–d3 band it reads 2.7 vs 4.2, a 1.5-point delta
   * INSIDE the noise bar; on d3–d5 it reads 10.3 vs 21.8.
   *
   * THE THRESHOLD IS UNCHANGED (> 4) AND SO IS n. Only the band moved, to where
   * the signal still lives — the same reasoning brief #16 §8 used when it put
   * the completion half of this control at d3 rather than d2. Weakening the
   * threshold instead would have been the tempting, wrong fix: it would have
   * quietly let this control assert a difference smaller than the noise floor,
   * which is the one thing the precision rule forbids.
   */
  it('and cuts the pooled wipe rate across the band where wipes still happen (d3–d5)', () => {
    let bracketWiped = 0, starterWiped = 0, cells = 0;
    for (const [tier, difficulty] of [['tiny', 3], ['small', 4], ['small', 5]] as const) {
      bracketWiped += measure(tier, difficulty, difficulty, bracketProvider, 'bracket').wipedPct;
      starterWiped += measure(tier, difficulty, difficulty, starterProvider, 'starter').wipedPct;
      cells++;
    }
    const bracketAvg = Math.round((bracketWiped / cells) * 10) / 10;
    const starterAvg = Math.round((starterWiped / cells) * 10) / 10;
    const delta = Math.round((starterAvg - bracketAvg) * 10) / 10;
    expect({
      bracketAvg, starterAvg, wipesAverted: delta,
      loadBearing: delta > 4, // measured 11.5 on d3-d5 against a +/-3.8-point bar
    }).toMatchObject({ loadBearing: true });
  }, HEAVY_IT_TIMEOUT_MS);

  it('the two policies really do equip different things', () => {
    const geared = partyAt(7, bracketProvider, 'bracket');
    const founding = partyAt(7, starterProvider, 'starter');
    // Torvald at L7: Full Plate + Longsword +2 vs the muster's Chain Mail + Longsword.
    expect(geared[0]!.c.ac).toBeGreaterThan(founding[0]!.c.ac);
    expect(geared[0]!.c.attackBonus).toBeGreaterThan(founding[0]!.c.attackBonus);
  });
});
