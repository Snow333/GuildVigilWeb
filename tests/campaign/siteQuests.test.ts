/**
 * SITE EXPEDITIONS (M3) — the missions that take a resource site.
 *
 * ⚠ THESE EXIST BECAUSE `secureSite()` HAD NO LEGITIMATE CALLER. The town
 * economy could not be played: no expedition meant no site, which meant no
 * resources, which meant no upgrade could ever be paid for. Every test here
 * drives the real `acceptSiteExpedition` → `launchDispatch` path rather than
 * calling `secureSite` directly, because calling it directly is exactly the
 * shortcut that hid the gap.
 */
import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '@sim/campaign/starterParty';
import { enemiesById, questsById } from '@sim/registry';
import {
  SITE_QUESTS, SITE_QUEST_BASE,
  isSiteQuest, siteForQuestId, siteQuestFor,
} from '@content/siteQuests';
import { RESOURCE_KINDS } from '@content/town';

function session(id = 'exp'): CampaignSession {
  return CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });
}

describe('the expedition content is real', () => {
  it('there is exactly one expedition per site, and they agree', () => {
    const s = session('pairs');
    const sites = s.resourceSites();
    expect(SITE_QUESTS.length).toBe(sites.length);
    for (const site of sites) {
      const link = siteQuestFor(site.regionId, site.kind);
      expect(link, `no expedition for ${site.kind} in ${site.regionId}`).not.toBeNull();
      // and the mapping round-trips
      expect(siteForQuestId(link!.questId)).toEqual({
        questId: link!.questId, regionId: site.regionId, kind: site.kind,
      });
    }
  });

  it('every garrison enemy id exists', () => {
    /**
     * ⚠ A typo'd enemy id yields an EMPTY garrison and therefore a free site,
     * which reads as generosity rather than as a bug. This is the same class
     * of error as a feat payload nothing consumes.
     */
    const bad: string[] = [];
    for (const q of SITE_QUESTS) {
      const grp = JSON.parse(q.enemy_group ?? '[]') as { enemy_id: number; count: number }[];
      expect(grp.length, `${q.name} has no garrison`).toBeGreaterThan(0);
      for (const g of grp) {
        if (!enemiesById.has(g.enemy_id)) bad.push(`${q.name}: enemy ${g.enemy_id}`);
        expect(g.count).toBeGreaterThan(0);
      }
    }
    expect(bad).toEqual([]);
  });

  it('ids sit in the reserved band and collide with nothing', () => {
    for (const q of SITE_QUESTS) {
      expect(q.id).toBeGreaterThanOrEqual(SITE_QUEST_BASE);
      expect(questsById.get(q.id)?.name).toBe(q.name);
    }
    // The registry itself throws on a collision; this pins the band.
    expect(new Set(SITE_QUESTS.map((q) => q.id)).size).toBe(SITE_QUESTS.length);
  });

  it('a harder region posts a harder garrison', () => {
    // The curve should fall out of the region's authored danger_level rather
    // than being hand-tuned per site.
    const byLevel = new Map<number, number>();
    for (const q of SITE_QUESTS) {
      const grp = JSON.parse(q.enemy_group ?? '[]') as { enemy_id: number; count: number }[];
      const worst = Math.max(...grp.map((g) => (enemiesById.get(g.enemy_id)?.base_level as number) ?? 0));
      const prev = byLevel.get(q.min_level) ?? 0;
      byLevel.set(q.min_level, Math.max(prev, worst));
    }
    const levels = [...byLevel.keys()].sort((a, b) => a - b);
    for (let i = 1; i < levels.length; i++) {
      expect(byLevel.get(levels[i]!)!, `L${levels[i]} garrison is not tougher than L${levels[i - 1]}`)
        .toBeGreaterThanOrEqual(byLevel.get(levels[i - 1]!)!);
    }
  });

  it('the payoff is the SITE, not the purse', () => {
    // ⚠ If an expedition paid a full job's gold on top of a permanent income,
    // it would dominate the quest board and the board would go unused.
    for (const q of SITE_QUESTS) {
      const peers = [...questsById.values()].filter(
        (r) => !isSiteQuest(r.id) && (r.min_level as number) === q.min_level,
      );
      if (peers.length === 0) continue;
      const medianPeerGold = peers.map((r) => r.reward_gold as number).sort((a, b) => a - b)[
        Math.floor(peers.length / 2)
      ]!;
      expect(q.reward_gold, `${q.name} pays as much as an ordinary job`).toBeLessThan(medianPeerGold);
    }
  });
});

