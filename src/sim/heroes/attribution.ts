/**
 * STAT ATTRIBUTION — where each number on the character sheet came from
 * (brief #24, Variant G).
 *
 * ⚠ THE SHEET COULD ALREADY SHOW TOTALS AND THAT WAS THE PROBLEM. `heroSheet`
 * returns `ac: 21` with no way to learn WHY it is 21, so a player cannot tell
 * what their gear is doing, and the research finding that drove this brief was
 * that the official PF2E paper sheet solves exactly this by printing the
 * components under the total.
 *
 * ── THE RULE THAT KEEPS THIS HONEST ───────────────────────────────────────
 *
 * ⚠ A LEDGER MUST SUM TO THE TOTAL THE ENGINE ACTUALLY USES. It is trivially
 * easy to write a plausible-looking breakdown that drifts from `assembleHero`
 * — someone adds a term to the real AC and forgets the ledger, and the sheet
 * quietly starts lying. That failure is invisible: the number still looks
 * right because it IS the right number; only the explanation is wrong.
 *
 * So every ledger carries its own `total`, the tests assert it equals the
 * assembled Combatant's value, and the sum of the parts is asserted against
 * that same total. Three-way agreement, checked per hero, per stat.
 */

import { abilityMod, characterLevel } from './types';
import { totalProficiency } from './proficiency';
import { aggregateStatBonuses, deriveItem, propertiesById, type DerivedItem } from './equipment';
import { isProficientWithArmor, isProficientWithWeapon } from './gearProficiency';
import { resolveStatMods } from './featEffects';
import { itemBasesById } from './equipment';
import { NON_PROFICIENCY_PENALTY } from '@content/combat';
import { isConditionId } from '@sim/combat/conditions';
import { spellsById } from '@sim/registry';
import { isConsumableUsable, spellIdForItem } from './quickSlots';
import type { HeroState } from './types';
import type { ItemInstance } from '@sim/core/events/types';
import type { AbilityKey } from './types';

/** One contributing term. `category` is the shared vocabulary the UI groups by. */
export interface LedgerTerm {
  /** Player-facing source: "Dexterity", "Chain Mail", "Trained". */
  label: string;
  /** `base` | `ability` | `proficiency` | `item` | `feat` | `ancestry` | `class`. */
  category: string;
  value: number;
  /** Present for item terms so the UI can link a row to a gear slot. */
  slot?: string;
}

export interface StatLedger {
  /** Must equal the value `assembleHero` produced. Asserted by tests. */
  total: number;
  terms: LedgerTerm[];
}

const BASE_AC = 10;
const BASE_SPEED = 5;
const FEET_PER_UNIT = 5;

/**
 * Equipped items that carry an AC contribution, with their display names.
 *
 * ⚠ UNTRAINED ARMOUR LOSES ITS +N, exactly as `equippedGear` in assembly.ts
 * does (brief #23 D1). This ledger used to add the full `acBonus` regardless,
 * so a wizard in Chain Mail +2 read AC 2 higher than the engine used. Only
 * hidden because no test put an untrained hero in +N armour.
 */
function armourTerms(hero: HeroState, equipped: readonly ItemInstance[]): LedgerTerm[] {
  const out: LedgerTerm[] = [];
  for (const inst of equipped) {
    const d = deriveItem(inst);
    const row = itemBasesById.get(inst.baseId);
    const worn = d.itemType === 'armor' || d.itemType === 'shield';
    const trained = !worn || !row || isProficientWithArmor(hero, row);
    const value = trained ? d.acBonus : d.acBonus - d.acPotency;
    if (value === 0) continue;
    out.push({ label: d.displayName, category: 'item', value, slot: d.slot ?? 'none' });
  }
  return out;
}

/** The dex actually applied to AC, honouring the worn armour's cap. */
function cappedDex(hero: HeroState, equipped: readonly ItemInstance[], dexMod: number): number {
  let cap: number | null = null;
  for (const inst of equipped) {
    const base = itemBasesById.get(inst.baseId);
    const maxDex = base?.max_dex as number | null | undefined;
    if (maxDex === null || maxDex === undefined) continue;
    cap = cap === null ? maxDex : Math.min(cap, maxDex);
  }
  return cap === null ? dexMod : Math.min(dexMod, cap);
}

