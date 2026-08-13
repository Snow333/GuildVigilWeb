/**
 * Strike resolution — ported from combat_strike_resolver.gd.
 * Preserved feel decisions: hero +2 melee engagement bonus (enemies never),
 * min 1 damage on any hit, sneak attack only vs flat-footed, weapon spec
 * gated on proficiency, crit doubles the whole package.
 */

import { ENGAGEMENT_RANGE, MELEE_ENGAGEMENT_BONUS } from '@content/combat';
import type { Rng } from '@sim/core/rng';
import type { RollBreakdown } from '@sim/core/events/types';
import { acMod, attackMod, damageMod, isFlanked, isFlatFooted, unarmedOverride } from './conditions';
import { determineDegree, rollDice } from './dice';
import type { Combatant } from './types';

export interface StrikeResult {
  roll: RollBreakdown;
  flurryPenalty: number;
  meleeBonus: number;
  flanked: boolean;
  isSneakAttack: boolean;
  baseDamage: number;
  sneakDamage: number;
  conditionDamageMod: number;
  /** Final damage; 0 on a miss, min 1 on any hit. */
  damage: number;
}

export interface StrikeContext {
  rng: Rng;
  /** Negative value from flurryPenalty(). */
  flurryPenalty: number;
  /** Temporary AC from reactions (Nimble Dodge +2). */
  reactionAcBonus?: number;
  /** All combatants (flanking geometry). */
  all: readonly Combatant[];
  /**
   * Result of THIS ACTION's conceal check, from `rollConceal` — rolled ONCE
   * per action by the encounter loop and passed down to every swing in the
   * burst. PF2E: you Hide, then you Strike; rolling per swing would double it.
   */
  concealed?: boolean;
}

/** A conceal check that was actually rolled (null = not applicable, see `rollConceal`). */
export interface ConcealResult {
  attackerTotal: number;
  defenderTotal: number;
  /** Which of the defender's two skills won the `max` — for the record, and for tests. */
  defenderUsed: 'stealth' | 'perception';
  passed: boolean;
}

/**
 * THE CONCEAL CHECK (brief #19 §14.2), Steven's own spec:
 *
 *     attacker  = d20 + stealthTotal
 *     defender  = d20 + max(stealthTotal, perceptionTotal)
 *     attacker wins ties → "stealthed" for this ACTION → off-guard → sneak
 *
 * ⚠ `max(stealth, perception)` IS A DELIBERATE DIVERGENCE FROM PF2E, which is
 * Stealth against a Perception DC only. Steven, 2026-08-13: *"Lets also have
 * stealth checks go against either the stealth skill or perception, whichever
 * is higher."* It means a sneaky creature is also hard to sneak up on, which is
 * coherent. Recorded here so nobody "fixes" it back.
 *
 * ⚠ MEASURED CONSEQUENCE OF THAT RULE, and it is not what §13.4 predicted. That
 * section expected the pass rate to FALL with depth (~70% at L1 → ~45% at L7)
 * because it was written against a static Perception DC. Under an opposed roll
 * where the defender may use Stealth, enemy Stealth scales with level exactly
 * as the rogue's does and the two curves track: measured against the median
 * same-level enemy, 52.5 / 47.5 / 52.5 / 57.3 / 47.5% at L1/2/3/5/7. Flat, near
 * 50%, which §12.2's sweep puts at roughly +10 at d4 and +12 at d5 — noise
 * where the party wins anyway, decisive where the fight is close. Steven's
 * call: ship it flat, bend the depth curve in the re-tune.
 *
 * Returns null when no check happens at all — which is most of the time:
 *  - the attacker has no sneak dice (no enemy in the registry does today, so
 *    this is Shade-only in practice), or
 *  - the target is ALREADY off-guard. Steven's rule: flanked means sneak
 *    applies with no check. Prone, grabbed, restrained and unconscious come
 *    along for the same reason.
 */
