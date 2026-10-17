/**
 * Mid-level quests, ids 1000+ (Track Q2, M2).
 *
 * WHY THIS FILE EXISTS. The generated table holds 12 repeatable quests, and
 * past min_level 7 it holds exactly one (the Lich's Tower, level 10). The weekly
 * posting draw only offers quests inside [partyLevel − 1, partyLevel + 2], and
 * every posting sits out a cooldown after it expires or is completed, so a
 * guild at level 8+ saw one or two jobs and then none. This file fills every
 * level from 6 to 15 so the board always has something to post.
 *
 * Same row shape as `earlyQuests.ts`; `src/sim/registry` merges both into
 * `questsById`, so launch, XP, the board and the map treat these like any quest.
 * Every row here is repeatable (no storyline), and none is early-only.
 *
 * ENEMIES. Only existing rows are used. The roster tops out at base level 12
 * (one Adult Red Dragon); the dungeon builder draws rooms from
 * [difficulty − 1, difficulty + 1], so dungeon levels past 9 are all lich and
 * dragon rooms. The top bands therefore lean on authored boss rooms and on
 * stand-up fights with authored groups. Those groups use ogres, trolls,
 * minotaurs, orcs, giants and dragons: wraiths, vampire lords, liches and
 * cult leaders beat a level-9+ party 100% of the time even in packs of five
 * (measured), so a group built from them is not a fight. Enemy ids: 8 giant spider, 9 cultist,
 * 11 orc warrior, 12 ghoul, 13 bugbear, 14 minotaur, 15 wight, 16 ogre,
 * 17 troll, 18 wraith, 19 cult leader, 20 dragon wyrmling, 21 vampire lord,
 * 22 hill giant chief, 23 lich, 24 adult red dragon, 108 orc breaker,
 * 109 grave-whisperer, 110 hobgoblin legionnaire, 111 warg alpha, 112 orc
 * siege-hand, 113 Krathite field necromancer, 114 hobgoblin tactician,
 * 115 barrow wight, 116 siege engine crew, 117 vanguard champion,
 * 118 the Whisper's Blade.
 *
 * REWARDS follow the curve the generated level 5–7 quests already set:
 * about 100 XP per quest level for a fair job, less for an easy one, more for
 * a hard one, with gold at 1.25 × XP (Cult of the Dark Flame 500 xp / 600 g;
 * Dragon's Lair 800 / 1000; Lich's Tower 1500 / 2000). The level step is
 * 1000 × level (`heroes/xp.ts`), so a fair job is a tenth of a level on its own
 * and the monsters killed along the way add the rest. Measured, not guessed:
 * tests/campaign/midBoard.test.ts checks the curve and the pacing.
 */

import type { QuestRow } from './earlyQuests';

const group = (...g: [enemyId: number, count: number][]): string =>
  JSON.stringify(g.map(([enemy_id, count]) => ({ enemy_id, count })));

/** How hard a job pays for: easy < fair < hard. */
type Weight = 'easy' | 'fair' | 'hard';
const WEIGHT: Record<Weight, number> = { easy: 0.8, fair: 1.0, hard: 1.25 };

/** XP for a job of quest level `level`; gold is 1.25 × XP; both round to 10. */
export function midReward(level: number, weight: Weight): { xp: number; gold: number } {
  const xp = Math.round((level * 100 * WEIGHT[weight]) / 10) * 10;
  return { xp, gold: Math.round((xp * 1.25) / 10) * 10 };
}

const reputationFor = (level: number, weight: Weight): number =>
  5 * Math.round(level / 2) + (weight === 'hard' ? 5 : 0);

/** A stand-up fight against an authored group. Quest level = challenge. */
const fight = (
  id: number, name: string, description: string, level: number, weight: Weight, enemies: string,
): QuestRow => {
  const { xp, gold } = midReward(level, weight);
  return {
    id, name, description, quest_type: 'combat', min_level: level,
    reward_gold: gold, reward_xp: xp, reward_items: '[]', reward_reputation: reputationFor(level, weight),
    poi_id: null, dungeon_level: null, enemy_group: enemies, prerequisites: '{}',
  };
};

