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
  /**
   * Swing counter decays 1 step per this many ticks without attacking (1s).
   * Tuned so a normal attack cadence (attackIntervalTicks) fully clears the
   * burst — the penalty lives INSIDE bursts and in rapid-fire abilities, not
   * as a permanent saturation (harness finding, 2026-08-11).
   */
  decayTicks: 10,
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

/** Universal combat AI — the tuned additive weight stack from ai_service.gd. */
export const AI_WEIGHTS = {
  killShot: 200,        // target HP ≤ estimated average damage
  flatFooted: 100,
  spellcaster: 75,
  woundedScale: 50,     // × (1 − hp%)
  meleeDistancePenalty: 10, // × distance
  antiCluster: 3,       // × adjacent allies
  rangedInRange: 100,
  rangedStandoff: 50,   // at distance 2..weaponRange
  rangedAdjacent: -30,
} as const;

/** Encounter pacing (continuous time). */
export const ENCOUNTER = {
  /** Base ticks between a unit's actions (~2s). Hasted −5, slowed +10. */
  attackIntervalTicks: 20,
  /** Basic attack = a burst of swings with MAP inside the burst (0/−5, agile 0/−4). */
  swingsPerAction: 2,
  hastedIntervalDelta: -5,
  slowedIntervalDelta: 10,
  /** Movement applies per tick: speed (units/s) / TICKS_PER_SECOND. */
  /** No damage events for this many ticks → stalemate forced (soft anti-stall). */
  stalemateWindowTicks: 300,
  /** HANG guard, never the pacing mechanism (~10 min of sim time). */
  maxTicks: 6000,
  /** Initiative: total = d20 + bonus; start delay = max(0, 25 − total) ticks; heroes shave 1 (ties-to-players). */
  initiativeBase: 25,
  heroTieBreakTicks: 1,
} as const;

/** Default arena (continuous units) and line formations. Room-shaped arenas arrive in 1.4. */
export const ARENA = { width: 14, height: 10, sideAx: 2, sideBx: 12 } as const;
