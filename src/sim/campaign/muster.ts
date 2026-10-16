/**
 * The founding muster: the player creates the starting party — name, ancestry,
 * gender and class per hero. Everything else derives from the class template
 * plus the ancestry.
 *
 * M1 (output/decisions.md):
 *  - All TEN base classes are offered. The three prestige classes (Arcane
 *    Trickster, Eldritch Knight, Mystic Theurge) are reached by multiclassing.
 *  - ANCESTRY NOW MATTERS. Each ancestry row's two boosts (+2) and flaw (−2)
 *    apply to the template, and its `hp` replaces the flat 8. A "free" boost
 *    goes to the class's best ability not already boosted. Scores stay EVEN,
 *    so every boost moves a modifier — see the +1-boost trap in CLAUDE.md.
 */

import type { ItemInstance } from '@sim/core/events/types';
import { emptyQuickSlots } from '@sim/heroes/quickSlots';
import { Ids } from '@sim/core/ids';
import { deriveHeroIdentity, type AncestryId, type Gender } from '@sim/heroes/ancestry';
import { ANCESTRY_BASE_HP } from '@sim/heroes/levelUp';
import { abilityMod, type Abilities, type AbilityKey, type HeroState } from '@sim/heroes/types';
import {
  ancestriesById, ancestryIds, ancestryNameById, classesById, progressionFor, spellsByName,
} from '@sim/registry';
import { CLASS_BOOST_PRIORITY, DEFAULT_BOOST_ORDER } from '@content/autopilot';
import type { LoadoutEntry } from '@sim/combat/loadout';
import type { HeroKit } from './assembly';

export const FOUNDING_PARTY_SIZE = 4;

/** Item instance with the fixture's seed convention — unchanged from Phase 1. */
const inst = (baseId: number): ItemInstance => ({
  baseId: String(baseId), tier: 'mundane', propertyIds: [], seed: `fix_${baseId}`,
});

const spell = (name: string): number => {
  const row = spellsByName.get(name);
  if (!row) throw new Error(`muster: unknown spell "${name}"`);
  return row.id;
};

export function mkHero(
  id: string,
  name: string,
  classId: number,
  abilities: Abilities,
  maxHp: number,
  skills: Record<string, number>,
  feats: { featId: number; choices?: { skill?: string } }[] = [],
  identity: { ancestry: AncestryId; gender: Gender } = deriveHeroIdentity(id),
  knownSpells: number[] = [],
): HeroState {
  return {
    id, name, status: 'active', xp: 0, maxHp, abilities,
    classLevels: [{ classId, level: 1, orderTaken: 1 }],
    skills, feats, knownSpells, wounded: 0,
    ancestry: identity.ancestry, gender: identity.gender,
  };
}

/** One level-1 archetype: everything about a founding hero the player does NOT author. */
interface FoundingTemplate {
  classId: number;
  /** The muster's name suggestion for this class. */
  defaultName: string;
  defaultAncestry: string;
  defaultGender: Gender;
  /** Class + background scores, BEFORE ancestry. All even. */
  abilities: Abilities;
  skills: Record<string, number>;
  feats: { featId: number; choices?: { skill?: string } }[];
  equipped: ItemInstance[];
  loadout: () => LoadoutEntry[];
  /** One line for the muster: how this class fights. */
  style: string;
}

/**
 * The first four are the original founding wedge (Fighter / Rogue / Cleric /
 * Wizard) and remain the default party. Item ids: 3 Longsword · 25 Chain Mail ·
 * 9 Rapier · 22 Leather · 7 Mace · 26 Scale Mail · 16 Staff · 14 Longbow ·
 * 6 Greataxe · 24 Chain Shirt · 1 Dagger.
 */
