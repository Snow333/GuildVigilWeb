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

  it('weapon math: proficiency + ability + potency; STR damage rides the dice', () => {
    // Torvald: Longsword 1d8, STR 16 (+3), mundane (no potency).
    expect(fighter.c.attackBonus).toBe(totalProficiency(kits[0]!.hero, 'weapon_attack') + 3);
    expect(fighter.c.damageDice).toBe('1d8+3');
    expect(fighter.c.weaponAgile).toBe(false);
  });

  it('finesse attacks with DEX, damages with STR; agile flows from traits', () => {
    // Shade: Rapier (finesse, NOT agile per registry), DEX 16 (+3), STR 12 (+1).
    expect(rogue.c.attackBonus).toBe(totalProficiency(kits[1]!.hero, 'weapon_attack') + 3);
    expect(rogue.c.damageDice).toBe('1d6+1');
    expect(rogue.c.weaponAgile).toBe(false); // rapier is finesse+deadly, not agile
  });

  it('sneak dice derive from the feat payload at the granting class level', () => {
    expect(rogue.c.sneakAttackDice).toBe('1d6'); // ceil(1/2)d6
    expect(fighter.c.sneakAttackDice).toBe('');
  });

  it('AC = 10 + armor + capped DEX', () => {
    // Torvald: Chain Mail +5, DEX +1 (cap permitting) → within [15, 16].
    expect(fighter.c.ac).toBeGreaterThanOrEqual(15);
    expect(fighter.c.ac).toBeLessThanOrEqual(16);
    // Shade: Leather +2, DEX +3 → 15 unless leather caps lower.
    expect(rogue.c.ac).toBeGreaterThanOrEqual(14);
    expect(rogue.c.ac).toBeLessThanOrEqual(15);
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
    expect(wizard.c.casting!.dc).toBe(10 + totalProficiency(kits[3]!.hero, 'spell_dc') + 3); // INT 16
    expect(wizard.c.casting!.casterLevel).toBe(1);
  });

  it('dispatch skills: rank + governing ability + feat skill mods (Trap Finder +1 thievery)', () => {
    // Shade: thievery 4 ranks + DEX 3 + Trap Finder 1 = 8.
    expect(rogue.skills.thievery).toBe(8);
    // Trap Finder's additional perception +1 applies unconditionally (documented completion).
    expect(rogue.skills.perception).toBe(2 + 1 + 1);
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
    expect(fighter.c.maxHp).toBe(20); // freshHeroMaxHp(10, +2) = 8 ancestry + 12
    expect(fighter.c.hp).toBe(20);
  });
});
