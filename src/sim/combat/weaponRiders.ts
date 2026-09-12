/**
 * WEAPON RIDERS — the magic on a magic weapon (brief #24 M1).
 *
 * ⚠ THIS WAS THE LARGEST BLOCK OF DEAD CONTENT IN THE GAME. 33 item properties
 * are authored with `on_hit_effect` / `on_crit_effect` JSON — flaming, frost,
 * shock, wounding, venom, lifedrinker — and `deriveItem()` parsed every one of
 * them into `DerivedItem.onHitEffects`, where NOTHING read it. Measured before
 * building this: a Flaming Longsword +1 driven through a real encounter emitted
 * only `weapon` damage. No fire, ever. 63 magic-tier items differed from their
 * mundane bases by price and potency alone.
 *
 * ── THE ONE RULE THAT MATTERS ─────────────────────────────────────────────
 *
 * ⚠ A RIDER EMITS ITS OWN DAMAGE EVENT. It is NOT folded into the weapon total.
 * Three reasons, and all three are load-bearing:
 *
 *   1. RESISTANCES (M4) must see the damage TYPE. Fire resistance cannot
 *      subtract from a lump labelled `weapon`.
 *   2. THE RECORD must be able to say "and 4 fire" — brief #24's colour pass
 *      gives magic its own channel, which needs a separate line to colour.
 *   3. INVISIBILITY IS HOW THIS DIED THE FIRST TIME. A rider folded into a
 *      total cannot be seen, so nobody notices when it stops working. A
 *      separate event is self-auditing: if the log shows no fire line, the
 *      rider did not fire.
 *
 * Pattern deliberately mirrors `applyStrikeRider` in abilities.ts (brief #22),
 * which does the same job for feat-granted riders. Same shape, different
 * source — a reader who knows one knows the other.
 */

import type { Combatant } from './types';
import type { DerivedItem } from '@sim/heroes/equipment';
import type { Rng } from '@sim/core/rng';
import { rollDice } from './dice';

/** One rider's contribution, ready to be emitted as its own event. */
export interface RiderDamage {
  /** The property that produced it — `flaming`, `wounding`. Named in the log. */
  propertyId: string;
  amount: number;
  /** `fire`, `cold`, `bleed` — never `weapon`. See the module note. */
  damageType: string;
}

export interface RiderCondition {
  propertyId: string;
  conditionId: string;
  value: number;
  durationRounds: number;
}

export interface RiderResult {
  damage: RiderDamage[];
  conditions: RiderCondition[];
  /** Lifesteal, as a percentage of damage dealt (lifedrinker). */
  healPercent: number;
}

const EMPTY: RiderResult = { damage: [], conditions: [], healPercent: 0 };

/** Effect JSON, as authored. Every field optional — shapes vary by property. */
interface EffectJson {
  damage_dice?: string;
  damage_type?: string;
  condition?: string;
  value?: number;
  duration_rounds?: number;
  effect?: string;
  value_percent?: number;
  target_filter?: string;
}

/**
 * Does this rider apply to this target?
 *
 * ⚠ `holy` and `disrupting` carry `target_filter: "undead"`. Applying them to
 * everything would make two of the seven damage riders strictly better than
 * the rest, and silently contradict their own authored text.
 *
 * Creature type is not modelled yet, so the ONLY honest answer for a filtered
 * rider is "do not fire". Returning true would be inventing a match.
 */
function passesFilter(effect: EffectJson, _target: Combatant): boolean {
  return effect.target_filter === undefined;
}

/**
 * Collect every rider on a hit.
 *
 * `critical` selects `on_crit_effect` over `on_hit_effect` — the authored
 * content treats them as alternatives, not cumulative, so a crit does NOT
 * stack both.
 */
export function resolveWeaponRiders(
  weapon: DerivedItem | null,
  target: Combatant,
  critical: boolean,
  rng: Rng,
): RiderResult {
  if (!weapon || weapon.onHitEffects.length === 0) return EMPTY;

  const damage: RiderDamage[] = [];
  const conditions: RiderCondition[] = [];
  let healPercent = 0;

  for (const entry of weapon.onHitEffects) {
    const effect = (critical ? entry.onCrit : entry.onHit) as EffectJson | null;
    if (!effect || !passesFilter(effect, target)) continue;

    if (effect.damage_dice) {
      damage.push({
        propertyId: entry.propertyId,
        amount: rollDice(rng, effect.damage_dice),
        // ⚠ Falls back to the property id, never to 'weapon' — an untyped
        // rider folded into weapon damage is the exact bug this module exists
        // to prevent, and it would defeat resistances later.
        damageType: effect.damage_type ?? entry.propertyId,
      });
    }

    if (effect.condition) {
      conditions.push({
        propertyId: entry.propertyId,
        conditionId: effect.condition,
        value: effect.value ?? 1,
        durationRounds: effect.duration_rounds ?? 1,
      });
    }

    if (effect.effect === 'lifesteal') {
      healPercent += effect.value_percent ?? 0;
    }
  }

  return { damage, conditions, healPercent };
}

/** Total rider damage — for lifesteal, which is a share of what was dealt. */
export function totalRiderDamage(result: RiderResult): number {
  return result.damage.reduce((sum, d) => sum + d.amount, 0);
}
