import { describe, expect, it } from 'vitest';
import {
  baseProficiency, bestTier, tierBonus, totalProficiency,
  TIER_EXPERT, TIER_LEGENDARY, TIER_MASTER, TIER_TRAINED, TIER_UNTRAINED,
} from '@sim/heroes/proficiency';
import { abilityMod, characterLevel } from '@sim/heroes/types';

/** Class IDs from the converted registry: 1=Fighter, 2=Wizard, 6=Barbarian (per classes.ts). */
const heroOf = (levels: [classId: number, level: number][]) => ({
  classLevels: levels.map(([classId, level], i) => ({ classId, level, orderTaken: i + 1 })),
});

describe('base proficiency and modifiers (ported from proficiency_tiers.gd)', () => {
  it('base = level/2 + 1, integer division', () => {
    expect(baseProficiency(1)).toBe(1);
    expect(baseProficiency(2)).toBe(2);
    expect(baseProficiency(19)).toBe(10);
    expect(baseProficiency(20)).toBe(11);
  });

  it('tier bonuses are 0/2/4/6', () => {
    expect(tierBonus(TIER_TRAINED)).toBe(0);
    expect(tierBonus(TIER_EXPERT)).toBe(2);
    expect(tierBonus(TIER_MASTER)).toBe(4);
    expect(tierBonus(TIER_LEGENDARY)).toBe(6);
    expect(tierBonus(TIER_UNTRAINED)).toBe(0);
  });

  it('PF ability modifier', () => {
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(18)).toBe(4);
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(7)).toBe(-2);
  });
});

describe('tier milestones against the REAL converted registry', () => {
  it('Fighter weapon_attack: Trained L1, Expert L5, Master L13, Legendary L19', () => {
    expect(bestTier(heroOf([[1, 1]]), 'weapon_attack')).toBe(TIER_TRAINED);
    expect(bestTier(heroOf([[1, 4]]), 'weapon_attack')).toBe(TIER_TRAINED);
    expect(bestTier(heroOf([[1, 5]]), 'weapon_attack')).toBe(TIER_EXPERT);
    expect(bestTier(heroOf([[1, 13]]), 'weapon_attack')).toBe(TIER_MASTER);
    expect(bestTier(heroOf([[1, 18]]), 'weapon_attack')).toBe(TIER_MASTER);
    expect(bestTier(heroOf([[1, 19]]), 'weapon_attack')).toBe(TIER_LEGENDARY);
  });

  it('the hand-tuned Fighter-L19 vs Barbarian-L20 Legendary gap survives conversion', () => {
    // Deliberate one-level difference flagged in the nuance sweep — the kind of
    // value a careless migration silently flattens. Fighter id 1, Barbarian id 6.
    expect(bestTier(heroOf([[1, 19]]), 'weapon_attack')).toBe(TIER_LEGENDARY);
    expect(bestTier(heroOf([[6, 19]]), 'weapon_attack')).toBe(TIER_MASTER);
    expect(bestTier(heroOf([[6, 20]]), 'weapon_attack')).toBe(TIER_LEGENDARY);
  });

  it('multiclass keeps the highest tier across classes', () => {
    // Real data: Fighter hits Expert at L5; Wizard not until L7. So a Wizard 5 /
    // Fighter 5 multiclass is Expert while a pure Wizard 5 is still Trained.
    const multiclass = heroOf([[2, 5], [1, 5]]);
    const wizardOnly = heroOf([[2, 5]]);
    expect(bestTier(multiclass, 'weapon_attack')).toBe(TIER_EXPERT);
    expect(bestTier(wizardOnly, 'weapon_attack')).toBe(TIER_TRAINED);
    expect(bestTier(multiclass, 'weapon_attack')).toBeGreaterThan(bestTier(wizardOnly, 'weapon_attack'));
  });

  it('total proficiency = base(char level) + tier bonus, char level floored at 1', () => {
    // Fighter 5 / Wizard 10 → character level 15 → base 8; Expert → +2.
    const h = heroOf([[2, 10], [1, 5]]);
    expect(characterLevel(h)).toBe(15);
    expect(totalProficiency(h, 'weapon_attack')).toBe(8 + 2);
    // Empty-class hero degrades to level 1, untrained.
    expect(totalProficiency(heroOf([]), 'weapon_attack')).toBe(1);
  });
});
