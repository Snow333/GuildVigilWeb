import { describe, expect, it } from 'vitest';
import { autopilotWeek } from '@sim/campaign/campaign';
import { CampaignSession, type SessionSaveState } from '@sim/campaign/session';
import { deriveHeroIdentity } from '@sim/heroes/ancestry';
import { SAVE_BACKFILLS, backfillHeroIdentity } from '@sim/save/backfills';
import { runBackfillChain } from '@sim/save/saveStore';
import { makeEnvelope } from '@platform/envelope';
import { LocalStorageSaveStore, type StorageLike } from '@platform/localSaveStore';
import { starterParty } from '../fixtures/party-fixture';

function stubStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** A save as it existed BEFORE brief #10: no ancestry, no gender on any hero. */
function legacySave(weeks = 3): SessionSaveState {
  const s = CampaignSession.create({ campaignId: 'old', seed: 'world_old', party: starterParty() });
  for (let w = 0; w < weeks; w++) autopilotWeek(s, ['perception', 'athletics', 'thievery']);
  const state = JSON.parse(JSON.stringify(s.serialize())) as SessionSaveState;
  for (const kit of state.party) {
    delete (kit.hero as { ancestry?: unknown }).ancestry;
    delete (kit.hero as { gender?: unknown }).gender;
  }
  return state;
}

describe('the backfill chain (constraint 8) is wired into the real load path', () => {
  it('a pre-#10 save loads, and every hero comes back with an identity', () => {
    const restored = CampaignSession.deserialize(legacySave());
    for (const entry of restored.roster()) {
      expect(entry.ancestry).toBeTypeOf('number');
      expect(['f', 'm']).toContain(entry.gender);
      expect(entry.portraitKey).toMatch(/^hero-[a-z0-9]+-[fm]$/);
    }
  });

  it('BACKFILL DETERMINISM: the same save, loaded twice cold, yields the same faces', () => {
    // The acceptance criterion, literally. Two independent deserializations of
    // byte-identical input — no shared state, no Rng draw, no clock.
    const wire = JSON.stringify(legacySave());
    const a = CampaignSession.deserialize(JSON.parse(wire) as SessionSaveState);
    const b = CampaignSession.deserialize(JSON.parse(wire) as SessionSaveState);
    const faces = (s: CampaignSession) => s.roster().map((r) => `${r.id}:${r.ancestry}:${r.gender}`);
    expect(faces(a)).toEqual(faces(b));
    // ...and it is the id-seeded value, not an arbitrary stable one.
    expect(faces(a)).toEqual(
      a.roster().map((r) => {
        const d = deriveHeroIdentity(r.id);
        return `${r.id}:${d.ancestry}:${d.gender}`;
      }),
    );
  });

  it('survives the full wire trip: legacy save → store → load → deserialize → resave', async () => {
    const store = new LocalStorageSaveStore(stubStorage());
    const legacy = legacySave(2);
    await store.save('slot1', {
      schemaVersion: 1,
      meta: { slotId: 'slot1', name: 'Old Vigil', savedAtWeek: 2, playtimeMinutes: 0, schemaVersion: 1 },
      state: legacy,
      sig: 'ignored',
    });

    const loaded = (await store.load('slot1'))!;
    const session = CampaignSession.deserialize(loaded.state as SessionSaveState);
    const before = session.roster().map((r) => r.portraitKey);

    // The backfilled values PERSIST on the next save (they are not re-derived
    // forever) — reloading the resaved envelope must not shift a single face.
    await store.save('slot1', makeEnvelope(session, 'slot1', 'Old Vigil'));
    const again = CampaignSession.deserialize(
      (await store.load('slot1'))!.state as SessionSaveState,
    );
    expect(again.roster().map((r) => r.portraitKey)).toEqual(before);
    const persisted = (again.serialize() as SessionSaveState).party.map((k) => k.hero.ancestry);
    expect(persisted.every((a) => typeof a === 'number')).toBe(true);
  });

  it('is idempotent and leaves a current save untouched', () => {
    const s = CampaignSession.create({ campaignId: 'now', seed: 'world_now', party: starterParty() });
    const state = s.serialize();
    const once = runBackfillChain(JSON.parse(JSON.stringify(state)), SAVE_BACKFILLS);
    const twice = runBackfillChain(once, SAVE_BACKFILLS);
    expect(once).toEqual(state);
    expect(twice).toEqual(state);
  });

  it('never mutates the caller\'s state object (deserialize clones first)', () => {
    const legacy = legacySave(1);
    CampaignSession.deserialize(legacy);
    expect(legacy.party[0]!.hero).not.toHaveProperty('ancestry');
  });

  it('repairs a hand-edited save whose ancestry left the registry', () => {
    const state = legacySave(1);
    (state.party[0]!.hero as { ancestry?: unknown }).ancestry = 999;
    (state.party[1]!.hero as { gender?: unknown }).gender = 'x';
    const fixed = backfillHeroIdentity(JSON.parse(JSON.stringify(state))) as SessionSaveState;
    expect(fixed.party[0]!.hero.ancestry).toBe(deriveHeroIdentity(fixed.party[0]!.hero.id).ancestry);
    expect(fixed.party[1]!.hero.gender).toBe(deriveHeroIdentity(fixed.party[1]!.hero.id).gender);
  });

  it('degrades gracefully on garbage rather than throwing (teardown §3.6)', () => {
    expect(() => backfillHeroIdentity(null)).not.toThrow();
    expect(() => backfillHeroIdentity({})).not.toThrow();
    expect(() => backfillHeroIdentity({ party: 'nonsense' })).not.toThrow();
    expect(() => backfillHeroIdentity({ party: [null, {}, { hero: {} }] })).not.toThrow();
  });
});
