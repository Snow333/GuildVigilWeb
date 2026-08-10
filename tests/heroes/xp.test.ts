import { describe, expect, it } from 'vitest';
import {
  awardXp, canLevelUp, L_CAP_SENTINEL, perHeroShare, XP_PER_LEVEL, xpForNextLevel,
  type XpSourceResolver,
} from '@sim/heroes/xp';
import type { HeroState } from '@sim/heroes/types';
import { contentXpResolver } from '@sim/registry';

/**
 * Ported from project/tests/unit/test_xp_manager.gd (GUT) — the confirmed
 * Area-1 verification approach. Case names and expected values match 1:1.
 */

function hero(id: number, status: HeroState['status'] = 'active', classLevel = 1): HeroState {
  return {
    id: `hero_${id}`, name: `H${id}`, status, xp: 0, maxHp: 10, wounded: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    classLevels: [{ classId: 1, level: classLevel, orderTaken: 1 }],
    skills: {}, feats: [],
  };
}

/** Fixture resolver mirroring the GUT in-memory DBs. */
function fixtureResolver(enemyXp: Record<number, number>, questXp: Record<number, number> = {}): XpSourceResolver {
  return {
    monsterXp: (id) => (id in enemyXp ? (enemyXp[id] as number) : null),
    questXp: (id) => (id in questXp ? (questXp[id] as number) : null),
  };
}

describe('source-type routing', () => {
  it('monster source reads enemies xp_reward', () => {
    const party = [hero(1), hero(2)];
    const r = awardXp(party, 'monster', 9001, fixtureResolver({ 9001: 120 }));
    expect(r).toEqual({ totalAwarded: 120, perHeroShare: 60, recipientCount: 2 });
    expect(party[0]!.xp).toBe(60);
    expect(party[1]!.xp).toBe(60);
  });

  it('quest source reads quests reward_xp', () => {
    const party = [hero(1), hero(2)];
    const r = awardXp(party, 'quest', 9010, fixtureResolver({}, { 9010: 200 }));
    expect(r).toEqual({ totalAwarded: 200, perHeroShare: 100, recipientCount: 2 });
  });

  it('action source is reserved no-op', () => {
    const party = [hero(1)];
    const r = awardXp(party, 'action', 9001, fixtureResolver({ 9001: 120 }));
    expect(r).toEqual({ error: 'actionReserved' });
    expect(party[0]!.xp).toBe(0);
  });

  it('unknown monster awards nothing', () => {
    const party = [hero(1)];
    const r = awardXp(party, 'monster', 8888, fixtureResolver({}));
    expect(r).toEqual({ error: 'sourceNotFound', sourceType: 'monster', sourceId: 8888 });
    expect(party[0]!.xp).toBe(0);
  });

  it('unknown quest awards nothing', () => {
    const party = [hero(1)];
    const r = awardXp(party, 'quest', 8888, fixtureResolver({}));
    expect(r).toEqual({ error: 'sourceNotFound', sourceType: 'quest', sourceId: 8888 });
  });
});

