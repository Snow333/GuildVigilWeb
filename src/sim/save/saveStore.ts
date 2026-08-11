/**
 * SaveStore — architecture constraint #6. Interface FIRST, before any save code.
 * Implementations: Tauri FS (desktop/mobile), localStorage (web / itch demo cap),
 * in-memory (tests, harnesses). The sim only ever sees this interface.
 */

export interface SaveSlotMeta {
  slotId: string;
  name: string;
  savedAtWeek: number;
  playtimeMinutes: number;
  schemaVersion: number;
}

export interface SaveEnvelope {
  schemaVersion: number;
  meta: SaveSlotMeta;
  /** The full campaign state. Typed richly as the sim grows; opaque here. */
  state: unknown;
  /** Integrity signature; mismatch marks tampered=true but never rejects the save. */
  sig: string;
}

/**
 * Player-wide preferences — NOT campaign state (brief #8: "flat mode is a
 * persisted user setting"). One record beside the slots; accessibility follows
 * the player, so the title screen honors it before any campaign loads.
 * defaultSpeed stays a plain number here — presentation narrows it.
 */
export interface UserSettings {
  v: 1;
  flatMode: boolean;
  defaultSpeed: number;
  /** Readable type (brief #9): swap the desk's period faces for a high-legibility
   *  face with relaxed spacing. Standalone — NOT tied to flat mode. Absent in
   *  old records; the merge-with-defaults load path backfills false. */
  readableType: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = { v: 1, flatMode: false, defaultSpeed: 4, readableType: false };

export interface SaveStore {
  list(): Promise<SaveSlotMeta[]>;
  load(slotId: string): Promise<SaveEnvelope | null>;
  save(slotId: string, envelope: SaveEnvelope): Promise<void>;
  delete(slotId: string): Promise<void>;
  /** Web builds cap slots (itch demo mechanism); desktop returns Infinity. */
  maxSlots(): number;
  /** Player-wide settings; absent or corrupt records resolve to defaults, never fatal. */
  loadSettings(): Promise<UserSettings>;
  saveSettings(settings: UserSettings): Promise<void>;
}

/** In-memory impl for tests and headless harnesses. */
export class MemorySaveStore implements SaveStore {
  private slots = new Map<string, SaveEnvelope>();
  private settings: UserSettings = { ...DEFAULT_SETTINGS };

  async list(): Promise<SaveSlotMeta[]> {
    return [...this.slots.values()].map((e) => e.meta);
  }
  async load(slotId: string): Promise<SaveEnvelope | null> {
    return this.slots.get(slotId) ?? null;
  }
  async save(slotId: string, envelope: SaveEnvelope): Promise<void> {
    this.slots.set(slotId, envelope);
  }
  async delete(slotId: string): Promise<void> {
    this.slots.delete(slotId);
  }
  maxSlots(): number {
    return Number.POSITIVE_INFINITY;
  }
  async loadSettings(): Promise<UserSettings> {
    return { ...this.settings };
  }
  async saveSettings(settings: UserSettings): Promise<void> {
    this.settings = { ...settings };
  }
}

/**
 * Idempotent backfill chain — architecture constraint #8.
 * Each stage early-returns unchanged when there is nothing to do, and seeds any
 * backfilled value on the entity ID so it is stable across reloads.
 * Built BEFORE first release, per the brief. Stages register here as they exist.
 */
export type BackfillStage = (state: unknown) => unknown;

export function runBackfillChain(state: unknown, stages: readonly BackfillStage[]): unknown {
  let cur = state;
  for (const stage of stages) {
    try {
      cur = stage(cur);
    } catch {
      // Graceful degradation, teardown §3.6: a failing stage is skipped, not fatal.
    }
  }
  return cur;
}
