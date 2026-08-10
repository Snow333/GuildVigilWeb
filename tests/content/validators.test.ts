import { describe, expect, it } from 'vitest';
import {
  enemies, loot_tables, npcs, quests, story_dialogue, storyline_quests, storylines,
} from '@content/generated';

/**
 * Content validators (brief #6) — the machine gate that lets volume never
 * outrun integrity (risk R4). Every authored batch must pass these before it
 * ships; they check REFERENCES and BANDS, not taste — hand-play judges taste.
 */

// Widened to number: the `as const` tables produce literal-union ids.
const enemyIds = new Set<number>(enemies.map((e) => e.id));
const questIds = new Set<number>(quests.map((q) => q.id));
const lootTableIds = new Set<number>(loot_tables.map((l) => l.id as number));
const npcIds = new Set<number>(npcs.map((n) => n.id));

/** Stat bands per level, derived from the exemplar roster's envelope (±tolerance). */
const BAND: Record<number, { hp: [number, number]; ac: [number, number]; atk: [number, number]; xp: [number, number] }> = {
  1: { hp: [5, 15], ac: [11, 15], atk: [1, 5], xp: [10, 30] },
  2: { hp: [12, 25], ac: [11, 16], atk: [3, 6], xp: [30, 50] },
  3: { hp: [15, 32], ac: [13, 17], atk: [4, 8], xp: [40, 65] },
  4: { hp: [24, 40], ac: [14, 18], atk: [6, 9], xp: [60, 90] },
  5: { hp: [32, 52], ac: [15, 18], atk: [8, 11], xp: [85, 110] },
  6: { hp: [42, 62], ac: [16, 19], atk: [10, 13], xp: [115, 140] },
  7: { hp: [48, 85], ac: [17, 21], atk: [10, 15], xp: [145, 210] },
  8: { hp: [80, 130], ac: [18, 21], atk: [13, 17], xp: [250, 320] },
};

describe('content validators — reference integrity', () => {
  it('every quest enemy_group references real enemies with positive counts', () => {
    for (const q of quests) {
      if (!q.enemy_group) continue;
      const group = JSON.parse(q.enemy_group as string) as { enemy_id: number; count: number }[];
      expect(group.length, `quest ${q.id} group`).toBeGreaterThan(0);
      for (const g of group) {
        expect(enemyIds.has(g.enemy_id), `quest ${q.id} → enemy ${g.enemy_id}`).toBe(true);
        expect(g.count, `quest ${q.id} enemy ${g.enemy_id} count`).toBeGreaterThan(0);
      }
    }
  });

  it('dungeon quests carry a dungeon_level; combat quests carry an enemy_group', () => {
    for (const q of quests) {
      if (q.quest_type === 'dungeon') expect(q.dungeon_level, `quest ${q.id}`).not.toBeNull();
      if (q.quest_type === 'combat') expect(q.enemy_group, `quest ${q.id}`).toBeTruthy();
    }
  });

  it('enemy loot_table_id references a real table (or is null by design)', () => {
    for (const e of enemies) {
      if (e.loot_table_id === null) continue;
      expect(lootTableIds.has(e.loot_table_id as number), `enemy ${e.id} → loot ${e.loot_table_id}`).toBe(true);
    }
  });

  it('storyline sequences are gapless from 1 and reference real quests, exactly quest_count long', () => {
    for (const s of storylines) {
      const rows = storyline_quests
        .filter((sq) => sq.storyline_id === s.id)
        .sort((a, b) => a.sequence - b.sequence);
      expect(rows.length, `storyline ${s.id} quest_count`).toBe(s.quest_count);
      rows.forEach((sq, i) => {
        expect(sq.sequence, `storyline ${s.id} sequence gap`).toBe(i + 1);
        expect(questIds.has(sq.quest_id), `storyline ${s.id} → quest ${sq.quest_id}`).toBe(true);
      });
    }
  });

  it('dialogue references real storylines/NPCs; quest triggers name real quests; choices parse', () => {
    const storylineIds = new Set(storylines.map((s) => s.id));
    for (const d of story_dialogue) {
      expect(storylineIds.has(d.storyline_id), `dialogue ${d.id} storyline`).toBe(true);
      expect(npcIds.has(d.npc_id), `dialogue ${d.id} npc`).toBe(true);
      if (d.trigger_type === 'quest' && d.trigger_value !== '') {
        expect(questIds.has(Number(d.trigger_value)), `dialogue ${d.id} trigger quest`).toBe(true);
      }
      if (d.choices) expect(() => JSON.parse(d.choices as string)).not.toThrow();
    }
  });

  it('villain NPCs pair with a personal quest that exists', () => {
    for (const n of npcs) {
      if (n.personal_quest_id === null) continue;
      expect(questIds.has(n.personal_quest_id as number), `npc ${n.id} personal quest`).toBe(true);
    }
  });
});

describe('content validators — stat bands (volume never outruns integrity)', () => {
  it('every enemy sits inside its level band envelope', () => {
    for (const e of enemies) {
      const band = BAND[e.base_level as number];
      if (!band) continue; // levels 9+ are legendary exemplar space — judged by hand
      const stats: [string, number, [number, number]][] = [
        ['hp', e.hp as number, band.hp],
        ['ac', e.ac as number, band.ac],
        ['atk', e.attack_bonus as number, band.atk],
        ['xp', e.xp_reward as number, band.xp],
      ];
      for (const [label, value, [lo, hi]] of stats) {
        expect(value, `enemy ${e.id} ${e.name} ${label}=${value} below [${lo},${hi}] @L${e.base_level}`).toBeGreaterThanOrEqual(lo);
        expect(value, `enemy ${e.id} ${e.name} ${label}=${value} above [${lo},${hi}] @L${e.base_level}`).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('quest rewards scale monotonically-ish with min_level (no free jackpots)', () => {
    for (const q of quests) {
      const lv = q.min_level as number;
      expect(q.reward_gold, `quest ${q.id} gold`).toBeLessThanOrEqual(300 + lv * 250);
      expect(q.reward_xp, `quest ${q.id} xp`).toBeLessThanOrEqual(200 + lv * 200);
      expect(q.reward_gold, `quest ${q.id} gold floor`).toBeGreaterThan(0);
    }
  });
});
