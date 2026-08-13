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

type ContractPhase = 'preMilestone' | 'target';

/** ⚠ Brief #15's milestone flips this to 'target'. */
const PHASE: ContractPhase = 'preMilestone';

interface ContractRow {
  tier: DungeonTier;
  difficulty: number;
  level: number;
  minCompletedPct: number;
  maxWipedPct: number;
}

/**
 * `target` is brief #15 §11.1's approved measurement (92.0 / 91.3 / 76.0
 * completed, 2.0 / 4.3 / 13.0 wiped) with the §3 noise floor subtracted.
 *
 * Note those numbers were measured on an UNEQUIPPED party, and this harness
 * runs the gear bracket, so the target floors are conservative lower bounds
 * rather than predictions — gear measured +10.6 points at d2/d3. The milestone
 * must VERIFY them, not assume them.
 */
const CONTRACT: Readonly<Record<ContractPhase, readonly ContractRow[]>> = {
  // Measured on THESE seeds: 72.3 / 58.7 / 42.3 completed, 9.0 / 18.0 / 25.7
  // wiped. Floors sit 7 points off, per the noise floor above.
  preMilestone: [
    { tier: 'tiny', difficulty: 1, level: 1, minCompletedPct: 65, maxWipedPct: 16 },
    { tier: 'tiny', difficulty: 2, level: 2, minCompletedPct: 51, maxWipedPct: 25 },
    { tier: 'tiny', difficulty: 3, level: 3, minCompletedPct: 35, maxWipedPct: 33 },
  ],
  target: [
    { tier: 'tiny', difficulty: 1, level: 1, minCompletedPct: 85, maxWipedPct: 9 },
    { tier: 'tiny', difficulty: 2, level: 2, minCompletedPct: 84, maxWipedPct: 11 },
    { tier: 'tiny', difficulty: 3, level: 3, minCompletedPct: 69, maxWipedPct: 20 },
  ],
};

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
  });
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

  it('and cuts the pooled wipe rate across the whole at-level band', () => {
    let bracketWiped = 0, starterWiped = 0, cells = 0;
    for (const difficulty of [1, 2, 3]) {
      bracketWiped += measure('tiny', difficulty, difficulty, bracketProvider, 'bracket').wipedPct;
      starterWiped += measure('tiny', difficulty, difficulty, starterProvider, 'starter').wipedPct;
      cells++;
    }
    const bracketAvg = Math.round((bracketWiped / cells) * 10) / 10;
    const starterAvg = Math.round((starterWiped / cells) * 10) / 10;
    const delta = Math.round((starterAvg - bracketAvg) * 10) / 10;
    expect({
      bracketAvg, starterAvg, wipesAverted: delta,
      loadBearing: delta > 4, // measured 7.4 against a +/-3.8-point bar
    }).toMatchObject({ loadBearing: true });
  });

  it('the two policies really do equip different things', () => {
    const geared = partyAt(7, bracketProvider, 'bracket');
    const founding = partyAt(7, starterProvider, 'starter');
    // Torvald at L7: Full Plate + Longsword +2 vs the muster's Chain Mail + Longsword.
    expect(geared[0]!.c.ac).toBeGreaterThan(founding[0]!.c.ac);
    expect(geared[0]!.c.attackBonus).toBeGreaterThan(founding[0]!.c.attackBonus);
  });
});
