/**
 * The field — brief #12 §4. A plan view of one fight, drawn in the chart's hand
 * on the same vellum as the delve sketch. Geometry only: every value it inks
 * comes from `fieldReading.ts` or from `ARENA`.
 *
 * The grammar it must keep (brief #8 is normative for all UI):
 *  - SIDE IS CARRIED BY FORM, never colour. Guild units are solid ink discs;
 *    enemies are hollow with a centre pip. The frozen status set only ever
 *    tints an HP bar, and that bar always sits beside the number.
 *  - RED INK STAYS IN THE MARGIN. Nothing here draws red; `fieldMarginalia`
 *    supplies the line the margin says it in.
 *  - FLAT MODE KEEPS EVERY FACT. Nothing in this component is ambience — grid,
 *    rules, scale bar, names, HP numbers and bars, targeting lines are all
 *    data, so flat mode has only the sheet furniture around them to strip.
 *
 * Positions between waypoints are DRAWN, NOT RECORDED (decision D1) — see
 * `fieldReading.ts`. No distance or judgement is ever derived from them.
 */

import { ARENA, ENGAGEMENT_RANGE } from '@content/combat';
import type { SimEvent } from '@sim/core/events/types';
import {
  buildTracks, fieldStateAt, hpStep, labelLanes, positionAt, FEET_PER_UNIT, type SpawnFact,
} from './fieldReading';

/**
 * Sheet geometry. The plan is drawn at ONE UNIFORM SCALE and the sheet's height
 * follows the room, rather than the room being stretched to fit a fixed box.
 *
 * ⚠ This is the change brief #19 §6 asked for. The old geometry took SX and SY
 * independently from a hard 700 × 520 sheet, which was invisible only because
 * ARENA's 14:10 happened to match it. The room is now 20 × 20 (§9), and two
 * scales would ink a square room as a squashed rectangle — so a square on the
 * page would stop being a square on the ground while the margin still said
 * `1 SQUARE = 5 FT`. Presentation may ease a position (decision D1); it may not
 * lie about a distance.
 */
const VIEW = { w: 700, padL: 44, padR: 44, padT: 30, padB: 80 } as const;
/** One scale for both axes: a square of ground is a square on the sheet. */
const S = (VIEW.w - VIEW.padL - VIEW.padR) / ARENA.width;
const SX = S;
const SY = S;
/** The sheet is as tall as the room needs, plus the margins that carry the rules. */
const VIEW_H = VIEW.padT + ARENA.height * S + VIEW.padB;
const px = (x: number): number => VIEW.padL + x * SX;
const py = (y: number): number => VIEW.padT + y * SY;

/** A label block is name + hp + bar; lanes never pack tighter than this. */
const LANE_SPACING = 34;
/** Below this the label sits on its glyph and needs no leader. */
const LEADER_THRESHOLD = 7;

const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);

export interface CombatFieldProps {
  spawns: readonly SpawnFact[];
  events: readonly SimEvent[];
  tick: number;
  /** Held: 4×/16× stop animating and the record carries the fight (decision D2). */
  held?: boolean;
  heldNote?: string;
  selectedId?: string | null;
  onSelect?: (unitId: string | null) => void;
  /**
   * Display name for a unit. Defaults to the spawn's own name, but the caller
   * passes the stream resolver so four goblins read ɪ / ɪɪ / ɪɪɪ / ɪᴠ on the
   * field exactly as they do in the roster and the feed.
   */
  labelFor?: (unitId: string) => string;
}

