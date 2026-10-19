/**
 * SITE EXPEDITIONS (M3) — the missions that take a resource site.
 *
 * ⚠ WITHOUT THESE, THE WHOLE TOWN ECONOMY IS DECORATION. `secureSite()` banks
 * a site, but nothing could legitimately call it: there was no way to go and
 * TAKE one, so resources could never arrive and no upgrade could ever be paid
 * for. This file is the earning half of the loop.
 *
 * ── WHY THESE ARE REAL QUEST ROWS ──────────────────────────────────────────
 *
 * `launchDispatch` resolves its quest through `questsById`, and travel, rewards,
 * XP, the beat feed, the after-action report and the save format all key on a
 * quest id. A bespoke "expedition" path beside all that would have to
 * re-implement every one of them. So an expedition IS a quest — it just never
 * appears on the board.
 *
 * ⚠ THE (REGION, KIND) PAIRS ARE STATIC EVEN THOUGH THE POSITIONS ARE NOT.
 * `world_regions.known_resources` is authored content, so the SET of sites is
 * fixed and these rows can be static. Only the x/y is seed-derived, and
 * `session.questPos` resolves a site quest's position from the site itself
 * rather than from `placePoi` — one source of truth for where a site is.
 *
 * ⚠ IDS LIVE IN A RESERVED 2000 BAND. Generated quests hold 1..109, early
 * quests and commissions 900+, mid-level quests 1000+. The registry throws on
 * a collision, so a clash fails at import rather than silently shadowing a row.
 */

import { world_regions as worldRegions } from '@content/generated/world_regions';
import { RESOURCE_KINDS, resourceTier, type ResourceKind } from '@content/town';
import type { QuestRow } from './earlyQuests';

/** First id in the reserved site-expedition band. */
export const SITE_QUEST_BASE = 2000;

/** Haven is the player's own village, not a site to be taken. Mirrors `sites.ts`. */
const NOT_A_SITE = new Set(['haven']);

const group = (...g: [enemyId: number, count: number][]): string =>
  JSON.stringify(g.map(([enemy_id, count]) => ({ enemy_id, count })));

/**
 * Who is sitting on the site, by how dangerous the region is.
 *
 * ⚠ Every id here is checked against the real enemy table by
 * `tests/campaign/siteQuests.test.ts`. A typo'd enemy id produces an empty
 * garrison and a free site, which would look like generosity rather than a bug.
 */
function garrison(dangerLevel: number): string {
  if (dangerLevel <= 1) return group([1, 3]);                        // goblins
  if (dangerLevel === 2) return group([6, 3], [3, 1]);               // bandits + a wolf
  if (dangerLevel === 3) return group([11, 2], [105, 2]);            // orc warriors + raiders
  if (dangerLevel <= 5) return group([16, 2], [112, 2]);             // ogres + siege-hands
  if (dangerLevel <= 6) return group([17, 1], [114, 2]);             // a troll and tacticians
  return group([117, 1], [118, 1], [112, 2]);                        // vanguard champions
}

/** What the site is called in the field, per resource. */
const SITE_NOUN: Record<ResourceKind, string> = {
  timber: 'Logging Camp',
  grain: 'Granary Farmstead',
  stone: 'Stone Quarry',
  fish: 'Fishing Weir',
  clay: 'Clay Pits',
  iron: 'Iron Mine',
  furs: 'Trapping Lines',
  salt: 'Salt Flats',
  mithril: 'Mithril Seam',
};

const SITE_BLURB: Record<ResourceKind, string> = {
  timber: 'The stand is good and the road is passable. Someone else got here first.',
  grain: 'Fields still standing, nobody bringing the harvest in. Find out why.',
  stone: 'A worked quarry, abandoned in a hurry. The tools are still here.',
  fish: 'The weir is intact. Whatever drove the fishers off has not left.',
  clay: 'Good clay, shallow digging, and squatters who will not be reasoned with.',
  iron: 'An old mine with ore still in the walls, and something living in the dark.',
  furs: 'The trapping lines run for miles. The trappers do not.',
  salt: 'Salt is worth killing for out here, and someone has been.',
  mithril: 'A mithril seam, which is why the thing guarding it is what it is.',
};

export interface SiteQuestLink {
  questId: number;
  regionId: string;
  kind: ResourceKind;
}

function parseKinds(raw: unknown): ResourceKind[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  let parts: unknown;
  try {
    parts = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parts)) return [];
  return parts
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is ResourceKind => (RESOURCE_KINDS as readonly string[]).includes(p));
}

/**
 * Build the rows and the quest↔site mapping together, in one pass, so the two
 * cannot disagree about which quest takes which site.
 */
function build(): { rows: QuestRow[]; links: SiteQuestLink[] } {
  const rows: QuestRow[] = [];
  const links: SiteQuestLink[] = [];
  let i = 0;
  // Sorted by region id so ids are stable regardless of table order — an id
  // that moves between builds would orphan a save's completed-quest ledger.
  const regions = [...worldRegions]
    .filter((r) => !NOT_A_SITE.has(r.id as string))
    .sort((a, b) => (a.id as string).localeCompare(b.id as string));

  for (const region of regions) {
    const regionId = region.id as string;
    const danger = (region.danger_level as number | undefined) ?? 1;
    for (const kind of parseKinds((region as Record<string, unknown>)['known_resources']).sort()) {
      const questId = SITE_QUEST_BASE + i;
      i += 1;
      const tier = resourceTier(kind);
      rows.push({
        id: questId,
        name: `Secure the ${SITE_NOUN[kind]}`,
        description: `${SITE_BLURB[kind]} (${region.name as string})`,
        quest_type: 'combat',
        min_level: danger,
        /**
         * ⚠ GOLD IS DELIBERATELY THIN. The payoff is the SITE — a weekly income
         * forever — so paying a full job's purse on top would make expeditions
         * strictly better than quests and empty the board. XP is normal,
         * because the fight was normal.
         */
        reward_gold: 20 * danger,
        reward_xp: 60 * danger,
        reward_items: '[]',
        // Taking ground the guild then holds is the most visible thing it does.
        reward_reputation: 2 + tier,
        poi_id: null,
        dungeon_level: null,
        enemy_group: garrison(danger),
        prerequisites: '{}',
      });
      links.push({ questId, regionId, kind });
    }
  }
  return { rows, links };
}

const built = build();

export const SITE_QUESTS: readonly QuestRow[] = built.rows;

/** questId → the site it takes. */
export const SITE_QUEST_LINKS: readonly SiteQuestLink[] = built.links;

const byQuestId = new Map<number, SiteQuestLink>(built.links.map((l) => [l.questId, l]));
const bySite = new Map<string, SiteQuestLink>(built.links.map((l) => [`${l.regionId}:${l.kind}`, l]));

/** The site this quest takes, or null when it is an ordinary quest. */
export const siteForQuestId = (questId: number): SiteQuestLink | null =>
  byQuestId.get(questId) ?? null;

/** The expedition that takes this site, or null if there is none. */
export const siteQuestFor = (regionId: string, kind: ResourceKind): SiteQuestLink | null =>
  bySite.get(`${regionId}:${kind}`) ?? null;

export const isSiteQuest = (questId: number): boolean => byQuestId.has(questId);
