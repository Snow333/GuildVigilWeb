/**
 * RESOURCE SITES (M3) — the places a party secures so the town can grow.
 *
 * ⚠ THE SITES ARE DERIVED, NOT AUTHORED. `world_regions.known_resources`
 * already says what every region produces (timber, iron, stone, grain, furs,
 * fish, clay, salt, mithril) and had no consumer; a site is one (region, kind)
 * pair from that list, placed at a stable position by the world seed. Writing
 * a `resource_sites` table would have duplicated the region data and let the
 * two drift — the same mistake as retyping `base_cost`.
 *
 * Difficulty comes from the region's own level band, so a mithril site in the
 * deep frontier is a real expedition and a timber site next door is a week-one
 * errand. That ordering falls out of the content rather than being tuned here.
 */

import { Rng } from '@sim/core/rng';
import { Seeds } from '@sim/core/ids';
import { WORLD } from '@content/world';
import { planTravel } from '@sim/world/travel';
import type { WorldMap } from '@sim/world/terrain';
import { world_regions as worldRegions } from '@content/generated/world_regions';
import {
  RESOURCE_KINDS, SITE_YIELD, resourceTier,
  type ResourceKind,
} from '@content/town';

export interface ResourceSite {
  regionId: string;
  regionName: string;
  kind: ResourceKind;
  /** Units per week once secured. */
  yield: number;
  /** Party level the expedition is pitched at. */
  level: number;
  pos: { x: number; y: number };
}

/**
 * HAVEN IS NOT A SITE. `world_regions` holds the starting settlement itself
 * ("this is where the player starts") alongside the five wilderness regions,
 * and its `known_resources` lists timber/farmland/river_access. Sending an
 * expedition to secure your own town is nonsense, so it is excluded — and the
 * exclusion is by id, not by danger level, because Haven's authored
 * danger_level is 4, higher than three of the real wilderness regions.
 */
const NOT_A_SITE = new Set(['haven']);

/**
 * How dangerous a region is, which sets the expedition's level.
 *
 * ⚠ The column is `danger_level`, not `min_level`. Falls back to 1 rather than
 * throwing: a new region with no band should make a cheap site, not crash a
 * campaign.
 */
function regionLevel(row: Record<string, unknown>): number {
  const danger = row['danger_level'];
  if (typeof danger === 'number' && danger > 0) return danger;
  return 1;
}

/**
 * ⚠ `known_resources` IS A JSON ARRAY STRING, e.g. `["grain","timber"]` — not
 * a comma-separated list. Parsing it as CSV yields kinds like `"grain"` with
 * the quotes attached, which match nothing and silently produce a world with
 * no sites at all.
 *
 * ⚠ Silently drops anything that is not a known kind — `ancient_ruins`,
 * `unknown_magical_sources`, `farmland` and `river_access` are flavour in the
 * region text, not resources, and must not become a site that pays into an
 * undefined stock.
 */
function parseKinds(raw: unknown): ResourceKind[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  let parts: unknown;
  try {
    parts = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parts)) return [];
  return parts
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is ResourceKind => (RESOURCE_KINDS as readonly string[]).includes(p));
}

/**
 * Site placement.
 *
 * ⚠ THE RADIUS IS CAPPED, AND THAT CAP IS THE WHOLE FUNCTION. The quest-POI
 * version uses `8 + level * 5`, which at the Ashenmere's danger level 7 is a
 * radius of ~43 on an 80x60 map from Haven at (16,38) — almost entirely
 * off-map. Every candidate then clamps to the same edge column, and measured,
 * that put four sites on x=1 and TWO SITES ON THE IDENTICAL TILE (1,18).
 *
 * ⚠ `taken` is therefore not optional politeness. Two sites on one tile are
 * two map pins the player cannot tell apart or click separately.
 */
function placeSite(
  map: WorldMap,
  seed: string,
  level: number,
  taken: Set<string>,
): { x: number; y: number } {
  const rng = new Rng(seed);
  // Keep the whole ring inside the map, with a 2-tile margin, so a far region
  // reads as "far" by angle and distance rather than by hitting the border.
  const maxRadius = Math.max(
    6,
    Math.min(
      WORLD.haven.x, WORLD.width - 2 - WORLD.haven.x,
      WORLD.haven.y, WORLD.height - 2 - WORLD.haven.y,
    ) - 2,
  );
  const want = Math.min(6 + level * 4, maxRadius);
  for (let attempt = 0; attempt < 240; attempt++) {
    // Widen the band as attempts fail rather than retrying one ring forever.
    const spread = 2 + Math.floor(attempt / 40);
    // ⚠ CLAMPED TO maxRadius, NOT JUST CENTRED ON IT. Widening the band to
    // escape a crowded ring is what pushed candidates back past the border:
    // Haven sits 16 tiles from the west edge, so an 18-tile radius westward
    // clamps to x=1 and the pile-up returns.
    const radius = Math.min(maxRadius, Math.max(4, want + rng.float(-spread, spread)));
    const angle = rng.float(0, Math.PI * 2);
    const x = Math.min(Math.max(Math.round(WORLD.haven.x + Math.cos(angle) * radius), 1), WORLD.width - 2);
    const y = Math.min(Math.max(Math.round(WORLD.haven.y + Math.sin(angle) * radius), 1), WORLD.height - 2);
    const key = `${x},${y}`;
    if (taken.has(key)) continue;
    if (map.cost(x, y) >= 999) continue;
    if (!planTravel(map, WORLD.haven, { x, y })) continue;
    taken.add(key);
    return { x, y };
  }
  // Last resort: step along the burned road until a free tile turns up. Always
  // reachable, and still never a duplicate.
  for (let d = 3; d < WORLD.width - 2; d++) {
    const x = Math.min(WORLD.haven.x + d, WORLD.width - 2);
    const key = `${x},${WORLD.haven.y}`;
    if (!taken.has(key)) {
      taken.add(key);
      return { x, y: WORLD.haven.y };
    }
  }
  return { x: WORLD.haven.x + 5, y: WORLD.haven.y };
}

/**
 * Every resource site in the world, in a stable order.
 *
 * Pure derivation from the region table and the world seed — constraint 7,
 * never store what you can derive. The session stores only WHICH sites are
 * secured.
 */
export function allSites(map: WorldMap, worldSeed: number): ResourceSite[] {
  const out: ResourceSite[] = [];
  // Shared across every site so no two land on one tile.
  const taken = new Set<string>();
  for (const row of worldRegions) {
    const regionId = row.id as string;
    if (NOT_A_SITE.has(regionId)) continue;
    const level = regionLevel(row as unknown as Record<string, unknown>);
    for (const kind of parseKinds((row as Record<string, unknown>)['known_resources'])) {
      out.push({
        regionId,
        regionName: row.name as string,
        kind,
        yield: SITE_YIELD[resourceTier(kind)],
        level,
        pos: placeSite(map, Seeds.site(worldSeed, regionId, kind), level, taken),
      });
    }
  }
  // Cheapest first — the order the player will want to take them in.
  return out.sort((a, b) => a.level - b.level || a.regionId.localeCompare(b.regionId)
    || a.kind.localeCompare(b.kind));
}

/** The key a secured site is stored under. */
export const siteKey = (regionId: string, kind: ResourceKind): string => `${regionId}:${kind}`;
