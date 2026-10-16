/**
 * Equipment derivation — item instance tuples → effective stats.
 * (Decision-ledger Areas 5/6: instances are `(baseId, tier, propertyIds[], seed)`;
 * name/stats/price all RECOMPUTE from registries — nothing denormalized.)
 *
 * This is where potency_bonus and striking_tier finally enter the math the
 * Godot build only ever displayed in tooltips.
 */

import { item_properties, items } from '@content/generated';
import type { ItemInstance } from '@sim/core/events/types';

type ItemRow = (typeof items)[number];
type PropertyRow = (typeof item_properties)[number];

/** Base lookup by string id (numeric converted ids today; authored slugs later). */
export const itemBasesById = new Map<string, ItemRow>(items.map((i) => [String(i.id), i]));
export const propertiesById = new Map<string, PropertyRow>(item_properties.map((p) => [p.id, p]));

/**
 * Tier grants for GENERATED instances (loot-grammar brief: rolls happen on
 * mundane bases; authored quality items keep their authored values and are
 * flagged non-rollable). Values follow the authored-data convention:
 * masterwork = +1 attack only; enchanted carries potency 2. Registry-tunable.
 */
export const TIER_GRANTS: Record<ItemInstance['tier'], { potency: number; striking: number }> = {
  mundane: { potency: 0, striking: 0 },
  masterwork: { potency: 1, striking: 0 },
  magical: { potency: 1, striking: 0 },
  enchanted: { potency: 2, striking: 0 },
  legendary: { potency: 4, striking: 1 }, // never generated; authored bases only
};

/** Price multipliers by tier + per-property (placeholder-tunable; harness-validated). */
export const TIER_PRICE_MULT: Record<ItemInstance['tier'], number> = {
  mundane: 1, masterwork: 4, magical: 16, enchanted: 48, legendary: 1,
};
export const PROPERTY_PRICE_MULT = 2.5;

/**
 * ⚠ WHICH ITEMS A TIER ROLL MEANS ANYTHING ON (M2 itemization pass).
 *
 * A tier grant is a weapon's +N to hit or an armour's +N to AC. Nothing else
 * has a place for it to go. Before this pass the grant landed in `attackBonus`
 * on EVERY item, so a loot cloak (instance tier `magical`) read "+1 to every
 * strike" on the sheet while `assembleHero` never read it — a lie on the card.
 *
 * And the grant only applies to ROLLED items: a base whose `quality_tier` is
 * not `mundane` is an authored magic item, and its authored numbers (and
 * authored price) already ARE its magic. The loot roller stamps those with
 * their own quality as the instance tier, and the shop stamps them `mundane`;
 * both must derive the same item, or a cloak from a chest sells for 16× the
 * one from the market.
 */
const TIERABLE_TYPES = new Set(['weapon', 'armor', 'shield']);

/** Does an instance's tier change this base at all? (Rolled weapons/armour/shields only.) */
export function tierApplies(base: Pick<ItemRow, 'quality_tier' | 'item_type'>): boolean {
  return base.quality_tier === 'mundane' && TIERABLE_TYPES.has(base.item_type);
}
const isRolled = tierApplies;

export interface OnHitEffect {
  propertyId: string;
  onHit: Record<string, unknown> | null;
  onCrit: Record<string, unknown> | null;
  /**
   * The property's always-on effect (Keen's crit range, a resistance). Most
   * have no consumer yet; the item card greys those. Optional because enemy
   * riders (combat/build.ts) are built from ability rows with no passive.
   */
  passive?: Record<string, unknown> | null;
}

