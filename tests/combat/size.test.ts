/**
 * Brief #20 — CREATURE SIZE. Bodies have extent; range tests measure the gap
 * between surfaces, not the distance between centres.
 *
 * ⚠ EVERY POSITIONAL ASSERTION READS `Combatant.pos` DIRECTLY. `combat.unit_moved`
 * fires at WAYPOINT granularity only and cannot see a body that closes inside
 * its own engage range — that blind spot is why units escaped the field for
 * months (brief #19). A test about positions that reads the event stream is
 * testing the stream, not the geometry.
 *
 * Negative controls are recorded per assertion in the commit message; each was
 * observed to fail with the term reverted and to pass with it restored.
 */
import { describe, expect, it } from 'vitest';
import { ARENA, ENGAGEMENT_RANGE, SIZE_RADIUS } from '@content/combat';
import { boundToRoom, gap, inAttackRange } from '@sim/combat/ai';
import { buildEnemy } from '@sim/combat/build';
import { isFlanked } from '@sim/combat/conditions';
import { placeFormation, runEncounter } from '@sim/combat/encounter';
import { enemiesById } from '@sim/registry';
import { combatant } from './conditions.test';

const LARGE = SIZE_RADIUS['large']!; // 0.5
const HUGE = SIZE_RADIUS['huge']!; // 1.0

describe('gap() — surface to surface', () => {
  // NC: drop the Math.max(0, …) → overlapping bodies read negative and satisfy
  // every range test in the engine at once.
  it('never reads negative; overlapping bodies read exactly 0', () => {
    const a = combatant({ id: 'a', pos: { x: 0, y: 0 }, radius: HUGE });
    const b = combatant({ id: 'b', pos: { x: 0.5, y: 0 }, radius: HUGE });
    expect(gap(a, b)).toBe(0);
    expect(gap(a, a)).toBe(0);
  });

  it('is centre distance minus both radii', () => {
    const a = combatant({ id: 'a', pos: { x: 0, y: 0 }, radius: LARGE });
    const b = combatant({ id: 'b', pos: { x: 4, y: 0 }, radius: LARGE });
    expect(gap(a, b)).toBeCloseTo(3, 10);
  });

  it('is identical to centre distance when both bodies are Medium', () => {
    const a = combatant({ id: 'a', pos: { x: 0, y: 0 }, radius: 0 });
    const b = combatant({ id: 'b', pos: { x: 3, y: 4 }, radius: 0 });
    expect(gap(a, b)).toBeCloseTo(5, 10); // the 3-4-5 triangle, untouched
  });
});

describe('a Large body is reached sooner and threatens further', () => {
  // NC: drop `b.radius` from gap() → the two read identical and this fails.
  it('is in attack range 0.5 units sooner than a Medium one at the same centre distance', () => {
    const attacker = combatant({ id: 'atk', pos: { x: 0, y: 0 }, radius: 0 });
    // Just outside a Medium defender's reach, so the 0.5 is what decides it.
    const centre = ENGAGEMENT_RANGE + 0.25;

    const medium = combatant({ id: 'med', side: 'enemies', pos: { x: centre, y: 0 }, radius: 0 });
    const large = combatant({ id: 'lrg', side: 'enemies', pos: { x: centre, y: 0 }, radius: LARGE });

    expect(inAttackRange(attacker, medium)).toBe(false);
    expect(inAttackRange(attacker, large)).toBe(true);
  });

  // NC: revert conditions.ts withinEngagement → the same two allies stop flanking.
  it('admits flanking allies 0.5 further out', () => {
    const centre = ENGAGEMENT_RANGE + 0.25;
    const mk = (radius: number) => {
      const target = combatant({ id: 'tgt', side: 'enemies', pos: { x: 0, y: 0 }, radius });
      const west = combatant({ id: 'w', side: 'heroes', pos: { x: -centre, y: 0 }, radius: 0 });
      const east = combatant({ id: 'e', side: 'heroes', pos: { x: centre, y: 0 }, radius: 0 });
      // Signature is (target, attacker, all) — the unit being flanked comes first.
      return isFlanked(target, west, [west, east, target]);
    };
    expect(mk(0)).toBe(false); // Medium target: both allies are just too far
    expect(mk(LARGE)).toBe(true); // Large target: the same two allies now flank
  });
});

describe('the wall clamp respects extent', () => {
  // NC: revert the boundToRoom radius arg → the centre sits ON the wall and
  // half the body is outside the room the walls exist to contain.
  it('clamps a body to its radius, not to 0', () => {
    expect(boundToRoom({ x: -5, y: -5 }, ARENA, LARGE)).toEqual({ x: LARGE, y: LARGE });
    expect(boundToRoom({ x: 999, y: 999 }, ARENA, HUGE)).toEqual({
      x: ARENA.width - HUGE,
      y: ARENA.height - HUGE,
    });
  });

  it('still clamps a Medium body to the bare wall', () => {
    expect(boundToRoom({ x: -5, y: 25 }, ARENA, 0)).toEqual({ x: 0, y: ARENA.height });
  });

  it('keeps the per-axis clamp — the wall-slide survives', () => {
    // Driven past the west wall but legal in y: x clamps, y is untouched.
    expect(boundToRoom({ x: -3, y: 7.25 }, ARENA, LARGE)).toEqual({ x: LARGE, y: 7.25 });
  });

  it('NO UNIT EVER LEAVES THE ROOM, including Large bodies, across many seeds', () => {
    for (let s = 0; s < 40; s++) {
      const heroes = [combatant({ id: 'h0' }), combatant({ id: 'h1' })];
      const enemies = [buildEnemy(16, 'e0'), buildEnemy(16, 'e1')]; // Ogre, Large
      const r = runEncounter(`c${s}`, 'r1', heroes, enemies, `size_room_${s}`);
      for (const u of [...heroes, ...enemies]) {
        expect(u.pos.x).toBeGreaterThanOrEqual(u.radius - 1e-9);
        expect(u.pos.y).toBeGreaterThanOrEqual(u.radius - 1e-9);
        expect(u.pos.x).toBeLessThanOrEqual(ARENA.width - u.radius + 1e-9);
        expect(u.pos.y).toBeLessThanOrEqual(ARENA.height - u.radius + 1e-9);
      }
      expect(r.stream.byType('combat.started').length).toBe(1);
    }
  });
});