const TEMPLATES: readonly FoundingTemplate[] = [
  {
    classId: 1,
    defaultName: 'Torvald',
    defaultAncestry: 'Human',
    defaultGender: 'm',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
    skills: { athletics: 1, perception: 1 },
    feats: [],
    equipped: [inst(3), inst(25)],
    loadout: () => [],
    style: 'Armoured front line. Punishes enemies that move past him.',
  },
  {
    classId: 4,
    defaultName: 'Shade',
    defaultAncestry: 'Half-Orc',
    defaultGender: 'm',
    abilities: { str: 12, dex: 16, con: 12, int: 12, wis: 12, cha: 10 },
    skills: { thievery: 1, perception: 1, athletics: 1, stealth: 1 },
    // Sneak Attack #68, Nimble Dodge #69, Trap Finder #70.
    feats: [{ featId: 68 }, { featId: 69 }, { featId: 70 }],
    equipped: [inst(9), inst(22)],
    loadout: () => [],
    style: 'Sneak attacks enemies an ally is already fighting. Disarms traps.',
  },
  {
    classId: 3,
    defaultName: 'Mira',
    defaultAncestry: 'Human',
    defaultGender: 'f',
    abilities: { str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
    skills: { perception: 1, athletics: 1, religion: 1 },
    feats: [],
    equipped: [inst(7), inst(26)],
    loadout: () => [
      { action: 'cast', spellId: spell('Heal'), condition: { kind: 'allyHpBelow', pct: 0.4 }, target: 'lowestAlly' },
    ],
    style: 'Heals whoever drops low; strikes with divine magic otherwise.',
  },
  {
    classId: 2,
    defaultName: 'Elandra',
    defaultAncestry: 'Elf',
    defaultGender: 'f',
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    skills: { perception: 1, arcana: 1 },
    feats: [],
    equipped: [inst(16)],
    loadout: () => [
      { action: 'cast', spellId: spell('Magic Missile'), condition: { kind: 'always' }, target: 'scoredEnemy' },
    ],
    style: 'Blasts from range with spells; fragile up close.',
  },
  {
    classId: 5,
    defaultName: 'Wren',
    defaultAncestry: 'Elf',
    defaultGender: 'f',
    abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    skills: { survival: 1, perception: 1, nature: 1 },
    feats: [],
    equipped: [inst(14), inst(22)],
    loadout: () => [],
    style: 'Shoots from the back line with a longbow.',
  },
  {
    classId: 6,
    defaultName: 'Grusha',
    defaultAncestry: 'Half-Orc',
    defaultGender: 'f',
    abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 12, cha: 10 },
    skills: { athletics: 1, intimidation: 1 },
    feats: [],
    equipped: [inst(6), inst(24)],
    // Rage is auto-granted by the class feature; the loadout switches it on each fight.
    loadout: () => [{ action: 'toggle', featId: 24, condition: { kind: 'notActive', conditionId: 'raging' } }],
    style: 'Rages: big two-handed hits and extra hit points, but easier to hit.',
  },
  {
    classId: 7,
    defaultName: 'Kesh',
    defaultAncestry: 'Human',
    defaultGender: 'm',
    abilities: { str: 12, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
    skills: { acrobatics: 1, athletics: 1, perception: 1 },
    feats: [],
    equipped: [],
    loadout: () => [],
    style: 'Fights barehanded: fast and nimble, no armour needed.',
  },
  {
    classId: 8,
    defaultName: 'Lute',
    defaultAncestry: 'Halfling',
    defaultGender: 'm',
    abilities: { str: 8, dex: 14, con: 12, int: 12, wis: 10, cha: 16 },
    skills: { performance: 1, diplomacy: 1, perception: 1 },
    feats: [],
    equipped: [inst(9), inst(22)],
    loadout: () => [
      { action: 'cast', spellId: spell('Bless'), condition: { kind: 'notActive', conditionId: 'emboldened' }, target: 'self' },
    ],
    style: 'Blesses the party so everyone hits more often; casts occult magic.',
  },
  {
    classId: 9,
    defaultName: 'Ashra',
    defaultAncestry: 'Human',
    defaultGender: 'f',
    abilities: { str: 8, dex: 12, con: 14, int: 10, wis: 12, cha: 16 },
    skills: { arcana: 1, deception: 1 },
    feats: [],
    equipped: [inst(16)],
    loadout: () => [
      { action: 'cast', spellId: spell('Draconic Ray'), condition: { kind: 'always' }, target: 'scoredEnemy' },
    ],
    style: 'Born with magic: more spell slots than a wizard, draconic rays.',
  },
  {
    classId: 13,
    defaultName: 'Morrow',
    defaultAncestry: 'Gnome',
    defaultGender: 'm',
    abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 12, cha: 16 },
    skills: { arcana: 1, intimidation: 1 },
    feats: [],
    equipped: [inst(1), inst(22)],
    loadout: () => [
      { action: 'cast', spellId: spell('Eldritch Blast'), condition: { kind: 'always' }, target: 'scoredEnemy' },
    ],
    style: 'Pact magic: Eldritch Blast at will, bigger spells from pact energy.',
  },
];

const templateByClassId = new Map<number, FoundingTemplate>(TEMPLATES.map((t) => [t.classId, t]));

/** The classes a founding hero may take, in muster order (registry names, no hand-typed strings). */
export interface FoundingClassOption {
  classId: number;
  name: string;
  style: string;
}

export const FOUNDING_CLASSES: readonly FoundingClassOption[] = TEMPLATES.map((t) => ({
  classId: t.classId,
  name: classesById.get(t.classId)?.name ?? `class_${t.classId}`,
  style: t.style,
}));