export interface DerivedItem {
  displayName: string;
  slot: string | null;
  itemType: string;
  /** Attack-roll bonus (potency). WEAPONS ONLY — 0 on everything else. */
  attackBonus: number;
  /** The enhancement part of `acBonus` (armour/shield potency). Lost when untrained. */
  acPotency: number;
  /** Armour's cap on the Dex added to AC, or null. */
  maxDex: number | null;
  /** Property ids actually on the item (rolled + authored), for the card. */
  propertyIds: string[];
  /** Authored properties the row already folded into its dice (Flaming Sword's 1d6). */
  foldedPropertyIds: string[];
  /** Authored legendary powers, unparsed. The engine reads none of them yet. */
  legendaryEffects: Record<string, unknown> | null;
  /** Number of EXTRA weapon damage dice (PF2E striking). */
  strikingTier: number;
  /** Weapon dice with striking applied (e.g. 1d8 + striking 1 → 2d8). */
  damageDice: string | null;
  damageType: string | null;
  acBonus: number;
  /**
   * PF2E's armour check penalty, −1 to −4 (0 or null on everything else).
   *
   * ⚠ THIS COLUMN WAS DEAD DATA UNTIL BRIEF #19. Brief #16 §5.1 flagged it as
   * read by nothing, in the same breath as `item_level` and
   * `class_weapon_proficiency`; 17 item rows carry a value. It applies to
   * Stealth, which is why the backstab is what finally wires it, and it makes
   * the rogue's armour choice matter twice: the gear bracket puts Shade in a
   * Chain Shirt for its `max_dex`, and that Chain Shirt now also costs −1 on
   * every conceal check.
   */
  armorCheckPenalty: number;
  /** Ability/save/speed bonuses from the base (e.g. Belt of Strength). */
  statBonuses: Record<string, number>;
  onHitEffects: OnHitEffect[];
  weaponTraits: string[];
  bulk: number;
  price: number;
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Apply striking: N extra dice of the base die (1d8 + 1 → 2d8). */
export function applyStriking(baseDice: string | null, striking: number): string | null {
  if (!baseDice) return null;
  const m = /^(\d+)d(\d+)(.*)$/.exec(baseDice);
  if (!m || striking <= 0) return baseDice;
  return `${Number(m[1]) + striking}d${m[2]}${m[3] ?? ''}`;
}

/**
 * Deterministic display name: [Masterwork] [Properties…] Base [+potency].
 *
 * ⚠ THE TIER WORD IS DROPPED WHEN A +N SAYS THE SAME THING (M2 itemization).
 * "Enchanted Keen Unholy Shortsword +2" said "magic" twice, and on a cloak
 * the tier word implied a bonus that did not exist. The +N is the PF2E
 * marker and it is the number the card explains, so it wins. Masterwork keeps
 * its word: its +1 to hit is craftsmanship, not enchantment, so it never
 * takes a suffix and the word is the only sign of it.
 */
const ENHANCEMENT_TIERS = new Set<string>(['magical', 'enchanted', 'legendary']);

function composeName(base: ItemRow, tier: ItemInstance['tier'], props: PropertyRow[], potency: number): string {
  const parts: string[] = [];
  if (tier === 'masterwork' && !base.name.toLowerCase().includes('masterwork')) parts.push('Masterwork');
  for (const p of props) if (!base.name.includes(p.name)) parts.push(p.name);
  parts.push(base.name);
  const name = parts.join(' ');
  const enhanced = ENHANCEMENT_TIERS.has(tier) || ENHANCEMENT_TIERS.has(base.quality_tier as string);
  return potency > 0 && enhanced && !/\+\d/.test(base.name) ? `${name} +${potency}` : name;
}

/**
 * Derive an instance's effective stats. Throws on unknown base/property or an
 * incompatible property — the loot roller guarantees compatibility, so a
 * violation here is corruption, not a gameplay case.
 */
export function deriveItem(instance: ItemInstance): DerivedItem {
  const base = itemBasesById.get(instance.baseId);
  if (!base) throw new Error(`deriveItem: unknown base "${instance.baseId}"`);

  const props: PropertyRow[] = instance.propertyIds.map((pid) => {
    const p = propertiesById.get(pid);
    if (!p) throw new Error(`deriveItem: unknown property "${pid}" on ${base.name}`);
    const appliesTo = parseJson<string[]>(p.applies_to, []);
    if (!appliesTo.includes(base.item_type)) {
      throw new Error(`deriveItem: property "${pid}" does not apply to ${base.item_type} (${base.name})`);
    }
    return p;
  });

  /**
   * ⚠ AUTHORED PROPERTIES ARE PART OF THE ITEM TOO. Dreadblade carries
   * `["keen","dread"]` in its row, not on the instance, and nothing read it:
   * the sword's whole identity was decoration. They join the effect list here,
   * EXCEPT where the row already folded the rider into its dice (Flaming Sword
   * is `1d8+1d6`) — merging those would deal the 1d6 twice.
   */
  const rolled = isRolled(base);
  const authoredIds = parseJson<unknown>(base.properties, null);
  const authoredProps: PropertyRow[] = Array.isArray(authoredIds)
    ? authoredIds
      .map((id) => propertiesById.get(String(id)))
      .filter((p): p is PropertyRow => p !== undefined && !props.includes(p))
    : [];
  const foldedIntoDice = authoredProps.length > 0 && countDiceTerms(base.damage_dice as string | null) > 1;
  const effectProps = foldedIntoDice ? props : [...props, ...authoredProps];

  const grants = rolled ? TIER_GRANTS[instance.tier] : TIER_GRANTS.mundane;
  const potency = Math.max((base.potency_bonus as number) ?? 0, grants.potency);
  const strikingTier = Math.max((base.striking_tier as number) ?? 0, grants.striking);

  /**
   * BUG A (brief #14 §5): potency was routed to `attackBonus` and nothing else,
   * and `equippedGear` only reads `attackBonus` for weapons — so on armour it
   * went nowhere. Potency on worn gear is an enhancement bonus to AC, the
   * defensive twin of what the attack roll gets. The armour ladder is monotone
   * with no content edit: Full Plate +3 is ac 10 against mundane Full Plate's 8.
   *
   * ⚠ AND THE MIRROR BUG (M2 itemization): potency ALSO landed in
   * `attackBonus` on armour, cloaks and rings, where nothing reads it — so the
   * sheet told the player a Ring of Protection +1 gave "+1 to every strike".
   * Potency now has exactly one home per item type.
   *
   * (One row stays anomalous and it is content, not code: Ironmane's Pelt (181)
   * is legendary, level 16, 7,000 gp and carries `potency_bonus 0`, so it still
   * lands at ac 7. Flagged, not silently patched.)
   */
  const isWeapon = base.item_type === 'weapon';
  const worn = base.item_type === 'armor' || base.item_type === 'shield';
  /**
   * ⚠ MASTERWORK ARMOUR IS LIGHTER, NOT TOUGHER. The authored Masterwork
   * rows keep their base AC and carry one point less check penalty (Chain Mail
   * −2 → Masterwork Chain Mail −1). A ROLLED masterwork armour used to get +1
   * AC from the tier grant instead, so the same name meant two different
   * items depending on whether it came from a shop or a chest.
   */
  const masterworkArmour = rolled && worn && instance.tier === 'masterwork';
  const acPotency = worn && !masterworkArmour ? potency : 0;
  const authoredAc = (base.ac_bonus as number | null) ?? 0;
  /**
   * ⚠ A WONDROUS ITEM'S +N IS ITS AC (Ring of Protection, Amulet of Natural
   * Armor). The ring authors both `ac_bonus 1` and `potency_bonus 1` for the
   * same +1, the amulet authors only the potency — so the amulet did nothing
   * at all while its card claimed a strike bonus. Taking the larger of the
   * two reads both rows the way their names promise, without double-counting
   * the ring.
   */
  const acBonus = worn
    ? authoredAc + acPotency
    : base.item_type === 'wondrous'
      ? Math.max(authoredAc, (base.potency_bonus as number | null) ?? 0)
      : authoredAc;
  const authoredAcp = (base.armor_check_penalty as number | null) ?? 0;
  const armorCheckPenalty = masterworkArmour ? Math.min(0, authoredAcp + 1) : authoredAcp;

  const basePrice = (base.price as number) ?? 0;
  const tierMult = rolled ? TIER_PRICE_MULT[instance.tier] : 1;
  const price = Math.max(
    Math.round(basePrice * tierMult * Math.pow(PROPERTY_PRICE_MULT, props.length)),
    basePrice,
  );

  return {
    displayName: composeName(base, rolled ? instance.tier : 'mundane', props, potency),
    slot: base.slot as string | null,
    itemType: base.item_type as string,
    attackBonus: isWeapon ? potency : 0,
    acPotency,
    maxDex: (base.max_dex as number | null) ?? null,
    propertyIds: effectProps.map((p) => p.id),
    foldedPropertyIds: foldedIntoDice ? authoredProps.map((p) => p.id) : [],
    legendaryEffects: parseJson<Record<string, unknown> | null>(base.legendary_effects, null),
    strikingTier,
    damageDice: applyStriking(base.damage_dice as string | null, strikingTier),
    damageType: base.damage_type as string | null,
    acBonus,
    armorCheckPenalty,
    statBonuses: parseJson<Record<string, number>>(base.stat_bonus, {}),
    onHitEffects: effectProps.map((p) => ({
      propertyId: p.id,
      onHit: parseJson<Record<string, unknown> | null>(p.on_hit_effect, null),
      onCrit: parseJson<Record<string, unknown> | null>(p.on_crit_effect, null),
      passive: parseJson<Record<string, unknown> | null>(p.passive_effect, null),
    })),
    weaponTraits: parseJson<string[]>(base.weapon_traits, []),
    bulk: (base.bulk as number) ?? 0,
    price,
  };
}

/** "1d8+1d6" → 2, "1d8+1" → 1, null → 0. */
function countDiceTerms(dice: string | null): number {
  if (!dice) return 0;
  return dice.split('+').filter((p) => /\d*d\d+/.test(p)).length;
}

/** Total armour check penalty across everything worn (≤ 0). Applies to Stealth. */
export function aggregateArmorCheckPenalty(equipped: readonly ItemInstance[]): number {
  let total = 0;
  for (const inst of equipped) total += deriveItem(inst).armorCheckPenalty;
  return total;
}

/** Aggregate stat bonuses across a hero's equipped instances ({str: 2, fort_save: 1, …}). */
/**
 * Aggregate every equipped item's `stat_bonus` into one lookup.
 *
 * ⚠ THE KEY VOCABULARY IS NORMALISED HERE, and that fixes a real bug.
 * Items author saves as `fort_save` / `ref_save` / `will_save` (19 rows,
 * including every Cloak of Resistance). `assembly.ts` reads them as
 * `save_fort` / `save_ref` / `save_will`, matching the FEAT stat_mod
 * vocabulary. Neither side was wrong in isolation — they simply never agreed,
 * so the lookup silently missed and the Cloak of Resistance +1 gave nothing.
 *
 * ⚠ MEASURED, NOT ASSUMED. Probed by assembling a hero with and without the
 * cloak: saves were identical (fort 3 / ref 2 / will 2 both ways). A Belt of
 * Strength +2 DID work, because `str` happens to spell the same on both sides
 * — which is exactly why this went unnoticed. Half the channel worked.
 *
 * Aliasing rather than renaming either side: the feat vocabulary is shared
 * with `resolveStatMods` and the item strings are authored content, so
 * changing either would be a wider edit with its own migration.
 */
const STAT_BONUS_ALIASES: Readonly<Record<string, string>> = {
  fort_save: 'save_fort',
  ref_save: 'save_ref',
  will_save: 'save_will',
};

export function aggregateStatBonuses(equipped: readonly ItemInstance[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const inst of equipped) {
    const derived = deriveItem(inst);
    for (const [stat, value] of Object.entries(derived.statBonuses)) {
      const key = STAT_BONUS_ALIASES[stat] ?? stat;
      out[key] = (out[key] ?? 0) + value;
    }
  }
  return out;
}
