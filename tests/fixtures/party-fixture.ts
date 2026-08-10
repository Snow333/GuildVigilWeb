/**
 * The canonical career-harness party — four level-1 heroes built from REAL
 * registry rows (classes 1/4/3/2, real item ids, real feat ids). Every consumer
 * calls fixtureParty() fresh: HeroState is mutable and campaigns level it up.
 */

import type { ItemInstance } from '@sim/core/events/types';
import type { HeroKit } from '@sim/campaign/assembly';
import { freshHeroMaxHp } from '@sim/heroes/levelUp';
import type { Abilities, HeroState } from '@sim/heroes/types';
import { spellsByName } from '@sim/registry';

const inst = (baseId: number): ItemInstance => ({
  baseId: String(baseId), tier: 'mundane', propertyIds: [], seed: `fix_${baseId}`,
});

export function mkHero(
  id: string,
  name: string,
  classId: number,
  abilities: Abilities,
  maxHp: number,
  skills: Record<string, number>,
  feats: { featId: number; choices?: { skill?: string } }[] = [],
): HeroState {
  return {
    id, name, status: 'active', xp: 0, maxHp, abilities,
    classLevels: [{ classId, level: 1, orderTaken: 1 }],
    skills, feats, wounded: 0,
  };
}

/** Fighter / Rogue / Cleric / Wizard — the classic wedge, level 1. */
export function fixtureParty(): HeroKit[] {
  const heal = spellsByName.get('Heal')!.id;
  const magicMissile = spellsByName.get('Magic Missile')!.id;

  return [
    {
      // Longsword + Chain Mail; AoO arrives via the fighter class feature.
      hero: mkHero('hero_1', 'Torvald', 1,
        { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }, freshHeroMaxHp(10, 2),
        { athletics: 2, perception: 1 }),
      equipped: [inst(3), inst(25)],
      loadout: [],
    },
    {
      // Rapier (finesse) + Leather; Sneak Attack #68, Nimble Dodge #69, Trap Finder #70.
      hero: mkHero('hero_2', 'Shade', 4,
        { str: 12, dex: 16, con: 12, int: 12, wis: 12, cha: 10 }, freshHeroMaxHp(8, 1),
        { thievery: 4, perception: 2, athletics: 1 },
        [{ featId: 68 }, { featId: 69 }, { featId: 70 }]),
      equipped: [inst(9), inst(22)],
      loadout: [],
    },
    {
      // Mace + Scale Mail; heals the wedge when someone drops low.
      hero: mkHero('hero_3', 'Mira', 3,
        { str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 }, freshHeroMaxHp(8, 2),
        { perception: 2, athletics: 1 }),
      equipped: [inst(7), inst(26)],
      loadout: [{ action: 'cast', spellId: heal, condition: { kind: 'allyHpBelow', pct: 0.4 }, target: 'lowestAlly' }],
    },
    {
      // Staff; Magic Missile until the slots run dry, then pokes with the stick.
      hero: mkHero('hero_4', 'Elandra', 2,
        { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 }, freshHeroMaxHp(6, 1),
        { perception: 1 }),
      equipped: [inst(16)],
      loadout: [{ action: 'cast', spellId: magicMissile, condition: { kind: 'always' }, target: 'scoredEnemy' }],
    },
  ];
}
