/**
 * Per-dispatch population — the runtime half of the graph-first split.
 * Room typing, hazards (ported formulas), enemy groups from the registry,
 * clue placement, rest charges. All seeded on the dispatch (constraint 5).
 */

import { DUNGEON_TIERS, ENCOUNTERS, HAZARDS, ROOM_TYPE_WEIGHTS } from '@content/dungeon';
import { enemies } from '@content/generated';
import { Rng } from '@sim/core/rng';
import { bfsDepths, type DungeonTemplate } from './graph';

export interface RoomHazard {
  dc: number;
  detected?: boolean;
}

export interface PopulatedRoom {
  n: number;
  type: string; // entrance | boss | vault | lore | combat | empty | treasure | trap | shrine
  trap: RoomHazard | null;
  lock: RoomHazard | null;
  /** Registry enemy ids for combat/boss rooms. */
  enemyIds: number[];
  hasClue: boolean;
  restCharge: boolean;
}

export interface PopulatedDungeon {
  template: DungeonTemplate;
  difficulty: number;
  rooms: Map<number, PopulatedRoom>;
}

function hazardDc(difficulty: number, tier: keyof typeof DUNGEON_TIERS, partyLevel: number, roomType: string, rng: Rng): number {
  const base =
    HAZARDS.baseDc + HAZARDS.difficultyDcScale * difficulty + HAZARDS.tierBonus[tier] + Math.floor(partyLevel / 2);
  const mod = HAZARDS.roomDcMod[roomType] ?? 0;
  return base + mod + rng.int(-HAZARDS.dcJitter, HAZARDS.dcJitter);
}

/**
 * Threat-budgeted picks (career-harness finding, 1.5): `count` is a budget in
 * AT-DIFFICULTY enemy equivalents, and a pick above difficulty costs 2^Δ slots.
 * Without this, a difficulty-2 room could roll four level-3 enemies — an
 * extreme+ encounter sold as a routine room. Below-difficulty picks still cost
 * a full slot (chaff floods no one).
 */
function pickEnemies(budget: number, minLevel: number, maxLevel: number, difficulty: number, rng: Rng): number[] {
  const band = enemies.filter((e) => e.base_level >= minLevel && e.base_level <= maxLevel);
  const pool = band.length > 0 ? band : enemies.filter((e) => e.base_level <= Math.max(maxLevel, 1));
  const out: number[] = [];
  let spent = 0;
  while (spent < budget) {
    const e = rng.pick(pool);
    const cost = Math.max(1, Math.pow(2, e.base_level - difficulty));
    if (spent + cost > budget && out.length > 0) break; // over budget — the room is full
    out.push(e.id);
    spent += cost;
  }
  return out;
}

export function populate(
  template: DungeonTemplate,
  seed: string,
  difficulty: number,
  partyLevel: number,
  /** Authored boss-room roster (brief #6): quest-pinned climaxes skip the band roll. */
  bossRoster?: readonly number[],
): PopulatedDungeon {
  const rng = new Rng(`pop_${seed}_${template.templateId}`);
  const rooms = new Map<number, PopulatedRoom>();
  const minL = Math.max(difficulty - ENCOUNTERS.levelBand, 1);
  const maxL = difficulty + ENCOUNTERS.levelBand;

  // Clue goes in the first lore room; tiers without one (tiny, small) use the
  // deepest room that is neither the entrance, the boss, nor a VAULT. Vaults
  // are excluded because they are always locked and carry roomDcMod 4 — on
  // `small` the single vault IS the deepest non-boss node, so the clue sat
  // behind an impossible DC and `mysteryHunt` still failed ~40% of runs even
  // once the pickup itself was fixed. Draws no RNG: room types, template ids
  // and stream hashes are unaffected by this choice.
  const depths = bfsDepths(template.nodes);
  const loreNodes = template.nodes.filter((n) => n.preset === 'lore').map((n) => n.n);
  const clueNode = loreNodes.length > 0
    ? loreNodes[0]!
    : template.nodes
        .filter((n) => n.preset !== 'boss' && n.preset !== 'vault' && n.n !== 0)
        .sort((a, b) => depths[b.n]! - depths[a.n]! || a.n - b.n)[0]!.n;

  for (const node of template.nodes) {
    let type: string = node.preset;
    if (node.preset === 'open') {
      type = rng.weightedPick(ROOM_TYPE_WEIGHTS, ROOM_TYPE_WEIGHTS.map((w) => w.weight)).type;
    }

    // Hazards — ported exemptions: entrance has none; boss rooms never trapped.
    let trap: RoomHazard | null = null;
    let lock: RoomHazard | null = null;
    if (node.preset !== 'entrance') {
      const trapChance = HAZARDS.trapChanceBase + HAZARDS.trapChancePerDifficulty * difficulty;
      const lockChance = HAZARDS.lockChanceBase + HAZARDS.lockChancePerDifficulty * difficulty;
      const forceTrap = type === 'trap'; // typed trap rooms always carry one
      if (type !== 'boss' && (forceTrap || rng.chance(trapChance))) {
        trap = { dc: hazardDc(difficulty, template.tier, partyLevel, type, rng) };
      }
      if (rng.chance(lockChance) || type === 'vault') {
        lock = { dc: hazardDc(difficulty, template.tier, partyLevel, type, rng) };
      }
    }

    let enemyIds: number[] = [];
    if (type === 'combat') {
      enemyIds = pickEnemies(rng.int(ENCOUNTERS.combatRoomEnemies.min, ENCOUNTERS.combatRoomEnemies.max), minL, maxL, difficulty, rng);
    } else if (type === 'boss') {
      if (bossRoster && bossRoster.length > 0) {
        enemyIds = [...bossRoster]; // the quest authored this fight
      } else {
        // Boss rooms budget at their own elevated level — the spike is the point.
        enemyIds = pickEnemies(
          rng.int(ENCOUNTERS.bossRoomEnemies.min, ENCOUNTERS.bossRoomEnemies.max),
          difficulty + 1,
          difficulty + ENCOUNTERS.bossLevelBonus,
          difficulty + 1,
          rng,
        );
      }
    }

    rooms.set(node.n, {
      n: node.n,
      type,
      trap,
      lock,
      enemyIds,
      hasClue: node.n === clueNode,
      restCharge: type === 'shrine' || type === 'boss',
    });
  }

  return { template, difficulty, rooms };
}
