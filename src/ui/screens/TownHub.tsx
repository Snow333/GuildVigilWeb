/**
 * Screen 2 — Town hub (brief #5 §3): the chapter-loop home; nav to everything.
 * Every displayed number comes from a session query — the UI never computes a
 * rule. Advance Week is an autosave point.
 *
 * Brief #8 rollout step 2: the hub speaks the desk grammar — deskbar plates
 * carry the explicit numbers (e2e's save/reload identity check reads
 * [data-town-status]); the Marshal's dialogue is a letter on the blotter;
 * roster is the taped guild ledger; pressure is the watch report with
 * label-paired status chips. Behavior and queries are unchanged from Phase 2.
 */

import { REGION_IDS } from '@sim/campaign/session';
import type { HeroStatus } from '@sim/heroes/types';
import { useGame } from '../state/GameProvider';

/** Status → frozen chip class; the chip's own text is the pairing label. */
const STATUS_CHIP: Record<HeroStatus, string> = {
  active: 'gv-chip--s0',
  benched: 'gv-chip--s1',
  dead: 'gv-chip--s3',
};

/** Pressure bar scale: Overrun starts at 12; 16 ≈ deep-red headroom. */
const PRESSURE_SCALE = 16;

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

  const dialogue = session.pendingDialogue();

  const advance = (): void => {
    exec((s) => s.advanceWeek());
    void saveGame(); // autosave point (brief §2)
  };

  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-town">
        <div className="gv-town-full">
          <h1>{campaignName ?? session.campaignId} — Town Hub</h1>
          <div className="gv-deskbar" data-town-status="" style={{ marginBottom: 22 }}>
            <span className="gv-plate">WEEK <b>{week}</b></span>
            <span className="gv-plate">GOLD <b>{gold}</b></span>
            <span className="gv-plate">STASH <b>{stashCount}</b></span>
            <span className="gv-plate">PARTY LEVEL <b>{session.partyLevel()}</b></span>
          </div>
          {lastError && <p className="gv-marg" style={{ margin: '0 0 14px' }}><b>!</b> {lastError}</p>}
        </div>

        <div>
          {dialogue.length > 0 && (
            <div className="gv-pad" style={{ marginBottom: 22 }}>
              <div className="gv-sheet" style={{ marginBottom: 0, ['--gv-tilt' as never]: '0.35deg' }}>
                <h3 className="gv-head">The Marshal&apos;s Table <span className="gv-sub">correspondence</span></h3>
                {dialogue.map((d) => (
                  <div key={d.id} style={{ position: 'relative', maxWidth: 640 }}>
                    <blockquote style={{ fontSize: 13.5, lineHeight: 1.65, margin: '0 0 6px' }}>
                      &ldquo;{d.text}&rdquo;
                      <div style={{ fontStyle: 'italic', marginTop: 6, color: 'var(--gv-ink-soft)' }}>
                        — {d.speaker}
                      </div>
                    </blockquote>
                    {d.choices.length > 0 && (
                      <p style={{ margin: '8px 0 10px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {d.choices.map((c, i) => (
                          <button key={i} className={i === 0 ? 'gv-btn gv-btn--seal' : 'gv-btn'}>{c.label}</button>
                        ))}
                      </p>
                    )}
                  </div>
                ))}
                <span className="gv-seal" style={{ position: 'absolute', right: 16, bottom: 12 }}>V</span>
              </div>
            </div>
          )}

          <div className="gv-sheet gv-sheet--aged gv-ledger" style={{ ['--gv-tilt' as never]: '0.3deg' }}>
            <span className="gv-tape" />
            <h3 className="gv-head">Roster <span className="gv-sub">the guild ledger</span></h3>
            <table>
              <thead>
                <tr>
                  <th>Hero</th><th>Level</th><th>XP</th><th>Max HP</th><th>Wounded</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {roster.map((h) => (
                  <tr key={h.id}>
                    <td><b>{h.name}</b></td>
                    <td>{h.level}</td>
                    <td>{h.xp.atCap ? 'CAP' : `${h.xp.progress}/${h.xp.threshold}`}</td>
                    <td>{h.maxHp}</td>
                    <td>{h.wounded > 0 ? <span className="gv-marg">{h.wounded}</span> : h.wounded}</td>
                    <td><span className={`gv-chip ${STATUS_CHIP[h.status]}`}><i />{h.status}</span></td>
                    <td>
                      <button className="gv-btn" onClick={() => nav({ kind: 'hero', heroId: h.id })}>
                        Open{session.heroSheet(h.id).canLevelUp ? ' ● level up!' : ''}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="gv-sheet" style={{ ['--gv-tilt' as never]: '-0.35deg' }}>
            <span className="gv-pin" />
            <h3 className="gv-head">Orders <span className="gv-sub">the week&apos;s desk</span></h3>
            <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: 0 }}>
              <button className="gv-btn gv-btn--seal" onClick={advance}>Advance Week ▸</button>
              <button className="gv-btn" onClick={() => nav({ kind: 'board' })}>Quest board ({board.length})</button>
              {active && (
                <button className="gv-btn" onClick={() => nav({ kind: 'dispatch' })}>
                  Dispatch: quest #{active.questId} ▸
                </button>
              )}
              <button className="gv-btn" onClick={() => nav({ kind: 'map', questId: null })}>World map</button>
              <button className="gv-btn" onClick={() => nav({ kind: 'shop' })}>Shop</button>
              <button className="gv-btn" onClick={() => nav({ kind: 'settings' })}>Settings</button>
              <button className="gv-btn" onClick={() => void saveGame()}>Save</button>
              <button className="gv-btn gv-btn--ghost" onClick={quitToTitle}>Quit to title</button>
            </p>
          </div>

          <div className="gv-sheet gv-sheet--aged" style={{ ['--gv-tilt' as never]: '-0.4deg' }}>
            <span className="gv-tape" />
            <h3 className="gv-head">Regional pressure <span className="gv-sub">the watch report</span></h3>
            {regions.map((r) => (
              <div className="gv-meter" key={r.regionId}>
                <span>{session.regionName(r.regionId)}</span>
                <span className={`gv-chip gv-chip--s${r.tier}`}><i />T{r.tier} {r.tierName}</span>
                <div className={`gv-bar gv-bar--s${r.tier}`}>
                  <i style={{ width: `${Math.min(100, Math.round((r.score / PRESSURE_SCALE) * 100))}%` }} />
                </div>
                <span className="gv-tno">{r.score}</span>
              </div>
            ))}
            <p className="gv-marg" style={{ marginTop: 10, marginBottom: 0 }}>
              unaccepted postings expire — and expiry feeds escalation. the board is how you push back.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
