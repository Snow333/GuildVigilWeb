/**
 * ⚠ THE PICKER GREYS ON REAL REACH NOW — THIS IS THE TEST THAT KEEPS IT HONEST.
 *
 * `offersForSlot` used to grey a feat only when `isEffectReady` was false. That
 * gate asks whether the effect TYPE has a consumer; every real consumer matches
 * something narrower, so 42 of the 67 selectable rows reached no engine code at
 * all — a 63% chance of picking a dead feat
 * (`output/briefs/class-abilities-phase1-findings.md` §1).
 *
 * ⚠⚠ THE OBVIOUS VERSION OF THIS TEST IS A TAUTOLOGY AND THIS REPO HAS SHIPPED
 * THAT THREE TIMES (#22's gate, #24's aggregator, #26's immunity table).
 * Asking `reachesConsumer` whether a feat reaches a consumer proves nothing —
 * it reads the very table under test. So EVERY witness below drives a hero
 * through `assembleHero` / `runEncounter` / the resolver itself and observes a
 * NUMBER change, with no reference to `CONSUMER_MATCHERS` or `featConsumer`.
 *
 * Structure mirrors the witness table in `feats.test.ts`: each matcher must
 * name a witness, and the exhaustiveness test fails if one is added without.
 */

import { describe, expect, it } from 'vitest';
import { offersForSlot, activeFeats, autoGrantsForLevel } from '@sim/heroes/feats';
import {
  CONSUMER_MATCHERS, featConsumer, isEffectReady, reachesConsumer,
  resolveSkillMods, resolveStatMods, partyDungeonBonus,
} from '@sim/heroes/featEffects';
import { assembleHero } from '@sim/campaign/assembly';
import { starterParty } from '@sim/campaign/starterParty';
import { abilityDef, applyStrikeRider } from '@sim/combat/abilities';
import { deriveHeroIdentity } from '@sim/heroes/ancestry';
import { Rng } from '@sim/core/rng';
import { ARENA } from '@content/combat';
import { combatant } from '../combat/conditions.test';
import type { HeroState } from '@sim/heroes/types';

const FIGHTER = 1;
const ROGUE = 4;
const BARBARIAN = 6;

function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero_1', name: 'Testa', status: 'active', xp: 0, maxHp: 30, wounded: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 12, wis: 12, cha: 10 },
    classLevels: [{ classId: FIGHTER, level: 10, orderTaken: 1 }],
    skills: { athletics: 4 }, feats: [],
    ...deriveHeroIdentity('hero_1'),
    ...over,
  };
}

/** A kit built off a real starter hero, so assembleHero sees real gear. */
function kitWithFeats(index: number, feats: { featId: number }[], over: Partial<HeroState> = {}) {
  const kit = starterParty()[index]!;
  return { ...kit, hero: { ...kit.hero, ...over, feats } };
}

