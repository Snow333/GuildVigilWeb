import { describe, expect, it } from 'vitest';
import { runDungeonDispatch, type MissionProfile } from '@sim/dungeon/dispatch';
import type { DungeonTier } from '@content/dungeon';
import { bracketProvider, partyAt } from './gearBrackets';

/**
 * THE DUNGEON DISTRIBUTION HARNESS (brief #16, APPROVED) — the dispatch-level
 * half that `tests/dungeon/population.test.ts` left missing.
 *
 * Until this file, NOTHING guarded dungeon generation. `career-distribution`
 * never dispatches a dungeon (480 quest records, 0 dungeon runs — the autopilot
 * only ever accepts the three surface combat quests); `encounter-distribution`
 * runs hand-authored rosters and never calls `populate()` or `pickEnemies`. So
 * `population.ts`, `dispatch.ts`, `graph.ts` and `pool.ts` could all be
 * rewritten with every committed baseline staying byte-identical green.
 *
 * Nor did anything drive the REAL assembly path: `tests/dungeon/dispatch.test.ts`
 * hand-writes its combatants as literals and passes `partyLevel` as a bare
 * number, so no test in the repo ran a levelled, geared `HeroState` through
 * `assembleHero` into a dungeon. This one does, end to end:
 *   muster -> buildAutoLevelUpPlan -> applyLevelUp -> deriveItem -> assembleHero
 *   -> populate -> runDungeonDispatch
 *
 * 100 runs/cell: the grid is seed-pinned and deterministic, so the snapshot is
 * exact regardless of n and only reproducibility matters here — precision is
 * the CURVE's problem (see dungeon-curve.test.ts and brief #16 §3). Measured
 * cost of the whole grid: ~2.3 s.
 */

const RUNS = Number(process.env['GV_HARNESS_N'] ?? 100);

const PROFILES: readonly MissionProfile[] = ['fullExplore', 'bossRush', 'mysteryHunt', 'lootRun'];

/** At-level: the difficulty each tier's own band represents, party matched to it. */
const AT_LEVEL: readonly { tier: DungeonTier; difficulty: number; level: number }[] = [
  { tier: 'tiny', difficulty: 1, level: 1 },
  { tier: 'small', difficulty: 3, level: 3 },
  { tier: 'medium', difficulty: 5, level: 5 },
  { tier: 'large', difficulty: 7, level: 7 },
];

interface CellDistribution {
  completedPct: number;
  retreatedPct: number;
  wipedPct: number;
  bossDefeatedPct: number;
  roomsVisitedAvgX10: number;
  sealedRoutesPerRunX100: number;
  ticksP50: number;
  /**
   * Runs that reported CLEARED while the boss chamber stood sealed. Must be 0
   * for `fullExplore` (brief #13 Q2). For the objective-driven profiles it is
   * legitimate — a loot run that hit its gold target got what it came for — so
   * it is RECORDED here rather than asserted, and cannot drift silently.
   */
  completedWithSealedBoss: number;
}

interface CellAudit {
  runs: number;
  /** Invariant tripwires — every one of these must stay at zero. */
  budgetRetreats: number;
  sealedCountMismatch: number;
  completedWithSealedBoss: number;
  mysteryCompletedWithoutClue: number;
  bossRushCompletedWithoutBoss: number;
  unknownOutcome: number;
}

interface Cell { dist: CellDistribution; audit: CellAudit }

const pct = (n: number, of: number): number => Math.round((n / of) * 1000) / 10;

function measureCell(profile: MissionProfile, tier: DungeonTier, difficulty: number, level: number): Cell {
  const party = () => partyAt(level, bracketProvider, 'bracket');

  let completed = 0, retreated = 0, wiped = 0, bossDefeated = 0, rooms = 0, sealed = 0;
  const audit: CellAudit = {
    runs: RUNS,
    budgetRetreats: 0,
    sealedCountMismatch: 0,
    completedWithSealedBoss: 0,
    mysteryCompletedWithoutClue: 0,
    bossRushCompletedWithoutBoss: 0,
    unknownOutcome: 0,
  };
  const ticks: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    const seed = `gvdg_${profile}_${tier}_${i}`;
    const r = runDungeonDispatch({
      dispatchId: seed,
      partyId: 'party_1',
      party: party(),
      tier,
      seed,
      profile,
      caution: 'standard',
      difficulty,
      partyLevel: level,
    });

    if (r.outcome === 'completed') completed++;
    else if (r.outcome === 'retreated') retreated++;
    else if (r.outcome === 'wiped') wiped++;
    else audit.unknownOutcome++;

    if (r.bossDefeated) bossDefeated++;
    rooms += r.roomsVisited;
    sealed += r.sealedRoutes;
    ticks.push(r.ticks);

    // ── Invariants, checked per run, reported as counts ──
    if (r.retreatReason === 'decisionBudget') audit.budgetRetreats++;
    if (r.sealedRoutes !== r.stream.byType('explore.route_blocked').length) audit.sealedCountMismatch++;
    if (r.outcome === 'completed' && r.bossRoomSealed) audit.completedWithSealedBoss++;
    if (profile === 'mysteryHunt' && r.outcome === 'completed' && !r.clueSecured) {
      audit.mysteryCompletedWithoutClue++;
    }
    if (profile === 'bossRush' && r.outcome === 'completed' && !r.bossDefeated) {
      audit.bossRushCompletedWithoutBoss++;
    }
  }

  ticks.sort((a, b) => a - b);
  return {
    dist: {
      completedPct: pct(completed, RUNS),
      retreatedPct: pct(retreated, RUNS),
      wipedPct: pct(wiped, RUNS),
      bossDefeatedPct: pct(bossDefeated, RUNS),
      roomsVisitedAvgX10: Math.round((rooms / RUNS) * 10),
      sealedRoutesPerRunX100: Math.round((sealed / RUNS) * 100),
      ticksP50: ticks[Math.floor(RUNS * 0.5)] ?? 0,
      completedWithSealedBoss: audit.completedWithSealedBoss,
    },
    audit,
  };
}

