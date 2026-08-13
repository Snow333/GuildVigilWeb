/**
 * Universal combat AI — ONE brain for both sides (decision-ledger Area 2),
 * built on the tuned additive weight stack from ai_service.gd. Deterministic:
 * ties break by target id, iteration order is stable.
 *
 * Batch B scope: target selection + positioning + strike timing. The
 * loadout-priority ability layer (spells, feats, heals) lands in Batch C on
 * top of this — chooseTarget/desiredPosition stay the substrate.
 */

import { AI_WEIGHTS, ENGAGEMENT_RANGE } from '@content/combat';
import { countDice } from './dice';
import { isFlatFooted } from './conditions';
import { dist, type Combatant, type Vec2 } from './types';

/** Deterministic average of a dice string ("2d6+3" → 10). */
export function averageDamage(diceStr: string): number {
  if (!diceStr) return 0;
  let avg = 0;
  for (const part of diceStr.replace(/\s/g, '').split('+')) {
    if (part.includes('d')) {
      const [c, s] = part.split('d');
      const count = c ? Number(c) : 1;
      avg += count * ((Number(s) + 1) / 2);
    } else {
      avg += Number(part) || 0;
    }
  }
  return avg;
}

export function scoreTarget(attacker: Combatant, target: Combatant, all: readonly Combatant[]): number {
  let score = 0;
  if (target.hp <= averageDamage(attacker.damageDice)) score += AI_WEIGHTS.killShot;
  if (isFlatFooted(target, attacker, all)) score += AI_WEIGHTS.flatFooted;
  if (target.isCaster) score += AI_WEIGHTS.spellcaster;
  score += (1 - target.hp / target.maxHp) * AI_WEIGHTS.woundedScale;
  // Distance tiebreaker keeps melee from cross-field target swapping.
  score -= dist(attacker.pos, target.pos) * 0.01;
  return score;
}

/** Highest-scoring living, not-downed enemy; deterministic tie-break by id. */
export function chooseTarget(attacker: Combatant, all: readonly Combatant[]): Combatant | null {
  const enemies = all.filter(
    (u) => u.side !== attacker.side && u.hp > 0 && !u.conditions.has('unconscious'),
  );
  if (enemies.length === 0) return null;
  let best: Combatant | null = null;
  let bestScore = -Infinity;
  for (const e of [...enemies].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const s = scoreTarget(attacker, e, all);
    if (s > bestScore) {
      best = e;
      bestScore = s;
    }
  }
  return best;
}

/**
 * Positioning keys off INTENT, not off the object in the unit's hand (brief #15
 * §10.5). `engageRange` is `max(weaponRange, default at-will spell range)`, so a
 * caster whose cantrip reaches 6 is ranged even while holding a staff.
 *
 * Reading `weaponRange` here was the actual bug: Staff and Mace carry
 * `weapon_range: null`, which defaults to 1, so the wizard and cleric were
 * classified MELEE and `desiredPosition` walked them into the front rank. The
 * `standoff` purpose fired 0 times in 1,850 moves — the entire ranged branch
 * below was dead code for the default party.
 */
const isMelee = (u: Combatant): boolean => u.engageRange <= ENGAGEMENT_RANGE;

export const inAttackRange = (u: Combatant, target: Combatant): boolean =>
  dist(u.pos, target.pos) <= Math.max(u.engageRange, ENGAGEMENT_RANGE * 0.99);

/**
 * Where this unit wants to be: melee closes to engagement; ranged holds a
 * standoff band (2..range from target), stepping AWAY when adjacent.
 */
export function desiredPosition(u: Combatant, target: Combatant): Vec2 {
  const d = dist(u.pos, target.pos);
  if (isMelee(u)) {
    // Satisfied only strictly INSIDE attack range (0.95 < inAttackRange's 0.99):
    // a deadband between "close enough to stop" and "close enough to swing"
    // parks both fighters just out of reach forever (harness finding, 2026-08-11).
    if (d <= ENGAGEMENT_RANGE * 0.95) return u.pos;
    return stepToward(u.pos, target.pos, d - ENGAGEMENT_RANGE * 0.9);
  }
  const standoffMin = 2;
  if (d < standoffMin) return stepToward(u.pos, target.pos, d - u.engageRange * 0.8); // negative = away
  if (d > u.engageRange) return stepToward(u.pos, target.pos, d - u.engageRange * 0.8);
  return u.pos;
}

/** Move from a toward b by `amount` (negative moves away). Never overshoots b. */
export function stepToward(a: Vec2, b: Vec2, amount: number): Vec2 {
  const d = dist(a, b);
  if (d === 0) return a;
  const clamped = Math.min(amount, d);
  const t = clamped / d;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Per-tick movement step magnitude. */
export function moveStep(u: Combatant, speedModValue: number, ticksPerSecond: number): number {
  return Math.max(u.speed + speedModValue, 1) / ticksPerSecond;
}

/** Kill-shot estimate exposed for tests: deterministic, parsed not rolled. */
export const estimatedDamage = (u: Combatant): number =>
  averageDamage(u.damageDice) + (countDice(u.sneakAttackDice) > 0 && u.sneakAttackDice ? 0 : 0);