export function CombatField({ spawns, events, tick, held, heldNote, selectedId, onSelect, labelFor }: CombatFieldProps) {
  const tracks = buildTracks(spawns, events);
  const state = fieldStateAt(spawns, events, tick);

  const placed = spawns.map((spawn) => ({
    spawn,
    unit: state.units.get(spawn.unitId)!,
    pos: positionAt(tracks.get(spawn.unitId), tick),
  }));
  const at = new Map(placed.map((p) => [p.spawn.unitId, p.pos]));

  // Labels are stacked per side, so a scrum in the middle stays legible however
  // many units are in it. Nothing here assumes a side size.
  const lanes = new Map<string, number>();
  for (const side of ['heroes', 'enemies'] as const) {
    const laneMap = labelLanes(
      placed.filter((p) => p.spawn.side === side).map((p) => ({ unitId: p.spawn.unitId, y: py(p.pos.y) })),
      LANE_SPACING,
      py(ARENA.height) - 6,
    );
    for (const [id, y] of laneMap) lanes.set(id, y);
  }

  const selected = selectedId ? placed.find((p) => p.spawn.unitId === selectedId) ?? null : null;
  const guild = spawns.filter((s) => s.side === 'heroes').length;
  const foes = spawns.length - guild;

  return (
    <svg
      className="gv-field"
      viewBox={`0 0 ${VIEW.w} ${VIEW_H}`}
      role="img"
      aria-label={`Combat field, ${guild} guild against ${foes} enemies`}
    >
      <rect x={px(0)} y={py(0)} width={ARENA.width * SX} height={ARENA.height * SY} className="gv-field-ground" />

      {range(1, ARENA.width).map((x) => (
        <line key={`vx${x}`} x1={px(x)} y1={py(0)} x2={px(x)} y2={py(ARENA.height)}
          className={x % 2 ? 'gv-field-rule gv-field-rule--fine' : 'gv-field-rule'} />
      ))}
      {range(1, ARENA.height).map((y) => (
        <line key={`hz${y}`} x1={px(0)} y1={py(y)} x2={px(ARENA.width)} y2={py(y)}
          className={y % 2 ? 'gv-field-rule gv-field-rule--fine' : 'gv-field-rule'} />
      ))}
      <rect x={px(0)} y={py(0)} width={ARENA.width * SX} height={ARENA.height * SY} className="gv-field-border" />

      {range(0, ARENA.width + 1).map((x) => (
        <line key={`tx${x}`} x1={px(x)} y1={py(0)} x2={px(x)} y2={py(0) - (x % 2 ? 3 : 6)} className="gv-field-tick" />
      ))}
      {range(0, ARENA.height + 1).map((y) => (
        <line key={`ty${y}`} x1={px(0)} y1={py(y)} x2={px(0) - (y % 2 ? 3 : 6)} y2={py(y)} className="gv-field-tick" />
      ))}

      {([[ARENA.sideAx, 'MUSTER A'], [ARENA.sideBx, 'MUSTER B']] as const).map(([x, label]) => (
        <g key={label}>
          <line x1={px(x)} y1={py(0)} x2={px(x)} y2={py(ARENA.height)} className="gv-field-muster" />
          <text x={px(x)} y={py(0) - 11} textAnchor="middle" className="gv-field-axis">{label}</text>
        </g>
      ))}

      {/* Engagement radius on the SELECTION only — it decides whether a reaction
          strike is possible at all, and eight of them at once is noise. */}
      {selected && selected.unit.status !== 'dead' && (
        <g>
          <circle cx={px(selected.pos.x)} cy={py(selected.pos.y)} r={ENGAGEMENT_RANGE * SX}
            className="gv-field-ring gv-field-ring--engage" />
          <text x={px(selected.pos.x)} y={py(selected.pos.y) + ENGAGEMENT_RANGE * SY + 11}
            textAnchor="middle" className="gv-field-axis">
            {`ENGAGE ${ENGAGEMENT_RANGE * FEET_PER_UNIT} FT`}
          </text>
        </g>
      )}

      {/* Targeting lines — `unit_engaged` is the second-most-common event in a
          fight and the feed drops it, so this is where thrash becomes visible. */}
      {placed.map(({ spawn, unit, pos }) => {
        const target = unit.targetId ? at.get(unit.targetId) : undefined;
        if (!target || unit.status === 'dead' || unit.status === 'down') return null;
        return (
          <line key={`t${spawn.unitId}`} x1={px(pos.x)} y1={py(pos.y)} x2={px(target.x)} y2={py(target.y)}
            className="gv-field-target" />
        );
      })}

      {!held && state.recent.map((ev) => <StrikeMark key={`s${ev.seq}`} ev={ev} at={at} />)}

      {placed.map(({ spawn, unit, pos }) => {
        const cx = px(pos.x);
        const cy = py(pos.y);
        const hero = spawn.side === 'heroes';
        const ly = lanes.get(spawn.unitId) ?? cy;
        const anchor = hero ? 'end' : 'start';
        const lx = hero ? cx - 16 : cx + 16;
        const dead = unit.status === 'dead';
        const down = unit.status === 'down';
        const ratio = Math.max(0, unit.hp) / Math.max(1, spawn.maxHp);
        const barW = 30;
        const barX = hero ? lx - barW : lx;

        return (
          <g
            key={spawn.unitId}
            className="gv-field-unit"
            onClick={() => onSelect?.(selectedId === spawn.unitId ? null : spawn.unitId)}
          >
            {Math.abs(ly - cy) > LEADER_THRESHOLD && (
              <path d={`M ${cx + (hero ? -10 : 10)} ${cy} L ${lx} ${ly - 4}`} className="gv-field-leader" />
            )}

            {dead ? (
              <g className="gv-field-slain">
                <line x1={cx - 7} y1={cy - 7} x2={cx + 7} y2={cy + 7} className="gv-field-glyph-stroke" />
                <line x1={cx + 7} y1={cy - 7} x2={cx - 7} y2={cy + 7} className="gv-field-glyph-stroke" />
              </g>
            ) : hero ? (
              <>
                <circle cx={cx} cy={cy} r={8.5} className={down ? 'gv-field-hero gv-field-hero--down' : 'gv-field-hero'} />
                {down && <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} className="gv-field-glyph-stroke" />}
              </>
            ) : (
              <>
                <circle cx={cx} cy={cy} r={8} className="gv-field-foe" />
                <circle cx={cx} cy={cy} r={3} className="gv-field-foe-pip" />
              </>
            )}

            {selectedId === spawn.unitId && <circle cx={cx} cy={cy} r={13.5} className="gv-field-selected" />}

            <text x={lx} y={ly - 2} textAnchor={anchor}
              className={dead ? 'gv-field-name gv-field-name--gone' : 'gv-field-name'}>
              {(labelFor?.(spawn.unitId) ?? spawn.name).toUpperCase()}
            </text>
            {!dead && (
              <>
                <text x={lx} y={ly + 9} textAnchor={anchor} className="gv-field-hp">
                  {`${Math.max(0, unit.hp)}/${spawn.maxHp}${down ? ' DOWN' : ''}`}
                </text>
                <rect x={barX} y={ly + 12} width={barW} height={3.4} className="gv-field-bar" />
                <rect x={barX} y={ly + 12} width={barW * ratio} height={3.4}
                  className={`gv-field-bar-fill gv-field-bar-fill--s${hpStep(unit.hp, spawn.maxHp)}`} />
              </>
            )}

            {/* Generous hit area — the glyph is deliberately small. */}
            <circle cx={cx} cy={cy} r={15} className="gv-field-hit" />
          </g>
        );
      })}

      <FieldLegend />

      {held && (
        <g className="gv-field-held">
          <rect x={px(0)} y={py(0)} width={ARENA.width * SX} height={ARENA.height * SY} className="gv-field-veil" />
          <text x={px(ARENA.width / 2)} y={py(1.5)} textAnchor="middle" className="gv-field-heldlabel">SKIM — FIELD HELD</text>
          {heldNote && (
            <text x={px(ARENA.width / 2)} y={py(1.5) + 20} textAnchor="middle" className="gv-field-heldnote">{heldNote}</text>
          )}
        </g>
      )}
    </svg>
  );
}

