/**
 * Screen 3 — Quest board (brief #5 §3): board() rows with the pressure badge;
 * accepting moves board → active and hands off to dispatch setup. Declining has
 * consequences the screen must show: expiry feeds escalation.
 */

import { useGame } from '../state/GameProvider';

export function QuestBoard() {
  const { session, exec, nav } = useGame();
  if (!session) return null;
  const board = session.board();
  const active = session.activeQuest();
  const week = session.currentWeek();

  const accept = (questId: number): void => {
    const ok = exec((s) => {
      s.acceptQuest(questId);
      return true;
    });
    if (ok) nav({ kind: 'dispatch' });
  };

  return (
    <div>
      <h1>Quest board — week {week}</h1>
      <p><button onClick={() => nav({ kind: 'town' })}>◂ Town</button></p>
      {active && (
        <p>
          Quest #{active.questId} is already accepted —{' '}
          <button onClick={() => nav({ kind: 'dispatch' })}>go to dispatch setup ▸</button>
        </p>
      )}
      {board.length === 0 ? (
        <p><em>The board is bare. Advance the week — trouble restocks.</em></p>
      ) : (
        <table border={1} cellPadding={6}>
          <thead>
            <tr>
              <th>Quest</th><th>Lv</th><th>Challenge</th><th>Region</th><th>Expires</th>
              <th>Reward</th><th>Travel</th><th>Pressure</th><th></th>
            </tr>
          </thead>
          <tbody>
            {board.map((b) => {
              const travel = session.travelPreview(b.questId);
              return (
                <tr key={b.questId}>
                  <td>#{b.questId} {b.name}</td>
                  <td>{b.minLevel}</td>
                  <td>{b.challenge}</td>
                  <td>{session.regionName(b.regionId)}</td>
                  <td>wk {b.expiresWeek}</td>
                  <td>{b.rewardGold}g / {b.rewardXp}xp</td>
                  <td>{travel ? `${travel.etaMinutes} min` : 'unreachable'}</td>
                  <td>T{b.pressureTier}</td>
                  <td>
                    <button disabled={active !== null} onClick={() => accept(b.questId)}>Accept</button>{' '}
                    <button onClick={() => nav({ kind: 'map', questId: b.questId })}>Map</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p><small>Postings left to expire feed regional escalation — declining is also a choice.</small></p>
    </div>
  );
}
