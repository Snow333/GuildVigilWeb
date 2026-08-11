/**
 * SaveEnvelope assembly — platform-side glue between a CampaignSession and the
 * SaveStore interface (constraint 6: the sim only ever sees the interface).
 */

import type { CampaignSession } from '@sim/campaign/session';
import { fnv1aHex } from '@sim/core/hash';
import type { SaveEnvelope } from '@sim/save/saveStore';

/** Version of the envelope/state layout, independent of the event schema. */
export const SAVE_SCHEMA_VERSION = 1;

/**
 * FNV-1a over the serialized state — integrity signature (mismatch flags,
 * never rejects). The algorithm moved to @sim/core/hash when brief #10 needed
 * the same hash for deterministic identity backfill; output is byte-identical,
 * so signatures on existing saves still verify (pinned by ancestry.test.ts).
 */
export function signState(stateJson: string): string {
  return fnv1aHex(stateJson);
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
