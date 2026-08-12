/**
 * The field — brief #12 §4/§5, the pure half. Geometry, interpolation and the
 * derived read of a combat stream at a tick. `CombatField.tsx` scales and inks
 * it; nothing here touches the DOM, and no rule lives here — every value is a
 * fact of the stream or a fact of `ARENA`.
 *
 * MOTION IS DRAWN, NOT RECORDED (decision D1). `combat.unit_moved` fires only
 * when a unit first enters attack range of its target — roughly six times in a
 * 4v4 fight — so the path between waypoints is interpolated by `positionAt`.
 * That eased curve is presentation over facts (constraint 4) and must never be
 * used to derive a distance, a range check, or any judgement.
 */

import { ARENA, ENCOUNTER, TICKS_PER_SECOND } from '@content/combat';
import type { EventStream } from '@sim/core/events/stream';
import type { SimEvent } from '@sim/core/events/types';
import type { Vec2 } from '@sim/combat/types';

/** 1 world unit = one old grid square. The arena is 14 × 10 → 70 × 50 ft. */
export const FEET_PER_UNIT = 5;

/**
 * `placeFormation` centres a side and steps one unit per row, so a side of n
 * spans n − 1 units. Above this it would start outside the arena — the view
 * says so in the margin rather than piling glyphs up silently. Party size is
 * growing (heroes to 6, larger enemy groups later); room-shaped arenas in 1.4
 * are where this ceiling gets revisited.
 */
export const MAX_UNITS_PER_SIDE = ARENA.height + 1;

export const formationFits = (n: number): boolean => n <= MAX_UNITS_PER_SIDE;

/** A `combat.unit_spawned` payload — the view's whole notion of identity. */
export type SpawnFact = SimEvent<'combat.unit_spawned'>['data'];

export interface Anchor extends Vec2 {
  tick: number;
}

export type UnitStatus = 'up' | 'down' | 'dead' | 'fled';

export interface UnitState {
  spawn: SpawnFact;
  hp: number;
  status: UnitStatus;
  /** Current target id from `combat.unit_engaged`, or null before first engage. */
  targetId: string | null;
  conditions: string[];
}

export interface FieldState {
  units: Map<string, UnitState>;
  /**
   * Ticks since the last wound or heal. Read against
   * `ENCOUNTER.stalemateWindowTicks`: this is the stalemate gauge, and today it
   * is the kiting read — silence plus motion is exactly the R3 failure.
   */
  silenceTicks: number;
  /** `combat.unit_engaged` in the trailing window — the target-thrash tell. */
  churn: number;
  /** Attacks, reactions and damage inside the flash window, for the strike marks. */
  recent: SimEvent[];
}

/** How far back `churn` looks (50 ticks = 5 s of sim time). */
export const CHURN_WINDOW_TICKS = 50;
/** How long a strike stays inked on the field. */
export const FLASH_TICKS = 2;

export const spawnsFromStream = (stream: EventStream): SpawnFact[] =>
  spawnsFromEvents(stream.all());

/** The same read over a bare event list — what a `CombatSegment` hands over. */
export const spawnsFromEvents = (events: readonly SimEvent[]): SpawnFact[] =>
  events.filter((e): e is SimEvent<'combat.unit_spawned'> => e.type === 'combat.unit_spawned').map((e) => e.data);

/**
 * Position anchors per unit: the spawn position, then every recorded waypoint.
 * Everything between two anchors is drawn.
 */
export function buildTracks(spawns: readonly SpawnFact[], events: readonly SimEvent[]): Map<string, Anchor[]> {
  const tracks = new Map<string, Anchor[]>();
  for (const s of spawns) tracks.set(s.unitId, [{ tick: 0, x: s.x, y: s.y }]);
  for (const ev of events) {
    if (ev.type !== 'combat.unit_moved') continue;
    const track = tracks.get(ev.data.unitId);
    if (!track) continue; // a mover with no spawn fact: skip, never crash
    const last = track[track.length - 1];
    if (last && ev.tick < last.tick) continue; // anchors stay monotonic
    track.push({ tick: ev.tick, x: ev.data.toX, y: ev.data.toY });
  }
  return tracks;
}

