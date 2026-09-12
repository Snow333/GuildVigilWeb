/**
 * GEAR PROFICIENCY — weapons and armour by class (brief #23 M1/M2).
 *
 * ⚠ EXPOSURE MATTERS MORE THAN USUAL HERE. The whole feature is a derivation
 * over content that already existed, and every piece it drives (`weaponPenalty`,
 * `isWeaponProficient`) was ALREADY being summed into the attack roll while
 * always reading zero. A wiring mistake would leave the suite green and the
 * feature dead — exactly #22's lesson. So the first assertions prove the
 * penalty reaches a real fight, not just a pure function.
 */

import { describe, expect, it } from 'vitest';
import {
  armorBandOf, grantsFor, isProficientWithArmor, isProficientWithWeapon,
  proficiencyFor, weaponSlug,
} from '@sim/heroes/gearProficiency';
import { assembleHero } from '@sim/campaign/assembly';
import { buildEnemy } from '@sim/combat/build';
import { musterParty } from '@sim/campaign/muster';
import { ancestryIds } from '@sim/registry';
import { itemBasesById } from '@sim/heroes/equipment';
import { deriveHeroIdentity } from '@sim/heroes/ancestry';
import { class_weapon_proficiency, items } from '@content/generated';
import { NON_PROFICIENCY_PENALTY } from '@content/combat';
import type { HeroKit } from '@sim/campaign/assembly';
import type { HeroState } from '@sim/heroes/types';

const FIGHTER = 1;
const WIZARD = 2;
const CLERIC = 3;
const ROGUE = 4;

// Item ids used throughout.
const GREATSWORD = 4;
const LONGSWORD = 3;
const STAFF = 16;
const DAGGER = 1;
const RAPIER = 9;
const MACE = 7;
const WARHAMMER = 8;
const LEATHER = 22;
const CHAIN_SHIRT = 24;
const FULL_PLATE = 28;
const ROBES = 30;
const MASTERWORK_LONGSWORD = 111;
const LONGSWORD_PLUS_1 = 17;
const CHAIN_MAIL_PLUS_2 = 151;

function hero(classId: number, level = 3): HeroState {
  return {
    id: 'hero_1', name: 'Testa', status: 'active', xp: 0, maxHp: 30, wounded: 0,
    abilities: { str: 14, dex: 12, con: 12, int: 12, wis: 12, cha: 10 },
    classLevels: [{ classId, level, orderTaken: 1 }],
    skills: {}, feats: [], knownSpells: [],
    ...deriveHeroIdentity('hero_1'),
  };
}

const base = (id: number) => itemBasesById.get(String(id))!;

const kitWith = (classId: number, itemIds: number[]): HeroKit => ({
  hero: hero(classId),
  equipped: itemIds.map((id) => ({ baseId: String(id), tier: 'mundane' as const, propertyIds: [], seed: `t_${id}` })),
  loadout: [],
});