/**
 * A dungeon. `depth` is the dungeon level (what the rooms are built from), and
 * is usually BELOW the quest level: the combat curve above depth 6 is steep
 * (a level-8 party completes depth 6 about half the time, depth 7 about a
 * quarter), so the jobs a mid-level guild can actually finish sit lower.
 * `boss` pins the boss room; leave it out to let the dungeon roll its own.
 */
const dungeon = (
  id: number, name: string, description: string, level: number, depth: number, weight: Weight,
  boss?: string,
): QuestRow => {
  const { xp, gold } = midReward(level, weight);
  return {
    id, name, description, quest_type: 'dungeon', min_level: level,
    reward_gold: gold, reward_xp: xp, reward_items: '[]', reward_reputation: reputationFor(level, weight),
    poi_id: null, dungeon_level: depth, enemy_group: boss ?? null, prerequisites: '{}',
  };
};

export const MID_QUESTS: readonly QuestRow[] = [
  // ── Level 6 ──────────────────────────────────────────────────────────────
  dungeon(1000, 'The Flooded Cellars', 'Spring water opened old cellars under the mill. Something moves down there.', 6, 3, 'easy'),
  dungeon(1001, "Smugglers' Warren", 'Smugglers dug a warren under the market. Clear it out.', 6, 4, 'fair'),
  dungeon(1002, 'The Bone Quarry', 'Bones keep turning up at the stone quarry. Find where they come from.', 6, 5, 'hard'),
  fight(1003, 'Ogres on the Toll Road', 'Six ogres block the toll road. Break them up.', 6, 'fair', group([16, 6])),
  fight(1004, 'Orc Breakers at the Ford', 'Orcs hold the river ford. Push them back.', 6, 'fair', group([108, 6], [11, 3])),

  // ── Level 7 ──────────────────────────────────────────────────────────────
  dungeon(1005, 'The Silent Watchtower', 'A watchtower on the north road stopped answering. See who holds it.', 7, 4, 'easy'),
  dungeon(1006, 'Cult of the Pale Hand', 'A cult meets in an old salt mine. Shut it down.', 7, 6, 'fair'),
  fight(1007, 'Trolls at the Mill Bridge', 'Four trolls and two bugbears hold the mill bridge. Clear it.', 7, 'fair', group([17, 4], [13, 2])),

  // ── Level 8 ──────────────────────────────────────────────────────────────
  dungeon(1008, 'The Drowned Chapel', 'The old chapel sank into the marsh. The dead did not stay down.', 8, 4, 'easy'),
  dungeon(1009, 'Hobgoblin Siege Camp', 'Hobgoblins are building ladders and rams. Burn the camp.', 8, 5, 'fair'),
  dungeon(1010, 'Spiders of the Deep Mine', 'Giant spiders came up from the lower mine. Seal the tunnels.', 8, 6, 'hard'),
  fight(1011, 'The Minotaur Gang', 'Eight minotaurs raid the farms. Stop them.', 8, 'fair', group([14, 8])),
  fight(1012, "The Raiders' War Camp", 'Orcs and wargs gather for a big raid. Hit them first.', 8, 'fair', group([108, 5], [112, 3], [111, 2])),

  // ── Level 9 ──────────────────────────────────────────────────────────────
  dungeon(1013, "The Grave-Whisperer's Crypt", 'A necromancer works in a family crypt. End it.', 9, 5, 'easy', group([109, 2], [15, 1])),
  dungeon(1014, 'The Ruined Abbey', 'Monks left this abbey long ago. Something else lives there now.', 9, 6, 'fair'),
  fight(1015, 'Giants at the Gap', 'Two giant chiefs and three ogres hold the mountain gap. Break through.', 9, 'fair', group([22, 2], [16, 3])),

  // ── Level 10 ─────────────────────────────────────────────────────────────
  dungeon(1016, 'The Smoking Foundry', 'A burned foundry hides armed men. Find out who pays them.', 10, 6, 'easy'),
  dungeon(1017, 'Hall of the Hill Giants', 'A giant chief and his ogres hold a mountain hall. Take it back.', 10, 7, 'fair', group([22, 1], [16, 2])),
  dungeon(1018, 'The Sunken Temple', 'A temple rose from the lake bed. Cultists are digging in it.', 10, 8, 'hard'),
  fight(1019, 'Trolls on the Ridge', 'Eight trolls nest on the ridge above the road. Drive them off.', 10, 'fair', group([17, 8])),
  fight(1020, "The Giant Chiefs' Feast", 'Four giant chiefs feast in the open. Crash it.', 10, 'fair', group([22, 4])),

  // ── Level 11 ─────────────────────────────────────────────────────────────
  dungeon(1021, 'Warg Rider Fort', 'Warg riders hold a hill fort. Take it before they raid again.', 11, 6, 'easy', group([111, 2], [117, 1])),
  dungeon(1022, 'The Black Library', 'A buried library is full of dark books and dark readers.', 11, 7, 'fair'),
  fight(1023, 'Giants at the Troll Pit', 'Three giant chiefs set trolls on the road. Stop them.', 11, 'fair', group([22, 3], [17, 3])),

  // ── Level 12 ─────────────────────────────────────────────────────────────
  dungeon(1024, 'Mines of the Iron King', 'A dead king still rules his mines. His guard has not stopped.', 12, 7, 'easy'),
  dungeon(1025, "The Vampire's Cellars", 'A vampire lord keeps court under a ruined manor.', 12, 8, 'fair', group([21, 1], [15, 2])),
  dungeon(1026, "The Wyrm's Hoard", 'A dragon hoard lies under the burned hills. Two young wyrms guard it.', 12, 10, 'hard', group([20, 2])),
  fight(1027, 'The Wyrmling Nest', 'Eight young dragons nest in the cliffs, fed by two giants. Clear the nest.', 12, 'fair', group([20, 8], [22, 2])),
  fight(1028, 'Council of Giants', 'Five giant chiefs meet to plan a war. End the meeting.', 12, 'fair', group([22, 5])),

  // ── Level 13 ─────────────────────────────────────────────────────────────
  dungeon(1029, 'The Barrow Kings', 'Old kings stir in their barrows. Wights and wraiths walk with them.', 13, 7, 'easy', group([115, 2], [18, 2])),
  dungeon(1030, 'The Obsidian Keep', 'A black keep stands where no keep should. Its lord is a vampire.', 13, 8, 'fair', group([21, 1], [18, 1])),
  fight(1031, "The Giants' Road Guard", 'Four giant chiefs and three trolls guard a road for their king. Break the guard.', 13, 'fair', group([22, 4], [17, 3])),

  // ── Level 14 ─────────────────────────────────────────────────────────────
  dungeon(1032, 'The Ashen Vault', 'A burned vault holds what the fire could not. Dead guards still hold the door.', 14, 7, 'easy', group([115, 3], [118, 1])),
  dungeon(1033, 'Citadel of the Dead', 'A ruined citadel is full of wights and wraiths. Go in and clear it.', 14, 8, 'fair'),
  dungeon(1034, 'The Ember Deep', 'A great fire burns under the mountain. A dragon sleeps in it.', 14, 9, 'fair', group([24, 1])),
  dungeon(1035, "The Lich's Archive", 'A lich keeps his books and his guards in one deep hall.', 14, 10, 'hard', group([23, 1], [21, 1])),
  fight(1036, 'Dragons on the Ridge', 'Three adult dragons share one ridge. Stop them before they hunt.', 14, 'fair', group([24, 3])),
  fight(1037, 'Giant War Band', 'Six giant chiefs march on the lowlands. Turn them back.', 14, 'hard', group([22, 6])),

  // ── Level 15 (keeps a level-14 guild supplied) ───────────────────────────
  dungeon(1038, 'The Hollow Throne', 'A hollow king sits a hollow throne. His court is dead and angry.', 15, 8, 'easy', group([21, 1], [115, 2])),
  dungeon(1039, 'Vampire Court', 'Three vampires hold a court in a sunken hall. End it.', 15, 9, 'fair', group([21, 2])),
  fight(1040, 'The Red Brood', 'Three red dragons and two young hunt the north road. Kill them.', 15, 'hard', group([24, 3], [20, 2])),
];

export const MID_QUEST_IDS: ReadonlySet<number> = new Set(MID_QUESTS.map((q) => q.id));
