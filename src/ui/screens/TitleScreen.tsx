/**
 * Screen 1 — Title / save slots (brief #5 §3). Reads SaveStore.list();
 * commands: load / delete / new.
 *
 * Brief #8 rollout: the guildhall charter — the slot ledger sits on a pinned
 * sheet (actionable), the campaign name is written in ink. Load is a plain
 * button; Delete is a wax seal (a delete can't be taken back).
 *
 * Brief #10 grammar shift: "New campaign here" was a wax seal when it started
 * the campaign outright. It now opens the FOUNDING MUSTER, so it is a plain
 * button — the seal moved to "Sign the charter", where the commitment actually
 * happens. One meaning per affordance: navigation is not commitment.
 *
 * Brief #11 reading order: the campaign-name field moved ABOVE the slots,
 * because it is the prerequisite for every button below it — the screen used to
 * open with three controls that did nothing and no visible reason why. The slot
 * table became a slot LIST: the campaign name is the row's subject, and slot
 * number and week are a small-caps line beneath it (the Week column held three
 * em-dashes across a third of the sheet). The e2e slot contract moved with it —
 * [data-slot] per row, <em>empty</em> per bare slot — and boot.spec.ts was
 * updated in the same commit.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SaveSlotMeta } from '@sim/save/saveStore';
import { useGame } from '../state/GameProvider';

export function TitleScreen() {
  const { store, nav, loadGame } = useGame();
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

        <div className="gv-sheet gv-charter" style={{ ['--gv-tilt' as never]: '-0.3deg' }}>
          <span className="gv-pin gv-pin--inset" />
          <h3 className="gv-head gv-head--pinned">
            The charter <span className="gv-sub">name the guild, then choose a slot</span>
          </h3>

          {/* the name is the PREREQUISITE for every button below, so it reads first */}
          <p className="gv-namefield">
            <label htmlFor="gv-campaign-name">campaign name</label>
            <input
              id="gv-campaign-name"
              className="gv-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="The Vigil"
            />
          </p>
          <p className="gv-filenote gv-italic" style={{ margin: 0 }}>
            the name seeds the world — same name, same world
          </p>

          <ul className="gv-slotlist">
            {slotIds.map((slot, i) => {
              const meta = metas.get(slot);
              return (
                <li className="gv-slotrow" key={slot} data-slot={slot}>
                  <span className="gv-slotwho">
                    <span className="gv-slotname">{meta ? <b>{meta.name}</b> : <em>empty</em>}</span>
                    <span className="gv-slotsub">
                      slot {i + 1}{meta ? ` · week ${meta.savedAtWeek}` : ''}
                    </span>
                  </span>
                  <span className="gv-slotact">
                    {meta ? (
                      <span className="gv-slotpair">
                        <button className="gv-btn" disabled={busy} onClick={() => void loadGame(slot)}>Load</button>
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
                      </span>
                    ) : (
                      <button
                        className="gv-btn"
                        disabled={busy || name.trim() === ''}
                        onClick={() => nav({ kind: 'muster', slotId: slot, campaignName: name.trim() })}
                      >
                        New campaign
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