describe('the authored grants are read, not invented', () => {
  it('each founding class gets the grants the table actually holds', () => {
    expect([...grantsFor(FIGHTER)!.categories].sort()).toEqual(['martial', 'simple']);
    expect(grantsFor(WIZARD)!.categories.size).toBe(0);
    expect(grantsFor(WIZARD)!.weapons.has('staff')).toBe(true);
    expect(grantsFor(CLERIC)!.categories.has('simple')).toBe(true);
    expect(grantsFor(CLERIC)!.weapons.has('warhammer')).toBe(true);
    expect(grantsFor(ROGUE)!.weapons.has('rapier')).toBe(true);
  });

  it('⚠ MEASURED COVERAGE — this spread IS the class identity', () => {
    const weapons = items.filter((i) => i.item_type === 'weapon');
    const count = (classId: number) => weapons.filter((w) => isProficientWithWeapon(hero(classId), w)).length;
    // If any of these move, content changed the shape of a class. Fighter uses
    // everything; the wizard's tiny list is the whole point of the feature.
    expect(count(FIGHTER)).toBe(62);
    expect(count(ROGUE)).toBe(26);
    expect(count(CLERIC)).toBe(23);
    expect(count(WIZARD)).toBe(7);
  });

  /**
   * ⚠ SEVEN NAMED GRANTS POINT AT WEAPONS THAT DO NOT EXIST, and that is a
   * CONTENT GAP, not a wiring bug — found by this test on its first run.
   *
   *   dart · sling · light_crossbow · hand_crossbow · unarmed · whip
   *
   * They are harmless today: a grant for a missing item is simply inert, so no
   * class LOSES anything. But they are also promises the catalogue cannot
   * keep — a wizard is "trained with darts" and no dart exists to buy. Pinned
   * as a known list rather than asserted away, so authoring any of those
   * weapons makes this test speak up instead of staying quiet.
   *
   * The CATEGORY and ARMOUR grants must always resolve, because those drive
   * whole bands and a typo there would silently disarm a class.
   */
  const KNOWN_MISSING_WEAPONS: readonly string[] = [
    'dart', 'sling', 'light_crossbow', 'hand_crossbow', 'unarmed', 'whip',
  ];

  it('⚠ category and armour grants ALWAYS resolve — a typo there disarms a class', () => {
    const categories = new Set(items.map((i) => i.weapon_category as string | null).filter(Boolean));
    const bands = new Set(['light', 'medium', 'heavy', 'shield']);
    for (const row of class_weapon_proficiency) {
      const value = String(row.grant_value);
      if (row.grant_type === 'category') {
        expect(categories.has(value), `grant "category:${value}" matches no weapon_category`).toBe(true);
      } else if (row.grant_type === 'armor') {
        expect(bands.has(value), `grant "armor:${value}" is not a known band`).toBe(true);
      }
    }
  });

  it('named weapon grants resolve, except the known-missing content list', () => {
    const slugs = new Set(items.filter((i) => i.item_type === 'weapon').map((i) => weaponSlug(i.name)));
    const unexpected: string[] = [];
    for (const row of class_weapon_proficiency) {
      if (row.grant_type !== 'weapon') continue;
      const value = String(row.grant_value);
      if (slugs.has(value) || KNOWN_MISSING_WEAPONS.includes(value)) continue;
      unexpected.push(`class ${row.class_id} -> "${value}"`);
    }
    expect(unexpected, `grants naming a weapon that does not exist: ${unexpected.join(' | ')}`).toHaveLength(0);
  });

  it('the known-missing list stays honest — authoring one of them should fail here', () => {
    const slugs = new Set(items.filter((i) => i.item_type === 'weapon').map((i) => weaponSlug(i.name)));
    const nowExist = KNOWN_MISSING_WEAPONS.filter((w) => slugs.has(w));
    expect(
      nowExist,
      `these weapons now EXIST — drop them from KNOWN_MISSING_WEAPONS: ${nowExist.join(', ')}`,
    ).toHaveLength(0);
  });
});

describe('⚠ the slug join survives the catalogue\'s real names', () => {
  it('masterwork and +N variants still match their base grant', () => {
    // The nastiest possible bug: buying an upgrade silently costs proficiency.
    expect(weaponSlug('Longsword')).toBe('longsword');
    expect(weaponSlug('Masterwork Longsword')).toBe('longsword');
    expect(weaponSlug('Longsword +1')).toBe('longsword');
    expect(weaponSlug('Light Crossbow')).toBe('light_crossbow');
  });

  it('a fighter stays proficient across the whole longsword line', () => {
    for (const id of [LONGSWORD, MASTERWORK_LONGSWORD, LONGSWORD_PLUS_1]) {
      expect(isProficientWithWeapon(hero(FIGHTER), base(id)), `item ${id}`).toBe(true);
    }
  });
});

