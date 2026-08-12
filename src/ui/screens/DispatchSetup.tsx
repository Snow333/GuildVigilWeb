/**
 * Screen 4 — Dispatch setup (brief #5 §3): profile/caution pickers and THE
 * FORECAST PANEL — constraint 3 on screen. Forecast runs n headless dispatches
 * on forked seeds (never the live seed) through the same resolution path.
 *
 * Brief #8 rollout step 6: the orders sheet is pinned (actionable now); the
 * chosen profile/caution reads as the pressed button (.gv-btn:disabled, the
 * HeroPanel tab pattern); the forecast is the scribe's tally — stroke groups
 * of five WITH the explicit numbers beside them (flourish never replaces the
 * number; wipes count in red ink, the world talking back); Launch is the wax
 * seal (irreversible commitment). The e2e forecast contract reads
 * [data-forecast] — same numbers the old <pre> carried.
 */

import { useState } from 'react';
import type { ForecastResult } from '@sim/campaign/session';
import type { Caution, MissionProfile } from '@sim/dungeon/dispatch';
import { cautionLabel, profileLabel } from '../labels';
import { Portrait, conditionFor } from '../portrait';
import { useGame } from '../state/GameProvider';

const PROFILES: MissionProfile[] = ['fullExplore', 'bossRush', 'mysteryHunt', 'lootRun'];
const CAUTIONS: Caution[] = ['cautious', 'standard', 'bold'];
const FORECAST_N = 20;

/** Scribe's tally: groups of five ink strokes, the fifth barred across. */
function Tally({ count }: { count: number }) {
  const fives = Math.floor(count / 5);
  const rest = count % 5;
  return (
    <span className="gv-tally">
      {Array.from({ length: fives }, (_, i) => (
        <svg key={`f${i}`} width={26} height={22} aria-hidden="true">
          <g stroke="var(--gv-ink)" strokeWidth={1.6} strokeLinecap="round">
            <line x1={1} y1={2} x2={1} y2={18} />
            <line x1={7} y1={2} x2={7} y2={18} />
            <line x1={13} y1={2} x2={13} y2={18} />
            <line x1={19} y1={2} x2={19} y2={18} />
            <line x1={-3} y1={15} x2={24} y2={5} />
          </g>
        </svg>
      ))}
      {rest > 0 && (
        <svg width={rest * 6 + 2} height={22} aria-hidden="true">
          <g stroke="var(--gv-ink)" strokeWidth={1.6} strokeLinecap="round">
            {Array.from({ length: rest }, (_, i) => (
              <line key={i} x1={1 + i * 6} y1={2} x2={1 + i * 6} y2={18} />
            ))}
          </g>
        </svg>
      )}
    </span>
  );
}