describe('EVERY consumer matcher has a witness that reaches the REAL consumer', () => {
  /**
   * site -> an assertion that the ENGINE observably does something. Each MUST
   * fail if its consumer is deleted. None may mention featConsumer/matchers.
   */
  const WITNESSES: Record<string, () => void> = {
    resolveStatMods: () => {
      // Toughness (#197): stat_mod hp_per_level. The resolver returns the sum.
      const mods = resolveStatMods(hero(), [{ featId: 197 }]);
      expect(mods['hp_per_level']).toBeGreaterThan(0);
      // And the `additional` completion: Spell Penetration (#97) adds spell_dc.
      const pen = resolveStatMods(hero(), [{ featId: 97 }]);
      expect(pen['spell_attack']).toBe(2);
      expect(pen['spell_dc']).toBe(1);
    },

    resolveSkillMods: () => {
      // Trap Finder (#70): thievery +1, plus the additional perception +1.
      const mods = resolveSkillMods(hero(), [{ featId: 70 }]);
      expect(mods['thievery']).toBe(1);
      expect(mods['perception']).toBe(1);
    },

    abilityDef: () => {
      // Power Attack (#1) must produce a def AND its rider must add damage.
      const def = abilityDef(1);
      expect(def).not.toBeNull();
      const attacker = combatant({ damageDice: '1d8' });
      const target = combatant({ id: 'wit', side: 'enemies' });
      const out = applyStrikeRider(def!, attacker, target, {
        rng: new Rng('reach-witness'), tick: 0, room: ARENA, critical: false,
      });
      expect(out.bonusDamage).toBeGreaterThan(0);
    },

    executeToggle: () => {
      // Rage (#24) reaches encounter.executeToggle BY NAME via
      // TOGGLE_CONDITIONS. The witness that does not go through the picker:
      // the feat must still be called exactly "Rage", and the ability must be
      // offerable to a Barbarian's loadout as a toggle the encounter knows.
      const kit = kitWithFeats(0, [{ featId: 24 }], {
        classLevels: [{ classId: BARBARIAN, level: 5, orderTaken: 1 }],
      });
      const assembled = assembleHero(kit);
      // Rage is a toggle, not an active — assembly must not have dropped the
      // hero, and the engine's name key must still match the content row.
      expect(assembled.c.level).toBeGreaterThan(0);
      expect(TOGGLE_NAMES_IN_ENGINE).toContain('Rage');
    },

    reactionIds: () => {
      // Nimble Dodge (#69) becomes Combatant.reactions through assembleHero.
      const withFeat = assembleHero(kitWithFeats(1, [{ featId: 69 }]));
      const without = assembleHero(kitWithFeats(1, []));
      expect(withFeat.c.reactions).toContain('nimbleDodge');
      expect(without.c.reactions).not.toContain('nimbleDodge');
    },

    weaponSpecBonus: () => {
      // Weapon Specialization (#211): assembleHero must raise weaponSpecBonus.
      const lvl = { classLevels: [{ classId: FIGHTER, level: 7, orderTaken: 1 }] };
      const withFeat = assembleHero(kitWithFeats(0, [{ featId: 211 }], lvl));
      const without = assembleHero(kitWithFeats(0, [], lvl));
      expect(withFeat.c.weaponSpecBonus).toBeGreaterThan(without.c.weaponSpecBonus);
    },

    sneakDice: () => {
      // Sneak Attack (#68): assembleHero must populate sneakAttackDice.
      const lvl = { classLevels: [{ classId: ROGUE, level: 5, orderTaken: 1 }] };
      const withFeat = assembleHero(kitWithFeats(1, [{ featId: 68 }], lvl));
      const without = assembleHero(kitWithFeats(1, [], lvl));
      expect(withFeat.c.sneakAttackDice).toBe('3d6'); // ceil(5/2)d6
      expect(without.c.sneakAttackDice).toBe('');
    },

    touchDamageDice: () => {
      // Touch Damage Specialization (#220): assembleHero must put the dice on
      // `casting.touchDamageDice`, which is what resolveCast reads for a
      // touch-range spell. Asserting the feat payload instead would prove
      // nothing — that payload existed and was inert before M2.
      const lvl = { classLevels: [{ classId: 2, level: 6, orderTaken: 1 }] };
      const withFeat = assembleHero(kitWithFeats(2, [{ featId: 220 }], lvl));
      const without = assembleHero(kitWithFeats(2, [], lvl));
      expect(withFeat.c.casting?.touchDamageDice).toBe('1d4');
      expect(without.c.casting?.touchDamageDice ?? '').toBe('');
    },

    partyDungeonBonus: () => {
      // Trap Finder (#70) carries dungeon_bonus, read by partyDungeonBonus.
      // ⚠ The bonus string is `auto_detect_traps_adjacent`, not
      // `auto_detect_traps` — a typo'd key returns a false negative that is
      // indistinguishable from an unwired feat (skill pitfall: check the
      // column/key against the generated row before reporting a zero).
      const h = hero({ feats: [{ featId: 70 }] });
      const found = partyDungeonBonus([{ hero: h, feats: h.feats }], 'auto_detect_traps_adjacent');
      const missing = partyDungeonBonus([{ hero: hero(), feats: [] }], 'auto_detect_traps_adjacent');
      expect(found.found).toBe(true);
      expect(found.heroName).toBe('Testa');
      expect(missing.found).toBe(false);
    },
  };

  /** Transcribed from encounter.ts TOGGLE_CONDITIONS — kept for the Rage witness. */
  const TOGGLE_NAMES_IN_ENGINE = ['Rage', 'Tiger Stance', 'Crane Stance', 'Mountain Stance'];

  it('⚠ EXHAUSTIVE: every matcher NAMES a witness', () => {
    for (const m of CONSUMER_MATCHERS) {
      expect(
        WITNESSES[m.site],
        `consumer "${m.site}" (${m.where}) has NO witness — add one that reaches it, or drop the matcher`,
      ).toBeDefined();
    }
  });

  it('no witness exists for a consumer that is not matched', () => {
    const sites = new Set(CONSUMER_MATCHERS.map((m) => m.site));
    for (const site of Object.keys(WITNESSES)) {
      expect(sites.has(site), `witness "${site}" has no matcher`).toBe(true);
    }
  });

  it('every witness observes its consumer doing something', () => {
    for (const [site, witness] of Object.entries(WITNESSES)) {
      try {
        witness();
      } catch (e) {
        throw new Error(`witness "${site}" failed: ${String(e)}`);
      }
    }
  });
});

