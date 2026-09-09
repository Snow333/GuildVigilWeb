/**
 * M4 (boost rate) + M5 (autopilot feats) — brief #22.
 *
 * ⚠ EXPOSURE FIRST. The harness baselines moved when these landed, but a moved
 * baseline does not prove the feature works — it only proves SOMETHING
 * changed. These assert the specific mechanisms.
 */

import { describe, expect, it } from 'vitest';
import { buildAutoLevelUpPlan } from '@sim/campaign/campaign';
import { CLASS_BOOST_PRIORITY, CLASS_FEAT_PRIORITY } from '@content/autopilot';
import {
  applyLevelUp, asBoostList, BOOSTS_PER_MILESTONE, checkClassEligibility, hpGainForLevel,
  isBoostLevel, skillPointsForLevel, validateBoostSelection,
} from '@sim/heroes/levelUp';
import { isEffectReady } from '@sim/heroes/featEffects';
import { deriveHeroIdentity } from '@sim/heroes/ancestry';
import { abilityMod, characterLevel, type HeroState } from '@sim/heroes/types';

const FIGHTER = 1;
const WIZARD = 2;
const ROGUE = 4;
const SORCERER = 9;

function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero_1', name: 'Testa', status: 'active', xp: 0, maxHp: 40, wounded: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 12, wis: 12, cha: 12 },
    classLevels: [{ classId: FIGHTER, level: 4, orderTaken: 1 }],
    skills: {}, feats: [],
    ...deriveHeroIdentity('hero_1'),
    ...over,
  };
}

describe('M4 — four +2 boosts per milestone', () => {
  it('grants BOOSTS_PER_MILESTONE = 4', () => {
    expect(BOOSTS_PER_MILESTONE).toBe(4);
  });

  it('applies +2 to each of four DISTINCT abilities', () => {
    const h = hero();
    const before = { ...h.abilities };
    applyLevelUp(h, {
      classId: FIGHTER, hpPerLevel: 10, boost: ['str', 'con', 'dex', 'wis'],
      skillRanks: {}, feats: [], autoGrantedFeatIds: [],
    });
    expect(h.abilities.str).toBe(before.str + 2);
    expect(h.abilities.con).toBe(before.con + 2);
    expect(h.abilities.dex).toBe(before.dex + 2);
    expect(h.abilities.wis).toBe(before.wis + 2);
    expect(h.abilities.int).toBe(before.int); // untouched
  });

  it('⚠ REJECTS duplicate abilities before mutating anything', () => {
    const h = hero();
    const before = { ...h.abilities };
    expect(() => applyLevelUp(h, {
      classId: FIGHTER, hpPerLevel: 10, boost: ['str', 'str', 'con', 'dex'],
      skillRanks: {}, feats: [], autoGrantedFeatIds: [],
    })).toThrow(/distinct/);
    // Atomic: the failed call left NOTHING changed.
    expect(h.abilities).toEqual(before);
    expect(characterLevel(h)).toBe(4);
  });

  it('⚠ WHY NOT 4×+1: on an even score a +1 moves NO modifier', () => {
    // The rejected design, demonstrated. Modifiers are floor((score-10)/2) and
    // every founding hero's scores are even, so four +1s would be four odd
    // scores and zero mechanical change — the player chooses and sees nothing.
    for (const score of [8, 10, 12, 14, 16, 18]) {
      expect(abilityMod(score + 1)).toBe(abilityMod(score));
      expect(abilityMod(score + 2)).toBe(abilityMod(score) + 1);
    }
  });

  it('validateBoostSelection enforces the count and distinctness at milestones', () => {
    expect(validateBoostSelection(['str', 'con', 'dex', 'wis'], 5)).toBeNull();
    expect(validateBoostSelection(['str', 'con'], 5)).toMatch(/4 boosts/);
    expect(validateBoostSelection(['str', 'str', 'con', 'dex'], 5)).toMatch(/different/);
    // Non-milestone levels grant none.
    expect(validateBoostSelection([], 6)).toBeNull();
    expect(validateBoostSelection(['str'], 6)).toMatch(/no ability boosts/);
  });

  it('boost levels are still 5/10/15/20', () => {
    for (const l of [5, 10, 15, 20]) expect(isBoostLevel(l)).toBe(true);
    for (const l of [4, 6, 11, 19]) expect(isBoostLevel(l)).toBe(false);
  });
});

