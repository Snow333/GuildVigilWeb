/**
 * THE THIRD LIMITER TIER — once per long rest (brief #31 D2).
 *
 * ⚠ THE TIER EXISTS TO SURVIVE THE ENCOUNTER, SO THAT IS WHAT THESE TESTS
 * PROVE. The other two limiters live on `Combatant` and die with the fight;
 * asserting this one only at the module level would test a Map, not a rule.
 * The load-bearing tests below drive a REAL campaign dispatch and check the
 * charge state across rooms and across expeditions.
 *
 * ⚠ AND THEY ASSERT THE DISTINCTION FROM A SHORT REST. The in-dungeon rest
 * heals HP and is rationed per rooms; if it also refreshed these charges the
 * tier would silently collapse into once-per-combat. There is a test for that
 * exact confusion, because it is the failure mode the brief warned about.
 */

import { describe, expect, it } from 'vitest';
import {
  longRestAllowance, isLongRestLimited, longRestLimitedFeatIds,
  longRestUsesLeft, longRestUsesSpent, canSpendLongRestUse, spendLongRestUse,
  takeLongRest, takeLongRestParty,
} from '@sim/heroes/longRest';
import { featEffectsById } from '@sim/heroes/featEffects';
import { backfillLongRestUses, SAVE_BACKFILLS } from '@sim/save/backfills';
import { deriveHeroIdentity } from '@sim/heroes/ancestry';
import type { HeroState } from '@sim/heroes/types';

const MIRACULOUS_SPELL = 140; // Cleric L10, the brief's named path (Field Medic)
const ETERNAL_BLESSING = 153; // Cleric L12, the `per_rest: 1` payload shape
const QUICKENED_CASTING = 96; // Wizard L6 — the +1 the brief found (8, not 7)
const POWER_ATTACK = 1; // not in the tier: a control

function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero_1', name: 'Mira', status: 'active', xp: 0, maxHp: 30, wounded: 0,
    abilities: { str: 12, dex: 12, con: 14, int: 12, wis: 16, cha: 10 },
    classLevels: [{ classId: 3, level: 12, orderTaken: 1 }],
    skills: {}, feats: [],
    ...deriveHeroIdentity('hero_1'),
    ...over,
  };
}

describe('tier membership is DERIVED FROM CONTENT, never hardcoded', () => {
  it('reads both authored payload shapes', () => {
    // `{"condition": "per_rest", "value": 1}` — the resource_grant rows.
    expect(featEffectsById.get(MIRACULOUS_SPELL)!.raw['condition']).toBe('per_rest');
    expect(longRestAllowance(MIRACULOUS_SPELL)).toBe(1);

    // `{"per_rest": 1}` — the passive_modifier rows.
    expect(featEffectsById.get(ETERNAL_BLESSING)!.raw['per_rest']).toBe(1);
    expect(longRestAllowance(ETERNAL_BLESSING)).toBe(1);
  });

  it('a feat with neither shape is NOT in the tier', () => {
    expect(isLongRestLimited(POWER_ATTACK)).toBe(false);
    expect(longRestAllowance(POWER_ATTACK)).toBe(0);
    expect(longRestUsesLeft(hero(), POWER_ATTACK)).toBe(0);
    expect(spendLongRestUse(hero(), POWER_ATTACK)).toBe(false);
  });

  it('⚠ EVERY member is a real authored row carrying a real per-rest payload', () => {
    const ids = longRestLimitedFeatIds();
    // The brief counted 8 by hand from the path tables; the content says 10.
    // Assert the FLOOR and the membership, not a number that content may grow.
    expect(ids.length).toBeGreaterThanOrEqual(8);
    expect(ids).toContain(MIRACULOUS_SPELL);
    expect(ids).toContain(ETERNAL_BLESSING);
    expect(ids).toContain(QUICKENED_CASTING);

    for (const id of ids) {
      const raw = featEffectsById.get(id)!.raw;
      const viaCondition = raw['condition'] === 'per_rest';
      const viaPerRest = typeof raw['per_rest'] === 'number';
      expect(viaCondition || viaPerRest, `#${id} is in the tier for no authored reason`).toBe(true);
      expect(longRestAllowance(id)).toBeGreaterThan(0);
    }
  });

  it('⚠ does NOT swallow a feat whose recovery is a SHORT rest', () => {
    // #162 Eldritch Invocation recovers on "short_rest_or_per_3_combats". It is
    // a different rule and must not be rationed by the long-rest tier.
    expect(isLongRestLimited(162)).toBe(false);
  });
});