function StrikeMark({ ev, at }: { ev: SimEvent; at: ReadonlyMap<string, { x: number; y: number }> }) {
  if (ev.type === 'combat.attack_resolved') {
    const a = at.get(ev.data.attackerId);
    const b = at.get(ev.data.targetId);
    if (!a || !b) return null;
    const crit = ev.data.roll.degree === 'critSuccess';
    const missed = ev.data.roll.degree === 'failure' || ev.data.roll.degree === 'critFailure';
    return (
      <g>
        <line x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)}
          className={`gv-field-strike${crit ? ' gv-field-strike--crit' : ''}${missed ? ' gv-field-strike--miss' : ''}`} />
        {crit && <circle cx={px(b.x)} cy={py(b.y)} r={13} className="gv-field-critring" />}
      </g>
    );
  }
  if (ev.type === 'combat.reaction_triggered') {
    const a = at.get(ev.data.unitId);
    const b = at.get(ev.data.againstId);
    if (!a || !b) return null;
    return <line x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)} className="gv-field-strike gv-field-strike--reaction" />;
  }
  if (ev.type === 'combat.damage_applied') {
    const b = at.get(ev.data.targetId);
    if (!b) return null;
    return <text x={px(b.x) + 12} y={py(b.y) - 13} className="gv-field-damage">{`−${ev.data.amount}`}</text>;
  }
  return null;
}

/** Scale bar and key. The engagement radius is the one that changes readings. */
function FieldLegend() {
  const by = py(ARENA.height) + 26;
  const lgx = px(6.4);
  return (
    <g>
      <line x1={px(0)} y1={by} x2={px(5)} y2={by} className="gv-field-scale" />
      <line x1={px(0)} y1={by - 4} x2={px(0)} y2={by + 4} className="gv-field-scale" />
      <line x1={px(5)} y1={by - 4} x2={px(5)} y2={by + 4} className="gv-field-scale" />
      <text x={px(2.5)} y={by + 15} textAnchor="middle" className="gv-field-axis">{`${5 * FEET_PER_UNIT} FT`}</text>

      <circle cx={lgx} cy={by - 1} r={6} className="gv-field-hero" />
      <text x={lgx + 11} y={by + 2.5} className="gv-field-axis">GUILD</text>
      <circle cx={lgx + 62} cy={by - 1} r={5.6} className="gv-field-foe" />
      <circle cx={lgx + 62} cy={by - 1} r={2.2} className="gv-field-foe-pip" />
      <text x={lgx + 73} y={by + 2.5} className="gv-field-axis">ENEMY</text>
      <line x1={lgx + 128} y1={by - 1} x2={lgx + 152} y2={by - 1} className="gv-field-target" />
      <text x={lgx + 158} y={by + 2.5} className="gv-field-axis">TARGETING</text>
      <circle cx={lgx + 4} cy={by + 13} r={5} className="gv-field-ring gv-field-ring--key" />
      <text x={lgx + 15} y={by + 16.5} className="gv-field-axis">ENGAGEMENT</text>

      <text x={px(ARENA.width)} y={by + 2.5} textAnchor="end" className="gv-field-axis gv-field-axis--faint">
        {`1 SQUARE = ${FEET_PER_UNIT} FT`}
      </text>
      <text x={px(ARENA.width)} y={by + 15} textAnchor="end" className="gv-field-axis gv-field-axis--faint">
        {`ARENA ${ARENA.width * FEET_PER_UNIT} × ${ARENA.height * FEET_PER_UNIT} FT`}
      </text>
    </g>
  );
}