export function rollConceal(
  attacker: Combatant,
  defender: Combatant,
  all: readonly Combatant[],
  rng: Rng,
): ConcealResult | null {
  if (attacker.sneakAttackDice.length === 0) return null;
  if (isFlatFooted(defender, attacker, all)) return null;

  const useStealth = defender.stealth >= defender.perception;
  const defenderSkill = useStealth ? defender.stealth : defender.perception;
  const attackerTotal = rng.die(20) + attacker.stealth;
  const defenderTotal = rng.die(20) + defenderSkill;
  return {
    attackerTotal,
    defenderTotal,
    defenderUsed: useStealth ? 'stealth' : 'perception',
    passed: attackerTotal >= defenderTotal, // attacker wins ties
  };
}

export function resolveStrike(attacker: Combatant, defender: Combatant, ctx: StrikeContext): StrikeResult {
  const d20 = ctx.rng.die(20);
  const atkCondMod = attackMod(attacker);
  const acCondMod = acMod(defender);
  const meleeBonus =
    attacker.isHero && attacker.weaponRange <= ENGAGEMENT_RANGE ? MELEE_ENGAGEMENT_BONUS : 0;

  const modifier =
    attacker.attackBonus + ctx.flurryPenalty + atkCondMod + meleeBonus + attacker.weaponPenalty;
  const total = d20 + modifier;
  /**
   * A passed conceal check makes the target OFF-GUARD, which in PF2E is −2 AC
   * as well as sneak damage — brief #19 §14.2's arrow chain, and what §12.2
   * actually measured. Steven's words were "trigger sneak attack damage"; off
   * -guard is the rules-correct carrier of that and it brings the AC penalty.
   *
   * ⚠ AND THAT EXPOSES AN OLDER GAP, LOGGED NOT FIXED: FLANKING DOES NOT DO
   * THIS. `isFlatFooted` returns true when flanked, but `acMod` only reads
   * `isFlatFootedByCondition`, so being flanked grants sneak damage and no AC
   * penalty at all. Fixing it would rebalance every fight in the game for a
   * reason nobody stated, so it stays a finding for the re-tune rather than a
   * drive-by in this commit.
   */
  const concealAcPenalty = ctx.concealed === true ? -2 : 0;
  const effectiveAc = defender.ac + acCondMod + (ctx.reactionAcBonus ?? 0) + concealAcPenalty;
  const { degree, natStep } = determineDegree(total, effectiveAc, d20);

  const roll: RollBreakdown = { d20, modifier, total, dc: effectiveAc, degree, natStep };
  const hit = degree === 'success' || degree === 'critSuccess';
  const flanked = isFlanked(defender, attacker, ctx.all);

  if (!hit) {
    return {
      roll, flurryPenalty: ctx.flurryPenalty, meleeBonus, flanked,
      isSneakAttack: false, baseDamage: 0, sneakDamage: 0, conditionDamageMod: 0, damage: 0,
    };
  }

  const specBonus = attacker.isWeaponProficient ? attacker.weaponSpecBonus : 0;
  const stance = unarmedOverride(attacker);
  const dice = attacker.damageDice === 'unarmed' && stance ? stance.dice : attacker.damageDice;
  const baseDamage = rollDice(ctx.rng, dice) + specBonus;

  // Off-guard by geometry/condition (flanking, prone, grabbed, restrained,
  // unconscious) OR by winning this action's conceal check. Either one is
  // enough; the check is only ever rolled when the first is already false.
  const offGuard = isFlatFooted(defender, attacker, ctx.all) || ctx.concealed === true;
  const isSneakAttack = attacker.sneakAttackDice.length > 0 && offGuard;
  const sneakDamage = isSneakAttack ? rollDice(ctx.rng, attacker.sneakAttackDice) : 0;

  const conditionDamageMod = damageMod(attacker);
  let damage = baseDamage + conditionDamageMod + sneakDamage;
  if (degree === 'critSuccess') damage *= 2;
  damage = Math.max(damage, 1);

  return {
    roll, flurryPenalty: ctx.flurryPenalty, meleeBonus, flanked,
    isSneakAttack, baseDamage, sneakDamage, conditionDamageMod, damage,
  };
}