function abilityMods(hero: HeroState, equipped: readonly ItemInstance[]): Record<AbilityKey, number> {
  const itemStat = aggregateStatBonuses(equipped);
  const mods = {} as Record<AbilityKey, number>;
  for (const key of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as AbilityKey[]) {
    mods[key] = abilityMod(hero.abilities[key] + (itemStat[key] ?? 0));
  }
  return mods;
}

/**
 * ARMOUR CLASS — base + dex (capped) + proficiency + every item's AC.
 *
 * ⚠ MIRRORS `assembleHero`'s ORDER AND CAPPING EXACTLY, including the armour
 * dex cap. A ledger that applied the raw dex would sum to a different number
 * than the sheet shows, which is precisely the drift the tests guard.
 */
export function acLedger(hero: HeroState, equipped: readonly ItemInstance[]): StatLedger {
  const mods = abilityMods(hero, equipped);
  const dex = cappedDex(hero, equipped, mods.dex);
  const itemStat = aggregateStatBonuses(equipped);

  const terms: LedgerTerm[] = [{ label: 'Base', category: 'base', value: BASE_AC }];
  if (dex !== 0) terms.push({ label: 'Dexterity', category: 'ability', value: dex });

  /**
   * ⚠ THERE IS NO PROFICIENCY TERM IN AC, AND THAT IS THE ENGINE'S TRUTH.
   * `assembly.ts` computes `10 + gear + dex + itemStat.ac` — no proficiency at
   * all. My first draft added `totalProficiency(hero, 'ac')` because every
   * other defence has one, and the ledger came out +1 for all four classes.
   *
   * ⚠ NOTE THE TRAP FOR ANYONE ADDING ONE LATER: `totalProficiency` returns
   * `baseProficiency(level)` for ANY stat string, including names no content
   * defines tiers for. So `totalProficiency(hero, 'ac')` silently returns 1
   * rather than 0 — it does not fail, it just quietly disagrees with the sim.
   * If AC ever gains real proficiency, add it HERE and in assembly.ts together.
   */

  terms.push(...armourTerms(hero, equipped));
  if (itemStat['ac']) terms.push({ label: 'Worn items', category: 'item', value: itemStat['ac'] });

  return { total: terms.reduce((s, t) => s + t.value, 0), terms };
}

/**
 * STRIKE ATTACK.
 *
 * ⚠ PENALTIES ARE A SEPARATE LEDGER, NOT TERMS IN THIS ONE. The engine keeps
 * them apart too: `Combatant.attackBonus` holds proficiency + ability + item,
 * while `Combatant.weaponPenalty` is added at ROLL TIME in strike.ts. My first
 * draft folded the penalties in here and the exposure test caught it — the
 * ledger read −8 where the engine's attackBonus was 0.
 *
 * Keeping the split means `attackLedger().total` is comparable to
 * `c.attackBonus` directly, and the UI shows the penalty as its own visibly
 * separate line, which is also the clearer presentation.
 */
export function attackLedger(hero: HeroState, equipped: readonly ItemInstance[]): StatLedger {
  const mods = abilityMods(hero, equipped);
  const weapon = equipped.find((i) => deriveItem(i).itemType === 'weapon');
  const derived = weapon ? deriveItem(weapon) : null;
  const traits = derived?.weaponTraits ?? [];
  const atkMod = traits.includes('finesse') ? Math.max(mods.str, mods.dex) : mods.str;

  const terms: LedgerTerm[] = [];
  const prof = totalProficiency(hero, 'weapon_attack');
  if (prof !== 0) terms.push({ label: 'Trained', category: 'proficiency', value: prof });
  terms.push({
    label: traits.includes('finesse') && mods.dex > mods.str ? 'Dexterity' : 'Strength',
    category: 'ability',
    value: atkMod,
  });
  if (derived && derived.attackBonus !== 0) {
    terms.push({ label: derived.displayName, category: 'item', value: derived.attackBonus, slot: derived.slot ?? 'main_hand' });
  }

  return { total: terms.reduce((s, t) => s + t.value, 0), terms };
}

