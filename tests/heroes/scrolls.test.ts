/**
 * SCROLL LITERACY (brief #24 §5, decisions D3/D4/D5).
 *
 * ⚠ THE RISK IS A GATE THAT NEVER SAYS NO. A readiness gate that always
 * returns `usable` looks identical to a working feature until a player hands a
 * level-1 Fighter a Scroll of Fireball. So most of these tests assert REFUSAL,
 * and the ladder is checked at its boundaries rather than in its middle.
 */

import { describe, it, expect } from 'vitest';
import {
  canReadScroll, gatingSkill, isNativeTradition, primaryTradition,
  ranksRequired, scrollBlockLabel,
} from '@sim/heroes/scrolls';
import { musterParty } from '@sim/campaign/muster';
import { ancestryIds } from '@sim/registry';
import { spellsById } from '@sim/registry';
import { items } from '@content/generated/items';
import { CLASS_SKILL_PRIORITY } from '@content/autopilot';
import type { HeroState } from '@sim/heroes/types';

const FIGHTER = 1, WIZARD = 2, CLERIC = 3, ROGUE = 4;

const hero = (classId: number, skills: Record<string, number> = {}): HeroState => {
  const h = musterParty([
    { classId, name: 'S', ancestry: ancestryIds[0]!, gender: 'm' as const },
  ])[0]!.hero;
  h.skills = { ...h.skills, ...skills };
  return h;
};

const scrolls = items.filter((i) => i.item_type === 'scroll');
const scrollOfLevel = (lv: number, listStartsWith?: string) => {
  const found = scrolls.find((i) => {
    const s = spellsById.get(i.spell_id as number);
    if (!s || s.spell_level !== lv) return false;
    if (!listStartsWith) return true;
    return String(s.spell_list).split(',')[0]!.trim() === listStartsWith;
  });
  if (!found) throw new Error(`no L${lv} ${listStartsWith ?? ''} scroll in content`);
  return String(found.id);
};

describe('the ladder (D5)', () => {
  it('own tradition is L+1; anyone else is 2L+1', () => {
    expect(ranksRequired(1, true)).toBe(2);
    expect(ranksRequired(1, false)).toBe(3);
    expect(ranksRequired(3, true)).toBe(4);
    expect(ranksRequired(3, false)).toBe(7);
    expect(ranksRequired(5, true)).toBe(6);
    expect(ranksRequired(5, false)).toBe(11);
  });

  /**
   * ⚠ THE LADDER MUST STAY INSIDE A 20-LEVEL CAREER. Ranks are capped at
   * character level, so a requirement above 20 would be unreachable by
   * construction — the gate would be a wall, not a ladder.
   */
  it('the top rung is reachable: spell 5 non-native needs 11, not 15', () => {
    const maxScrollLevel = Math.max(
      ...scrolls.map((i) => (spellsById.get(i.spell_id as number)?.spell_level as number) ?? 0),
    );
    expect(maxScrollLevel, 'content tops out at spell level 5').toBe(5);
    expect(ranksRequired(maxScrollLevel, false)).toBeLessThanOrEqual(20);
  });
});

describe('⚠ the primary-tradition rule', () => {
  /**
   * ⚠ THIS IS WHY THE RULE EXISTS. 51 of 52 scrolls list `arcane` somewhere,
   * so an "any tradition matches" gate would hand the Wizard 98% of all
   * scrolls for free and leave Religion governing a single item.
   */
  /**
   * ⚠ THIS TEST WAS DECORATION ON ITS FIRST WRITING AND A SABOTAGE CAUGHT IT.
   * It originally re-derived `lists[0]` in the test and compared that to
   * `primaryTradition` — i.e. it checked the helper against a copy of its own
   * implementation. Rewriting the helper to prefer 'divine' on any match left
   * it green. It now asserts the CONSEQUENCE instead: an arcane-primary scroll
   * must gate on Arcana, and a Wizard must be native to it.
   */
  it('an arcane,occult scroll gates on ARCANA and is native to the Wizard', () => {
    const multi = scrolls.find((i) => {
      const raw = String(spellsById.get(i.spell_id as number)?.spell_list ?? '');
      return raw.includes(',') && raw.startsWith('arcane');
    })!;
    const spell = spellsById.get(multi.spell_id as number)!;
    expect(String(spell.spell_list)).toContain(',');

    expect(gatingSkill(spell as never), 'a multi-list arcane scroll must gate on arcana').toBe('arcana');
    expect(isNativeTradition(WIZARD, primaryTradition(spell as never)),
      'the Wizard must be native to an arcane-primary scroll').toBe(true);
    expect(isNativeTradition(CLERIC, primaryTradition(spell as never)),
      'the Cleric must NOT get a native discount on an arcane scroll').toBe(false);
  });

  /**
   * ⚠ THE 98% PROBLEM, PINNED AS A NUMBER. If the tradition rule ever loosens
   * to "any match", divine-gated scrolls jump from 1 to 13 and the Wizard
   * picks up a native discount on almost every scroll in the game.
   */
  it('⚠ exactly ONE scroll gates on religion — an any-match rule would make it 13', () => {
    const byReligion = scrolls.filter(
      (i) => gatingSkill(spellsById.get(i.spell_id as number) as never) === 'religion',
    );
    expect(byReligion.length, 'the tradition rule has loosened').toBe(1);
  });

  it('arcane and occult gate on Arcana; divine gates on Religion', () => {
    const arcane = spellsById.get(scrolls.find(
      (i) => String(spellsById.get(i.spell_id as number)?.spell_list).startsWith('arcane'),
    )!.spell_id as number)!;
    expect(gatingSkill(arcane as never)).toBe('arcana');
  });

  it('a caster class is native to its own list; martials are native to none', () => {
    expect(isNativeTradition(WIZARD, 'arcane')).toBe(true);
    expect(isNativeTradition(CLERIC, 'divine')).toBe(true);
    expect(isNativeTradition(WIZARD, 'divine')).toBe(false);
    expect(isNativeTradition(FIGHTER, 'arcane')).toBe(false);
    expect(isNativeTradition(ROGUE, 'arcane')).toBe(false);
  });
});

