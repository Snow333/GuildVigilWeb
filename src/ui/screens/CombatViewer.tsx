/**
 * Watching one fight — brief #12 §7. The field, its roster rail, the two
 * gauges, the margin, and the transport that drives them.
 *
 * WHY COMBAT GETS ITS OWN TRANSPORT. Measured: a median fight is 32–91 ticks
 * and P90 is 143, so at 1× a whole battle lasts 3–14 seconds and at 16× it is
 * two tenths of one. The dispatch ladder (1×/4×/16×) was sized for travel and
 * exploration. So this splits in two — WATCH (¼×, ½×, 1×) animates the field,
 * and SKIM (4×, 16×) holds it and lets the record carry the fight. 16× is the
 * skip control it always really was. ½× is where an opened fight starts.
 *
 * The stream is a finished fact, so scrubbing and stepping are exact and free.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { TICKS_PER_SECOND } from '@content/combat';
import type { CombatSegment } from '@sim/core/events/segments';
import { interpretStream } from '../beats/interpret';
import { nameResolver } from '../beats/names';
import { EventStream } from '@sim/core/events/stream';
import { CombatField } from './CombatField';
import { RecordFeed } from '../components/RecordFeed';
import { useGame, type CombatSpeed } from '../state/GameProvider';
import {
  fieldGauges, fieldMarginalia, fieldStateAt, hpStep, isThrashing, spawnsFromEvents,
} from './fieldReading';

/**
 * The combat ladder. Anything at or above SKIM_FROM holds the field.
 * The TYPE lives in GameProvider beside the setting that persists it — importing
 * it from there is what keeps this file free of an import cycle.
 */
export type { CombatSpeed } from '../state/GameProvider';
const WATCH_SPEEDS: CombatSpeed[] = [0.25, 0.5, 1];
const SKIM_SPEEDS: CombatSpeed[] = [4, 16];
const SKIM_FROM = 4;

/**
 * Wall-clock milliseconds per sim tick, DERIVED from the sim's own constant
 * rather than restated as a literal 100 — if the tick rate ever changes,
 * playback speed follows it instead of silently desynchronising.
 */
const TICK_MS = 1000 / TICKS_PER_SECOND;
const SPEED_LABEL: Record<CombatSpeed, string> = { 0.25: '¼×', 0.5: '½×', 1: '1×', 4: '4×', 16: '16×' };

export interface CombatViewerProps {
  segment: CombatSegment;
  /** What the sheet calls the place — `the road`, `the camp`, a room id. */
  siteLabel: string;
  names: ReadonlyMap<string, string>;
}

