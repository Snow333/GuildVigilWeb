/**
 * THE RECORD'S LAYOUT MODEL (brief #24, matching the approved mockup).
 *
 * ⚠ THE SHIPPED RECORD WAS A FLAT LIST AND THE MOCKUP IS NOT. Comparing the
 * two side by side, the colour pass had landed but the STRUCTURE had not:
 *
 *   mockup                      shipped
 *   ──────────────────────      ─────────────────────────
 *   grouped into rounds         one continuous scroll
 *   actor in its own column     actor inline in a sentence
 *   outcome as a pill           outcome as a word mid-sentence
 *   damage as a sub-line        damage as a separate top-level row
 *   hp bar with N / M           "(3 hp left)" with no denominator
 *   round tallies               nothing
 *
 * This module turns the flat `BeatLine[]` into that shape. It lives apart from
 * interpret.ts on purpose: interpret.ts owns WHAT A BEAT SAYS and is pinned by
 * a contract snapshot, while this owns HOW BEATS GROUP, which is presentation
 * and free to change.
 */

import type { SpawnFact } from '../screens/fieldReading';
import type { BeatLine, BeatTone } from './interpret';
import { TICKS_PER_SECOND } from '@content/combat';

/**
 * Ticks per displayed round.
 *
 * ⚠ DERIVED, NOT INVENTED. PF2E's round is 6 seconds and the sim runs at
 * TICKS_PER_SECOND. Hard-coding "10 ticks" here would silently disagree with
 * the engine the first time the tick rate moves.
 */
export const TICKS_PER_ROUND = Math.max(1, Math.round(6 * TICKS_PER_SECOND));

export interface RecordEntry {
  line: BeatLine;
  /** Damage/healing beats that belong UNDER the preceding action. */
  children: BeatLine[];
}

export interface RecordRound {
  /** 1-based round number, derived from the tick. */
  n: number;
  fromTick: number;
  toTick: number;
  entries: RecordEntry[];
  /** Right-aligned summary: '1 kill · 10 damage dealt'. */
  tally: string;
}

export interface RecordModel {
  rounds: RecordRound[];
  /** Units seen in this stream, for hp denominators and side colouring. */
  units: Map<string, { name: string; side: 'heroes' | 'enemies'; maxHp: number }>;
}

/**
 * ⚠ SPAWN FACTS ARE PASSED IN, NOT RE-READ FROM A STREAM. An earlier version
 * took the EventStream and filtered it here, which meant the caller wrote
 * `buildRecord(lines, streamOf(segment))` — a NEW stream object every render,
 * so the useMemo cache never hit and the whole record rebuilt on every tick of
 * playback. Taking the already-memoised spawn list removes the trap.
 *
 * This is also what lets the hp bar have a denominator at all: damage events
 * carry `hpAfter` alone, and `combat.unit_spawned` (brief #12) carries maxHp.
 */

/** Does this beat belong UNDER the action above it rather than beside it? */
function isChild(line: BeatLine): boolean {
  return line.parts?.effect !== undefined;
}

/**
 * ⚠ A DEATH FOLDS INTO THE BLOW THAT CAUSED IT. In the mockup 'Slain' is a
 * pill on the damage line, not its own row — that is what makes a kill read as
 * one event instead of three. Kept as a separate predicate because a death
 * with no preceding action (bleed-out, a failed dying check) must still get
 * its own row rather than vanishing.
 */
function isSlainPill(line: BeatLine): boolean {
  return line.parts?.pill === 'slain';
}

