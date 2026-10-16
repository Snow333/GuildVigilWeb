import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { autoLevelHero } from '@sim/campaign/campaign';
import { defaultChoiceFor, musterParty } from '@sim/campaign/muster';
import { assembleHero, type HeroKit } from '@sim/campaign/assembly';
import { buildEnemy } from '@sim/combat/build';
import { runEncounter } from '@sim/combat/encounter';
import { withLearnedSpells } from '@sim/heroes/autoLoadout';
import { isSpellResolvable, maxSpellLevel } from '@sim/heroes/knownSpells';
import { spellsByName } from '@sim/registry';
import type { LoadoutEntry } from '@sim/combat/loadout';

/**
 * M1 — what a hero learns at level-up reaches the fight.
 * Before M1, `spellsLearnedAtLevel` existed and nothing called it, and a spell
 * added to `knownSpells` never joined the loadout the combat AI plays.
 */

const id = (name: string): number => spellsByName.get(name)!.id;
const cast = (name: string, cond: LoadoutEntry['condition'] = { kind: 'always' }): LoadoutEntry =>
  ({ action: 'cast', spellId: id(name), condition: cond, target: 'scoredEnemy' });

function session(classIds: number[]): CampaignSession {
  const s = CampaignSession.create({ campaignId: 'learn', seed: 'world_learn', party: musterParty(classIds.map(defaultChoiceFor)) });
  s.advanceWeek();
  return s;
}

/** The session's own kit, through the same accessor every launch uses. */
const kitOf = (s: CampaignSession, heroId: string): HeroKit =>
  (s as unknown as { kitFor(id: string): HeroKit }).kitFor(heroId);

/** Spells the hero actually CAST across n real fights (production assembly + encounter). */
function castsInFights(kit: HeroKit, n = 10): Set<string> {
  const out = new Set<string>();
  for (let k = 0; k < n; k++) {
    const hero = assembleHero(structuredClone(kit)).c;
    const r = runEncounter(`lf${k}`, 'room', [hero], [buildEnemy(11, 'o1'), buildEnemy(11, 'o2')], `learn_fight_${k}`);
    for (const ev of r.stream.all()) {
      if (ev.type === 'combat.spell_cast' && ev.data.casterId === hero.id) out.add(String(ev.data.spellId));
    }
  }
  return out;
}

describe('withLearnedSpells — where a new spell goes in the fight plan', () => {
  it('heals go on top (gated on a hurt ally), damage below, highest spell level first', () => {
    const start = [cast('Magic Missile')];
    const out = withLearnedSpells(start, [id('Fireball'), id('Heal')]);
    expect(out.map((e) => (e as { spellId: number }).spellId)).toEqual([id('Heal'), id('Fireball'), id('Magic Missile')]);
    expect(out[0]!.condition).toEqual({ kind: 'allyHpBelow', pct: 0.4 });
  });

  it('a buff is cast once — gated on its own condition not being up', () => {
    const out = withLearnedSpells([cast('Magic Missile')], [id('Bless')]);
    expect(out[0]).toMatchObject({ spellId: id('Bless'), condition: { kind: 'notActive', conditionId: 'emboldened' } });
  });

  it("leaves the player's own entries and order alone, and never duplicates", () => {
    const start: LoadoutEntry[] = [{ action: 'strike', condition: { kind: 'always' }, target: 'nearestEnemy' }, cast('Magic Missile')];
    const out = withLearnedSpells(start, [id('Magic Missile')]);
    expect(out).toEqual(start);
  });

  it('does not auto-add debuffs (an always-on debuff would replace every attack)', () => {
    expect(withLearnedSpells([], [id('Fear')])).toEqual([]);
  });
});