export function CombatViewer({ segment, siteLabel, names }: CombatViewerProps) {
  // Same rule as the dispatch transport: the ladder IS the persisted setting,
  // not a local copy that forgets itself between fights and between sessions.
  const { defaultCombatSpeed, setDefaultCombatSpeed } = useGame();
  const [tick, setTick] = useState(0);
  const speed = defaultCombatSpeed;
  const setSpeed = setDefaultCombatSpeed;
  const [playing, setPlaying] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const carry = useRef(0);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // A different fight: rewind everything rather than inheriting a stale tick.
  useEffect(() => {
    setTick(0);
    setPlaying(true);
    setSelectedId(null);
    setFocusId(null);
    carry.current = 0;
  }, [segment.combatId]);

  const spawns = useMemo(() => spawnsFromEvents(segment.events), [segment]);

  const feed = useMemo(
    () => interpretStream(streamOf(segment), nameResolver(names)),
    [segment, names],
  );

  const held = speed >= SKIM_FROM;

  /**
   * FOCUS: which unit the reader is following, or null for everyone.
   *
   * ⚠ Reset when the fight changes — a filter pinned to a unit who does not
   * appear in the next fight would show an empty record with no obvious cause.
   */
  const [focusId, setFocusId] = useState<string | null>(null);

  /**
   * Units worth offering as a filter, in the order they first act.
   *
   * Derived from the SPAWNS rather than the name map so the buttons match the
   * units actually present in THIS fight, and so a dead unit still gets a
   * button (you often want to review how someone died).
   */
  const focusable = useMemo<[string, string][]>(
    () => spawns.filter((sp) => sp.side === 'heroes').map((sp) => [sp.unitId, names.get(sp.unitId) ?? sp.name]),
    [spawns, names],
  );

  /**
   * The visible slice: up to the playhead, and narrowed to the focused unit.
   *
   * ⚠ MATCHES ON THE RESOLVED DISPLAY NAME, not the id. Beat text is already
   * name-resolved by `interpretStream`, so the id never appears in it — an
   * id-based filter silently matches nothing. Found by exactly that bug.
   */
  /**
   * ⚠ ONLY THE TICK WINDOW IS APPLIED HERE. Name filtering moved into
   * RecordFeed, because the record now groups a blow and its damage sub-line
   * into one ENTRY: filtering the flat list strips the damage off a hero's hit
   * and leaves the blow standing with no outcome.
   */
  const visibleLines = useMemo(
    () => feed.lines.filter((l) => l.tick <= tick),
    [feed.lines, tick],
  );
  const focusName = focusId === null ? null : (names.get(focusId) ?? focusId);
  /** Stable identity so RecordFeed's useMemo can actually cache. */
  const resolveName = useMemo(() => nameResolver(names), [names]);
  const done = tick >= segment.ticks;

  /**
   * PLAYBACK CLOCK — rAF-driven, wall-clock accurate (brief #23 UX).
   *
   * ⚠ THIS USED TO BE `setInterval(..., 100)`, WHICH IS 10 FPS BY
   * CONSTRUCTION. One sim tick is 100 ms, so stepping once per 100 ms of wall
   * time is correct ARITHMETIC but renders only ten frames a second — the
   * dots visibly stepped rather than moved, and at ¼× the interval fired ten
   * times a second to advance nothing at all. Steven reported it as "laggy
   * fps"; it was never a performance problem, it was the frame budget.
   *
   * requestAnimationFrame instead: the browser paints at its own refresh rate
   * and we advance the playhead by ELAPSED WALL TIME, not by a fixed step.
   * That also fixes two latent bugs in the interval version —
   *
   *   1. setInterval drifts and coalesces in background tabs, so a fight
   *      watched in an unfocused window ran slower than one watched in focus.
   *   2. The old `carry` accumulated per-FIRING, not per-millisecond, so any
   *      timer jitter silently changed playback speed.
   *
   * Determinism is untouched: this moves the PLAYHEAD over a finished event
   * stream. Nothing here feeds the sim.
   */
  useEffect(() => {
    if (!playing || done) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      // Clamp the delta so a tab-switch (or a breakpoint) cannot fast-forward
      // the whole fight in a single frame when the page comes back.
      const deltaMs = Math.min(now - last, 250);
      last = now;
      carry.current += (deltaMs / TICK_MS) * speed;
      const step = Math.floor(carry.current);
      if (step > 0) {
        carry.current -= step;
        setTick((t) => Math.min(t + step, segment.ticks));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, done, segment.ticks]);

  useEffect(() => {
    feedRef.current?.scrollTo(0, feedRef.current.scrollHeight);
  }, [tick]);

  const label = (id: string): string => names.get(id) ?? id;
  const state = fieldStateAt(spawns, segment.events, tick);
  const gauges = fieldGauges(state);
  const margin = fieldMarginalia(state, spawns, tick, segment.ticks, segment.result, siteLabel);
  const silencePct = Math.min(100, (gauges.silenceTicks / gauges.silenceWindow) * 100);

  const stepTo = (dir: 1 | -1): void => {
    setPlaying(false);
    const next = dir === 1
      ? segment.events.find((e) => e.tick > tick)?.tick ?? segment.ticks
      : [...segment.events].reverse().find((e) => e.tick < tick)?.tick ?? 0;
    setTick(next);
  };

  return (
    <div className="gv-sheet gv-sketch" style={{ ['--gv-tilt' as never]: '-0.2deg' }}>
      <span className="gv-pin gv-pin--left" />
      <span className="gv-pin gv-pin--right" />
      <h3 className="gv-head">
        The field <span className="gv-sub">{siteLabel}{segment.result ? ` — ${segment.result}` : ''}</span>
      </h3>

      <div className="gv-fieldgrid">
        <div className="gv-fieldwrap">
          <CombatField
            spawns={spawns}
            events={segment.events}
            tick={tick}
            held={held}
            heldNote={`at ${SPEED_LABEL[speed]} this fight is ${(segment.ticks / TICKS_PER_SECOND / speed).toFixed(1)} s — the record carries it`}
            selectedId={selectedId}
            onSelect={setSelectedId}
            labelFor={label}
          />
          <p className="gv-marg" style={{ margin: '2px 0 0', minHeight: 34 }}>{margin}</p>
        </div>

        <div>
          <span className="gv-gauge-label">the roster</span>
          <ul className="gv-roster">
            {spawns.map((s) => {
              const u = state.units.get(s.unitId)!;
              const ratio = Math.max(0, u.hp) / Math.max(1, s.maxHp);
              const gone = u.status === 'dead';
              return (
                <li
                  key={s.unitId}
                  aria-selected={selectedId === s.unitId}
                  className={gone ? 'gv-roster--gone' : undefined}
                  onClick={() => setSelectedId(selectedId === s.unitId ? null : s.unitId)}
                >
                  <RosterGlyph side={s.side} status={u.status} />
                  <span className="gv-roster-name">
                    {label(s.unitId)}
                    <small>
                      {gone ? 'slain' : u.status === 'down' ? 'DOWN' : u.targetId ? `→ ${label(u.targetId)}` : '—'}
                    </small>
                  </span>
                  {/* The number leads; the frozen-set bar only ever seconds it. */}
                  <span className="gv-roster-hp">
                    <b>{Math.max(0, u.hp)}/{s.maxHp}</b>
                    <span className="gv-roster-bar">
                      <i className={`gv-roster-bar--s${hpStep(u.hp, s.maxHp)}`} style={{ width: `${ratio * 100}%` }} />
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          {/* The stalemate answer: one derived number against the real window.
              Today it is the kiting read — silence plus motion is the R3 failure. */}
          <div className="gv-gauge">
            <span className="gv-gauge-label">
              silence — {gauges.silenceTicks} / {gauges.silenceWindow} ticks{' '}
              <em>({(gauges.silenceTicks / TICKS_PER_SECOND).toFixed(1)} s without a wound)</em>
            </span>
            <span className="gv-gauge-bar">
              <i
                className={silencePct > 60 ? 'gv-gauge--hot' : silencePct > 30 ? 'gv-gauge--warn' : undefined}
                style={{ width: `${silencePct}%` }}
              />
            </span>
          </div>
          <div className="gv-gauge">
            <span className="gv-gauge-label">
              target changes — {gauges.churn}{' '}
              <em>in the last {(gauges.churnWindowTicks / TICKS_PER_SECOND).toFixed(0)} s</em>
            </span>
            <span className="gv-gauge-bar">
              <i
                className={isThrashing(state, spawns, tick) ? 'gv-gauge--warn' : undefined}
                style={{ width: `${Math.min(100, (gauges.churn / Math.max(1, spawns.length * 2)) * 100)}%` }}
              />
            </span>
          </div>
        </div>
      </div>

      {/* Marked so a test can tell the fight's transport from the run's — a
          dungeon playback shows both, and they share speed labels. */}
      <div className="gv-choice" data-transport="combat" style={{ marginTop: 14 }}>
        <button className="gv-btn" onClick={() => { if (done) setTick(0); setPlaying(!playing); }}>
          {playing && !done ? 'Pause' : 'Play'}
        </button>
        <span className="gv-choice-label">watch</span>
        {WATCH_SPEEDS.map((s) => (
          <button key={s} className="gv-btn" disabled={speed === s} onClick={() => setSpeed(s)}>{SPEED_LABEL[s]}</button>
        ))}
        <span className="gv-choice-label">skim</span>
        {SKIM_SPEEDS.map((s) => (
          <button key={s} className="gv-btn" disabled={speed === s} onClick={() => setSpeed(s)}>{SPEED_LABEL[s]}</button>
        ))}
        <button className="gv-btn" onClick={() => stepTo(-1)}>◂ beat</button>
        <button className="gv-btn" onClick={() => stepTo(1)}>beat ▸</button>
        <span className="gv-choice-label">
          tick {tick}/{segment.ticks} · {(tick / TICKS_PER_SECOND).toFixed(1)}s of {(segment.ticks / TICKS_PER_SECOND).toFixed(1)}s
        </span>
      </div>

      <input
        type="range"
        className="gv-scrub"
        aria-label="Scrub the fight"
        min={0}
        max={segment.ticks}
        value={tick}
        onChange={(e) => { setPlaying(false); setTick(Number(e.target.value)); }}
      />

      <h3 className="gv-head" style={{ marginTop: 14 }}>
        The record <span className="gv-sub">this fight, beat by beat</span>
      </h3>
      {/*
        THE FOCUS FILTER (brief #24). Following one character through a fight
        used to mean scanning interleaved lines for a name; now it is one click.

        ⚠ FILTERS THE VIEW, NEVER THE RECORD. `feed.lines` is untouched — this
        only narrows what is DISPLAYED, so the underlying stream stays the
        complete deterministic account and no filter can hide an event from the
        contract snapshot.
      */}
      <div className="gv-choice" style={{ margin: '0 0 8px' }}>
        <span className="gv-choice-label">focus</span>
        <button className="gv-btn" disabled={focusId === null} onClick={() => setFocusId(null)}>
          Everything
        </button>
        {focusable.map(([id, label]) => (
          <button
            key={id}
            className="gv-btn"
            disabled={focusId === id}
            onClick={() => setFocusId(id)}
            data-focus-unit={id}
          >
            {label}
          </button>
        ))}
      </div>

      <div ref={feedRef} className="gv-feed">
        {visibleLines.length === 0 && (
          <div className="gv-beat" data-tone="inert"><em>Nothing for this filter yet.</em></div>
        )}
        <RecordFeed lines={visibleLines} spawns={spawns} nameFor={resolveName} focusName={focusName} />
      </div>
    </div>
  );
}

/** Side by FORM, matching the field: solid guild disc, hollow enemy ring. */
function RosterGlyph({ side, status }: { side: 'heroes' | 'enemies'; status: string }) {
  if (status === 'dead') {
    return (
      <svg className="gv-roster-glyph" viewBox="0 0 14 14" aria-hidden="true" width={14} height={14}>
        <line x1={2} y1={2} x2={12} y2={12} className="gv-field-glyph-stroke" />
        <line x1={12} y1={2} x2={2} y2={12} className="gv-field-glyph-stroke" />
      </svg>
    );
  }
  if (side === 'heroes') {
    return (
      <svg className="gv-roster-glyph" viewBox="0 0 14 14" aria-hidden="true" width={14} height={14}>
        <circle cx={7} cy={7} r={5.5} className={status === 'down' ? 'gv-field-hero gv-field-hero--down' : 'gv-field-hero'} />
        {status === 'down' && <line x1={1.5} y1={7} x2={12.5} y2={7} className="gv-field-glyph-stroke" />}
      </svg>
    );
  }
  return (
    <svg className="gv-roster-glyph" viewBox="0 0 14 14" aria-hidden="true" width={14} height={14}>
      <circle cx={7} cy={7} r={5.2} className="gv-field-foe" />
      <circle cx={7} cy={7} r={2} className="gv-field-foe-pip" />
    </svg>
  );
}

/**
 * A segment's events as a stream, so the existing feed interpreter reads it
 * unchanged. `cause` is deliberately dropped: those seqs address the SOURCE
 * stream, and the feed never walks the chain — carrying them would be a lie.
 */
function streamOf(segment: CombatSegment): EventStream {
  const s = new EventStream('dispatch', segment.combatId);
  for (const ev of segment.events) s.emit(ev.tick, ev.type, ev.data);
  return s;
}
