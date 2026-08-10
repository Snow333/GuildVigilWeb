/**
 * Screen 8 — After-action (brief #5 §3): outcome, haul, XP, level-up prompts,
 * escalation changes. Everything here is read from the launch record and the
 * world-stream slice the dispatch produced — presentation over facts.
 */

import { deriveItem } from '@sim/heroes/equipment';
import { useGame } from '../state/GameProvider';

const OUTCOME_WORD: Record<string, string> = {
  completed: 'MISSION COMPLETE',
  failed: 'MISSION FAILED — the party withdrew',
  wiped: 'THE PARTY WAS WIPED OUT',
  ambushKilled: 'CUT DOWN ON THE ROAD',
};

export function AfterActionScreen() {
  const { session, lastLaunch, nav, saveGame } = useGame();
  if (!session || !lastLaunch) {
    return <div><h1>After-action</h1><p><em>Nothing to report.</em> <button onClick={() => nav({ kind: 'town' })}>◂ Town</button></p></div>;
  }

  const { record, worldStart } = lastLaunch;
  const slice = session.world.all().slice(worldStart);
  const names = new Map(session.roster().map((r) => [r.id, r.name]));

  const xpRows: { hero: string; amount: number; source: string }[] = [];
  const escalations: string[] = [];
  let questGold = 0;
  for (const ev of slice) {
    if (ev.type === 'hero.xp_awarded') {
      xpRows.push({ hero: names.get(ev.data.heroId) ?? ev.data.heroId, amount: ev.data.amount, source: ev.data.source });
    } else if (ev.type === 'world.escalation_changed') {
      escalations.push(`${ev.data.regionId}: tier ${ev.data.oldTier} → ${ev.data.newTier}`);
    } else if (ev.type === 'world.quest_completed') {
      questGold = ev.data.gold;
    }
  }
  const haulGold = record.dispatch?.gold ?? 0;
  const items = record.outcome === 'wiped' ? [] : (record.dispatch?.items ?? []);
  const pendingLevelUps = session.roster().filter((r) => session.heroSheet(r.id).canLevelUp);

  const finish = (): void => {
    void saveGame(); // autosave point
    nav({ kind: 'town' });
  };

  return (
    <div>
      <h1>After-action — quest {lastLaunch.questName}, week {record.week}</h1>
      <h2>{OUTCOME_WORD[record.outcome] ?? record.outcome}</h2>

      <h3>The haul</h3>
      {record.outcome === 'completed' ? (
        <p>Quest reward {questGold}g + dungeon haul {haulGold}g</p>
      ) : record.outcome === 'failed' && haulGold > 0 ? (
        <p>The retreat carried out {haulGold}g</p>
      ) : record.outcome === 'wiped' ? (
        <p><em>The haul stays in the dungeon.</em></p>
      ) : (
        <p><em>Nothing gained.</em></p>
      )}
      {items.length > 0 && (
        <ul>
          {items.map((item, i) => <li key={i}>{deriveItem(item).displayName}</li>)}
        </ul>
      )}

      <h3>Experience</h3>
      {xpRows.length === 0 ? <p><em>None earned.</em></p> : (
        <table border={1} cellPadding={4}>
          <tbody>
            {xpRows.map((r, i) => (
              <tr key={i}><td>{r.hero}</td><td>+{r.amount} xp</td><td>{r.source}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {pendingLevelUps.length > 0 && (
        <p>
          Ready to level:{' '}
          {pendingLevelUps.map((r) => (
            <button key={r.id} onClick={() => nav({ kind: 'hero', heroId: r.id })}>{r.name} ▸</button>
          ))}
        </p>
      )}

      <h3>The world's answer</h3>
      {escalations.length === 0 ? <p><em>No regional tier changes.</em></p> : (
        <ul>{escalations.map((e, i) => <li key={i}>{e}</li>)}</ul>
      )}

      <p><button onClick={finish}>Return to town (autosaves) ▸</button></p>
    </div>
  );
}
