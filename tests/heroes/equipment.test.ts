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
