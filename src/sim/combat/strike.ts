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
  const effectiveAc = defender.ac + acCondMod + (ctx.reactionAcBonus ?? 0);
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

  const flatFooted = isFlatFooted(defender, attacker, ctx.all);
  const isSneakAttack = attacker.sneakAttackDice.length > 0 && flatFooted;
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
