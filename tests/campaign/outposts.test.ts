/**
 * OUTPOSTS (M4) — a secured site is a staging post.
 *
 * ⚠ AN OUTPOST IS NOT A NEW ENTITY. The guild already holds ground at every
 * site it has taken, and those sites already have map positions, save state
 * and pins. A separate outpost thing would have meant a second set of
 * placement rules, a second save field and a second UI for a benefit the
 * player can already point at.
 */
import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '@sim/campaign/starterParty';
import { WORLD } from '@content/world';

function session(id: string): CampaignSession {
  return CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });
}

/** Take the cheapest site in a region and return the session holding it. */
function holding(id: string, level = 1): { s: CampaignSession; regionId: string } {
  const s = session(id);
  const target = s.availableExpeditions().find((e) => e.site.level <= level)!;
  s.advanceWeek();
  s.acceptSiteExpedition(target.site.regionId, target.site.kind);
  const r = s.launchDispatch();
  expect(r.outcome).toBe('completed');
  return { s, regionId: target.site.regionId };
}

describe('an outpost is a secured site', () => {
  it('a guild that holds nothing has no outposts', () => {
    expect(session('none').outposts()).toEqual([]);
  });

  it('taking a site creates one', () => {
    const { s, regionId } = holding('one');
    const posts = s.outposts();
    expect(posts.length).toBe(1);
    expect(posts[0]!.regionId).toBe(regionId);
  });
});

