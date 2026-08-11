import { describe, expect, it } from 'vitest';
import { autopilotWeek } from '@sim/campaign/campaign';
import { CampaignSession, type SessionSaveState } from '@sim/campaign/session';
import { DEFAULT_SETTINGS, MemorySaveStore } from '@sim/save/saveStore';
import { makeEnvelope, signState, SAVE_SCHEMA_VERSION } from '@platform/envelope';
import { LocalStorageSaveStore, WEB_MAX_SLOTS, type StorageLike } from '@platform/localSaveStore';
import { starterParty } from '../fixtures/party-fixture';

/** Map-backed Storage stub — same surface the browser provides. */
function stubStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const playedSession = (weeks: number): CampaignSession => {
  const s = CampaignSession.create({ campaignId: 'store_0', seed: 'world_store_0', party: starterParty() });
  for (let w = 0; w < weeks; w++) autopilotWeek(s, ['perception', 'athletics', 'thievery']);
  return s;
};

describe('LocalStorageSaveStore — the web persistence backend', () => {
  it('save → list → load → delete round-trips an envelope', async () => {
    const store = new LocalStorageSaveStore(stubStorage());
    const session = playedSession(3);
    const envelope = makeEnvelope(session, 'slot1', 'The Vigil');

    await store.save('slot1', envelope);
    const listed = await store.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(envelope.meta);
    expect(listed[0]!.savedAtWeek).toBe(3);
    expect(listed[0]!.schemaVersion).toBe(SAVE_SCHEMA_VERSION);

    const loaded = await store.load('slot1');
    expect(loaded).toEqual(JSON.parse(JSON.stringify(envelope))); // the wire trip is the contract

    await store.delete('slot1');
    expect(await store.list()).toHaveLength(0);
    expect(await store.load('slot1')).toBeNull();
  });

  it('the loaded envelope body reconstructs the EXACT session (2.0 done criterion)', async () => {
    const store = new LocalStorageSaveStore(stubStorage());
    const session = playedSession(5);
    await store.save('slot1', makeEnvelope(session, 'slot1', 'The Vigil'));

    const loaded = (await store.load('slot1'))!;
    const restored = CampaignSession.deserialize(loaded.state as SessionSaveState);
    expect(restored.serialize()).toEqual(session.serialize());
    expect(signState(JSON.stringify(loaded.state))).toBe(loaded.sig); // integrity signature holds
  });

  it('a corrupt slot lists as absent and loads as null — never fatal', async () => {
    const storage = stubStorage();
    storage.setItem('gv_save_bad', '{not json');
    const store = new LocalStorageSaveStore(storage);
    expect(await store.list()).toHaveLength(0);
    expect(await store.load('bad')).toBeNull();
  });

  it('ignores foreign keys and caps web slots', async () => {
    const storage = stubStorage();
    storage.setItem('other_app_key', 'noise');
    const store = new LocalStorageSaveStore(storage);
    expect(await store.list()).toHaveLength(0);
    expect(store.maxSlots()).toBe(WEB_MAX_SLOTS);
  });
});

describe('player-wide settings — brief #8 flat mode + brief #9 readable type (one record)', () => {
  it('round-trips settings; absent, corrupt, and partial records resolve to defaults', async () => {
    const storage = stubStorage();
    const store = new LocalStorageSaveStore(storage);

    expect(await store.loadSettings()).toEqual(DEFAULT_SETTINGS); // absent → defaults

    await store.saveSettings({ v: 1, flatMode: true, defaultSpeed: 16, readableType: true });
    expect(await store.loadSettings()).toEqual({ v: 1, flatMode: true, defaultSpeed: 16, readableType: true });
    expect(await store.list()).toHaveLength(0); // settings never list as a campaign slot

    storage.setItem('gv_settings', '{not json');
    expect(await store.loadSettings()).toEqual(DEFAULT_SETTINGS); // corrupt → defaults, never fatal

    storage.setItem('gv_settings', JSON.stringify({ v: 1, flatMode: true }));
    expect(await store.loadSettings()).toEqual({ ...DEFAULT_SETTINGS, flatMode: true }); // partial backfills

    // The real-world migration case (brief #9): a step-7-era record with no
    // readableType field loads with readableType backfilled false — no bump of v.
    storage.setItem('gv_settings', JSON.stringify({ v: 1, flatMode: true, defaultSpeed: 16 }));
    expect(await store.loadSettings()).toEqual({ v: 1, flatMode: true, defaultSpeed: 16, readableType: false });
  });

  it('the in-memory store honors the same settings surface (tests and harnesses)', async () => {
    const store = new MemorySaveStore();
    expect(await store.loadSettings()).toEqual(DEFAULT_SETTINGS);
    await store.saveSettings({ v: 1, flatMode: true, defaultSpeed: 1, readableType: true });
    expect(await store.loadSettings()).toEqual({ v: 1, flatMode: true, defaultSpeed: 1, readableType: true });
  });
});
