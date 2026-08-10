/**
 * SaveEnvelope assembly — platform-side glue between a CampaignSession and the
 * SaveStore interface (constraint 6: the sim only ever sees the interface).
 */

import type { CampaignSession } from '@sim/campaign/session';
import type { SaveEnvelope } from '@sim/save/saveStore';

/** Version of the envelope/state layout, independent of the event schema. */
export const SAVE_SCHEMA_VERSION = 1;

/** FNV-1a over the serialized state — integrity signature (mismatch flags, never rejects). */
export function signState(stateJson: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < stateJson.length; i++) {
    h ^= stateJson.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function makeEnvelope(session: CampaignSession, slotId: string, name: string): SaveEnvelope {
  const state = session.serialize();
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    meta: {
      slotId,
      name,
      savedAtWeek: session.currentWeek(),
      playtimeMinutes: session.currentMinute(), // game-minutes elapsed (real playtime is a Phase 3 nicety)
      schemaVersion: SAVE_SCHEMA_VERSION,
    },
    state,
    sig: signState(JSON.stringify(state)),
  };
}
