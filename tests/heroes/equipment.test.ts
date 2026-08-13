import { describe, expect, it } from 'vitest';
import { aggregateStatBonuses, applyStriking, deriveItem } from '@sim/heroes/equipment';
import type { ItemInstance } from '@sim/core/events/types';

/** Real converted IDs: 3=Longsword, 17=Longsword +1 (magical), 109=Masterwork Dagger, 56=Headband of Intellect, 57=Belt of Strength, 54=Cloak of Resistance +1. */
const inst = (baseId: string, tier: ItemInstance['tier'] = 'mundane', propertyIds: string[] = []): ItemInstance =>
  ({ baseId, tier, propertyIds, seed: 'test' });

describe('deriveItem — tuples to effective stats', () => {
  it('mundane base derives cleanly with no bonuses', () => {
    const d = deriveItem(inst('3'));
    expect(d.displayName).toBe('Longsword');
    expect(d.attackBonus).toBe(0);
    expect(d.damageDice).toBe('1d8');
    expect(d.price).toBeGreaterThan(0);
  });

  it('authored magic item keeps its authored potency (Longsword +1)', () => {
    const d = deriveItem(inst('17'));
    expect(d.attackBonus).toBe(1);
    expect(d.displayName).toBe('Longsword +1'); // no double "+1" suffix
  });

  it('authored masterwork keeps +1 attack, no striking (Masterwork Dagger)', () => {
    const d = deriveItem(inst('109'));
    expect(d.attackBonus).toBe(1);
    expect(d.strikingTier).toBe(0);
    expect(d.displayName).toBe('Masterwork Dagger'); // tier not repeated in name
  });

  it('GENERATED enchanted flaming longsword: tier potency + property on-hit + composed name', () => {
    const d = deriveItem(inst('3', 'enchanted', ['flaming']));
    expect(d.attackBonus).toBe(2); // enchanted tier grant
    expect(d.displayName).toBe('Enchanted Flaming Longsword +2');
    expect(d.onHitEffects).toHaveLength(1);
    expect(d.onHitEffects[0]!.onHit).toMatchObject({ damage_dice: '1d6', damage_type: 'fire' });
    expect(d.onHitEffects[0]!.onCrit).toMatchObject({ condition: 'persistent_fire' });
    expect(d.price).toBeGreaterThan(deriveItem(inst('3')).price * 40);
  });

  it('striking adds extra weapon dice', () => {
    expect(applyStriking('1d8', 1)).toBe('2d8');
    expect(applyStriking('2d6', 1)).toBe('3d6');
    expect(applyStriking('1d4', 0)).toBe('1d4');
    expect(applyStriking(null, 2)).toBeNull();
  });

  it('integrity: unknown base, unknown property, and incompatible property all throw', () => {
    expect(() => deriveItem(inst('999999'))).toThrow(/unknown base/);
    expect(() => deriveItem(inst('3', 'magical', ['nonexistent_prop']))).toThrow(/unknown property/);
    // flaming applies_to weapons — deriving it on armor is corruption, not gameplay.
    // Item 21+ range: find any armor via a known armor row (Leather Armor exists in seeds).
    expect(() => deriveItem(inst('21', 'magical', ['flaming']))).toThrow(/does not apply|unknown base/);
  });
});

/**
 * THE TWO CONTRACT BUGS from brief #14 §5, both fixed in brief #15's milestone.
 * Neither had any cover: the striking test above only exercises `applyStriking`
 * in ISOLATION, and no test ever derived one of the nine affected item rows —
 * which is exactly how a weapon that reads `2d8` came to fight as `3d8`.
 */
describe('BUG A — potency on worn gear reaches AC', () => {
  /** 28 = Full Plate (ac 8, potency 0) · 155 = Full Plate +3 (ac 7, potency 3). */
  it('the most expensive armour in the game is no longer a downgrade', () => {
    const mundane = deriveItem(inst('28'));
    const plusThree = deriveItem(inst('155'));
    expect({ mundane: mundane.acBonus, plusThree: plusThree.acBonus }).toEqual({ mundane: 8, plusThree: 10 });
    expect(plusThree.acBonus).toBeGreaterThan(mundane.acBonus);
  });

  /** The whole Chain Mail line used to be ac 5 from 55 gp to 825 gp. */
  it('the chain mail ladder actually climbs', () => {
    const rungs = ['25', '129', '151', '153'].map((id) => deriveItem(inst(id)).acBonus);
    expect(rungs).toEqual([5, 5, 7, 8]); // mundane, masterwork, +2, +3
  });

  /** Same maxed potency the attack roll uses, so ROLLED armour works too. */
  it('a rolled magical armour instance beats its own mundane base', () => {
    expect(deriveItem(inst('25', 'magical')).acBonus).toBe(6);
    expect(deriveItem(inst('25', 'enchanted')).acBonus).toBe(7);
  });

  it('potency on a WEAPON still goes to the attack roll and not to AC', () => {
    const sword = deriveItem(inst('17')); // Longsword +1
    expect({ attackBonus: sword.attackBonus, acBonus: sword.acBonus }).toEqual({ attackBonus: 1, acBonus: 0 });
  });
});

describe('BUG B — striking is applied exactly once', () => {
  /**
   * All nine rows carrying `striking_tier > 0` were authored at DOUBLE their
   * base weapon's dice and then had striking applied again. Brief #14 named
   * five of them; 171, 177, 178 and 182 are the four it missed.
   */
  const expected: [string, string, number][] = [
    ['145', '2d8', 9.0],   // Striking Longsword +2  (was 3d8  / 13.5)
    ['146', '2d12', 13.0], // Striking Greatsword +2 (was 3d12 / 19.5)
    ['147', '2d8', 9.0],   // Striking Longbow +2
    ['166', '2d8', 9.0],   // Dreadblade
    ['168', '2d12', 13.0], // Lifedrinker Axe
    ['171', '2d8', 9.0],   // Stormhammer
    ['177', '2d6', 7.0],   // Ashenmere's Spear
    ['178', '2d8', 9.0],   // The Last Edict
    ['182', '2d8', 9.0],   // Silvertide's Bow
  ];

  it('every striking row derives at its authored intent, not half again more', () => {
    const derived = expected.map(([id]) => deriveItem(inst(id)).damageDice);
    expect(derived).toEqual(expected.map(([, dice]) => dice));
  });

  it('and the average damage lands where the content meant it to', () => {
    for (const [id, , avg] of expected) {
      const dice = deriveItem(inst(id)).damageDice!;
      const m = /^(\d+)d(\d+)$/.exec(dice)!;
      expect({ id, avg: (Number(m[1]) * (Number(m[2]) + 1)) / 2 }).toEqual({ id, avg });
    }
  });

  it('striking_tier still ADDS a die — the mechanic works, it just stopped double-firing', () => {
    // The base row carries one die; the tier grant is what adds the second.
    expect(deriveItem(inst('3')).damageDice).toBe('1d8');            // Longsword, no striking
    expect(deriveItem(inst('3', 'legendary')).damageDice).toBe('2d8'); // TIER_GRANTS.legendary striking 1
  });
});

describe('stat bonuses from wondrous items', () => {
  it('Belt of Strength grants str; Headband grants int', () => {
    expect(deriveItem(inst('57')).statBonuses).toEqual({ str: 2 });
    expect(deriveItem(inst('56')).statBonuses).toEqual({ int: 2 });
  });

  it('aggregates across equipped items including save bonuses', () => {
    const total = aggregateStatBonuses([inst('57'), inst('54')]);
    expect(total).toEqual({ str: 2, fort_save: 1, ref_save: 1, will_save: 1 });
  });
});