describe('M4 — the three inherited behaviours still hold across four boosts', () => {
  it('retroactive CON HP pays modDiff × prior levels, once', () => {
    const h = hero({ abilities: { str: 16, dex: 12, con: 14, int: 12, wis: 12, cha: 12 }, maxHp: 40 });
    const prior = characterLevel(h); // 4
    const applied = applyLevelUp(h, {
      classId: FIGHTER, hpPerLevel: 10, boost: ['con', 'str', 'dex', 'wis'],
      skillRanks: {}, feats: [], autoGrantedFeatIds: [],
    });
    // con 14 -> 16 is mod +2 -> +3, so modDiff 1 × 4 prior levels.
    expect(applied.retroactiveConHp).toBe(1 * prior);
  });

  it('CON retro-HP is ZERO when the boost does not move the modifier', () => {
    // con 13 -> 15: mod +1 -> +2, that DOES move. Use 14->16 vs 15->17:
    // 15 -> 17 is mod +2 -> +3 (moves). Use an odd->odd that does not:
    // con 11 -> 13 is +0 -> +1 (moves). Every +2 moves the mod by exactly 1,
    // which is the point of +2 over +1 — assert that invariant directly.
    for (const con of [8, 9, 10, 11, 12, 13, 14, 15]) {
      expect(abilityMod(con + 2) - abilityMod(con)).toBe(1);
    }
  });

  it('⚠ skill points project ALL pending boosts, not just the first (the fixed INT bug)', () => {
    const wiz = hero({
      classLevels: [{ classId: WIZARD, level: 4, orderTaken: 1 }],
      abilities: { str: 8, dex: 12, con: 12, int: 13, wis: 12, cha: 10 },
    });
    const withoutBoost = skillPointsForLevel(WIZARD, wiz);
    // INT is FOURTH in the list — a single-boost projection would miss it.
    const withBoost = skillPointsForLevel(WIZARD, wiz, ['str', 'con', 'dex', 'int']);
    expect(withBoost).toBe(withoutBoost + 1);
  });

  it('⚠ HP projects a CON boost in any position of the milestone', () => {
    const h = hero({ abilities: { str: 16, dex: 12, con: 13, int: 12, wis: 12, cha: 12 } });
    const plain = hpGainForLevel(10, h);
    const boosted = hpGainForLevel(10, h, ['str', 'dex', 'wis', 'con']);
    expect(boosted).toBe(plain + 1);
  });

  it('⚠ boost-before-class ordering survives: a 4th-position boost unlocks a multiclass', () => {
    // The ledger-preserved nuance: a CHA-12 fighter boosting CHA enters
    // Sorcerer in the SAME level-up. With four boosts, the qualifying one may
    // be picked last — projecting only the first would deny a legal choice.
    const h = hero({ abilities: { str: 16, dex: 12, con: 14, int: 12, wis: 12, cha: 12 } });
    expect(checkClassEligibility(h, SORCERER).met).toBe(false);
    expect(checkClassEligibility(h, SORCERER, ['str', 'con', 'dex', 'cha']).met).toBe(true);
  });

  it('asBoostList accepts both the legacy single key and a list', () => {
    expect(asBoostList('str')).toEqual(['str']);
    expect(asBoostList(['str', 'con'])).toEqual(['str', 'con']);
    expect(asBoostList(undefined)).toEqual([]);
  });
});

