/**
 * Chart features — brief #8 step 5: the surveyor's reading of the real terrain
 * grid. Pure geometry in CELL coordinates: WorldMapScreen scales and inks it.
 * No rules live here — every anchor is a fact of the map (the honesty test
 * pins each glyph to a cell of its own terrain kind), and the glyph budget is
 * the round-03 density lock in executable form.
 */

import type { Terrain, WorldMap } from '@sim/world/terrain';

export interface CellPoint {
  x: number;
  y: number;
}

export interface CoastSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ChartFeatures {
  /** Glyph-cluster anchors, one per dense block, each ON a cell of its kind. */
  mountains: CellPoint[];
  forests: CellPoint[];
  snowfields: CellPoint[];
  /** Coast contour segments (marching squares, cell units) around water masses ≥ coastMinCells. */
  coast: CoastSegment[];
  /** Sparse dots on interior water of the coasted masses (cell coords). */
  stipple: CellPoint[];
  /** Straight road runs as [start, end] cell centers. */
  roads: [CellPoint, CellPoint][];
  /** Largest water mass ≥ seaMinCells: label anchor + orientation. */
  sea: { x: number; y: number; vertical: boolean } | null;
}

/** The round-03 density lock, executable. Raising these is a deliberate revisit. */
export const DENSITY = {
  /** Cells per glyph-cluster block (8×8 → at most one cluster per block). */
  block: 8,
  /** Block cells of one kind needed to earn a glyph cluster. */
  minCells: 14,
  /** Hard ceiling on clusters per terrain kind. */
  maxGlyphs: 32,
  /** 1-in-N interior water cells get a stipple dot (deterministic hash). */
  stippleModulo: 29,
  /** Road runs shorter than this stay undrawn (jitter, not a road). */
  minRoadRun: 3,
  /** Water masses below this get no coastline — a surveyed pond is not a sea. */
  coastMinCells: 10,
  /** Water masses below this stay nameless. */
  seaMinCells: 60,
} as const;

const at = (map: WorldMap, x: number, y: number): Terrain | null =>
  x < 0 || y < 0 || x >= map.terrain[0]!.length || y >= map.terrain.length ? null : map.terrain[y]![x]!;

/**
 * One anchor per dense block: the matching cell nearest the block's centroid.
 * Cells hugging the map border are not anchor candidates — glyphs drawn there
 * would spill over the neatline (the mass still anchors from its interior).
 */
function clusterAnchors(map: WorldMap, kind: Terrain): CellPoint[] {
  const h = map.terrain.length;
  const w = map.terrain[0]!.length;
  const margin = 2;
  const anchors: CellPoint[] = [];
  for (let by = 0; by < h; by += DENSITY.block) {
    for (let bx = 0; bx < w; bx += DENSITY.block) {
      const cells: CellPoint[] = [];
      const candidates: CellPoint[] = [];
      for (let y = by; y < Math.min(by + DENSITY.block, h); y++) {
        for (let x = bx; x < Math.min(bx + DENSITY.block, w); x++) {
          if (map.terrain[y]![x] !== kind) continue;
          cells.push({ x, y });
          if (x >= margin && x < w - margin && y >= margin && y < h - margin) candidates.push({ x, y });
        }
      }
      if (cells.length < DENSITY.minCells || candidates.length === 0) continue;
      const mx = cells.reduce((s, c) => s + c.x, 0) / cells.length;
      const my = cells.reduce((s, c) => s + c.y, 0) / cells.length;
      const anchor = candidates.reduce((best, c) =>
        Math.hypot(c.x - mx, c.y - my) < Math.hypot(best.x - mx, best.y - my) ? c : best,
      );
      anchors.push(anchor);
    }
  }
  return anchors.slice(0, DENSITY.maxGlyphs);
}

