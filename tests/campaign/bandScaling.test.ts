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

  it('the reason says "them", never "the guild" — for every difficulty word', () => {
    /**
     * ⚠ MUST EXERCISE EVERY REASON STRING, NOT JUST THE ONES ONE BAND HAPPENS
     * TO SEE. A first version read only band 2's board, which is all hard
     * words, so the 'Routine' string was never produced — and 'Routine' was
     * exactly the one that still said "well within the guild" after the
     * rewrite. (My own grep missed it too: the pattern covered "over/above/
     * under the guild" but not "within".) This sweeps both bands across
     * several weeks and asserts it saw a RANGE of words, so the sample cannot
     * quietly shrink back to one.
     */
    const s = lopsided('voice');
    const seen = new Set<string>();
    for (let w = 0; w < 6; w++) {
      s.advanceWeek();
      for (const band of [0, 1]) {
        for (const entry of s.board(band)) {
          seen.add(entry.difficulty.id);
          expect(entry.difficulty.reason, `"${entry.difficulty.label}" still talks about the guild`)
            .not.toContain('the guild');
        }
      }
    }
    expect(seen.size, `only saw ${[...seen].join(',')} — too few words to prove anything`)
      .toBeGreaterThan(2);
  }, 120_000);
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
    /**
     * ⚠ THE HARDEST POSTING, NOT `board()[0]`. Once the board started serving
     * every band it also posts level-1 work, and both bands clear that 24/24 —
     * the metric saturated and this test failed at "expected 24 to be greater
     * than 24" while the code was correct. A comparison needs a job whose
     * outcome is actually in doubt.
     */
    const questId = [...board]
      .sort((a, b) => (questsById.get(b.questId)!.min_level as number)
        - (questsById.get(a.questId)!.min_level as number))[0]!.questId;
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

describe('the board gives every band something to do', () => {
  it('a green second band is not shut out of the whole board', () => {
    /**
     * ⚠ THE FINDING THAT DECIDES WHETHER TWO BANDS ARE FUN AT ALL. The board
     * was drawn against ONE level (`partyLevel()` with no argument), so for a
     * guild with a level-5 first band and level-1 recruits it posted only
     * min_level 4-7. Measured over 48 weeks: band 1 could take 93% of
     * postings and band 2 could take **0 of 248** — every single job read
     * "Beyond us". A second band had literally nothing to do, which made the
     * whole M4 feature decoration, and no UI could have fixed it.
     *
     * Note the no-argument `partyLevel()` change (roster average -> guild
     * reach) made this WORSE, not better: the average at least sat between the
     * two bands. The real answer is that a shared board is not one level at
     * all — a posting is eligible if it falls inside ANY band's window.
     *
     * After: band 1 100% usable, band 2 44%. Band 2 is not expected to reach
     * 100% — a level-1 band SHOULD find a level-6 job beyond it. The claim is
     * that it has work, not that everything is within reach.
     */
    const usable = [0, 0];
    const beyond = [0, 0];
    for (let i = 0; i < 6; i++) {
      const s = lopsided(`board${i}`);
      for (let w = 0; w < 5; w++) {
        s.advanceWeek();
        for (const band of [0, 1]) {
          for (const entry of s.board(band)) {
            if (entry.difficulty.id === 'beyond') beyond[band]! += 1;
            else usable[band]! += 1;
          }
        }
      }
    }
    expect(usable[0]! + beyond[0]!, 'no postings at all — the test proved nothing').toBeGreaterThan(50);
    // The veteran band obviously has work.
    expect(usable[0]!).toBeGreaterThan(beyond[0]!);
    /**
     * The green band must have a real share of the board. The floor is well
     * under the measured 44% so ordinary content changes do not trip it, but
     * far above the 0% that shipped.
     */
    const greenShare = usable[1]! / (usable[1]! + beyond[1]!);
    expect(greenShare, 'the second band is shut out of the board again').toBeGreaterThan(0.15);
  }, 180_000);

  it('an EMPTY band does not drag the board down to level 1', () => {
    /**
     * `bandLevels` skips empty bands, because an empty band cannot take work
     * (`acceptQuest` refuses it). Without the skip a guild that has unlocked
     * a second barracks band but not yet staffed it would have beginner jobs
     * posted forever alongside its real work.
     */
    const s = lopsided('emptyband');
    for (const id of [...s.partyRosters()[1]!]) s.assignHero(id, null);
    expect(s.partyRosters()[1]).toEqual([]);
    const mins = new Set<number>();
    for (let w = 0; w < 5; w++) {
      s.advanceWeek();
      for (const entry of s.board()) mins.add(questsById.get(entry.questId)!.min_level as number);
    }
    // Band 1 is level 5, so nothing near level 1 should be posted for a
    // phantom band nobody is in.
    expect(Math.min(...mins), `posted min_levels ${[...mins].sort((a, b) => a - b).join(',')}`)
      .toBeGreaterThan(1);
  }, 120_000);

  it('the board spans more than one band\u2019s level window', () => {
    // The direct witness: postings must cover a RANGE of min_levels, not a
    // window around a single number.
    const s = lopsided('span');
    const mins = new Set<number>();
    for (let w = 0; w < 5; w++) {
      s.advanceWeek();
      for (const entry of s.board()) mins.add(questsById.get(entry.questId)!.min_level as number);
    }
    const low = Math.min(...mins);
    const high = Math.max(...mins);
    expect(high - low, `board only spanned min_levels ${[...mins].sort((a, b) => a - b).join(',')}`)
      .toBeGreaterThan(2);
  }, 120_000);
});
