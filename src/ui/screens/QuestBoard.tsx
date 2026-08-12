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
 *
 * Brief #11 hierarchy: name loudest, then the guild's DIFFICULTY judgement as
 * the headline, then level/travel/reward as equal blocks in priority order,
 * then a muted footer for what you only check occasionally. The regional
 * pressure chip left this card deliberately — it describes the REGION, not the
 * job, it was the loudest thing here, and it already lives on the town hub's
 * watch report and the chart. The difficulty band is a session query
 * (BoardEntry.difficulty); this screen computes nothing.
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
              const isArc = storylineByQuestId.has(b.questId);
              const lastWeek = b.expiresWeek <= week + 1;
              const stamp = isArc ? 'GUILD WORK' : lastWeek ? 'EXPIRES' : null;
              return (
                <div
                  key={b.questId}
                  className={`gv-sheet gv-sheet--notice${stamp ? ' gv-notice--stamped' : ''}`}
                  data-posting=""
                  data-quest-id={b.questId}
                  data-challenge={b.challenge}
                >
                  <span className="gv-pin" />
                  {/* a stamped notice reserves the stamp's column (see screens.css)
                      so red ink never lands across the posting's name */}
                  {stamp && <span className="gv-stamp">{stamp}</span>}

                  <div className="gv-notice-id">posting {b.questId}</div>
                  <h3 className="gv-notice-name">{b.name}</h3>

                  {/* the headline judgement: colour and word are inseparable */}
                  <p className={`gv-difficulty gv-difficulty--s${b.difficulty.tier}`} data-difficulty={b.difficulty.id}>
                    <i />{b.difficulty.label}
                    <span className="gv-italic">— {b.difficulty.reason}</span>
                  </p>

                  {/* level · travel · reward, equal weight, in priority order */}
                  <div className="gv-notice-stats">
                    <span className="gv-nstat">
                      <b>level</b>
                      <span>{b.minLevel}</span>
                    </span>
                    <span className="gv-nstat">
                      <b>travel</b>
                      <span>{travel ? <>{travel.etaMinutes}<small> min</small></> : '—'}</span>
                    </span>
                    <span className="gv-nstat">
                      <b>reward</b>
                      <span>{b.rewardGold}<small>g</small></span>
                    </span>
                  </div>

                  {!travel && <p className="gv-marg" style={{ margin: '8px 0 0' }}>no road reaches it</p>}

                  <p className="gv-notice-foot">
                    {session.regionName(b.regionId)} · {b.rewardXp} xp · expires wk {b.expiresWeek}
                  </p>

                  <p className="gv-notice-acts">
                    <button className="gv-btn gv-btn--seal" disabled={active !== null} onClick={() => accept(b.questId)}>
                      Accept
                    </button>{' '}
                    <button className="gv-btn" onClick={() => nav({ kind: 'map', questId: b.questId })}>Map</button>
                  </p>
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
