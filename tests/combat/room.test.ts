import { describe, expect, it } from 'vitest';
import { ARENA } from '@content/combat';
import { boundToRoom } from '@sim/combat/ai';
import { runEncounter } from '@sim/combat/encounter';
import type { Combatant } from '@sim/combat/types';
import { combatant } from './conditions.test';

/**
 * THE COMBAT ROOM (brief #19 §9, approved 2026-08-13).
 *
 * The room is the first spatial rule in the engine that is not flanking. Before
 * it, `PopulatedRoom` carried no geometry, `stepToward` had no collision, and
 * `ARENA` was referenced in exactly two places — `placeFormation` and the field
 * renderer — constraining nothing. Brief #18 §1 measured the consequence:
 * 51–76% of fights rendered at least one unit off the sheet, with excursions to
 * six arena-widths out.
 *
 * ⚠ WHY THIS TEST READS `Combatant.pos` AND NOT THE EVENT STREAM. It cannot use
 * the stream, and that is the whole reason the bug survived this long.
 * `combat.unit_moved` fires at WAYPOINT granularity — only on the tick a unit
 * crosses from out-of-attack-range to in-range — so a caster that backs away
 * while staying inside its own 6-unit engage range emits nothing at all. The
 * unit walks off the sheet in complete silence. `runEncounter` mutates the
 * arrays it is handed, so the caller can read the final positions directly, and
 * that is the only place the fact is visible.
 */

const rangedHero = (id: string): Combatant =>
  combatant({
    id, name: id, baseId: id, side: 'heroes', isHero: true,
    weaponRange: 1, engageRange: 6, isCaster: true, maxHp: 40, hp: 40, ac: 18,
  });

const melee = (id: string, side: 'heroes' | 'enemies'): Combatant =>
  combatant({
    id, name: id, baseId: side === 'heroes' ? id : '1', side, isHero: side === 'heroes',
    attackBonus: 4, damageDice: '1d4', maxHp: 200, hp: 200, ac: 30, speed: 8, initiativeBonus: 3,
  });

/**
 * The standing repro. Heroes muster at `sideAx`, enemies at `sideBx`; a ranged
 * unit holds a standoff band and steps AWAY when something closes inside 2. Give
 * the enemies more speed than the hero and the hero retreats from x = 3 for the
 * whole fight — straight into the left wall. Everyone is given enough HP and AC
 * that the fight cannot end early and the retreat runs its course.
 */
const retreatFight = (seed: string) => {
  const heroes = [rangedHero('h0'), rangedHero('h1')];
  const enemies = [melee('e0', 'enemies'), melee('e1', 'enemies')];
  const r = runEncounter('c_room', 'r_room', heroes, enemies, seed);
  return { heroes, enemies, all: [...heroes, ...enemies], r };
};

const inside = (u: Combatant): boolean =>
  u.pos.x >= 0 && u.pos.x <= ARENA.width && u.pos.y >= 0 && u.pos.y <= ARENA.height;

describe('the combat room — the walls exist (brief #19)', () => {
  it('the room is one type, 20 × 20, and the musters keep the old box\'s proportions', () => {
    // Steven, 2026-08-13: "ONE room type, 20 × 20", sized to hold 4v4, 6v6, 6v8.
    expect({ width: ARENA.width, height: ARENA.height }).toEqual({ width: 20, height: 20 });
    // Musters sat 10 apart in a 14-wide room (71%); 14 apart in a 20-wide one (70%).
    expect(ARENA.sideBx - ARENA.sideAx).toBe(14);
    expect(ARENA.sideAx).toBe(ARENA.width - ARENA.sideBx); // symmetric about the centre
  });

  it('NO UNIT EVER LEAVES THE ROOM, across many fights and many seeds', () => {
    const escaped: string[] = [];
    for (let i = 0; i < 40; i++) {
      const { all } = retreatFight(`room_bound_${i}`);
      for (const u of all) {
        if (!inside(u)) escaped.push(`seed ${i}: ${u.id} at (${u.pos.x.toFixed(2)}, ${u.pos.y.toFixed(2)})`);
      }
    }
    expect(escaped).toEqual([]);
  });

  it('and the retreat REALLY HAPPENS — the wall is load-bearing, not vacuous', () => {
    // Without this, the test above would pass on a fight where nobody ever
    // approached a wall: the exact shape of a green test that proves nothing.
    let pinned = 0;
    for (let i = 0; i < 40; i++) {
      const { heroes } = retreatFight(`room_pin_${i}`);
      if (heroes.some((h) => h.pos.x <= 0.001)) pinned++;
    }
    expect(pinned).toBeGreaterThan(20); // measured 40/40 — the casters always reach the wall
  });

  it('every spawn starts inside the room, at 4v4, 6v6 and 6v8', () => {
    for (const [a, b] of [[4, 4], [6, 6], [6, 8]] as const) {
      const heroes = Array.from({ length: a }, (_, i) => melee(`h${i}`, 'heroes'));
      const enemies = Array.from({ length: b }, (_, i) => melee(`e${i}`, 'enemies'));
      runEncounter('c1', 'r1', heroes, enemies, `room_scale_${a}_${b}`);
      for (const u of [...heroes, ...enemies]) expect(inside(u)).toBe(true);
    }
  });
});

describe('boundToRoom — the clamp is per-axis, and that IS the wall-slide', () => {
  const room = { width: 20, height: 20 };

  it('a position inside the room is returned UNCHANGED, by identity', () => {
    const p = { x: 4, y: 9 };
    expect(boundToRoom(p, room)).toBe(p); // same object — no allocation, no drift
  });

  it('a unit driven into a wall keeps its tangential motion and SLIDES', () => {
    // Heading down-left into the left wall: x pins to 0, y is untouched.
    expect(boundToRoom({ x: -3, y: 12 }, room)).toEqual({ x: 0, y: 12 });
    // A hard stop would have refused the whole move and held y at its old value;
    // the slide is what makes a cornered caster read as a person (§3.1, on feel).
    expect(boundToRoom({ x: 26, y: -4 }, room)).toEqual({ x: 20, y: 0 });
  });

  it('the corner pins both axes', () => {
    expect(boundToRoom({ x: -9, y: 44 }, room)).toEqual({ x: 0, y: 20 });
  });
});
