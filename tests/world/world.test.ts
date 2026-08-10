import { describe, expect, it } from 'vitest';
import { ESCALATION, TERRAIN_COST, WORLD } from '@content/world';
import { generateWorld } from '@sim/world/terrain';
import { planTravel } from '@sim/world/travel';
import { EscalationLedger } from '@sim/world/escalation';

describe('terrain generation', () => {
  it('is deterministic: same seed → identical map', () => {
    const a = generateWorld(42);
    const b = generateWorld(42);
    expect(a.terrain).toEqual(b.terrain);
    expect(generateWorld(43).terrain).not.toEqual(a.terrain);
  });

  it('burns the road cross through Haven and carves plains around it', () => {
    const w = generateWorld(42);
    // Haven's own tile sits on the road cross.
    expect(w.terrain[WORLD.haven.y]![WORLD.haven.x]).toBe('road');
    // Radius-4 carve: everything near Haven is passable (road or plains).
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (Math.hypot(dx, dy) >= WORLD.havenPlainsRadius) continue;
        const t = w.terrain[WORLD.haven.y + dy]![WORLD.haven.x + dx]!;
        expect(['road', 'plains']).toContain(t);
      }
    }
    // The road spans the map minus margins, skipping mountain/water.
    let roadTiles = 0;
    for (let x = WORLD.roadMargin; x < WORLD.width - WORLD.roadMargin; x++) {
      if (w.terrain[WORLD.haven.y]![x] === 'road') roadTiles++;
    }
    expect(roadTiles).toBeGreaterThan((WORLD.width - 2 * WORLD.roadMargin) * 0.5);
  });

  it('produces a mixed world: all passable terrain kinds appear across seeds', () => {
    const kinds = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const row of generateWorld(seed).terrain) for (const t of row) kinds.add(t);
    }
    for (const k of ['road', 'plains', 'forest', 'mountain', 'water']) expect(kinds).toContain(k);
  });

  it('cost accessor: out of bounds and impassables are 999', () => {
    const w = generateWorld(42);
    expect(w.cost(-1, 5)).toBe(999);
    expect(w.cost(5, WORLD.height)).toBe(999);
    expect(w.cost(WORLD.haven.x, WORLD.haven.y)).toBe(TERRAIN_COST['road']);
  });
});

describe('travel A*', () => {
  it('is deterministic, and the return trip also routes (cost model is enter-tile)', () => {
    const w = generateWorld(42);
    const from = { x: WORLD.haven.x, y: WORLD.haven.y };
    const to = { x: WORLD.haven.x + 20, y: WORLD.haven.y };
    const a = planTravel(w, from, to)!;
    const b = planTravel(w, from, to)!;
    expect(a).toEqual(b);
    // Step cost charges the tile you ENTER, so out/back differ at the endpoints
    // only — the same corridor, nearly the same price. (Campaign bills the
    // outbound plan both ways, deliberately.)
    const back = planTravel(w, to, from)!;
    expect(Math.abs(back.totalCost - a.totalCost) / a.totalCost).toBeLessThan(0.1);
  });

  it('hugs the road: road path beats the naive overland estimate', () => {
    const w = generateWorld(42);
    // Longest CONTIGUOUS road stretch along Haven's cross, any direction
    // (the burn skips mountains, so gaps end the claim).
    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    let to = { x: WORLD.haven.x, y: WORLD.haven.y };
    let tiles = 0;
    for (const { dx, dy } of dirs) {
      let steps = 0;
      let x = WORLD.haven.x, y = WORLD.haven.y;
      while (w.terrain[y + dy]?.[x + dx] === 'road') {
        x += dx; y += dy; steps++;
      }
      if (steps > tiles) {
        tiles = steps;
        to = { x, y };
      }
    }
    expect(tiles).toBeGreaterThanOrEqual(5); // a usable stretch exists
    const plan = planTravel(w, WORLD.haven, to)!;
    expect(plan).not.toBeNull();
    // Pure plains would cost ~1.0/tile; the road corridor must beat it.
    expect(plan.totalCost).toBeLessThan(tiles * TERRAIN_COST['plains']!);
    // And the chosen path should mostly BE road.
    const roadShare = plan.path.filter((p) => w.terrain[p.y]![p.x] === 'road').length / plan.path.length;
    expect(roadShare).toBeGreaterThan(0.5);
  });

  it('refuses impassable destinations and unreachable pockets', () => {
    const w = generateWorld(42);
    let mountain: { x: number; y: number } | null = null;
    for (let y = 0; y < WORLD.height && !mountain; y++) {
      for (let x = 0; x < WORLD.width && !mountain; x++) {
        if (w.terrain[y]![x] === 'mountain') mountain = { x, y };
      }
    }
    expect(mountain).not.toBeNull();
    expect(planTravel(w, WORLD.haven, mountain!)).toBeNull();
  });

  it('horses shorten the ETA, never change the route cost', () => {
    const w = generateWorld(42);
    const to = { x: WORLD.haven.x + 20, y: WORLD.haven.y };
    const walk = planTravel(w, WORLD.haven, to)!;
    const ride = planTravel(w, WORLD.haven, to, { hasHorses: true })!;
    expect(ride.totalCost).toBeCloseTo(walk.totalCost, 5);
    expect(ride.etaMinutes).toBeLessThan(walk.etaMinutes);
  });
});

