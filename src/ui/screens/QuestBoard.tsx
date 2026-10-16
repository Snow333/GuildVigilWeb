/**
 * Screen 3 — Quest board (brief #5 §3): board() rows; accepting moves board →
 * active and hands off to dispatch setup. Declining has consequences the
 * screen must show: expiry feeds escalation.
 *
 * M2 (Track Q): the board holds up to 10 postings, so the old 300px pinned
 * notices became a wall. Now it is ONE pinned sheet with compact rows:
 *   - the Marshal's commission first (red wax seal + "Marshal's commission"),
 *   - then every posting, easiest first (challenge, then quest id),
 *   - each row leads with ONE plain word — easy / fair / hard — which is
 *     `BoardEntry.ease`, a session query. This screen computes no rule.
 * Stamps keep their meaning: GUILD WORK for the storyline, EXPIRES on the last
 * week. The e2e accept policy still reads data-posting / data-quest-id /
 * data-challenge off each row.
 */

import type { CSSProperties } from 'react';
import { SCHEDULER } from '@content/world';
import type { BoardEntry, Ease } from '@sim/campaign/session';
import { storylineByQuestId } from '@sim/registry';
import { useGame } from '../state/GameProvider';

/** The plain word's colour, from the frozen status set. The word always ships with it. */
const EASE_TIER: Record<Ease, 0 | 2 | 3> = { easy: 0, fair: 2, hard: 3 };

/** One grid for the header and every row, so the columns can never drift apart. */
const ROW_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '74px minmax(0, 1fr) 54px 76px 70px 68px 150px',
  alignItems: 'center',
  gap: 10,
};

const cell: CSSProperties = { fontSize: 14, fontWeight: 700, textAlign: 'center' };

/** Commissions first; then easiest first, ties by quest id. */
function boardOrder(a: BoardEntry, b: BoardEntry): number {
  return Number(b.commission) - Number(a.commission) || a.challenge - b.challenge || a.questId - b.questId;
}

export function QuestBoard() {
  const { session, exec, nav } = useGame();
  if (!session) return null;
  const board = [...session.board()].sort(boardOrder);
  const active = session.activeQuest();
  const week = session.currentWeek();
  const regularCount = board.filter((b) => !b.commission).length;

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
            {session.questName(active.questId)} is already accepted —{' '}
            <button className="gv-btn" onClick={() => nav({ kind: 'dispatch' })}>go to dispatch setup ▸</button>
          </p>
        )}

        {board.length === 0 ? (
          <div className="gv-sheet gv-sheet--old gv-sheet--stained gv-sheet--deckle" style={{ maxWidth: 460 }}>
            <p style={{ margin: 0 }}><em>The board is bare. Advance the week — trouble restocks.</em></p>
          </div>
        ) : (
          <div className="gv-sheet" data-board-list="" style={{ ['--gv-tilt' as never]: '-0.2deg', padding: '18px 20px 14px' }}>
            <span className="gv-pin" />
            <div
              style={{ ...ROW_GRID, fontFamily: 'var(--gv-sans)', fontSize: 10, letterSpacing: 1.5, color: 'var(--gv-ink-muted)', paddingBottom: 6, borderBottom: '1px solid #a8905e' }}
            >
              <span>how hard</span>
              <span>job</span>
              <span style={{ textAlign: 'center' }}>level</span>
              <span style={{ textAlign: 'center' }}>travel</span>
              <span style={{ textAlign: 'center' }}>reward</span>
              <span style={{ textAlign: 'center' }}>ends</span>
              <span />
            </div>

            {board.map((b) => {
              const travel = session.travelPreview(b.questId);
              const isArc = storylineByQuestId.has(b.questId);
              const lastWeek = b.expiresWeek <= week + 1;
              const stamp = b.commission ? null : isArc ? 'GUILD WORK' : lastWeek ? 'EXPIRES' : null;
              return (
                <div
                  key={b.questId}
                  data-posting=""
                  data-quest-id={b.questId}
                  data-challenge={b.challenge}
                  data-ease={b.ease}
                  {...(b.commission ? { 'data-commission': '' } : {})}
                  style={{
                    ...ROW_GRID,
                    padding: '9px 6px',
                    borderBottom: '1px dashed #a8905e88',
                    background: b.commission ? '#9c342814' : undefined,
                  }}
                >
                  <span
                    className={`gv-difficulty gv-difficulty--s${EASE_TIER[b.ease]}`}
                    data-difficulty={b.difficulty.id}
                    title={b.difficulty.reason}
                    style={{ margin: 0, fontSize: 14 }}
                  >
                    <i />{b.ease}
                  </span>

                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {b.commission && (
                        <span
                          className="gv-seal"
                          aria-hidden="true"
                          style={{ width: 26, height: 26, fontSize: 11, flex: 'none' }}
                        >
                          V
                        </span>
                      )}
                      <b style={{ fontSize: 16 }}>{b.name}</b>
                      {stamp && (
                        <span
                          style={{
                            fontFamily: 'var(--gv-sans)', fontSize: 10, fontWeight: 800, letterSpacing: 1.6,
                            color: 'var(--gv-red-ink)', border: '1.5px solid var(--gv-red-ink)', borderRadius: 3,
                            padding: '1px 6px', opacity: 0.8,
                          }}
                        >
                          {stamp}
                        </span>
                      )}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--gv-ink-muted)', marginTop: 2 }}>
                      {b.commission
                        ? <span style={{ color: 'var(--gv-red-ink)', fontStyle: 'italic' }}>Marshal&apos;s commission · bonus pay</span>
                        : session.regionName(b.regionId)}
                      {!travel && <span className="gv-marg"> · no road reaches it</span>}
                    </span>
                  </span>

                  <span style={cell}>{b.minLevel}</span>
                  <span style={cell}>{travel ? <>{travel.etaMinutes}<small style={{ fontWeight: 400 }}> min</small></> : '—'}</span>
                  <span style={cell}>{b.rewardGold}<small style={{ fontWeight: 400 }}>g</small></span>
                  <span style={{ ...cell, fontWeight: 400, fontSize: 12.5 }}>wk {b.expiresWeek}</span>

                  <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="gv-btn gv-btn--seal" disabled={active !== null} onClick={() => accept(b.questId)}>
                      Accept
                    </button>
                    <button className="gv-btn" onClick={() => nav({ kind: 'map', questId: b.questId })}>Map</button>
                  </span>
                </div>
              );
            })}

            <p className="gv-notice-foot" style={{ margin: '10px 0 0' }}>
              {regularCount} of {SCHEDULER.maxOpenQuests} spots used · new jobs come each week
            </p>
          </div>
        )}

        <p className="gv-marg" style={{ marginTop: 18 }}>
          Jobs left to expire make the region more dangerous. Saying no is also a choice.
        </p>
      </div>
    </div>
  );
}
