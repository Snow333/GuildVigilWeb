/**
 * KNOWN SPELLS — the pool half of core-loop D4 (brief #22 M3).
 */

import { describe, expect, it } from 'vitest';
import {
  castableSpells, isSpellResolvable, learnableSpells, maxSpellLevel, onSpellList,
  RESOLVABLE_EFFECTS, spellOffers, spellsLearnedAtLevel,
} from '@sim/heroes/knownSpells';
import { backfillKnownSpells } from '@sim/save/backfills';
import { deriveHeroIdentity } from '@sim/heroes/ancestry';
import { spellsByName } from '@sim/registry';
import { spells } from '@content/generated';
import type { HeroState } from '@sim/heroes/types';

const FIGHTER = 1;
const WIZARD = 2;
const CLERIC = 3;
const ROGUE = 4;

function caster(classId: number, level: number, known: number[] = []): HeroState {
  return {
    id: 'hero_c', name: 'Elandra', status: 'active', xp: 0, maxHp: 20, wounded: 0,
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    classLevels: [{ classId, level, orderTaken: 1 }],
    skills: {}, feats: [], knownSpells: known,
    ...deriveHeroIdentity('hero_c'),
  };
}

describe('the slot schedule bounds what can be learned', () => {
  it('a level-1 caster reaches spell level 1; a level-5 caster reaches 3', () => {
    expect(maxSpellLevel(WIZARD, 1)).toBe(1);
    expect(maxSpellLevel(WIZARD, 3)).toBe(2);
    expect(maxSpellLevel(WIZARD, 5)).toBe(3);
    expect(maxSpellLevel(CLERIC, 5)).toBe(3);
  });

  it('spells above the ceiling are offered but greyed level_unmet', () => {
    const offers = spellOffers(caster(WIZARD, 1), WIZARD);
    const high = offers.find((o) => o.spellLevel === 5);
    expect(high).toBeDefined();
    expect(high!.selectable).toBe(false);
    expect(high!.reason).toBe('level_unmet');
  });

  it('a martial class has no spell list and no offers', () => {
    expect(spellOffers(caster(FIGHTER, 5), FIGHTER)).toHaveLength(0);
    expect(spellOffers(caster(ROGUE, 5), ROGUE)).toHaveLength(0);
    expect(spellsLearnedAtLevel(FIGHTER, 2)).toBe(0);
  });
});

describe('the tradition filter', () => {
  it('a wizard is offered arcane spells, a cleric divine', () => {
    for (const o of spellOffers(caster(WIZARD, 5), WIZARD)) {
      const row = spells.find((s) => s.id === o.spellId)!;
      expect(onSpellList(row, 'arcane')).toBe(true);
    }
    for (const o of spellOffers(caster(CLERIC, 5), CLERIC)) {
      const row = spells.find((s) => s.id === o.spellId)!;
      expect(onSpellList(row, 'divine')).toBe(true);
    }
  });

  it('multi-tradition rows appear on every list they name', () => {
    // 4 of 8 spell_list values are multi-tradition ('arcane,occult' etc), so a
    // substring match would be wrong and an exact match would drop them.
    const dual = spells.find((s) => (s.spell_list as string).includes(',') && (s.spell_list as string).includes('arcane'));
    expect(dual).toBeDefined();
    expect(onSpellList(dual!, 'arcane')).toBe(true);
  });
});

