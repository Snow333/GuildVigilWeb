/**
 * Seeded terrain — ported classification thresholds, roads burned through
 * Haven, plains carved around it. The noise source is a deterministic
 * hash-based value noise (FastNoiseLite doesn't come with us; the TUNING does:
 * thresholds, costs, the road cross, the Haven carve-out).
 */

import { TERRAIN_COST, WORLD } from '@content/world';

export type Terrain = 'road' | 'plains' | 'forest' | 'snow' | 'mountain' | 'water';

/** Deterministic 2D value noise in [−1, 1], smoothed by bilinear interpolation. */
function makeNoise(seed: number, frequency: number): (x: number, y: number) => number {
  const hash = (ix: number, iy: number): number => {
    let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
  };
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x * frequency * 8;
    const fy = y * frequency * 8;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = smooth(fx - ix);
    const ty = smooth(fy - iy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}

export interface WorldMap {
  seed: number;
  terrain: Terrain[][]; // [y][x]
  cost: (x: number, y: number) => number;
}

export function generateWorld(seed: number): WorldMap {
  const elev = makeNoise(seed, 0.04);
  const moist = makeNoise(seed + 7, 0.06);
  const c = WORLD.classify;
  const terrain: Terrain[][] = [];

  for (let y = 0; y < WORLD.height; y++) {
    const row: Terrain[] = [];
    for (let x = 0; x < WORLD.width; x++) {
      const dHaven = Math.hypot(x - WORLD.haven.x, y - WORLD.haven.y);
      if (dHaven < WORLD.havenPlainsRadius) {
        row.push('plains');
        continue;
      }
      const e = elev(x, y);
      const m = moist(x, y);
      if (e > c.mountainAbove) row.push('mountain');
      else if (e < c.waterBelow) row.push('water');
      else if (e > c.snowElevAbove && m < c.snowMoistBelow) row.push('snow');
      else if (m > c.forestMoistAbove && e > c.forestElevAbove) row.push('forest');
      else row.push('plains');
    }
    terrain.push(row);
  }

  // Roads burned through Haven's row and column (ported: skip mountain/water).
  for (let x = WORLD.roadMargin; x < WORLD.width - WORLD.roadMargin; x++) {
    const t = terrain[WORLD.haven.y]![x]!;
    if (t !== 'mountain' && t !== 'water') terrain[WORLD.haven.y]![x] = 'road';
  }
  for (let y = WORLD.roadMargin; y < WORLD.height - WORLD.roadMargin; y++) {
    const t = terrain[y]![WORLD.haven.x]!;
    if (t !== 'mountain' && t !== 'water') terrain[y]![WORLD.haven.x] = 'road';
  }

  return {
    seed,
    terrain,
    cost: (x, y) =>
      x < 0 || y < 0 || x >= WORLD.width || y >= WORLD.height ? 999 : TERRAIN_COST[terrain[y]![x]!]!,
  };
}
