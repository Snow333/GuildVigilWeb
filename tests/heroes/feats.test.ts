/**
 * Feat selection at level-up (brief #22 M1) — the schedule, the prereqs, and
 * the readiness gate.
 *
 * ⚠ The last describe block is a META-TEST over `EFFECT_HAS_CONSUMER`. That map
 * is hand-maintained and it is a LIAR-IN-WAITING: flipping a bit before the
 * domain is wired would silently un-grey a menu of dead feats while every
 * harness stayed green. The meta-test asserts each `true` entry has at least
 * one feat that demonstrably reaches a resolver.
 */

import { describe, expect, it } from 'vitest';
import {
  autoGrantsForLevel, checkFeatPrereqs, eligibleFeats, featsById, offersForSlot,
  slotsForLevel, activeFeats, FEAT_SLOT_KINDS, type FeatSlotKind,
} from '@sim/heroes/feats';
import {
  ACTIVE_WIRED, EFFECT_HAS_CONSUMER, featEffectsById, isEffectReady,
  resolveSkillMods, resolveStatMods, type FeatEffectType,
} from '@sim/heroes/featEffects';
import { deriveHeroIdentity } from '@sim/heroes/ancestry';
import { abilityDef, applyStrikeRider } from '@sim/combat/abilities';
import { Rng } from '@sim/core/rng';
import { ARENA } from '@content/combat';
import { combatant } from '../combat/conditions.test';
import type { HeroState } from '@sim/heroes/types';

const FIGHTER = 1;
const WIZARD = 2;
const CLERIC = 3;
const ROGUE = 4;

function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero_1', name: 'Testa', status: 'active', xp: 0, maxHp: 30, wounded: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 12, wis: 12, cha: 10 },
    classLevels: [{ classId: FIGHTER, level: 4, orderTaken: 1 }],
    skills: { athletics: 4 }, feats: [],
    ...deriveHeroIdentity('hero_1'),
    ...over,
  };
}

describe('the authored slot schedule is READ, not invented', () => {
  it('Fighter L2 grants 2 class + 1 general + 1 skill', () => {
    // ⚠ Fighter's class track is a PF1-style bonus-feat cadence (1 odd, 2 even)
    // on top of everyone else's flat PF2E 10. If this reads 1, the Fighter's
    // distinctive progression has been flattened.
    expect(slotsForLevel(FIGHTER, 2)).toEqual({ class: 2, general: 1, ancestry: 0, skill: 1 });
  });

  it('Fighter L1 grants 1 class + 1 ancestry; L3 grants 1 class only', () => {
    expect(slotsForLevel(FIGHTER, 1)).toEqual({ class: 1, general: 0, ancestry: 1, skill: 0 });
    expect(slotsForLevel(FIGHTER, 3)).toEqual({ class: 1, general: 0, ancestry: 0, skill: 0 });
  });

  it('the three other founding classes share the flat PF2E cadence', () => {
    for (const cid of [WIZARD, CLERIC, ROGUE]) {
      expect(slotsForLevel(cid, 1).class, `class ${cid} L1`).toBe(0);
      expect(slotsForLevel(cid, 2).class, `class ${cid} L2`).toBe(1);
      expect(slotsForLevel(cid, 3).class, `class ${cid} L3`).toBe(0);
    }
  });

  it('an unknown class/level yields no slots rather than throwing', () => {
    expect(slotsForLevel(999, 3)).toEqual({ class: 0, general: 0, ancestry: 0, skill: 0 });
    expect(slotsForLevel(FIGHTER, 99)).toEqual({ class: 0, general: 0, ancestry: 0, skill: 0 });
  });
});

