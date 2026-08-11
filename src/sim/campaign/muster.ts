/**
 * The founding muster (brief #10, decision 2): the player creates the starting
 * party — name, ancestry, gender, and class per hero. Stats, gear, and
 * everything downstream still roll from the sim exactly as they did.
 *
 * SCOPE NOTE (deliberate, recorded at implementation): class is chosen from the
 * four archetypes the sim can already outfit at level 1. There is no
 * starting-gear-by-class table in the registry — starterParty hand-picked item
 * ids — so offering all 13 classes would mean authoring new content, which
 * brief #10 puts out of scope. The templates below ARE the v1 starter party,
 * lifted verbatim so the career-harness baseline does not move; widening the
 * roster is a content decision, not a code one.
 *
 * Ancestry and gender are pure identity here (see heroes/ancestry) — they touch
 * no stat on this path and must not start.
 */

import type { ItemInstance } from '@sim/core/events/types';
import { Ids } from '@sim/core/ids';
import { deriveHeroIdentity, type AncestryId, type Gender } from '@sim/heroes/ancestry';
import { freshHeroMaxHp } from '@sim/heroes/levelUp';
import type { Abilities, HeroState } from '@sim/heroes/types';
import { ancestryIds, ancestryNameById, classesById, spellsByName } from '@sim/registry';
import type { LoadoutEntry } from '@sim/combat/loadout';
import type { HeroKit } from './assembly';

export const FOUNDING_PARTY_SIZE = 4;

/** Item instance with the fixture's seed convention — unchanged from Phase 1. */
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
  identity: { ancestry: AncestryId; gender: Gender } = deriveHeroIdentity(id),
): HeroState {
  return {
    id, name, status: 'active', xp: 0, maxHp, abilities,
    classLevels: [{ classId, level: 1, orderTaken: 1 }],
    skills, feats, wounded: 0,
    ancestry: identity.ancestry, gender: identity.gender,
  };
}

/** One level-1 archetype: everything about a founding hero the player does NOT author. */
interface FoundingTemplate {
  classId: number;
  /** The name this archetype has carried since Phase 1 — the muster's suggestion. */
  defaultName: string;
  /**
   * The identity the muster opens on. AUTHORED, not hashed: these four are the
   * faces a player meets before they touch anything, so they should read as
   * people (Torvald a man, Mira a woman) rather than as hash output. Elandra is
   * an Elf on purpose — no elf art exists after batch 1, so the default party
   * puts the sketch-pending silhouette on screen in every campaign and every
   * e2e run. The fallback is a first-class path; it should be seen.
   */
  defaultAncestry: string;
  defaultGender: Gender;
  abilities: Abilities;
  maxHp: number;
  skills: Record<string, number>;
  feats: { featId: number; choices?: { skill?: string } }[];
  equipped: ItemInstance[];
  loadout: () => LoadoutEntry[];
}

/**
 * Fighter / Rogue / Cleric / Wizard — the classic wedge, level 1. Re-statted
 * 2026-08-10 for the SKILL RANK CAP (finding #4): ranks ≤ character level.
 * Spell ids resolve by NAME at call time, never hardcoded.
 */
