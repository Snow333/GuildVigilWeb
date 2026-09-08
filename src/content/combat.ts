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
 *
 * ⚠⚠ THE FIGURES BELOW ARE DEAD AND THE KNOB IS SPENT — CORRECTED 2026-09-02
 * (brief #20 §11.1, Steven's decision §12 Q7). This comment used to promise the
 * re-tune a "sharp cheap knob" on surface fights and print this table:
 *
 *     separation 10  →  96.0% completed / 4.0% wiped
 *     separation 12  →  99.8% / 0.2%
 *
 * DO NOT QUOTE THOSE NUMBERS. The step moved from between sep 10–12 down to
 * between **4–6** when brief #19's commit 2 landed, and everything from 6 up
 * now reads **100%** surface completion. Separation 14 is therefore not a knob
 * at all any more — it is saturated, and turning it down to 12 or 10 would move
 * nothing until it drops below 6.
 *
 * The mechanism was and remains arithmetic: the enemy closes at `speed` 5
 * units/s, so a long-enough walk outlasts one 20-tick `attackIntervalTicks` and
 * the party's casters land a SECOND free cantrip volley before contact. The
 * at-level DUNGEON curve is nearly flat across every separation (all cells
 * inside the ±8-point bar) because a dungeon is attritional and a surface quest
 * is one encounter — which is why this only ever showed up on the surface.
 *
 * ⚠ Steven chose 14 (proportional) 2026-08-13 knowing it takes surface quests
 * to saturation, and surface difficulty is on the re-tune list with levels, mob
 * counts and statblocks. This is a consequence the pass CREATED, not one it
 * found — do not let the re-tune inherit it silently, and do not "discover" it
 * again.
 *
 * ⚠ AND: `career-distribution` cannot measure any of this today — it reads
 * completionRate 1.0 with every assertion a one-sided floor, so nothing fires.
 * A green run there is worth NOTHING as evidence about the surface loop.
 */
export const ARENA = { width: 20, height: 20, sideAx: 3, sideBx: 17 } as const;

/**
 * Creature size → body radius in world units, brief #20.
 *
 * The CONTENT says `'large'`; the radius is derived here, so this is the single
 * tuning knob for the whole feature and it lives beside ARENA with the other
 * translation constants.
 *
 * ⚠ CONVENTION B, MEASURED: the excess over Medium, not the absolute footprint.
 * PF2E puts Small AND Medium in one 5-ft square, so Medium is 0 and only Large+
 * moves anything. Medium-vs-Medium is therefore bit-identical to pre-#20 main —
 * verified by stream hash, not assumed (creature-size-findings.md §2).
 *
 * ⚠ Doubling these is the costing's S2 arm (Large 1.0, Huge 2.0) and it also
 * measured free. If you double them, re-read findings §6 first: HUGE HAS NEVER
 * BEEN EXERCISED by any probe, because its only row (Adult Red Dragon, L12)
 * cannot spawn at d1–d5.
 */
export const SIZE_RADIUS: Readonly<Record<string, number>> = {
  medium: 0,
  large: 0.5,
  huge: 1.0,
} as const;
