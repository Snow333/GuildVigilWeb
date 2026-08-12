import { describe, expect, it } from 'vitest';
import { ARENA, ENCOUNTER } from '@content/combat';
import { runEncounter } from '@sim/combat/encounter';
import { EventStream } from '@sim/core/events/stream';
import type { SimEvent } from '@sim/core/events/types';
import type { Combatant } from '@sim/combat/types';
import { combatant } from '../combat/conditions.test';
import {
  buildTracks, fieldGauges, fieldMarginalia, fieldStateAt, formationFits, hpStep, isThrashing,
  labelLanes, positionAt, spawnsFromStream, MAX_UNITS_PER_SIDE, type SpawnFact,
} from '../../src/ui/screens/fieldReading';

/**
 * Brief #12 milestone 12.2 — the field's pure half.
 *
 * Component rendering is covered by the Playwright suite (there is no DOM test
 * library in this repo, by design); everything the field DERIVES is pinned here.
 */

const hero = (id: string, name: string): Combatant =>
  combatant({ id, name, baseId: id, attackBonus: 7, damageDice: '1d8+3', maxHp: 28, hp: 28, ac: 17 });
const foe = (id: string, name = 'Goblin'): Combatant =>
  combatant({ id, name, baseId: '1', side: 'enemies', isHero: false, attackBonus: 4, damageDice: '1d6+1', maxHp: 10, hp: 10, ac: 14, initiativeBonus: 3 });

const party = (n: number): Combatant[] => Array.from({ length: n }, (_, i) => hero(`h${i}`, `Hero ${i}`));
const foes = (n: number): Combatant[] => Array.from({ length: n }, (_, i) => foe(`e${i}`));

const spawn = (unitId: string, over: Partial<SpawnFact> = {}): SpawnFact => ({
  unitId, side: 'heroes', baseId: unitId, name: unitId, maxHp: 20, x: 2, y: 5, ...over,
});

describe('positionAt — motion is drawn, not recorded (D1)', () => {
  const track = [{ tick: 0, x: 0, y: 0 }, { tick: 10, x: 10, y: 0 }, { tick: 20, x: 10, y: 5 }];

  it('holds at the first anchor before it, and the last anchor after it', () => {
    expect(positionAt(track, -5)).toEqual({ x: 0, y: 0 });
    expect(positionAt(track, 0)).toEqual({ x: 0, y: 0 });
    expect(positionAt(track, 20)).toEqual({ x: 10, y: 5 });
    expect(positionAt(track, 999)).toEqual({ x: 10, y: 5 });
  });

  it('lands exactly on every anchor', () => {
    for (const a of track) expect(positionAt(track, a.tick)).toEqual({ x: a.x, y: a.y });
  });

  it('eases between anchors and never leaves the segment', () => {
    for (let t = 1; t < 10; t++) {
      const p = positionAt(track, t);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(10);
      expect(p.y).toBe(0);
    }
    expect(positionAt(track, 5)).toEqual({ x: 5, y: 0 }); // symmetric ease → midpoint at midtick
  });

  it('is monotonic along a monotonic segment', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 10; t++) {
      const { x } = positionAt(track, t);
      expect(x).toBeGreaterThanOrEqual(prev);
      prev = x;
    }
  });

  it('survives a single anchor, an empty track, and no track at all', () => {
    expect(positionAt([{ tick: 0, x: 3, y: 4 }], 50)).toEqual({ x: 3, y: 4 });
    expect(positionAt([], 5)).toEqual({ x: 0, y: 0 });
    expect(positionAt(undefined, 5)).toEqual({ x: 0, y: 0 });
  });
});

describe('buildTracks — anchors are the spawn plus every recorded waypoint', () => {
  it('starts every unit at its spawn position and appends waypoints in order', () => {
    const r = runEncounter('c', 'r', party(2), foes(2), 'tracks_1');
    const spawns = spawnsFromStream(r.stream);
    const tracks = buildTracks(spawns, r.stream.all());

    expect(tracks.size).toBe(spawns.length);
    for (const s of spawns) {
      const t = tracks.get(s.unitId)!;
      expect(t[0]).toEqual({ tick: 0, x: s.x, y: s.y });
      for (let i = 1; i < t.length; i++) expect(t[i]!.tick).toBeGreaterThanOrEqual(t[i - 1]!.tick);
    }
    const waypoints = r.stream.byType('combat.unit_moved').length;
    const anchors = [...tracks.values()].reduce((n, t) => n + t.length, 0);
    expect(anchors).toBe(spawns.length + waypoints);
  });

  it('a waypoint for an unknown unit is skipped, never a crash', () => {
    const events = [{ seq: 0, tick: 5, type: 'combat.unit_moved', data: { unitId: 'ghost', toX: 1, toY: 1, purpose: 'engage' } }] as SimEvent[];
    const tracks = buildTracks([spawn('h0')], events);
    expect(tracks.get('h0')).toHaveLength(1);
    expect(tracks.has('ghost')).toBe(false);
  });
});

