/**
 * Screen 1 — Title / save slots (brief #5 §3). Plain HTML, zero CSS effort;
 * Phase 3 owns beauty. Reads SaveStore.list(); commands: load / delete / new.
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
    <div>
      <h1>GUILD VIGIL</h1>
      <p>— the guild endures, or the map remembers why it didn't —</p>
      <h2>Save slots</h2>
      <table border={1} cellPadding={6}>
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
                <td>{meta ? meta.name : <em>empty</em>}</td>
                <td>{meta ? meta.savedAtWeek : '—'}</td>
                <td>
                  {meta ? (
                    <>
                      <button disabled={busy} onClick={() => void loadGame(slot)}>Load</button>{' '}
                      <button
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
      <p>
        <label>
          Campaign name:{' '}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Vigil" />
        </label>{' '}
        <small>(the name seeds the world — same name, same world)</small>
      </p>
    </div>
  );
}
