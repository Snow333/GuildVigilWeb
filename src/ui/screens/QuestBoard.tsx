/**
 * Screen 3 — Quest board (brief #5 §3): board() rows with the pressure badge;
 * accepting moves board → active and hands off to dispatch setup. Declining has
 * consequences the screen must show: expiry feeds escalation.
 *
 * Brief #8 rollout step 3: postings are pinned notices with torn lower edges;
 * Accept is the wax seal (irreversible commitment); stamps carry red-ink
 * urgency — GUILD WORK for storyline postings, EXPIRES when this is the last
 * week (one stamp per sheet, arc wins). Empty slots read as bare leather
 * (SCHEDULER.maxOpenQuests is content data, not a UI-computed rule). The e2e
 * accept policy reads data-quest-id / data-challenge off each notice.
 */

import { SCHEDULER } from '@content/world';
import { storylineByQuestId } from '@sim/registry';
import { useGame } from '../state/GameProvider';

export function QuestBoard() {
  const { session, exec, nav } = useGame();
  if (!session) return null;
  const board = session.board();
  const active = session.activeQuest();
  const week = session.currentWeek();
  const emptySlots = Math.max(0, SCHEDULER.maxOpenQuests - board.length);

  const accept = (questId: number): void => {
    const ok = exec((s) => {
      s.acceptQuest(questId);
      return true;
    });
    if (ok) nav({ kind: 'dispatch' });
  };

  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-board">
        <h1>Quest board — week {week}</h1>
        <p style={{ margin: '0 0 18px' }}>
          <button className="gv-btn" onClick={() => nav({ kind: 'town' })}>◂ Town</button>
        </p>
        {active && (
          <p className="gv-marg" style={{ margin: '0 0 14px' }}>
            Quest #{active.questId} is already accepted —{' '}
            <button className="gv-btn" onClick={() => nav({ kind: 'dispatch' })}>go to dispatch setup ▸</button>
          </p>
        )}

        {board.length === 0 ? (
          <div className="gv-sheet gv-sheet--old gv-sheet--stained gv-sheet--deckle" style={{ maxWidth: 460 }}>
            <p style={{ margin: 0 }}><em>The board is bare. Advance the week — trouble restocks.</em></p>
          </div>
        ) : (
          <div className="gv-notices">
            {board.map((b) => {
              const travel = session.travelPreview(b.questId);
              const pressure = session.pressure(b.regionId);
              const isArc = storylineByQuestId.has(b.questId);
              const lastWeek = b.expiresWeek <= week + 1;
              return (
                <div
                  key={b.questId}
                  className="gv-sheet gv-sheet--notice"
                  data-posting=""
                  data-quest-id={b.questId}
                  data-challenge={b.challenge}
                >
                  <span className="gv-pin" />
                  {isArc ? (
                    <span className="gv-stamp">GUILD WORK</span>
                  ) : lastWeek ? (
                    <span className="gv-stamp">EXPIRES</span>
                  ) : null}
                  <div className="gv-notice-name">#{b.questId} {b.name}</div>
                  <div className="gv-notice-meta">
                    Lv {b.minLevel} · challenge {b.challenge} · {session.regionName(b.regionId)}
                    <br />
                    posted wk {b.postedWeek} · expires wk {b.expiresWeek}
                    <br />
                    {travel ? `${travel.etaMinutes} min by road` : <span className="gv-marg">unreachable</span>}
                  </div>
                  <span className="gv-reward">{b.rewardGold} gold · {b.rewardXp} xp</span>
                  <div style={{ margin: '4px 0 8px' }}>
                    <span className={`gv-chip gv-chip--s${pressure.tier}`}><i />T{pressure.tier} {pressure.tierName}</span>
                  </div>
                  <button className="gv-btn gv-btn--seal" disabled={active !== null} onClick={() => accept(b.questId)}>
                    Accept
                  </button>{' '}
                  <button className="gv-btn" onClick={() => nav({ kind: 'map', questId: b.questId })}>Map</button>
                </div>
              );
            })}
            {Array.from({ length: emptySlots }, (_, i) => (
              <div className="gv-slot-empty" key={`empty-${i}`}>empty slot</div>
            ))}
          </div>
        )}

        <p className="gv-marg" style={{ marginTop: 18 }}>
          Postings left to expire feed regional escalation — declining is also a choice.
        </p>
      </div>
    </div>
  );
}
