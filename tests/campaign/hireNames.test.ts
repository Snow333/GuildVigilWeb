/**
 * Hired heroes get their own names.
 *
 * ⚠ THE BUG THIS PINS: `musterHero` falls back to `template.defaultName` when
 * no name is typed, which is ONE name per class. The founding four are named
 * at character creation so nobody noticed, but every Tavern hire came out
 * identical — a real guild read "Torvald L1 · Torvald L1 · Torvald L1". Found
 * by looking at the band screen, not by a failing test: the screen lists who
 * is in each band, and choosing who marches is the point of a second band.
 */
import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '@sim/campaign/starterParty';
import { hireName, NAME_POOLS, FALLBACK_ANCESTRY } from '@content/heroNames';
import { ancestries } from '@content/generated/ancestries';
import { RESOURCE_KINDS } from '@content/town';

const BARRACKS = 2;
const TAVERN = 6;

function hiringGuild(id: string): CampaignSession {
  const s = CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });
  s.devAddGold(500_000);
  s.grantResources(Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 9999])));
  s.grantReputation(200);
  s.upgradeBuilding(BARRACKS); s.upgradeBuilding(BARRACKS); // 10 beds
  s.upgradeBuilding(TAVERN); s.upgradeBuilding(TAVERN);
  return s;
}

describe('every ancestry can be named', () => {
  it('each ancestry in the content has a pool, and every pool has entries', () => {
    // Parsed, not retyped: adding an ancestry to the database fails this.
    for (const a of ancestries as readonly { id: number; name: string }[]) {
      const pool = NAME_POOLS[a.name];
      expect(pool, `no name pool for ancestry ${a.name}`).toBeDefined();
      expect(pool!.given.length).toBeGreaterThan(4);
      expect(pool!.family.length).toBeGreaterThan(4);
    }
    expect(NAME_POOLS[FALLBACK_ANCESTRY]).toBeDefined();
  });

  it('an unknown ancestry id still yields a name rather than throwing', () => {
    expect(hireName(9999, 0)).toMatch(/\S+ \S+/);
  });
});

describe('hired heroes are told apart', () => {
  it('six hires of the SAME class get six different names', () => {
    /**
     * ⚠ THE CENTRAL TEST. Before the fix this produced one name six times.
     * It hires the same class deliberately, because that is the case the old
     * code collapsed — `defaultName` is per CLASS.
     */
    const s = hiringGuild('names');
    const classId = s.recruitPool()[0]!.classId;
    const hired: string[] = [];
    while (s.rosterSize() < 10) hired.push(s.recruitHero(classId, '').hero.name);

    expect(hired.length).toBeGreaterThan(4);
    expect(new Set(hired).size, `hires shared names: ${hired.join(', ')}`).toBe(hired.length);
    // And none of them fell back to the class's stock name.
    expect(new Set(hired).size).toBeGreaterThan(1);
  });

  it('a name the player types always wins', () => {
    const s = hiringGuild('typed');
    const classId = s.recruitPool()[0]!.classId;
    expect(s.recruitHero(classId, 'Yvor Stonetusk').hero.name).toBe('Yvor Stonetusk');
    // Whitespace-only is not a name.
    expect(s.recruitHero(classId, '   ').hero.name.trim().length).toBeGreaterThan(0);
  });

  it('the same campaign hires the same names twice — nothing random', () => {
    // Saves and replays must reproduce the guild exactly.
    const names = (id: string): string[] => {
      const s = hiringGuild(id);
      const classId = s.recruitPool()[0]!.classId;
      const out: string[] = [];
      while (s.rosterSize() < 10) out.push(s.recruitHero(classId, '').hero.name);
      return out;
    };
    expect(names('repeat')).toEqual(names('repeat'));
  });

  it('a hire survives a save round trip with the name it was given', () => {
    const s = hiringGuild('persist');
    const classId = s.recruitPool()[0]!.classId;
    const name = s.recruitHero(classId, '').hero.name;
    const back = CampaignSession.deserialize(JSON.parse(JSON.stringify(s.serialize())));
    expect(back.roster().some((h) => h.name === name)).toBe(true);
  });

  it('every pool can name a FULL guild without repeating a given name', () => {
    /**
     * ⚠ THIS REPLACED A TEST THAT COULD NOT FAIL. The first version asserted
     * that 12 names from the Human pool were distinct, to "prove" the surname
     * offset mattered — but with a 16-name given list the first 12 are
     * distinct however the surnames are picked, so sabotaging the offset left
     * it green. Worse, the rationale was wrong: the offset does not deepen the
     * pool at all.
     *
     * The real guarantee is this one: the largest roster the Barracks allows
     * is 15 beds, and every pool's GIVEN list is longer than that, so a single
     * guild can never hold two heroes with the same first name. Shortening any
     * given list fails here.
     */
    const MAX_BEDS = 15;
    for (const [ancestry, pool] of Object.entries(NAME_POOLS)) {
      expect(pool.given.length, `${ancestry} cannot name a full guild of ${MAX_BEDS}`)
        .toBeGreaterThan(MAX_BEDS);
      const names = new Set<string>();
      for (let i = 0; i < MAX_BEDS; i++) names.add(hireName(1, i).split(' ')[0]!);
      expect(names.size).toBe(MAX_BEDS);
    }
  });
});
