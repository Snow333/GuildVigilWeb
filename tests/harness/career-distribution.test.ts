import { describe, expect, it } from 'vitest';
import { runCampaign, type CampaignResult } from '@sim/campaign/campaign';
import { fixtureParty } from '../fixtures/party-fixture';

/**
 * THE CAREER HARNESS — Phase 1's exit exam. Multi-week campaigns over the real
 * registries: quests post and expire, the party paths across a generated world,
 * ambushes scale with regional pressure, dungeons resolve through the profile
 * AI, XP lands, heroes level. Fully deterministic per seed, so the snapshot is
 * exact: any change that moves guild-career outcomes must justify itself here.
 */

const CAMPAIGNS = 20;
const WEEKS = 24;

const REGIONS = ['region_haven', 'region_ne', 'region_nw', 'region_se', 'region_sw'];

interface CareerDistribution {
  completionRate: number;
  failRate: number;
  wipeRate: number;
  ambushDeaths: number;
  idleWeekRate: number;
  goldP50: number;
  itemsP50: number;
  levelUpsTotal: number;
  avgFinalLevelX100: number;
  maxEscalationTier: number;
  weeksWithQuestActivity: number;
}

function measure(results: CampaignResult[]): CareerDistribution {
  let completed = 0, failed = 0, wiped = 0, ambushDeaths = 0, missions = 0;
  let levelUps = 0, levelSum = 0, heroCount = 0, maxTier = 0, activeWeeks = 0;
  const golds: number[] = [];
  const itemCounts: number[] = [];

  for (const r of results) {
    missions += r.records.length;
    activeWeeks += r.records.length;
    for (const rec of r.records) {
      if (rec.outcome === 'completed') completed++;
      else if (rec.outcome === 'wiped') wiped++;
      else if (rec.outcome === 'ambushKilled') ambushDeaths++;
      else failed++;
    }
    levelUps += r.levelUps;
    for (const lvl of r.finalLevels) {
      levelSum += lvl;
      heroCount++;
    }
    for (const region of REGIONS) maxTier = Math.max(maxTier, r.ledger.pressureFor(region).tier);
    golds.push(r.gold);
    itemCounts.push(r.items.length);
  }
  golds.sort((a, b) => a - b);
  itemCounts.sort((a, b) => a - b);
  const totalWeeks = results.length * WEEKS;
  return {
    completionRate: Math.round((completed / missions) * 1000) / 1000,
    failRate: Math.round((failed / missions) * 1000) / 1000,
    wipeRate: Math.round((wiped / missions) * 1000) / 1000,
    ambushDeaths,
    idleWeekRate: Math.round(((totalWeeks - activeWeeks) / totalWeeks) * 1000) / 1000,
    goldP50: golds[Math.floor(golds.length / 2)]!,
    itemsP50: itemCounts[Math.floor(itemCounts.length / 2)]!,
    levelUpsTotal: levelUps,
    avgFinalLevelX100: Math.round((levelSum / heroCount) * 100),
    maxEscalationTier: maxTier,
    weeksWithQuestActivity: activeWeeks,
  };
}

describe('career distribution harness — the guild across seasons', () => {
  const results: CampaignResult[] = [];
  for (let i = 0; i < CAMPAIGNS; i++) {
    results.push(
      runCampaign({
        campaignId: `career_${i}`,
        seed: `world_${i}`,
        weeks: WEEKS,
        party: fixtureParty(), // fresh mutable party per campaign
      }),
    );
  }
  const d = measure(results);

  it('campaigns are deterministic: same ids → identical world stream', () => {
    const again = runCampaign({
      campaignId: 'career_0', seed: 'world_0', weeks: WEEKS, party: fixtureParty(),
    });
    expect(again.world.hash()).toBe(results[0]!.world.hash());
    expect(again.gold).toBe(results[0]!.gold);
    expect(again.finalLevels).toEqual(results[0]!.finalLevels);
  });

  it('a competent guild: most missions succeed, wipes are rare, careers progress', () => {
    expect(d.completionRate).toBeGreaterThan(0.5); // the wedge handles its weight class
    expect(d.wipeRate).toBeLessThan(0.2);          // losses happen; routs are rare
    expect(d.levelUpsTotal).toBeGreaterThan(0);    // XP actually lands and levels apply
    expect(d.avgFinalLevelX100).toBeGreaterThan(100); // nobody ends where they started
  });

  it('the world reacts: quests flow most weeks and escalation stays in bounds', () => {
    expect(d.idleWeekRate).toBeLessThan(0.5); // the 12-quest pool keeps the board alive early
    expect(d.maxEscalationTier).toBeLessThanOrEqual(3);
    expect(d.goldP50).toBeGreaterThan(0);
  });

  it('every event stream stays consumable: no unknown-type crashes, quest events pair up', () => {
    for (const r of results) {
      const posted = r.world.byType('world.quest_posted').length;
      const resolved =
        r.world.byType('world.quest_completed').length +
        r.world.byType('world.quest_failed').length +
        r.world.byType('world.quest_expired').length;
      expect(resolved).toBeLessThanOrEqual(posted);
      // Every accepted quest resolves within the campaign (no zombie missions).
      const accepted = r.world.byType('world.quest_accepted').length;
      expect(
        r.world.byType('world.quest_completed').length + r.world.byType('world.quest_failed').length,
      ).toBe(accepted);
      // XP events always name real party members.
      for (const ev of r.world.byType('hero.xp_awarded')) {
        expect(['hero_1', 'hero_2', 'hero_3', 'hero_4']).toContain(ev.data.heroId);
        expect(ev.data.amount).toBeGreaterThan(0);
      }
    }
  });

  it('THE BASELINE: exact distribution snapshot — drift must justify itself', () => {
    expect(d).toMatchSnapshot();
  });
});
