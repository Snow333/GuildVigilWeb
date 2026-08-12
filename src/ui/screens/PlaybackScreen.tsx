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
import { useGame, type ReplaySpeed } from '../state/GameProvider';

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
  const { session, lastLaunch, nav, defaultSpeed } = useGame();
  const [speed, setSpeed] = useState<ReplaySpeed>(defaultSpeed);
  const [playing, setPlaying] = useState(true);
  const [simTick, setSimTick] = useState(0);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const dispatch = lastLaunch?.record.dispatch ?? null;

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
    // Camp fights and road deaths have no dungeon stream — straight to the reckoning.
    return (
      <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
        <div className="gv-run">
          <h1>Dispatch — quest {lastLaunch.questName}</h1>
          <div className="gv-sheet" style={{ maxWidth: 520 }}>
            <p style={{ margin: '0 0 10px' }}>The mission resolved on the surface (no dungeon record).</p>
            <p style={{ margin: 0 }}>
              <button className="gv-btn" onClick={() => nav({ kind: 'afterAction' })}>After-action report ▸</button>
            </p>
          </div>
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
              onClick={() => { setSpeed(s); setPlaying(true); }}
            >
              {s}×
            </button>
          ))}
          <button className="gv-btn" onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Resume'}</button>
          <button className="gv-btn" onClick={() => { setSimTick(endTick); setPlaying(false); }}>Skip ▸▸</button>
          <button className="gv-btn" disabled={!done} onClick={() => nav({ kind: 'afterAction' })}>
            After-action ▸{done ? '' : ' (finish or skip first)'}
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
