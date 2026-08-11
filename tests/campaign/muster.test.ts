import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import {
  DEFAULT_MUSTER, FOUNDING_CLASSES, FOUNDING_PARTY_SIZE, musterParty, suggestedName,
  type MusterChoice,
} from '@sim/campaign/muster';
import { starterParty } from '@sim/campaign/starterParty';
import { portraitKey } from '@sim/heroes/ancestry';
import { ancestryIds } from '@sim/registry';

const choice = (over: Partial<MusterChoice> = {}): MusterChoice => ({
  name: 'Test', ancestry: ancestryIds[0]!, gender: 'f', classId: FOUNDING_CLASSES[0]!.classId, ...over,
});

describe('the founding muster (brief #10 decision 2)', () => {
  it('THE REFACTOR IS BEHAVIOR-FREE: the default muster IS the historical starter party', () => {
    // The career-harness snapshot depends on this. If it ever diverges, the
    // muster changed the baseline party and the diff must be justified, not
    // absorbed.
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

  it('the player authors identity; the sim still rolls the rest', () => {
    const halfOrc = ancestryIds[4]!;
    const party = musterParty([
      choice({ name: 'Grusha', ancestry: halfOrc, gender: 'f', classId: 1 }),
      choice({ name: 'Pip', classId: 4 }),
      choice({ name: 'Ovan', gender: 'm', classId: 3 }),
      choice({ name: 'Wren', classId: 2 }),
    ]);
    expect(party.map((k) => k.hero.name)).toEqual(['Grusha', 'Pip', 'Ovan', 'Wren']);
    expect(party[0]!.hero.ancestry).toBe(halfOrc);
    expect(party[0]!.hero.gender).toBe('f');
    // ...and the stats/gear are still the archetype's, untouched by identity.
    expect(party[0]!.hero.abilities).toEqual(starterParty()[0]!.hero.abilities);
    expect(party[0]!.equipped).toEqual(starterParty()[0]!.equipped);
    expect(party[0]!.hero.maxHp).toBe(starterParty()[0]!.hero.maxHp);
  });

  it('ancestry has ZERO stat effect — the same class across every ancestry is identical', () => {
    // The cosmetic-for-now decision, enforced. When a systems brief hires
    // ancestry mechanics, this test is the one that must be deliberately changed.
    const base = musterParty([choice({ ancestry: ancestryIds[0]!, classId: 1 })])[0]!;
    for (const id of ancestryIds.slice(1)) {
      const other = musterParty([choice({ ancestry: id, classId: 1 })])[0]!;
      expect(other.hero.abilities).toEqual(base.hero.abilities);
      expect(other.hero.maxHp).toBe(base.hero.maxHp);
      expect(other.hero.skills).toEqual(base.hero.skills);
      expect(other.equipped).toEqual(base.equipped);
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

  it('refuses a class it cannot outfit rather than shipping a broken hero', () => {
    expect(() => musterParty([choice({ classId: 13 })])).toThrow(/no founding template/);
  });
});