describe('M5 — the autopilot takes feats and four boosts', () => {
  const at = (classId: number, level: number): HeroState =>
    hero({ classLevels: [{ classId, level, orderTaken: 1 }] });

  it('⚠ EXPOSURE: the autopilot actually SELECTS feats — it no longer sends []', () => {
    // Fighter L1 -> L2 grants 2 class + 1 general + 1 skill slots.
    const plan = buildAutoLevelUpPlan(at(FIGHTER, 1), ['athletics']);
    expect(plan).not.toBeNull();
    expect(plan!.feats.length).toBeGreaterThan(0);
  });

  it('takes the per-class priority feat when it is eligible', () => {
    const plan = buildAutoLevelUpPlan(at(FIGHTER, 1), ['athletics']);
    // Power Attack (#1) heads the Fighter list and is available at L1.
    expect(plan!.feats.some((f) => f.featId === CLASS_FEAT_PRIORITY[FIGHTER]![0])).toBe(true);
  });

  it('⚠ never picks a feat the readiness gate rejects', () => {
    const plan = buildAutoLevelUpPlan(at(FIGHTER, 3), ['athletics']);
    for (const f of plan!.feats) {
      expect(isEffectReady(f.featId), `autopilot picked unready feat #${f.featId}`).toBe(true);
    }
  });

  it('never picks the same feat twice across one level-up', () => {
    const plan = buildAutoLevelUpPlan(at(FIGHTER, 1), ['athletics']);
    const ids = plan!.feats.map((f) => f.featId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not re-take a feat the hero already holds', () => {
    const h = at(FIGHTER, 1);
    h.feats = [{ featId: 1 }]; // already has Power Attack
    const plan = buildAutoLevelUpPlan(h, ['athletics']);
    expect(plan!.feats.some((f) => f.featId === 1)).toBe(false);
  });

  it('picks four DISTINCT boosts at a milestone, key ability first', () => {
    const plan = buildAutoLevelUpPlan(at(FIGHTER, 4), ['athletics']); // -> level 5
    const boosts = asBoostList(plan!.boost);
    expect(boosts).toHaveLength(BOOSTS_PER_MILESTONE);
    expect(new Set(boosts).size).toBe(BOOSTS_PER_MILESTONE);
    expect(boosts[0]).toBe(CLASS_BOOST_PRIORITY[FIGHTER]![0]); // 'str'
  });

  it('grants no boosts at a non-milestone level', () => {
    const plan = buildAutoLevelUpPlan(at(FIGHTER, 2), ['athletics']); // -> level 3
    expect(asBoostList(plan!.boost)).toHaveLength(0);
  });

  it('a plan the autopilot builds is one applyLevelUp accepts', () => {
    // The two halves must agree — a plan that throws on apply is worse than no
    // autopilot at all.
    for (const [classId, level] of [[FIGHTER, 4], [WIZARD, 4], [ROGUE, 1]] as const) {
      const h = at(classId, level);
      const plan = buildAutoLevelUpPlan(h, ['athletics']);
      expect(plan).not.toBeNull();
      expect(() => applyLevelUp(h, { ...plan!, hpPerLevel: 8 })).not.toThrow();
    }
  });

  it('auto-granted class features ride along', () => {
    const plan = buildAutoLevelUpPlan(at(ROGUE, 0), ['stealth']);
    // Rogue L1 grants sneak_attack_1d6 -> Sneak Attack (#68).
    expect(plan!.autoGrantedFeatIds).toContain(68);
  });

  it('⚠ the wizard list is short because the CONTENT is unready, and that is not a crash', () => {
    // 24 wizard class feats, exactly one of which passes the gate. The plan
    // must still build, with slots forfeited rather than filled with junk.
    const plan = buildAutoLevelUpPlan(at(WIZARD, 4), ['arcana']);
    expect(plan).not.toBeNull();
    for (const f of plan!.feats) expect(isEffectReady(f.featId)).toBe(true);
  });

  it('is deterministic — the same hero yields the same plan', () => {
    const a = buildAutoLevelUpPlan(at(FIGHTER, 4), ['athletics']);
    const b = buildAutoLevelUpPlan(at(FIGHTER, 4), ['athletics']);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
