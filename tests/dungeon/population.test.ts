import { describe, expect, it } from 'vitest';
import { ENCOUNTERS, partyScaledBudget } from '@content/dungeon';
import { populate } from '@sim/dungeon/population';
import { templatesForTier } from '@sim/dungeon/pool';
import { enemiesById } from '@sim/registry';
import type { DungeonTier } from '@content/dungeon';

/**
 * BRIEF #13 REGRESSIONS — what the generator puts in a room.
 *
 * These guard the two approved population changes, and they are the first tests
 * that cover `populate()` at all: neither distribution harness dispatches a
 * dungeon (`career-distribution` is surface combat and progression;
 * `encounter-distribution` uses hand-authored rosters), so until now
 * `population.ts` could be rewritten with every baseline staying green.
 *
 * Assertions are on DISTRIBUTIONS against the whole shipped template pool, per
 * the harness convention — never on a single roll.
 */

const TIERS: { tier: DungeonTier; difficulty: number }[] = [
  { tier: 'tiny', difficulty: 2 },
  { tier: 'small', difficulty: 3 },
  { tier: 'small', difficulty: 4 },
  { tier: 'medium', difficulty: 5 },
];
const SEEDS = 30;

interface Census { boss: number[]; combat: number[]; bossLevels: { level: number; difficulty: number }[] }

function census(partySize = 4): Census {
  const out: Census = { boss: [], combat: [], bossLevels: [] };
  for (const { tier, difficulty } of TIERS) {
    for (const template of templatesForTier(tier)) {
      for (let s = 0; s < SEEDS; s++) {
        const pop = populate(template, `pop13_${difficulty}_${s}`, difficulty, difficulty + 2, undefined, partySize);
        for (const room of pop.rooms.values()) {
          if (room.type === 'boss') {
            out.boss.push(room.enemyIds.length);
            for (const id of room.enemyIds) {
              out.bossLevels.push({ level: (enemiesById.get(id)?.base_level as number) ?? 0, difficulty });
            }
          } else if (room.type === 'combat') {
            out.combat.push(room.enemyIds.length);
          }
        }
      }
    }
  }
  return out;
}

const rate = (xs: number[], pred: (n: number) => boolean): number =>
  Math.round((xs.filter(pred).length / xs.length) * 1000) / 10;

describe('population — brief #13', () => {
  const c = census();

  it('the sample is big enough to assert distributions on', () => {
    expect(c.boss.length).toBeGreaterThan(400);
    expect(c.combat.length).toBeGreaterThan(1000);
  });

  /**
   * Q1. `bossLevelBonus` is 1, so the band is a single level and every pick
   * costs exactly one slot. FAILS at bossLevelBonus 2: the +2 rows reappear.
   */
  it('THE BOSS BAND IS FLAT: every boss creature sits exactly one level above the dungeon', () => {
    expect(ENCOUNTERS.bossLevelBonus).toBe(1);
    const offBand = c.bossLevels.filter((b) => b.level !== b.difficulty + 1);
    expect({ offBand: offBand.length, sample: offBand.slice(0, 3) }).toEqual({ offBand: 0, sample: [] });
  });

  /**
   * …which makes the budget mean what it says: `bossRoomEnemies` 1–2 now yields
   * literally one or two creatures, never a budget silently spent on one.
   * FAILS pre-brief: the elevated pick cost 2, so 83% of rooms held exactly one.
   */
  it('the boss chamber is no longer a duel by default', () => {
    expect(new Set(c.boss)).toEqual(new Set([1, 2]));
    const single = rate(c.boss, (n) => n === 1);
    expect({ single, inBand: single > 40 && single < 62 }).toEqual({ single, inBand: true });
  });

  /**
   * Q3. An over-budget draw re-draws instead of ending the room, so a room can
   * no longer report full while holding half its budget. FAILS pre-brief, where
   * one unlucky expensive draw drove the lone-enemy room to ~19–23%.
   */
  it('a combat room rarely holds a lone enemy any more', () => {
    const single = rate(c.combat, (n) => n === 1);
    expect({ single, belowCeiling: single < 15 }).toEqual({ single, belowCeiling: true });
  });

  it('TERMINATION: every populated room is bounded, and no room is empty', () => {
    for (const n of [...c.boss, ...c.combat]) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(12); // MAX_ENEMY_DRAWS
    }
  });

  /** §5 — budgets scale up with the roster and never down. */
  describe('party-size scaling', () => {
    it('four or fewer heroes get exactly today\'s numbers', () => {
      expect(partyScaledBudget(2, 1)).toBe(2);
      expect(partyScaledBudget(2, 3)).toBe(2);
      expect(partyScaledBudget(2, 4)).toBe(2);
      expect(partyScaledBudget(4, 3)).toBe(4);
    });

    it('a six-hero party scales the budget by half again', () => {
      expect(partyScaledBudget(2, 6)).toBe(3);
      expect(partyScaledBudget(4, 6)).toBe(6);
      expect(partyScaledBudget(1, 6)).toBe(2);
    });

    it('a smaller party generates the SAME dungeon a four-hero party would', () => {
      const three = census(3);
      expect(three.boss).toEqual(c.boss);
      expect(three.combat).toEqual(c.combat);
    });

    it('a six-hero party meets more creatures in the same rooms', () => {
      const six = census(6);
      const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
      expect(six.boss.length).toBe(c.boss.length); // same rooms…
      expect(total(six.boss)).toBeGreaterThan(total(c.boss)); // …fuller
      expect(total(six.combat)).toBeGreaterThan(total(c.combat));
    });
  });
});