export function DispatchSetup() {
  const { session, exec, nav, setLastLaunch } = useGame();
  const [profile, setProfile] = useState<MissionProfile>('fullExplore');
  const [caution, setCaution] = useState<Caution>('standard');
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  if (!session) return null;

  const active = session.activeQuest();
  if (!active) {
    return (
      <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
        <div className="gv-dispatch">
          <h1>Dispatch setup</h1>
          <p>
            <em style={{ color: '#d8bd85' }}>No accepted quest.</em>{' '}
            <button className="gv-btn" onClick={() => nav({ kind: 'board' })}>◂ Quest board</button>
          </p>
        </div>
      </div>
    );
  }

  const roster = session.roster();

  const runForecast = (): void => {
    const result = exec((s) => s.forecast(active.questId, { profile, caution }, FORECAST_N));
    if (result) setForecast(result);
  };

  const launch = (): void => {
    const worldStart = session.world.length;
    const questName = `#${active.questId}`;
    const record = exec((s) => {
      s.configureDispatch({ profile, caution });
      return s.launchDispatch();
    });
    if (record) {
      setLastLaunch({ record, questName, worldStart });
      nav({ kind: 'playback' });
    }
  };

  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-dispatch">
        <h1>Dispatch setup — quest #{active.questId} ({session.regionName(active.regionId)})</h1>
        <p style={{ margin: '0 0 18px' }}>
          <button className="gv-btn" onClick={() => nav({ kind: 'town' })}>◂ Town</button>{' '}
          <button className="gv-btn" onClick={() => nav({ kind: 'map', questId: active.questId })}>Map</button>{' '}
          <button
            className="gv-btn gv-btn--ghost"
            onClick={() => {
              exec((s) => s.abandonQuest());
              nav({ kind: 'board' });
            }}
          >
            Abandon quest ◂ back to board
          </button>{' '}
          <span className="gv-marg">no penalty — but its expiry clock never stopped</span>
        </p>

        {/* the orders sheet: pinned = actionable now */}
        <div className="gv-sheet" style={{ ['--gv-tilt' as never]: '-0.3deg' }}>
          <span className="gv-pin" />
          <h3 className="gv-head">Marching orders <span className="gv-sub">team · orders · nerve</span></h3>

          <p className="gv-statline" style={{ marginBottom: 6 }}>
            <b>Team</b> (party_1 — multi-team arrives later):{' '}
            {roster.map((r) => `${r.name} L${r.level}`).join(' · ')}
          </p>
          {/* the marching strip: every face going out, with the level and
              wounded numbers the grade is paired to */}
          <div className="gv-dteam">
            {roster.map((r) => (
              <span className="gv-dmember" key={r.id}>
                <Portrait
                  portraitKey={r.portraitKey}
                  alt={r.name}
                  size="chip"
                  faction="haven"
                  condition={conditionFor(r)}
                />
                <span className="gv-dname">{r.name}</span>
                <span className="gv-dstat">
                  L{r.level}{r.wounded > 0 ? <span className="gv-marg"> · w{r.wounded}</span> : ''}
                </span>
              </span>
            ))}
          </div>

          {/* orders as cards: four options each needing a line of consequence
              never fit a button row, and the row wrapped awkwardly anyway */}
          <span className="gv-choice-label">Orders</span>
          <div className="gv-ordergrid">
            {PROFILES.map((p) => {
              const l = profileLabel(p);
              return (
                <button
                  key={p}
                  type="button"
                  className="gv-ordercard"
                  aria-pressed={profile === p}
                  data-profile={p}
                  onClick={() => { setProfile(p); setForecast(null); }}
                >
                  <b>{l.label}</b>
                  <span>{l.blurb}</span>
                </button>
              );
            })}
          </div>

          {/* "Caution: cautious" read as a label repeating its own value */}
          <div className="gv-choice" style={{ marginTop: 14 }}>
            <span className="gv-choice-label">Nerve</span>
            {CAUTIONS.map((c) => (
              <button
                key={c}
                className="gv-btn"
                disabled={caution === c}
                data-caution={c}
                title={cautionLabel(c).blurb}
                onClick={() => { setCaution(c); setForecast(null); }}
              >
                {cautionLabel(c).label}
              </button>
            ))}
          </div>

          <p style={{ margin: '14px 0 0' }}>
            <button className="gv-btn gv-btn--seal" onClick={launch}>Launch dispatch ▸</button>
          </p>
        </div>

        {/* the forecast: scribe's tally, numbers explicit */}
        <div className="gv-sheet gv-sheet--aged" style={{ ['--gv-tilt' as never]: '0.35deg' }}>
          <span className="gv-pin gv-pin--right" />
          <h3 className="gv-head">Forecast <span className="gv-sub">scribe&apos;s tally · {FORECAST_N} runs</span></h3>
          <p style={{ margin: '0 0 10px' }}>
            <button className="gv-btn" onClick={runForecast}>Run forecast ({FORECAST_N} simulated dispatches)</button>
          </p>
          {forecast && (
            <div data-forecast="">
              <div className="gv-tallyrow">
                <span>complete</span>
                <Tally count={forecast.completed} />
                <span className="gv-tno">{forecast.completed}/{forecast.n}</span>
              </div>
              <div className="gv-tallyrow">
                <span>retreat</span>
                <Tally count={forecast.retreated} />
                <span className="gv-tno">{forecast.retreated}/{forecast.n}</span>
              </div>
              <div className="gv-tallyrow">
                <span>wipe</span>
                <Tally count={forecast.wiped} />
                <span className="gv-tno" style={{ color: forecast.wiped > 0 ? 'var(--gv-red-ink)' : undefined }}>
                  {forecast.wiped}/{forecast.n}
                </span>
              </div>
              <p className="gv-statline" style={{ marginTop: 10 }}>
                median haul {forecast.medianHaulGold}g · median dungeon time {forecast.medianDurationMinutes} min
                {forecast.travelEtaMinutes !== null ? ` · travel ${forecast.travelEtaMinutes} min each way` : ''}
              </p>
              <p className="gv-marg" style={{ margin: 0 }}>
                forked seeds — the live run WILL differ; same rules, different dice
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
