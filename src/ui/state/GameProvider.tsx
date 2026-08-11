/**
 * GameProvider — brief #5 §2: owns the CampaignSession + a version counter.
 * exec(fn) runs a command and bumps the version; screens re-render and re-query.
 * The sim is synchronous (a full dispatch ≤50 ms) — no async state machinery.
 * The ONLY async here is SaveStore, at the title screen and autosave points.
 * Routing is a `screen` discriminated union in React state, not a router dep.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CampaignSession, type QuestRecord, type SessionSaveState } from '@sim/campaign/session';
import { musterParty, type MusterChoice } from '@sim/campaign/muster';
import { DEFAULT_SETTINGS, type SaveStore, type UserSettings } from '@sim/save/saveStore';
import { makeEnvelope } from '@platform/envelope';
import { LocalStorageSaveStore } from '@platform/localSaveStore';

export type Screen =
  | { kind: 'title' }
  /** The founding muster stands between "New campaign here" and week 1 (brief #10). */
  | { kind: 'muster'; slotId: string; campaignName: string }
  | { kind: 'town' }
  | { kind: 'hero'; heroId: string }
  | { kind: 'board' }
  | { kind: 'dispatch' }
  | { kind: 'map'; questId: number | null }
  | { kind: 'shop' }
  | { kind: 'playback' }
  | { kind: 'afterAction' }
  | { kind: 'settings' };

/** The launch hand-off: playback + after-action read this, never re-run the sim. */
export interface LaunchContext {
  record: QuestRecord;
  questName: string;
  /** world-stream length at launch — the after-action slice starts here. */
  worldStart: number;
}

export type ReplaySpeed = 1 | 4 | 16;

/** Settings store speeds as plain numbers; presentation narrows to the legal set. */
const asReplaySpeed = (n: number): ReplaySpeed => (n === 1 || n === 16 ? n : 4);

export interface GameContextValue {
  session: CampaignSession | null;
  /** Bumped by exec after every command — the re-render/re-query signal. */
  version: number;
  screen: Screen;
  store: SaveStore;
  slotId: string | null;
  campaignName: string | null;
  lastLaunch: LaunchContext | null;
  lastError: string | null;
  defaultSpeed: ReplaySpeed;
  /** Player-wide flat mode (brief #8 accessibility contract) — persisted via SaveStore. */
  flatMode: boolean;
  setFlatMode: (on: boolean) => void;
  /** Player-wide readable type (brief #9) — independent of flat mode, same record. */
  readableType: boolean;
  setReadableType: (on: boolean) => void;
  nav: (screen: Screen) => void;
  /** Run a session command synchronously; null return = the command refused (see lastError). */
  exec: <T>(fn: (s: CampaignSession) => T) => T | null;
  setLastLaunch: (ctx: LaunchContext | null) => void;
  setDefaultSpeed: (speed: ReplaySpeed) => void;
  /** The founding party is REQUIRED — a campaign cannot start without a muster (brief #10). */
  startNew: (slotId: string, name: string, founding: readonly MusterChoice[]) => Promise<void>;
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
  const [lastLaunch, setLastLaunch] = useState<LaunchContext | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_SETTINGS });

  // Player-wide settings load once per app boot and apply from the title screen
  // on (brief #8: flat mode is a persisted USER setting, not campaign state).
  useEffect(() => {
    void store.loadSettings().then(setSettings);
  }, [store]);

  // body.gv-flat is the single flat-mode switch every converted screen honors.
  useEffect(() => {
    document.body.classList.toggle('gv-flat', settings.flatMode);
  }, [settings.flatMode]);

  // body.gv-readable is the single readable-type switch (brief #9) — the token
  // swap + spacing relaxations key off it; orthogonal to gv-flat by design.
  useEffect(() => {
    document.body.classList.toggle('gv-readable', settings.readableType);
  }, [settings.readableType]);

  const updateSettings = useCallback(
    (patch: Partial<UserSettings>): void => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        void store.saveSettings(next);
        return next;
      });
    },
    [store],
  );

  const setFlatMode = useCallback((on: boolean) => updateSettings({ flatMode: on }), [updateSettings]);
  const setReadableType = useCallback((on: boolean) => updateSettings({ readableType: on }), [updateSettings]);
  const setDefaultSpeed = useCallback((s: ReplaySpeed) => updateSettings({ defaultSpeed: s }), [updateSettings]);

  const nav = useCallback((next: Screen): void => {
    setLastError(null);
    setScreen(next);
  }, []);

  const exec = useCallback(
    <T,>(fn: (s: CampaignSession) => T): T | null => {
      if (!session) throw new Error('exec: no campaign in progress');
      try {
        const result = fn(session);
        setLastError(null);
        return result;
      } catch (e) {
        setLastError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setVersion((v) => v + 1);
      }
    },
    [session],
  );

  const saveGame = useCallback(async (): Promise<void> => {
    if (!session || !slotId) return;
    await store.save(slotId, makeEnvelope(session, slotId, campaignName ?? session.campaignId));
  }, [store, session, slotId, campaignName]);

  const startNew = useCallback(
    async (slot: string, name: string, founding: readonly MusterChoice[]): Promise<void> => {
      const slug = slugify(name);
      // Determinism (brief #10 acceptance): campaignId/seed come from the name
      // and the party from the muster choices — identical choices + identical
      // name reproduce the campaign exactly.
      const fresh = CampaignSession.create({
        campaignId: slug,
        seed: `world_${slug}`,
        party: musterParty(founding),
      });
      fresh.advanceWeek(); // land in week 1 with a live board
      setSession(fresh);
      setSlotId(slot);
      setCampaignName(name);
      setLastLaunch(null);
      nav({ kind: 'town' });
      setVersion((v) => v + 1);
      await store.save(slot, makeEnvelope(fresh, slot, name));
    },
    [store, nav],
  );

  const loadGame = useCallback(
    async (slot: string): Promise<boolean> => {
      const envelope = await store.load(slot);
      if (!envelope) return false;
      const restored = CampaignSession.deserialize(envelope.state as SessionSaveState);
      setSession(restored);
      setSlotId(slot);
      setCampaignName(envelope.meta.name);
      setLastLaunch(null);
      nav({ kind: 'town' });
      setVersion((v) => v + 1);
      return true;
    },
    [store, nav],
  );

  const quitToTitle = useCallback((): void => {
    setSession(null);
    setSlotId(null);
    setCampaignName(null);
    setLastLaunch(null);
    nav({ kind: 'title' });
  }, [nav]);

  const value: GameContextValue = {
    session, version, screen, store, slotId, campaignName, lastLaunch, lastError,
    defaultSpeed: asReplaySpeed(settings.defaultSpeed),
    flatMode: settings.flatMode,
    setFlatMode,
    readableType: settings.readableType,
    setReadableType,
    nav, exec, setLastLaunch, setDefaultSpeed, startNew, loadGame, saveGame, quitToTitle,
  };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame outside GameProvider');
  return ctx;
}
