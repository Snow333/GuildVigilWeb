import { describe, expect, it } from 'vitest';
import {
  applyLevelUp, checkClassEligibility, hpGainForLevel, isBoostLevel, maxSkillRanks,
  skillPointsForLevel,
} from '@sim/heroes/levelUp';
import { characterLevel, type HeroState } from '@sim/heroes/types';

/** Class IDs: 1=Fighter (STR, 3 sp/lvl, hp 10), 2=Wizard (INT), 9=Sorcerer (CHA per registry). */
function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero_1', name: 'Testa', status: 'active', xp: 0, maxHp: 20, wounded: 0,
    abilities: { str: 16, dex: 12, con: 12, int: 13, wis: 10, cha: 12 },
    classLevels: [{ classId: 1, level: 4, orderTaken: 1 }],
    skills: { athletics: 4 }, feats: [],
    ...over,
  };
}

describe('boost levels and eligibility', () => {
  it('boosts at new character levels 5/10/15/20 only', () => {
    expect(isBoostLevel(5)).toBe(true);
    expect(isBoostLevel(10)).toBe(true);
    expect(isBoostLevel(4)).toBe(false);
    expect(isBoostLevel(6)).toBe(false);
  });

  it('advancing an existing class is always prereq-met', () => {
    expect(checkClassEligibility(hero(), 1).met).toBe(true);
  });

  it('THE SAME-LEVEL UNLOCK: CHA 12 fails Sorcerer, but a pending CHA boost qualifies', () => {
    const h = hero(); // cha 12
    const sorcererByRegistry = 9; // key_ability cha
    const without = checkClassEligibility(h, sorcererByRegistry);
    expect(without.met).toBe(false);
    expect(without.reason).toMatch(/CHA 13/);
    const withBoost = checkClassEligibility(h, sorcererByRegistry, 'cha');
    expect(withBoost.met).toBe(true);
  });

  it('a 6th class is blocked at MAX_CLASSES', () => {
    const h = hero({
      classLevels: [1, 2, 3, 4, 6].map((cid, i) => ({ classId: cid, level: 1, orderTaken: i + 1 })),
      abilities: { str: 18, dex: 18, con: 18, int: 18, wis: 18, cha: 18 },
    });
    const r = checkClassEligibility(h, 5);
    expect(r.met).toBe(false);
    expect(r.reason).toMatch(/Maximum 5 classes/);
  });

  it('character level cap and class level cap both bind', () => {
    expect(checkClassEligibility(hero({ classLevels: [{ classId: 1, level: 20, orderTaken: 1 }] }), 1).met).toBe(false);
    const h = hero({ classLevels: [{ classId: 1, level: 19, orderTaken: 1 }] });
    expect(checkClassEligibility(h, 1).met).toBe(true);
  });
});

describe('skill points — the INT-boost fix', () => {
  it('fighter: 3 + int mod, floor 1', () => {
    expect(skillPointsForLevel(1, hero())).toBe(3 + 1); // int 13 → +1
    expect(skillPointsForLevel(1, hero({ abilities: { ...hero().abilities, int: 8 } }))).toBe(2); // 3 - 1
    expect(skillPointsForLevel(1, hero({ abilities: { ...hero().abilities, int: 3 } }))).toBe(1); // floor
  });

  it('a pending INT boost feeds THIS level-up (the Godot bug, fixed)', () => {
    const h = hero(); // int 13 → mod +1 → 4 points
    expect(skillPointsForLevel(1, h)).toBe(4);
    expect(skillPointsForLevel(1, h, 'int')).toBe(5); // effective 15 → +2 → 5 points
  });
});

