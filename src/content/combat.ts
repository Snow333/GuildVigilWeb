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

/**
 * THE COMBAT ROOM (brief #19 §9). Steven, 2026-08-13: *"Do not overcomplicate
 * it. ONE room type, 20 × 20"*, sized to hold 4v4, 6v6 and 6v8. No per-type
 * sizing, no seeded range, no authored shapes — so this stays a tunable in
 * content (migration-plan R2) rather than a field on `PopulatedRoom`.
 *
 * ⚠ THE SIZE IS A BALANCE LEVER OF THE FIRST ORDER, not set dressing. Measured
 * (brief #19 §0, n=300/cell on the curve's own seeds): a 6 × 5 corridor costs
 * 11.3 points of completion at d3, 11.0 at d4 and 12.7 at d5 against a 20 × 14
 * hall, and takes d4 wipes from 34.7% to 46.0%. The mechanism is brief #15's
 * cantrip fix — the change that met the 80% target — which depends on the
 * caster holding a 6-unit standoff, and a 6-wide room cannot contain one.
 *
 * ⚠ 20 × 20 IS ALSO WHAT MAKES THE WALLS FREE. At the old 14 × 10 the same
 * bounds cost −4.4 points at d3 and put that cell ON its contract floor
 * (§3.1); at 20 × 20 the whole pass measures −2.0 / −1.6 / −2.0 / +0.3 / −0.3,
 * every cell inside the ±8-point bar. The extra space pays for the walls.
 *
 * `sideAx`/`sideBx` keep the old box's proportions: musters sat 10 units apart
 * in a 14-wide room (71%), and sit 14 apart in a 20-wide one (70%).
 *
 * ⚠ THE MUSTER SEPARATION IS ITS OWN LEVER, IT IS SHARP, AND IT IS AIMED AT
 * SURFACE FIGHTS — brief #19 never costed it; it turned up in implementation.
 * Measured on `career-distribution` (480 records, ALL surface — that harness
 * never dispatches a dungeon):
 *
 *     separation 10  →  96.0% completed / 4.0% wiped
 *     separation 12  →  99.8% / 0.2%
 *     separation 14  →  99.8% / 0.2%      ← chosen
 *     (shipped, 14 × 10 box, separation 10:  91.3% / 8.8%)
 *
 * The step sits between 10 and 12 and the mechanism is arithmetic: the enemy
 * closes at `speed` 5 units/s, so a 12-unit walk outlasts one 20-tick
 * `attackIntervalTicks` where a 10-unit walk does not. Past that threshold the
 * party's casters land a SECOND free cantrip volley before contact, every
 * fight. The at-level DUNGEON curve is nearly flat across all three (every cell
 * inside the ±8-point bar) because a dungeon is attritional and a surface quest
 * is one encounter — which is exactly why this only shows up on the surface.
 *
 * ⚠ SO: Steven chose 14 (proportional) 2026-08-13 KNOWING it takes surface
 * quests to ~99.8% completion, and the surface difficulty goes on the re-tune
 * list with levels, mob counts and statblocks. This is a consequence the pass
 * CREATED, not one it found — do not let the re-tune inherit it silently, and
 * do not "discover" it again.
 */
export const ARENA = { width: 20, height: 20, sideAx: 3, sideBx: 17 } as const;
