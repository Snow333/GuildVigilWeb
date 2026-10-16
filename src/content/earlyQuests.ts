/**
 * Hand-authored quests that live beside the generated table (Track Q, M2).
 *
 * Two kinds:
 *   1. EARLY EASY quests (900+) — small fights a fresh level-1 guild wins.
 *      They post only in the first weeks, so a new player can bank some wins.
 *      Measured: tests/campaign/questBoard.test.ts runs real launches for each.
 *   2. MARSHAL'S COMMISSIONS (950+) — one per Marshal letter. Answering the
 *      letter posts its commission. They never post on their own.
 *
 * Same row shape as `@content/generated` quests, so `questsById` finds them
 * and every consumer (launch, XP, board, map) treats them like any quest.
 * Ids start at 900 so they can never collide with the generated table.
 */

/** The quest row shape, widened from the generated `as const` literals. */
export interface QuestRow {
  id: number;
  name: string;
  description: string;
  quest_type: string;
  min_level: number;
  reward_gold: number;
  reward_xp: number;
  reward_items: string;
  reward_reputation: number;
  poi_id: number | null;
  dungeon_level: number | null;
  enemy_group: string | null;
  prerequisites: string;
}

const group = (...g: [enemyId: number, count: number][]): string =>
  JSON.stringify(g.map(([enemy_id, count]) => ({ enemy_id, count })));

const camp = (
  id: number, name: string, description: string, minLevel: number,
  gold: number, xp: number, enemies: string,
): QuestRow => ({
  id, name, description, quest_type: 'combat', min_level: minLevel,
  reward_gold: gold, reward_xp: xp, reward_items: '[]', reward_reputation: 2,
  poi_id: null, dungeon_level: null, enemy_group: enemies, prerequisites: '{}',
});

/** Small fights, low pay, plain names. Enemy ids: 1 goblin, 2 skeleton, 3 wolf, 4 giant rat, 5 kobold. */
export const EARLY_QUESTS: readonly QuestRow[] = [
  camp(900, 'Rats in the Granary Cellar', 'Giant rats are eating the winter grain. Clear the cellar.', 1, 40, 50, group([4, 4])),
  camp(901, 'Kobolds at the Mill', 'Three kobolds took over the old mill. Drive them out.', 1, 50, 60, group([5, 3])),
  camp(902, 'Wolves at the Sheepfold', 'Two wolves keep taking sheep. Stop them.', 1, 50, 60, group([3, 2])),
  camp(903, 'Goblin Scouts on the Road', 'Goblin scouts watch the road. Chase them off.', 1, 60, 70, group([1, 3])),
  camp(904, 'Bones in the Old Chapel', 'Skeletons walk in the chapel yard. Put them back to rest.', 1, 60, 70, group([2, 3])),
];

/**
 * The quests that count as EASY for the early-weeks guarantee: the five
 * above, plus the two generated level-1 camp fights — the Goblin Camp
 * (Steven: "The Goblin camp fits this bill") and Wolf Pack Menace. All are
 * repeatable (not storyline beats), and every id here is measured >= 80% wins
 * for the default level-1 party (tests/campaign/questBoard.test.ts).
 */
export const EARLY_EASY_QUEST_IDS: ReadonlySet<number> = new Set([1, 6, ...EARLY_QUESTS.map((q) => q.id)]);

/** The hand-authored easy quests post ONLY in the early weeks (Steven: "the first 4 weeks"). */
export const EARLY_ONLY_QUEST_IDS: ReadonlySet<number> = new Set(EARLY_QUESTS.map((q) => q.id));

/** A commission: the letter (story_dialogue id) that posts it, and the quest it posts. */
export interface Commission {
  dialogueId: number;
  quest: QuestRow;
}

/**
 * One commission per Marshal letter, built from that letter's story beat and
 * sized to the level the party is likely at when the letter arrives.
 * Enemy ids: 100 goblin sapper, 101 goblin firebrand, 1 goblin, 104 Krathite
 * conscript, 107 hobgoblin vanguard, 120 Krathite signal-corp, 110 hobgoblin
 * legionnaire, 105 orc raider, 112 orc siege-hand.
 */
export const COMMISSIONS: readonly Commission[] = [
  {
    dialogueId: 1,
    quest: camp(950, 'Guard the Last Granary', 'The Marshal asks you to guard the last full granary. Goblins with torches will come.', 1, 180, 120,
      group([100, 2], [1, 1])),
  },
  {
    dialogueId: 2,
    quest: camp(951, 'Catch the Survey Team', 'Krathite soldiers are measuring the land. Catch them before they leave.', 3, 420, 300,
      group([104, 2], [107, 1], [120, 1])),
  },
  {
    dialogueId: 3,
    quest: camp(952, 'Cut the Signal Line', 'The fort calls for help with signal fires. Put out the fires and their guards.', 6, 800, 620,
      group([120, 2], [110, 2])),
  },
  {
    dialogueId: 4,
    quest: camp(953, 'Sweep the Last Camps', 'A few raider camps are still out there. Clear them so the roads stay safe.', 7, 1000, 760,
      group([105, 2], [112, 1])),
  },
];

export const COMMISSION_QUEST_IDS: ReadonlySet<number> = new Set(COMMISSIONS.map((c) => c.quest.id));

/** Every hand-authored row, for the registry merge. */
export const AUTHORED_QUESTS: readonly QuestRow[] = [...EARLY_QUESTS, ...COMMISSIONS.map((c) => c.quest)];
