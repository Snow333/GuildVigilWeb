/**
 * THE THIRD LIMITER TIER — once per long rest (brief #31 D2).
 *
 * ⚠ THREE DISTINCT SYSTEMS, AND THIS IS THE ONE THAT OUTLIVES THE FIGHT.
 * `output/reference/characters.md` states the rule and it is why this file
 * exists at all:
 *
 *   cooldown in ticks   -> `Combatant.abilityReadyAt`  dies with the encounter
 *   once per combat     -> `Combatant.abilityUses`     dies with the encounter
 *   once per LONG REST  -> HERE, on `HeroState`        survives the encounter
 *
 * The first two needed no save migration precisely because a `Combatant` is
 * rebuilt from the sheet on every dispatch. This tier cannot borrow that: a
 * hero who spent Miraculous Spell in room 2 must still have spent it in room 7,
 * and must have it back next expedition. So the state belongs to the SHEET.
 *
 * ⚠ DO NOT COLLAPSE THE TIERS. Re-tiering a long-rest ability to once-per-combat
 * is not bookkeeping, it is a large balance change — the difference between one
 * emergency heal per expedition and one per fight.
 *
 * ⚠ THE LIMITED SET IS DERIVED FROM CONTENT, NEVER HARDCODED. Ten authored feats
 * already express this limit in their payloads, in two different shapes
 * (`condition: "per_rest"` and `per_rest: N`). Reading both is what lets a new
 * seed row join the tier with no code change — the same discipline as the slot
 * schedule in `feats.ts`.
 */

import { featEffectsById } from './featEffects';
import type { HeroState } from './types';

/**
 * How many uses per long rest this feat allows, or 0 when it is not
 * long-rest limited.
 *
 * ⚠ TWO AUTHORED SHAPES, BOTH REAL — checked against the generated rows:
 *   `{"condition": "per_rest", "value": 1}`  — #140, #96, #113, #119, #91
 *   `{"per_rest": 1}`                        — #153, #103, #130
 * A row carrying `condition: per_rest` with no `value` means one use; that is
 * the PF2E default and matches every authored instance.
 */
export function longRestAllowance(featId: number): number {
  const fx = featEffectsById.get(featId);
  if (!fx) return 0;
  const raw = fx.raw;

  const perRest = raw['per_rest'];
  if (typeof perRest === 'number' && perRest > 0) return perRest;

  if (raw['condition'] === 'per_rest') {
    const value = raw['value'];
    return typeof value === 'number' && value > 0 ? value : 1;
  }
  return 0;
}

/** Is this feat rationed per long rest at all? */
export function isLongRestLimited(featId: number): boolean {
  return longRestAllowance(featId) > 0;
}

/** Every authored feat in the tier, ascending. Diagnostics and tests. */
export function longRestLimitedFeatIds(): number[] {
  return [...featEffectsById.keys()].filter(isLongRestLimited).sort((a, b) => a - b);
}

/**
 * Uses already spent since this hero's last long rest.
 *
 * ⚠ ABSENT MAP MEANS FULLY RESTED, and that is deliberate: it makes every save
 * written before this tier existed load as a rested party rather than as a
 * party with unknown charges. The backfill normalises the shape; it never has
 * to invent a number.
 */
export function longRestUsesSpent(hero: HeroState, featId: number): number {
  return hero.longRestUses?.[featId] ?? 0;
}

/** Uses remaining before the next long rest. 0 for a feat not in the tier. */
export function longRestUsesLeft(hero: HeroState, featId: number): number {
  const allowance = longRestAllowance(featId);
  if (allowance === 0) return 0;
  return Math.max(0, allowance - longRestUsesSpent(hero, featId));
}

/**
 * May this hero use this ability right now, as far as THIS tier is concerned?
 *
 * ⚠ ONLY ANSWERS THE LONG-REST QUESTION. A caller must still check the hero
 * actually holds the feat, and the combat tiers still apply on top — the three
 * limiters compose, they do not replace each other.
 */
export function canSpendLongRestUse(hero: HeroState, featId: number): boolean {
  return longRestUsesLeft(hero, featId) > 0;
}

/**
 * Spend one use. Returns false and changes NOTHING when the ability is already
 * exhausted or is not in the tier.
 *
 * ⚠ REFUSES RATHER THAN OVERSPENDING. A silent overspend here would hand a
 * player a second Miraculous Spell and no test would see it, because the
 * ability's own effect would fire normally.
 */
export function spendLongRestUse(hero: HeroState, featId: number): boolean {
  if (!canSpendLongRestUse(hero, featId)) return false;
  hero.longRestUses ??= {};
  hero.longRestUses[featId] = longRestUsesSpent(hero, featId) + 1;
  return true;
}

/**
 * TAKE A LONG REST — restore every charge on this hero. Returns whether
 * anything actually changed, so a caller can avoid a pointless save write.
 *
 * ⚠ THE BOUNDARY IS THE DISPATCH, NOT THE DUNGEON ROOM. The in-dungeon rest
 * already exists and already declares itself SHORT — `dungeon/dispatch.ts`
 * emits `explore.rested` with `package: 'short'`, heals a fraction of max HP,
 * and is rationed by `PROFILES.roomsPerRestCharge`. Letting that path refresh
 * long-rest charges would erase the distinction the tier is for. The party
 * takes its long rest back at the Haven, between expeditions — the same moment
 * `launchDispatch` clears the wounded ratchet.
 */
export function takeLongRest(hero: HeroState): boolean {
  if (!hero.longRestUses) return false;
  if (Object.keys(hero.longRestUses).length === 0) return false;
  hero.longRestUses = {};
  return true;
}

/** Long-rest the whole party. Returns how many heroes had charges to restore. */
export function takeLongRestParty(heroes: readonly HeroState[]): number {
  let restored = 0;
  for (const hero of heroes) if (takeLongRest(hero)) restored++;
  return restored;
}