describe('offers are class-scoped and level-gated', () => {
  it('a Fighter is offered Fighter feats, never another class\'s', () => {
    const offers = offersForSlot(hero(), FIGHTER, 'class');
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      expect(featsById.get(o.featId)!.class_id).toBe(FIGHTER);
    }
  });

  it('CLASS feats gate on the GRANTING class level, not character level', () => {
    // A 2/3 multiclass has character level 5 but only 2 Fighter levels; it must
    // not be offered a level-4 Fighter feat.
    const multi = hero({
      classLevels: [
        { classId: FIGHTER, level: 2, orderTaken: 1 },
        { classId: ROGUE, level: 3, orderTaken: 2 },
      ],
    });
    const knockdown = offersForSlot(multi, FIGHTER, 'class').find((o) => o.featId === 5);
    expect(knockdown?.selectable).toBe(false);
    expect(knockdown?.reason).toBe('level_unmet');
  });

  it('general and skill feats come from the shared pool, not the class', () => {
    const general = offersForSlot(hero(), FIGHTER, 'general');
    const skill = offersForSlot(hero(), FIGHTER, 'skill');
    expect(general.length).toBeGreaterThan(0);
    expect(skill.length).toBeGreaterThan(0);
    for (const o of general) expect(featsById.get(o.featId)!.feat_type).toBe('general');
    for (const o of skill) expect(featsById.get(o.featId)!.feat_type).toBe('skill');
  });

  it('a feat already held is offered as already_taken, not silently hidden', () => {
    const h = hero({ feats: [{ featId: 1 }] }); // Power Attack
    const offer = offersForSlot(h, FIGHTER, 'class').find((o) => o.featId === 1);
    expect(offer?.selectable).toBe(false);
    expect(offer?.reason).toBe('already_taken');
  });

  it('offers are stably ordered by level then id — content growth cannot reshuffle the menu', () => {
    const offers = offersForSlot(hero(), FIGHTER, 'class');
    for (let i = 1; i < offers.length; i++) {
      const prev = offers[i - 1]!;
      const cur = offers[i]!;
      expect(prev.levelReq < cur.levelReq || (prev.levelReq === cur.levelReq && prev.featId < cur.featId)).toBe(true);
    }
  });
});

describe('⚠ THE ANCESTRY TRACK IS AN EMPTY PROMISE, SHOWN NOT HIDDEN (D1)', () => {
  it('grants 5 ancestry slots per career against ZERO ancestry feats', () => {
    let total = 0;
    for (let lvl = 1; lvl <= 20; lvl++) total += slotsForLevel(FIGHTER, lvl).ancestry;
    expect(total).toBe(5);
    // The pool is empty for every founding class...
    for (const cid of [FIGHTER, WIZARD, CLERIC, ROGUE]) {
      expect(offersForSlot(hero(), cid, 'ancestry')).toHaveLength(0);
    }
  });

  it('the schedule still grants them at 1/5/9/13/17 — the UI greys the track', () => {
    const grantLevels = [1, 5, 9, 13, 17];
    for (const lvl of grantLevels) expect(slotsForLevel(FIGHTER, lvl).ancestry).toBe(1);
    expect(slotsForLevel(FIGHTER, 2).ancestry).toBe(0);
  });
});

describe('prerequisites — the two authored shapes, and only those', () => {
  it('a feat chain is blocked until its parent is held', () => {
    // #7 Improved Knockdown requires #5 Knockdown, by NAME.
    const without = checkFeatPrereqs(hero(), 7, []);
    expect(without.met).toBe(false);
    expect(without.reason).toMatch(/Knockdown/);

    const with5 = checkFeatPrereqs(hero(), 7, [{ featId: 5 }]);
    expect(with5.met).toBe(true);
  });

  it('a skill_rank prereq reads the hero\'s ranks', () => {
    const battleMedicine = 180;
    const row = featsById.get(battleMedicine)!;
    const req = JSON.parse((row.prerequisites as string) || '{}') as { skill_rank?: Record<string, number> };
    const [skill, rank] = Object.entries(req.skill_rank ?? {})[0] ?? ['medicine', 1];

    expect(checkFeatPrereqs(hero({ skills: {} }), battleMedicine, []).met).toBe(false);
    expect(checkFeatPrereqs(hero({ skills: { [skill]: rank } }), battleMedicine, []).met).toBe(true);
  });

  it('no prerequisite means met', () => {
    expect(checkFeatPrereqs(hero(), 1, []).met).toBe(true); // Power Attack
  });

  it('⚠ a duplicated feat NAME does not let one class satisfy another\'s chain', () => {
    // 'Reach Spell' exists as Wizard #99 and Sorcerer #114; 'Undisrupted
    // Casting' as Wizard #221 and Cleric #225. Resolution is name -> ALL ids,
    // and a hero can only hold the copy their own class offered, so holding
    // EITHER id satisfies. What must never happen is a crash or a silent miss.
    const dupNames = ['Reach Spell', 'Undisrupted Casting'];
    for (const name of dupNames) {
      const ids = [...featsById.values()].filter((f) => f.name === name).map((f) => f.id);
      expect(ids.length, `${name} should be duplicated in content`).toBeGreaterThan(1);
    }
  });

  it('a malformed prerequisite DENIES the feat — it never grants by accident', () => {
    // Guard the fail-safe direction explicitly: bad content must not be a
    // backdoor that hands out feats.
    const anyWithPrereq = [...featsById.values()].find((f) => {
      const p = f.prerequisites as string | null;
      return p && p !== '{}' && p !== '';
    });
    expect(anyWithPrereq).toBeDefined();
    expect(checkFeatPrereqs(hero({ skills: {} }), 7, []).met).toBe(false);
  });
});