/**
 * THE ATTACK PENALTIES, as their own ledger.
 *
 * ⚠ SHOWN AT EQUAL PROMINENCE TO THE BONUSES (brief #23). Hiding the −4 for
 * an off-class weapon is how a build becomes inexplicable — the player sees a
 * low number with no named reason and no lever to pull.
 *
 * Sums to `Combatant.weaponPenalty`, which strike.ts adds at roll time.
 */
export function attackPenaltyLedger(hero: HeroState, equipped: readonly ItemInstance[]): StatLedger {
  const terms: LedgerTerm[] = [];

  const weapon = equipped.find((i) => deriveItem(i).itemType === 'weapon');
  const weaponRow = weapon ? itemBasesById.get(weapon.baseId) : undefined;
  if (weaponRow && !isProficientWithWeapon(hero, weaponRow)) {
    terms.push({ label: 'Not proficient with this weapon', category: 'penalty', value: NON_PROFICIENCY_PENALTY });
  }

  for (const inst of equipped) {
    const d = deriveItem(inst);
    if (d.itemType !== 'armor' && d.itemType !== 'shield') continue;
    const row = itemBasesById.get(inst.baseId);
    if (!row || isProficientWithArmor(hero, row)) continue;
    if (d.armorCheckPenalty !== 0) {
      terms.push({ label: `${d.displayName} (unproficient)`, category: 'penalty', value: d.armorCheckPenalty });
    }
  }

  return { total: terms.reduce((s, t) => s + t.value, 0), terms };
}

/** A saving throw — proficiency + governing ability + feat and item bonuses. */
export function saveLedger(
  hero: HeroState,
  equipped: readonly ItemInstance[],
  save: 'fort' | 'ref' | 'will',
): StatLedger {
  const mods = abilityMods(hero, equipped);
  const itemStat = aggregateStatBonuses(equipped);
  const featStat = resolveStatMods(hero, hero.feats);

  const ABILITY: Record<typeof save, AbilityKey> = { fort: 'con', ref: 'dex', will: 'wis' };
  const LABEL: Record<typeof save, string> = { fort: 'Constitution', ref: 'Dexterity', will: 'Wisdom' };
  const PROF: Record<typeof save, string> = { fort: 'fort_save', ref: 'ref_save', will: 'will_save' };
  const KEY: Record<typeof save, string> = { fort: 'save_fort', ref: 'save_ref', will: 'save_will' };

  const terms: LedgerTerm[] = [];
  const prof = totalProficiency(hero, PROF[save]);
  if (prof !== 0) terms.push({ label: 'Trained', category: 'proficiency', value: prof });
  terms.push({ label: LABEL[save], category: 'ability', value: mods[ABILITY[save]] });
  if (featStat[KEY[save]]) terms.push({ label: 'Feats', category: 'feat', value: featStat[KEY[save]]! });
  if (itemStat[KEY[save]]) terms.push({ label: 'Worn items', category: 'item', value: itemStat[KEY[save]]! });

  return { total: terms.reduce((s, t) => s + t.value, 0), terms };
}

/** HIT POINTS — the class/ancestry base plus feat and item additions. */
export function hpLedger(hero: HeroState, equipped: readonly ItemInstance[]): StatLedger {
  const itemStat = aggregateStatBonuses(equipped);
  const featStat = resolveStatMods(hero, hero.feats);
  const level = characterLevel(hero);

  const terms: LedgerTerm[] = [
    { label: 'Class and ancestry', category: 'class', value: hero.maxHp },
  ];
  if (featStat['hp_per_level']) {
    terms.push({ label: 'Feats', category: 'feat', value: featStat['hp_per_level']! * level });
  }
  if (itemStat['hp']) terms.push({ label: 'Worn items', category: 'item', value: itemStat['hp']! });

  return { total: terms.reduce((s, t) => s + t.value, 0), terms };
}

/** SPEED — base, feat mods (world units), item mods (authored in FEET). */
export function speedLedger(hero: HeroState, equipped: readonly ItemInstance[]): StatLedger {
  const itemStat = aggregateStatBonuses(equipped);
  const featStat = resolveStatMods(hero, hero.feats);

  const terms: LedgerTerm[] = [{ label: 'Base', category: 'base', value: BASE_SPEED }];
  if (featStat['speed']) terms.push({ label: 'Feats', category: 'feat', value: featStat['speed']! });
  if (itemStat['speed']) {
    // ⚠ Converted, matching assembly.ts — items author feet, the sim runs units.
    terms.push({ label: 'Worn items', category: 'item', value: Math.round(itemStat['speed']! / FEET_PER_UNIT) });
  }

  return { total: terms.reduce((s, t) => s + t.value, 0), terms };
}

