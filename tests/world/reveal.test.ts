/**
 * M4 — FOG OF WAR. The world map starts dark and opens as the guild walks.
 *
 * The one property that matters: THE VISIT LOG IS STATE, WHAT IT REVEALS IS
 * DERIVED. Build a Watchtower and every tile already walked gets the wider
 * halo — no permanent dark hole. Those tests drive the REAL session (its
 * `visitedTiles()`, its `buildingLevel()`, its `upgradeBuilding()`), not
 * hand-made arrays, so a fog that stored its own set would fail them.
 */
import { describe, expect, it } from 'vitest';
import { WORLD } from '@content/world';
import { RESOURCE_KINDS } from '@content/town';
import { buildings } from '@content/generated/buildings';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '@sim/campaign/starterParty';
import {
  SIGHT, WATCHTOWER_ID, computeFog, sightRangeFor, sightRangeForBuildings, unrevealedRuns,
} from '@sim/world/reveal';

const BARRACKS = 2;
const TILES = WORLD.width * WORLD.height;

function session(id: string): CampaignSession {
  return CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });
}

/** Rich enough that only the Watchtower's own gates matter. */
function wealthy(id: string): CampaignSession {
  const s = session(id);
  s.devAddGold(200_000);
  s.grantResources(Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 999])));
  s.grantReputation(100);
  return s;
}

/** Same composition the world map screen uses. */
function fogOf(s: CampaignSession) {
  return computeFog(s.visitedTiles(), sightRangeFor(s.buildingLevel(WATCHTOWER_ID)));
}

/** Walk the first posting: accept, launch. The visit log grows by the whole road. */
function walkFirstPosting(s: CampaignSession): void {
  s.advanceWeek();
  const posting = s.board()[0]!;
  s.acceptQuest(posting.questId);
  s.launchDispatch();
}

/** Build a Watchtower level through the real town path (it needs the Barracks first). */
function buildWatchtower(s: CampaignSession, levels: 1 | 2): void {
  s.upgradeBuilding(BARRACKS);
  for (let i = 0; i < levels; i++) s.upgradeBuilding(WATCHTOWER_ID);
}

const countSet = (fog: ReturnType<typeof computeFog>): Set<string> => {
  const out = new Set<string>();
  for (let y = 0; y < fog.height; y++) for (let x = 0; x < fog.width; x++) if (fog.isRevealed(x, y)) out.add(`${x},${y}`);
  return out;
};

describe('a fresh guild sees only a halo around Haven', () => {
  it('the visit log of a new campaign is exactly Haven', () => {
    expect(session('fresh0').visitedTiles()).toEqual([{ x: WORLD.haven.x, y: WORLD.haven.y }]);
  });

  it('Haven is lit, a halo around it is lit, and the rest of the map is dark', () => {
    const fog = fogOf(session('fresh1'));
    expect(fog.isRevealed(WORLD.haven.x, WORLD.haven.y)).toBe(true);
    expect(fog.isRevealed(WORLD.haven.x + SIGHT.base, WORLD.haven.y)).toBe(true);
    expect(fog.isRevealed(WORLD.haven.x + SIGHT.base + 1, WORLD.haven.y)).toBe(false);
    expect(fog.isRevealed(WORLD.haven.x, WORLD.haven.y - SIGHT.base - 1)).toBe(false);
    expect(fog.isRevealed(70, 5)).toBe(false);
    expect(fog.revealedCount).toBeLessThan(TILES * 0.02);
    expect(fog.revealedCount).toBeGreaterThan(20);
  });

  it('Haven stays lit even if the caller forgets to list it', () => {
    const fog = computeFog([], 0);
    expect(fog.isRevealed(WORLD.haven.x, WORLD.haven.y)).toBe(true);
    expect(fog.revealedCount).toBe(1);
  });

  it('off-map and fractional tiles are never revealed, and never crash', () => {
    const fog = computeFog([{ x: 0, y: 0 }, { x: 999, y: 999 }, { x: 2.5, y: 3 }], SIGHT.large);
    expect(fog.isRevealed(-1, 0)).toBe(false);
    expect(fog.isRevealed(WORLD.width, 0)).toBe(false);
    expect(fog.isRevealed(0, WORLD.height)).toBe(false);
    expect(fog.isRevealed(1.5, 1)).toBe(false);
    expect(fog.isRevealed(0, 0)).toBe(true);
  });
});

