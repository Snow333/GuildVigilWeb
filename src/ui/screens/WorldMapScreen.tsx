/**
 * Screen 5 — World map (brief #5 §3): crude SVG — terrain cells, Haven, POI
 * tokens for current postings, the A* path drawn for the selected quest.
 * Terrain and paths come straight from worldMap()/travelPreview(); the UI
 * draws rectangles and asks no questions.
 */

import { WORLD } from '@content/world';
import { useGame } from '../state/GameProvider';

const CELL = 10;

const TERRAIN_FILL: Record<string, string> = {
  road: '#c2a06a',
  plains: '#9fbf6f',
  forest: '#4e7a3d',
  snow: '#e8ecef',
  mountain: '#6d6a66',
  water: '#4a7fb5',
};

export function WorldMapScreen({ questId }: { questId: number | null }) {
  const { session, nav } = useGame();
  if (!session) return null;
  const map = session.worldMap();
  const board = session.board();
  const active = session.activeQuest();
  const selected = questId ?? active?.questId ?? null;
  const plan = selected !== null ? session.travelPreview(selected) : null;

  return (
    <div>
      <h1>World map</h1>
      <p>
        <button onClick={() => nav({ kind: 'town' })}>◂ Town</button>{' '}
        <button onClick={() => nav({ kind: 'board' })}>Quest board</button>{' '}
        {selected !== null && <>selected: quest #{selected}{plan ? ` — ${plan.etaMinutes} min each way` : ''}</>}
      </p>
      <svg width={WORLD.width * CELL} height={WORLD.height * CELL} style={{ border: '1px solid #444' }}>
        {map.terrain.map((row, y) =>
          row.map((t, x) => (
            <rect key={`${x},${y}`} x={x * CELL} y={y * CELL} width={CELL} height={CELL} fill={TERRAIN_FILL[t] ?? '#f0f'} />
          )),
        )}
        {plan && (
          <polyline
            points={plan.path.map((p) => `${p.x * CELL + CELL / 2},${p.y * CELL + CELL / 2}`).join(' ')}
            fill="none" stroke="#ffffff" strokeWidth={2} strokeDasharray="4 3"
          />
        )}
        <rect x={WORLD.haven.x * CELL - 4} y={WORLD.haven.y * CELL - 4} width={CELL + 8} height={CELL + 8} fill="#d4b93c" stroke="#000" />
        <text x={WORLD.haven.x * CELL + CELL + 6} y={WORLD.haven.y * CELL + CELL} fontSize={12} fill="#000">HAVEN</text>
        {board.map((b) => (
          <g key={b.questId} style={{ cursor: 'pointer' }} onClick={() => nav({ kind: 'map', questId: b.questId })}>
            <circle
              cx={b.pos.x * CELL + CELL / 2} cy={b.pos.y * CELL + CELL / 2} r={7}
              fill={b.questId === selected ? '#e04040' : '#b06060'} stroke="#000"
            />
            <text x={b.pos.x * CELL + CELL} y={b.pos.y * CELL} fontSize={11} fill="#000">#{b.questId}</text>
          </g>
        ))}
      </svg>
      <p><small>Click a POI token to trace its route. Terrain: road/plains/forest/snow; mountains and water do not yield.</small></p>
    </div>
  );
}