describe('an expedition is never board trouble', () => {
  it('no expedition is ever posted, over many weeks', () => {
    const s = session('board');
    for (let w = 0; w < 20; w++) {
      s.advanceWeek();
      for (const entry of s.board()) {
        expect(isSiteQuest(entry.questId), `expedition ${entry.questId} was posted on the board`).toBe(false);
      }
    }
  });

  it('the board still works — expeditions did not crowd it out', () => {
    const s = session('board2');
    s.advanceWeek();
    expect(s.board().length).toBeGreaterThan(0);
  });
});

describe('taking a site', () => {
  it('a won expedition secures the site, and the site then pays', () => {
    const s = session('take');
    const first = s.availableExpeditions().find((e) => e.site.level === 1)!;
    expect(first).toBeDefined();
    expect(s.securedSites()).toEqual([]);

    s.advanceWeek();
    s.acceptSiteExpedition(first.site.regionId, first.site.kind);
    const result = s.launchDispatch();
    expect(result.outcome).toBe('completed');

    expect(s.securedSites().length).toBe(1);
    expect(s.weeklyIncome()[first.site.kind]).toBe(first.site.yield);

    const before = s.resourceStock()[first.site.kind];
    s.advanceWeek();
    expect(s.resourceStock()[first.site.kind]).toBe(before + first.site.yield);
  });

  it('the expedition is at the SITE, not somewhere else on the map', () => {
    const s = session('pos');
    const target = s.availableExpeditions()[0]!;
    s.advanceWeek();
    const questId = s.acceptSiteExpedition(target.site.regionId, target.site.kind);
    const preview = s.travelPreview(questId);
    expect(preview).not.toBeNull();
    const site = s.resourceSites().find(
      (x) => x.regionId === target.site.regionId && x.kind === target.site.kind,
    )!;
    expect(preview!.path[preview!.path.length - 1]).toEqual(site.pos);
  });

  it('...and it is STILL at the site after a save and reload', () => {
    /**
     * ⚠ THIS IS THE TEST THAT ACTUALLY GUARDS `questPos`'s site branch, and
     * the one above is not. `acceptSiteExpedition` sets `active.pos` from the
     * site directly, so the live preview is right no matter what `questPos`
     * does — a negative control deleting the site branch left the previous
     * test GREEN. Only `deserialize` re-derives the position through
     * `rehydrateQuest` → `questPos`, so without the branch a reload teleports
     * an in-progress expedition to an unrelated `placePoi` tile.
     */
    const s = session('posreload');
    const target = s.availableExpeditions()[0]!;
    s.advanceWeek();
    const questId = s.acceptSiteExpedition(target.site.regionId, target.site.kind);
    const site = s.resourceSites().find(
      (x) => x.regionId === target.site.regionId && x.kind === target.site.kind,
    )!;

    const back = CampaignSession.deserialize(s.serialize());
    const preview = back.travelPreview(questId);
    expect(preview).not.toBeNull();
    expect(preview!.path[preview!.path.length - 1]).toEqual(site.pos);
  });

  it('a site the guild holds cannot be taken again', () => {
    const s = session('twice');
    const first = s.availableExpeditions().find((e) => e.site.level === 1)!;
    s.advanceWeek();
    s.acceptSiteExpedition(first.site.regionId, first.site.kind);
    s.launchDispatch();
    expect(() => s.acceptSiteExpedition(first.site.regionId, first.site.kind))
      .toThrow(/already holds/);
    expect(s.availableExpeditions().some(
      (e) => e.site.regionId === first.site.regionId && e.site.kind === first.site.kind,
    )).toBe(false);
  });

  it('the party cannot be in two places at once', () => {
    const s = session('busy');
    s.advanceWeek();
    const board = s.board();
    expect(board.length).toBeGreaterThan(0);
    s.acceptQuest(board[0]!.questId);
    const site = s.availableExpeditions()[0]!.site;
    expect(() => s.acceptSiteExpedition(site.regionId, site.kind)).toThrow(/already out/);
  });

  it('LOSING an expedition does not hand over the site', () => {
    /**
     * ⚠ The negative control for the whole earning loop. A level-1 party is
     * measured 0/12 against a danger-level-3 garrison or worse, so this drives
     * a real loss rather than simulating one.
     */
    let attempted = 0;
    let secured = 0;
    for (let i = 0; i < 10; i++) {
      const s = session(`lose${i}`);
      const hard = s.availableExpeditions().find((e) => e.site.level >= 4);
      if (!hard) continue;
      s.advanceWeek();
      try {
        s.acceptSiteExpedition(hard.site.regionId, hard.site.kind);
      } catch {
        continue;
      }
      const r = s.launchDispatch();
      if (r.outcome === 'completed') continue; // it won; not the case under test
      attempted += 1;
      if (s.securedSites().length > 0) secured += 1;
      expect(s.weeklyIncome()[hard.site.kind]).toBe(0);
    }
    expect(attempted, 'no expedition was actually lost — the control proved nothing').toBeGreaterThan(0);
    expect(secured).toBe(0);
  });

  it('securing survives a save and load', () => {
    const s = session('save');
    const first = s.availableExpeditions().find((e) => e.site.level === 1)!;
    s.advanceWeek();
    s.acceptSiteExpedition(first.site.regionId, first.site.kind);
    s.launchDispatch();

    const back = CampaignSession.deserialize(s.serialize());
    expect(back.securedSites()).toEqual(s.securedSites());
    expect(back.weeklyIncome()).toEqual(s.weeklyIncome());
    expect(back.availableExpeditions().length).toBe(s.availableExpeditions().length);
  });

  it('taking a site raises the guild\u2019s standing', () => {
    const s = session('rep');
    const first = s.availableExpeditions().find((e) => e.site.level === 1)!;
    s.advanceWeek();
    s.acceptSiteExpedition(first.site.regionId, first.site.kind);
    s.launchDispatch();
    expect(s.reputationTotal()).toBeGreaterThan(0);
  });
});

