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

/**
 * Generated-art keys — art-style-bible §4 filename discipline, executable.
 * `{class}-{subject}`, matching what tools/build-portraits.mjs derives from the
 * accepted originals. TWO slug rules, because the bible uses two: inside a hero
 * subject `-` separates FIELDS (ancestry-gender), so the ancestry squashes
 * ("Half-Orc" → `hero-halforc-f`); an NPC's subject is just their name, so its
 * words hyphenate ("Edrin Vale" → `npc-edrin-vale`).
 */
export const ArtKeys = {
  hero: (ancestryName: string, gender: 'f' | 'm') =>
    `hero-${ancestryName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${gender}`,
  npc: (name: string) => `npc-${ArtKeys.words(name)}`,
  enemy: (name: string) => `enemy-${ArtKeys.words(name)}`,
  /** lowercase, words joined by `-`, everything else dropped. */
  words: (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
} as const;

/** Seed namespace builders — the canonical spellings, so grep finds every stream. */
export const Seeds = {
  dispatch: (dispatchId: string) => `dispatch_${dispatchId}`,
  campaign: (campaignId: string) => `campaign_${campaignId}`,
  poi: (worldSeed: number, poiId: number) => `poi_${worldSeed}_${poiId}`,
  /** Placement seed for quests WITHOUT an authored POI (poi_id null) — per quest, never shared. */
  questPoi: (worldSeed: number, questId: number) => `poi_${worldSeed}_q${questId}`,
  ambush: (campaignId: string, week: number) => `ambush_${campaignId}_w${week}`,
  population: (dispatchId: string, templateId: string) => `pop_${dispatchId}_${templateId}`,
  loot: (dispatchId: string, sourceId: string) => `loot_${dispatchId}_${sourceId}`,
  combat: (combatId: string) => `combat_${combatId}`,
  forecast: (partySize: number, i: number) => `forecast_${partySize}_${i}`,
  worldWeek: (week: number) => `week_${week}`,
  rotation: (buildingId: number, week: number) => `rotation_${buildingId}_${week}`,
} as const;
