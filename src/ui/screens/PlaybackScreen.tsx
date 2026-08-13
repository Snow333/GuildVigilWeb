/**
 * Screen 6 — Dispatch playback (brief #5 §3/§4): the dungeon graph SVG reveals
 * per explore.* events; the beat feed advances as 100 ms sim-ticks map to wall
 * time by the speed multiplier (1×/4×/16×); skip renders everything instantly.
 * The stream is a finished FACT — playback is pure presentation over it.
 *
 * Brief #8 rollout step 6: the run is written live at the desk — the dungeon
 * sketch is ink on fresh vellum in the chart's hand (unentered rooms dashed
 * "?", cleared rooms slashed through, boss ringed twice), and the feed is the
 * scribe's ruled running record. Tone stays in the ink, not in color: bad
 * beats press harder (bold), loot slants (italic), system fades to muted —
 * the words themselves carry the state. Speed choices read as pressed buttons.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATE_POOL } from '@sim/dungeon/pool';
import { bfsDepths, type DungeonTemplate } from '@sim/dungeon/graph';
import { interpretStream, type BeatLine } from '../beats/interpret';
import { nameResolver, namesFromStream } from '../beats/names';
import { combatSegments, type CombatSegment } from '@sim/core/events/segments';
import { CombatViewer } from './CombatViewer';
import { useGame, type ReplaySpeed } from '../state/GameProvider';

/**
 * Brief #12: a fight the player can open, wherever it happened. Dungeon fights
 * segment out of the dispatch stream they were already absorbed into; surface
 * fights arrive on `QuestRecord.fights`. One shape, so the mounting below does
 * not care which carrier a fight came from.
 */
interface Fight {
  key: string;
  segment: CombatSegment;
  siteLabel: string;
  /** Position of the fight along the dispatch's ticks, for the strip. */
  strip: { start: number; end: number } | null;
}

/**
 * `t_small_knoll:r7` is an id, not a place. The sheet says the place; the strip's
 * tooltip and the graph still carry the id for anyone matching them up.
 */
const roomName = (roomId: string): string => {
  const room = roomId.includes(':') ? roomId.slice(roomId.indexOf(':') + 1) : roomId;
  return /^r\d+$/.test(room) ? `room ${room}` : `the ${room}`;
};

/** Column-by-BFS-depth layout — geometry is presentation's problem, so here it is. */
function layoutTemplate(t: DungeonTemplate): Map<number, { x: number; y: number }> {
  const depths = bfsDepths(t.nodes);
  const byDepth = new Map<number, number[]>();
  for (const node of t.nodes) {
    const d = depths[node.n] ?? 0;
    byDepth.set(d, [...(byDepth.get(d) ?? []), node.n]);
  }
  const pos = new Map<number, { x: number; y: number }>();
  for (const [d, nodes] of byDepth) {
    nodes.forEach((n, i) => pos.set(n, { x: 60 + d * 90, y: 40 + i * 64 }));
  }
  return pos;
}

