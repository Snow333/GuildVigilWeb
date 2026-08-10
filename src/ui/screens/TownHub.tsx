/**
 * Screen 2 — Town hub (brief #5 §3): the chapter-loop home. Reads week, gold,
 * pressure summary, roster, board; command: advanceWeek (an autosave point).
 * Every displayed number comes from a session query — the UI never computes a
 * rule. Board dispatch/accept UI arrives in 2.2; hero panel in 2.1.
 */

import { REGION_IDS } from '@sim/campaign/session';
import { useGame } from '../state/GameProvider';

export function TownHub() {
  const { exec, session, saveGame, quitToTitle, campaignName } = useGame();
  if (!session) return null;

  const week = session.currentWeek();
  const gold = session.goldAmount();
  const roster = session.roster();
  const board = session.board();
  const stashCount = session.stashItems().length;
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
        {active ? <> · Active quest #{active.questId} awaiting dispatch</> : null}
      </p>
      <p>
        <button onClick={advance}>Advance Week ▸</button>{' '}
        <button onClick={() => void saveGame()}>Save</button>{' '}
        <button onClick={quitToTitle}>Quit to title</button>
      </p>

      <h2>Roster</h2>
      <table border={1} cellPadding={6}>
        <thead>
          <tr>
            <th>Hero</th><th>Level</th><th>XP</th><th>Max HP</th><th>Wounded</th><th>Status</th>
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
            </tr>
          ))}
        </tbody>
      </table>
      <p><small>Hero panel (level-up · equipment · loadout) lands in 2.1.</small></p>

      <h2>Quest board</h2>
      {board.length === 0 ? (
        <p><em>The board is bare. Advance the week — trouble restocks.</em></p>
      ) : (
        <table border={1} cellPadding={6}>
          <thead>
            <tr>
              <th>Quest</th><th>Lv</th><th>Challenge</th><th>Region</th><th>Expires wk</th><th>Reward</th><th>Pressure</th>
            </tr>
          </thead>
          <tbody>
            {board.map((b) => (
              <tr key={b.questId}>
                <td>#{b.questId} {b.name}</td>
                <td>{b.minLevel}</td>
                <td>{b.challenge}</td>
                <td>{b.regionId}</td>
                <td>{b.expiresWeek}</td>
                <td>{b.rewardGold}g / {b.rewardXp}xp</td>
                <td>T{b.pressureTier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p><small>Accept &amp; dispatch (with forecast) land in 2.2. Unaccepted postings expire — and expiry feeds escalation.</small></p>

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
    </div>
  );
}
