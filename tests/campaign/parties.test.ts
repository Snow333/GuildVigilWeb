/**
 * TWO PARTIES (M4) — the roster stops being the party.
 *
 * ⚠ M3 FUSED TWO DIFFERENT NUMBERS AND THIS MILESTONE SPLITS THEM.
 * `recruitHero` capped on `maxPartySize()` (the Guild Hall), so the guild
 * could never employ more heroes than it could march — no reserve, therefore
 * no second band. The Guild Hall says how many MARCH; the Barracks says how
 * many the guild HOUSES.
 *
 * ⚠ THE BAND COUNT IS NOT TUNED, IT IS READ. The roadmap's ladder is
 * "1x4 → 1x5 → 1x6 → 6+4", and Barracks level 2 was already authored as
 * `hero_cap_10`. Ten bodies is exactly 6+4, so the second band falls out of
 * content that has existed since before this milestone.
 */
import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { autoLevelHero } from '@sim/campaign/campaign';
import { starterParty } from '@sim/campaign/starterParty';
import { RESOURCE_KINDS } from '@content/town';

const GUILD_HALL = 1;
const BARRACKS = 2;
const TAVERN = 6;

/** A guild with the means to buy anything, so a test isolates ONE gate. */
function rich(id: string): CampaignSession {
  const s = CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });
  s.devAddGold(500_000);
  s.grantResources(Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 9999])));
  s.grantReputation(200);
  return s;
}

/** A guild that can field two full bands. */
function twoBands(id: string): CampaignSession {
  const s = rich(id);
  s.upgradeBuilding(BARRACKS); s.upgradeBuilding(BARRACKS); // hero_cap_10 → 2 bands
  s.upgradeBuilding(GUILD_HALL); s.upgradeBuilding(GUILD_HALL); // 6 march
  s.upgradeBuilding(TAVERN); s.upgradeBuilding(TAVERN);
  const pool = s.recruitPool();
  while (s.rosterSize() < 10) s.recruitHero(pool[s.rosterSize() % pool.length]!.classId, `Hire${s.rosterSize()}`);
  return s;
}

describe('the two numbers M3 had fused', () => {
  it('the Guild Hall says how many MARCH, the Barracks how many are HOUSED', () => {
    const s = rich('split');
    expect(s.maxPartySize()).toBe(4);
    expect(s.heroCapacity()).toBe(4);

    s.upgradeBuilding(BARRACKS);
    expect(s.heroCapacity()).toBe(6);
    expect(s.maxPartySize()).toBe(4); // unchanged — a bigger bunkhouse is not a bigger band

    s.upgradeBuilding(GUILD_HALL);
    expect(s.maxPartySize()).toBe(5);
    expect(s.heroCapacity()).toBe(6); // unchanged — a bigger hall is not more beds
  });

  it('a guild with no Barracks keeps exactly its founding four', () => {
    const s = rich('nobarracks');
    s.upgradeBuilding(TAVERN);
    expect(s.heroCapacity()).toBe(4);
    expect(() => s.recruitHero(1)).toThrow(/barracks houses 4/);
  });

  it('a reserve can exist: more heroes on the books than fit in the band', () => {
    const s = rich('reserve');
    s.upgradeBuilding(TAVERN);
    s.upgradeBuilding(BARRACKS); // 6 housed, 4 march
    s.recruitHero(1, 'A');
    s.recruitHero(4, 'B');
    expect(s.rosterSize()).toBe(6);
    expect(s.partyRosters()[0]!.length).toBe(4);
    expect(s.unassignedHeroes().length).toBe(2);
  });
});

describe('the band ladder is read off the Barracks, not tuned', () => {
  it('6 → one band, 10 → two (the roadmap\u2019s 6+4), 15 → three', () => {
    const s = rich('ladder');
    expect(s.partyCount()).toBe(1);
    s.upgradeBuilding(BARRACKS);
    expect(s.heroCapacity()).toBe(6);
    expect(s.partyCount()).toBe(1);
    s.upgradeBuilding(BARRACKS);
    expect(s.heroCapacity()).toBe(10);
    expect(s.partyCount()).toBe(2);
    s.upgradeBuilding(BARRACKS);
    expect(s.heroCapacity()).toBe(15);
    expect(s.partyCount()).toBe(3);
  });

  it('a hero cap of 10 really is 6 + 4 with a level-3 hall', () => {
    const s = twoBands('sixfour');
    expect(s.rosterSize()).toBe(10);
    expect(s.partyRosters().map((p) => p.length).slice(0, 2)).toEqual([6, 4]);
    expect(s.unassignedHeroes()).toEqual([]);
  });
});

