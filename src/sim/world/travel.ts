/**
 * Terrain-weighted A* travel — dispatch self-pathing (core-loop: pick a target,
 * the party hugs roads and detours around expensive terrain; no waypointing).
 * ETA in game-minutes for the global clock.
 */

import { TRAVEL, WORLD } from '@content/world';
import type { WorldMap } from './terrain';

export interface TravelPlan {
  path: { x: number; y: number }[];
  totalCost: number;
  etaMinutes: number;
}

const key = (x: number, y: number): number => y * WORLD.width + x;

/** A* with Euclidean heuristic and diagonal moves (cost × 1.41 diagonal step). */
export function planTravel(
  world: WorldMap,
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts: { hasHorses?: boolean } = {},
): TravelPlan | null {
  if (world.cost(to.x, to.y) >= 999) return null;
  const open = new Map<number, { x: number; y: number; g: number; f: number }>();
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  const h = (x: number, y: number) => Math.hypot(x - to.x, y - to.y) * 0.55; // admissible vs road cost

  open.set(key(from.x, from.y), { ...from, g: 0, f: h(from.x, from.y) });
  gScore.set(key(from.x, from.y), 0);

  while (open.size > 0) {
    // Deterministic lowest-f pick (tie: lowest key).
    let cur: { x: number; y: number; g: number; f: number } | null = null;
    let curKey = -1;
    for (const [k, node] of open) {
      if (!cur || node.f < cur.f || (node.f === cur.f && k < curKey)) {
        cur = node;
        curKey = k;
      }
    }
    if (!cur) break;
    open.delete(curKey);

    if (cur.x === to.x && cur.y === to.y) {
      const path: { x: number; y: number }[] = [{ x: cur.x, y: cur.y }];
      let k = curKey;
      while (cameFrom.has(k)) {
        k = cameFrom.get(k)!;
        path.unshift({ x: k % WORLD.width, y: Math.floor(k / WORLD.width) });
      }
      const totalCost = cur.g;
      const speed = TRAVEL.baseTilesPerSecond * (opts.hasHorses ? TRAVEL.horseMultiplier : 1);
      const etaMinutes = Math.ceil((totalCost * TRAVEL.minutesPerTile) / speed);
      return { path, totalCost, etaMinutes };
    }

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const stepCost = world.cost(nx, ny);
        if (stepCost >= 999) continue;
        const diag = dx !== 0 && dy !== 0 ? 1.41 : 1;
        const g = cur.g + stepCost * diag;
        const nk = key(nx, ny);
        if (g < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, g);
          cameFrom.set(nk, curKey);
          open.set(nk, { x: nx, y: ny, g, f: g + h(nx, ny) });
        }
      }
    }
  }
  return null;
}
