/**
 * The band screen (M4) — the wiring half: session in, `readBands` view out,
 * clicks back to `bandActions`. The grid itself is `BandBoard`; every rule is
 * in `bandPicks.ts`. Follows TownScreen's pattern (useGame / exec / nav /
 * lastError).
 */

import { useState } from 'react';
import { useGame } from '../state/GameProvider';
import { BandBoard, type OddsShown } from './BandBoard';
import { callBack, DEFAULT_ORDERS, launchHeld, moveHero, sendBand } from './bandActions';
import { oddsKey, oddsLine, readBands } from './bandPicks';

const FORECAST_N = 20;

export function BandScreen() {
  const { session, exec, nav, lastError, setLastLaunch, saveGame } = useGame();
  const [rosterOpen, setRosterOpen] = useState(false);
  const [odds, setOdds] = useState<Record<string, OddsShown>>({});
  if (!session) return null;

  const view = readBands(session);

  /** A launch hands off to playback exactly as the Dispatch screen does (the after-action screen saves). */
  const march = (run: () => ReturnType<typeof sendBand> | null): void => {
    const worldStart = session.world.length;
    const record = run();
    if (!record) return;
    setLastLaunch({ record, questName: session.questName(record.questId), worldStart });
    nav({ kind: 'playback' });
  };

  return (
    <BandBoard
      view={view}
      rosterOpen={rosterOpen}
      odds={odds}
      error={lastError}
      onBack={() => nav({ kind: 'town' })}
      onSend={(band, questId) => march(() => exec((s) => sendBand(s, band, questId)))}
      onLaunchHeld={(band) => march(() => exec((s) => launchHeld(s, band)))}
      onCallBack={(band) => { exec((s) => callBack(s, band)); void saveGame(); }}
      onMove={(heroId, to) => { exec((s) => moveHero(s, heroId, to)); void saveGame(); }}
      onToggleRoster={() => setRosterOpen((o) => !o)}
      onOdds={(band, questId) => {
        const result = exec((s) => s.forecast(questId, DEFAULT_ORDERS, FORECAST_N, band));
        if (result) setOdds((o) => ({ ...o, [oddsKey(view, band, questId)]: oddsLine(result) }));
      }}
    />
  );
}