describe('two bands, two jobs, one week', () => {
  it('each band takes its own quest and both resolve', () => {
    const s = twoBands('two');
    s.advanceWeek();
    const board = s.board();
    expect(board.length).toBeGreaterThanOrEqual(2);

    s.acceptQuest(board[0]!.questId, 0);
    s.acceptQuest(board[1]!.questId, 1);
    const actives = s.activeByParty();
    expect(actives[0]?.questId).toBe(board[0]!.questId);
    expect(actives[1]?.questId).toBe(board[1]!.questId);

    const a = s.launchDispatch(0);
    const b = s.launchDispatch(1);
    expect(a.questId).toBe(board[0]!.questId);
    expect(b.questId).toBe(board[1]!.questId);
    expect(s.activeByParty()).toEqual([null, null]);
  });

  it('the two bands share no heroes', () => {
    // ⚠ The whole point. If `launchDispatch` still assembled `this.kits`,
    // both bands would march the entire roster and this would be the only
    // test that noticed.
    const s = twoBands('nooverlap');
    const [first, second] = s.partyRosters();
    expect(first!.length).toBeGreaterThan(0);
    expect(second!.length).toBeGreaterThan(0);
    expect(first!.filter((id) => second!.includes(id))).toEqual([]);
  });

  it('an IDLE band cannot take a job another band already holds', () => {
    const s = twoBands('nodouble');
    s.advanceWeek();
    const questId = s.board()[0]!.questId;
    s.acceptQuest(questId, 0);
    // Band 2 is free, but the posting is gone from the board.
    expect(s.board().some((e) => e.questId === questId)).toBe(false);
    expect(() => s.acceptQuest(questId, 1)).toThrow();
  });

  it('a quest band 2 is OUT on is never re-posted to the board', () => {
    /**
     * ⚠ THIS IS THE TEST THAT GUARDS `postable`, AND THE BOARD TEST ABOVE IS
     * NOT. `acceptQuest` splices the posting out of `open` directly, so
     * `board()` hides it no matter what `postable` says — a negative control
     * that reverted `postable` to checking only party 1's job left every other
     * test GREEN. `postable` decides RE-POSTING on later weeks, so the bug it
     * guards is: band 2 marches off with a quest, next week the board offers
     * the same quest again, and band 1 can take the job band 2 is already
     * doing.
     */
    const s = twoBands('repost');
    s.advanceWeek();
    const questId = s.board()[0]!.questId;
    s.acceptQuest(questId, 1);

    for (let w = 0; w < 12; w++) {
      s.advanceWeek();
      expect(
        s.board().some((e) => e.questId === questId),
        `week ${w + 2}: quest ${questId} was re-posted while band 2 was out on it`,
      ).toBe(false);
      expect(s.activeByParty()[1]?.questId).toBe(questId);
    }
  });

  it('a busy band refuses a second job', () => {
    const s = twoBands('busy');
    s.advanceWeek();
    const board = s.board();
    s.acceptQuest(board[0]!.questId, 0);
    expect(() => s.acceptQuest(board[1]!.questId, 0)).toThrow(/party 1 is already on quest/);
  });

  it('partyLevelIf answers what a band WOULD read, without changing anything', () => {
    /**
     * The band screen shows "stays 7" / "7 → 6" beside a hero at the hall, so
     * this exists to stop the component re-implementing `partyLevel`'s
     * mean-and-round rule where it could drift.
     *
     * ⚠ THE HYPOTHETICAL HERO MUST BE THE ONE THAT MOVES THE MEAN. Two earlier
     * drafts were vacuous. The first used the stock roster, where every hero
     * is level 1, so nothing could move it. The second benched a LEVEL-1 hero
     * out of a mostly level-1 band — [6,1,1,1,1] rounds to 2 and
     * [6,1,1,1,1,1] also rounds to 2, so dropping the hypothetical entirely
     * still passed. Benching the HIGH-level hero makes its return visible.
     */
    const s = twoBands('wouldbe');
    const climber = s.partyRosters()[0]![1]!;
    for (let i = 0; i < 6; i++) { s.devGrantLevel(climber); autoLevelHero(s, climber); }
    s.assignHero(climber, null); // the veteran waits at the hall
    expect(s.unassignedHeroes()).toContain(climber);

    const withoutHim = s.partyLevel(0);
    const withHim = s.partyLevelIf(climber, 0);
    expect(withHim, 'adding a veteran did not change the reading — the test is blind')
      .toBeGreaterThan(withoutHim);

    // Asking must not MOVE anybody.
    const before = JSON.stringify(s.serialize());
    s.partyLevelIf(climber, 0);
    expect(JSON.stringify(s.serialize())).toBe(before);
    expect(s.unassignedHeroes()).toContain(climber);
    expect(s.partyLevel(0)).toBe(withoutHim);

    // And it must agree with reality once the move actually happens.
    s.assignHero(climber, 0);
    expect(s.partyLevel(0)).toBe(withHim);
  });

  it('partyLevelIf(hero, null) reports the band it would LEAVE', () => {
    const s = twoBands('leaving');
    // Same requirement: a departure can only show up if levels differ.
    const climber = s.partyRosters()[0]![1]!;
    for (let i = 0; i < 5; i++) { s.devGrantLevel(climber); autoLevelHero(s, climber); }
    const band = s.partyRosters()[0]!;
    const id = climber;
    expect(band).toContain(id);
    const after = s.partyLevelIf(id, null);
    s.assignHero(id, null);
    expect(s.partyLevel(0)).toBe(after);
  });

  it('a hero sent to the hall STAYS at the hall', () => {
    /**
     * ⚠ THIS WAS IMPOSSIBLE UNTIL THE FOUNDING PARTY MOVED TO THE CONSTRUCTOR.
     * `syncParties` used to refill band 1 whenever it found every band empty,
     * reading that as "brand-new campaign" — indistinguishable from "the
     * player deliberately benched everyone". So benching silently undid
     * itself and a reserve existed only as overflow, never as a choice. The
     * band screen's whole premise is leaving a hero home, so this is the test
     * that premise rests on.
     */
    const s = twoBands('bench');
    const id = s.partyRosters()[0]![0]!;
    s.assignHero(id, null);
    expect(s.unassignedHeroes()).toContain(id);
    expect(s.partyRosters()[0]).not.toContain(id);
    // Read it again: every party reader calls syncParties, which used to undo this.
    expect(s.partyRosters()[0]).not.toContain(id);
    expect(s.partyLevel(0)).toBeGreaterThan(0);
  });

  it('the whole roster can sit at the hall, and still be there after a save', () => {
    const s = twoBands('benchall');
    for (const band of s.partyRosters()) for (const id of band) s.assignHero(id, null);
    expect(s.partyRosters().every((b) => b.length === 0)).toBe(true);
    expect(s.unassignedHeroes().length).toBe(s.rosterSize());

    const reloaded = CampaignSession.deserialize(JSON.parse(JSON.stringify(s.serialize())));
    expect(reloaded.partyRosters().every((b) => b.length === 0)).toBe(true);
    // ⚠ And the round trip is still idempotent — the earlier Haven bug was
    // exactly this shape: state invented on restore rather than at creation.
    expect(JSON.stringify(reloaded.serialize())).toBe(JSON.stringify(s.serialize()));
  });

  it('a fresh campaign still marches with its founding party', () => {
    // The flip side: moving the fill must not leave a new guild with nobody
    // in band 1, which would make the game unplayable from week one.
    const s = twoBands('fresh');
    expect(s.partyRosters()[0]!.length).toBeGreaterThan(0);
    expect(s.unassignedHeroes().length).toBeLessThan(s.rosterSize());
  });

  it('a band with nobody in it is refused the job in the first place', () => {
    /**
     * ⚠ REVERSED DELIBERATELY. This test used to accept a job for the empty
     * band and assert that LAUNCHING it threw. That was the wrong place to
     * stop it: taking a job marks the band as out, `assignHero` refuses to
     * reshuffle a band that is out, and `launchDispatch` refuses to send an
     * empty one — so the band sat holding work it could neither staff nor
     * march, escapable only by abandoning. The refusal belongs at accept.
     */
    const s = twoBands('empty');
    for (const id of [...s.partyRosters()[1]!]) s.assignHero(id, null);
    expect(s.partyRosters()[1]).toEqual([]);
    s.advanceWeek();
    expect(() => s.acceptQuest(s.board()[0]!.questId, 1)).toThrow(/has no heroes/);
    // The job it was refused is still on the board for someone else to take.
    expect(s.board().length).toBeGreaterThan(0);
    expect(s.activeByParty()[1]).toBeNull();
  });

  it('the launch guard still stands behind it', () => {
    // Belt and braces: emptying a band AFTER it took a job is not reachable
    // through `assignHero` (it refuses while out), but the guard stays so a
    // future caller cannot march nobody.
    const s = twoBands('emptylaunch');
    s.advanceWeek();
    s.acceptQuest(s.board()[0]!.questId, 1);
    expect(() => s.assignHero(s.partyRosters()[1]![0]!, null)).toThrow(/is out on a job/);
  });

  it('only the dispatching band is freed when a job ends', () => {
    const s = twoBands('free');
    s.advanceWeek();
    const board = s.board();
    s.acceptQuest(board[0]!.questId, 0);
    s.acceptQuest(board[1]!.questId, 1);
    s.launchDispatch(1);
    // ⚠ Band 1 must still be out. An earlier draft cleared `this.active`
    // (party 1's slot) from inside the dispatch, so sending band 2 freed
    // band 1 and left band 2 stuck on its quest forever.
    expect(s.activeByParty()[0]?.questId).toBe(board[0]!.questId);
    expect(s.activeByParty()[1]).toBeNull();
  });

  it('abandoning is per band', () => {
    const s = twoBands('abandon');
    s.advanceWeek();
    const board = s.board();
    s.acceptQuest(board[0]!.questId, 0);
    s.acceptQuest(board[1]!.questId, 1);
    s.abandonQuest(1);
    expect(s.activeByParty()[0]?.questId).toBe(board[0]!.questId);
    expect(s.activeByParty()[1]).toBeNull();
  });

  it('a site expedition can be run by the second band', () => {
    const s = twoBands('siteband');
    const site = s.availableExpeditions().find((e) => e.site.level === 1)!;
    s.advanceWeek();
    s.acceptSiteExpedition(site.site.regionId, site.site.kind, 1);
    expect(s.activeByParty()[1]).not.toBeNull();
    expect(s.activeByParty()[0]).toBeNull();
    s.launchDispatch(1);
    expect(s.securedSites().length).toBe(1);
  });
});