/** What ONE item contributes, for the reverse view (gear → effects). */
export interface ItemContribution {
  /** Short heading: "To hit", "Armour", "Flaming". */
  label: string;
  /**
   * `attack` | `damage` | `ac` | `save` | `ability` | `speed` | `hp` | `skill`
   * | `rider` | `use` | `power` | `penalty`.
   */
  kind: string;
  /** The claim in plain words: "+2 to hit", "AC +3 (Dex max +2)". */
  detail: string;
  /** False when the engine has no consumer — the UI greys it: "not working yet". */
  live: boolean;
}

const ABILITY_WORD: Readonly<Record<string, string>> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};
const SAVE_WORD: Readonly<Record<string, string>> = {
  fort_save: 'Fortitude', ref_save: 'Reflex', will_save: 'Will',
};

/** Conditions in plain words. Unknown ids fall back to the id with spaces. */
const CONDITION_WORD: Readonly<Record<string, string>> = {
  persistent_bleed: 'bleeds over time',
  persistent_poison: 'poisoned over time',
  persistent_fire: 'burns over time',
  bound_to_wielder: 'held in place',
};

/** Target filters the engine cannot check (creature type/alignment is not modelled). */
const FILTER_WORD: Readonly<Record<string, string>> = {
  undead: 'undead',
  evil_or_undead: 'evil or undead foes',
  good: 'good foes',
};

/**
 * Always-on property effects, in plain words.
 *
 * ⚠ NONE OF THESE HAS A CONSUMER YET — `passive_effect` is read by nothing in
 * the sim. They are listed so the card can say what the item WILL do and grey
 * it, never so it can claim it. If one gets wired, it must move to a live line
 * with a test, not just a flag flip here.
 */
const PASSIVE_WORD: Readonly<Record<string, string>> = {
  keen: 'crits on 19–20',
  ghost_touch: 'hits ghosts fully',
  returning: 'flies back after a throw',
  shifting: 'changes weapon shape',
  shadow: '+2 Stealth',
  fortification: '25% chance to stop a crit',
  slick: '+4 to break free',
  ethereal: 'walk through walls once per rest',
  pathfinding: 'ignores rough ground',
  trapfinding: '+4 to find traps',
  shadowstep: 'harder to ambush',
  truesight: 'finds hidden rooms',
  lockbreaker: '+4 to open locks',
  everlight: 'lights the dark',
  sorvai_marked: '+2 against the Sorvai',
  fire_resistant: 'takes 5 less fire damage',
  cold_resistant: 'takes 5 less cold damage',
  shock_resistant: 'takes 5 less lightning damage',
  acid_resistant: 'takes 5 less acid damage',
  sonic_resistant: 'takes 5 less sonic damage',
};

interface EffectJson {
  damage_dice?: string;
  damage_type?: string;
  condition?: string;
  value?: number;
  effect?: string;
  value_percent?: number;
  target_filter?: string;
}

const signed = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);
const conditionWord = (id: string, value?: number): string => {
  const word = CONDITION_WORD[id] ?? id.replace(/_/g, ' ');
  return value !== undefined && value > 1 ? `${word} ${value}` : word;
};

/**
 * Split one authored effect into the parts the engine performs and the parts
 * it does not.
 *
 * ⚠ MIRRORS `resolveWeaponRiders` + the encounter loop, which is the consumer:
 * damage dice always roll; a condition lands only if `isConditionId` knows it;
 * `lifesteal` heals; any target filter withholds the WHOLE effect. Asked of
 * the consumer's own gate (`isConditionId`) rather than a copied list, so a
 * newly modelled condition lights up here without an edit.
 */