describe('radius comes from content, and heroes are Medium', () => {
  it('reads Large off the enemy row and Medium off everything else', () => {
    expect(buildEnemy(16, 'ogre').radius).toBe(LARGE); // Ogre
    expect(buildEnemy(24, 'dragon').radius).toBe(HUGE); // Adult Red Dragon
    expect(buildEnemy(20, 'wyrmling').radius).toBe(LARGE); // Dragon Wyrmling (§12 Q5)
    expect(buildEnemy(1, 'kobold').radius).toBe(0); // a Medium row
  });

  it('the authored set is exactly 8 large + 1 huge, and nothing else has a size', () => {
    const rows = [...enemiesById.values()];
    const sizes = rows.map((r) => (r.size as string | null) ?? 'medium');
    expect(sizes.filter((s) => s === 'large').length).toBe(8);
    expect(sizes.filter((s) => s === 'huge').length).toBe(1);
    expect(sizes.filter((s) => !['medium', 'large', 'huge'].includes(s)).length).toBe(0);
  });
});

describe('the muster does not interpenetrate at spawn (§7.2)', () => {
  // ⚠ MEASURE placeFormation DIRECTLY, NOT AFTER runEncounter. The first draft
  // of this test read positions after a full encounter and was measuring where
  // units had MOVED to, not where they spawned — it reported gap 0 for Ogres
  // that had closed on each other and passed for the wrong reason.
  //
  // NC: revert placeFormation to flat `+ 1` spacing → two Large bodies spawn
  // exactly surface-to-surface (1 − 0.5 − 0.5 = 0), i.e. touching, and this
  // fails. Asserting `> 0` would NOT catch that.
  it('spaces Large bodies a full unit of clear air apart at spawn', () => {
    const enemies = [buildEnemy(16, 'e0'), buildEnemy(16, 'e1'), buildEnemy(16, 'e2')];
    placeFormation(enemies, 'enemies');
    for (let i = 1; i < enemies.length; i++) {
      expect(gap(enemies[i - 1]!, enemies[i]!)).toBeCloseTo(1, 6);
    }
  });

  it('spaces Medium bodies exactly as it always did', () => {
    const enemies = [buildEnemy(1, 'e0'), buildEnemy(1, 'e1')];
    placeFormation(enemies, 'enemies');
    expect(gap(enemies[0]!, enemies[1]!)).toBeCloseTo(1, 6);
    // Centre separation for Medium bodies is unchanged from pre-#20: exactly 1.
    expect(enemies[1]!.pos.y - enemies[0]!.pos.y).toBeCloseTo(1, 6);
  });

  it('keeps the column centred on the room', () => {
    const enemies = [buildEnemy(16, 'e0'), buildEnemy(16, 'e1')];
    placeFormation(enemies, 'enemies');
    const mid = (enemies[0]!.pos.y + enemies[1]!.pos.y) / 2;
    expect(mid).toBeCloseTo(ARENA.height / 2, 6);
  });
});

/**
 * ⚠ THE EXPOSURE TEST — this is the one that stops the feature dying quietly.
 *
 * Two of the seventh session's probe arms measured "free" while barely firing,
 * and both were caught only by instrumenting. A "free" feature and a broken
 * feature look IDENTICAL on the curve, because every measured delta is inside
 * the ±8-point bar. So assert the lever is actually pulled.
 *
 * Floor is 15%, well under the costing's measured 27.1 / 25.4% at d4/d5.
 * NC: return 'medium' for every row in SIZE_RADIUS and watch this fail.
 */
describe('exposure — a Large body actually reaches the field', () => {
  it('Large+ bodies are a real share of the d4/d5 enemy population', () => {
    const rows = [...enemiesById.values()];
    // The spawn band at difficulty d is [d-1, d+1] (ENCOUNTERS.levelBand = 1).
    for (const d of [4, 5]) {
      const band = rows.filter((r) => {
        const lvl = r.base_level as number;
        return lvl >= d - 1 && lvl <= d + 1;
      });
      expect(band.length).toBeGreaterThan(0);
      const large = band.filter((r) => ((r.size as string | null) ?? 'medium') !== 'medium');
      expect(large.length / band.length).toBeGreaterThan(0.15);
    }
  });

  it('and a built Large enemy really carries a non-zero radius', () => {
    // Guards against the map silently returning 0 for every row.
    expect(buildEnemy(16, 'e0').radius).toBeGreaterThan(0);
  });
});
