/**
 * WEAPON & ARMOUR PROFICIENCY — what a class is trained to hold (brief #23).
 *
 * ⚠ THE MECHANISM WAS ALREADY BUILT AND IDLE. Before this module:
 *
 *   - `NON_PROFICIENCY_PENALTY = -4` sat in `content/combat.ts`, referenced by
 *     NOTHING.
 *   - `Combatant.weaponPenalty` was summed into every attack roll in
 *     `strike.ts` and was ALWAYS `0`, with a type comment already reading
 *     "0, or NON_PROFICIENCY_PENALTY when wielding unproficiently".
 *   - `assembly.ts` hardcoded `isWeaponProficient: true` for every hero.
 *   - `class_weapon_proficiency` held 44 authored rows read by nothing.
 *
 * So Elandra the wizard could wear Full Plate, swing a greatsword, and be
 * fully proficient with it. This module is the missing derivation, not a new
 * system — which is why M1 needed no content authoring at all.
 *
 * ⚠ CLAUDE.md called `class_weapon_proficiency` "still-dead content" and that
 * UNDERSELLS it: it is a working two-shape grant system.
 *
 *     grant_type 'category' + grant_value 'simple'|'martial'  -> a whole class
 *     grant_type 'weapon'   + grant_value 'rapier'|'staff'    -> one weapon
 *     grant_type 'armor'    + grant_value 'light'|'medium'|.. -> a band (#23 M2)
 *
 * Measured coverage of the 62 weapon rows: Fighter 62, Rogue 26, Cleric 23,
 * **Wizard 7**. That spread IS the class identity; nothing was invented here.
 */

import { class_weapon_proficiency, items } from '@content/generated';
import type { HeroState } from './types';

type ItemRow = (typeof items)[number];

/** Armour bands, coarsest-to-heaviest. `robes` is unarmoured and free to all. */
export type ArmorBand = 'unarmored' | 'light' | 'medium' | 'heavy' | 'shield';

/**
 * ⚠ SUBTYPE -> BAND IS THE ONE PLACE ARMOUR CLASSIFICATION LIVES.
 * The catalogue's `item_subtype` values, mapped once. A subtype missing from
 * this table is treated as `light` rather than throwing: an unknown armour is
 * a content addition, not a crash, and defaulting to the PERMISSIVE band means
 * new content is never silently unusable by everyone.
 */
const SUBTYPE_BAND: Record<string, ArmorBand> = {
  robes: 'unarmored',
  padded: 'light',
  leather: 'light',
  studded: 'light',
  chain_shirt: 'medium',
  chain_mail: 'medium',
  scale_mail: 'medium',
  half_plate: 'heavy',
  full_plate: 'heavy',
  heavy: 'heavy',
};

export function armorBandOf(base: Pick<ItemRow, 'item_type' | 'item_subtype'>): ArmorBand | null {
  if (base.item_type === 'shield') return 'shield';
  if (base.item_type !== 'armor') return null;
  const subtype = (base.item_subtype as string | null) ?? '';
  return SUBTYPE_BAND[subtype] ?? 'light';
}

/**
 * ⚠ THE FRAGILE JOIN: grant values are slugs, item names are prose.
 *
 * `grant_value` is `light_crossbow`; the item is `Light Crossbow`. Worse, the
 * catalogue holds `Masterwork Longsword` and `Longsword +1`, both of which
 * must match the plain `longsword` grant — otherwise buying an upgrade would
 * silently cost a hero their proficiency, which is the most confusing possible
 * bug. Normalise: lowercase -> drop a leading "Masterwork " -> drop a trailing
 * " +N" -> spaces to underscores.
 *
 * `tests/heroes/proficiency-gear.test.ts` asserts EVERY `grant_value` in the
 * table matches at least one real item, so a typo on either side fails the
 * build instead of quietly disarming a class.
 */
export function weaponSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/^masterwork\s+/, '')
    .replace(/\s*\+\d+$/, '')
    .trim()
    .replace(/\s+/g, '_');
}

interface ClassGrants {
  categories: Set<string>;
  weapons: Set<string>;
  armor: Set<ArmorBand>;
}

const grantsByClass: Map<number, ClassGrants> = (() => {
  const m = new Map<number, ClassGrants>();
  for (const row of class_weapon_proficiency) {
    const classId = row.class_id as number;
    let g = m.get(classId);
    if (!g) {
      g = { categories: new Set(), weapons: new Set(), armor: new Set() };
      m.set(classId, g);
    }
    const value = String(row.grant_value);
    if (row.grant_type === 'category') g.categories.add(value);
    else if (row.grant_type === 'weapon') g.weapons.add(value);
    else if (row.grant_type === 'armor') g.armor.add(value as ArmorBand);
  }
  return m;
})();

export function grantsFor(classId: number): ClassGrants | undefined {
  return grantsByClass.get(classId);
}

/**
 * Is this hero trained with this weapon?
 *
 * ⚠ MULTICLASS KEEPS THE HIGHEST, never the intersection — mirroring
 * `bestTier()` in `proficiency.ts`. A Fighter 1 / Wizard 4 is proficient with
 * martial weapons: you do not FORGET how to hold a sword by studying magic.
 */
export function isProficientWithWeapon(hero: Pick<HeroState, 'classLevels'>, base: ItemRow): boolean {
  if (base.item_type !== 'weapon') return true; // not a weapon: nothing to be unskilled at
  const category = (base.weapon_category as string | null) ?? '';
  const slug = weaponSlug(base.name as string);
  for (const cl of hero.classLevels) {
    const g = grantsByClass.get(cl.classId);
    if (!g) continue;
    if (g.categories.has(category)) return true;
    if (g.weapons.has(slug)) return true;
  }
  return false;
}

/**
 * Is this hero trained in this armour (or shield)?
 *
 * ⚠ Unarmoured is ALWAYS proficient — robes are clothes. And a class with NO
 * authored armour grants is treated as proficient with everything, so that the
 * nine non-founding classes are not silently crippled if their rows are ever
 * dropped. Absence of data means "no opinion", never "forbidden".
 */
export function isProficientWithArmor(hero: Pick<HeroState, 'classLevels'>, base: ItemRow): boolean {
  const band = armorBandOf(base);
  if (band === null || band === 'unarmored') return true;
  let anyClassHasArmorGrants = false;
  for (const cl of hero.classLevels) {
    const g = grantsByClass.get(cl.classId);
    if (!g || g.armor.size === 0) continue;
    anyClassHasArmorGrants = true;
    if (g.armor.has(band)) return true;
  }
  return !anyClassHasArmorGrants;
}

export interface ProficiencyVerdict {
  proficient: boolean;
  /** Player-facing cause, empty when proficient. */
  reason: string;
}

/** One verdict for any equippable, for the UI's label and the sim's penalty. */
export function proficiencyFor(hero: Pick<HeroState, 'classLevels'>, base: ItemRow): ProficiencyVerdict {
  if (base.item_type === 'weapon') {
    const ok = isProficientWithWeapon(hero, base);
    return { proficient: ok, reason: ok ? '' : 'not trained with this weapon' };
  }
  if (base.item_type === 'armor' || base.item_type === 'shield') {
    const ok = isProficientWithArmor(hero, base);
    const band = armorBandOf(base);
    return { proficient: ok, reason: ok ? '' : `not trained in ${band} armour` };
  }
  return { proficient: true, reason: '' };
}
