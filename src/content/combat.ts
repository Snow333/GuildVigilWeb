/**
 * Combat tunables — the continuous-time translation knobs (migration-plan R2:
 * "translation knobs in data, never in code"). Distribution-harness validated.
 */

/** 100ms sim ticks (frozen in the event schema). */
export const TICKS_PER_SECOND = 10;

/** Flurry decay — the MAP translation (decision-ledger Area 2). */
export const FLURRY = {
  /** Penalty by consecutive-swing count (index 0 = first swing). */
  penalties: [0, -5, -10],
  penaltiesAgile: [0, -4, -8],
  /** Swing counter decays 1 step per this many ticks without attacking (~3s). */
  decayTicks: 30,
} as const;

/** Heroes get +2 on melee attack rolls; enemies never do (deliberate asymmetry). */
export const MELEE_ENGAGEMENT_BONUS = 2;

/** Continuous-space melee engagement radius (world units; 1 unit ≈ old grid square). */
export const ENGAGEMENT_RANGE = 1.5;

/** Flanking: two allies' direction vectors from the target dot below this → flanked. */
export const FLANK_DOT_THRESHOLD = -0.5;

/** Dying subsystem (PF2E). */
export const DYING = {
  deathAt: 4,
  baseRecoveryDc: 10,
  /** Recovery checks fire every this many ticks while dying (~3s). */
  recoveryIntervalTicks: 30,
} as const;

/** Attack penalty when wielding a weapon without proficiency. */
export const NON_PROFICIENCY_PENALTY = -4;
