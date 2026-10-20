/**
 * The band screen (M4) — the few sequences that CHANGE the session.
 *
 * Kept apart from `bandPicks.ts` (which only reads) so a variant-C component
 * reuses both unchanged: read with `readBands`, act with these. No React, no
 * DOM. Each function is one `exec` closure's worth of work, so a refusal from
 * the sim surfaces as `lastError` verbatim.
 */

import type { CampaignSession, DispatchConfig, QuestRecord } from '@sim/campaign/session';

export type BandActor = Pick<
  CampaignSession,
  'acceptQuest' | 'abandonQuest' | 'configureDispatch' | 'launchDispatch' | 'activeByParty' | 'assignHero'
>;

/**
 * What a one-click Send marches with: the same defaults the Dispatch screen
 * opens on (explore everything, standard nerve). The grid is the fast path;
 * the Quest board and Dispatch screen are still there for other orders.
 */
export const DEFAULT_ORDERS: DispatchConfig = { profile: 'fullExplore', caution: 'standard' };

/**
 * Send a band: take the job, then march. ONE step for the player, two for the sim.
 *
 * ⚠ IF THE MARCH FAILS AFTER THE JOB WAS TAKEN, GIVE THE JOB BACK. A band that
 * holds a job is "out", and an out band cannot be reshuffled — so a half-done
 * send would leave the band locked on work it never started. The original
 * error is rethrown untouched, so the player reads the sim's own sentence.
 */
export function sendBand(
  s: BandActor,
  bandIndex: number,
  questId: number,
  orders: DispatchConfig = DEFAULT_ORDERS,
): QuestRecord {
  s.acceptQuest(questId, bandIndex);
  try {
    s.configureDispatch(orders);
    return s.launchDispatch(bandIndex);
  } catch (e) {
    if (s.activeByParty()[bandIndex]) s.abandonQuest(bandIndex);
    throw e;
  }
}

/** March a band that already holds a job (it was accepted from the Quest board and never launched). */
export function launchHeld(s: BandActor, bandIndex: number, orders: DispatchConfig = DEFAULT_ORDERS): QuestRecord {
  s.configureDispatch(orders);
  return s.launchDispatch(bandIndex);
}

/** Give a held job back to the board. No penalty (the sim's own rule). */
export function callBack(s: BandActor, bandIndex: number): void {
  s.abandonQuest(bandIndex);
}

/** Move a hero into a band, or to the hall with `null`. */
export function moveHero(s: BandActor, heroId: string, to: number | null): void {
  s.assignHero(heroId, to);
}
