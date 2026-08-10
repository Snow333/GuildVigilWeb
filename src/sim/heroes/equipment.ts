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

export interface OnHitEffect {
  propertyId: string;
  onHit: Record<string, unknown> | null;
  onCrit: Record<string, unknown> | null;
}

export interface DerivedItem {
  displayName: string;
  slot: string | null;
  itemType: string;
  /** Attack-roll bonus (potency). */
  attackBonus: number;
  /** Number of EXTRA weapon damage dice (PF2E striking). */
  strikingTier: number;
  /** Weapon dice with striking applied (e.g. 1d8 + striking 1 → 2d8). */
  damageDice: string | null;
  damageType: string | null;
  acBonus: number;
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
 * Deterministic display name: [Tier] [Properties…] Base [+potency].
 * The +N suffix is an ENHANCEMENT marker: masterwork's quality bonus is
 * craftsmanship, not enchantment, so it never suffixes.
 */
const ENHANCEMENT_TIERS = new Set(['magical', 'enchanted', 'legendary']);

function composeName(base: ItemRow, tier: ItemInstance['tier'], props: PropertyRow[], potency: number): string {
  const parts: string[] = [];
  if (tier !== 'mundane' && !base.name.toLowerCase().includes(tier)) {
    parts.push(tier.charAt(0).toUpperCase() + tier.slice(1));
  }
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

  const grants = TIER_GRANTS[instance.tier];
  const attackBonus = Math.max((base.potency_bonus as number) ?? 0, grants.potency);
  const strikingTier = Math.max((base.striking_tier as number) ?? 0, grants.striking);

  const basePrice = (base.price as number) ?? 0;
  const price = Math.max(
    Math.round(basePrice * TIER_PRICE_MULT[instance.tier] * Math.pow(PROPERTY_PRICE_MULT, props.length)),
    basePrice,
  );

  return {
    displayName: composeName(base, instance.tier, props, attackBonus),
    slot: base.slot as string | null,
    itemType: base.item_type as string,
    attackBonus,
    strikingTier,
    damageDice: applyStriking(base.damage_dice as string | null, strikingTier),
    damageType: base.damage_type as string | null,
    acBonus: (base.ac_bonus as number | null) ?? 0,
    statBonuses: parseJson<Record<string, number>>(base.stat_bonus, {}),
    onHitEffects: props.map((p) => ({
      propertyId: p.id,
      onHit: parseJson<Record<string, unknown> | null>(p.on_hit_effect, null),
      onCrit: parseJson<Record<string, unknown> | null>(p.on_crit_effect, null),
    })),
    weaponTraits: parseJson<string[]>(base.weapon_traits, []),
    bulk: (base.bulk as number) ?? 0,
    price,
  };
}

/** Aggregate stat bonuses across a hero's equipped instances ({str: 2, fort_save: 1, …}). */
export function aggregateStatBonuses(equipped: readonly ItemInstance[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const inst of equipped) {
    const derived = deriveItem(inst);
    for (const [stat, value] of Object.entries(derived.statBonuses)) {
      out[stat] = (out[stat] ?? 0) + value;
    }
  }
  return out;
}
