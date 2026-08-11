/**
 * Screen 5 — the chart (brief #8 rollout step 5): the working survey chart,
 * procedural inline SVG from real sim data. Terrain glyphs read the generated
 * map (worldChart.ts, density locked at round 03), POI X-marks are board()
 * postings, the red dashed route is travelPreview(), pressure washes pair a
 * frozen status color with a red-ink annotation (color never stands alone),
 * and unsurveyed objectives mark "?" — no name in text, tooltip, or aria.
 * The UI computes no rules: discovery, pressure, anchors, and paths are all
 * session queries; this file only inks them.
 */

import { WORLD } from '@content/world';
import { REGION_IDS, regionAnchors } from '@sim/campaign/session';
import { useGame } from '../state/GameProvider';
import { chartFeatures } from './worldChart';

/** Px per cell: 80×60 cells → a 640×480 chart plane. */
const SX = 8;
const SY = 8;
const W = WORLD.width * SX;
const H = WORLD.height * SY;

const cx = (x: number): number => (x + 0.5) * SX;
const cy = (y: number): number => (y + 0.5) * SY;

/** Long names truncate on the chart; the number never does (brief edge case). */
const shorten = (name: string): string => (name.length > 24 ? `${name.slice(0, 23)}…` : name);

/** Keep centered chart text inside the neatline (approximate glyph metrics). */
const clampX = (x: number, text: string, fontSize: number, letterSpacing = 0): number => {
  const half = (text.length * (fontSize * 0.62 + letterSpacing)) / 2;
  return Math.min(Math.max(x, 20 + half), W - 20 - half);
};

