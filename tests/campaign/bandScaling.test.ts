/**
 * BAND-AWARE SCALING (M4) — the fix that makes two parties playable.
 *
 * ⚠ `partyLevel()` AVERAGED THE WHOLE ROSTER, AND THREE SYSTEMS READ IT.
 * Once a second band existed that was wrong in three different directions:
 *
 *   launchDispatch  scaled the DUNGEON to the roster average, so a green
 *                   B-team was sent into content pitched above it while the
 *                   A-team got content pitched below.
 *   forecast        assembled `this.kits` — the whole roster — so it predicted
 *                   the outcome for a party that would never be sent. That
 *                   breaks the one guarantee forecast has (risk R5: same
 *                   inputs, same resolution path as the real dispatch).
 *   board           labelled every job against the average, so hiring four
 *                   green recruits quietly made the whole board read easier.
 *
 * Measured on a guild with a level-7 A-team and four level-1 recruits: band 1
 * reads level 5, band 2 reads level 1, and the old roster average was 3 — a
 * number describing neither band. On one posting the corrected forecast gives
 * band 1 8/24 completions and band 2 0/24 with 19 wipes.
 */
import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '@sim/campaign/starterParty';
import { autoLevelHero } from '@sim/campaign/campaign';
import { RESOURCE_KINDS } from '@content/town';
import { questsById } from '@sim/registry';

const GUILD_HALL = 1;
const BARRACKS = 2;
const TAVERN = 6;

/** A guild with an experienced first band and a green second band. */
function lopsided(id: string): CampaignSession {
  const s = CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });
  s.devAddGold(500_000);
  s.grantResources(Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 9999])));
  s.grantReputation(200);
  s.upgradeBuilding(BARRACKS); s.upgradeBuilding(BARRACKS);   // 10 beds → 2 bands
  s.upgradeBuilding(GUILD_HALL); s.upgradeBuilding(GUILD_HALL); // 6 march
  s.upgradeBuilding(TAVERN); s.upgradeBuilding(TAVERN);

  // The founding four climb to 7 through the real level-up path.
  for (const h of s.roster()) {
    for (let i = 0; i < 6; i++) {
      s.devGrantLevel(h.id);
      autoLevelHero(s, h.id);
    }
  }
  const pool = s.recruitPool();
  while (s.rosterSize() < 10) s.recruitHero(pool[s.rosterSize() % pool.length]!.classId, `Green${s.rosterSize()}`);
  return s;
}

describe('partyLevel knows which band is asking', () => {
  it('a band reports its OWN average, not the roster\u2019s', () => {
    const s = lopsided('own');
    const levelsIn = (i: number): number[] => {
      const ids = s.partyRosters()[i]!;
      return s.roster().filter((r) => ids.includes(r.id)).map((r) => r.level);
    };
    const first = levelsIn(0);
    const second = levelsIn(1);
    expect(Math.max(...first)).toBeGreaterThan(Math.max(...second));
    expect(s.partyLevel(0)).toBeGreaterThan(s.partyLevel(1));
    expect(s.partyLevel(1)).toBe(1); // four green recruits
  });

  it('with no band named it is the guild\u2019s REACH, not the average', () => {
    /**
     * ⚠ The average was the subtler half of the bug: hiring recruits for a
     * B-team dragged it down and made the shared board read easier, even
     * though the main band had not changed. Reach is what a shared board
     * should answer to.
     */
    const s = lopsided('reach');
    const all = s.roster().map((r) => r.level);
    const average = Math.max(Math.round(all.reduce((a, b) => a + b, 0) / all.length), 1);
    expect(s.partyLevel()).toBe(s.partyLevel(0));
    expect(s.partyLevel()).toBeGreaterThan(average);
  });

  it('an empty band reports 1 rather than dividing by zero', () => {
    const s = lopsided('empty');
    for (const id of [...s.partyRosters()[1]!]) s.assignHero(id, null);
    expect(s.partyLevel(1)).toBe(1);
  });
});

describe('the board can be read through one band\u2019s eyes', () => {
  it('the same job reads harder for the green band', () => {
    const s = lopsided('eyes');
    s.advanceWeek();
    const reach = s.board();
    const green = s.board(1);
    expect(reach.length).toBeGreaterThan(0);
    expect(green.length).toBe(reach.length);

    // At least one posting must change tier between the two readings, or the
    // parameter is decoration.
    const moved = reach.filter((r, i) => green[i]!.difficulty.tier > r.difficulty.tier);
    expect(moved.length).toBeGreaterThan(0);
  });

  it('the reason says "them", never "the guild"', () => {
    // Read through band 2's eyes, "over the guild" was nonsense: the guild's
    // reach IS band 1.
    const s = lopsided('voice');
    s.advanceWeek();
    for (const entry of s.board(1)) {
      expect(entry.difficulty.reason).not.toContain('the guild');
    }
  });
});