describe('dungeon distribution harness — every profile, every tier', () => {
  const grid = new Map<string, Cell>();
  for (const profile of PROFILES) {
    for (const { tier, difficulty, level } of AT_LEVEL) {
      grid.set(`${profile}/${tier}`, measureCell(profile, tier, difficulty, level));
    }
  }
  const cells = [...grid.values()];

  it('the grid is not vacuous: every cell ran and every run resolved', () => {
    expect(grid.size).toBe(PROFILES.length * AT_LEVEL.length);
    for (const c of cells) {
      expect(c.audit.runs).toBe(RUNS);
      expect(c.audit.unknownOutcome).toBe(0);
      expect(c.dist.completedPct + c.dist.retreatedPct + c.dist.wipedPct).toBeCloseTo(100, 1);
    }
  });

  /**
   * TERMINATION. The decision budget is a backstop, not a resolution path — a
   * run that hits it is a routing bug wearing a retreat's clothes.
   */
  it('TERMINATION: no run anywhere exhausts the decision budget', () => {
    const offenders = [...grid.entries()].filter(([, c]) => c.audit.budgetRetreats > 0);
    expect(offenders.map(([k, c]) => `${k}:${c.audit.budgetRetreats}`)).toEqual([]);
  });

  /**
   * Brief #13 Q2 — scoped exactly as it was APPROVED: `objectiveComplete()`
   * gained `!bossRoomSealed()` in the `fullExplore` case only. NC1 (reverting
   * that clause) makes this non-zero.
   *
   * ⚠ It is `fullExplore`-only by construction, and the harness's first run
   * found the consequence: `lootRun` still reports CLEARED with the boss
   * chamber sealed, ~1% of runs. That is defensible — a loot run completes on
   * value collected, and the party did collect it — but it is the same SHAPE as
   * the lie brief #13 fixed, so it is recorded in the snapshot above and
   * flagged for Steven rather than quietly asserted away.
   */
  it('a sealed boss chamber is never a cleared FULL EXPLORE (brief #13 Q2)', () => {
    const lies = [...grid.entries()]
      .filter(([key]) => key.startsWith('fullExplore/'))
      .filter(([, c]) => c.audit.completedWithSealedBoss > 0);
    expect(lies.map(([k, c]) => `${k}:${c.audit.completedWithSealedBoss}`)).toEqual([]);
  });

  /** `bossRush` cannot complete past a sealed boss door — structurally, not by policy. */
  it('bossRush never completes with the boss chamber sealed', () => {
    for (const { tier } of AT_LEVEL) {
      const cell = grid.get(`bossRush/${tier}`)!;
      expect({ tier, lies: cell.audit.completedWithSealedBoss }).toEqual({ tier, lies: 0 });
    }
  });

  it('the reported sealed-route count always equals what the stream recorded', () => {
    for (const c of cells) expect(c.audit.sealedCountMismatch).toBe(0);
  });

  /** The objectives mean what they say — the clue-swallowing bug's permanent cover. */
  it('OBJECTIVE HONESTY: a completed mysteryHunt holds the clue; a completed bossRush killed the boss', () => {
    for (const c of cells) {
      expect(c.audit.mysteryCompletedWithoutClue).toBe(0);
      expect(c.audit.bossRushCompletedWithoutBoss).toBe(0);
    }
  });

  /**
   * Wall 2 arrives with DIFFICULTY, not with size (brief #14 §3): the party's
   * own level is a term in `hazardDc`, so sealed routes climb as the band does.
   * NC2 (`difficultyDcScale` 2 -> 3) inflates the right-hand side of this.
   */
  it('sealed routes climb with the difficulty band, and the entry dungeon has almost none', () => {
    const tiny = grid.get('fullExplore/tiny')!;
    const large = grid.get('fullExplore/large')!;
    expect(tiny.dist.sealedRoutesPerRunX100).toBeLessThan(50); // < 0.5 per run
    expect(large.dist.sealedRoutesPerRunX100).toBeGreaterThan(tiny.dist.sealedRoutesPerRunX100);
  });

  /**
   * `bossRush` beelines and `fullExplore` sweeps — a profile engine that stopped
   * distinguishing them would still pass every behavioural test in
   * tests/dungeon/dispatch.test.ts, which compares single seeded runs.
   */
  it('the profiles remain distinguishable: bossRush visits fewer rooms than fullExplore', () => {
    for (const { tier } of AT_LEVEL) {
      const rush = grid.get(`bossRush/${tier}`)!;
      const full = grid.get(`fullExplore/${tier}`)!;
      expect({ tier, beelines: rush.dist.roomsVisitedAvgX10 < full.dist.roomsVisitedAvgX10 })
        .toEqual({ tier, beelines: true });
    }
  });

  it('THE BASELINE: exact distribution snapshot — drift must justify itself', () => {
    const snapshot: Record<string, CellDistribution> = {};
    for (const [key, cell] of grid) snapshot[key] = cell.dist;
    expect({ runsPerCell: RUNS, grid: snapshot }).toMatchSnapshot();
  });
});