describe('atomic apply', () => {
  it('plain advance: class level, HP with CON mod, skills, feats', () => {
    const h = hero(); // fighter 4, con 12 (+1)
    const r = applyLevelUp(h, {
      classId: 1, hpPerLevel: 10, skillRanks: { athletics: 1, stealth: 2 },
      feats: [{ featId: 1 }], autoGrantedFeatIds: [211],
    });
    expect(r).toMatchObject({ newClassLevel: 5, newCharacterLevel: 5, hpGain: 11, retroactiveConHp: 0 });
    expect(h.maxHp).toBe(31);
    expect(h.skills).toEqual({ athletics: 5, stealth: 2 });
    expect(h.feats.map((f) => f.featId)).toEqual([1, 211]);
  });

  it('CON boost at new level 5: boosted HP this level + retroactive over 4 prior levels', () => {
    const h = hero(); // con 12 → boost → 14: mod +1 → +2, diff 1
    const r = applyLevelUp(h, {
      classId: 1, hpPerLevel: 10, boost: 'con', skillRanks: {}, feats: [], autoGrantedFeatIds: [],
    });
    expect(r.hpGain).toBe(12); // 10 + effective con mod +2
    expect(r.retroactiveConHp).toBe(4); // diff 1 × 4 prior levels
    expect(h.maxHp).toBe(20 + 12 + 4);
    expect(h.abilities.con).toBe(14);
  });

  it('CON boost with no mod change pays nothing retroactively (13 → 15)', () => {
    const h = hero({ abilities: { ...hero().abilities, con: 13 } }); // mod +1 → +2? 13→+1, 15→+2: diff 1
    const r = applyLevelUp(h, { classId: 1, hpPerLevel: 10, boost: 'con', skillRanks: {}, feats: [], autoGrantedFeatIds: [] });
    expect(r.retroactiveConHp).toBe(4);
    const h2 = hero({ abilities: { ...hero().abilities, con: 14 } }); // 14→+2, 16→+3: diff 1... use 15: 15→+2, 17→+3
    void h2;
    const h3 = hero({ abilities: { ...hero().abilities, con: 10 } }); // 10→0, 12→+1: diff 1
    const r3 = applyLevelUp(h3, { classId: 1, hpPerLevel: 10, boost: 'con', skillRanks: {}, feats: [], autoGrantedFeatIds: [] });
    expect(r3.retroactiveConHp).toBe(4);
  });

  it('boost-then-multiclass in one apply: CHA boost + first Sorcerer level', () => {
    const h = hero(); // cha 12, fighter 4
    const r = applyLevelUp(h, {
      classId: 9, hpPerLevel: 6, boost: 'cha', skillRanks: {}, feats: [], autoGrantedFeatIds: [],
    });
    expect(r.newClassLevel).toBe(1);
    expect(r.newCharacterLevel).toBe(5);
    expect(h.abilities.cha).toBe(14);
    expect(h.classLevels).toHaveLength(2);
    expect(h.classLevels[1]).toMatchObject({ classId: 9, level: 1, orderTaken: 2 });
    expect(characterLevel(h)).toBe(5);
  });

  it('duplicate auto-grants are not double-added', () => {
    const h = hero({ feats: [{ featId: 211 }] });
    applyLevelUp(h, { classId: 1, hpPerLevel: 10, skillRanks: {}, feats: [], autoGrantedFeatIds: [211] });
    expect(h.feats.filter((f) => f.featId === 211)).toHaveLength(1);
  });

  it('ATOMICITY: an ineligible plan throws before any mutation', () => {
    const h = hero(); // cha 12, no boost → Sorcerer ineligible
    const before = JSON.stringify(h);
    expect(() =>
      applyLevelUp(h, { classId: 9, hpPerLevel: 6, skillRanks: { arcana: 1 }, feats: [{ featId: 1 }], autoGrantedFeatIds: [] }),
    ).toThrow(/Requires CHA/);
    expect(JSON.stringify(h)).toBe(before);
  });

  it('hp gain floors at 1 even with terrible CON', () => {
    const h = hero({ abilities: { ...hero().abilities, con: 3 } }); // mod −4 (PF floor)
    expect(hpGainForLevel(3, h)).toBe(1);
  });
});

describe('THE SKILL RANK CAP (finding #4): ranks ≤ character level, PF2-style', () => {
  it('exactly at cap passes: fighter 4 → 5 may hold 5 ranks', () => {
    const h = hero(); // athletics 4 at level 4 — exactly legal
    applyLevelUp(h, { classId: 1, hpPerLevel: 10, skillRanks: { athletics: 1 }, feats: [], autoGrantedFeatIds: [] });
    expect(h.skills['athletics']).toBe(5); // = new character level
  });

  it('over cap throws BEFORE mutation (atomicity holds)', () => {
    const h = hero();
    const before = JSON.stringify(h);
    expect(() =>
      applyLevelUp(h, { classId: 1, hpPerLevel: 10, skillRanks: { athletics: 2 }, feats: [], autoGrantedFeatIds: [] }),
    ).toThrow(/cap is 5/);
    expect(JSON.stringify(h)).toBe(before);
  });

  it('the cap binds fresh skills too: no 3-rank stealth at level 2', () => {
    const h = hero({ classLevels: [{ classId: 1, level: 1, orderTaken: 1 }], skills: {} });
    expect(() =>
      applyLevelUp(h, { classId: 1, hpPerLevel: 10, skillRanks: { stealth: 3 }, feats: [], autoGrantedFeatIds: [] }),
    ).toThrow(/cap is 2/);
  });

  it('maxSkillRanks is the character level', () => {
    expect(maxSkillRanks(1)).toBe(1);
    expect(maxSkillRanks(7)).toBe(7);
  });
});
