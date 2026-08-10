/**
 * The curated template pool (decision-ledger Area 3: 20–30 pre-generated
 * layouts, cycled; population stays per-dispatch). Generation is deterministic,
 * so the pool is defined by its seed list — curation = editing this list.
 * Build-time validation lives in the test suite (every template, every invariant).
 */

import { generateLayout, validateTemplate, type DungeonTemplate } from './graph';
import type { DungeonTier } from '@content/dungeon';

/** Curated seeds per tier — 6 × 4 = 24 shipped layouts. */
const POOL_SEEDS: Record<DungeonTier, string[]> = {
  tiny: ['ash', 'bram', 'crag', 'dell', 'ede', 'fen'],
  small: ['gorse', 'heath', 'iron', 'juniper', 'knoll', 'larch'],
  medium: ['marsh', 'nettle', 'osier', 'pyre', 'quarry', 'rowan'],
  large: ['sorrel', 'thorn', 'umber', 'vetch', 'wyrm', 'yarrow'],
};

function buildPool(): Map<string, DungeonTemplate> {
  const pool = new Map<string, DungeonTemplate>();
  for (const [tier, seeds] of Object.entries(POOL_SEEDS) as [DungeonTier, string[]][]) {
    for (const seed of seeds) {
      const t = generateLayout(seed, tier);
      const problems = validateTemplate(t);
      if (problems.length > 0) {
        throw new Error(`template ${t.templateId} invalid: ${problems.join('; ')} — recurate POOL_SEEDS`);
      }
      pool.set(t.templateId, t);
    }
  }
  return pool;
}

export const TEMPLATE_POOL: Map<string, DungeonTemplate> = buildPool();

export function templatesForTier(tier: DungeonTier): DungeonTemplate[] {
  return [...TEMPLATE_POOL.values()].filter((t) => t.tier === tier);
}

/** Deterministic pick for a dispatch (seeded, cycles the pool). */
export function pickTemplate(tier: DungeonTier, dispatchSeed: string): DungeonTemplate {
  const candidates = templatesForTier(tier);
  let h = 0x811c9dc5;
  for (let i = 0; i < dispatchSeed.length; i++) {
    h ^= dispatchSeed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return candidates[(h >>> 0) % candidates.length]!;
}