describe('weapons by class', () => {
  it('the fighter can use anything', () => {
    for (const id of [GREATSWORD, LONGSWORD, STAFF, DAGGER, RAPIER]) {
      expect(isProficientWithWeapon(hero(FIGHTER), base(id)), `item ${id}`).toBe(true);
    }
  });

  it('⚠ the wizard cannot use a greatsword, but CAN use a staff', () => {
    expect(isProficientWithWeapon(hero(WIZARD), base(GREATSWORD))).toBe(false);
    expect(isProficientWithWeapon(hero(WIZARD), base(LONGSWORD))).toBe(false);
    expect(isProficientWithWeapon(hero(WIZARD), base(STAFF))).toBe(true);
    expect(isProficientWithWeapon(hero(WIZARD), base(DAGGER))).toBe(true);
  });

  it('the cleric gets simple plus its one named martial weapon', () => {
    expect(isProficientWithWeapon(hero(CLERIC), base(MACE))).toBe(true);      // simple
    expect(isProficientWithWeapon(hero(CLERIC), base(WARHAMMER))).toBe(true); // named
    expect(isProficientWithWeapon(hero(CLERIC), base(GREATSWORD))).toBe(false);
  });

  it('the rogue gets its named list, not all martial', () => {
    expect(isProficientWithWeapon(hero(ROGUE), base(RAPIER))).toBe(true);
    expect(isProficientWithWeapon(hero(ROGUE), base(GREATSWORD))).toBe(false);
  });

  it('⚠ multiclass keeps the HIGHEST — you do not forget how to hold a sword', () => {
    const multi = hero(WIZARD);
    multi.classLevels = [
      { classId: WIZARD, level: 4, orderTaken: 1 },
      { classId: FIGHTER, level: 1, orderTaken: 2 },
    ];
    expect(isProficientWithWeapon(multi, base(GREATSWORD))).toBe(true);
  });
});

describe('armour bands (brief #23 M2 — authored content)', () => {
  it('subtypes map to the intended bands', () => {
    expect(armorBandOf(base(ROBES))).toBe('unarmored');
    expect(armorBandOf(base(LEATHER))).toBe('light');
    expect(armorBandOf(base(CHAIN_SHIRT))).toBe('medium');
    expect(armorBandOf(base(FULL_PLATE))).toBe('heavy');
  });

  it('the four classes wear what the seed says', () => {
    expect(isProficientWithArmor(hero(FIGHTER), base(FULL_PLATE))).toBe(true);
    expect(isProficientWithArmor(hero(CLERIC), base(CHAIN_SHIRT))).toBe(true);
    expect(isProficientWithArmor(hero(CLERIC), base(FULL_PLATE))).toBe(false);
    expect(isProficientWithArmor(hero(ROGUE), base(LEATHER))).toBe(true);
    expect(isProficientWithArmor(hero(ROGUE), base(CHAIN_SHIRT))).toBe(false);
    expect(isProficientWithArmor(hero(WIZARD), base(LEATHER))).toBe(true);
    expect(isProficientWithArmor(hero(WIZARD), base(CHAIN_SHIRT))).toBe(false);
  });

  it('robes are free to everyone — they are clothes', () => {
    for (const cid of [FIGHTER, WIZARD, CLERIC, ROGUE]) {
      expect(isProficientWithArmor(hero(cid), base(ROBES)), `class ${cid}`).toBe(true);
    }
  });

  it('⚠ every class in the registry has armour grants — no silent free pass', () => {
    // gearProficiency treats "no armour grants" as proficient with everything,
    // so a class missing from the seed would be silently unrestricted.
    const withArmor = new Set(
      class_weapon_proficiency.filter((r) => r.grant_type === 'armor').map((r) => r.class_id as number),
    );
    for (let classId = 1; classId <= 13; classId++) {
      expect(withArmor.has(classId), `class ${classId} has no armour grants`).toBe(true);
    }
  });
});

/**
 * ⚠ THE EXPOSURE TESTS. Everything above tests pure functions. These prove the
 * derivation actually reaches an assembled Combatant — the step that was
 * missing for the whole project's life.
 */
