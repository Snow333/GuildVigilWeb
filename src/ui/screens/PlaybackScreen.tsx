/**
 * Screen 6 — Dispatch playback (brief #5 §3/§4): the dungeon graph SVG reveals
 * per explore.* events; the beat feed advances as 100 ms sim-ticks map to wall
 * time by the speed multiplier (1×/4×/16×); skip renders everything instantly.
 * The stream is a finished FACT — playback is pure presentation over it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATE_POOL } from '@sim/dungeon/pool';
import { bfsDepths, type DungeonTemplate } from '@sim/dungeon/graph';
import { interpretStream, type BeatLine, type BeatTone } from '../beats/interpret';
import { useGame, type ReplaySpeed } from '../state/GameProvider';

const TONE_COLOR: Record<BeatTone, string> = {
  good: '#0a7a2f', bad: '#b02020', loot: '#8a6d1a', travel: '#3a6ea5', system: '#666', neutral: '#222',
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
  const { session, lastLaunch, nav, defaultSpeed } = useGame();
  const [speed, setSpeed] = useState<ReplaySpeed>(defaultSpeed);
  const [playing, setPlaying] = useState(true);
  const [simTick, setSimTick] = useState(0);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const dispatch = lastLaunch?.record.dispatch ?? null;

  const feed = useMemo(() => {
    if (!dispatch || !session) return null;
    const names = new Map(session.roster().map((r) => [r.id, r.name]));
    return interpretStream(dispatch.stream, (id) => names.get(id) ?? id);
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
    return <div><h1>Playback</h1><p><em>No dispatch to replay.</em> <button onClick={() => nav({ kind: 'town' })}>◂ Town</button></p></div>;
  }

  if (!dispatch || !feed) {
    // Camp fights and road deaths have no dungeon stream — straight to the reckoning.
    return (
      <div>
        <h1>Dispatch — quest {lastLaunch.questName}</h1>
        <p>The mission resolved on the surface (no dungeon record).</p>
        <p><button onClick={() => nav({ kind: 'afterAction' })}>After-action report ▸</button></p>
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
    <div>
      <h1>Dispatch playback — quest {lastLaunch.questName}</h1>
      <p>
        tick {simTick}/{endTick} ·{' '}
        {([1, 4, 16] as ReplaySpeed[]).map((s) => (
          <button key={s} disabled={speed === s && playing} onClick={() => { setSpeed(s); setPlaying(true); }}>{s}×</button>
        ))}{' '}
        <button onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Resume'}</button>{' '}
        <button onClick={() => { setSimTick(endTick); setPlaying(false); }}>Skip ▸▸</button>{' '}
        <button disabled={!done} onClick={() => nav({ kind: 'afterAction' })}>
          After-action ▸{done ? '' : ' (finish or skip first)'}
        </button>
      </p>

      {template && layout && (
        <svg width={700} height={320} style={{ border: '1px solid #444' }}>
          {template.edges.map(([a, b], i) => {
            const pa = layout.get(a)!;
            const pb = layout.get(b)!;
            const seen = revealed.has(`${template.templateId}:r${a}`) && revealed.has(`${template.templateId}:r${b}`);
            return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={seen ? '#555' : '#ddd'} strokeWidth={2} />;
          })}
          {template.nodes.map((node) => {
            const p = layout.get(node.n)!;
            const roomId = `${template.templateId}:r${node.n}`;
            const seen = revealed.has(roomId);
            const fill = !seen ? '#f4f4f4' : cleared.has(roomId) ? '#9fd39f' : node.preset === 'boss' ? '#d38f8f' : '#cfd8ea';
            return (
              <g key={node.n}>
                <circle cx={p.x} cy={p.y} r={16} fill={fill} stroke={seen ? '#222' : '#ccc'} />
                <text x={p.x} y={p.y + 4} fontSize={10} textAnchor="middle" fill={seen ? '#000' : '#bbb'}>
                  {seen ? (node.preset === 'open' ? `r${node.n}` : node.preset) : '?'}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      <div ref={feedRef} style={{ height: 260, overflowY: 'scroll', border: '1px solid #444', padding: 8 }}>
        {visibleLines.map((l: BeatLine, i) => (
          <div key={i} style={{ color: TONE_COLOR[l.tone] }}>
            <small>{String(l.tick).padStart(5, ' ')}</small> {l.text}
          </div>
        ))}
        {done && <div><b>— end of record ({feed.lines.length} beats{feed.skipped > 0 ? `, ${feed.skipped} unknown events skipped` : ''}) —</b></div>}
      </div>
    </div>
  );
}