/** Ease-in-out over the span between anchors; hold before the first and after the last. */
export function positionAt(track: readonly Anchor[] | undefined, tick: number): Vec2 {
  if (!track || track.length === 0) return { x: 0, y: 0 };
  const first = track[0]!;
  if (tick <= first.tick) return { x: first.x, y: first.y };
  const last = track[track.length - 1]!;
  if (tick >= last.tick) return { x: last.x, y: last.y };
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i]!;
    const b = track[i + 1]!;
    if (tick < a.tick || tick > b.tick) continue;
    const span = b.tick - a.tick;
    if (span <= 0) return { x: b.x, y: b.y };
    const u = (tick - a.tick) / span;
    const e = u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
  }
  return { x: last.x, y: last.y };
}

/** Fold the stream up to `tick` into what the field draws. Pure; no memo needed. */
export function fieldStateAt(spawns: readonly SpawnFact[], events: readonly SimEvent[], tick: number): FieldState {
  const units = new Map<string, UnitState>();
  for (const s of spawns) {
    units.set(s.unitId, { spawn: s, hp: s.maxHp, status: 'up', targetId: null, conditions: [] });
  }

  let lastProgressTick = 0;
  let churn = 0;
  const recent: SimEvent[] = [];

  for (const ev of events) {
    if (ev.tick > tick) break;
    switch (ev.type) {
      case 'combat.damage_applied': {
        const u = units.get(ev.data.targetId);
        if (u) u.hp = ev.data.hpAfter;
        lastProgressTick = ev.tick;
        break;
      }
      case 'combat.healing_applied': {
        const u = units.get(ev.data.targetId);
        if (u) {
          u.hp = ev.data.hpAfter;
          // healDying clears dying + unconscious, so a heal above 0 stands them up.
          if (u.status === 'down' && ev.data.hpAfter > 0) u.status = 'up';
        }
        lastProgressTick = ev.tick;
        break;
      }
      case 'combat.unit_engaged': {
        const u = units.get(ev.data.unitId);
        if (u) u.targetId = ev.data.targetId;
        if (ev.tick > tick - CHURN_WINDOW_TICKS) churn++;
        break;
      }
      case 'combat.unit_downed': setStatus(units, ev.data.unitId, 'down'); break;
      case 'combat.unit_died': setStatus(units, ev.data.unitId, 'dead'); break;
      case 'combat.unit_fled': setStatus(units, ev.data.unitId, 'fled'); break;
      case 'combat.dying_check_resolved': {
        // dyingAfter 0 means `wake()` ran: dying and unconscious cleared, hp set
        // to 1. No healing event follows, so the HP is DERIVED from the wake —
        // a known consequence of the fact, not a guess. Recovery churn also
        // counts as progress in the sim, so the silence gauge must agree.
        if (ev.data.dyingAfter === 0) {
          setStatus(units, ev.data.unitId, 'up');
          const u = units.get(ev.data.unitId);
          if (u) u.hp = Math.max(u.hp, 1);
        }
        lastProgressTick = ev.tick;
        break;
      }
      case 'combat.condition_applied': {
        const u = units.get(ev.data.targetId);
        if (u && !u.conditions.includes(ev.data.conditionId)) u.conditions.push(ev.data.conditionId);
        break;
      }
      case 'combat.condition_expired': {
        const u = units.get(ev.data.targetId);
        if (u) u.conditions = u.conditions.filter((c) => c !== ev.data.conditionId);
        break;
      }
      default: break;
    }
    if (ev.tick > tick - FLASH_TICKS
      && (ev.type === 'combat.attack_resolved' || ev.type === 'combat.reaction_triggered' || ev.type === 'combat.damage_applied')) {
      recent.push(ev);
    }
  }

  return { units, silenceTicks: Math.max(0, tick - lastProgressTick), churn, recent };
}

