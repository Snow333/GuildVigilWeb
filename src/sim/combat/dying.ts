/**
 * Dying/wounded/KO cascade — ported from dying_processor.gd.
 * The anti-death-spiral subsystem: recovery DC hardens each step, waking
 * ratchets wounded permanently, death at dying ≥ 4. Recovery checks fire on
 * a timer in continuous time (DYING.recoveryIntervalTicks) instead of per-round.
 *
 * FIXED, not re-inherited (decision-ledger Area 2): healing a dying hero ADDS
 * to 0 HP (heal-based wake sets hp to the healed amount via healDying) — the
 * Godot cast_action bug where healing SET hp to the heal amount in all cases
 * does not carry over.
 */

import { DYING } from '@content/combat';
import type { Rng } from '@sim/core/rng';
import type { RollBreakdown } from '@sim/core/events/types';
import {
  applyCondition, conditionValue, hasCondition, removeCondition, setConditionValue,
} from './conditions';
import type { Combatant } from './types';

export interface DyingCheckResult {
  roll: RollBreakdown;
  dyingAfter: number;
  died: boolean;
  wokeUp: boolean;
}

/** Hero hits 0 HP: unconscious + dying at 1 + wounded (the ratchet's teeth). */
export function knockOut(unit: Combatant): number {
  unit.hp = 0;
  applyCondition(unit, 'unconscious');
  const dyingStart = 1 + unit.wounded;
  applyCondition(unit, 'dying', dyingStart);
  return dyingStart;
}

/** Shared wake-up: clear dying/unconscious, 1 HP, wounded ratchets up. */
function wake(unit: Combatant): void {
  removeCondition(unit, 'dying');
  removeCondition(unit, 'unconscious');
  unit.hp = 1;
  unit.wounded += 1;
  applyCondition(unit, 'wounded', unit.wounded);
}

/**
 * Timed recovery check. DC = 10 + dying value:
 * crit success → wake at 1 HP · success → dying −1 (to 0 → wake) ·
 * fail → +1 · crit fail (nat 1 or ≤ DC−10) → +2 · death at ≥ 4.
 */
export function resolveDyingRecovery(unit: Combatant, rng: Rng): DyingCheckResult {
  const dyingVal = conditionValue(unit, 'dying');
  const dc = DYING.baseRecoveryDc + dyingVal;
  const d20 = rng.die(20);

  let degree: RollBreakdown['degree'];
  if (d20 >= dc + 10) degree = 'critSuccess';
  else if (d20 >= dc) degree = 'success';
  else if (d20 === 1 || d20 <= dc - 10) degree = 'critFailure';
  else degree = 'failure';

  const roll: RollBreakdown = { d20, modifier: 0, total: d20, dc, degree, natStep: 0 };
  const result: DyingCheckResult = { roll, dyingAfter: dyingVal, died: false, wokeUp: false };

  if (degree === 'critSuccess') {
    wake(unit);
    result.dyingAfter = 0;
    result.wokeUp = true;
  } else if (degree === 'success') {
    const newVal = dyingVal - 1;
    if (newVal <= 0) {
      wake(unit);
      result.dyingAfter = 0;
      result.wokeUp = true;
    } else {
      setConditionValue(unit, 'dying', newVal);
      result.dyingAfter = newVal;
    }
  } else {
    const newVal = dyingVal + (degree === 'critFailure' ? 2 : 1);
    setConditionValue(unit, 'dying', newVal);
    result.dyingAfter = newVal;
    if (newVal >= DYING.deathAt) result.died = true;
  }
  return result;
}

/** Any hit on a downed hero pushes dying +1. Returns new value (death checked by caller loop). */
export function damageWhileDying(unit: Combatant): number {
  if (!hasCondition(unit, 'dying')) return 0;
  const newVal = conditionValue(unit, 'dying') + 1;
  setConditionValue(unit, 'dying', newVal);
  return newVal;
}

/** Healing a dying hero: wake without the ratchet-free crit path — hp = heal amount, wounded still ratchets. */
export function healDying(unit: Combatant, healAmount: number): void {
  if (!hasCondition(unit, 'dying') || healAmount <= 0) return;
  removeCondition(unit, 'dying');
  removeCondition(unit, 'unconscious');
  unit.hp = Math.min(healAmount, unit.maxHp); // ADDS to 0, i.e. sets to heal amount from zero — bounded by max
  unit.wounded += 1;
  applyCondition(unit, 'wounded', unit.wounded);
}
