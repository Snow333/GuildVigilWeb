/**
 * World & campaign tunables — the LOCKED terrain/travel tables, the escalation
 * brief's weights and tier effects, scheduler and clock parameters.
 */

/** Map + terrain (ported: 80×60, thresholds from world_map_terrain_gen.gd). */
export const WORLD = {
  width: 80,
  height: 60,
  haven: { x: 16, y: 38 },
  havenPlainsRadius: 4.0,
  classify: {
    mountainAbove: 0.42,
    waterBelow: -0.4,
    snowElevAbove: 0.22,
    snowMoistBelow: -0.15,
    forestMoistAbove: 0.18,
    forestElevAbove: -0.12,
  },
  roadMargin: 3,
} as const;

/** LOCKED terrain costs (999 = impassable). */
export const TERRAIN_COST: Record<string, number> = {
  road: 0.55, plains: 1.0, forest: 1.8, snow: 2.2, mountain: 999, water: 999,
};

/** LOCKED travel: 0.75 tiles/sec base, horses ×1.8; minutes derive from cost. */
export const TRAVEL = {
  baseTilesPerSecond: 0.75,
  horseMultiplier: 1.8,
  /** Game-minutes per cost-1 tile at base speed (clock is game-minutes). */
  minutesPerTile: 2,
} as const;

/** Clock: game-minutes; one week per the locked design. */
export const CLOCK = { minutesPerWeek: 7 * 24 * 60 } as const;

/** Escalation (brief #2): fact weights, tiers, effects, Haven cap. */
export const ESCALATION = {
  weights: {
    quest_failed: 3, quest_expired: 2, dispatch_wiped: 4,
    quest_completed: -3, camp_cleared: -2, poi_recaptured: -2, liberation_completed: -8,
    villain_beat_fired: 0, floor_raised: 0,
  } as Record<string, number>,
  /** Tier thresholds on the score; hysteresis on the way down. */
  tiers: [
    { tier: 0, name: 'Quiet', min: -Infinity },
    { tier: 1, name: 'Restless', min: 3 },
    { tier: 2, name: 'Threatened', min: 7 },
    { tier: 3, name: 'Overrun', min: 12 },
  ],
  hysteresis: 1,
  /** Haven's home region hard-caps below Overrun. */
  havenRegionCapTier: 2,
  /** Tier effects consumed by travel/scheduler/economy. */
  effects: [
    { ambushMult: 0.5, questLevelDrift: 0, poiIncomeFrac: 1 },
    { ambushMult: 1.0, questLevelDrift: 0, poiIncomeFrac: 1 },
    { ambushMult: 2.0, questLevelDrift: 1, poiIncomeFrac: 0.5 },
    { ambushMult: 3.0, questLevelDrift: 2, poiIncomeFrac: 0 },
  ],
  baseAmbushChance: 0.05,
} as const;

/** Scheduler v1: the authored pool (12 quests today), posted by level band. */
export const SCHEDULER = {
  maxOpenQuests: 4,
  expiryWeeks: 2,
  /** Post quests within [partyLevel − 1, partyLevel + 2 + pressure drift]. */
  levelBandBelow: 1,
  levelBandAbove: 2,
} as const;