export function buildRecord(
  lines: readonly BeatLine[],
  spawns: readonly SpawnFact[],
  /**
   * ⚠ THE SAME RESOLVER THE BEATS WERE WRITTEN WITH. Beats carry DISPLAY
   * names, and `namesFromStream` disambiguates duplicates by spawn order — a
   * stream with four goblins yields "Goblin ɪ" … "Goblin ɪᴠ", while the spawn
   * fact still says plain "Goblin". Keying maxHp off `spawn.name` therefore
   * missed every duplicate, which is why the hp bar silently never drew.
   * Resolving the spawn's unitId through the same map keys both sides alike.
   */
  nameFor: (unitId: string) => string,
): RecordModel {
  const maxHpByName = new Map<string, number>();
  const sideByName = new Map<string, 'heroes' | 'enemies'>();
  const units: RecordModel['units'] = new Map();
  for (const s of spawns) {
    const display = nameFor(s.unitId);
    units.set(s.unitId, { name: display, side: s.side, maxHp: s.maxHp });
    maxHpByName.set(display, s.maxHp);
    sideByName.set(display, s.side);
  }

  const rounds: RecordRound[] = [];
  let current: RecordRound | null = null;

  for (const line of lines) {
    const n = Math.floor(line.tick / TICKS_PER_ROUND) + 1;

    if (!current || current.n !== n) {
      current = {
        n,
        fromTick: line.tick,
        toTick: line.tick,
        entries: [],
        tally: '',
      };
      rounds.push(current);
    }
    current.toTick = Math.max(current.toTick, line.tick);

    /**
     * ⚠ COPY, NEVER MUTATE THE INPUT BEAT. Filling `hpMax` and `side` directly
     * on `line.parts` writes through to `feed.lines`, which is a memoised value
     * owned by the caller. Mutating it means the same array yields a different
     * render each pass — React sees no new reference, so the fix never
     * propagates, and anything else reading the feed silently gets a
     * half-annotated copy. Rebuilding the parts keeps buildRecord pure.
     */
    let parts = line.parts;
    if (parts) {
      const effect = parts.effect
        ? {
          ...parts.effect,
          ...(maxHpByName.has(parts.effect.target)
            ? { hpMax: maxHpByName.get(parts.effect.target)! }
            : {}),
        }
        : undefined;
      const side = parts.side ?? (parts.who ? sideByName.get(parts.who) : undefined);
      parts = {
        ...parts,
        ...(effect ? { effect } : {}),
        ...(side ? { side } : {}),
      };
    }
    const entryLine: BeatLine = parts ? { ...line, parts } : line;

    const last = current.entries[current.entries.length - 1];

    if (last && isChild(entryLine)) {
      last.children.push(entryLine);
      continue;
    }
    /**
     * A death immediately after an action attaches to it, so the kill reads as
     * one beat. With no action above it, it stands alone.
     */
    if (last && isSlainPill(entryLine) && last.children.length > 0) {
      last.children.push(entryLine);
      continue;
    }

    current.entries.push({ line: entryLine, children: [] });
  }

  // Round tallies, counted from what the round actually contains.
  for (const round of rounds) {
    let kills = 0;
    let dealt = 0;
    let taken = 0;
    for (const entry of round.entries) {
      for (const b of [entry.line, ...entry.children]) {
        if (isSlainPill(b)) kills++;
        const e = b.parts?.effect;
        if (!e || e.kind === 'healing') continue;
        // ⚠ "dealt" vs "taken" is from the PARTY's point of view, which is the
        // only frame the player cares about.
        if (sideByName.get(e.target) === 'heroes') taken += e.amount;
        else dealt += e.amount;
      }
    }
    const bits: string[] = [];
    if (kills > 0) bits.push(`${kills} kill${kills === 1 ? '' : 's'}`);
    if (dealt > 0) bits.push(`${dealt} damage dealt`);
    if (taken > 0) bits.push(`${taken} damage taken`);
    round.tally = bits.join(' · ');
  }

  return { rounds, units };
}

/** Tone → the CSS channel name the stylesheet uses. */
export function channelFor(tone: BeatTone): string {
  switch (tone) {
    case 'harm': case 'bad': return 'harm';
    case 'defence': return 'defence';
    case 'magic': return 'magic';
    case 'resource': case 'good': case 'loot': return 'resource';
    case 'exceptional': return 'exceptional';
    case 'inert': return 'inert';
    case 'slain': return 'slain';
    default: return 'neutral';
  }
}