describe('the loop closes: a site pays for an upgrade', () => {
  it('income from a secured site can actually buy a building level', () => {
    /**
     * ⚠ THE WHOLE MILESTONE IN ONE TEST. Take a site, wait for it to pay,
     * spend the resources on a real upgrade. If any link in that chain breaks,
     * M3 is decoration even if every unit test above passes.
     */
    const s = session('loop');
    const timber = s.availableExpeditions().find((e) => e.site.kind === 'timber' && e.site.level <= 2);
    expect(timber, 'there should be an early timber site to take').toBeDefined();

    s.advanceWeek();
    s.acceptSiteExpedition(timber!.site.regionId, timber!.site.kind);
    expect(s.launchDispatch().outcome).toBe('completed');

    // The General Store's level 2 wants timber, and nothing else blocks it.
    const storeBill = s.town().find((b) => b.id === 4)!.next!.cost;
    expect(storeBill.resources.timber ?? 0).toBeGreaterThan(0);

    s.devAddGold(storeBill.gold + 50);
    s.grantResources({ grain: storeBill.resources.grain ?? 0 });
    let guard = 0;
    while ((s.resourceStock().timber ?? 0) < (storeBill.resources.timber ?? 0) && guard++ < 40) {
      s.advanceWeek();
    }
    expect(s.resourceStock().timber).toBeGreaterThanOrEqual(storeBill.resources.timber ?? 0);

    const before = s.buildingLevel(4);
    s.upgradeBuilding(4);
    expect(s.buildingLevel(4)).toBe(before + 1);
  });

  it('a guild that takes nothing can never pay a resource bill', () => {
    // The negative control for the loop: without an expedition, no resource
    // ever arrives, so the Guild Hall ladder stays shut forever.
    const s = session('noloop');
    s.devAddGold(1_000_000);
    s.grantReputation(100);
    for (let w = 0; w < 30; w++) s.advanceWeek();
    for (const kind of RESOURCE_KINDS) expect(s.resourceStock()[kind]).toBe(0);
    expect(() => s.upgradeBuilding(1)).toThrow();
  });
});