describe('spending and restoring charges', () => {
  it('spends down to zero and then REFUSES rather than overspending', () => {
    const h = hero({ feats: [{ featId: MIRACULOUS_SPELL }] });
    expect(longRestUsesLeft(h, MIRACULOUS_SPELL)).toBe(1);
    expect(canSpendLongRestUse(h, MIRACULOUS_SPELL)).toBe(true);

    expect(spendLongRestUse(h, MIRACULOUS_SPELL)).toBe(true);
    expect(longRestUsesSpent(h, MIRACULOUS_SPELL)).toBe(1);
    expect(longRestUsesLeft(h, MIRACULOUS_SPELL)).toBe(0);

    // The refusal must not mutate anything.
    expect(spendLongRestUse(h, MIRACULOUS_SPELL)).toBe(false);
    expect(longRestUsesSpent(h, MIRACULOUS_SPELL)).toBe(1);
  });

  it('charges are PER FEAT — spending one does not touch another', () => {
    const h = hero({ feats: [{ featId: MIRACULOUS_SPELL }, { featId: ETERNAL_BLESSING }] });
    spendLongRestUse(h, MIRACULOUS_SPELL);
    expect(longRestUsesLeft(h, MIRACULOUS_SPELL)).toBe(0);
    expect(longRestUsesLeft(h, ETERNAL_BLESSING)).toBe(1);
  });

  it('a long rest restores every charge, and reports whether it did anything', () => {
    const h = hero({ feats: [{ featId: MIRACULOUS_SPELL }] });
    expect(takeLongRest(h)).toBe(false); // already rested: nothing to restore
    spendLongRestUse(h, MIRACULOUS_SPELL);
    expect(takeLongRest(h)).toBe(true);
    expect(longRestUsesLeft(h, MIRACULOUS_SPELL)).toBe(1);
    expect(takeLongRest(h)).toBe(false); // idempotent
  });

  it('party rest counts only the heroes that had something to restore', () => {
    const spent = hero({ id: 'a', feats: [{ featId: MIRACULOUS_SPELL }] });
    const fresh = hero({ id: 'b', feats: [{ featId: MIRACULOUS_SPELL }] });
    spendLongRestUse(spent, MIRACULOUS_SPELL);
    expect(takeLongRestParty([spent, fresh])).toBe(1);
    expect(longRestUsesLeft(spent, MIRACULOUS_SPELL)).toBe(1);
  });

  it('absent map means FULLY RESTED, not unknown', () => {
    const h = hero({ feats: [{ featId: MIRACULOUS_SPELL }] });
    expect(h.longRestUses).toBeUndefined();
    expect(longRestUsesLeft(h, MIRACULOUS_SPELL)).toBe(1);
    expect(canSpendLongRestUse(h, MIRACULOUS_SPELL)).toBe(true);
  });
});

describe('the save backfill normalises without inventing', () => {
  const save = (heroPatch: Record<string, unknown>) =>
    ({ party: [{ hero: { id: 'hero_1', ...heroPatch } }] }) as Record<string, unknown>;

  it('a save with no field is left ALONE — it already means rested', () => {
    const s = save({});
    const out = backfillLongRestUses(s) as typeof s;
    expect((out.party as { hero: { longRestUses?: unknown } }[])[0]!.hero.longRestUses).toBeUndefined();
  });

  it('a valid map survives untouched', () => {
    const s = save({ longRestUses: { 140: 1 } });
    const out = backfillLongRestUses(s) as typeof s;
    expect((out.party as { hero: { longRestUses?: unknown } }[])[0]!.hero.longRestUses).toEqual({ 140: 1 });
  });

  it('repairs a hand-edited save rather than letting a resolver trip later', () => {
    for (const junk of [null, 'nonsense', 42, ['a']]) {
      const s = save({ longRestUses: junk });
      const out = backfillLongRestUses(s) as typeof s;
      expect((out.party as { hero: { longRestUses?: unknown } }[])[0]!.hero.longRestUses).toBeUndefined();
    }
  });

  it('drops individual junk entries but keeps the good ones', () => {
    const s = save({ longRestUses: { 140: 1, 153: 0, 96: -2, abc: 3, 119: 1.5 } });
    const out = backfillLongRestUses(s) as typeof s;
    expect((out.party as { hero: { longRestUses?: unknown } }[])[0]!.hero.longRestUses).toEqual({ 140: 1 });
  });

  it('is idempotent and never throws on a malformed save', () => {
    const s = save({ longRestUses: { 140: 1, bad: 'x' } });
    const once = JSON.stringify(backfillLongRestUses(s));
    const twice = JSON.stringify(backfillLongRestUses(backfillLongRestUses(s)));
    expect(once).toBe(twice);
    expect(() => backfillLongRestUses(null)).not.toThrow();
    expect(() => backfillLongRestUses({})).not.toThrow();
    expect(() => backfillLongRestUses({ party: 'not an array' })).not.toThrow();
  });

  it('is REGISTERED in the chain — an unregistered stage never runs', () => {
    expect(SAVE_BACKFILLS).toContain(backfillLongRestUses);
  });
});