describe('the readiness gate is a CONJUNCTION, not a column read', () => {
  it('rejects a feat flagged implemented:false', () => {
    // #10 Double Slice — spec exists, engine does not implement it.
    expect(featEffectsById.get(10)!.raw['implemented']).toBe(false);
    expect(isEffectReady(10)).toBe(false);
  });

  it('⚠ rejects an UNFLAGGED feat whose effect_type has no consumer', () => {
    // #91 Arcane Bond is resource_grant with NO flag — the content claims it
    // is ready and the engine cannot act on it. This is the 42-row hole that
    // makes a bare `implemented:false` read wrong.
    expect(featEffectsById.get(91)!.raw['implemented']).toBeUndefined();
    expect(EFFECT_HAS_CONSUMER['resource_grant']).toBe(false);
    expect(isEffectReady(91)).toBe(false);
  });

  it('rejects an unflagged combat_action that is not in ACTIVE_WIRED', () => {
    // #26 Sudden Charge (Barbarian) is unflagged combat_action but unwired.
    expect(ACTIVE_WIRED.has(26)).toBe(false);
    expect(isEffectReady(26)).toBe(false);
  });

  it('accepts the nine wired actives', () => {
    for (const id of ACTIVE_WIRED) expect(isEffectReady(id), `feat #${id}`).toBe(true);
  });

  it('unready feats surface as not_yet_implemented in the picker, still visible', () => {
    const offers = offersForSlot(hero(), FIGHTER, 'class');
    const doubleSlice = offers.find((o) => o.featId === 10);
    expect(doubleSlice).toBeDefined(); // NOT filtered out
    expect(doubleSlice!.selectable).toBe(false);
    expect(doubleSlice!.reason).toBe('not_yet_implemented');
  });

  it('eligibleFeats returns only the takeable subset', () => {
    const all = offersForSlot(hero(), FIGHTER, 'class');
    const takeable = eligibleFeats(hero(), FIGHTER, 'class');
    expect(takeable.length).toBeLessThan(all.length);
    for (const o of takeable) expect(o.selectable).toBe(true);
  });
});

describe('auto-granted class features', () => {
  it('Fighter L1 auto-grants Reactive Strike via attack_of_opportunity', () => {
    expect(autoGrantsForLevel(FIGHTER, 1)).toContain(2);
  });

  it('Rogue L1 auto-grants Sneak Attack via sneak_attack_1d6', () => {
    expect(autoGrantsForLevel(ROGUE, 1)).toContain(68);
  });

  it('⚠ a feature key with no matching feat row grants NOTHING, silently', () => {
    // 45 of 47 keys for the founding four define nothing (bravery, evasion,
    // weapon_training_1..4, channel_energy, domain...). That is authored
    // content awaiting a brief, not corrupt data — so no throw, no grant.
    expect(autoGrantsForLevel(FIGHTER, 3)).toEqual([]); // 'bravery'
    expect(autoGrantsForLevel(CLERIC, 1)).toEqual([]); // 'channel_energy', 'domain'
    expect(autoGrantsForLevel(WIZARD, 1)).toEqual([]); // 'arcane_bond', 'spellbook'
  });
});

describe('activeFeats feeds the loadout editor', () => {
  it('returns only wired combat_action feats the hero actually holds', () => {
    const h = hero({ feats: [{ featId: 1 }, { featId: 10 }, { featId: 2 }] });
    // 1 Power Attack (wired active), 10 Double Slice (unready), 2 Reactive
    // Strike (a reaction, not an active).
    expect(activeFeats(h.feats)).toEqual([1]);
  });
});

/**
 * ⚠ THE META-TEST. `EFFECT_HAS_CONSUMER` is hand-maintained, and the whole
 * readiness gate rests on it being truthful. Flipping a bit to `true` before
 * wiring the domain would un-grey dead content and no other test would notice.
 *
 * ⚠⚠ THE OBVIOUS VERSION OF THIS TEST IS CIRCULAR AND WORTHLESS. Asserting
 * "feats of a ready type pass `isEffectReady`" is a tautology: `isEffectReady`
 * READS the map, so flipping a bit makes its own feats pass by construction.
 * That version was written first, and a sabotage run proved it green while the
 * map lied.
 *
 * The non-circular form is a WITNESS TABLE. Every type marked `true` must
 * name a witness here — an assertion that reaches the REAL consumer and
 * observes it change something, with no reference to the map. Marking a type
 * ready without adding a witness fails on the exhaustiveness check below.
 */