/** What the player authors at the muster. Everything else derives. */
export interface MusterChoice {
  name: string;
  ancestry: AncestryId;
  gender: Gender;
  classId: number;
}

const ABILITY_KEYS: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const parseKeys = (raw: unknown): string[] => {
  if (typeof raw !== 'string') return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

export interface AncestryEffect {
  hp: number;
  boosts: AbilityKey[];
  flaws: AbilityKey[];
}

/**
 * What an ancestry does for THIS class: its two boosts with "free" resolved to
 * the class's best ability not already boosted, its flaw, and its base HP.
 */
export function ancestryEffect(ancestry: AncestryId, classId: number): AncestryEffect {
  const row = ancestriesById.get(ancestry);
  const isKey = (k: string): k is AbilityKey => (ABILITY_KEYS as readonly string[]).includes(k);
  const raw = parseKeys(row?.ability_boosts);
  const fixed = raw.filter(isKey);
  const frees = raw.filter((k) => k === 'free').length;
  const flaws = parseKeys(row?.ability_flaws).filter(isKey);
  const keyAbility = classesById.get(classId)?.key_ability as AbilityKey | undefined;
  const order: AbilityKey[] = [
    ...(keyAbility ? [keyAbility] : []),
    ...(CLASS_BOOST_PRIORITY[classId] ?? []),
    ...DEFAULT_BOOST_ORDER,
  ];
  const boosts: AbilityKey[] = [...fixed];
  for (let i = 0; i < frees; i++) {
    const pick = order.find((a) => !boosts.includes(a) && !flaws.includes(a));
    if (pick) boosts.push(pick);
  }
  return { hp: (row?.hp as number | undefined) ?? ANCESTRY_BASE_HP, boosts, flaws };
}

/** Template scores with the ancestry applied. */
export function foundingAbilities(classId: number, ancestry: AncestryId): Abilities {
  const template = templateByClassId.get(classId);
  if (!template) throw new Error(`foundingAbilities: no founding template for class ${classId}`);
  const fx = ancestryEffect(ancestry, classId);
  const out = { ...template.abilities };
  for (const b of fx.boosts) out[b] += 2;
  for (const f of fx.flaws) out[f] -= 2;
  return out;
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

const defaultChoice = (t: FoundingTemplate): MusterChoice => ({
  name: t.defaultName,
  ancestry: ancestryIds.find((id) => ancestryNameById.get(id) === t.defaultAncestry) ?? ancestryIds[0]!,
  gender: t.defaultGender,
  classId: t.classId,
});

/** The muster's opening party: the original wedge, Fighter / Rogue / Cleric / Wizard. */
export const DEFAULT_MUSTER: readonly MusterChoice[] = TEMPLATES.slice(0, FOUNDING_PARTY_SIZE).map(defaultChoice);

/** A recruit's default identity for any founding class. */
export function defaultChoiceFor(classId: number): MusterChoice {
  const t = templateByClassId.get(classId);
  if (!t) throw new Error(`defaultChoiceFor: no founding template for class ${classId}`);
  return defaultChoice(t);
}

/** One founding hero. Ids are positional, so identical choices reproduce the campaign. */
export function musterHero(choice: MusterChoice, index: number): HeroKit {
  const template = templateByClassId.get(choice.classId);
  if (!template) throw new Error(`musterParty: no founding template for class ${choice.classId}`);
  const id = Ids.hero(index + 1);
  const name = choice.name.trim() === '' ? template.defaultName : choice.name.trim();
  const abilities = foundingAbilities(choice.classId, choice.ancestry);
  const hpPerLevel = (progressionFor(choice.classId, 1)?.hp_per_level as number | undefined) ?? 8;
  const maxHp = ancestryEffect(choice.ancestry, choice.classId).hp + Math.max(1, hpPerLevel + abilityMod(abilities.con));
  const loadout = template.loadout();
  // The known-spells pool starts as whatever the loadout casts.
  const knownSpells = [
    ...new Set(loadout.filter((e) => e.action === 'cast').map((e) => e.spellId)),
  ].sort((a, b) => a - b);
  return {
    hero: mkHero(
      id, name, template.classId, abilities, maxHp,
      { ...template.skills }, template.feats.map((f) => ({ ...f })),
      { ancestry: choice.ancestry, gender: choice.gender },
      knownSpells,
    ),
    equipped: template.equipped.map((e) => ({ ...e, propertyIds: [...e.propertyIds] })),
    loadout,
    // Muster and the save backfill must agree, or save → load → save won't round-trip.
    quickSlots: emptyQuickSlots(),
    altWeaponSet: [],
  };
}

/** Build the founding party. A given set of choices always produces the same campaign. */
export function musterParty(choices: readonly MusterChoice[]): HeroKit[] {
  return choices.map((choice, i) => musterHero(choice, i));
}