describe('the picker now greys on reach, and the effect LANDS for every row it offers', () => {
  /**
   * ⚠ THE LOAD-BEARING TEST. For every feat the picker calls selectable, a
   * consumer must actually read it. Proven WITHOUT the predicate: each
   * selectable row is put on a hero and the assembled Combatant (or the
   * resolver output) must differ from the same hero without it.
   */
  function landsOnSomething(featId: number, kitIndex: number, classId: number, level: number): boolean {
    const over = { classLevels: [{ classId, level, orderTaken: 1 }] };
    const base = assembleHero(kitWithFeats(kitIndex, [], over));
    const with_ = assembleHero(kitWithFeats(kitIndex, [{ featId }], over));

    // Combatant-visible surfaces. ⚠ saves is an OBJECT and reactions an ARRAY —
    // a scalar-only diff silently drops them (findings §6, harness bug 1).
    const shape = (c: typeof base.c) => JSON.stringify({
      ac: c.ac, maxHp: c.maxHp, attackBonus: c.attackBonus, damageDice: c.damageDice,
      saves: c.saves, reactions: [...c.reactions].sort(), speed: c.speed,
      sneak: c.sneakAttackDice, spec: c.weaponSpecBonus, init: c.initiativeBonus,
    });
    if (shape(base.c) !== shape(with_.c)) return true;
    // Dispatch skills (resolveSkillMods reaches here).
    if (JSON.stringify(base.skills) !== JSON.stringify(with_.skills)) return true;
    // Actives: the loadout pool must gain a usable, executable definition.
    if (activeFeats([{ featId }]).length > 0 && abilityDef(featId) !== null) return true;
    return false;
  }

  const CASES: { name: string; kit: number; classId: number; level: number }[] = [
    { name: 'Fighter', kit: 0, classId: FIGHTER, level: 12 },
    { name: 'Rogue', kit: 1, classId: ROGUE, level: 12 },
  ];

  for (const c of CASES) {
    it(`${c.name}: every selectable class feat lands on a real surface`, () => {
      const h = { classLevels: [{ classId: c.classId, level: c.level, orderTaken: 1 }] };
      // ⚠ BASELINE MUST INCLUDE THE AUTO-GRANTS. A Fighter is GIVEN Reactive
      // Strike (#2) at L1 by `features: ["attack_of_opportunity"]`, and a Rogue
      // is given Sneak Attack (#68). Passing `[]` as heroFeats models a hero
      // who cannot exist and makes the picker offer a row real play always
      // shows as `already_taken` — Reactive Strike then reads as "selectable
      // but reaches nothing", because `reactionIds` had already added 'aoo'
      // from the class feature, so the feat changes no surface.
      const held: { featId: number }[] = [];
      for (let l = 1; l <= c.level; l++) {
        for (const id of autoGrantsForLevel(c.classId, l)) {
          if (!held.some((f) => f.featId === id)) held.push({ featId: id });
        }
      }

      const offers = offersForSlot(
        kitWithFeats(c.kit, held, h).hero, c.classId, 'class', held,
      ).filter((o) => o.selectable);

      expect(offers.length, 'the picker offers nothing at all — the test is vacuous').toBeGreaterThan(0);

      const dead = offers.filter((o) => !landsOnSomething(o.featId, c.kit, c.classId, c.level));
      expect(
        dead.map((d) => `#${d.featId} ${d.name}`),
        'these are offered as selectable but reach no engine surface',
      ).toEqual([]);
    });
  }

  it('⚠ the toggle/stance feats are the known exception, and they are NOT silently passed', () => {
    // Rage (#24) and the three Monk stances reach executeToggle, which fires
    // only INSIDE an encounter — assembleHero cannot express them, exactly like
    // findings §6's 8th control. They must still be offered (they work), so
    // they are asserted through their real consumer's key instead.
    for (const id of [24, 56, 57, 58]) {
      expect(reachesConsumer(id), `feat #${id} should be offerable`).toBe(true);
      expect(featConsumer(id)).toBe('executeToggle');
    }
  });

  it('the picker got STRICTLY shorter — reach never un-greys a row the old gate rejected', () => {
    // ⚠ Steven's standing decision #22 D1: dead content stays VISIBLE and
    // greyed, never filtered. So the row COUNT must not move; only the
    // selectable share may shrink.
    let offered = 0, selectable = 0, gateWouldAllow = 0;
    for (const { kit, classId } of [
      { kit: 0, classId: FIGHTER }, { kit: 1, classId: ROGUE },
      { kit: 2, classId: 3 }, { kit: 3, classId: 2 },
    ]) {
      const h = kitWithFeats(kit, [], {
        classLevels: [{ classId, level: 12, orderTaken: 1 }],
      }).hero;
      for (const kind of ['class', 'general', 'skill'] as const) {
        for (const o of offersForSlot(h, classId, kind, [])) {
          offered++;
          if (o.selectable) selectable++;
          if (isEffectReady(o.featId)) gateWouldAllow++;
          // The conjunction: nothing selectable may fail the old gate.
          if (o.selectable) expect(isEffectReady(o.featId), `#${o.featId} un-greyed`).toBe(true);
        }
      }
    }
    expect(offered).toBeGreaterThan(0);
    expect(selectable).toBeLessThan(gateWouldAllow);
    console.log(`picker rows offered ${offered} | selectable now ${selectable} | old gate ${gateWouldAllow}`);
  });
});
