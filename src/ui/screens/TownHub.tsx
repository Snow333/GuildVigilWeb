/**
 * Screen 2 — Town hub (brief #5 §3): the chapter-loop home; nav to everything.
 * Every displayed number comes from a session query — the UI never computes a
 * rule. Advance Week is an autosave point.
 */

import { REGION_IDS } from '@sim/campaign/session';
import { useGame } from '../state/GameProvider';

export function TownHub() {
  const { exec, session, saveGame, quitToTitle, campaignName, nav, lastError } = useGame();
  if (!session) return null;

  const week = session.currentWeek();
  const gold = session.goldAmount();
  const roster = session.roster();
  const board = session.board();
  const stashCount = session.stashView().length;
  const active = session.activeQuest();
  const regions = REGION_IDS.map((id) => session.pressure(id));

  const advance = (): void => {
    exec((s) => s.advanceWeek());
    void saveGame(); // autosave point (brief §2)
  };

  return (
    <div>
      <h1>{campaignName ?? session.campaignId} — Town Hub</h1>
      <p>
        <b>Week {week}</b> · Gold {gold} · Stash {stashCount} items · Party level {session.partyLevel()}
      </p>
      {lastError && <p><b>!</b> {lastError}</p>}
      <p>
        <button onClick={advance}>Advance Week ▸</button>{' '}
        <button onClick={() => nav({ kind: 'board' })}>Quest board ({board.length})</button>{' '}
        {active && <button onClick={() => nav({ kind: 'dispatch' })}>Dispatch: quest #{active.questId} ▸</button>}{' '}
        <button onClick={() => nav({ kind: 'map', questId: null })}>World map</button>{' '}
        <button onClick={() => nav({ kind: 'shop' })}>Shop</button>{' '}
        <button onClick={() => nav({ kind: 'settings' })}>Settings</button>{' '}
        <button onClick={() => void saveGame()}>Save</button>{' '}
        <button onClick={quitToTitle}>Quit to title</button>
      </p>

      <h2>Roster</h2>
      <table border={1} cellPadding={6}>
        <thead>
          <tr>
            <th>Hero</th><th>Level</th><th>XP</th><th>Max HP</th><th>Wounded</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {roster.map((h) => (
            <tr key={h.id}>
              <td>{h.name}</td>
              <td>{h.level}</td>
              <td>{h.xp.atCap ? 'CAP' : `${h.xp.progress}/${h.xp.threshold}`}</td>
              <td>{h.maxHp}</td>
              <td>{h.wounded}</td>
              <td>{h.status}</td>
              <td>
                <button onClick={() => nav({ kind: 'hero', heroId: h.id })}>
                  Open{session.heroSheet(h.id).canLevelUp ? ' ● level up!' : ''}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Regional pressure</h2>
      <table border={1} cellPadding={6}>
        <thead>
          <tr>
            <th>Region</th><th>Tier</th><th>Score</th>
          </tr>
        </thead>
        <tbody>
          {regions.map((r) => (
            <tr key={r.regionId}>
              <td>{r.regionId}</td>
              <td>T{r.tier} {r.tierName}</td>
              <td>{r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><small>Unaccepted postings expire — and expiry feeds escalation. The board is how you push back.</small></p>
    </div>
  );
}
