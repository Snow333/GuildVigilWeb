/**
 * Screen 4 — Dispatch setup (brief #5 §3): profile/caution pickers and THE
 * FORECAST PANEL — constraint 3 on screen. Forecast runs n headless dispatches
 * on forked seeds (never the live seed) through the same resolution path.
 */

import { useState } from 'react';
import type { ForecastResult } from '@sim/campaign/session';
import type { Caution, MissionProfile } from '@sim/dungeon/dispatch';
import { useGame } from '../state/GameProvider';

const PROFILES: MissionProfile[] = ['fullExplore', 'bossRush', 'mysteryHunt', 'lootRun'];
const CAUTIONS: Caution[] = ['cautious', 'standard', 'bold'];
const FORECAST_N = 20;

function Bar({ label, count, n, mark }: { label: string; count: number; n: number; mark: string }) {
  const width = Math.round((count / n) * 40);
  return (
    <div>
      {label.padEnd(8, ' ')} {String(count).padStart(2, ' ')}/{n} {mark.repeat(width)}
    </div>
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
      <div>
        <h1>Dispatch setup</h1>
        <p><em>No accepted quest.</em> <button onClick={() => nav({ kind: 'board' })}>◂ Quest board</button></p>
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
    <div>
      <h1>Dispatch setup — quest #{active.questId} ({active.regionId})</h1>
      <p><button onClick={() => nav({ kind: 'town' })}>◂ Town</button> <button onClick={() => nav({ kind: 'map', questId: active.questId })}>Map</button></p>

      <h3>Team (party_1 — multi-team arrives later)</h3>
      <p>{roster.map((r) => `${r.name} L${r.level}`).join(' · ')}</p>

      <h3>Mission profile</h3>
      <p>
        {PROFILES.map((p) => (
          <label key={p} style={{ marginRight: 12 }}>
            <input type="radio" checked={profile === p} onChange={() => { setProfile(p); setForecast(null); }} /> {p}
          </label>
        ))}
      </p>
      <h3>Caution</h3>
      <p>
        {CAUTIONS.map((c) => (
          <label key={c} style={{ marginRight: 12 }}>
            <input type="radio" checked={caution === c} onChange={() => { setCaution(c); setForecast(null); }} /> {c}
          </label>
        ))}
      </p>

      <h3>Forecast</h3>
      <p><button onClick={runForecast}>Run forecast ({FORECAST_N} simulated dispatches)</button></p>
      {forecast && (
        <pre>
          <Bar label="complete" count={forecast.completed} n={forecast.n} mark="█" />
          <Bar label="retreat" count={forecast.retreated} n={forecast.n} mark="▒" />
          <Bar label="wipe" count={forecast.wiped} n={forecast.n} mark="░" />
          {'\n'}median haul {forecast.medianHaulGold}g · median dungeon time {forecast.medianDurationMinutes} min
          {forecast.travelEtaMinutes !== null ? ` · travel ${forecast.travelEtaMinutes} min each way` : ''}
          {'\n'}(forked seeds — the live run WILL differ; same rules, different dice)
        </pre>
      )}

      <h3>Launch</h3>
      <p><button onClick={launch}>Launch dispatch ▸</button></p>
    </div>
  );
}
