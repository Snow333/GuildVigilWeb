/**
 * The loot generation grammar — brief #3 (APPROVED) executable.
 * Base from the loot table → tier from the source × difficulty weights (with
 * deterministic boss/vault floors, NO hidden pity) → properties within the
 * tier's budget (type-tagged, non-duplicate) → an instance TUPLE. Everything
 * derives; nothing denormalizes. Legendary never rolls.
 */

import { LOOT_GRAMMAR } from '@content/dungeon';
import { item_properties, items, loot_tables } from '@content/generated';
import type { ItemInstance } from '@sim/core/events/types';
import type { Rng } from '@sim/core/rng';

export type LootSource = 'enemy' | 'cache' | 'treasure' | 'vault' | 'boss';

type ItemRow = (typeof items)[number];

const itemsByIdNum = new Map<number, ItemRow>(items.map((i) => [i.id, i]));

/** Rows per loot table, indexed once. */
const tableIndex = new Map<number, { itemId: number; weight: number; minQ: number; maxQ: number }[]>();
for (const row of loot_tables) {
  const list = tableIndex.get(row.table_id) ?? [];
  tableIndex.set(row.table_id, list);
  list.push({ itemId: row.item_id, weight: row.weight, minQ: row.min_quantity, maxQ: row.max_quantity });
}

/** Property ids applicable to an item type, in registry order (deterministic names/prices). */
const propertiesByType = new Map<string, string[]>();
for (const p of item_properties) {
  try {
    for (const t of JSON.parse(p.applies_to) as string[]) {
      const list = propertiesByType.get(t) ?? [];
      propertiesByType.set(t, list);
      list.push(p.id);
    }
  } catch {
    /* unparseable applies_to: property never rolls */
  }
}

const TIERS = ['mundane', 'masterwork', 'magical', 'enchanted'] as const;

/** Source × difficulty tier weights, with the boss/vault magical floor applied. */
export function tierWeights(source: LootSource, difficulty: number): number[] {
  const base = LOOT_GRAMMAR.tierWeights[source] ?? LOOT_GRAMMAR.tierWeights['enemy']!;
  const shift = Math.min(LOOT_GRAMMAR.difficultyShift * Math.max(difficulty - 1, 0), 0.5);
  // Shift mass upward: each tier donates `shift` of its weight to the next tier up.
  const w = [...base];
  for (let i = 0; i < w.length - 1; i++) {
    const moved = w[i]! * shift;
    w[i]! -= moved;
    w[i + 1]! += moved;
  }
  if ((LOOT_GRAMMAR.floorAtMagical as readonly string[]).includes(source)) {
    w[0] = 0;
    w[1] = 0;
  }
  return w;
}

function rollTier(source: LootSource, difficulty: number, rng: Rng): (typeof TIERS)[number] {
  const w = tierWeights(source, difficulty);
  const total = w.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < TIERS.length; i++) {
    roll -= w[i]!;
    if (roll < 0) return TIERS[i]!;
  }
  return TIERS[TIERS.length - 1]!;
}

function rollProperties(base: ItemRow, tier: string, rng: Rng): string[] {
  const slots = LOOT_GRAMMAR.propertySlots[tier] ?? 0;
  if (slots <= 0) return [];
  const pool = propertiesByType.get(base.item_type) ?? [];
  if (pool.length === 0) return [];
  const picked: string[] = [];
  const available = [...pool];
  for (let i = 0; i < slots && available.length > 0; i++) {
    const idx = rng.int(0, available.length - 1);
    picked.push(available[idx]!);
    available.splice(idx, 1); // never duplicate on one item
  }
  return picked.sort();
}

export interface LootRollResult {
  items: ItemInstance[];
  gold: number;
}

/**
 * One roll against a loot table (ported: exactly one weighted pick per enemy,
 * now honoring min/max quantity — the columns the old service ignored).
 * Authored non-mundane bases keep their authored quality (fixed-tier, per brief);
 * mundane bases roll the grammar. `is_unique` never appears in random tables
 * (enforced by test); the guard here is defense in depth.
 */
export function rollLootTable(
  tableId: number,
  source: LootSource,
  difficulty: number,
  seed: string,
  rng: Rng,
): ItemInstance[] {
  const rows = tableIndex.get(tableId);
  if (!rows || rows.length === 0) return [];
  const eligible = rows.filter((r) => {
    const base = itemsByIdNum.get(r.itemId);
    return base && !base.is_unique;
  });
  if (eligible.length === 0) return [];

  const pick = rng.weightedPick(eligible, eligible.map((r) => r.weight));
  const base = itemsByIdNum.get(pick.itemId)!;
  const quantity = rng.int(Math.max(pick.minQ, 1), Math.max(pick.maxQ, 1));

  const out: ItemInstance[] = [];
  for (let q = 0; q < quantity; q++) {
    if (base.quality_tier !== 'mundane') {
      // Authored quality item: fixed tier, no rolls.
      out.push({ baseId: String(base.id), tier: base.quality_tier as ItemInstance['tier'], propertyIds: [], seed: `${seed}_q${q}` });
    } else {
      const tier = rollTier(source, difficulty, rng);
      out.push({ baseId: String(base.id), tier, propertyIds: rollProperties(base, tier, rng), seed: `${seed}_q${q}` });
    }
  }
  return out;
}

/** Enemy drop: gold 5–15 × level (ported) + one table roll when the enemy has a table. */
export function rollEnemyLoot(
  enemy: { base_level: number; loot_table_id: number | null },
  source: 'enemy' | 'boss',
  difficulty: number,
  seed: string,
  rng: Rng,
): LootRollResult {
  const level = Math.max(enemy.base_level, 1);
  const gold = rng.int(level * LOOT_GRAMMAR.enemyGoldPerLevel.min, level * LOOT_GRAMMAR.enemyGoldPerLevel.max);
  const dropped = enemy.loot_table_id !== null
    ? rollLootTable(enemy.loot_table_id, source, difficulty, seed, rng)
    : [];
  return { items: dropped, gold };
}