describe('escalation ledger (brief #2 acceptance criteria)', () => {
  const fact = (kind: string, week = 1, regionId = 'region_ne'): { week: number; regionId: string; kind: string; refId: string } =>
    ({ week, regionId, kind, refId: `ref_${kind}_${week}` });

  it('derives purely: same facts → same tiers, and serialize round-trips', () => {
    const l = new EscalationLedger();
    l.append(fact('quest_failed'));
    l.append(fact('dispatch_wiped', 2));
    const restored = EscalationLedger.deserialize(l.serialize());
    expect(restored.pressureFor('region_ne')).toEqual(l.pressureFor('region_ne'));
  });

  it('reports one villain-beat crossing per tier, in order, exactly once', () => {
    const l = new EscalationLedger();
    expect(l.append(fact('quest_failed', 1)).crossedUpTo).toEqual([1]); // 3 → Restless
    expect(l.append(fact('quest_failed', 2)).crossedUpTo).toEqual([]); // 6 — still Restless
    // 6 → 13 in one blow: crosses Threatened AND Overrun, both reported in order.
    expect(l.append(fact('liberation_failed_hard', 3)).crossedUpTo).toEqual([]); // unknown kind: weight 0
    l.append(fact('dispatch_wiped', 3)); // 10 → Threatened
    expect(l.pressureFor('region_ne').tierName).toBe('Threatened');
    expect(l.append(fact('quest_failed', 4)).crossedUpTo).toEqual([3]); // 13 → Overrun
  });

  it('relief is player-action-only and hysteresis prevents flapping', () => {
    const l = new EscalationLedger();
    l.append(fact('quest_failed', 1));
    l.append(fact('quest_failed', 1)); // 6: Restless
    l.append(fact('dispatch_wiped', 2)); // 10: Threatened
    expect(l.pressureFor('region_ne').tier).toBe(2);
    l.append(fact('camp_cleared', 3)); // 8: still ≥ 7, plainly Threatened
    l.append(fact('camp_cleared', 3)); // 6: below 7 but ≥ 7−1 → hysteresis HOLDS Threatened
    expect(l.pressureFor('region_ne').tier).toBe(2);
    l.append(fact('quest_completed', 3)); // 3: clear of the margin → drops to Restless
    expect(l.pressureFor('region_ne').tier).toBe(1);
    l.append(fact('liberation_completed', 4)); // -3 → floors at 0
    expect(l.pressureFor('region_ne').score).toBe(0);
    expect(l.pressureFor('region_ne').tier).toBe(0);
  });

  it("Haven's region hard-caps below Overrun", () => {
    const l = new EscalationLedger();
    for (let i = 0; i < 10; i++) l.append(fact('dispatch_wiped', i, 'region_haven'));
    expect(l.pressureFor('region_haven').tier).toBe(ESCALATION.havenRegionCapTier);
    // The same abuse anywhere else IS Overrun.
    for (let i = 0; i < 10; i++) l.append(fact('dispatch_wiped', i, 'region_sw'));
    expect(l.pressureFor('region_sw').tier).toBe(3);
  });

  it('tier effects table lines up with tiers', () => {
    const l = new EscalationLedger();
    expect(l.effectsFor('region_ne').ambushMult).toBe(0.5); // Quiet
    l.append(fact('dispatch_wiped'));
    expect(l.effectsFor('region_ne').ambushMult).toBe(1.0); // Restless
  });
});