describe('assigning heroes', () => {
  it('a hero can be moved between bands, and out to the hall', () => {
    const s = twoBands('move');
    const mover = s.partyRosters()[1]![0]!;
    s.assignHero(mover, null);
    expect(s.unassignedHeroes()).toContain(mover);
    expect(s.partyRosters()[1]).not.toContain(mover);
    s.assignHero(mover, 1);
    expect(s.partyRosters()[1]).toContain(mover);
  });

  it('the Guild Hall caps a band, so a full band refuses a transfer', () => {
    const s = twoBands('fullband');
    expect(s.partyRosters()[0]!.length).toBe(s.maxPartySize());
    const other = s.partyRosters()[1]![0]!;
    expect(() => s.assignHero(other, 0)).toThrow(/guild hall is the limit/);
  });

  it('a band that is out on a job cannot be reshuffled', () => {
    // ⚠ The hero is not physically in town, and swapping them would change
    // the party the dispatch is about to resolve.
    const s = twoBands('locked');
    s.advanceWeek();
    s.acceptQuest(s.board()[0]!.questId, 0);
    const marching = s.partyRosters()[0]![0]!;
    expect(() => s.assignHero(marching, null)).toThrow(/out on a job/);
    expect(() => s.assignHero(s.partyRosters()[1]![0]!, 0)).toThrow(/out on a job/);
  });

  it('a band the Barracks cannot support is refused', () => {
    const s = rich('noband2');
    s.upgradeBuilding(BARRACKS); // 6 housed → still one band
    expect(s.partyCount()).toBe(1);
    expect(() => s.assignHero(s.partyRosters()[0]![0]!, 1)).toThrow(/houses 1 band/);
  });

  it('an unknown hero is refused', () => {
    expect(() => rich('ghost').assignHero('hero_999', 0)).toThrow(/no hero/);
  });
});

