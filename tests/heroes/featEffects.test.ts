import { describe, expect, it } from 'vitest';
import {
  EFFECT_DOMAIN, effectsByDomain, featEffectsById, partyDungeonBonus,
  resolveSkillMods, resolveStatMods, type FeatEffectType,
} from '@sim/heroes/featEffects';
import { deriveHeroIdentity } from '@sim/heroes/ancestry';
import type { HeroState } from '@sim/heroes/types';
import { feats } from '@content/generated';

function hero(classLevels: [number, number][] = [[1, 1]]): HeroState {
  return {
    id: 'hero_1', name: 'Testa', status: 'active', xp: 0, maxHp: 10, wounded: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    classLevels: classLevels.map(([classId, level], i) => ({ classId, level, orderTaken: i + 1 })),
    skills: {}, feats: [],
    ...deriveHeroIdentity('hero_1'),
  };
}

describe('THE WIRING TEST: every feat payload parses and classifies', () => {
  it('all 227 feats are indexed — zero unparseable, zero unknown types', () => {
    // buildIndex() throws at import time on any failure, so reaching here with
    // a full index IS the proof. The count pins it.
    expect(featEffectsById.size).toBe(feats.length);
    expect(featEffectsById.size).toBe(227);
  });

  it('effect_type distribution matches the source data (snapshot)', () => {
    const counts: Record<string, number> = {};
    for (const fx of featEffectsById.values()) counts[fx.effectType] = (counts[fx.effectType] ?? 0) + 1;
    // Known distribution from the Godot data profile (nuance sweep, verified at conversion):
    expect(counts).toEqual({
      passive_modifier: 119, combat_action: 51, reaction: 16, resource_grant: 12,
      stat_mod: 8, special: 6, stance: 4, skill_mod: 4, spell_modifier: 3,
      weapon_spec: 2, toggle: 1, conditional_stat_mod: 1,
    });
  });

  it('every effect type has an owning domain, and every feat derives affects metadata', () => {
    for (const fx of featEffectsById.values()) {
      expect(EFFECT_DOMAIN[fx.effectType as FeatEffectType]).toBeDefined();
    }
    // Passive-domain feats must ALL have non-empty affects — they are pure wiring.
    for (const fx of effectsByDomain('passive')) {
      expect(fx.affects.length, `feat #${fx.featId} ${fx.featName}`).toBeGreaterThan(0);
    }
  });
});

describe('passive stat_mod resolution (ported + completed)', () => {
  it('Spell Penetration (#97): +2 spell_attack AND the additional +1 spell_dc', () => {
    const mods = resolveStatMods(hero(), [{ featId: 97 }]);
    expect(mods['spell_attack']).toBe(2);
    expect(mods['spell_dc']).toBe(1); // the `additional` payload the old resolver dropped
  });

  it('multiple stat_mod feats accumulate per stat', () => {
    const statModFeats = effectsByDomain('passive').filter((f) => f.effectType === 'stat_mod');
    expect(statModFeats.length).toBe(8);
    const all = resolveStatMods(hero([[1, 5]]), statModFeats.map((f) => ({ featId: f.featId })));
    const total = Object.values(all).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });

  it('non-passive feats contribute nothing to stat mods', () => {
    // Power Attack (#1) is a combat_action — the passive layer ignores it.
    expect(resolveStatMods(hero(), [{ featId: 1 }])).toEqual({});
  });
});

describe('passive skill_mod resolution', () => {
  it('Trap Finder (#70): +1 thievery plus nested +1 perception', () => {
    const mods = resolveSkillMods(hero(), [{ featId: 70 }]);
    expect(mods['thievery']).toBe(1);
    expect(mods['perception']).toBe(1);
  });

  it('Skill Focus (#205) resolves chosen_at_selection through the hero choice', () => {
    const mods = resolveSkillMods(hero(), [{ featId: 205, choices: { skill: 'arcana' } }]);
    expect(mods['arcana']).toBe(2);
  });

  it('Skill Focus with NO recorded choice contributes nothing (never strands on empty)', () => {
    expect(resolveSkillMods(hero(), [{ featId: 205 }])).toEqual({});
  });
});

describe('party dungeon bonuses', () => {
  it('Trap Finder grants auto_detect_traps_adjacent to the party', () => {
    const rogue = hero();
    rogue.name = 'Sly';
    const r = partyDungeonBonus(
      [{ hero: hero(), feats: [{ featId: 1 }] }, { hero: rogue, feats: [{ featId: 70 }] }],
      'auto_detect_traps_adjacent',
    );
    expect(r).toEqual({ found: true, heroName: 'Sly' });
  });

  it('absent bonus reports not-found', () => {
    const r = partyDungeonBonus([{ hero: hero(), feats: [{ featId: 1 }] }], 'auto_detect_traps_adjacent');
    expect(r.found).toBe(false);
  });
});
