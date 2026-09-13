/**
 * THE RECORD — the approved mockup's layout, in the game.
 *
 * ⚠ WHAT WAS MISSING WAS STRUCTURE, NOT COLOUR. The first implementation
 * landed the six tone channels and the left stripe, then rendered every beat
 * as `tick + sentence` in one flat scroll. Side by side with the mockup the
 * difference is layout: rounds, an actor column, outcome pills, damage folded
 * UNDER its action, and an hp bar with a real denominator.
 *
 * ⚠ COLOUR IS STILL NEVER THE ONLY CARRIER (WCAG 1.4.1). Every pill prints a
 * WORD — 'critical', 'miss', 'slain' — and 'miss' additionally renders dashed,
 * so the record survives greyscale exactly as the sheet does.
 */

import { useMemo } from 'react';
import type { SpawnFact } from '../screens/fieldReading';
import type { BeatLine } from '../beats/interpret';
import { buildRecord, channelFor } from '../beats/record';

function Pill({ label, tone }: { label: string; tone: string }) {
  return <span className="gv-pill" data-ch={tone}>{label}</span>;
}

/**
 * The hp bar.
 *
 * ⚠ ONLY DRAWN WHEN THE DENOMINATOR IS KNOWN. `damage_applied` carries
 * `hpAfter` alone, so a bar drawn without `maxHp` would be inventing a scale —
 * the old record printed "(3 hp left)" precisely because it could not know.
 * `combat.unit_spawned` supplies maxHp; when it is absent (a stream from
 * before brief #12), the numbers still print and the bar is simply omitted.
 */
function HpBar({ after, max, tone }: { after: number; max: number; tone: string }) {
  const pct = Math.max(0, Math.min(100, (after / Math.max(1, max)) * 100));
  return (
    <>
      <span className="gv-hpbar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} data-ch={tone} />
      </span>
      <span className="gv-tabnum">{after} / {max}</span>
    </>
  );
}

function BeatRow({ line, child }: { line: BeatLine; child?: boolean }) {
  const p = line.parts;
  const ch = channelFor(line.tone);

  // A beat with no structured parts keeps the prose form.
  if (!p) {
    return (
      <div className={child ? 'gv-ex gv-ex--child' : 'gv-ex'} data-ch={ch}>
        <span className="gv-stripe" data-ch={ch} />
        <span className="gv-who" />
        <span className="gv-body">{line.text}</span>
      </div>
    );
  }

  // A pure effect line (damage/healing) renders as the compact sub-line.
  if (p.effect && !p.verb) {
    const e = p.effect;
    const ech = channelFor(e.tone);
    return (
      <div className="gv-dmg" data-ch={ech}>
        <span className="gv-dmg-bar" data-ch={ech} />
        <b>{e.amount}</b> {e.kind} · {e.target}
        {e.hpMax !== undefined && e.hpAfter !== undefined && (
          <HpBar after={e.hpAfter} max={e.hpMax} tone={ech} />
        )}
      </div>
    );
  }

  return (
    <div className={child ? 'gv-ex gv-ex--child' : 'gv-ex'} data-ch={ch} data-side={p.side}>
      <span className="gv-stripe" data-ch={ch} />
      <span className="gv-who" data-side={p.side}>{p.who}</span>
      <span className="gv-body">
        {p.pill && <Pill label={p.pill} tone={channelFor(p.pillTone ?? line.tone)} />}
        {/*
          ⚠ THE SPACES ARE EXPLICIT. JSX collapses whitespace between
          expression containers, so `{verb}{subject}` rendered
          "castsDivine Lance" — visible in the first screenshot.
        */}
        {p.verb && <span className="gv-verb">{p.verb}{' '}</span>}
        {p.subject && <><b>{p.subject}</b>{' '}</>}
        {p.target && (
          <>
            <span className="gv-arrow">→</span>
            <span className="gv-tgt">{p.target}</span>
          </>
        )}
        {p.math && <span className="gv-math">{p.math}</span>}
        {p.tags?.map((tag) => <span className="gv-tag" key={tag}>{tag}</span>)}
      </span>
    </div>
  );
}

export function RecordFeed({
  lines,
  spawns,
  nameFor,
  focusName,
}: {
  lines: readonly BeatLine[];
  /** Spawn facts, already memoised by the host — supplies hp denominators. */
  spawns: readonly SpawnFact[];
  /** unit id → the SAME display name the beats were written with. */
  nameFor: (unitId: string) => string;
  /** Narrow to one unit by display name; null shows everything. */
  focusName?: string | null;
}) {
  const model = useMemo(() => buildRecord(lines, spawns, nameFor), [lines, spawns, nameFor]);

  /**
   * ⚠ FILTERING KEEPS AN ACTION'S CHILDREN WITH IT. Filtering the flat list
   * would strip the damage sub-line off a hero's hit and leave the blow with
   * no outcome — the entry is the unit of filtering, not the beat.
   */
  const rounds = useMemo(() => {
    if (!focusName) return model.rounds;
    return model.rounds
      .map((r) => ({
        ...r,
        entries: r.entries.filter((e) => {
          const p = e.line.parts;
          if (p?.who === focusName || p?.target === focusName) return true;
          return e.children.some((c) => c.parts?.effect?.target === focusName);
        }),
      }))
      .filter((r) => r.entries.length > 0);
  }, [model, focusName]);

  return (
    <div className="gv-record">
      {rounds.map((round) => (
        <div className="gv-round" key={round.n}>
          <div className="gv-rhead">
            <span className="gv-rn">Round {round.n}</span>
            <span className="gv-rrule" />
            {round.tally && <span className="gv-rtally">{round.tally}</span>}
            <span className="gv-rt">
              ticks {round.fromTick}{round.toTick !== round.fromTick ? `–${round.toTick}` : ''}
            </span>
          </div>
          {round.entries.map((entry, i) => (
            <div className="gv-entry" key={i}>
              <BeatRow line={entry.line} />
              {entry.children.map((c, j) => <BeatRow line={c} key={j} child />)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
