/**
 * Brief #12 — id → display name, resolved from the stream itself.
 *
 * The bug this kills: `PlaybackScreen` built its name map from the hero roster
 * only, and `interpretEvent`'s `nameFor` defaults to identity, so every enemy
 * beat has been printing its raw instance id since brief #5 —
 * `disp_1:camp_e0 → Torvald: hit (14+7=21 vs DC 16)`.
 *
 * `combat.unit_spawned` carries the name, so the fix belongs here, once, for
 * every consumer — not per screen.
 *
 * Disambiguation is presentation, not sim: four goblins are four identical
 * labels, so repeats are numbered BY SPAWN ORDER. Deterministic over the same
 * stream, and it never touches a unique name.
 */

import type { EventStream } from '@sim/core/events/stream';
import type { NameResolver } from './interpret';

/** Small-cap roman numerals — the label voice already speaks small caps. */
const ORDINALS = ['ɪ', 'ɪɪ', 'ɪɪɪ', 'ɪᴠ', 'ᴠ', 'ᴠɪ', 'ᴠɪɪ', 'ᴠɪɪɪ', 'ɪx', 'x'];

const ordinal = (n: number): string => ORDINALS[n] ?? String(n + 1);

/**
 * Build the display-name map for a stream. `roster` (hero id → name) is layered
 * ON TOP of the spawn facts so a renamed or re-equipped hero still reads by the
 * name the player knows them by.
 */
export function namesFromStream(stream: EventStream, roster?: ReadonlyMap<string, string>): Map<string, string> {
  const spawns = stream.byType('combat.unit_spawned');

  const totals = new Map<string, number>();
  for (const ev of spawns) totals.set(ev.data.name, (totals.get(ev.data.name) ?? 0) + 1);

  const names = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const ev of spawns) {
    const { unitId, name } = ev.data;
    if (names.has(unitId)) continue; // a unit spawns once; later duplicates are ignored
    if ((totals.get(name) ?? 0) > 1) {
      const n = seen.get(name) ?? 0;
      seen.set(name, n + 1);
      names.set(unitId, `${name} ${ordinal(n)}`);
    } else {
      names.set(unitId, name);
    }
  }

  if (roster) for (const [id, name] of roster) names.set(id, name);
  return names;
}

/** The resolver `interpretStream` wants: known ids resolve, unknown ids pass through. */
export function nameResolver(names: ReadonlyMap<string, string>): NameResolver {
  return (id) => names.get(id) ?? id;
}