const TEMPLATES: readonly FoundingTemplate[] = [
  {
    // Longsword + Chain Mail; AoO arrives via the fighter class feature.
    classId: 1,
    defaultName: 'Torvald',
    defaultAncestry: 'Human',
    defaultGender: 'm',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: freshHeroMaxHp(10, 2),
    skills: { athletics: 1, perception: 1 },
    feats: [],
    equipped: [inst(3), inst(25)],
    loadout: () => [],
  },
  {
    // Rapier (finesse) + Leather; Sneak Attack #68, Nimble Dodge #69, Trap Finder #70.
    classId: 4,
    defaultName: 'Shade',
    defaultAncestry: 'Half-Orc',
    defaultGender: 'm',
    abilities: { str: 12, dex: 16, con: 12, int: 12, wis: 12, cha: 10 },
    maxHp: freshHeroMaxHp(8, 1),
    skills: { thievery: 1, perception: 1, athletics: 1 },
    feats: [{ featId: 68 }, { featId: 69 }, { featId: 70 }],
    equipped: [inst(9), inst(22)],
    loadout: () => [],
  },
  {
    // Mace + Scale Mail; heals the wedge when someone drops low.
    classId: 3,
    defaultName: 'Mira',
    defaultAncestry: 'Human',
    defaultGender: 'f',
    abilities: { str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
    maxHp: freshHeroMaxHp(8, 2),
    skills: { perception: 1, athletics: 1 },
    feats: [],
    equipped: [inst(7), inst(26)],
    loadout: () => [
      { action: 'cast', spellId: spellsByName.get('Heal')!.id, condition: { kind: 'allyHpBelow', pct: 0.4 }, target: 'lowestAlly' },
    ],
  },
  {
    // Staff; Magic Missile until the slots run dry, then pokes with the stick.
    classId: 2,
    defaultName: 'Elandra',
    defaultAncestry: 'Elf',
    defaultGender: 'f',
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    maxHp: freshHeroMaxHp(6, 1),
    skills: { perception: 1 },
    feats: [],
    equipped: [inst(16)],
    loadout: () => [
      { action: 'cast', spellId: spellsByName.get('Magic Missile')!.id, condition: { kind: 'always' }, target: 'scoredEnemy' },
    ],
  },
];

const templateByClassId = new Map<number, FoundingTemplate>(TEMPLATES.map((t) => [t.classId, t]));

/** The classes a founding hero may take, in muster order (registry names, no hand-typed strings). */
export interface FoundingClassOption {
  classId: number;
  name: string;
}

export const FOUNDING_CLASSES: readonly FoundingClassOption[] = TEMPLATES.map((t) => ({
  classId: t.classId,
  name: classesById.get(t.classId)?.name ?? `class_${t.classId}`,
}));

/** What the player authors at the muster. Everything else derives. */
export interface MusterChoice {
  name: string;
  ancestry: AncestryId;
  gender: Gender;
  classId: number;
}

/**
 * The suggestion an empty name field takes: the archetype's own name, made
 * unique against the names already chosen (two Fighters give "Torvald" and
 * "Torvald II"). Deterministic — the muster must never roll dice.
 */
export function suggestedName(classId: number, taken: readonly string[]): string {
  const base = templateByClassId.get(classId)?.defaultName ?? 'Recruit';
  if (!taken.includes(base)) return base;
  const numerals = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  for (const n of numerals) {
    const candidate = `${base} ${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${base} ${taken.length + 1}`;
}

/**
 * The party `starterParty()` produces — the muster's opening state, and what
 * signing without touching anything gives you. Ancestry resolves by NAME
 * against the registry so this never hardcodes a content id.
 */
export const DEFAULT_MUSTER: readonly MusterChoice[] = TEMPLATES.map((t) => ({
  name: t.defaultName,
  ancestry: ancestryIds.find((id) => ancestryNameById.get(id) === t.defaultAncestry) ?? ancestryIds[0]!,
  gender: t.defaultGender,
  classId: t.classId,
}));

/**
 * Build the founding party. Hero ids are positional (`hero_1`…`hero_4`), so a
 * given set of choices always produces the same campaign — the determinism the
 * brief's acceptance criterion asks for.
 */
export function musterParty(choices: readonly MusterChoice[]): HeroKit[] {
  return choices.map((choice, i) => {
    const template = templateByClassId.get(choice.classId);
    if (!template) throw new Error(`musterParty: no founding template for class ${choice.classId}`);
    const id = Ids.hero(i + 1);
    const name = choice.name.trim() === '' ? template.defaultName : choice.name.trim();
    return {
      hero: mkHero(
        id, name, template.classId, { ...template.abilities }, template.maxHp,
        { ...template.skills }, template.feats.map((f) => ({ ...f })),
        { ancestry: choice.ancestry, gender: choice.gender },
      ),
      equipped: template.equipped.map((e) => ({ ...e, propertyIds: [...e.propertyIds] })),
      loadout: template.loadout(),
    };
  });
}