export function WorldMapScreen({ questId }: { questId: number | null }) {
  const { session, nav } = useGame();
  if (!session) return null;

  const map = session.worldMap();
  const board = session.board();
  const active = session.activeQuest();
  const week = session.currentWeek();
  const selected = questId ?? active?.questId ?? null;
  const plan = selected !== null ? session.travelPreview(selected) : null;
  const features = chartFeatures(map);

  // Washes render ONLY tier ≥ 1 and ONLY with their red-ink annotation — if the
  // label ever came up empty the wash is dropped, never shown label-less
  // (brief edge case: color never stands alone; the watch report is the twin).
  const washes = REGION_IDS.map((id) => {
    const p = session.pressure(id);
    const anchor = regionAnchors().find((a) => a.regionId === id)!;
    return { ...p, anchor, annotation: `${p.tierName.toLowerCase()} — pressure ${p.score}` };
  }).filter((r) => r.tier >= 1 && r.annotation.length > 0);

  const routeD = plan
    ? plan.path.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(p.x)} ${cy(p.y)}`).join(' ')
    : null;
  const routeMid = plan ? plan.path[Math.floor(plan.path.length / 2)]! : null;

  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-chartwrap">
        <h1>The chart — week {week}</h1>
        <p style={{ margin: '0 0 18px' }}>
          <button className="gv-btn" onClick={() => nav({ kind: 'town' })}>◂ Town</button>{' '}
          <button className="gv-btn" onClick={() => nav({ kind: 'board' })}>Quest board</button>{' '}
          {selected !== null && !plan && (
            <span className="gv-marg">no route to quest #{selected} — the posting is gone</span>
          )}
        </p>

        <div className="gv-sheet gv-chart" style={{ ['--gv-tilt' as never]: '-0.25deg' }}>
          <span className="gv-pin gv-pin--left" />
          <span className="gv-pin gv-pin--right" />
          <h3 className="gv-head">The frontier <span className="gv-sub">the working chart</span></h3>

          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hand-drawn survey chart of the frontier">
            <defs>
              <marker id="gv-xm" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7">
                <path d="M2 2 L8 8 M8 2 L2 8" className="gv-chart-red" strokeWidth={1.8} />
              </marker>
            </defs>

            {/* neatline + graticule ticks */}
            <rect x={8} y={8} width={W - 16} height={H - 16} className="gv-chart-soft" strokeWidth={1.6} />
            <rect x={13} y={13} width={W - 26} height={H - 26} className="gv-chart-soft" strokeWidth={0.6} />
            <g className="gv-chart-soft" strokeWidth={0.8}>
              {[1, 2, 3].map((i) => (
                <g key={i}>
                  <line x1={8} y1={(H / 4) * i} x2={14} y2={(H / 4) * i} />
                  <line x1={W - 14} y1={(H / 4) * i} x2={W - 8} y2={(H / 4) * i} />
                  <line x1={(W / 4) * i} y1={8} x2={(W / 4) * i} y2={14} />
                </g>
              ))}
            </g>

            {/* cartouche */}
            <g transform="translate(26,24)">
              <rect width={150} height={40} className="gv-chart-cartouche" strokeWidth={1.4} />
              <rect x={3} y={3} width={144} height={34} className="gv-chart-ink" strokeWidth={0.5} />
              <text x={75} y={18} textAnchor="middle" fontSize={11} letterSpacing={2} className="gv-chart-text">
                THE FRONTIER
              </text>
              <text x={75} y={31} textAnchor="middle" fontSize={7.5} fontStyle="italic" className="gv-chart-fill-soft">
                as surveyed by the guild · week {week}
              </text>
            </g>

            {/* coast + sea stipple + sea name (real water cells) */}
            <path
              d={features.coast.map((s) => `M${s.x1 * SX} ${s.y1 * SY} L${s.x2 * SX} ${s.y2 * SY}`).join(' ')}
              className="gv-chart-ink"
              strokeWidth={1.4}
              strokeLinecap="round"
              opacity={0.85}
            />
            <g className="gv-chart-fill-soft" opacity={0.5}>
              {features.stipple.map((p, i) => (
                <circle key={i} cx={cx(p.x)} cy={cy(p.y)} r={0.9} />
              ))}
            </g>
            {features.sea && (
              <text
                x={cx(features.sea.x)}
                y={cy(features.sea.y)}
                textAnchor="middle"
                fontSize={10}
                fontStyle="italic"
                className="gv-chart-fill-soft"
                opacity={0.8}
                transform={features.sea.vertical ? `rotate(90 ${cx(features.sea.x)} ${cy(features.sea.y)})` : undefined}
              >
                the grey water
              </text>
            )}

            {/* hachured mountains */}
            {features.mountains.map((p, i) => (
              <g key={i} transform={`translate(${cx(p.x)},${cy(p.y)})`}>
                <g className="gv-chart-ink" strokeWidth={1.3}>
                  <path d="M-10 6 L-2 -8 L6 6" />
                  <path d="M2 7 L8 -2 L14 7" />
                </g>
                <path d="M-4 -4 l5 8 M7 0 l4 6" className="gv-chart-ink" strokeWidth={0.5} opacity={0.5} />
              </g>
            ))}

            {/* forest masses */}
            {features.forests.map((p, i) => (
              <g key={i} transform={`translate(${cx(p.x)},${cy(p.y)})`} className="gv-chart-forest" strokeWidth={1.1}>
                <circle cx={-6} cy={0} r={6} />
                <circle cx={5} cy={-4} r={5} />
                <circle cx={4} cy={6} r={5} />
              </g>
            ))}

            {/* snowfields */}
            {features.snowfields.map((p, i) => (
              <g key={i} transform={`translate(${cx(p.x)},${cy(p.y)})`} className="gv-chart-soft" strokeWidth={1} opacity={0.7}>
                <path d="M-9 2 l4 -5 l4 5 M2 4 l3 -4 l3 4" />
              </g>
            ))}

            {/* roads (surveyed, faint) */}
            {features.roads.map(([a, b], i) => (
              <line
                key={i}
                x1={cx(a.x)}
                y1={cy(a.y)}
                x2={cx(b.x)}
                y2={cy(b.y)}
                className="gv-chart-soft"
                strokeWidth={1}
                strokeDasharray="2 4"
                opacity={0.7}
              />
            ))}

            {/* Haven keep */}
            <g transform={`translate(${cx(WORLD.haven.x)},${cy(WORLD.haven.y)})`}>
              <rect x={-9} y={-8} width={18} height={14} className="gv-chart-ink" strokeWidth={1.6} />
              <path
                d="M-9 -8 l0 -5 l4 0 l0 3 l5 0 l0 -3 l4 0 l0 3 l5 0 l0 -3 l4 0 l0 5"
                className="gv-chart-ink"
                strokeWidth={1.4}
              />
              <text x={0} y={26} textAnchor="middle" fontSize={12} fontStyle="italic" className="gv-chart-fill-ink">
                HAVEN
              </text>
            </g>

            {/* region names (authored, from the session) */}
            {regionAnchors().map((a) => {
              const label = session.regionName(a.regionId).toUpperCase();
              const fs = a.regionId === 'region_haven' ? 11 : 13;
              return (
                <text
                  key={a.regionId}
                  x={clampX(a.cx * SX, label, fs, 4)}
                  y={a.regionId === 'region_haven' ? (a.cy + a.ry * 0.9) * SY : (a.cy + a.ry * 0.55) * SY}
                  textAnchor="middle"
                  fontSize={fs}
                  letterSpacing={4}
                  className="gv-chart-fill-soft"
                  opacity={0.85}
                >
                  {label}
                </text>
              );
            })}

            {/* pressure washes — frozen status color at low opacity, ALWAYS
                paired with its red-ink annotation (the watch report is the
                labeled numeric twin) */}
            {washes.map((r) => (
              <g key={r.regionId} data-wash="" data-region-id={r.regionId} data-tier={r.tier}>
                <ellipse
                  className={`gv-chart-wash gv-chart-wash--s${r.tier}`}
                  cx={r.anchor.cx * SX}
                  cy={r.anchor.cy * SY}
                  rx={r.anchor.rx * SX}
                  ry={r.anchor.ry * SY}
                />
                <text
                  data-wash-label=""
                  x={clampX(r.anchor.cx * SX, r.annotation, 9.5)}
                  y={
                    r.regionId === 'region_haven'
                      ? (r.anchor.cy + r.anchor.ry * 0.6) * SY
                      : (r.anchor.cy - r.anchor.ry * 0.35) * SY
                  }
                  textAnchor="middle"
                  fontSize={9.5}
                  className="gv-chart-redtext"
                  opacity={0.85}
                >
                  {r.annotation}
                </text>
              </g>
            ))}

            {/* active route in red dashed ink (real A* path) */}
            {routeD && routeMid && plan && (
              <g data-route="">
                <path d={routeD} className="gv-chart-red" strokeWidth={1.5} strokeDasharray="6 5" markerEnd="url(#gv-xm)" />
                <text
                  x={clampX(cx(routeMid.x), `${plan.etaMinutes} min each way`, 10.5)}
                  y={cy(routeMid.y) - 10}
                  textAnchor="middle"
                  fontSize={10.5}
                  className="gv-chart-redtext"
                >
                  {plan.etaMinutes} min each way
                </text>
              </g>
            )}

            {/* board POIs in red ink; unsurveyed objectives are "?" — the name
                appears in NO text, tooltip, or aria until the guild surveys it */}
            {board.map((b) => {
              const px = cx(b.pos.x);
              const py = cy(b.pos.y);
              const sel = b.questId === selected;
              return (
                <g
                  key={b.questId}
                  data-map-poi=""
                  data-quest-id={b.questId}
                  data-discovered={b.discovered ? 'true' : 'false'}
                  {...(sel ? { 'data-selected': '' } : {})}
                  role="button"
                  tabIndex={0}
                  aria-label={b.discovered ? `quest #${b.questId} ${b.name}` : `quest #${b.questId} — an unsurveyed objective`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => nav({ kind: 'map', questId: b.questId })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      nav({ kind: 'map', questId: b.questId });
                    }
                  }}
                >
                  {b.discovered && <title>#{b.questId} {b.name}</title>}
                  <path
                    d={`M${px - 4} ${py - 4} L${px + 4} ${py + 4} M${px + 4} ${py - 4} L${px - 4} ${py + 4}`}
                    className="gv-chart-red"
                    strokeWidth={sel ? 2.6 : 1.8}
                  />
                  <text x={px + 7} y={py + 4} fontSize={10.5} className="gv-chart-redtext">
                    {b.discovered ? `#${b.questId} ${shorten(b.name)}` : '?'}
                  </text>
                </g>
              );
            })}

            {/* compass rose */}
            <g transform={`translate(${W - 56},60)`} className="gv-chart-fill-ink">
              <circle r={17} className="gv-chart-ink" strokeWidth={1} />
              <circle r={12} className="gv-chart-ink" strokeWidth={0.5} />
              <path d="M0 -15 L4 0 L0 15 L-4 0 Z" />
              <path d="M-15 0 L0 -3 L15 0 L0 3 Z" opacity={0.55} />
              <text y={-21} textAnchor="middle" fontSize={9}>N</text>
            </g>

            {/* scale bar: ten cells of the real grid */}
            <g transform={`translate(30,${H - 26})`}>
              <rect x={-8} y={-9} width={10 * SX + 16} height={28} className="gv-chart-cartouche" strokeWidth={0} stroke="none" opacity={0.9} />
              <g className="gv-chart-ink">
                <line x1={0} y1={0} x2={10 * SX} y2={0} strokeWidth={1.4} />
                <line x1={0} y1={-4} x2={0} y2={4} strokeWidth={1} />
                <line x1={5 * SX} y1={-3} x2={5 * SX} y2={3} strokeWidth={1} />
                <line x1={10 * SX} y1={-4} x2={10 * SX} y2={4} strokeWidth={1} />
              </g>
              <text x={5 * SX} y={14} textAnchor="middle" fontSize={9} className="gv-chart-fill-soft">
                ten leagues
              </text>
            </g>
          </svg>

          <p className="gv-chart-note">
            Peaks are mountains, groves forest, chevrons snowfield, dashed lines road, dots open
            water. Red X marks a posting — click one to trace its route; ? is a destination the
            guild has not surveyed. Washes carry their pressure in writing; the watch report holds
            the numbers.
          </p>
        </div>
      </div>
    </div>
  );
}