describe('level-up teaches spells, and they are cast in real fights', () => {
  it('a manually learned spell joins the loadout and gets cast', () => {
    // A wizard reaching L3 unlocks 2nd-level slots; Scorching Ray is 2nd level.
    const s = session([2]);
    const hero = s.roster()[0]!;
    s.devGrantLevel(hero.id);
    autoLevelHero(s, hero.id); // to L2 (learns a 1st-level spell)
    s.devGrantLevel(hero.id);
    const { offers } = s.spellPicksFor(hero.id, 2);
    expect(offers.some((o) => o.selectable && o.name === 'Scorching Ray')).toBe(true);
    // Control: before learning it, the wizard never casts Scorching Ray.
    expect(castsInFights(kitOf(s, hero.id)).has(String(id('Scorching Ray')))).toBe(false);
    const plan = { classId: 2, skillRanks: {}, feats: [], autoGrantedFeatIds: [], spells: [id('Scorching Ray')] };
    s.applyLevelUp(hero.id, plan);
    expect(s.heroState(hero.id).knownSpells).toContain(id('Scorching Ray'));
    expect(castsInFights(kitOf(s, hero.id)).has(String(id('Scorching Ray')))).toBe(true);
  });

  it('refuses a spell the hero cannot learn yet, before changing anything', () => {
    const s = session([2]);
    const hero = s.roster()[0]!;
    s.devGrantLevel(hero.id);
    const before = JSON.stringify(s.heroState(hero.id));
    expect(() => s.applyLevelUp(hero.id, {
      classId: 2, skillRanks: {}, feats: [], autoGrantedFeatIds: [], spells: [id('Fireball')],
    })).toThrow(/not learnable/);
    expect(JSON.stringify(s.heroState(hero.id))).toBe(before);
  });

  it('auto level-up learns higher-level spells and the hero casts them', () => {
    const s = session([2]);
    const hero = s.roster()[0]!;
    for (let i = 0; i < 4; i++) { s.devGrantLevel(hero.id); autoLevelHero(s, hero.id); }
    expect(s.heroSheet(hero.id).level).toBe(5);
    const known = s.heroState(hero.id).knownSpells ?? [];
    expect(known.length).toBeGreaterThan(1);
    // A level-5 wizard has 3rd-level slots and learned at least one 3rd-level spell...
    const third = known.filter((sid) => (spellsByName.get('Fireball')!.id === sid) || (spellsByName.get('Lightning Bolt')!.id === sid));
    expect(third.length).toBeGreaterThan(0);
    // ...and actually casts something it did NOT start with.
    const casts = castsInFights(kitOf(s, hero.id));
    expect([...casts].some((c) => c !== String(id('Magic Missile')) && known.includes(Number(c)))).toBe(true);
  });

  it('every auto-levelled caster class ends up casting a spell it gained after founding', () => {
    for (const classId of [2, 3, 8, 9, 13]) {
      const s = session([classId]);
      const hero = s.roster()[0]!;
      // "Gained" = usable now but not at founding: learned (Wizard, Bard, …) or granted (Cleric).
      const founded = new Set(s.spellPlan(hero.id)!.levels.flatMap((l) => l.spells.map((sp) => sp.spellId)));
      for (let i = 0; i < 6; i++) { s.devGrantLevel(hero.id); autoLevelHero(s, hero.id); }
      const learned = s.spellPlan(hero.id)!.levels.flatMap((l) => l.spells.map((sp) => sp.spellId)).filter((sid) => !founded.has(sid));
      expect(learned.length, `class ${classId} learned spells`).toBeGreaterThan(0);
      const casts = castsInFights(kitOf(s, hero.id), 12);
      expect(learned.some((sid) => casts.has(String(sid))), `class ${classId} casts a learned spell`).toBe(true);
    }
  });
});

describe('the picker only offers spells that work', () => {
  it('cures with no dice (Remove Curse, Remove Disease, Restoration) are not offered as live', () => {
    for (const name of ['Remove Curse', 'Remove Disease', 'Restoration']) {
      expect(isSpellResolvable(spellsByName.get(name)!), name).toBe(false);
    }
    expect(isSpellResolvable(spellsByName.get('Heal')!)).toBe(true);
  });

  it('a Warlock can learn pact spells: its ceiling follows pact energy, not slots', () => {
    expect(maxSpellLevel(13, 1)).toBe(2); // 12 energy: 2nd-level costs 10, 3rd costs 15
    expect(maxSpellLevel(13, 9)).toBeGreaterThanOrEqual(4);
  });
});
