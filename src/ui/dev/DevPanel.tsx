/**
 * Dev panel (output/working-agreement.md §7): gets Steven to the part of the
 * game he wants to test. Toggle with the ` (backtick) key or the Dev tab.
 * Every button is a real session command, so a save afterwards is a normal save.
 */

import { useEffect, useState } from 'react';
import { autoLevelHero } from '@sim/campaign/campaign';
import { useGame } from '../state/GameProvider';
import { overlayButton } from './overlayStyle';

const row: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '6px 0' };

export function DevPanel() {
  const { session, exec, saveGame, nav } = useGame();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(5);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === '`') setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!session) return null;

  const roster = session.roster();
  const run = (fn: Parameters<typeof exec>[0]): void => {
    exec(fn);
    void saveGame();
  };

  const partyToLevel = (): void =>
    run((s) => {
      for (const h of s.roster()) {
        if (h.status === 'dead') continue;
        for (let guard = 0; guard < 20 && s.heroSheet(h.id).level < target; guard++) {
          s.devGrantLevel(h.id);
          if (autoLevelHero(s, h.id) === 0) break;
        }
      }
    });

  return (
    <div data-gv-dev="" style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 9000, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
      {open ? (
        <div style={{ background: '#1f1a14', color: '#f4ead2', border: '2px solid #c9a75b', borderRadius: 8, padding: 10, width: 360, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Dev panel</strong>
            <button style={overlayButton} onClick={() => setOpen(false)}>Close (`)</button>
          </div>

          <div style={row}>
            <span>Gold {session.goldAmount()}</span>
            <button style={overlayButton} onClick={() => run((s) => s.devAddGold(500))}>+500</button>
            <button style={overlayButton} onClick={() => run((s) => s.devAddGold(5000))}>+5000</button>
          </div>

          <div style={row}>
            <span>Week {session.currentWeek()}</span>
            <button style={overlayButton} onClick={() => run((s) => s.advanceWeek())}>Next week</button>
            <button style={overlayButton} onClick={() => run((s) => s.devClearActive())} disabled={!session.activeQuest()}>
              Clear active quest
            </button>
          </div>

          <div style={row}>
            <button style={overlayButton} onClick={() => run((s) => s.devHealAll())}>Heal + revive all</button>
            <button style={overlayButton} onClick={() => run((s) => s.devRevealMap(!s.devMapRevealed()))}>
              {session.devMapRevealed() ? 'Hide map' : 'Reveal map'}
            </button>
          </div>

          <div style={row}>
            <span>Party to level</span>
            <input
              type="number" min={1} max={20} value={target}
              onChange={(e) => setTarget(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
              style={{ width: 52 }}
            />
            <button style={overlayButton} onClick={partyToLevel}>Go (auto-picks)</button>
          </div>

          <div style={{ borderTop: '1px solid #5a4630', marginTop: 8, paddingTop: 6 }}>
            {roster.map((h) => (
              <div key={h.id} style={row}>
                <span style={{ minWidth: 120 }}>{h.name} L{h.level} {h.status !== 'active' ? `(${h.status})` : ''}</span>
                <button style={overlayButton} onClick={() => run((s) => s.devGrantLevel(h.id))}>+XP to level</button>
                <button style={overlayButton} onClick={() => run((s) => { s.devGrantLevel(h.id); autoLevelHero(s, h.id); })}>+1 level (auto)</button>
                <button style={overlayButton} onClick={() => nav({ kind: 'hero', heroId: h.id })}>Open</button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button style={{ ...overlayButton, opacity: 0.6 }} onClick={() => setOpen(true)} data-gv-dev-open="" title="Dev panel (` key)">
          Dev
        </button>
      )}
    </div>
  );
}