describe('walking a path reveals along it', () => {
  it('a real mission lights every tile of the road, and more than Haven alone', () => {
    const s = session('walk1');
    const before = fogOf(s);
    walkFirstPosting(s);
    const visited = s.visitedTiles();
    expect(visited.length, 'the mission walked a road').toBeGreaterThan(5);
    const after = fogOf(s);
    for (const v of visited) expect(after.isRevealed(v.x, v.y), `walked tile ${v.x},${v.y} is dark`).toBe(true);
    expect(after.revealedCount).toBeGreaterThan(before.revealedCount * 2);
  });

  it('a synthetic road: lit within sight of the road, dark beyond it', () => {
    const road = Array.from({ length: 20 }, (_, i) => ({ x: 40 + i, y: 10 }));
    const fog = computeFog(road, SIGHT.base);
    expect(fog.isRevealed(50, 10 + SIGHT.base)).toBe(true);
    expect(fog.isRevealed(50, 10 + SIGHT.base + 1)).toBe(false);
    expect(fog.isRevealed(50, 10 - SIGHT.base)).toBe(true);
    expect(fog.isRevealed(40 - SIGHT.base, 10)).toBe(true);
    expect(fog.isRevealed(40 - SIGHT.base - 1, 10)).toBe(false);
    expect(fog.isRevealed(59 + SIGHT.base, 10)).toBe(true);
    expect(fog.isRevealed(59 + SIGHT.base + 1, 10)).toBe(false);
  });

  it('the lit area never shrinks as visits accumulate', () => {
    const s = session('mono');
    let last = fogOf(s).revealedCount;
    let grew = 0;
    for (let i = 0; i < 3; i++) {
      walkFirstPosting(s);
      const now = fogOf(s).revealedCount;
      expect(now).toBeGreaterThanOrEqual(last);
      if (now > last) grew++;
      last = now;
    }
    expect(grew, 'at least one walk opened new ground').toBeGreaterThan(0);

    // And on a plain list: adding one tile at a time, never a drop.
    const path = Array.from({ length: 40 }, (_, i) => ({ x: 10 + i, y: 20 + (i % 5) }));
    let prev = 0;
    for (let n = 0; n <= path.length; n++) {
      const c = computeFog(path.slice(0, n), SIGHT.small).revealedCount;
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });

  it('is order-independent and ignores duplicate visits', () => {
    const a = [{ x: 30, y: 30 }, { x: 31, y: 30 }, { x: 50, y: 12 }];
    const b = [{ x: 50, y: 12 }, { x: 30, y: 30 }, { x: 31, y: 30 }, { x: 30, y: 30 }];
    expect([...countSet(computeFog(a, 5))].sort()).toEqual([...countSet(computeFog(b, 5))].sort());
  });
});

describe('the Watchtower widens sight — and RE-REVEALS everywhere already walked', () => {
  it('sight comes from the effect KEYS on the buildings table', () => {
    const row = buildings.find((b) => b.id === WATCHTOWER_ID)!;
    expect(row.name).toBe('Watchtower');
    expect(JSON.parse(row.effects as string)).toEqual({ level_1: 'map_reveal_small', level_2: 'map_reveal_large' });
    expect(sightRangeFor(0)).toBe(SIGHT.base);
    expect(sightRangeFor(1)).toBe(SIGHT.small);
    expect(sightRangeFor(2)).toBe(SIGHT.large);
    expect(SIGHT.base).toBeLessThan(SIGHT.small);
    expect(SIGHT.small).toBeLessThan(SIGHT.large);
  });

  it('only the Watchtower changes sight — another building at any level does not', () => {
    for (const row of buildings) {
      if (row.id === WATCHTOWER_ID) continue;
      expect(sightRangeForBuildings({ [row.id as number]: (row.max_level as number) ?? 1 }), row.name as string)
        .toBe(SIGHT.base);
    }
    expect(sightRangeForBuildings({})).toBe(SIGHT.base);
  });

  it('a Watchtower lights a wider halo around tiles walked BEFORE it was built', () => {
    const s = wealthy('rereveal');
    walkFirstPosting(s);
    const visitedBefore = s.visitedTiles();
    const dark = fogOf(s);

    buildWatchtower(s, 1);
    expect(s.buildingLevel(WATCHTOWER_ID)).toBe(1);
    // The visit log did not change at all: only the derivation did.
    expect(s.visitedTiles()).toEqual(visitedBefore);
    const small = fogOf(s);
    expect(small.revealedCount).toBeGreaterThan(dark.revealedCount);

    // No permanent dark hole: every tile within the NEW range of a tile walked
    // before the tower existed is lit now, including ones the old halo missed.
    const reach = SIGHT.small;
    let newlyLit = 0;
    for (const v of visitedBefore) {
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          if (dx * dx + dy * dy > reach * reach) continue;
          const x = v.x + dx;
          const y = v.y + dy;
          if (x < 0 || y < 0 || x >= WORLD.width || y >= WORLD.height) continue;
          expect(small.isRevealed(x, y), `${x},${y} near old step ${v.x},${v.y} stayed dark`).toBe(true);
          if (!dark.isRevealed(x, y)) newlyLit++;
        }
      }
    }
    expect(newlyLit, 'the tower revealed ground the old halo missed').toBeGreaterThan(0);

    // Level 2 widens it again, and each step is a superset of the one before.
    s.upgradeBuilding(WATCHTOWER_ID);
    const large = fogOf(s);
    expect(large.revealedCount).toBeGreaterThan(small.revealedCount);
    const darkSet = countSet(dark);
    const smallSet = countSet(small);
    const largeSet = countSet(large);
    for (const t of darkSet) expect(smallSet.has(t)).toBe(true);
    for (const t of smallSet) expect(largeSet.has(t)).toBe(true);
  });

  it('the same visit list lights strictly more at each sight range', () => {
    const path = Array.from({ length: 30 }, (_, i) => ({ x: 16 + i, y: 38 }));
    const a = computeFog(path, SIGHT.base).revealedCount;
    const b = computeFog(path, SIGHT.small).revealedCount;
    const c = computeFog(path, SIGHT.large).revealedCount;
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
});

describe('the fog is cheap and its dark runs add up', () => {
  it('lit + dark runs cover the whole map exactly', () => {
    const fog = computeFog([{ x: 16, y: 38 }, { x: 40, y: 30 }, { x: 79, y: 59 }], SIGHT.small);
    const dark = unrevealedRuns(fog).reduce((n, r) => n + r.w, 0);
    expect(dark + fog.revealedCount).toBe(TILES);
    for (const r of unrevealedRuns(fog)) {
      for (let x = r.x; x < r.x + r.w; x++) expect(fog.isRevealed(x, r.y)).toBe(false);
    }
    // few shapes for the renderer, not one per tile
    expect(unrevealedRuns(fog).length).toBeLessThan(TILES / 10);
  });

  it('a fully-walked map at the widest sight computes quickly', () => {
    const everything: { x: number; y: number }[] = [];
    for (let y = 0; y < WORLD.height; y++) for (let x = 0; x < WORLD.width; x++) everything.push({ x, y });
    const t0 = performance.now();
    const fog = computeFog(everything, SIGHT.large);
    const ms = performance.now() - t0;
    expect(fog.revealedCount).toBe(TILES);
    expect(unrevealedRuns(fog)).toEqual([]);
    expect(ms, `took ${ms.toFixed(0)}ms`).toBeLessThan(500);
  });
});
