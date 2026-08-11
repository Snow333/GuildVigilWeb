/**
 * Screen 9 — Settings (brief #5 §3): replay speed default + save management.
 *
 * Brief #8 rollout step 7: the preferences sheet is pinned (actionable);
 * choices read as pressed buttons. Flat mode is the accessibility contract
 * made real — a persisted PLAYER-WIDE setting (SaveStore settings record):
 * ornament off, every number and label intact, honored from the title screen
 * on. The e2e persistence spec reads [data-flat-on]/[data-flat-off].
 */

import { useGame, type ReplaySpeed } from '../state/GameProvider';

export function SettingsScreen() {
  const { nav, defaultSpeed, setDefaultSpeed, flatMode, setFlatMode, readableType, setReadableType, saveGame, quitToTitle, slotId } = useGame();
  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-settings">
        <h1>Settings</h1>
        <p style={{ margin: '0 0 18px' }}>
          <button className="gv-btn" onClick={() => nav({ kind: 'town' })}>◂ Town</button>
        </p>

        <div className="gv-sheet" style={{ ['--gv-tilt' as never]: '-0.3deg' }}>
          <span className="gv-pin" />
          <h3 className="gv-head">Preferences <span className="gv-sub">player-wide · kept between sessions</span></h3>

          <div className="gv-choice">
            <span className="gv-choice-label">Flat mode</span>
            <button className="gv-btn" data-flat-on="" disabled={flatMode} onClick={() => setFlatMode(true)}>
              On
            </button>
            <button className="gv-btn" data-flat-off="" disabled={!flatMode} onClick={() => setFlatMode(false)}>
              Off
            </button>
            <span style={{ fontSize: 12, color: 'var(--gv-ink-muted)' }}>
              ornament off — every number, label, and action stays
            </span>
          </div>

          <div className="gv-choice">
            <span className="gv-choice-label">Readable type</span>
            <button className="gv-btn" data-readable-on="" disabled={readableType} onClick={() => setReadableType(true)}>
              On
            </button>
            <button className="gv-btn" data-readable-off="" disabled={!readableType} onClick={() => setReadableType(false)}>
              Off
            </button>
            <span style={{ fontSize: 12, color: 'var(--gv-ink-muted)' }}>
              high-legibility face, spacing relaxed — the desk stays
            </span>
          </div>

          <div className="gv-choice">
            <span className="gv-choice-label">Replay speed</span>
            {([1, 4, 16] as ReplaySpeed[]).map((s) => (
              <button key={s} className="gv-btn" disabled={defaultSpeed === s} onClick={() => setDefaultSpeed(s)}>
                {s}×
              </button>
            ))}
            <span style={{ fontSize: 12, color: 'var(--gv-ink-muted)' }}>default for dispatch playback</span>
          </div>
        </div>

        <div className="gv-sheet gv-sheet--aged" style={{ maxWidth: 460, ['--gv-tilt' as never]: '0.35deg' }}>
          <span className="gv-pin" />
          <h3 className="gv-head">Saves <span className="gv-sub">the charter holds the slots</span></h3>
          <p style={{ margin: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="gv-btn" onClick={() => void saveGame()}>Save now{slotId ? ` (${slotId})` : ''}</button>
            <button className="gv-btn gv-btn--ghost" onClick={quitToTitle}>Quit to title</button>
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--gv-ink-muted)' }}>
            Slot management lives on the title screen.
          </p>
        </div>
      </div>
    </div>
  );
}