function setStatus(units: Map<string, UnitState>, id: string, status: UnitStatus): void {
  const u = units.get(id);
  if (!u) return;
  if (u.status === 'dead' && status !== 'dead') return; // the dead do not stand up
  u.status = status;
}

/**
 * Labels collide once both lines converge on the same few units, so each side
 * gets its own lane stack: sorted by y, pushed to a minimum spacing, then shifted
 * back inside the arena if the stack overflowed. Driven entirely by how many
 * units are on the side — nothing here assumes 4v4.
 */
export function labelLanes(
  entries: readonly { unitId: string; y: number }[],
  minSpacing: number,
  bottom: number,
): Map<string, number> {
  const lanes = new Map<string, number>();
  const sorted = [...entries].sort((a, b) => a.y - b.y || (a.unitId < b.unitId ? -1 : 1));
  let prev = -Infinity;
  for (const e of sorted) {
    const y = Math.max(e.y, prev + minSpacing);
    lanes.set(e.unitId, y);
    prev = y;
  }
  const overflow = prev - bottom;
  if (overflow > 0) for (const [id, y] of lanes) lanes.set(id, y - overflow);
  return lanes;
}

/**
 * The margin's single line, derived. Red ink lives in the margin (brief #8), so
 * the field draws none and this is what it says.
 */
export function fieldMarginalia(
  state: FieldState,
  spawns: readonly SpawnFact[],
  tick: number,
  endTick: number,
  result: string | null,
  siteLabel: string,
): string {
  const perSide = (side: 'heroes' | 'enemies'): number => spawns.filter((s) => s.side === side).length;

  if (!formationFits(perSide('heroes')) || !formationFits(perSide('enemies'))) {
    return `This fight is wider than the arena — more than ${MAX_UNITS_PER_SIDE} to a side, so the muster rows overlap. Room-shaped arenas are the fix.`;
  }
  if (tick >= endTick && result) {
    return `The field as it ended — ${result}, ${endTick} ticks (${(endTick / TICKS_PER_SECOND).toFixed(1)} s).`;
  }
  if (state.silenceTicks > 60) {
    return `The fight has gone quiet — ${(state.silenceTicks / TICKS_PER_SECOND).toFixed(1)} s without a wound. Watch the gauge.`;
  }
  if (isThrashing(state, spawns, tick)) {
    return `Targets are thrashing — ${state.churn} changes in five seconds. This is what kiting looks like from the desk.`;
  }
  if (tick < 12) return 'Both lines still closing. Motion between waypoints is drawn, not recorded.';

  const standing = [...state.units.values()].filter((u) => u.spawn.side === 'heroes' && u.status === 'up').length;
  return `${siteLabel} · ${standing} of ${perSide('heroes')} standing.`;
}

/**
 * Thrash, honestly. Every unit legitimately picks a target once when the fight
 * opens, so raw churn is ~one per unit before anyone has switched anything —
 * and until the window has actually elapsed there is nothing to compare against.
 * Real thrash is target changes IN EXCESS of one per unit, in a full window.
 */
export function isThrashing(state: FieldState, spawns: readonly SpawnFact[], tick: number): boolean {
  return tick >= CHURN_WINDOW_TICKS && state.churn > spawns.length;
}

export interface FieldGauges {
  silenceTicks: number;
  /** `ENCOUNTER.stalemateWindowTicks` — what silence is measured against. */
  silenceWindow: number;
  churn: number;
  churnWindowTicks: number;
}

export const fieldGauges = (state: FieldState): FieldGauges => ({
  silenceTicks: state.silenceTicks,
  silenceWindow: ENCOUNTER.stalemateWindowTicks,
  churn: state.churn,
  churnWindowTicks: CHURN_WINDOW_TICKS,
});

/** HP fraction → the frozen status step. ALWAYS rendered beside the number. */
export function hpStep(hp: number, maxHp: number): 0 | 1 | 2 | 3 {
  if (maxHp <= 0) return 3;
  const r = Math.max(0, hp) / maxHp;
  if (r > 0.6) return 0;
  if (r > 0.3) return 1;
  if (r > 0) return 2;
  return 3;
}
