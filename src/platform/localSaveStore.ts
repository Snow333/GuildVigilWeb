/**
 * localStorage SaveStore — the web/itch persistence backend (constraint 6:
 * implementations live in src/platform; the sim only sees the interface).
 * The ~5 MB localStorage cap is the itch demo's slot limiter BY DESIGN;
 * envelope size is logged on save so growth is visible long before it bites.
 * IndexedDB is the designated fallback behind this same interface if it ever does.
 */

import type { SaveEnvelope, SaveSlotMeta, SaveStore } from '@sim/save/saveStore';

const PREFIX = 'gv_save_';

/** Web builds cap slots (the itch demo mechanism). */
export const WEB_MAX_SLOTS = 3;

/** The Storage surface we actually use — injectable for tests and non-DOM hosts. */
export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageSaveStore implements SaveStore {
  private readonly storage: StorageLike;

  constructor(storage?: StorageLike) {
    this.storage = storage ?? (globalThis as { localStorage: StorageLike }).localStorage;
  }

  async list(): Promise<SaveSlotMeta[]> {
    const metas: SaveSlotMeta[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      const raw = this.storage.getItem(key);
      if (!raw) continue;
      try {
        metas.push((JSON.parse(raw) as SaveEnvelope).meta);
      } catch {
        // A corrupt slot lists as absent; load() surfaces the same null. Never fatal.
      }
    }
    metas.sort((a, b) => a.slotId.localeCompare(b.slotId));
    return metas;
  }

  async load(slotId: string): Promise<SaveEnvelope | null> {
    const raw = this.storage.getItem(PREFIX + slotId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SaveEnvelope;
    } catch {
      return null;
    }
  }

  async save(slotId: string, envelope: SaveEnvelope): Promise<void> {
    const json = JSON.stringify(envelope);
    console.log(`[SaveStore] ${slotId}: ${(json.length / 1024).toFixed(1)} KiB`); // the 5 MB canary
    this.storage.setItem(PREFIX + slotId, json);
  }

  async delete(slotId: string): Promise<void> {
    this.storage.removeItem(PREFIX + slotId);
  }

  maxSlots(): number {
    return WEB_MAX_SLOTS;
  }
}