/** 4-connected water masses, largest first (flood fill, computed once). */
function waterComponents(map: WorldMap): CellPoint[][] {
  const h = map.terrain.length;
  const w = map.terrain[0]!.length;
  const seen = new Uint8Array(w * h);
  const out: CellPoint[][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (map.terrain[y]![x] !== 'water' || seen[y * w + x]) continue;
      const cells: CellPoint[] = [];
      const stack: CellPoint[] = [{ x, y }];
      seen[y * w + x] = 1;
      while (stack.length > 0) {
        const c = stack.pop()!;
        cells.push(c);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          if (at(map, nx, ny) === 'water' && !seen[ny * w + nx]) {
            seen[ny * w + nx] = 1;
            stack.push({ x: nx, y: ny });
          }
        }
      }
      out.push(cells);
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

/**
 * Marching-squares 0.5-contour over the coast-worthy water mask: segments join
 * edge midpoints between cell centers, so corners chamfer at 45° and the coast
 * reads as a drawn line, not a staircase of cell edges.
 */
function coastContour(mask: Set<number>, w: number, h: number): CoastSegment[] {
  const wet = (x: number, y: number): number =>
    x >= 0 && y >= 0 && x < w && y < h && mask.has(y * w + x) ? 1 : 0;
  const out: CoastSegment[] = [];
  for (let gy = -1; gy < h; gy++) {
    for (let gx = -1; gx < w; gx++) {
      // Window corners = the 2×2 cell centers around lattice point (gx+1, gy+1).
      const code = wet(gx, gy) * 8 + wet(gx + 1, gy) * 4 + wet(gx + 1, gy + 1) * 2 + wet(gx, gy + 1) * 1;
      if (code === 0 || code === 15) continue;
      const top: [number, number] = [gx + 1, gy + 0.5];
      const bottom: [number, number] = [gx + 1, gy + 1.5];
      const left: [number, number] = [gx + 0.5, gy + 1];
      const right: [number, number] = [gx + 1.5, gy + 1];
      const seg = (a: [number, number], b: [number, number]): void => {
        out.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
      };
      switch (code) {
        case 1: case 14: seg(left, bottom); break;
        case 2: case 13: seg(bottom, right); break;
        case 3: case 12: seg(left, right); break;
        case 4: case 11: seg(top, right); break;
        case 6: case 9: seg(top, bottom); break;
        case 7: case 8: seg(top, left); break;
        case 5: seg(top, left); seg(bottom, right); break;
        case 10: seg(top, right); seg(bottom, left); break;
      }
    }
  }
  return out;
}

/** Deterministic sparse dots on interior water of the coasted masses. */
function stippleDots(map: WorldMap, mask: Set<number>): CellPoint[] {
  const out: CellPoint[] = [];
  const h = map.terrain.length;
  const w = map.terrain[0]!.length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask.has(y * w + x)) continue;
      const interior =
        at(map, x - 1, y) === 'water' && at(map, x + 1, y) === 'water' &&
        at(map, x, y - 1) === 'water' && at(map, x, y + 1) === 'water';
      if (interior && (x * 7 + y * 13) % DENSITY.stippleModulo === 0) out.push({ x, y });
    }
  }
  return out;
}

/** Horizontal + vertical road runs → straight [start, end] segments. */
function roadRuns(map: WorldMap): [CellPoint, CellPoint][] {
  const out: [CellPoint, CellPoint][] = [];
  const h = map.terrain.length;
  const w = map.terrain[0]!.length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (map.terrain[y]![x] !== 'road' || at(map, x - 1, y) === 'road') continue;
      let end = x;
      while (at(map, end + 1, y) === 'road') end++;
      if (end - x + 1 >= DENSITY.minRoadRun) out.push([{ x, y }, { x: end, y }]);
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (map.terrain[y]![x] !== 'road' || at(map, x, y - 1) === 'road') continue;
      let end = y;
      while (at(map, x, end + 1) === 'road') end++;
      if (end - y + 1 >= DENSITY.minRoadRun) out.push([{ x, y }, { x, y: end }]);
    }
  }
  return out;
}

/** Largest water mass ≥ seaMinCells → label anchor (centroid) + orientation. */
function seaAnchor(components: CellPoint[][]): ChartFeatures['sea'] {
  const best = components[0];
  if (!best || best.length < DENSITY.seaMinCells) return null;
  const xs = best.map((c) => c.x);
  const ys = best.map((c) => c.y);
  return {
    x: xs.reduce((a, b) => a + b, 0) / xs.length,
    y: ys.reduce((a, b) => a + b, 0) / ys.length,
    vertical: Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs),
  };
}

export function chartFeatures(map: WorldMap): ChartFeatures {
  const w = map.terrain[0]!.length;
  const components = waterComponents(map);
  const mask = new Set<number>();
  for (const cells of components) {
    if (cells.length < DENSITY.coastMinCells) break; // sorted — the rest are ponds
    for (const c of cells) mask.add(c.y * w + c.x);
  }
  return {
    mountains: clusterAnchors(map, 'mountain'),
    forests: clusterAnchors(map, 'forest'),
    snowfields: clusterAnchors(map, 'snow'),
    coast: coastContour(mask, w, map.terrain.length),
    stipple: stippleDots(map, mask),
    roads: roadRuns(map),
    sea: seaAnchor(components),
  };
}
