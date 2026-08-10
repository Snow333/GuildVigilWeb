/**
 * Dice primitives + PF2E degree-of-success engine.
 * Ported from combat_dice.gd; the RNG is injected (string-seeded, constraint 5).
 * MAP's per-turn strike counter becomes flurry decay (continuous-time translation).
 */

import { FLURRY } from '@content/combat';
import type { Rng } from '@sim/core/rng';
import type { Degree } from '@sim/core/events/types';

/** Parse + roll composite dice strings: "1d8+3", "2d6+1d4+2". Floor 0. */
export function rollDice(rng: Rng, diceStr: string): number {
  if (!diceStr) return 0;
  let total = 0;
  for (const part of diceStr.replace(/\s/g, '').split('+')) {
    if (part.includes('d')) {
      const [countStr, sidesStr] = part.split('d');
      const count = countStr ? Number(countStr) : 1;
      const sides = Number(sidesStr);
      for (let i = 0; i < count; i++) total += rng.die(sides);
    } else {
      total += Number(part) || 0;
    }
  }
  return Math.max(total, 0);
}

/** Count total dice in a dice string ("1d10+1d4" → 2). Floor 1. */
export function countDice(diceStr: string): number {
  let count = 0;
  for (const part of diceStr.replace(/\s/g, '').replace(/-/g, '+-').split('+')) {
    if (part.includes('d')) {
      const n = part.split('d')[0];
      count += n && n.length > 0 ? Math.max(Number(n), 1) : 1;
    }
  }
  return Math.max(count, 1);
}

/** Base degree, before nat-step: crit at DC+10, hit at DC, else miss. */
function baseDegree(total: number, dc: number): Degree {
  if (total >= dc + 10) return 'critSuccess';
  if (total >= dc) return 'success';
  return 'failure';
}

const STEP_BETTER: Record<Degree, Degree> = {
  critFailure: 'failure', failure: 'success', success: 'critSuccess', critSuccess: 'critSuccess',
};
const STEP_WORSE: Record<Degree, Degree> = {
  critSuccess: 'success', success: 'failure', failure: 'critFailure', critFailure: 'critFailure',
};

/**
 * PF2E degree with nat 20/1 STEPPING the result — a nat 20 against an
 * unreachable AC is only a hit; a nat 1 on an easy target is only a miss.
 * Returns the degree plus the step applied (the event schema's natStep field).
 */
export function determineDegree(total: number, dc: number, d20: number): { degree: Degree; natStep: -1 | 0 | 1 } {
  let degree = baseDegree(total, dc);
  let natStep: -1 | 0 | 1 = 0;
  if (d20 === 20) {
    degree = STEP_BETTER[degree];
    natStep = 1;
  } else if (d20 === 1) {
    degree = STEP_WORSE[degree];
    natStep = -1;
  }
  return { degree, natStep };
}

/** Flat d20 vs DC (traps, persistent damage). Crit fail at nat 1 or DC−10. */
export function rollFlatCheck(rng: Rng, dc: number): { roll: number; dc: number; success: boolean; degree: Degree } {
  const d20 = rng.die(20);
  let degree: Degree;
  if (d20 >= dc + 10) degree = 'critSuccess';
  else if (d20 >= dc) degree = 'success';
  else if (d20 === 1 || d20 <= dc - 10) degree = 'critFailure';
  else degree = 'failure';
  return { roll: d20, dc, success: degree === 'success' || degree === 'critSuccess', degree };
}

// ── Flurry decay: the continuous-time MAP ────────────────────────────────────

/** Penalty for the Nth consecutive swing (0-indexed swing count BEFORE this one). */
export function flurryPenalty(recentSwings: number, agile: boolean): number {
  const table = agile ? FLURRY.penaltiesAgile : FLURRY.penalties;
  const idx = Math.min(Math.max(recentSwings, 0), table.length - 1);
  return table[idx] as number;
}

/** Decay the swing counter: −1 step per decayTicks elapsed since the last swing. */
export function decayFlurry(swings: number, ticksSinceLastSwing: number): number {
  const steps = Math.floor(ticksSinceLastSwing / FLURRY.decayTicks);
  return Math.max(swings - steps, 0);
}
