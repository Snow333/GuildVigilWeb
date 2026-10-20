/**
 * Fixtures for the band-screen tests (not a test file itself).
 *
 *  - `realGuild`   a REAL CampaignSession with 1-3 bands whose levels DIFFER,
 *                  because a fixture where every hero shares a level cannot
 *                  express the thing the screen is for (a band's own reading).
 *  - `fakeSource`  a hand-built `BandSource`, so a single rule can be pinned
 *                  without any of the sim's other behaviour leaking in.
 */

import { CampaignSession, type BoardEntry } from '@sim/campaign/session';
import { autoLevelHero } from '@sim/campaign/campaign';
import { difficultyFor } from '@sim/campaign/difficulty';
import { starterParty } from '@sim/campaign/starterParty';
import { RESOURCE_KINDS } from '@content/town';
import type { BandSource } from '../../src/ui/screens/bandPicks';

/** Raise a hero by `n` levels through the production level-up path. */
export function levelUp(s: CampaignSession, heroId: string, n: number): void {
  for (let i = 0; i < n; i++) {
    s.devGrantLevel(heroId);
    autoLevelHero(s, heroId);
  }
}

export interface GuildSpec {
  /** Bands the Barracks supports (1-3). */
  bands: 1 | 2 | 3;
  /** Extra heroes kept at the hall, beyond the bands' own. */
  hall?: number;
  /** Levels GAINED per band (index 0 = Band 1), on top of level 1. Hall heroes stay level 1 unless `hallLevels`. */
  gains?: number[];
  /** Heroes seated per band; defaults to the Guild Hall cap (4) for every band. */
  seats?: number[];
  /** Levels gained by each hall hero, in order. */
  hallLevels?: number[];
  /** Weeks to advance after seating, so the board is redrawn for the bands' real levels. */
  weeks?: number;
  seed?: string;
}

/**
 * A real session in a settled week-1 state:
 *   Band 1 = hero_1.., Band 2 next, Band 3 next, the rest wait at the hall.
 * Every hero is recruited through `recruitHero` and placed with `assignHero`
 * — production paths only.
 */
export function realGuild(spec: GuildSpec): CampaignSession {
  const s = CampaignSession.create({
    campaignId: spec.seed ?? 'bandscreen', seed: `world_${spec.seed ?? 'bandscreen'}`, party: starterParty(),
  });
  s.advanceWeek();
  s.devAddGold(500_000);
  s.grantResources(Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 999])));
  s.grantReputation(100);
  s.upgradeBuilding(6); // Tavern: recruits
  for (let i = 0; i < spec.bands; i++) s.upgradeBuilding(2); // Barracks: 6 / 10 / 15 beds
  const cap = s.maxPartySize();
  const seats = spec.seats ?? Array.from({ length: spec.bands }, () => cap);
  const need = seats.reduce((a, b) => a + b, 0) + (spec.hall ?? 0);
  const pool = s.recruitPool();
  while (s.rosterSize() < need) s.recruitHero(pool[s.rosterSize() % pool.length]!.classId, '');

  const ids = s.roster().map((r) => r.id);
  for (const id of ids) s.assignHero(id, null);
  let at = 0;
  seats.forEach((n, band) => {
    for (let k = 0; k < n; k++) s.assignHero(ids[at++]!, band);
  });
  const gains = spec.gains ?? [];
  seats.forEach((n, band) => {
    const start = seats.slice(0, band).reduce((a, b) => a + b, 0);
    for (let k = 0; k < n; k++) levelUp(s, ids[start + k]!, gains[band] ?? 0);
  });
  const hallIds = ids.slice(at);
  (spec.hallLevels ?? []).forEach((g, i) => { if (hallIds[i]) levelUp(s, hallIds[i]!, g); });
  for (let w = 0; w < (spec.weeks ?? 0); w++) s.advanceWeek();
  return s;
}

