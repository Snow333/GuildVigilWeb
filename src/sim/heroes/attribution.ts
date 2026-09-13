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
import { aggregateStatBonuses, deriveItem } from './equipment';
import { isProficientWithArmor, isProficientWithWeapon } from './gearProficiency';
import { resolveStatMods } from './featEffects';
import { itemBasesById } from './equipment';
import { NON_PROFICIENCY_PENALTY } from '@content/combat';
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

/** Equipped items that carry an AC contribution, with their display names. */
function armourTerms(equipped: readonly ItemInstance[]): LedgerTerm[] {
  const out: LedgerTerm[] = [];
  for (const inst of equipped) {
    const d = deriveItem(inst);
    if (d.acBonus === 0) continue;
    out.push({ label: d.displayName, category: 'item', value: d.acBonus, slot: d.slot ?? 'none' });
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

  terms.push(...armourTerms(equipped));
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

/** What ONE equipped item contributes, for the reverse view (gear → effects). */
export interface ItemContribution {
  label: string;
  /** `attack` | `damage` | `ac` | `save` | `speed` | `ability` | `rider`. */
  kind: string;
  detail: string;
  /** False when the engine has no consumer — the UI greys and marks it. */
  live: boolean;
}

/**
 * Everything a single item does, including what it CLAIMS to do and cannot.
 *
 * ⚠ INERT EFFECTS ARE RETURNED, NOT OMITTED, with `live: false`. A player
 * holding a Wounding longsword must be told the rider does nothing rather than
 * shown a sword with no mention of it — silence reads as "there is nothing
 * here", which is a different and wronger claim.
 */
export function itemContributions(
  hero: HeroState,
  instance: ItemInstance,
): ItemContribution[] {
  const d = deriveItem(instance);
  const out: ItemContribution[] = [];

  if (d.attackBonus !== 0) {
    out.push({ label: 'Attack bonus', kind: 'attack', detail: `+${d.attackBonus} to every strike`, live: true });
  }
  if (d.damageDice) {
    out.push({ label: 'Weapon damage', kind: 'damage', detail: d.damageDice, live: true });
  }
  if (d.acBonus !== 0) {
    out.push({ label: 'Armour class', kind: 'ac', detail: `+${d.acBonus}`, live: true });
  }
  for (const [stat, value] of Object.entries(d.statBonuses)) {
    out.push({ label: stat, kind: 'ability', detail: `${value >= 0 ? '+' : ''}${value}`, live: true });
  }

  /**
   * ⚠ RIDERS ARE LIVE AS OF BRIEF #24 M1 — except those naming a condition the
   * engine does not model, which still do nothing. Reporting them all as live
   * would recreate the exact lie this sheet exists to expose.
   */
  for (const eff of d.onHitEffects) {
    const onHit = eff.onHit as { damage_dice?: string; damage_type?: string; condition?: string } | null;
    if (!onHit) continue;
    if (onHit.damage_dice) {
      out.push({
        label: eff.propertyId,
        kind: 'rider',
        detail: `${onHit.damage_dice} ${onHit.damage_type ?? ''} per hit`.trim(),
        live: true,
      });
    } else if (onHit.condition) {
      out.push({
        label: eff.propertyId,
        kind: 'rider',
        detail: `applies ${onHit.condition}`,
        live: UNMODELLED_CONDITIONS.indexOf(onHit.condition) === -1,
      });
    }
  }

  const row = itemBasesById.get(instance.baseId);
  if (d.itemType === 'weapon' && row && !isProficientWithWeapon(hero, row)) {
    out.push({ label: 'Not proficient', kind: 'penalty', detail: `${NON_PROFICIENCY_PENALTY} to attack`, live: true });
  }

  return out;
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