describe('⚠ the pool is mostly future content, and it is SHOWN not hidden', () => {
  it('only damage and healing resolve today', () => {
    expect([...RESOLVABLE_EFFECTS].sort()).toEqual(['damage', 'healing']);
  });

  it('an inert spell is offered, greyed not_yet_implemented', () => {
    const offers = spellOffers(caster(WIZARD, 9), WIZARD);
    const inert = offers.find((o) => !RESOLVABLE_EFFECTS.has(o.effectType));
    expect(inert).toBeDefined();
    expect(inert!.selectable).toBe(false);
    expect(inert!.reason).toBe('not_yet_implemented');
  });

  it('MEASURED: the arcane L1 menu is 3 learnable of 22 offered', () => {
    // ⚠ This is the honest number and it is the argument for landing the
    // buff/debuff resolvers next. If it ever rises without that brief, the
    // filter has been loosened and the picker is lying again.
    const offers = spellOffers(caster(WIZARD, 1), WIZARD).filter((o) => o.spellLevel === 1);
    const learnable = offers.filter((o) => o.selectable);
    expect(offers.length).toBe(22);
    expect(learnable.length).toBe(3);
  });

  it('every learnable spell is one resolveCast can actually execute', () => {
    for (const o of learnableSpells(caster(WIZARD, 9), WIZARD)) {
      expect(RESOLVABLE_EFFECTS.has(o.effectType)).toBe(true);
    }
  });

  it('a known spell is marked already_taken rather than offered again', () => {
    const magicMissile = spellsByName.get('Magic Missile')!.id;
    const offers = spellOffers(caster(WIZARD, 5, [magicMissile]), WIZARD);
    const mm = offers.find((o) => o.spellId === magicMissile);
    expect(mm!.selectable).toBe(false);
    expect(mm!.reason).toBe('already_taken');
  });
});

describe('castableSpells feeds the loadout editor', () => {
  it('returns only the known spells the engine can cast, in level order', () => {
    const magicMissile = spellsByName.get('Magic Missile')!.id;
    const inert = spells.find((s) => !isSpellResolvable(s))!;
    const h = caster(WIZARD, 5, [inert.id, magicMissile]);
    expect(castableSpells(h)).toEqual([magicMissile]);
  });

  it('an unknown id in the pool is skipped, not fatal', () => {
    const h = caster(WIZARD, 5, [999_999]);
    expect(() => castableSpells(h)).not.toThrow();
    expect(castableSpells(h)).toEqual([]);
  });
});

describe('the save backfill recovers the pool from the loadout', () => {
  const heal = spellsByName.get('Heal')!.id;

  it('⚠ a pre-M3 save keeps its caster armed — Mira does not lose Heal', () => {
    const save = {
      party: [{
        hero: { id: 'hero_1', name: 'Mira' },
        loadout: [{ action: 'cast', spellId: heal, condition: { kind: 'allyHpBelow', pct: 0.4 }, target: 'lowestAlly' }],
      }],
    };
    const out = backfillKnownSpells(save) as typeof save & { party: { hero: { knownSpells?: number[] } }[] };
    expect(out.party[0]!.hero.knownSpells).toEqual([heal]);
  });

  it('is idempotent — running it twice changes nothing', () => {
    const save = {
      party: [{ hero: { id: 'hero_1' }, loadout: [{ action: 'cast', spellId: heal }] }],
    };
    const once = JSON.stringify(backfillKnownSpells(save));
    const twice = JSON.stringify(backfillKnownSpells(backfillKnownSpells(save)));
    expect(twice).toBe(once);
  });

  it('does not overwrite a pool that already exists', () => {
    const save = {
      party: [{ hero: { id: 'hero_1', knownSpells: [42] }, loadout: [{ action: 'cast', spellId: heal }] }],
    };
    const out = backfillKnownSpells(save) as typeof save;
    expect(out.party[0]!.hero.knownSpells).toEqual([42]);
  });

  it('⚠ a martial hero gets an EMPTY pool, never a guessed spell list', () => {
    const save = { party: [{ hero: { id: 'hero_1' }, loadout: [{ action: 'strike' }] }] };
    const out = backfillKnownSpells(save) as { party: { hero: { knownSpells?: number[] } }[] };
    expect(out.party[0]!.hero.knownSpells).toEqual([]);
  });

  it('survives a malformed save without throwing', () => {
    expect(() => backfillKnownSpells(null)).not.toThrow();
    expect(() => backfillKnownSpells({})).not.toThrow();
    expect(() => backfillKnownSpells({ party: 'nonsense' })).not.toThrow();
    expect(() => backfillKnownSpells({ party: [null] })).not.toThrow();
  });
});

describe('learn rate', () => {
  it('two at level 1, one per level after', () => {
    expect(spellsLearnedAtLevel(WIZARD, 1)).toBe(2);
    expect(spellsLearnedAtLevel(WIZARD, 2)).toBe(1);
    expect(spellsLearnedAtLevel(CLERIC, 5)).toBe(1);
  });
});