// ── a hand-built source ─────────────────────────────────────────────────────

export interface FakeHero { id: string; level: number; band: number | null; wounded?: number; status?: 'active' | 'dead' }
export interface FakePosting { questId: number; challenge: number; xp: number; gold?: number }

export interface FakeSpec {
  heroes: FakeHero[];
  postings: FakePosting[];
  /** band index → the questId it holds */
  out?: Record<number, number>;
  bands: number;
  cap?: number;
}

const meanRound = (levels: number[]): number =>
  levels.length === 0 ? 1 : Math.max(Math.round(levels.reduce((a, b) => a + b, 0) / levels.length), 1);

/**
 * A `BandSource` over plain data. Its arithmetic stands in for the sim's
 * (mean-and-round, `difficultyFor` for the words); the module under test only
 * passes those through, so the fake needs to be self-consistent, not faithful.
 */
export function fakeSource(spec: FakeSpec): BandSource {
  const cap = spec.cap ?? 6;
  const rosters = (): string[][] =>
    Array.from({ length: spec.bands }, (_, b) => spec.heroes.filter((h) => h.band === b).map((h) => h.id));
  const levelOf = (b: number): number =>
    meanRound(spec.heroes.filter((h) => h.band === b).map((h) => h.level));
  const open = spec.postings.filter((p) => !Object.values(spec.out ?? {}).includes(p.questId));
  const entry = (p: FakePosting, level: number): BoardEntry => {
    const difficulty = difficultyFor(p.challenge, level);
    return {
      questId: p.questId, name: `Job ${p.questId}`, minLevel: p.challenge, challenge: p.challenge,
      difficulty, ease: difficulty.tier === 3 ? 'hard' : difficulty.tier === 2 ? 'fair' : 'easy',
      commission: false, regionId: 'region_haven', postedWeek: 1, expiresWeek: 9,
      rewardGold: p.gold ?? 100, rewardXp: p.xp, pressureTier: 0, pos: { x: 0, y: 0 }, discovered: true,
    };
  };
  const source = {
    partyRosters: rosters,
    unassignedHeroes: () => spec.heroes.filter((h) => h.band === null).map((h) => h.id),
    partyCount: () => spec.bands,
    maxPartySize: () => cap,
    heroCapacity: () => 10,
    partyLevel: (i?: number) => (i === undefined ? Math.max(...rosters().map((_, b) => levelOf(b))) : levelOf(i)),
    partyLevelIf: (heroId: string, band: number | null) => {
      const hero = spec.heroes.find((h) => h.id === heroId)!;
      if (band === null) {
        return meanRound(spec.heroes.filter((h) => h.band === hero.band && h.id !== heroId).map((h) => h.level));
      }
      return meanRound([...spec.heroes.filter((h) => h.band === band && h.id !== heroId), hero].map((h) => h.level));
    },
    activeByParty: () =>
      Array.from({ length: spec.bands }, (_, b) =>
        spec.out?.[b] !== undefined ? { questId: spec.out[b]!, regionId: 'region_haven' } : null),
    board: (i?: number) => open.map((p) => entry(p, i === undefined ? Math.max(...rosters().map((_, b) => levelOf(b))) : levelOf(i))),
    roster: () => spec.heroes.map((h) => ({
      id: h.id, name: `Hero ${h.id}`, level: h.level, status: h.status ?? 'active',
      xp: { atCap: false, progress: 0, threshold: 1 }, maxHp: 10, wounded: h.wounded ?? 0,
      ancestry: 0, ancestryName: 'Human', gender: 'f', portraitKey: 'hero-human-f',
    })),
    heroSheet: () => ({ classes: [{ classId: 1, name: 'Fighter', level: 1 }] }),
    questName: (id: number) => `Job ${id}`,
    regionName: () => 'The Vigil Lands',
    currentWeek: () => 1,
    goldAmount: () => 100,
  };
  return source as unknown as BandSource;
}