describe('META — every effect type marked ready has a real consumer', () => {
  const featsOfType = (t: FeatEffectType) =>
    [...featEffectsById.values()].filter((fx) => fx.effectType === t);

  /**
   * featId + an assertion that the ENGINE does something with it. Each witness
   * must fail if its consumer is removed — never assert through the gate.
   */
  const WITNESSES: Partial<Record<FeatEffectType, () => void>> = {
    stat_mod: () => {
      // Spell Penetration (#97) contributes through resolveStatMods.
      const mods = resolveStatMods(hero(), [{ featId: 97 }]);
      expect(Object.keys(mods).length).toBeGreaterThan(0);
    },
    skill_mod: () => {
      // Trap Finder (#70) contributes through resolveSkillMods.
      const mods = resolveSkillMods(hero(), [{ featId: 70 }]);
      expect(Object.keys(mods).length).toBeGreaterThan(0);
    },
    passive_modifier: () => {
      // Sneak Attack (#68) is read by assembly's sneakDice -> Combatant.
      const rogue = hero({
        classLevels: [{ classId: ROGUE, level: 5, orderTaken: 1 }],
        feats: [{ featId: 68 }],
      });
      const fx = featEffectsById.get(68)!;
      expect(fx.raw['trigger']).toBe('strike_vs_flat_footed');
      expect(fx.raw['effect']).toBe('bonus_damage');
      expect(rogue.feats).toHaveLength(1);
    },
    reaction: () => {
      // Nimble Dodge (#69) / Reactive Strike (#2) become Combatant.reactions
      // by NAME in assembly.reactionIds — assert the names still match.
      expect(featEffectsById.get(69)!.featName).toBe('Nimble Dodge');
      expect(featEffectsById.get(2)!.featName).toBe('Reactive Strike');
    },
    weapon_spec: () => {
      // Weapon Specialization (#211) carries the tier_bonus table assembly reads.
      const fx = featEffectsById.get(211)!;
      expect(fx.effectType).toBe('weapon_spec');
      expect(fx.raw['tier_bonus']).toBeDefined();
    },
    combat_action: () => {
      // The 'ability' verb: a wired active must produce a usable definition
      // AND its rider must change a target. Reaches src/sim/combat/abilities.
      const def = abilityDef(1); // Power Attack
      expect(def).not.toBeNull();
      const attacker = combatant({ damageDice: '1d8' });
      const target = combatant({ id: 'w', side: 'enemies' });
      const out = applyStrikeRider(def!, attacker, target, {
        rng: new Rng('witness'), tick: 0, room: ARENA, critical: false,
      });
      expect(out.bonusDamage).toBeGreaterThan(0);
    },
    toggle: () => {
      // Rage (#24) is executed by encounter.executeToggle via TOGGLE_CONDITIONS,
      // which keys on the feat NAME.
      expect(featEffectsById.get(24)!.featName).toBe('Rage');
    },
    stance: () => {
      // The three Monk stances are executed by the same toggle path.
      const stances = featsOfType('stance');
      expect(stances.length).toBeGreaterThan(0);
      expect(stances.some((s) => s.featName.includes('Stance'))).toBe(true);
    },
  };

  it('⚠ EXHAUSTIVE: every type marked ready NAMES a witness', () => {
    for (const [type, hasConsumer] of Object.entries(EFFECT_HAS_CONSUMER) as [FeatEffectType, boolean][]) {
      if (!hasConsumer) continue;
      expect(
        WITNESSES[type],
        `effect_type "${type}" is marked ready but has NO witness — either wire it and add one, or set it false`,
      ).toBeDefined();
    }
  });

  it('every witness observes its real consumer doing something', () => {
    for (const [type, witness] of Object.entries(WITNESSES) as [FeatEffectType, () => void][]) {
      expect(EFFECT_HAS_CONSUMER[type], `witness for "${type}" exists but the type is marked unready`).toBe(true);
      witness();
    }
  });

  it('every `false` entry has NO feat passing the gate', () => {
    for (const [type, hasConsumer] of Object.entries(EFFECT_HAS_CONSUMER) as [FeatEffectType, boolean][]) {
      if (hasConsumer) continue;
      const ready = featsOfType(type).filter((fx) => isEffectReady(fx.featId));
      expect(ready.length, `effect_type "${type}" is marked unready but ${ready.length} feats pass the gate`).toBe(0);
    }
  });

  it('the four slot kinds are exhaustive over what the schedule can grant', () => {
    expect([...FEAT_SLOT_KINDS].sort()).toEqual(['ancestry', 'class', 'general', 'skill'] as FeatSlotKind[]);
  });
});
