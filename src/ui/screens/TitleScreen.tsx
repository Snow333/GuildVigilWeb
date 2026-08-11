/**
 * Screen 1 — Title / save slots (brief #5 §3). Reads SaveStore.list();
 * commands: load / delete / new.
 *
 * Brief #8 rollout: the guildhall charter — the slot ledger sits on a pinned
 * sheet (actionable), the campaign name is written in ink. Load is a plain
 * button; Delete and "New campaign here" are wax seals — both are irreversible
 * commitments (a delete can't be taken back; a new campaign binds the name to
 * its world). The boot e2e's contracts hold: exactly one h1 reading GUILD
 * VIGIL, one slot table with three tbody rows, <em>empty</em> per bare slot.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SaveSlotMeta } from '@sim/save/saveStore';
import { useGame } from '../state/GameProvider';

export function TitleScreen() {
  const { store, startNew, loadGame } = useGame();
  const [metas, setMetas] = useState<Map<string, SaveSlotMeta>>(new Map());
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const list = await store.list();
    setMetas(new Map(list.map((m) => [m.slotId, m])));
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const slotIds = Array.from({ length: store.maxSlots() }, (_, i) => `slot${i + 1}`);

  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '48px 18px 60px', margin: -24 }}>
      <div className="gv-title">
        <h1>GUILD VIGIL</h1>
        <p className="gv-title-motto">— the guild endures, or the map remembers why it didn&apos;t —</p>

        <div className="gv-sheet gv-ledger" style={{ ['--gv-tilt' as never]: '-0.3deg' }}>
          <span className="gv-pin" />
          <h3 className="gv-head">The charter <span className="gv-sub">save slots</span></h3>
          <table>
            <thead>
              <tr>
                <th>Slot</th><th>Campaign</th><th>Week</th><th></th>
              </tr>
            </thead>
            <tbody>
              {slotIds.map((slot) => {
                const meta = metas.get(slot);
                return (
                  <tr key={slot}>
                    <td>{slot}</td>
                    <td>{meta ? <b>{meta.name}</b> : <em>empty</em>}</td>
                    <td>{meta ? meta.savedAtWeek : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {meta ? (
                        <>
                          <button className="gv-btn" disabled={busy} onClick={() => void loadGame(slot)}>Load</button>{' '}
                          <button
                            className="gv-btn gv-btn--seal"
                            disabled={busy}
                            onClick={() => {
                              setBusy(true);
                              void store.delete(slot).then(refresh).finally(() => setBusy(false));
                            }}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <button
                          className="gv-btn gv-btn--seal"
                          disabled={busy || name.trim() === ''}
                          onClick={() => {
                            setBusy(true);
                            void startNew(slot, name.trim()).finally(() => setBusy(false));
                          }}
                        >
                          New campaign here
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ margin: '14px 0 0' }}>
            <label>
              Campaign name:{' '}
              <input className="gv-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Vigil" />
            </label>{' '}
            <span style={{ fontSize: 12, color: 'var(--gv-ink-muted)' }}>
              (the name seeds the world — same name, same world)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