describe('persistence', () => {
  it('bands and their jobs survive a save and load', () => {
    const s = twoBands('save');
    s.advanceWeek();
    const board = s.board();
    s.acceptQuest(board[0]!.questId, 0);
    s.acceptQuest(board[1]!.questId, 1);

    const back = CampaignSession.deserialize(s.serialize());
    expect(back.partyRosters()).toEqual(s.partyRosters());
    expect(back.activeByParty()).toEqual(s.activeByParty());
    expect(back.heroCapacity()).toBe(s.heroCapacity());
    expect(back.partyCount()).toBe(s.partyCount());
    // ...and the restored second band can still be launched.
    expect(() => back.launchDispatch(1)).not.toThrow();
  });

  it('a pre-M4 save loads as one band and loses nobody', () => {
    const s = twoBands('legacy');
    const saved = JSON.parse(JSON.stringify(s.serialize())) as Record<string, unknown>;
    delete saved['parties'];
    delete saved['partyActives'];

    const back = CampaignSession.deserialize(saved as never);
    expect(back.rosterSize()).toBe(10);
    // Everyone is either marching or waiting at the hall — nobody vanishes.
    const placed = back.partyRosters().flat().length + back.unassignedHeroes().length;
    expect(placed).toBe(10);
    expect(back.partyRosters()[0]!.length).toBeLessThanOrEqual(back.maxPartySize());
  });

  it('a hand-mangled party list is repaired, not fatal', () => {
    const s = twoBands('mangled');
    const saved = JSON.parse(JSON.stringify(s.serialize())) as Record<string, unknown>;
    // A hero who does not exist, a duplicate, and a non-string.
    saved['parties'] = [['hero_1', 'hero_1', 'hero_404', 7], ['hero_2']];
    const back = CampaignSession.deserialize(saved as never);
    expect(back.partyRosters()[0]).toEqual(['hero_1']);
    expect(back.partyRosters()[1]).toEqual(['hero_2']);
    expect(back.unassignedHeroes().length).toBe(8);
  });
});
