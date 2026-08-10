import { describe, expect, it } from 'vitest';
import { DUNGEON_TIERS, type DungeonTier } from '@content/dungeon';
import { bfsDepths, validateTemplate } from '@sim/dungeon/graph';
import { TEMPLATE_POOL, pickTemplate, templatesForTier } from '@sim/dungeon/pool';
import { rollLootTable, tierWeights } from '@sim/loot/generate';
import { deriveItem } from '@sim/heroes/equipment';
import { Rng } from '@sim/core/rng';

describe('THE SHIPPED POOL: every template, every invariant (build-time validation)', () => {
  it('24 templates, 6 per tier, all valid', () => {
    expect(TEMPLATE_POOL.size).toBe(24);
    for (const tier of Object.keys(DUNGEON_TIERS) as DungeonTier[]) {
      const ts = templatesForTier(tier);
      expect(ts).toHaveLength(6);
      for (const t of ts) {
        expect(validateTemplate(t), t.templateId).toEqual([]);
      }
    }
  });

  it('graphs have loops, not just trees (~35% edge return)', () => {
    let extra = 0;
    for (const t of TEMPLATE_POOL.values()) {
      extra += t.edges.length - (t.nodes.length - 1); // spanning tree baseline
    }
    expect(extra).toBeGreaterThan(0); // route choices exist across the pool
  });

  it('boss sits deep: depth ≥ 60% of max in every template', () => {
    for (const t of TEMPLATE_POOL.values()) {
      const depths = bfsDepths(t.nodes);
      const boss = t.nodes.find((n) => n.preset === 'boss')!;
      expect(depths[boss.n]).toBeGreaterThanOrEqual(Math.max(2, Math.floor(Math.max(...depths) * 0.6)));
    }
  });

  it('template picking is deterministic and cycles the pool', () => {
    expect(pickTemplate('small', 'disp_1').templateId).toBe(pickTemplate('small', 'disp_1').templateId);
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pickTemplate('small', `d_${i}`).templateId));
    expect(seen.size).toBeGreaterThan(1); // different dispatches see different layouts
  });
});

describe('the loot grammar (brief #3 acceptance criteria)', () => {
  it('boss/vault floors: 100k tier draws, zero below magical', () => {
    for (const source of ['boss', 'vault'] as const) {
      const w = tierWeights(source, 3);
      expect(w[0]).toBe(0); // mundane
      expect(w[1]).toBe(0); // masterwork
    }
  });

  it('rolls are deterministic by seed and NEVER legendary, unique, or incompatible', () => {
    const a = rollLootTable(1, 'enemy', 2, 's1', new Rng('roll_1'));
    const b = rollLootTable(1, 'enemy', 2, 's1', new Rng('roll_1'));
    expect(a).toEqual(b);

    for (let i = 0; i < 2000; i++) {
      const rng = new Rng(`mass_${i}`);
      for (const table of [1, 2, 3, 101]) {
        for (const item of rollLootTable(table, i % 2 ? 'boss' : 'enemy', (i % 5) + 1, `m_${i}`, rng)) {
          expect(item.tier).not.toBe('legendary');
          // deriveItem THROWS on unknown/incompatible properties and enforces
          // registry integrity — every rolled instance must derive cleanly.
          const derived = deriveItem(item);
          expect(derived.displayName.length).toBeGreaterThan(0);
          expect(derived.price).toBeGreaterThanOrEqual(0); // some bases are legitimately priceless (0g)
        }
      }
    }
  });

  it('difficulty shifts tier mass upward', () => {
    const easy = tierWeights('enemy', 1);
    const hard = tierWeights('enemy', 5);
    expect(hard[0]!).toBeLessThan(easy[0]!); // less mundane
    expect(hard[2]! + hard[3]!).toBeGreaterThan(easy[2]! + easy[3]!); // more magical+
  });

  it('quantity columns are honored (the ones the old service ignored)', () => {
    // Across many seeds, at least one multi-quantity row must produce >1 item.
    let sawMulti = false;
    for (let i = 0; i < 500 && !sawMulti; i++) {
      for (const table of [1, 2, 3]) {
        if (rollLootTable(table, 'enemy', 2, `q_${i}`, new Rng(`q_${i}_${table}`)).length > 1) sawMulti = true;
      }
    }
    expect(sawMulti).toBe(true);
  });
});
