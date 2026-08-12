/**
 * Brief #12 — splitting any stream into the fights inside it.
 *
 * Dungeon combats are already `absorb`ed into the dispatch stream, and surface
 * fights arrive as their own streams via `QuestRecord.fights`. One function
 * serves both: the combat view never needs to know which carrier it was handed.
 *
 * Pure over the stream. Ticks are re-based to the segment so a fight always
 * plays from 0, whatever offset it sat at inside a longer run.
 */

import type { EventStream } from './stream';
import type { SimEvent } from './types';

export interface CombatSegment {
  combatId: string;
  roomId: string;
  /** Tick of `combat.started` in the SOURCE stream (0 for a standalone fight). */
  startTick: number;
  /** Tick of `combat.ended`, or of the last event if the stream was truncated. */
  endTick: number;
  /** Duration in 100ms ticks — `endTick - startTick`. */
  ticks: number;
  result: 'victory' | 'defeat' | 'fled' | 'stalemate' | null;
  /** The segment's events, ticks re-based so the fight starts at 0. */
  events: SimEvent[];
}

/**
 * Every `combat.started` … `combat.ended` run in the stream, in order.
 * A trailing `started` with no `ended` (a truncated or in-flight record) is
 * still returned, with `result: null` — dropping it would hide a real fight.
 */
export function combatSegments(stream: EventStream): CombatSegment[] {
  const segments: CombatSegment[] = [];
  const all = stream.all();
  let open: { combatId: string; roomId: string; startTick: number; from: number } | null = null;

  all.forEach((ev, i) => {
    if (ev.type === 'combat.started') {
      if (open) closeSegment(segments, all, open, i - 1, null);
      open = { combatId: ev.data.combatId, roomId: ev.data.roomId, startTick: ev.tick, from: i };
      return;
    }
    if (ev.type === 'combat.ended' && open) {
      closeSegment(segments, all, open, i, ev.data.result);
      open = null;
    }
  });
  if (open) closeSegment(segments, all, open, all.length - 1, null);
  return segments;
}

function closeSegment(
  out: CombatSegment[],
  all: readonly SimEvent[],
  open: { combatId: string; roomId: string; startTick: number; from: number },
  to: number,
  result: CombatSegment['result'],
): void {
  const events = all.slice(open.from, to + 1).map((e) => ({ ...e, tick: e.tick - open.startTick }) as SimEvent);
  const last = events[events.length - 1];
  const endTick = open.startTick + (last ? last.tick : 0);
  out.push({
    combatId: open.combatId,
    roomId: open.roomId,
    startTick: open.startTick,
    endTick,
    ticks: endTick - open.startTick,
    result,
    events,
  });
}