describe('fieldStateAt — the derived read of a fight', () => {
  it('everyone starts whole, unengaged, and standing', () => {
    const spawns = [spawn('h0', { maxHp: 28 }), spawn('e0', { side: 'enemies', maxHp: 10 })];
    const s = fieldStateAt(spawns, [], 0);
    expect(s.units.get('h0')).toMatchObject({ hp: 28, status: 'up', targetId: null });
    expect(s.silenceTicks).toBe(0);
    expect(s.churn).toBe(0);
  });

  it('tracks hp, target, downed and slain from the real stream', () => {
    const r = runEncounter('c', 'r', party(2), foes(3), 'state_1');
    const spawns = spawnsFromStream(r.stream);
    const end = fieldStateAt(spawns, r.stream.all(), r.ticks);

    const died = new Set(r.stream.byType('combat.unit_died').map((e) => e.data.unitId));
    for (const [id, u] of end.units) {
      if (died.has(id)) expect(u.status).toBe('dead');
      expect(u.hp).toBeLessThanOrEqual(u.spawn.maxHp);
    }
    // Every hp shown matches the last hpAfter the stream reported for that unit.
    for (const ev of r.stream.byType('combat.damage_applied')) {
      const later = r.stream.all().some((e) => e.seq > ev.seq
        && (e.type === 'combat.damage_applied' || e.type === 'combat.healing_applied')
        && (e.data as { targetId: string }).targetId === ev.data.targetId);
      if (!later && end.units.get(ev.data.targetId)?.status !== 'dead') {
        expect(end.units.get(ev.data.targetId)!.hp).toBe(ev.data.hpAfter);
      }
    }
  });

  it('the dead do not stand back up', () => {
    const spawns = [spawn('h0')];
    const events = [
      { seq: 0, tick: 1, type: 'combat.unit_died', data: { unitId: 'h0' } },
      { seq: 1, tick: 2, type: 'combat.dying_check_resolved', data: { unitId: 'h0', roll: { d20: 20, modifier: 0, total: 20, dc: 11, degree: 'critSuccess', natStep: 0 }, dyingAfter: 0 } },
    ] as SimEvent[];
    expect(fieldStateAt(spawns, events, 5).units.get('h0')!.status).toBe('dead');
  });

  it('a recovery to dying 0 stands a hero up at 1 hp — the wake the stream does not spell out', () => {
    const spawns = [spawn('h0', { maxHp: 28 })];
    const events = [
      { seq: 0, tick: 1, type: 'combat.damage_applied', data: { targetId: 'h0', amount: 30, kind: 'weapon', hpAfter: 0 } },
      { seq: 1, tick: 1, type: 'combat.unit_downed', data: { unitId: 'h0', dyingValue: 1 } },
      { seq: 2, tick: 31, type: 'combat.dying_check_resolved', data: { unitId: 'h0', roll: { d20: 18, modifier: 0, total: 18, dc: 11, degree: 'success', natStep: 0 }, dyingAfter: 0 } },
    ] as SimEvent[];
    const s = fieldStateAt(spawns, events, 40);
    expect(s.units.get('h0')).toMatchObject({ status: 'up', hp: 1 });
  });

  it('healing a downed hero stands them up', () => {
    const spawns = [spawn('h0', { maxHp: 28 })];
    const events = [
      { seq: 0, tick: 1, type: 'combat.unit_downed', data: { unitId: 'h0', dyingValue: 1 } },
      { seq: 1, tick: 5, type: 'combat.healing_applied', data: { targetId: 'h0', amount: 6, hpAfter: 6 } },
    ] as SimEvent[];
    expect(fieldStateAt(spawns, events, 9).units.get('h0')).toMatchObject({ status: 'up', hp: 6 });
  });

  it('silence counts ticks since the last wound or heal; churn counts recent target changes', () => {
    const spawns = [spawn('h0'), spawn('e0', { side: 'enemies' })];
    const events = [
      { seq: 0, tick: 10, type: 'combat.damage_applied', data: { targetId: 'e0', amount: 3, kind: 'weapon', hpAfter: 7 } },
      { seq: 1, tick: 12, type: 'combat.unit_engaged', data: { unitId: 'h0', targetId: 'e0' } },
      { seq: 2, tick: 70, type: 'combat.unit_engaged', data: { unitId: 'h0', targetId: 'e0' } },
    ] as SimEvent[];
    expect(fieldStateAt(spawns, events, 10).silenceTicks).toBe(0);
    expect(fieldStateAt(spawns, events, 40).silenceTicks).toBe(30);
    // At tick 80 only the tick-70 engage is inside the 50-tick window.
    expect(fieldStateAt(spawns, events, 80).churn).toBe(1);
    expect(fieldStateAt(spawns, events, 20).churn).toBe(1);
  });

  it('reads a whole real fight at every tick without throwing', () => {
    const r = runEncounter('c', 'r', party(3), foes(4), 'state_sweep');
    const spawns = spawnsFromStream(r.stream);
    for (let t = 0; t <= r.ticks; t++) {
      const s = fieldStateAt(spawns, r.stream.all(), t);
      expect(s.units.size).toBe(spawns.length);
      expect(s.silenceTicks).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('labelLanes — the scrum stays legible at any side size', () => {
  it('keeps the minimum spacing and preserves vertical order', () => {
    const lanes = labelLanes(
      [{ unitId: 'a', y: 100 }, { unitId: 'b', y: 104 }, { unitId: 'c', y: 108 }],
      30, 1000,
    );
    expect(lanes.get('a')).toBe(100);
    expect(lanes.get('b')).toBe(130);
    expect(lanes.get('c')).toBe(160);
  });

  it('shifts the whole stack back inside when it would overflow the bottom', () => {
    const lanes = labelLanes([{ unitId: 'a', y: 90 }, { unitId: 'b', y: 95 }], 30, 100);
    expect(lanes.get('b')).toBe(100);
    expect(lanes.get('a')).toBe(70);
  });

  it('is deterministic when two units share a y (ties break by id)', () => {
    const entries = [{ unitId: 'b', y: 50 }, { unitId: 'a', y: 50 }];
    expect([...labelLanes(entries, 20, 500)]).toEqual([...labelLanes([...entries].reverse(), 20, 500)]);
  });

  it('SCALES to a party of 6 and beyond — no side size is assumed', () => {
    for (const n of [1, 4, 6, 8, 11]) {
      const entries = Array.from({ length: n }, (_, i) => ({ unitId: `u${i}`, y: 200 }));
      const lanes = labelLanes(entries, 34, 460);
      const ys = [...lanes.values()].sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeCloseTo(34);
      expect(ys[ys.length - 1]).toBeLessThanOrEqual(460);
    }
  });

  it('handles an empty side', () => {
    expect(labelLanes([], 30, 100).size).toBe(0);
  });
});

describe('the arena ceiling is declared, not discovered', () => {
  it('a side fits up to the arena height plus one, and says so above it', () => {
    expect(MAX_UNITS_PER_SIDE).toBe(ARENA.height + 1);
    expect(formationFits(6)).toBe(true);   // the party size we are growing to
    expect(formationFits(MAX_UNITS_PER_SIDE)).toBe(true);
    expect(formationFits(MAX_UNITS_PER_SIDE + 1)).toBe(false);
  });

  it('the margin warns instead of letting glyphs pile up silently', () => {
    const wide = Array.from({ length: MAX_UNITS_PER_SIDE + 2 }, (_, i) => spawn(`e${i}`, { side: 'enemies' }));
    const note = fieldMarginalia(fieldStateAt(wide, [], 0), wide, 0, 100, null, 'the camp');
    expect(note).toContain('wider than the arena');
  });
});

describe('hpStep — the frozen set, always beside a number', () => {
  it('steps down as the bar empties, and bottoms out at zero', () => {
    expect(hpStep(28, 28)).toBe(0);
    expect(hpStep(15, 28)).toBe(1);
    expect(hpStep(5, 28)).toBe(2);
    expect(hpStep(0, 28)).toBe(3);
    expect(hpStep(-4, 28)).toBe(3);
  });

  it('never divides by zero', () => {
    expect(hpStep(0, 0)).toBe(3);
  });
});

describe('the margin and the gauges', () => {
  const spawns = [spawn('h0'), spawn('e0', { side: 'enemies' })];

  it('opens on the approach and declares that the motion is drawn', () => {
    expect(fieldMarginalia(fieldStateAt(spawns, [], 3), spawns, 3, 100, null, 'the camp')).toContain('drawn, not recorded');
  });

  it('calls the silence, then the thrash, then falls back to the standing count', () => {
    const quiet = [{ seq: 0, tick: 0, type: 'combat.unit_engaged', data: { unitId: 'h0', targetId: 'e0' } }] as SimEvent[];
    expect(fieldMarginalia(fieldStateAt(spawns, quiet, 90), spawns, 90, 200, null, 'the camp')).toContain('gone quiet');

    // Real thrash: far more target changes than there are units, in a full window.
    const thrash = Array.from({ length: 12 }, (_, i) => ({
      seq: i, tick: 40 + i, type: 'combat.unit_engaged', data: { unitId: 'h0', targetId: 'e0' },
    })) as SimEvent[];
    const busy = [{ seq: 99, tick: 51, type: 'combat.damage_applied', data: { targetId: 'e0', amount: 1, kind: 'weapon', hpAfter: 9 } } as SimEvent, ...thrash]
      .sort((a, b) => a.tick - b.tick);
    expect(fieldMarginalia(fieldStateAt(spawns, busy, 52), spawns, 52, 200, null, 'the camp')).toContain('thrashing');

    // NOT thrash: the opening flurry, where every unit simply picks a target
    // once and the window has not even elapsed yet. This read as kiting at
    // tick 11 of a real camp fight until the threshold was made honest.
    const opening = Array.from({ length: 9 }, (_, i) => ({
      seq: i, tick: 1, type: 'combat.unit_engaged', data: { unitId: `u${i}`, targetId: 'e0' },
    })) as SimEvent[];
    const nine = Array.from({ length: 9 }, (_, i) => spawn(`u${i}`));
    expect(isThrashing(fieldStateAt(nine, opening, 11), nine, 11)).toBe(false);
    expect(fieldMarginalia(fieldStateAt(nine, opening, 11), nine, 11, 200, null, 'the camp')).toContain('drawn, not recorded');

    const calm = [{ seq: 0, tick: 30, type: 'combat.damage_applied', data: { targetId: 'e0', amount: 1, kind: 'weapon', hpAfter: 9 } }] as SimEvent[];
    expect(fieldMarginalia(fieldStateAt(spawns, calm, 40), spawns, 40, 200, null, 'the camp')).toContain('1 of 1 standing');
  });

  it('names the result once the fight is over', () => {
    const note = fieldMarginalia(fieldStateAt(spawns, [], 100), spawns, 100, 100, 'victory', 'the camp');
    expect(note).toContain('victory');
    expect(note).toContain('as it ended');
  });

  it('the silence gauge is measured against the real stalemate window', () => {
    const g = fieldGauges(fieldStateAt(spawns, [], 40));
    expect(g.silenceWindow).toBe(ENCOUNTER.stalemateWindowTicks);
    expect(g.silenceTicks).toBe(40);
  });
});

describe('the field reads a stream end to end', () => {
  it('spawnsFromStream recovers every unit, and a stream without spawn facts yields none', () => {
    const r = runEncounter('c', 'r', party(2), foes(2), 'read_1');
    expect(spawnsFromStream(r.stream)).toHaveLength(4);

    const bare = new EventStream('dispatch', 'd');
    bare.emit(0, 'combat.started', { combatId: 'c', roomId: 'r', sideA: ['h'], sideB: ['e'] });
    expect(spawnsFromStream(bare)).toHaveLength(0);
    // A field with no spawn facts draws nothing rather than crashing.
    expect(fieldStateAt(spawnsFromStream(bare), bare.all(), 10).units.size).toBe(0);
  });

  it('spawn positions put both sides on their muster lines', () => {
    const r = runEncounter('c', 'r', party(6), foes(6), 'read_muster');
    for (const s of spawnsFromStream(r.stream)) {
      expect(s.x).toBe(s.side === 'heroes' ? ARENA.sideAx : ARENA.sideBx);
    }
  });
});