function splitEffect(e: EffectJson | null): { live: string[]; dead: string[] } {
  const live: string[] = [];
  const dead: string[] = [];
  if (!e) return { live, dead };
  const parts: { text: string; works: boolean }[] = [];
  if (e.damage_dice) parts.push({ text: `+${e.damage_dice} ${e.damage_type ?? ''}`.trim(), works: true });
  if (e.condition) parts.push({ text: conditionWord(e.condition, e.value), works: isConditionId(e.condition) });
  if (e.effect === 'lifesteal') parts.push({ text: `heals you ${e.value_percent ?? 0}% of it`, works: true });
  else if (e.effect === 'ac_penalty') parts.push({ text: `${e.value ?? -1} AC to the foe`, works: false });
  else if (e.effect) parts.push({ text: e.effect.replace(/_/g, ' '), works: false });

  if (e.target_filter !== undefined) {
    const vs = FILTER_WORD[e.target_filter] ?? e.target_filter.replace(/_/g, ' ');
    for (const p of parts) dead.push(`${p.text} vs ${vs}`);
    return { live, dead };
  }
  for (const p of parts) (p.works ? live : dead).push(p.text);
  return { live, dead };
}

/** One property → up to two lines: what works, and what does not yet. */
function propertyLines(eff: OnHitEffectLike, out: ItemContribution[]): void {
  const prop = propertiesById.get(eff.propertyId);
  const label = prop?.name ?? eff.propertyId;
  const hit = splitEffect(eff.onHit as EffectJson | null);
  const crit = splitEffect(eff.onCrit as EffectJson | null);

  const liveBits = whenBits(hit.live, crit.live);
  if (liveBits.length) out.push({ label, kind: 'rider', detail: liveBits.join('. '), live: true });

  const deadBits = whenBits(hit.dead, crit.dead);
  if (eff.passive) deadBits.push(PASSIVE_WORD[eff.propertyId] ?? (prop?.description ?? '').split('.')[0]!);
  if (deadBits.length) out.push({ label, kind: 'rider', detail: deadBits.join('. '), live: false });
}

/** "+1d6 fire on a hit. +1d10 fire on a crit" — or one line when both say the same. */
function whenBits(onHit: string[], onCrit: string[]): string[] {
  const h = onHit.join(', ');
  const c = onCrit.join(', ');
  if (h && h === c) return [`${h} on a hit or crit`];
  const out: string[] = [];
  if (h) out.push(`${h} on a hit`);
  if (c) out.push(`${c} on a crit`);
  return out;
}

type OnHitEffectLike = DerivedItem['onHitEffects'][number];

/** Authored stat_bonus → plain lines. Three equal saves read as one line. */
function statLines(stats: Record<string, number>, out: ItemContribution[]): void {
  const saves = ['fort_save', 'ref_save', 'will_save'].map((k) => stats[k]);
  const allSaves = saves.every((v) => v !== undefined && v === saves[0]);
  if (allSaves) out.push({ label: 'Saves', kind: 'save', detail: `${signed(saves[0]!)} to all saves`, live: true });

  for (const [stat, value] of Object.entries(stats)) {
    if (ABILITY_WORD[stat]) {
      out.push({ label: ABILITY_WORD[stat]!, kind: 'ability', detail: `${signed(value)} ${ABILITY_WORD[stat]}`, live: true });
    } else if (SAVE_WORD[stat]) {
      if (!allSaves) out.push({ label: SAVE_WORD[stat]!, kind: 'save', detail: `${signed(value)} ${SAVE_WORD[stat]}`, live: true });
    } else if (stat === 'speed') {
      // ⚠ In the SHEET's units (1 = 5 ft), matching assembly's conversion, so
      // the card's "+2 speed" is the jump the player sees on the Speed number.
      out.push({ label: 'Speed', kind: 'speed', detail: `${signed(Math.round(value / 5))} speed`, live: true });
    } else if (stat === 'hp') {
      out.push({ label: 'Health', kind: 'hp', detail: `${signed(value)} hit points`, live: true });
    } else if (stat === 'ac') {
      out.push({ label: 'Armour', kind: 'ac', detail: `AC ${signed(value)}`, live: true });
    } else {
      // A key `assembleHero` never reads. Shown, greyed — never claimed.
      out.push({ label: stat.replace(/_/g, ' '), kind: 'ability', detail: signed(value), live: false });
    }
  }
}

