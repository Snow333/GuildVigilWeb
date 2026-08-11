/**
 * Screen 8 — After-action (brief #5 §3): outcome, haul, XP, level-up prompts,
 * escalation changes. Everything here is read from the launch record and the
 * world-stream slice the dispatch produced — presentation over facts.
 *
 * Brief #8 rollout step 6: the report is history the moment it's written —
 * OLD vellum, stained, TAPED (a standing record, not actionable). The outcome
 * is a label-paired status chip; the world's answer (escalation changes) is
 * red-ink marginalia — the world talking back. Actions live apart on a small
 * pinned Orders sheet (level-up shortcuts, return to town), keeping the
 * record/orders grammar split clean.
 */

import { deriveItem } from '@sim/heroes/equipment';
import { useGame } from '../state/GameProvider';

const OUTCOME_WORD: Record<string, string> = {
  completed: 'MISSION COMPLETE',
  failed: 'MISSION FAILED — the party withdrew',
  wiped: 'THE PARTY WAS WIPED OUT',
  ambushKilled: 'CUT DOWN ON THE ROAD',
};

/** Outcome → frozen chip class; the OUTCOME_WORD text is the pairing label. */
const OUTCOME_CHIP: Record<string, string> = {
  completed: 'gv-chip--s0',
  failed: 'gv-chip--s2',
  wiped: 'gv-chip--s3',
  ambushKilled: 'gv-chip--s3',
};

export function AfterActionScreen() {
  const { session, lastLaunch, nav, saveGame } = useGame();
  if (!session || !lastLaunch) {
    return (
      <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
        <div className="gv-aar">
          <h1>After-action</h1>
          <p>
            <em style={{ color: '#d8bd85' }}>Nothing to report.</em>{' '}
            <button className="gv-btn" onClick={() => nav({ kind: 'town' })}>◂ Town</button>
          </p>
        </div>
      </div>
    );
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
      escalations.push(`${session.regionName(ev.data.regionId)}: tier ${ev.data.oldTier} → ${ev.data.newTier}`);
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
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-aar">
        <h1>After-action — quest {lastLaunch.questName}, week {record.week}</h1>

        {/* the report: old vellum, taped — filed the moment it's written */}
        <div className="gv-sheet gv-sheet--old gv-sheet--stained" style={{ ['--gv-tilt' as never]: '0.35deg' }}>
          <span className="gv-tape" />
          <h3 className="gv-head">
            The report
            <span className={`gv-chip ${OUTCOME_CHIP[record.outcome] ?? 'gv-chip--s1'}`} style={{ marginLeft: 'auto' }}>
              <i />{OUTCOME_WORD[record.outcome] ?? record.outcome}
            </span>
          </h3>

          <p className="gv-statline"><b>The haul.</b>{' '}
            {record.outcome === 'completed' ? (
              <>Quest reward {questGold}g + dungeon haul {haulGold}g</>
            ) : record.outcome === 'failed' && haulGold > 0 ? (
              <>The retreat carried out {haulGold}g</>
            ) : record.outcome === 'wiped' ? (
              <em>The haul stays in the dungeon.</em>
            ) : (
              <em>Nothing gained.</em>
            )}
          </p>
          {items.length > 0 && (
            <ul style={{ margin: '0 0 10px', paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7 }}>
              {items.map((item, i) => <li key={i}>{deriveItem(item).displayName}</li>)}
            </ul>
          )}

          <p className="gv-statline" style={{ marginBottom: 4 }}><b>Experience.</b>{' '}
            {xpRows.length === 0 && <em>None earned.</em>}
          </p>
          {xpRows.length > 0 && (
            <div className="gv-ledger" style={{ marginBottom: 10 }}>
              <table>
                <tbody>
                  {xpRows.map((r, i) => (
                    <tr key={i}><td><b>{r.hero}</b></td><td>+{r.amount} xp</td><td style={{ color: 'var(--gv-ink-muted)' }}>{r.source}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="gv-statline" style={{ marginBottom: 4 }}><b>The world&apos;s answer.</b>{' '}
            {escalations.length === 0 && <em>No regional tier changes.</em>}
          </p>
          {escalations.map((e, i) => (
            <p key={i} className="gv-marg" style={{ margin: '0 0 4px' }}>{e}</p>
          ))}
        </div>

        {/* orders: pinned = actionable now */}
        <div className="gv-sheet" style={{ maxWidth: 520, ['--gv-tilt' as never]: '-0.35deg' }}>
          <span className="gv-pin" />
          <h3 className="gv-head">Orders <span className="gv-sub">what happens next</span></h3>
          {pendingLevelUps.length > 0 && (
            <p style={{ margin: '0 0 10px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              Ready to level:{' '}
              {pendingLevelUps.map((r) => (
                <button key={r.id} className="gv-btn" onClick={() => nav({ kind: 'hero', heroId: r.id })}>{r.name} ▸</button>
              ))}
            </p>
          )}
          <p style={{ margin: 0 }}>
            <button className="gv-btn" onClick={finish}>Return to town (autosaves) ▸</button>
          </p>
        </div>
      </div>
    </div>
  );
}
