import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import {
  ancestryEffect, DEFAULT_MUSTER, defaultChoiceFor, FOUNDING_CLASSES, FOUNDING_PARTY_SIZE,
  musterParty, suggestedName, type MusterChoice,
} from '@sim/campaign/muster';
import { assembleHero } from '@sim/campaign/assembly';
import { buildEnemy } from '@sim/combat/build';
import { runEncounter } from '@sim/combat/encounter';
import { ancestryNameById } from '@sim/registry';
import { starterParty } from '@sim/campaign/starterParty';
import { portraitKey } from '@sim/heroes/ancestry';
import { ancestryIds } from '@sim/registry';

const choice = (over: Partial<MusterChoice> = {}): MusterChoice => ({
  name: 'Test', ancestry: ancestryIds[0]!, gender: 'f', classId: FOUNDING_CLASSES[0]!.classId, ...over,
});

const ancestryNamed = (name: string): number => ancestryIds.find((id) => ancestryNameById.get(id) === name)!;

describe('the founding muster', () => {
  it('the default muster IS the starter party (harnesses and live play share it)', () => {
    expect(musterParty(DEFAULT_MUSTER)).toEqual(starterParty());
    expect(starterParty()).toHaveLength(FOUNDING_PARTY_SIZE);
  });

  it('hands back a FRESH mutable party each call (campaigns level it up)', () => {
    const a = musterParty(DEFAULT_MUSTER);
    const b = musterParty(DEFAULT_MUSTER);
    a[0]!.hero.xp = 999;
    a[0]!.equipped[0]!.tier = 'legendary';
    expect(b[0]!.hero.xp).toBe(0);
    expect(b[0]!.equipped[0]!.tier).toBe('mundane');
  });

  it('the player authors identity; class decides gear and skills', () => {
    const halfOrc = ancestryNamed('Half-Orc');
    const party = musterParty([
      choice({ name: 'Grusha', ancestry: halfOrc, gender: 'f', classId: 1 }),
      choice({ name: 'Pip', classId: 4 }),
      choice({ name: 'Ovan', gender: 'm', classId: 3 }),
      choice({ name: 'Wren', classId: 2 }),
    ]);
    expect(party.map((k) => k.hero.name)).toEqual(['Grusha', 'Pip', 'Ovan', 'Wren']);
    expect(party[0]!.hero.ancestry).toBe(halfOrc);
    expect(party[0]!.hero.gender).toBe('f');
    expect(party[0]!.equipped).toEqual(starterParty()[0]!.equipped);
    expect(party[0]!.hero.skills).toEqual(starterParty()[0]!.hero.skills);
  });

  it('M1: ancestry boosts and flaws apply (+2 / −2), and its hp replaces the flat 8', () => {
    const elf = musterParty([choice({ ancestry: ancestryNamed('Elf'), classId: 2 })])[0]!.hero;
    const dwarf = musterParty([choice({ ancestry: ancestryNamed('Dwarf'), classId: 2 })])[0]!.hero;
    // Wizard template: dex 14, con 12, int 16, wis 12, cha 10. Elf: +dex +int −con. Dwarf: +con +wis −cha.
    expect(elf.abilities).toMatchObject({ dex: 16, int: 18, con: 10 });
    expect(dwarf.abilities).toMatchObject({ con: 14, wis: 14, cha: 8, int: 16 });
    // hp = ancestry hp + wizard 6 + CON mod. Elf 6+6+0, Dwarf 10+6+2.
    expect(elf.maxHp).toBe(12);
    expect(dwarf.maxHp).toBe(18);
  });

  it('M1: a "free" boost goes to the class key ability first', () => {
    // Human = two free boosts. A Fighter takes STR, then the next on its priority list.
    const fx = ancestryEffect(ancestryNamed('Human'), 1);
    expect(fx.boosts[0]).toBe('str');
    expect(new Set(fx.boosts).size).toBe(2);
    // Half-Orc = STR + one free: the free one must not double up on STR.
    const ho = ancestryEffect(ancestryNamed('Half-Orc'), 1);
    expect(ho.boosts).toContain('str');
    expect(new Set(ho.boosts).size).toBe(2);
  });

  it('M1: every boost moves a modifier — founding scores stay even', () => {
    for (const cls of FOUNDING_CLASSES) {
      for (const id of ancestryIds) {
        const hero = musterParty([choice({ ancestry: id, classId: cls.classId })])[0]!.hero;
        for (const score of Object.values(hero.abilities)) expect(score % 2).toBe(0);
      }
    }
  });

  it('M1: all ten base classes can be founded, and each one wins a fight it should', () => {
    expect(FOUNDING_CLASSES.map((c) => c.classId).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 13]);
    for (const cls of FOUNDING_CLASSES) {
      // Through the PRODUCTION path: muster -> assembly -> a real fight vs one goblin.
      let wins = 0;
      let dealt = 0;
      for (let s = 0; s < 20; s++) {
        const hero = assembleHero(musterParty([defaultChoiceFor(cls.classId)])[0]!).c;
        const r = runEncounter(`m_${cls.classId}_${s}`, 'room', [hero], [buildEnemy(1, 'g')], `muster_fight_${cls.classId}_${s}`);
        if (r.result === 'victory') wins++;
        for (const ev of r.stream.all()) {
          if (ev.type === 'combat.damage_applied' && ev.data.targetId === 'g') dealt += ev.data.amount;
        }
      }
      expect(Number.isNaN(dealt), `${cls.name} damage is a number`).toBe(false);
      expect(wins, `${cls.name} beats a lone goblin most of the time`).toBeGreaterThanOrEqual(14);
    }
  });

  it('ids are positional, so identical choices reproduce the campaign exactly', () => {
    const choices = [choice({ classId: 1 }), choice({ classId: 4 }), choice({ classId: 3 }), choice({ classId: 2 })];
    expect(musterParty(choices).map((k) => k.hero.id)).toEqual(['hero_1', 'hero_2', 'hero_3', 'hero_4']);
    const a = CampaignSession.create({ campaignId: 'det', seed: 'world_det', party: musterParty(choices) });
    const b = CampaignSession.create({ campaignId: 'det', seed: 'world_det', party: musterParty(choices) });
    a.advanceWeek();
    b.advanceWeek();
    expect(a.serialize()).toEqual(b.serialize());
  });

  it('lets the player field four of the same class (their funeral)', () => {
    const party = musterParty([1, 1, 1, 1].map((classId) => choice({ name: '', classId })));
    expect(party.every((k) => k.hero.classLevels[0]!.classId === 1)).toBe(true);
  });

  it('blank names take the archetype suggestion, disambiguated', () => {
    expect(suggestedName(1, [])).toBe('Torvald');
    expect(suggestedName(1, ['Torvald'])).toBe('Torvald II');
    expect(suggestedName(1, ['Torvald', 'Torvald II'])).toBe('Torvald III');
    // musterParty itself falls back to the plain archetype name.
    expect(musterParty([choice({ name: '   ' })])[0]!.hero.name).toBe('Torvald');
  });

  it('the roster surfaces the portrait key the UI renders, computed in the sim', () => {
    const halfOrc = ancestryIds[4]!;
    const s = CampaignSession.create({
      campaignId: 'pk', seed: 'world_pk',
      party: musterParty([choice({ ancestry: halfOrc, gender: 'm' })]),
    });
    expect(s.roster()[0]!.portraitKey).toBe(portraitKey(halfOrc, 'm'));
    expect(s.roster()[0]!.portraitKey).toBe('hero-halforc-m');
    expect(s.roster()[0]!.ancestryName).toBe('Half-Orc');
    expect(s.heroSheet('hero_1').portraitKey).toBe('hero-halforc-m');
  });

  it('M1: a Monk strikes with the class unarmed die and DEX, not a 1d4 STR fist', () => {
    const kit = musterParty([defaultChoiceFor(7)])[0]!;
    const monk = assembleHero(kit).c;
    expect(kit.equipped).toHaveLength(0);
    expect(monk.damageDice.startsWith('1d6')).toBe(true);
    expect(monk.weaponAgile).toBe(true);
    // Finesse: the attack uses DEX (the monk's best stat), so it beats a STR-only attack.
    const strOnly = assembleHero({ ...kit, hero: { ...kit.hero, abilities: { ...kit.hero.abilities, dex: 10 } } }).c;
    expect(monk.attackBonus).toBeGreaterThan(strOnly.attackBonus);
  });

  it('M1: the Warlock has a real pact pool, and Eldritch Blast is at-will', () => {
    const kit = musterParty([defaultChoiceFor(13)])[0]!;
    const warlock = assembleHero(kit).c;
    // Pool from the `pact_energy_max_12` class feature (was 0: derived from slots the class has none of).
    expect(warlock.casting?.kind).toBe('pact');
    expect(warlock.casting?.pactEnergy).toBe(12);
    // A long fight: more blasts than 12 energy could ever pay for at the level-1 cost of 6.
    const enemies = [buildEnemy(6, 'b1'), buildEnemy(6, 'b2')];
    const r = runEncounter('wl', 'room', [warlock], enemies, 'warlock_at_will');
    const blasts = r.stream.all().filter((e) => e.type === 'combat.spell_cast' && e.data.casterId === warlock.id);
    expect(blasts.length).toBeGreaterThan(2);
  });

  it('refuses a class it cannot outfit rather than shipping a broken hero', () => {
    // Prestige classes (10 Arcane Trickster) are reached by multiclassing, not founded.
    expect(() => musterParty([choice({ classId: 10 })])).toThrow(/no founding template/);
  });
});