describe('party-split with dead-hero toggle', () => {
  it('splits across all four alive heroes', () => {
    const r = awardXp([hero(1), hero(2), hero(3), hero(4)], 'monster', 9001, fixtureResolver({ 9001: 120 }));
    expect(r).toMatchObject({ recipientCount: 4, perHeroShare: 30 });
  });

  it('toggle OFF excludes dead heroes', () => {
    const party = [hero(1), hero(2, 'dead'), hero(3), hero(4)];
    const r = awardXp(party, 'monster', 9001, fixtureResolver({ 9001: 90 }), { includeDeadHeroes: false });
    expect(r).toMatchObject({ recipientCount: 3, perHeroShare: 30 });
    expect(party[1]!.xp).toBe(0);
    expect(party[0]!.xp).toBe(30);
    expect(party[2]!.xp).toBe(30);
    expect(party[3]!.xp).toBe(30);
  });

  it('toggle ON includes dead heroes', () => {
    const party = [hero(1), hero(2, 'dead'), hero(3), hero(4)];
    const r = awardXp(party, 'monster', 9001, fixtureResolver({ 9001: 120 }), { includeDeadHeroes: true });
    expect(r).toMatchObject({ recipientCount: 4, perHeroShare: 30 });
    expect(party[1]!.xp).toBe(30);
  });

  it('all dead + toggle OFF awards nothing', () => {
    const party = [hero(1, 'dead'), hero(2, 'dead')];
    const r = awardXp(party, 'monster', 9001, fixtureResolver({ 9001: 100 }));
    expect(r).toEqual({ totalAwarded: 0, perHeroShare: 0, recipientCount: 0 });
    expect(party[0]!.xp).toBe(0);
  });

  it('default toggle behavior is OFF (dead excluded)', () => {
    const r = awardXp([hero(1), hero(2, 'dead')], 'monster', 9001, fixtureResolver({ 9001: 60 }));
    expect(r).toMatchObject({ recipientCount: 1 });
  });
});

describe('rounding (brief examples, drift accepted by design)', () => {
  it('100 / 3 → 33 each', () => {
    const r = awardXp([hero(1), hero(2), hero(3)], 'monster', 9001, fixtureResolver({ 9001: 100 }));
    expect(r).toMatchObject({ perHeroShare: 33 });
  });

  it('70 / 4 → 18 each (round half up; total 72 > 70 is the accepted drift)', () => {
    const r = awardXp([hero(1), hero(2), hero(3), hero(4)], 'monster', 9001, fixtureResolver({ 9001: 70 }));
    expect(r).toMatchObject({ perHeroShare: 18, totalAwarded: 72 });
  });

  it('250 / 4 → 63 each', () => {
    const r = awardXp([hero(1), hero(2), hero(3), hero(4)], 'monster', 9001, fixtureResolver({ 9001: 250 }));
    expect(r).toMatchObject({ perHeroShare: 63 });
  });

  it('perHeroShare guards count <= 0', () => {
    expect(perHeroShare(100, 0)).toBe(0);
  });
});

describe('threshold math', () => {
  it('XP_PER_LEVEL is 1000', () => {
    expect(XP_PER_LEVEL).toBe(1000);
  });

  it('threshold at level 1 is 1000', () => {
    const info = xpForNextLevel(hero(1, 'active', 1));
    expect(info.atCap).toBe(false);
    expect(info.threshold).toBe(1000);
  });

  it('threshold at level 19 still in range', () => {
    const info = xpForNextLevel(hero(1, 'active', 19));
    expect(info.atCap).toBe(false);
    expect(info.threshold).toBe(1000);
  });

  it('threshold at level 20 returns the sentinel', () => {
    const info = xpForNextLevel(hero(1, 'active', 20));
    expect(info.atCap).toBe(true);
    expect(info.threshold).toBe(L_CAP_SENTINEL);
    expect(info.progress).toBe(L_CAP_SENTINEL);
  });

  it('cannot level up at the cap regardless of XP', () => {
    const h = hero(1, 'active', 20);
    h.xp = 999_999;
    expect(canLevelUp(h)).toBe(false);
  });

  it('level-up boundary at level 1: 999 no, 1000 yes', () => {
    const h = hero(1);
    expect(canLevelUp(h)).toBe(false);
    h.xp = 999;
    expect(canLevelUp(h)).toBe(false);
    h.xp = 1000;
    expect(canLevelUp(h)).toBe(true);
  });
});

describe('production resolver over the real registries', () => {
  it('reads a real enemy and a real quest', () => {
    // Goblin (id 1) exists in the converted content with a positive xp_reward.
    expect(contentXpResolver.monsterXp(1)).toBeGreaterThan(0);
    expect(contentXpResolver.questXp(1)).toBeGreaterThan(0);
    expect(contentXpResolver.monsterXp(999_999)).toBeNull();
  });
});
