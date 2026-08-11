import { describe, expect, it } from 'vitest';
import { generateWorld } from '@sim/world/terrain';
import { chartFeatures, DENSITY } from '../../src/ui/screens/worldChart';

/**
 * Brief #8 step 5 — the chart's terrain reading is honest and its density is
 * the round-03 lock in executable form:
 *  - deterministic: same map → identical features
 *  - honest: every glyph anchor sits ON a cell of its own terrain kind; stipple
 *    only on water; road runs only on road cells
 *  - locked: glyph clusters per kind never exceed the density ceiling
 */

const SEEDS = [7, 1234, 987654] as const;

describe('chartFeatures — the surveyor reads the real map', () => {
  it('is deterministic: same map → identical features', () => {
    const map = generateWorld(1234);
    expect(chartFeatures(map)).toEqual(chartFeatures(map));
    expect(chartFeatures(generateWorld(1234))).toEqual(chartFeatures(map));
  });

  it('every glyph anchor sits on a cell of its own terrain kind', () => {
    for (const seed of SEEDS) {
      const map = generateWorld(seed);
      const f = chartFeatures(map);
      for (const p of f.mountains) expect(map.terrain[p.y]![p.x], `seed ${seed}`).toBe('mountain');
      for (const p of f.forests) expect(map.terrain[p.y]![p.x], `seed ${seed}`).toBe('forest');
      for (const p of f.snowfields) expect(map.terrain[p.y]![p.x], `seed ${seed}`).toBe('snow');
      for (const p of f.stipple) expect(map.terrain[p.y]![p.x], `seed ${seed}`).toBe('water');
      for (const [a, b] of f.roads) {
        expect(map.terrain[a.y]![a.x], `seed ${seed}`).toBe('road');
        expect(map.terrain[b.y]![b.x], `seed ${seed}`).toBe('road');
      }
    }
  });

  it('glyph clusters respect the round-03 density ceiling', () => {
    for (const seed of SEEDS) {
      const f = chartFeatures(generateWorld(seed));
      expect(f.mountains.length).toBeLessThanOrEqual(DENSITY.maxGlyphs);
      expect(f.forests.length).toBeLessThanOrEqual(DENSITY.maxGlyphs);
      expect(f.snowfields.length).toBeLessThanOrEqual(DENSITY.maxGlyphs);
    }
  });

  it('a named sea always has a coast; the road cross always draws', () => {
    for (const seed of SEEDS) {
      const map = generateWorld(seed);
      const f = chartFeatures(map);
      if (f.sea) expect(f.coast.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(f.roads.length, `seed ${seed}`).toBeGreaterThan(0); // the burned cross through Haven
    }
  });
});
