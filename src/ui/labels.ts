/**
 * Player-facing labels for sim ids (brief #11).
 *
 * `fullExplore` / `bossRush` / `mysteryHunt` / `lootRun` and `cautious` /
 * `standard` / `bold` are SIM IDS. They are carried in the frozen
 * `dispatch.started` payload, so they can never be renamed — but they were never
 * meant to be read by a player either. This file is the only place the desk
 * learns to speak them, and the sim never imports it.
 *
 * Register: the guild's voice (decided at the r01 comp review) — these read as
 * orders given to people, because that is what they are.
 *
 * Every id must have an entry. A totality test enforces it, in the shape of the
 * beat interpreter's "total over the frozen vocabulary" test: a new profile id
 * cannot ship label-less. Lookups still fall back to the raw id rather than
 * rendering blank, per the skip-and-log discipline.
 */

import type { Caution, MissionProfile } from '@sim/dungeon/dispatch';

export interface DisplayLabel {
  /** The order, as the marshal would give it. */
  label: string;
  /** One line of consequence — what this choice actually changes. */
  blurb: string;
}

export const PROFILE_LABELS: Readonly<Record<MissionProfile, DisplayLabel>> = {
  fullExplore: { label: 'Sweep it clean', blurb: 'Every room, every door. Bring it all back.' },
  bossRush: { label: 'Cut out the heart', blurb: "Find what's running it. Ignore the rest." },
  mysteryHunt: { label: 'Follow the thread', blurb: 'Answers before spoils.' },
  lootRun: { label: 'Strip it and go', blurb: 'Purse first. No heroics.' },
};

/**
 * "Caution" was a label AND one of its own values, so the row read
 * "Caution: cautious". The field is NERVE; the values keep their sim ids.
 */
export const CAUTION_LABELS: Readonly<Record<Caution, DisplayLabel>> = {
  cautious: { label: 'Cautious', blurb: 'Retreat early. Live to be paid.' },
  standard: { label: 'Steady', blurb: 'Press while the odds hold.' },
  bold: { label: 'Bold', blurb: 'Push through. Accept the cost.' },
};

/** Never renders blank: an unmapped id degrades to itself. */
export function profileLabel(id: MissionProfile): DisplayLabel {
  return PROFILE_LABELS[id] ?? { label: id, blurb: '' };
}

export function cautionLabel(id: Caution): DisplayLabel {
  return CAUTION_LABELS[id] ?? { label: id, blurb: '' };
}
