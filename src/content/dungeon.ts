/**
 * Dungeon tunables — the ported generator/hazard tables (decision-ledger Area 3)
 * plus the profile-AI and loot-grammar brief parameters. All balance in data.
 */

/** Graph-level size tiers (ported room budgets; geometry lives in presentation). */
export const DUNGEON_TIERS = {
  tiny: { rooms: 7, vaults: 0, loreRooms: 0, extraEdgeRatio: 0.35 },
  small: { rooms: 10, vaults: 1, loreRooms: 0, extraEdgeRatio: 0.35 },
  medium: { rooms: 16, vaults: 2, loreRooms: 1, extraEdgeRatio: 0.35 },
  large: { rooms: 24, vaults: 3, loreRooms: 2, extraEdgeRatio: 0.35 },
} as const;

export type DungeonTier = keyof typeof DUNGEON_TIERS;

/** Non-preset room typing weights (ported: combat 4 / empty 3 / treasure 2 / trap 1 / shrine 1). */
export const ROOM_TYPE_WEIGHTS: { type: string; weight: number }[] = [
  { type: 'combat', weight: 4 },
  { type: 'empty', weight: 3 },
  { type: 'treasure', weight: 2 },
  { type: 'trap', weight: 1 },
  { type: 'shrine', weight: 1 },
];

/** Hazard math, ported verbatim from dungeon_hazards.gd. */
export const HAZARDS = {
  /** base_dc = 10 + 2·difficulty + tierBonus + party_level/2, ±2 jitter. */
  baseDc: 10,
  difficultyDcScale: 2,
  tierBonus: { tiny: 0, small: 1, medium: 2, large: 3 } as Record<DungeonTier, number>,
  dcJitter: 2,
  trapChanceBase: 0.10,
  trapChancePerDifficulty: 0.05,
  lockChanceBase: 0.05,
  lockChancePerDifficulty: 0.04,
  /** "Tougher hazards guard better loot." */
  roomDcMod: { boss: 4, vault: 4, treasure: 2, shrine: 2, lore: 2 } as Record<string, number>,
  /** Failed attempts retry at DC + 2·retries (anti-softlock, ported). */
  retryDcStep: 2,
} as const;

/** Enemy group sizing by room type; levels band around difficulty. */
export const ENCOUNTERS = {
  combatRoomEnemies: { min: 2, max: 4 },
  bossRoomEnemies: { min: 1, max: 2 },
  corridorEnemyChanceBase: 0.05,
  corridorEnemyChancePerDifficulty: 0.03,
  /** Enemy base_level within [difficulty − 1, difficulty + 1]; boss +1..+2. */
  levelBand: 1,
  bossLevelBonus: 2,
} as const;

/** Loot grammar (brief #3, APPROVED): tier weights by source × difficulty + floors. */
export const LOOT_GRAMMAR = {
  /** Weights [mundane, masterwork, magical, enchanted]; legendary NEVER rolls. */
  tierWeights: {
    enemy: [70, 20, 8, 2],
    cache: [55, 25, 15, 5],
    treasure: [40, 30, 20, 10],
    vault: [0, 30, 45, 25],
    boss: [0, 25, 45, 30],
  } as Record<string, number[]>,
  /** Each difficulty step shifts weight mass upward by this fraction. */
  difficultyShift: 0.06,
  /** Sources whose rolls floor at magical (deterministic guarantees, no pity). */
  floorAtMagical: ['boss', 'vault'],
  /** Property slots by tier (legendary authored-only). */
  propertySlots: { mundane: 0, masterwork: 0, magical: 1, enchanted: 2 } as Record<string, number>,
  /** Gold by source (ported 5–15×level for enemies; room formulas from navigator). */
  enemyGoldPerLevel: { min: 5, max: 15 },
  treasureGold: (difficulty: number) => ({ min: 20 + difficulty * 15, max: (20 + difficulty * 15) * 2 }),
  vaultGold: (difficulty: number) => ({ min: 80 + difficulty * 40, max: (80 + difficulty * 40) * 2 }),
} as const;

/** Mission-profile engine parameters (brief #4, APPROVED). */
export const PROFILES = {
  /** Hard cap on decisions per dispatch — the generalized e++<100 bound. */
  decisionBudget: 400,
  /** Caution → withdraw thresholds (fraction of party HP pool; downed heroes count 0). */
  caution: {
    cautious: { withdrawHpFrac: 0.55, restHpFrac: 0.7 },
    standard: { withdrawHpFrac: 0.35, restHpFrac: 0.5 },
    bold: { withdrawHpFrac: 0.18, restHpFrac: 0.33 },
  } as Record<string, { withdrawHpFrac: number; restHpFrac: number }>,
  /** One rest charge per shrine (activated) / cleared boss room. */
  restHealFrac: 0.5,
  /** Loot & Resources completes at this much collected gold-equivalent value × difficulty. */
  lootRunValueTarget: (difficulty: number) => 150 + difficulty * 100,
} as const;
