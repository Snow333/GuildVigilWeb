import { describe, expect, it } from 'vitest';
import { assembleHero, assembleParty } from '@sim/campaign/assembly';
import { abilityMod } from '@sim/heroes/types';
import { totalProficiency } from '@sim/heroes/proficiency';
import { partyDungeonBonus } from '@sim/heroes/featEffects';
import { fixtureParty } from '../fixtures/party-fixture';

describe('hero → combatant assembly (the sheet becomes a fighter)', () => {
  const kits = fixtureParty();
  const [fighter, rogue, cleric, wizard] = assembleParty(kits) as [
    ReturnType<typeof assembleHero>, ReturnType<typeof assembleHero>,
    ReturnType<typeof assembleHero>, ReturnType<typeof assembleHero>,
  ];

  const mod = (i: number, k: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'): number => abilityMod(kits[i]!.hero.abilities[k]);

  it('weapon math: proficiency + ability + potency; STR damage rides the dice', () => {
    // Torvald: Longsword 1d8, mundane (no potency). Scores include ancestry (M1).
    expect(fighter.c.attackBonus).toBe(totalProficiency(kits[0]!.hero, 'weapon_attack') + mod(0, 'str'));
    expect(fighter.c.damageDice).toBe(`1d8+${mod(0, 'str')}`);
    expect(fighter.c.weaponAgile).toBe(false);
  });

  it('finesse attacks with DEX, damages with STR; agile flows from traits', () => {
    // Shade: Rapier (finesse, NOT agile per registry): attacks with the better of STR/DEX.
    expect(rogue.c.attackBonus).toBe(
      totalProficiency(kits[1]!.hero, 'weapon_attack') + Math.max(mod(1, 'str'), mod(1, 'dex')),
    );
    expect(rogue.c.damageDice).toBe(`1d6+${mod(1, 'str')}`);
    expect(rogue.c.weaponAgile).toBe(false); // rapier is finesse+deadly, not agile
  });

  it('sneak dice derive from the feat payload at the granting class level', () => {
    expect(rogue.c.sneakAttackDice).toBe('1d6'); // ceil(1/2)d6
    expect(fighter.c.sneakAttackDice).toBe('');
  });

  it('AC = 10 + armor + capped DEX', () => {
    // Chain Mail: +5 AC, max DEX +2. Leather: +2 AC, max DEX +4.
    expect(fighter.c.ac).toBe(10 + 5 + Math.min(mod(0, 'dex'), 2));
    expect(rogue.c.ac).toBe(10 + 2 + Math.min(mod(1, 'dex'), 4));
  });

  it('saves = proficiency + governing mod', () => {
    const h = kits[0]!.hero;
    expect(fighter.c.saves.fort).toBe(totalProficiency(h, 'fort_save') + abilityMod(h.abilities.con));
    expect(fighter.c.saves.will).toBe(totalProficiency(h, 'will_save') + abilityMod(h.abilities.wis));
  });

  it('reactions: fighter AoO from class features, rogue Nimble Dodge from the feat', () => {
    expect(fighter.c.reactions).toContain('aoo');
    expect(rogue.c.reactions).toContain('nimbleDodge');
  });

  it('casters get real slot tables and DCs; martials get null', () => {
    expect(fighter.c.casting).toBeNull();
    expect(cleric.c.casting).not.toBeNull();
    expect(wizard.c.casting).not.toBeNull();
    expect(wizard.c.isCaster).toBe(true);
    expect(wizard.c.casting!.kind).toBe('slots');
    expect(wizard.c.casting!.slots[1]).toBeGreaterThan(0); // L1 wizard has L1 slots
    expect(wizard.c.casting!.dc).toBe(10 + totalProficiency(kits[3]!.hero, 'spell_dc') + mod(3, 'int'));
    expect(wizard.c.casting!.casterLevel).toBe(1);
  });

  it('dispatch skills: rank + governing ability + feat skill mods (Trap Finder +1 thievery)', () => {
    // Shade after the rank-cap re-stat (finding #4: ranks ≤ level, so 1 at L1):
    // thievery 1 rank + DEX mod + Trap Finder 1.
    expect(rogue.skills.thievery).toBe(1 + mod(1, 'dex') + 1);
    // Trap Finder's additional perception +1 applies unconditionally (documented completion).
    expect(rogue.skills.perception).toBe(1 + mod(1, 'wis') + 1);
  });

  it('the party carries the Trap Finder dungeon bonus for dispatch wiring', () => {
    const found = partyDungeonBonus(
      kits.map((k) => ({ hero: k.hero, feats: k.hero.feats })),
      'auto_detect_traps_adjacent',
    );
    expect(found.found).toBe(true);
    expect(found.heroName).toBe('Shade');
  });

  it('initiative = perception skill (+feat initiative mods)', () => {
    expect(fighter.c.initiativeBonus).toBe(fighter.skills.perception);
  });

  it('hp/wounded carry from the sheet; assembly never mutates the hero', () => {
    const before = JSON.stringify(kits[0]!.hero);
    assembleHero(kits[0]!);
    expect(JSON.stringify(kits[0]!.hero)).toBe(before);
    // Human ancestry hp 8 + Fighter 10 + CON mod.
    expect(fighter.c.maxHp).toBe(8 + 10 + mod(0, 'con'));
    expect(fighter.c.hp).toBe(fighter.c.maxHp);
  });
});