/**
 * What a pouch item does when used.
 *
 * ⚠ READ FROM THE SPELL ROW, NOT THE ITEM ROW. The item's own `properties`
 * JSON is flavour the engine never reads, and it disagrees with the spell that
 * actually resolves: Alchemist Fire's item row says 1d8, its spell rolls 1d6.
 * The card must quote the number the fight uses.
 */
function useLine(base: NonNullable<ReturnType<typeof itemBasesById.get>>, out: ItemContribution[]): void {
  const usable = isConsumableUsable(String(base.id));
  const spellId = spellIdForItem(String(base.id));
  const spell = spellId !== null ? spellsById.get(spellId) : undefined;
  let detail = 'Used once in a fight';
  if (base.item_type === 'scroll') {
    detail = `Casts ${spell?.name ?? 'a spell'} once`;
  } else if (spell) {
    const dice = String(spell.damage_dice ?? '');
    const hasDice = /\d*d\d+/.test(dice);
    const fx = parseProps(spell.effects);
    const cond = typeof fx['condition'] === 'string' && isConditionId(fx['condition'])
      ? String(fx['condition']).replace(/_/g, ' ') : null;
    if (spell.effect_type === 'healing' && hasDice) detail = `Heals ${dice} once`;
    else if (spell.effect_type === 'damage' && hasDice) {
      detail = `Thrown: ${dice} ${DAMAGE_WORD[String(spell.damage_type)] ?? spell.damage_type ?? ''}`.trim() + ' once';
    } else if (spell.effect_type === 'damage' && cond) detail = `Thrown: the foe is ${cond === 'immobilized' ? 'stuck' : cond}`;
  }
  out.push({ label: 'Use', kind: 'use', detail, live: usable });
}

const DAMAGE_WORD: Readonly<Record<string, string>> = { positive: 'holy', negative: 'unholy', electricity: 'lightning' };

function parseProps(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.length === 0) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Everything a single item does, in plain words, including what it CLAIMS to
 * do and cannot. THE one describer: the sheet, the stash tooltip and the shop
 * all read this, so the three can never disagree.
 *
 * ⚠ EVERY LIVE NUMBER HERE IS PROVEN TO REACH `assembleHero`'s combatant by
 * tests/items/itemCards.test.ts, one item per slot. Before the M2 itemization
 * pass, every magic-tier item said "+1 to every strike" — a cloak, a ring —
 * because the tier grant landed in `attackBonus` regardless of type, and
 * assembly only reads that field off the weapon.
 *
 * ⚠ INERT EFFECTS ARE RETURNED, NOT OMITTED, with `live: false`. Silence reads
 * as "there is nothing here", which is a different and wronger claim.
 *
 * `hero` is optional: the shop describes an item for nobody in particular, so
 * it gets the item's own numbers and no proficiency line.
 */