export function PlaybackScreen() {
  // The transport IS the player-wide setting — there is no local copy. Brief #8:
  // one meaning per affordance. These buttons used to set a session-only speed
  // while the identical buttons in Settings set the persisted default, so the
  // same control meant two things depending on which sheet you were looking at.
  const { session, lastLaunch, nav, defaultSpeed, setDefaultSpeed } = useGame();
  const speed = defaultSpeed;
  const [playing, setPlaying] = useState(true);
  const [simTick, setSimTick] = useState(0);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const [openFight, setOpenFight] = useState(0);

  const dispatch = lastLaunch?.record.dispatch ?? null;
  const surface = lastLaunch?.record.fights ?? null;

  // Names resolve from every stream in the record, so a surface fight labels
  // its units even when there is no dungeon stream at all.
  const names = useMemo(() => {
    const roster = session ? new Map(session.roster().map((r) => [r.id, r.name])) : new Map<string, string>();
    const merged = new Map<string, string>();
    for (const stream of [...(surface ?? []).map((f) => f.stream), ...(dispatch ? [dispatch.stream] : [])]) {
      for (const [id, name] of namesFromStream(stream)) merged.set(id, name);
    }
    for (const [id, name] of roster) merged.set(id, name);
    return merged;
  }, [dispatch, surface, session]);

  const fights = useMemo<Fight[]>(() => {
    const out: Fight[] = [];
    for (const f of surface ?? []) {
      const seg = combatSegments(f.stream)[0];
      if (seg) out.push({ key: f.combatId, segment: seg, siteLabel: f.label, strip: null });
    }
    if (dispatch) {
      for (const seg of combatSegments(dispatch.stream)) {
        out.push({ key: seg.combatId, segment: seg, siteLabel: seg.roomId, strip: { start: seg.startTick, end: seg.endTick } });
        // (siteLabel keeps the room id — `roomName` below is what the sheet shows.)
      }
    }
    return out;
  }, [dispatch, surface]);

  const feed = useMemo(() => {
    if (!dispatch || !session) return null;
    // Brief #12: names come from the stream's own spawn facts, with the roster
    // layered over them. Before this, every enemy printed its raw instance id.
    const roster = new Map(session.roster().map((r) => [r.id, r.name]));
    return interpretStream(dispatch.stream, nameResolver(namesFromStream(dispatch.stream, roster)));
  }, [dispatch, session]);

  const endTick = useMemo(
    () => (dispatch ? Math.max(...dispatch.stream.all().map((e) => e.tick), 0) : 0),
    [dispatch],
  );

  const template = useMemo(() => {
    if (!dispatch) return null;
    const entered = dispatch.stream.byType('dispatch.dungeon_entered')[0];
    return entered ? TEMPLATE_POOL.get(entered.data.templateId) ?? null : null;
  }, [dispatch]);

  const layout = useMemo(() => (template ? layoutTemplate(template) : null), [template]);

  // The sketch sheet fits its dungeon — a linear delve gets a short strip of
  // vellum, a branching one grows taller; no empty parchment either way.
  const sketchSize = useMemo(() => {
    if (!layout) return { w: 700, h: 320 };
    const xs = [...layout.values()].map((p) => p.x);
    const ys = [...layout.values()].map((p) => p.y);
    return { w: Math.max(...xs) + 70, h: Math.max(...ys) + 50 };
  }, [layout]);

  // 100 ms sim-ticks → wall time by multiplier: advance `speed` ticks every 100 ms.
  useEffect(() => {
    if (!playing || simTick >= endTick) return;
    const id = setInterval(() => setSimTick((t) => Math.min(t + speed, endTick)), 100);
    return () => clearInterval(id);
  }, [playing, speed, simTick >= endTick, endTick]);

  useEffect(() => {
    feedRef.current?.scrollTo(0, feedRef.current.scrollHeight);
  }, [simTick]);

  if (!session || !lastLaunch) {
    return (
      <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
        <div className="gv-run">
          <h1>Playback</h1>
          <p>
            <em style={{ color: '#d8bd85' }}>No dispatch to replay.</em>{' '}
            <button className="gv-btn" onClick={() => nav({ kind: 'town' })}>◂ Town</button>
          </p>
        </div>
      </div>
    );
  }

  if (!dispatch || !feed) {
    // Brief #12: a surface mission has no dungeon sketch, so the field takes its
    // place. Only a mission with no fight at all still goes straight to the
    // reckoning — the "no dungeon record" dead end is gone.
    const only = fights[openFight] ?? fights[0];
    return (
      <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
        <div className="gv-run">
          <h1>Dispatch — quest {lastLaunch.questName}</h1>
          {fights.length > 1 && (
            <div className="gv-choice" style={{ marginBottom: 14 }}>
              <span className="gv-choice-label">the fights</span>
              {fights.map((f, i) => (
                <button key={f.key} className="gv-btn" disabled={i === openFight} onClick={() => setOpenFight(i)}>
                  {f.siteLabel}
                </button>
              ))}
            </div>
          )}
          {only ? (
            <CombatViewer segment={only.segment} siteLabel={only.siteLabel} names={names} />
          ) : (
            <div className="gv-sheet" style={{ maxWidth: 520 }}>
              <p style={{ margin: '0 0 10px' }}>The mission resolved without a fight.</p>
            </div>
          )}
          <p style={{ margin: '14px 0 0' }}>
            <button className="gv-btn" onClick={() => nav({ kind: 'afterAction' })}>After-action report ▸</button>
          </p>
        </div>
      </div>
    );
  }

  const visibleLines = feed.lines.filter((l) => l.tick <= simTick);
  const revealed = new Set<string>();
  const cleared = new Set<string>();
  for (const ev of dispatch.stream.all()) {
    if (ev.tick > simTick) break;
    if (ev.type === 'explore.area_revealed') for (const r of ev.data.roomIds) revealed.add(r);
    if (ev.type === 'explore.room_entered') revealed.add(ev.data.roomId);
    if (ev.type === 'explore.room_cleared') cleared.add(ev.data.roomId);
  }
  const done = simTick >= endTick;

  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-run">
        <h1>Dispatch playback — quest {lastLaunch.questName}</h1>
        <div className="gv-choice" style={{ marginBottom: 16 }}>
          <span className="gv-choice-label">tick {simTick}/{endTick}</span>
          {([1, 4, 16] as ReplaySpeed[]).map((s) => (
            <button
              key={s}
              className="gv-btn"
              disabled={speed === s && playing}
              onClick={() => { setDefaultSpeed(s); setPlaying(true); }}
            >
              {s}×
            </button>
          ))}
          <button className="gv-btn" onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Resume'}</button>
          <button className="gv-btn" onClick={() => { setSimTick(endTick); setPlaying(false); }}>Skip ▸▸</button>
          {/*
            Ungated deliberately. The old guard required Skip first — but Skip sat
            immediately to its left doing exactly the thing the guard asked for, so
            it protected nothing: the stream is a finished fact and the after-action
            reads the record, not the playhead. The surface-fight branch of this
            same screen already renders this button ungated.
          */}
          <button
            className="gv-btn"
            onClick={() => { setSimTick(endTick); setPlaying(false); nav({ kind: 'afterAction' }); }}
          >
            After-action ▸
          </button>
        </div>

        {template && layout && (
          <div className="gv-sheet gv-sketch" style={{ ['--gv-tilt' as never]: '-0.25deg' }}>
            <span className="gv-pin gv-pin--left" />
            <span className="gv-pin gv-pin--right" />
            <h3 className="gv-head">The delve <span className="gv-sub">sketched as the party moves</span></h3>
            <svg
              viewBox={`0 0 ${sketchSize.w} ${sketchSize.h}`}
              style={{ maxWidth: sketchSize.w }}
              role="img"
              aria-label="Dungeon sketch, revealed room by room"
            >
              {template.edges.map(([a, b], i) => {
                const pa = layout.get(a)!;
                const pb = layout.get(b)!;
                const seen = revealed.has(`${template.templateId}:r${a}`) && revealed.has(`${template.templateId}:r${b}`);
                return (
                  <line
                    key={i}
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    className="gv-chart-soft"
                    strokeWidth={seen ? 1.4 : 1}
                    strokeDasharray={seen ? undefined : '3 5'}
                    opacity={seen ? 0.9 : 0.35}
                  />
                );
              })}
              {template.nodes.map((node) => {
                const p = layout.get(node.n)!;
                const roomId = `${template.templateId}:r${node.n}`;
                const seen = revealed.has(roomId);
                const isCleared = cleared.has(roomId);
                return (
                  <g key={node.n}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={16}
                      className={seen ? 'gv-chart-ink' : 'gv-chart-soft'}
                      strokeWidth={seen ? 1.6 : 1}
                      strokeDasharray={seen ? undefined : '3 4'}
                      opacity={seen ? 1 : 0.5}
                    />
                    {seen && node.preset === 'boss' && (
                      <circle cx={p.x} cy={p.y} r={20} className="gv-chart-ink" strokeWidth={0.8} />
                    )}
                    {seen && roomId === fights[openFight]?.siteLabel && (
                      <circle cx={p.x} cy={p.y} r={23} className="gv-chart-red" strokeWidth={1.8} />
                    )}
                    {isCleared && (
                      <line x1={p.x - 11} y1={p.y + 11} x2={p.x + 11} y2={p.y - 11} className="gv-chart-ink" strokeWidth={1.2} />
                    )}
                    <text
                      x={p.x}
                      y={p.y + 4}
                      fontSize={10}
                      textAnchor="middle"
                      className={seen ? 'gv-chart-fill-ink gv-chart-halo' : 'gv-chart-fill-soft'}
                      opacity={seen ? 1 : 0.6}
                    >
                      {seen ? (node.preset === 'open' ? `r${node.n}` : node.preset) : '?'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {fights.length > 0 && (
          <div className="gv-sheet" style={{ ['--gv-tilt' as never]: '0.15deg' }}>
            <span className="gv-pin" />
            <h3 className="gv-head">
              The day&apos;s record <span className="gv-sub">filled blocks are fights — open one to watch it</span>
            </h3>
            <div className="gv-strip">
              {fights.map((f, i) => {
                const at = f.strip ?? { start: 0, end: f.segment.ticks };
                const span = Math.max(1, endTick);
                return (
                  <button
                    key={f.key}
                    type="button"
                    className={`gv-strip-seg${i === openFight ? ' gv-strip-seg--open' : ''}`}
                    style={{ left: `${(at.start / span) * 100}%`, width: `${Math.max(2, ((at.end - at.start) / span) * 100)}%` }}
                    onClick={() => {
                      setOpenFight(i);
                      // Move the run to the fight: the sketch reveals up to it, the
                      // scribe's record catches up, and the red ring never lands on
                      // a room the party has not entered yet.
                      setSimTick(Math.min(endTick, at.end));
                      setPlaying(false);
                    }}
                    title={`${f.siteLabel} — ${f.segment.ticks} ticks`}
                  >
                    <b>FIGHT {i + 1}</b>
                  </button>
                );
              })}
              <span className="gv-strip-play" style={{ left: `${(simTick / Math.max(1, endTick)) * 100}%` }} />
            </div>
          </div>
        )}

        {/* The graph answers WHERE; the field answers what happened there. */}
        {fights[openFight] && (
          <CombatViewer
            segment={fights[openFight]!.segment}
            siteLabel={roomName(fights[openFight]!.siteLabel)}
            names={names}
          />
        )}

        <div className="gv-sheet" style={{ ['--gv-tilt' as never]: '0.3deg' }}>
          <span className="gv-pin" />
          <h3 className="gv-head">The record <span className="gv-sub">the scribe keeps pace</span></h3>
          <div ref={feedRef} className="gv-feed">
            {visibleLines.map((l: BeatLine, i) => (
              <div key={i} className="gv-beat" data-tone={l.tone}>
                <small>{String(l.tick).padStart(5, ' ')}</small> {l.text}
              </div>
            ))}
            {done && (
              <div>
                <b>— end of record ({feed.lines.length} beats{feed.skipped > 0 ? `, ${feed.skipped} unknown events skipped` : ''}) —</b>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