describe('the forecast is about the band that would actually go', () => {
  it('a green band forecasts worse than the veteran band on the SAME job', () => {
    /**
     * ⚠ THE CENTRAL TEST. Before the fix both calls simulated all ten heroes,
     * so the two forecasts were identical and both described a party that
     * never marches.
     */
    const s = lopsided('fc');
    s.advanceWeek();
    const board = s.board();
    expect(board.length).toBeGreaterThan(0);
    const questId = board[0]!.questId;
    const cfg = { profile: 'fullExplore' as const, caution: 'standard' as const };

    const veteran = s.forecast(questId, cfg, 24, 0);
    const green = s.forecast(questId, cfg, 24, 1);
    expect(veteran.completed).toBeGreaterThan(green.completed);
    expect(green.wiped).toBeGreaterThan(veteran.wiped);
  });

  it('the forecast consumes no campaign state, per band', () => {
    const s = lopsided('pure');
    s.advanceWeek();
    const questId = s.board()[0]!.questId;
    const before = JSON.stringify(s.serialize());
    s.forecast(questId, { profile: 'fullExplore', caution: 'standard' }, 8, 1);
    expect(JSON.stringify(s.serialize())).toBe(before);
  });
});

describe('the dungeon is scaled to the band that marches', () => {
  it('the SAME quest gives the two bands different hazard DCs', () => {
    /**
     * ⚠ THE FIRST VERSION OF THIS TEST WAS VACUOUS. It compared the veteran
     * band's win rate with the green band's, and passed with the scaling
     * sabotaged — of course it did: the two bands differ in COMPOSITION, so
     * the veterans win more whatever level the dungeon is pitched at. It
     * measured "stronger heroes win more", which was never in doubt.
     *
     * `partyLevel` reaches the dungeon as a term in the hazard and skill DCs
     * (`population.ts`: `+ Math.floor(partyLevel / 2)`), so a trap roll's DC
     * is the real witness. Two sessions on the SAME SEED take the SAME quest
     * into the SAME dungeon; the only difference is which band marches, so any
     * difference in DC is the scaling and nothing else. Restore roster scaling
     * and both bands read the same average, which makes the DCs identical and
     * fails this test.
     */
    const dcsFor = (seed: string, band: number): number[] => {
      const s = lopsided(seed);
      s.advanceWeek();
      // ⚠ A DUNGEON quest. `QuestRecord.dispatch` — and therefore the stream
      // carrying the DC rolls — is only populated for dungeon jobs; a camp
      // fight resolves on the surface and has none.
      const dungeon = s.board().find((e) => questsById.get(e.questId)?.quest_type === 'dungeon');
      if (!dungeon) return [];
      s.acceptQuest(dungeon.questId, band);
      const record = s.launchDispatch(band);
      const stream = record.dispatch?.stream;
      if (!stream) return [];
      return stream.all()
        .filter((ev) => ev.type === 'explore.trap_disarm_attempted')
        .map((ev) => (ev.data as { roll: { dc: number } }).roll.dc);
    };

    /**
     * ⚠ COMPARES THE FIRST TRAP ROLL, NOT THE AVERAGE. The two bands explore
     * DIFFERENT rooms — the green band dies earlier — so an average over each
     * band's own room sample is not a like-for-like reading, and the first
     * draft failed on that confound (14 vs 14.29) rather than on the thing it
     * was testing. The first trap is the same trap in the same room on the
     * same seed, so the only term that can differ is the party-level one.
     *
     * ⚠ ASSERTS THE DIRECTION, NOT A HARDCODED GAP. A first draft predicted
     * exactly `floor(5/2) - floor(1/2) = 2` and measured 1 — the trap DC does
     * not reduce to that one term, and pinning an arithmetic guess would have
     * made this test a statement about a formula rather than about the band.
     * Strictly higher for the stronger band is the claim that matters, and it
     * is what collapses to equal when the scaling is reverted.
     */
    let compared = 0;
    for (let i = 0; i < 12; i++) {
      const veteran = dcsFor(`dc${i}`, 0);
      const green = dcsFor(`dc${i}`, 1);
      if (veteran.length === 0 || green.length === 0) continue;
      compared += 1;
      expect(
        veteran[0]!,
        `seed dc${i}: the two bands met the same first trap at the same DC, `
        + 'so the dungeon is not being scaled to the band that marches',
      ).toBeGreaterThan(green[0]!);
    }
    expect(compared, 'no seed produced a trap roll for both bands — widen the sample').toBeGreaterThan(0);
  }, 180_000);
});
