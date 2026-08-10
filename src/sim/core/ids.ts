/**
 * Entity ID conventions — shared between event payloads and RNG seed namespaces
 * (brief-event-vocabulary.md §ID Conventions). Events and seeds never diverge
 * because both are built from these.
 */
export const Ids = {
  hero: (n: number) => `hero_${n}`,
  party: (n: number) => `party_${n}`,
  dispatch: (n: number) => `disp_${n}`,
  /** Enemy instance within a dispatch. */
  enemy: (dispatchId: string, n: number) => `${dispatchId}:e${n}`,
  /** Room within a layout template. */
  room: (templateId: string, n: number) => `${templateId}:r${n}`,
  edge: (templateId: string, n: number) => `${templateId}:c${n}`,
  combat: (dispatchId: string, n: number) => `${dispatchId}:f${n}`,
} as const;

/** Seed namespace builders — the canonical spellings, so grep finds every stream. */
export const Seeds = {
  dispatch: (dispatchId: string) => `dispatch_${dispatchId}`,
  population: (dispatchId: string, templateId: string) => `pop_${dispatchId}_${templateId}`,
  loot: (dispatchId: string, sourceId: string) => `loot_${dispatchId}_${sourceId}`,
  combat: (combatId: string) => `combat_${combatId}`,
  forecast: (partySize: number, i: number) => `forecast_${partySize}_${i}`,
  worldWeek: (week: number) => `week_${week}`,
  rotation: (buildingId: number, week: number) => `rotation_${buildingId}_${week}`,
} as const;
