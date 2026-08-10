/**
 * GameProvider — brief #5 §2: owns the CampaignSession + a version counter.
 * exec(fn) runs a command and bumps the version; screens re-render and re-query.
 * The sim is synchronous (a full dispatch ≤50 ms) — no async state machinery.
 * The ONLY async here is SaveStore, at the title screen and autosave points.
 * Routing is a `screen` discriminated union in React state, not a router dep.
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CampaignSession, type SessionSaveState } from '@sim/campaign/session';
import { starterParty } from '@sim/campaign/starterParty';
import type { SaveStore } from '@sim/save/saveStore';
import { makeEnvelope } from '@platform/envelope';
import { LocalStorageSaveStore } from '@platform/localSaveStore';

export type Screen = { kind: 'title' } | { kind: 'town' };

export interface GameContextValue {
  session: CampaignSession | null;
  /** Bumped by exec after every command — the re-render/re-query signal. */
  version: number;
  screen: Screen;
  store: SaveStore;
  slotId: string | null;
  campaignName: string | null;
  /** Run a session command synchronously; screens re-query on the version bump. */
  exec: <T>(fn: (s: CampaignSession) => T) => T;
  startNew: (slotId: string, name: string) => Promise<void>;
  loadGame: (slotId: string) => Promise<boolean>;
  saveGame: () => Promise<void>;
  quitToTitle: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

/** Campaign identity derives from the player's name for it: same name → same world (seeded by design). */
const slugify = (name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'campaign';

export function GameProvider({ children }: { children: ReactNode }) {
  const [store] = useState<SaveStore>(() => new LocalStorageSaveStore());
  const [session, setSession] = useState<CampaignSession | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const [version, setVersion] = useState(0);

  const exec = useCallback(
    <T,>(fn: (s: CampaignSession) => T): T => {
      if (!session) throw new Error('exec: no campaign in progress');
      const result = fn(session);
      setVersion((v) => v + 1);
      return result;
    },
    [session],
  );

  const saveGame = useCallback(async (): Promise<void> => {
    if (!session || !slotId) return;
    await store.save(slotId, makeEnvelope(session, slotId, campaignName ?? session.campaignId));
  }, [store, session, slotId, campaignName]);

  const startNew = useCallback(
    async (slot: string, name: string): Promise<void> => {
      const slug = slugify(name);
      const fresh = CampaignSession.create({
        campaignId: slug,
        seed: `world_${slug}`,
        party: starterParty(),
      });
      fresh.advanceWeek(); // land in week 1 with a live board
      setSession(fresh);
      setSlotId(slot);
      setCampaignName(name);
      setScreen({ kind: 'town' });
      setVersion((v) => v + 1);
      await store.save(slot, makeEnvelope(fresh, slot, name));
    },
    [store],
  );

  const loadGame = useCallback(
    async (slot: string): Promise<boolean> => {
      const envelope = await store.load(slot);
      if (!envelope) return false;
      const restored = CampaignSession.deserialize(envelope.state as SessionSaveState);
      setSession(restored);
      setSlotId(slot);
      setCampaignName(envelope.meta.name);
      setScreen({ kind: 'town' });
      setVersion((v) => v + 1);
      return true;
    },
    [store],
  );

  const quitToTitle = useCallback((): void => {
    setSession(null);
    setSlotId(null);
    setCampaignName(null);
    setScreen({ kind: 'title' });
  }, []);

  const value: GameContextValue = {
    session, version, screen, store, slotId, campaignName,
    exec, startNew, loadGame, saveGame, quitToTitle,
  };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame outside GameProvider');
  return ctx;
}
