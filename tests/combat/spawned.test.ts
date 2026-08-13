import { describe, expect, it } from 'vitest';
import { ARENA } from '@content/combat';
import { runEncounter } from '@sim/combat/encounter';
import { EVENT_TYPE_MANIFEST } from '@sim/core/events/types';
import type { Combatant } from '@sim/combat/types';
import { combatant } from './conditions.test';

const hero = (id: string, name: string): Combatant =>
  combatant({ id, name, baseId: id, attackBonus: 7, damageDice: '1d8+3', maxHp: 28, hp: 28, ac: 17 });
const foe = (id: string, name = 'Goblin'): Combatant =>
  combatant({
    id, name, baseId: '1', side: 'enemies', isHero: false,
    attackBonus: 4, damageDice: '1d6+1', maxHp: 10, hp: 10, ac: 14, initiativeBonus: 3,
  });

const party = (n: number): Combatant[] => Array.from({ length: n }, (_, i) => hero(`h${i}`, `Hero ${i}`));
const foes = (n: number): Combatant[] => Array.from({ length: n }, (_, i) => foe(`e${i}`));

describe('combat.unit_spawned — the schema addition (brief #12)', () => {
  it('the FROZEN manifest GREW: the type is present and the set stays unique', () => {
    expect(EVENT_TYPE_MANIFEST).toContain('combat.unit_spawned');
    expect(new Set(EVENT_TYPE_MANIFEST).size).toBe(EVENT_TYPE_MANIFEST.length);
  });

  it('combat.started is still events[0] — the stream contract is untouched', () => {
    const r = runEncounter('c1', 'r1', party(2), foes(2), 'spawn_order');
    expect(r.stream.all()[0]!.type).toBe('combat.started');
    expect(r.stream.all()[1]!.type).toBe('combat.unit_spawned');
  });

  it('every combatant spawns exactly once, sideA then sideB, caused by combat.started', () => {
    const r = runEncounter('c1', 'r1', party(3), foes(4), 'spawn_each');
    const spawns = r.stream.byType('combat.unit_spawned');
    expect(spawns).toHaveLength(7);
    expect(spawns.map((e) => e.data.unitId)).toEqual(['h0', 'h1', 'h2', 'e0', 'e1', 'e2', 'e3']);
    expect(spawns.map((e) => e.data.side)).toEqual(['heroes', 'heroes', 'heroes', 'enemies', 'enemies', 'enemies', 'enemies']);

    const started = r.stream.byType('combat.started')[0]!;
    for (const s of spawns) {
      expect(s.cause).toBe(started.seq);
      expect(s.tick).toBe(0);
    }
    // The ordered side arrays and the spawn order agree — a consumer can rely on either.
    expect(spawns.filter((s) => s.data.side === 'heroes').map((s) => s.data.unitId)).toEqual([...started.data.sideA]);
    expect(spawns.filter((s) => s.data.side === 'enemies').map((s) => s.data.unitId)).toEqual([...started.data.sideB]);
  });

  it('carries what the stream could not: name, baseId, maxHp, and the formation position', () => {
    const r = runEncounter('c1', 'r1', [hero('h0', 'Torvald')], [foe('e0')], 'spawn_payload');
    const [h, e] = r.stream.byType('combat.unit_spawned');
    expect(h!.data).toEqual({ unitId: 'h0', side: 'heroes', baseId: 'h0', name: 'Torvald', maxHp: 28, x: ARENA.sideAx, y: ARENA.height / 2 });
    expect(e!.data).toEqual({ unitId: 'e0', side: 'enemies', baseId: '1', name: 'Goblin', maxHp: 10, x: ARENA.sideBx, y: ARENA.height / 2 });
  });

  it('spawn positions ARE the formation the sim placed — no reconstruction needed', () => {
    const heroes = party(4);
    const r = runEncounter('c1', 'r1', heroes, foes(2), 'spawn_positions');
    const spawns = r.stream.byType('combat.unit_spawned');
    for (const h of heroes) {
      const s = spawns.find((e) => e.data.unitId === h.id)!;
      // placeFormation mutates in place before the first tick; the event agrees with it.
      expect(s.data.x).toBe(ARENA.sideAx);
    }
    // Centred, one unit apart. DERIVED from the room, not written down: the room
    // is 20 × 20 as of brief #19 and a hardcoded [3.5, 4.5, 5.5, 6.5] only ever
    // described the old 14 × 10 box.
    const startY = (ARENA.height - (heroes.length - 1)) / 2;
    const ys = spawns.filter((s) => s.data.side === 'heroes').map((s) => s.data.y);
    expect(ys).toEqual(heroes.map((_, i) => startY + i));
  });

  it('SCALES: party growth to 6 and larger enemy groups stay inside the arena', () => {
    // Heroes go to 6 (and enemy groups grow later) — nothing may assume 4v4.
    for (const [a, b] of [[4, 4], [6, 6], [6, 8]] as const) {
      const r = runEncounter('c1', 'r1', party(a), foes(b), `scale_${a}_${b}`);
      const spawns = r.stream.byType('combat.unit_spawned');
      expect(spawns).toHaveLength(a + b);
      for (const s of spawns) {
        expect(s.data.y).toBeGreaterThanOrEqual(0);
        expect(s.data.y).toBeLessThanOrEqual(ARENA.height);
      }
    }
  });

  it('the addition did NOT touch resolution: same seed, same hash, same outcome', () => {
    const run = () => runEncounter('c1', 'r1', party(2), foes(2), 'spawn_determinism');
    const a = run(), b = run();
    expect(a.stream.hash()).toBe(b.stream.hash());
    expect(a.result).toBe(b.result);
    expect(a.ticks).toBe(b.ticks);
  });
});