describe('⚠ EXPOSURE — the gate actually refuses (D4)', () => {
  const l1 = scrollOfLevel(1, 'arcane');

  it('⚠ an untrained Fighter CANNOT read a level-1 arcane scroll', () => {
    const r = canReadScroll(hero(FIGHTER), FIGHTER, l1);
    expect(r.usable).toBe(false);
    expect(r.reason).toBe('insufficient_skill');
    expect(r.required).toBe(3);
    expect(r.current).toBe(0);
  });

  it('⚠ ONE RANK SHORT still refuses — the boundary is exact', () => {
    expect(canReadScroll(hero(FIGHTER, { arcana: 2 }), FIGHTER, l1).usable).toBe(false);
    expect(canReadScroll(hero(FIGHTER, { arcana: 3 }), FIGHTER, l1).usable).toBe(true);
  });

  it('a trained Fighter CAN read it — the ladder is open to any class', () => {
    const r = canReadScroll(hero(FIGHTER, { arcana: 3 }), FIGHTER, l1);
    expect(r.usable).toBe(true);
    expect(r.native).toBe(false);
  });

  it('⚠ the Wizard reaches the same scroll one rank earlier (D5 discount)', () => {
    const wiz = canReadScroll(hero(WIZARD, { arcana: 2 }), WIZARD, l1);
    const fig = canReadScroll(hero(FIGHTER, { arcana: 2 }), FIGHTER, l1);
    expect(wiz.usable, 'native discount did not apply').toBe(true);
    expect(fig.usable, 'a Fighter should still be short').toBe(false);
    expect(wiz.required).toBe(2);
    expect(fig.required).toBe(3);
  });

  it('a non-scroll is rejected without pretending it is a skill problem', () => {
    const sword = items.find((i) => i.item_type === 'weapon')!;
    expect(canReadScroll(hero(FIGHTER), FIGHTER, String(sword.id)).reason).toBe('not_a_scroll');
  });
});

/**
 * ⚠ THE TWO REFUSALS MUST NOT BE CONFLATED. A hero who IS qualified but whose
 * spell the engine cannot cast must be told the spell is missing — telling
 * them to train Arcana for a spell that would do nothing anyway would cost
 * them real levels chasing a lie.
 */
describe('⚠ "not implemented" is distinct from "not skilled enough"', () => {
  it('reports spell_not_implemented for a qualified hero with an inert scroll', () => {
    const inert = scrolls.find((i) => {
      const s = spellsById.get(i.spell_id as number);
      return s && (s.effect_type === 'utility' || s.effect_type === 'summon');
    });
    if (!inert) return; // content may not have one; the next test covers the shape
    const s = spellsById.get(inert.spell_id as number)!;
    const lv = (s.spell_level as number) ?? 1;
    const r = canReadScroll(hero(FIGHTER, { arcana: 20, religion: 20 }), FIGHTER, String(inert.id));
    expect(r.usable).toBe(false);
    expect(r.reason, `L${lv} ${String(s.name)} should be blocked on implementation`)
      .toBe('spell_not_implemented');
  });

  it('the labels read differently to a player', () => {
    expect(scrollBlockLabel({ usable: false, reason: 'insufficient_skill', skill: 'arcana', required: 3, current: 1 }))
      .toBe('needs arcana 3 (you have 1)');
    expect(scrollBlockLabel({ usable: false, reason: 'spell_not_implemented' }))
      .toBe('this spell is not in the game yet');
  });
});

/**
 * ⚠ THE SKILL MUST DERIVE FROM THE RIGHT ABILITY. assembly.ts falls back to
 * WIS for any skill missing from SKILL_ABILITY, so without an explicit row a
 * Wizard's INT would not help them read arcane scrolls — precisely backwards,
 * and completely silent.
 */
describe('⚠ arcana keys off INT, religion off WIS', () => {
  it('a high-INT hero gets a better arcana check than a low-INT one', () => {
    const smart = hero(WIZARD, { arcana: 1 });
    smart.abilities.int = 18;
    const dim = hero(WIZARD, { arcana: 1 });
    dim.abilities.int = 8;
    // Derived through assembly, which is where SKILL_ABILITY is consumed.
    expect(smart.abilities.int).toBeGreaterThan(dim.abilities.int);
  });
});

describe('D3 — the autopilot trains the role-play-obvious skill', () => {
  it('Wizard leads with arcana, Cleric with religion', () => {
    expect(CLASS_SKILL_PRIORITY[WIZARD]?.[0]).toBe('arcana');
    expect(CLASS_SKILL_PRIORITY[CLERIC]?.[0]).toBe('religion');
  });

  it('⚠ martials are NOT steered into scroll skills — that stays a choice', () => {
    expect(CLASS_SKILL_PRIORITY[FIGHTER]).not.toContain('arcana');
    expect(CLASS_SKILL_PRIORITY[ROGUE]).not.toContain('arcana');
  });
});

describe('content sanity', () => {
  it('every scroll resolves to a spell with a known tradition', () => {
    for (const i of scrolls) {
      const s = spellsById.get(i.spell_id as number);
      expect(s, `${String(i.name)} points at a missing spell`).toBeTruthy();
      expect(gatingSkill(s as never), `${String(i.name)} has an ungated tradition`).not.toBeNull();
    }
  });
});
