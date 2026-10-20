/**
 * FOG OF WAR (M4) — what the guild has SEEN of the world map.
 *
 * ── THE RULE THAT MATTERS ───────────────────────────────────────────────────
 * THE VISIT LOG IS STATE; WHAT IT REVEALS IS DERIVED. Nothing here is stored.
 * `computeFog` takes the tiles the party has stood on plus the guild's current
 * sight range and works out the lit area from scratch. That is deliberate:
 * when the guild builds a Watchtower the range grows, and because the lit area
 * is recomputed, every tile the party ever walked gets the wider halo. A stored
 * "revealed" set would leave a permanent dark hole around the old paths.
 *
 * ── SIGHT ───────────────────────────────────────────────────────────────────
 * The range comes from the Watchtower's EFFECT KEYS (`map_reveal_small`,
 * `map_reveal_large`) read off the buildings table via `hasEffect` — never the
 * level number and never the player-facing copy.
 *
 * Pure TS: no React, no DOM, no randomness, no clock.
 */

import { WORLD } from '@content/world';
import { hasEffect, type BuildingLevels } from '@sim/campaign/town';

/** The Watchtower's row in the `buildings` table. Pinned by name in the tests. */
export const WATCHTOWER_ID = 11;

/**
 * How far the guild sees from every tile it has stood on, in tiles.
 *
 *  - base: walking awareness. About one radius-4 Haven plains carve-out.
 *  - small / large: the Watchtower rungs. Area grows ~4× then ~9× the base.
 */
export const SIGHT = { base: 3, small: 6, large: 9 } as const;

/** Sight range for a guild whose buildings are at these levels. */
export function sightRangeForBuildings(levels: BuildingLevels): number {
  if (hasEffect(levels, 'map_reveal_large')) return SIGHT.large;
  if (hasEffect(levels, 'map_reveal_small')) return SIGHT.small;
  return SIGHT.base;
}

/** Sight range for a Watchtower at `level` (0 = not built). */
export function sightRangeFor(watchtowerLevel: number): number {
  return sightRangeForBuildings({ [WATCHTOWER_ID]: watchtowerLevel });
}

export interface FogView {
  readonly width: number;
  readonly height: number;
  /** The sight range this view was computed with. */
  readonly sightRange: number;
  /** How many of the width×height tiles are revealed. */
  readonly revealedCount: number;
  /** Is this tile revealed? Off-map tiles are never revealed. */
  isRevealed(x: number, y: number): boolean;
}

/** Offsets of every tile within `range` of the origin (a disc), computed once per range. */
const discCache = new Map<number, readonly number[]>();
function disc(range: number): readonly number[] {
  let d = discCache.get(range);
  if (!d) {
    const out: number[] = [];
    const r2 = range * range;
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        if (dx * dx + dy * dy <= r2 + 0.5) out.push(dx, dy);
      }
    }
    d = out;
    discCache.set(range, d);
  }
  return d;
}

/**
 * The lit area: every tile within `sightRange` of a visited tile, plus the
 * same halo around Haven (always lit, even for a caller that forgot to list it).
 *
 * Cost: one pass over the visited list × the disc size, into a flat byte map.
 * Lookups are O(1). Safe to call on every render of the 80×60 map.
 */
export function computeFog(
  visited: readonly { x: number; y: number }[],
  sightRange: number,
): FogView {
  const width = WORLD.width;
  const height = WORLD.height;
  const range = Math.max(0, Math.floor(sightRange));
  const lit = new Uint8Array(width * height);
  const offsets = disc(range);
  let count = 0;

  const stamp = (cx: number, cy: number): void => {
    for (let i = 0; i < offsets.length; i += 2) {
      const x = cx + offsets[i]!;
      const y = cy + offsets[i + 1]!;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const at = y * width + x;
      if (lit[at] === 0) {
        lit[at] = 1;
        count++;
      }
    }
  };

  stamp(WORLD.haven.x, WORLD.haven.y);
  for (const v of visited) {
    if (!Number.isInteger(v.x) || !Number.isInteger(v.y)) continue;
    stamp(v.x, v.y);
  }

  return {
    width,
    height,
    sightRange: range,
    revealedCount: count,
    isRevealed: (x, y) =>
      Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height
        && lit[y * width + x] === 1,
  };
}

/**
 * The DARK tiles as horizontal runs — one `{x, y, w}` per unbroken stretch in a
 * row. The renderer draws each run as one rect, so the whole fog is a few
 * hundred shapes rather than up to 4,800.
 */
export function unrevealedRuns(fog: FogView): { x: number; y: number; w: number }[] {
  const runs: { x: number; y: number; w: number }[] = [];
  for (let y = 0; y < fog.height; y++) {
    let start = -1;
    for (let x = 0; x <= fog.width; x++) {
      const dark = x < fog.width && !fog.isRevealed(x, y);
      if (dark && start < 0) start = x;
      else if (!dark && start >= 0) {
        runs.push({ x: start, y, w: x - start });
        start = -1;
      }
    }
  }
  return runs;
}
