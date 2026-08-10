import { describe, expect, it } from 'vitest';
import {
  acMod, applyCondition, attackMod, canCastSpells, canMove, conditionValue, damageMod,
  expireConditions, isFlanked, isFlatFooted, removeCondition, unarmedOverride,
} from '@sim/combat/conditions';
import type { Combatant } from '@sim/combat/types';

export function combatant(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'hero_1', name: 'Testa', side: 'heroes', isHero: true, pos: { x: 0, y: 0 },
    maxHp: 30, hp: 30, ac: 16, attackBonus: 7, damageDice: '1d8', weaponRange: 1,
    weaponAgile: false, weaponPenalty: 0, weaponSpecBonus: 0, isWeaponProficient: true,
    sneakAttackDice: '', speed: 5, wounded: 0, initiativeBonus: 3, isCaster: false,
    conditions: new Map(), flurrySwings: 0, lastSwingTick: 0, nextActionTick: 0,
    ...over,
  };
}

const at = (x: number, y: number, side: 'heroes' | 'enemies' = 'heroes'): Combatant =>
  combatant({ id: `${side}_${x}_${y}`, pos: { x, y }, side });

describe('condition modifiers (ported table from condition_modifiers.gd)', () => {
  it('attack mods: frightened by value, prone/restrained/blinded −2, blessed/heroism +1, fatigued −1', () => {
    const u = combatant();
    applyCondition(u, 'frightened', 2);
    expect(attackMod(u)).toBe(-2);
    applyCondition(u, 'prone');
    applyCondition(u, 'blessed');
    expect(attackMod(u)).toBe(-2 - 2 + 1);
  });

  it('AC mods: flat-footed −2, unconscious −4, defending +value, mountain stance +2, raging −1', () => {
    const u = combatant();
    applyCondition(u, 'defending', 2);
    expect(acMod(u)).toBe(2);
    applyCondition(u, 'raging');
    expect(acMod(u)).toBe(1);
    removeCondition(u, 'defending');
    removeCondition(u, 'raging');
    applyCondition(u, 'grabbed'); // flat-footed by condition
    applyCondition(u, 'unconscious');
    expect(acMod(u)).toBe(-2 - 4);
  });

  it('rage: +2 damage, blocks spellcasting; stances override unarmed dice', () => {
    const u = combatant();
    expect(damageMod(u)).toBe(0);
    expect(canCastSpells(u)).toBe(true);
    applyCondition(u, 'raging');
    expect(damageMod(u)).toBe(2);
    expect(canCastSpells(u)).toBe(false);
    applyCondition(u, 'tiger_stance');
    expect(unarmedOverride(u)).toEqual({ dice: '1d8', type: 'slashing' });
  });

  it('grabbed/restrained/unconscious block movement', () => {
    const u = combatant();
    expect(canMove(u)).toBe(true);
    applyCondition(u, 'grabbed');
    expect(canMove(u)).toBe(false);
  });

  it('values stack keep-highest; timed conditions expire by tick', () => {
    const u = combatant();
    applyCondition(u, 'frightened', 1, 100);
    applyCondition(u, 'frightened', 3, 50);
    expect(conditionValue(u, 'frightened')).toBe(3);
    expect(expireConditions(u, 99)).toEqual([]); // longest duration kept (100)
    expect(expireConditions(u, 100)).toEqual(['frightened']);
    expect(conditionValue(u, 'frightened')).toBe(0);
  });
});

describe('flanking in continuous space (the dot-product rule, team-wide)', () => {
  it('allies on opposite sides flank; 90° apart do not', () => {
    const target = at(5, 5, 'enemies');
    const a = at(4, 5); // west
    const opposite = at(6, 5); // east → dot −1
    const perpendicular = at(5, 4); // north → dot 0
    expect(isFlanked(target, a, [target, a, opposite])).toBe(true);
    expect(isFlanked(target, a, [target, a, perpendicular])).toBe(false);
  });

  it('flanking is team-wide: a third ally benefits from the pair', () => {
    const target = at(5, 5, 'enemies');
    const west = at(4, 5);
    const east = at(6, 5);
    const archer = combatant({ id: 'archer', pos: { x: 0, y: 0 }, weaponRange: 10 });
    expect(isFlanked(target, archer, [target, west, east, archer])).toBe(true);
  });

  it('out-of-engagement-range and dead allies do not flank', () => {
    const target = at(5, 5, 'enemies');
    const a = at(4, 5);
    const far = at(8, 5); // distance 3 > 1.5
    const dead = combatant({ id: 'dead', pos: { x: 6, y: 5 }, hp: 0 });
    expect(isFlanked(target, a, [target, a, far])).toBe(false);
    expect(isFlanked(target, a, [target, a, dead])).toBe(false);
  });

  it('full flat-footed check: prone vs adjacent attacker counts, prone vs ranged does not', () => {
    const target = at(5, 5, 'enemies');
    applyCondition(target, 'prone');
    const adjacent = at(4, 5);
    const far = at(0, 0);
    expect(isFlatFooted(target, adjacent, [target, adjacent])).toBe(true);
    expect(isFlatFooted(target, far, [target, far])).toBe(false);
  });
});