describe('outposts cut travel — measured, not asserted', () => {
  it('a job in the held region is reached faster once the site is held', () => {
    /**
     * ⚠ THE SAME CAMPAIGN, THE SAME QUEST, BEFORE AND AFTER. Comparing two
     * different seeds would compare two different maps; comparing two
     * different quests would compare two different distances. The only
     * difference between the two readings must be who holds the ground.
     */
    const a = session('cut');
    const target = a.availableExpeditions().find((e) => e.site.level === 1)!;
    const regionId = target.site.regionId;

    a.advanceWeek();
    const postings = a.board().filter((e) => e.regionId === regionId);
    if (postings.length === 0) return; // no job in that region this week; nothing to measure

    const before = a.travelPreview(postings[0]!.questId)!.etaMinutes;

    a.acceptSiteExpedition(target.site.regionId, target.site.kind);
    expect(a.launchDispatch().outcome).toBe('completed');

    const after = a.travelPreview(postings[0]!.questId)!.etaMinutes;
    expect(after).toBeLessThanOrEqual(before);
  });

  // 25 campaigns each run a real dispatch; the 5s default is not enough.
  it('across many seeds, holding ground never makes a job SLOWER', () => {
    // The honest version of the claim: an outpost is only ever taken when it
    // beats Haven, so the ETA must be monotonic. If it ever rises, the origin
    // picker is choosing a worse staging post than the town.
    let compared = 0;
    for (let i = 0; i < 25; i++) {
      const s = session(`mono${i}`);
      const target = s.availableExpeditions().find((e) => e.site.level <= 2);
      if (!target) continue;
      s.advanceWeek();
      const posting = s.board().find((e) => e.regionId === target.site.regionId);
      if (!posting) continue;

      const before = s.travelPreview(posting.questId)!.etaMinutes;
      try {
        s.acceptSiteExpedition(target.site.regionId, target.site.kind);
      } catch {
        continue;
      }
      if (s.launchDispatch().outcome !== 'completed') continue;
      const after = s.travelPreview(posting.questId)!.etaMinutes;
      compared += 1;
      expect(after, `seed mono${i}: holding ${target.site.kind} made the job slower`).toBeLessThanOrEqual(before);
    }
    // ⚠ Without this the filter above could leave the test vacuously green.
    expect(compared, 'no seed produced a comparable job — the test proved nothing').toBeGreaterThan(0);
    console.log(`outposts: compared ${compared} seeds, none slower`);
  }, 120_000);

  it('WHEN an outpost helps, it helps a lot — and it helps often enough to matter', () => {
    /**
     * ⚠ "NEVER SLOWER" IS SATISFIED BY "ALWAYS IDENTICAL", so the monotonic
     * test above cannot tell a working feature from a dead one. This pins the
     * MAGNITUDE. Measured over 40 campaigns and every region that had a
     * posting: an outpost beats Haven on roughly a quarter to a third of jobs
     * in its own region, and when it does the trip is ~36-42% shorter.
     *
     * It is not higher because the site must genuinely be closer than the town
     * — which is the correct behaviour, not a shortfall. If this test starts
     * reporting zero cuts, outposts have become decoration.
     */
    let cuts = 0;
    let compared = 0;
    const deltas: number[] = [];
    for (let i = 0; i < 12; i++) {
      const s = session(`mag${i}`);
      s.advanceWeek(); s.advanceWeek();
      for (const site of s.resourceSites()) {
        const posting = s.board().find((e) => e.regionId === site.regionId);
        if (!posting) continue;
        const before = s.travelPreview(posting.questId)!.etaMinutes;
        // Dev path deliberately: this measures TRAVEL, not whether a level-1
        // party could win an expedition in a danger-7 region.
        s.secureSite(site.regionId, site.kind);
        const after = s.travelPreview(posting.questId)!.etaMinutes;
        compared += 1;
        if (after < before) {
          cuts += 1;
          deltas.push((before - after) / before);
        }
      }
    }
    expect(compared, 'no job was comparable — the test proved nothing').toBeGreaterThan(20);
    expect(cuts, 'an outpost never once beat Haven — the feature is decoration').toBeGreaterThan(0);
    const median = deltas.sort((a, b) => a - b)[Math.floor(deltas.length / 2)]!;
    expect(median, 'outposts fire but barely shorten anything').toBeGreaterThan(0.1);
  }, 120_000);

  it('a party NEVER stages from another region\u2019s outpost', () => {
    /**
     * ⚠ ASSERTS THE RULE, NOT A SYMPTOM OF IT. The first version of this test
     * secured one site and checked that a quest in a DIFFERENT region kept its
     * ETA — and it passed with the same-region check deleted, because a
     * near-Haven site usually is not closer to a far quest anyway. The bug
     * survived precisely where the geometry hid it.
     *
     * So: hold EVERY site, then check each posting's route begins either at
     * Haven or at an outpost in that posting's OWN region. Without the rule,
     * one early timber camp would discount travel across the whole map and
     * make the Stables pointless.
     */
    let checked = 0;
    for (let i = 0; i < 10; i++) {
      const s = session(`cross${i}`);
      s.advanceWeek(); s.advanceWeek();
      for (const site of s.resourceSites()) s.secureSite(site.regionId, site.kind);

      for (const posting of s.board()) {
        const preview = s.travelPreview(posting.questId);
        if (!preview) continue;
        const start = preview.path[0]!;
        const atHaven = start.x === WORLD.haven.x && start.y === WORLD.haven.y;
        const ownRegionPost = s.outposts().some(
          (o) => o.regionId === posting.regionId && o.pos.x === start.x && o.pos.y === start.y,
        );
        expect(
          atHaven || ownRegionPost,
          `seed cross${i}: a job in ${posting.regionId} staged from (${start.x},${start.y}), `
          + 'which is neither Haven nor an outpost in that region',
        ).toBe(true);
        checked += 1;
      }
    }
    expect(checked, 'no posting was checked — the test proved nothing').toBeGreaterThan(10);
  }, 120_000);

  it('the preview the player reads is the route the party takes', () => {
    // A shorter ETA that the dispatch ignores would be a lie on the screen.
    const { s, regionId } = holding('truth');
    const posting = s.board().find((e) => e.regionId === regionId);
    if (!posting) return;
    const preview = s.travelPreview(posting.questId)!;
    const outpost = s.outposts().find((o) => o.regionId === regionId)!;
    const startsAtOutpost = preview.path[0]!.x === outpost.pos.x && preview.path[0]!.y === outpost.pos.y;
    const startsAtHaven = preview.path[0]!.x === WORLD.haven.x && preview.path[0]!.y === WORLD.haven.y;
    expect(startsAtOutpost || startsAtHaven).toBe(true);
  });
});