describe('EXPOSURE — the penalty reaches a real assembled hero', () => {
  it('⚠ a wizard with a greatsword takes the −4, and it lands on weaponPenalty', () => {
    const c = assembleHero(kitWith(WIZARD, [GREATSWORD])).c;
    expect(c.weaponPenalty).toBe(NON_PROFICIENCY_PENALTY);
    expect(c.isWeaponProficient).toBe(false);
  });

  it('the same wizard with a staff takes nothing', () => {
    const c = assembleHero(kitWith(WIZARD, [STAFF])).c;
    expect(c.weaponPenalty).toBe(0);
    expect(c.isWeaponProficient).toBe(true);
  });

  it('a fighter with the same greatsword is unaffected', () => {
    const c = assembleHero(kitWith(FIGHTER, [GREATSWORD])).c;
    expect(c.weaponPenalty).toBe(0);
    expect(c.isWeaponProficient).toBe(true);
  });

  it('⚠ D1: unproficient armour KEEPS BASE AC, LOSES POTENCY — it is a trade', () => {
    // Chain Mail +2: base ac 5, potency 2 -> derived 7 for a trained wearer.
    const trained = assembleHero(kitWith(FIGHTER, [CHAIN_MAIL_PLUS_2])).c;
    const untrained = assembleHero(kitWith(WIZARD, [CHAIN_MAIL_PLUS_2])).c;
    // The wizard still gets the metal (base 5) but not the magic (+2).
    expect(trained.ac - untrained.ac).toBe(2);
    // ...and is NOT stripped to unarmoured — that would make it a trap.
    const naked = assembleHero(kitWith(WIZARD, [])).c;
    expect(untrained.ac).toBeGreaterThan(naked.ac);
  });

  it('⚠ D1: the armour check penalty reaches the ATTACK roll, not just Stealth', () => {
    // Full Plate carries armor_check_penalty −4.
    const wizard = assembleHero(kitWith(WIZARD, [FULL_PLATE, STAFF])).c;
    const acp = (base(FULL_PLATE).armor_check_penalty as number) ?? 0;
    expect(acp).toBeLessThan(0);
    expect(wizard.weaponPenalty).toBe(acp); // staff is proficient, so armour is the only term
  });

  it('the two penalties STACK — an off-class weapon and off-class armour are separate mistakes', () => {
    const c = assembleHero(kitWith(WIZARD, [GREATSWORD, FULL_PLATE])).c;
    const acp = (base(FULL_PLATE).armor_check_penalty as number) ?? 0;
    expect(c.weaponPenalty).toBe(NON_PROFICIENCY_PENALTY + acp);
  });

  it('enemies are never penalised — they have no class and no proficiency content', () => {
    // buildEnemy hardcodes isWeaponProficient: true by design; applying a
    // penalty they were never costed for would nerf every enemy in the game.
    // Guarded here so a future refactor cannot quietly extend the rule to them.
    const goblin = buildEnemy(1, 'e1');
    expect(goblin.isWeaponProficient).toBe(true);
    expect(goblin.weaponPenalty).toBe(0);
  });
});

/**
 * D5 — the founding muster's gear must always be class-proficient. Today's
 * templates already are; this exists so a future starting-kit edit cannot
 * silently hand Elandra a longsword and quietly saddle her with −4.
 */
describe('D5 — the founding muster never arms a hero off-class', () => {
  it('every starting item is usable by the hero holding it', () => {
    const party = musterParty(
      [FIGHTER, ROGUE, CLERIC, WIZARD].map((classId) => ({
        classId, name: '', ancestry: ancestryIds[0]!, gender: 'm' as const,
      })),
    );
    for (const kit of party) {
      for (const inst of kit.equipped) {
        const itemBase = itemBasesById.get(inst.baseId)!;
        const verdict = proficiencyFor(kit.hero, itemBase);
        expect(verdict.proficient, `${kit.hero.name} starts with ${itemBase.name}: ${verdict.reason}`).toBe(true);
      }
    }
  });

  it('and none of them carries a penalty into their first fight', () => {
    const party = musterParty(
      [FIGHTER, WIZARD].map((classId) => ({
        classId, name: '', ancestry: ancestryIds[0]!, gender: 'm' as const,
      })),
    );
    for (const kit of party) {
      expect(assembleHero(kit).c.weaponPenalty, kit.hero.name).toBe(0);
    }
  });
});