export function itemContributions(
  hero: HeroState | null,
  instance: ItemInstance,
): ItemContribution[] {
  const d = deriveItem(instance);
  const row = itemBasesById.get(instance.baseId);
  const out: ItemContribution[] = [];

  if (d.itemType === 'weapon') {
    if (d.attackBonus !== 0) {
      out.push({ label: 'To hit', kind: 'attack', detail: `${signed(d.attackBonus)} to hit`, live: true });
    }
    if (d.damageDice) {
      out.push({ label: 'Damage', kind: 'damage', detail: `${d.damageDice} ${d.damageType ?? ''}`.trim(), live: true });
    }
    for (const id of d.foldedPropertyIds) {
      const p = propertiesById.get(id);
      out.push({ label: p?.name ?? id, kind: 'rider', detail: 'its extra die is in the damage above', live: true });
    }
  }

  if (d.itemType === 'armor' || d.itemType === 'shield') {
    const trained = !hero || !row || isProficientWithArmor(hero, row);
    // ⚠ Untrained armour keeps its base AC and loses its +N — assembly's rule (D1).
    const ac = trained ? d.acBonus : d.acBonus - d.acPotency;
    const cap = d.maxDex !== null ? ` (Dex max ${signed(d.maxDex)})` : '';
    out.push({ label: 'Armour', kind: 'ac', detail: `AC ${signed(ac)}${cap}`, live: true });
    if (d.armorCheckPenalty !== 0) {
      out.push({ label: 'Stealth', kind: 'skill', detail: `${d.armorCheckPenalty} to Stealth`, live: true });
    }
    if (!trained) {
      const bits = [d.acPotency > 0 ? `loses its +${d.acPotency}` : '', d.armorCheckPenalty !== 0 ? `${d.armorCheckPenalty} to hit` : '']
        .filter(Boolean);
      out.push({ label: 'Not trained', kind: 'penalty', detail: bits.length ? bits.join(', ') : 'no effect yet', live: true });
    }
  } else if (d.itemType !== 'weapon' && d.acBonus !== 0) {
    out.push({ label: 'Armour', kind: 'ac', detail: `AC ${signed(d.acBonus)}`, live: true });
  }

  statLines(d.statBonuses, out);

  /**
   * ⚠ RIDERS ARE LIVE AS OF BRIEF #24 M1 — except the parts naming a condition
   * the engine does not model, a target it cannot recognise, or an always-on
   * property effect. Those are greyed, line by line.
   */
  for (const eff of d.onHitEffects) propertyLines(eff, out);

  if (d.legendaryEffects) {
    const powers: string[] = [];
    const unique = d.legendaryEffects['unique_ability'] as { name?: string } | undefined;
    if (unique?.name) powers.push(unique.name);
    const grants = d.legendaryEffects['grants'];
    if (Array.isArray(grants)) powers.push(...grants.map((g) => String(g).replace(/_/g, ' ')));
    out.push({ label: 'Legend', kind: 'power', detail: powers.length ? powers.join(', ') : 'special powers', live: false });
  }

  if (row && (d.itemType === 'consumable' || d.itemType === 'scroll')) useLine(row, out);
  if (d.itemType === 'ammo') out.push({ label: 'Ammo', kind: 'use', detail: 'bows do not use ammo yet', live: false });

  if (hero && d.itemType === 'weapon' && row && !isProficientWithWeapon(hero, row)) {
    out.push({ label: 'Not trained', kind: 'penalty', detail: `${NON_PROFICIENCY_PENALTY} to hit`, live: true });
  }

  return out;
}

/** Kinds that headline a card, in the order a player reads an item. */
const HEADLINE_KINDS = ['attack', 'damage', 'ac', 'save', 'ability', 'speed', 'hp', 'use'];

/**
 * The one-line version for tight spaces (paperdoll box, shop row): the first
 * two live numbers. Falls back to "not working yet" when nothing is live, so
 * a dead item never reads as a blank, and never as a claim.
 */
export function itemSummary(contributions: readonly ItemContribution[]): string {
  const live = contributions.filter((c) => c.live && HEADLINE_KINDS.includes(c.kind));
  live.sort((a, b) => HEADLINE_KINDS.indexOf(a.kind) - HEADLINE_KINDS.indexOf(b.kind));
  if (live.length > 0) return live.slice(0, 2).map((c) => c.detail).join(' · ');
  return contributions.length > 0 ? 'not working yet' : '—';
}

/**
 * Conditions weapon riders name that the engine does not model.
 *
 * ⚠ MIRRORS the ledger in tests/combat/weaponRiders.test.ts. Kept as a literal
 * rather than imported from the test, because src must not depend on tests —
 * and a meta-test asserts the two agree so they cannot drift.
 */
export const UNMODELLED_CONDITIONS: readonly string[] = [
  'bound_to_wielder', 'deafened', 'fleeing',
  'persistent_bleed', 'persistent_fire', 'persistent_poison',
];

/** Slot health, for the paperdoll's three states. */
export type SlotState = 'filled' | 'empty' | 'underserved';

/**
 * Is this slot pulling its weight?
 *
 * ⚠ "UNDERSERVED" IS THE POINT OF THE PAPERDOLL. Empty slots are easy to see;
 * the harder signal is a slot that LOOKS equipped but carries an effect the
 * engine ignores, or an off-class item eating the proficiency penalty. A fully
 * equipped hero should still be able to see where the slack is.
 */
export function slotState(hero: HeroState, instance: ItemInstance | null): SlotState {
  if (!instance) return 'empty';
  const contributions = itemContributions(hero, instance);
  if (contributions.some((c) => !c.live)) return 'underserved';
  if (contributions.some((c) => c.kind === 'penalty')) return 'underserved';
  return 'filled';
}
