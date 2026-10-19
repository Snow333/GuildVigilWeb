/**
 * M3 — THE TOWN GROWS. Resources, building levels, upgrades and the party ladder.
 *
 * ⚠ EVERY TEST HERE DRIVES THE REAL SESSION. The whole point of M3 is that
 * four authored-but-unread things finally reach a consumer:
 *   - `buildings` (18 rows, per-level effect strings) — read only for a label
 *   - `world_regions.known_resources` — read by nothing
 *   - `shop_stock.required_building_level` — behind a hardcoded `continue`
 *   - quest `reward_reputation` — announced in an event and dropped
 * Asserting on the content tables would re-prove they parse. The witness has to
 * be the session's own behaviour.
 */
import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '@sim/campaign/starterParty';
import { RESOURCE_KINDS, EFFECT_COPY, STARTING_BUILDINGS, UPGRADE_RESOURCES } from '@content/town';
import { buildings } from '@content/generated/buildings';
import { shop_stock as shopStockRows } from '@content/generated/shop_stock';
import { items as itemRows } from '@content/generated/items';

const GUILD_HALL = 1;
const BLACKSMITH = 3;
const GENERAL_STORE = 4;
const CHAPEL = 5;
const TAVERN = 6;
const LIBRARY = 7;
const STABLES = 10;
const MARKET = 12;

function session(id = 'town'): CampaignSession {
  return CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });
}

/** A guild with every material it could want, so tests isolate ONE gate. */
function wealthy(id = 'town'): CampaignSession {
  const s = session(id);
  s.devAddGold(200_000);
  s.grantResources(Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 999])));
  s.grantReputation(100);
  return s;
}

describe('the content gate: every building has a price and every effect has words', () => {
  it('every building the table knows has a resource bill for each level above 1', () => {
    // ⚠ Stops a new building row arriving with no price, which would make it
    // free — the silent kind of content bug this project keeps finding.
    const missing: string[] = [];
    for (const row of buildings) {
      const id = row.id as number;
      const maxLevel = (row.max_level as number) ?? 1;
      for (let l = 2; l <= maxLevel; l++) {
        const bill = UPGRADE_RESOURCES[id]?.[l];
        if (!bill || Object.keys(bill).length === 0) missing.push(`${row.name as string} L${l}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every effect string in the table has plain-English copy', () => {
    const missing: string[] = [];
    for (const row of buildings) {
      const effects = JSON.parse((row.effects as string | null) ?? '{}') as Record<string, string>;
      for (const key of Object.values(effects)) {
        if (!EFFECT_COPY[key]) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every resource kind a bill asks for can actually be produced somewhere', () => {
    // ⚠ A bill for a resource with no site on the map is an unpayable price.
    const s = session('kinds');
    const producible = new Set(s.resourceSites().map((site) => site.kind));
    const asked = new Set<string>();
    for (const perLevel of Object.values(UPGRADE_RESOURCES)) {
      for (const bill of Object.values(perLevel)) {
        for (const kind of Object.keys(bill)) asked.add(kind);
      }
    }
    expect([...asked].filter((k) => !producible.has(k as never))).toEqual([]);
  });

  it('no effect is advertised as working unless it is', () => {
    // The UI reads `wired` to grey a row. If this list changes, the playtest
    // note's promises change with it.
    const wired = Object.entries(EFFECT_COPY).filter(([, v]) => v.wired).map(([k]) => k).sort();
    expect(wired).toEqual([
      'armor', 'better_stock', 'consumables', 'masterwork',
      'party_size_4', 'party_size_5', 'party_size_6',
      'rare_items', 'recruit_common', 'recruit_rare', 'recruit_uncommon',
      'scroll_shop', 'sell_price_100pct', 'sell_price_80pct', 'sell_price_90pct',
      'transcription', 'travel_speed_25pct', 'travel_speed_50pct',
      'weapons', 'xp_bonus_10pct', 'xp_bonus_5pct',
    ]);
  });
});

describe('what an upgrade UNLOCKS matches what the copy promises', () => {
  /**
   * ⚠ THE DEFECT THIS CATCHES ACTUALLY SHIPPED. `EFFECT_COPY` was first
   * written by paraphrasing the effect STRINGS, which produced four promises
   * the shop rows do not keep — "the smith sells armour too" at level 2, when
   * Chain Mail is on sale at level 1; "masterwork gear" for a single
   * Longsword +1; "rare items" for two healing potions; and the Market's
   * sell-price copy hiding that the Market is itself a shop.
   *
   * Pinning the newly-unlocked rows per level means a content change fails
   * here and forces the copy to be re-read, rather than letting the promise
   * quietly go stale. It is a cross-check, not a tautology: the expectation is
   * written from the ITEMS, and the copy it guards lives in a different file.
   */
  const unlockedAt = (buildingId: number, level: number): { count: number; types: string[] } => {
    const rows = shopStockRows.filter(
      (r) => (r.building_id as number) === buildingId
        && (r.required_building_level as number) === level,
    );
    const byId = new Map(itemRows.map((i) => [i.id as number, i]));
    const types = [...new Set(rows.map((r) => {
      const item = byId.get(r.item_id as number);
      return (item?.item_type as string | undefined) ?? 'unknown';
    }))].sort();
    return { count: rows.length, types };
  };

  it('the Blacksmith already sells armour at level 1 — level 2 is weapons and shields', () => {
    expect(unlockedAt(BLACKSMITH, 1)).toEqual({ count: 22, types: ['armor', 'shield', 'weapon'] });
    expect(unlockedAt(BLACKSMITH, 2)).toEqual({ count: 6, types: ['shield', 'weapon'] });
  });

  it('the Blacksmith level 3 is ONE magic weapon, not a masterwork range', () => {
    expect(unlockedAt(BLACKSMITH, 3)).toEqual({ count: 1, types: ['weapon'] });
  });

  it('the General Store level 3 is two healing potions, not a rare-item range', () => {
    expect(unlockedAt(GENERAL_STORE, 3)).toEqual({ count: 2, types: ['consumable'] });
  });

  it('the Market is a SHOP as well as a sell-price bonus', () => {
    // Its effect strings only mention the sell price, so without this the UI
    // would never tell the player the Market stocks anything.
    const total = [1, 2, 3].reduce((n, l) => n + unlockedAt(MARKET, l).count, 0);
    expect(total).toBe(18);
    expect(unlockedAt(MARKET, 1).types).toContain('wondrous');
  });

  it('every level a shop building has an effect for also unlocks stock', () => {
    // ⚠ An effect that claims an unlock at a level with no new rows is a lie
    // the player pays for.
    for (const row of buildings) {
      const id = row.id as number;
      const effects = JSON.parse((row.effects as string | null) ?? '{}') as Record<string, string>;
      const sells = shopStockRows.some((r) => (r.building_id as number) === id);
      if (!sells) continue;
      for (const [key, effect] of Object.entries(effects)) {
        const level = Number(key.replace('level_', ''));
        const copy = EFFECT_COPY[effect];
        // Only shop-flavoured promises must be backed by rows; the Market's
        // sell-price effects earn their keep elsewhere.
        if (!copy?.wired || effect.startsWith('sell_price')) continue;
        expect(unlockedAt(id, level).count, `${row.name as string} L${level} (${effect}) promises stock but unlocks none`)
          .toBeGreaterThan(0);
      }
    }
  });
});

describe('the shop was not broken by giving it real building levels', () => {
  it('a brand-new guild can still buy things in week one', () => {
    // ⚠ THE REGRESSION TEST FOR THIS WHOLE MILESTONE. The gate used to be
    // "level 1 or nothing", so every level-1 row was on sale. With real levels
    // a town starting at 0 everywhere had an EMPTY shop — measured, 0 offers.
    expect(session('shop1').shopStock().length).toBeGreaterThan(0);
  });

  it('the starting buildings are the ones that own week-one stock', () => {
    const s = session('shop2');
    const selling = new Set(s.shopStock().map((o) => o.buildingId));
    for (const id of selling) expect(STARTING_BUILDINGS[id]).toBeGreaterThan(0);
  });

  it('upgrading a shop widens its shelf — the player SEES what they paid for', () => {
    // Measured first: with a flat 6-slot rotation the offer count did not move
    // at all when the Blacksmith upgraded, so the purchase was invisible.
    const s = wealthy('shop3');
    const smithOffers = (): number => s.shopStock().filter((o) => o.buildingId === BLACKSMITH).length;
    const l1 = smithOffers();
    s.upgradeBuilding(BLACKSMITH);
    const l2 = smithOffers();
    s.upgradeBuilding(BLACKSMITH);
    expect(l2).toBeGreaterThan(l1);
    expect(smithOffers()).toBeGreaterThan(l2);
  });

  it('a building the guild has not built sells nothing', () => {
    const s = session('shop4');
    expect(s.shopStock().some((o) => o.buildingId === MARKET)).toBe(false);
  });
});

describe('the guild-hall ladder', () => {
  it('reads the EFFECT, not the level number', () => {
    const s = wealthy('ladder');
    expect(s.maxPartySize()).toBe(4);
    s.upgradeBuilding(GUILD_HALL);
    expect(s.maxPartySize()).toBe(5);
    s.upgradeBuilding(GUILD_HALL);
    expect(s.maxPartySize()).toBe(6);
  });

  it('a hero can actually be hired into the new slot, and go on a mission', () => {
    // ⚠ Without this the ladder is decoration. The roster was FIXED at session
    // construction with no way to gain a fifth hero, so `party_size_5` would
    // have been a number nothing could use.
    const s = wealthy('hire');
    s.upgradeBuilding(TAVERN);
    s.upgradeBuilding(GUILD_HALL);
    expect(s.rosterSize()).toBe(4);
    s.recruitHero(1, 'Newcomer');
    expect(s.rosterSize()).toBe(5);

    s.advanceWeek();
    const board = s.board();
    expect(board.length).toBeGreaterThan(0);
    s.acceptQuest(board[0]!.questId);
    const result = s.launchDispatch();
    expect(['completed', 'failed', 'wiped', 'retreated']).toContain(result.outcome);
  });

  it('the guild hall is the cap — hiring past it is refused', () => {
    const s = wealthy('cap');
    s.upgradeBuilding(TAVERN);
    expect(s.maxPartySize()).toBe(4);
    expect(s.rosterSize()).toBe(4);
    expect(() => s.recruitHero(1)).toThrow(/guild hall holds 4/);
  });

  it('no tavern, no recruits — there is nowhere in town to meet them', () => {
    const s = wealthy('tavern0');
    expect(s.recruitPool()).toEqual([]);
    expect(() => s.recruitHero(1)).toThrow(/does not reach that tier/);
  });

  it('the tavern gates recruit QUALITY, by effect string', () => {
    const s = wealthy('tavern');
    s.upgradeBuilding(TAVERN);
    const tiers1 = new Set(s.recruitPool().map((o) => o.tier));
    expect([...tiers1]).toEqual(['common']);
    s.upgradeBuilding(TAVERN);
    expect(new Set(s.recruitPool().map((o) => o.tier))).toEqual(new Set(['common', 'uncommon']));
    s.upgradeBuilding(TAVERN);
    expect(new Set(s.recruitPool().map((o) => o.tier))).toEqual(new Set(['common', 'uncommon', 'rare']));
  });

  it('every recruitable class can really be built', () => {
    // ⚠ Three classes (Arcane Trickster, Eldritch Knight, Mystic Theurge) have
    // no founding template, and offering one would throw inside musterHero.
    const s = wealthy('allclasses');
    s.upgradeBuilding(TAVERN); s.upgradeBuilding(TAVERN); s.upgradeBuilding(TAVERN);
    s.upgradeBuilding(GUILD_HALL); s.upgradeBuilding(GUILD_HALL);
    for (const offer of s.recruitPool()) {
      const probe = wealthy(`c${offer.classId}`);
      probe.upgradeBuilding(TAVERN); probe.upgradeBuilding(TAVERN); probe.upgradeBuilding(TAVERN);
      probe.upgradeBuilding(GUILD_HALL);
      expect(() => probe.recruitHero(offer.classId)).not.toThrow();
    }
  });
});

describe('upgrades are gated on everything the table authored', () => {
  it('gold alone is not enough — resources gate too', () => {
    const s = session('gate1');
    s.devAddGold(200_000);
    s.grantReputation(100);
    const blockers = s.town().find((b) => b.id === GUILD_HALL)!.blocked;
    expect(blockers.map((b) => b.kind)).toContain('resources');
    expect(() => s.upgradeBuilding(GUILD_HALL)).toThrow();
  });

  it('reputation gates the civic buildings, and is EARNED from quests', () => {
    // ⚠ `reward_reputation` was emitted into an event and never stored, so
    // `reputation_required` had nothing to check. This is that wiring.
    const s = session('rep');
    s.devAddGold(200_000);
    s.grantResources(Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 999])));
    expect(s.reputationTotal()).toBe(0);
    expect(s.town().find((b) => b.id === CHAPEL)!.blocked.map((b) => b.kind)).toContain('reputation');

    let guard = 0;
    while (s.reputationTotal() === 0 && guard++ < 40) {
      s.advanceWeek();
      const board = s.board();
      if (board.length === 0) continue;
      s.acceptQuest(board[0]!.questId);
      s.launchDispatch();
    }
    expect(s.reputationTotal()).toBeGreaterThan(0);
  });

  it('a prerequisite building must be standing first', () => {
    const s = wealthy('prereq');
    // Market requires a General Store, which IS a starting building, so pick a
    // building whose prerequisite is not standing to prove the gate bites.
    const needsPrereq = s.town().find((b) => b.blocked.some((x) => x.kind === 'prerequisite'));
    expect(needsPrereq, 'some building should be prerequisite-blocked at the start').toBeDefined();
    expect(() => s.upgradeBuilding(needsPrereq!.id)).toThrow(/first/);
  });

  it('paying for an upgrade actually spends the gold and the resources', () => {
    const s = wealthy('spend');
    const before = { gold: s.goldAmount(), timber: s.resourceStock().timber };
    const cost = s.town().find((b) => b.id === GENERAL_STORE)!.next!.cost;
    s.upgradeBuilding(GENERAL_STORE);
    expect(s.goldAmount()).toBe(before.gold - cost.gold);
    expect(s.resourceStock().timber).toBe(before.timber - (cost.resources.timber ?? 0));
  });

  it('a fully built building offers nothing more', () => {
    const s = wealthy('maxed');
    s.upgradeBuilding(GUILD_HALL);
    s.upgradeBuilding(GUILD_HALL);
    const hall = s.town().find((b) => b.id === GUILD_HALL)!;
    expect(hall.level).toBe(hall.maxLevel);
    expect(hall.next).toBeNull();
    expect(() => s.upgradeBuilding(GUILD_HALL)).toThrow(/Fully built/);
  });
});

describe('resource sites', () => {
  it('derive from what the regions say they produce', () => {
    const sites = session('sites').resourceSites();
    expect(sites.length).toBeGreaterThan(0);
    for (const site of sites) {
      expect(RESOURCE_KINDS).toContain(site.kind);
      expect(site.yield).toBeGreaterThan(0);
    }
  });

  it('Haven itself is not a site — you do not raid your own village', () => {
    expect(session('sites2').resourceSites().some((s) => s.regionId === 'haven')).toBe(false);
  });

  it('no two sites share a tile, and none is pinned to the map edge — ACROSS SEEDS', () => {
    /**
     * ⚠ Measured bug: the quest-POI radius (8 + level*5) overshoots an 80x60
     * map at danger level 7, every candidate clamped to the border, and two
     * sites landed on the IDENTICAL tile.
     *
     * ⚠ SWEEPS 40 SEEDS, AND THAT IS NOT BELT-AND-BRACES. A single-seed
     * version of this test PASSED with the de-duplication guard deleted — the
     * one world it looked at happened not to collide. Measured over seeds,
     * removing the guard collides in 9 of 60. One seed cannot see a bug that
     * only 15% of worlds have.
     */
    for (let i = 0; i < 40; i++) {
      const sites = session(`sweep${i}`).resourceSites();
      const tiles = sites.map((s) => `${s.pos.x},${s.pos.y}`);
      expect(new Set(tiles).size, `seed sweep${i} put two sites on one tile`).toBe(tiles.length);
      for (const s of sites) {
        expect(s.pos.x, `seed sweep${i} pinned ${s.kind} to the west edge`).toBeGreaterThan(1);
        expect(s.pos.y, `seed sweep${i} pinned ${s.kind} to the north edge`).toBeGreaterThan(1);
      }
    }
  });

  it('placement is stable for a seed and differs between seeds', () => {
    const a = session('stable').resourceSites().map((s) => `${s.pos.x},${s.pos.y}`);
    const b = session('stable').resourceSites().map((s) => `${s.pos.x},${s.pos.y}`);
    const c = session('other-seed').resourceSites().map((s) => `${s.pos.x},${s.pos.y}`);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('cheap sites come first, so the list reads as a to-do', () => {
    const levels = session('order').resourceSites().map((s) => s.level);
    expect([...levels].sort((x, y) => x - y)).toEqual(levels);
  });

  it('a secured site pays every week', () => {
    const s = session('income');
    const site = s.resourceSites()[0]!;
    expect(s.weeklyIncome()[site.kind]).toBe(0);
    s.secureSite(site.regionId, site.kind);
    expect(s.weeklyIncome()[site.kind]).toBe(site.yield);

    const before = s.resourceStock()[site.kind];
    s.advanceWeek();
    expect(s.resourceStock()[site.kind]).toBe(before + site.yield);
    s.advanceWeek();
    expect(s.resourceStock()[site.kind]).toBe(before + site.yield * 2);
  });

  it('securing twice does not double the income', () => {
    const s = session('double');
    const site = s.resourceSites()[0]!;
    s.secureSite(site.regionId, site.kind);
    s.secureSite(site.regionId, site.kind);
    expect(s.weeklyIncome()[site.kind]).toBe(site.yield);
    expect(s.securedSites().length).toBe(1);
  });

  it('an unsecured world pays nothing at all', () => {
    // The negative control for the income loop.
    const s = session('nopay');
    const before = JSON.stringify(s.resourceStock());
    s.advanceWeek();
    s.advanceWeek();
    expect(JSON.stringify(s.resourceStock())).toBe(before);
  });
});

describe('the other wired effects', () => {
  it('the Market raises what loot sells for', () => {
    const s = wealthy('market');
    expect(s.sellFraction()).toBe(0.5);
    s.upgradeBuilding(MARKET);
    expect(s.sellFraction()).toBe(0.8);
  });

  it('the Library speeds up learning', () => {
    const s = wealthy('library');
    expect(s.xpMultiplier()).toBe(1);
    s.upgradeBuilding(LIBRARY);
    expect(s.xpMultiplier()).toBeGreaterThan(1);
  });

  it('the Stables cut travel time', () => {
    const s = wealthy('stables');
    expect(s.travelMultiplier()).toBe(1);
    s.upgradeBuilding(STABLES);
    expect(s.travelMultiplier()).toBeLessThan(1);
  });
});

describe('persistence', () => {
  it('the whole town survives a save and load', () => {
    const s = wealthy('save');
    s.upgradeBuilding(TAVERN);
    s.upgradeBuilding(GUILD_HALL);
    s.recruitHero(1, 'Saved');
    const site = s.resourceSites()[0]!;
    s.secureSite(site.regionId, site.kind);

    const back = CampaignSession.deserialize(s.serialize());
    expect(back.buildingLevel(GUILD_HALL)).toBe(s.buildingLevel(GUILD_HALL));
    expect(back.buildingLevel(TAVERN)).toBe(s.buildingLevel(TAVERN));
    expect(back.maxPartySize()).toBe(s.maxPartySize());
    expect(back.rosterSize()).toBe(s.rosterSize());
    expect(back.reputationTotal()).toBe(s.reputationTotal());
    expect(back.resourceStock()).toEqual(s.resourceStock());
    expect(back.securedSites()).toEqual(s.securedSites());
  });

  it('a pre-M3 save loads with the party size it was played with', () => {
    // ⚠ Granting Guild Hall level 0 would shrink a loaded party below four and
    // break a save that worked. Level 1 PRESERVES behaviour; it is not a gift.
    const s = wealthy('legacy');
    const saved = JSON.parse(JSON.stringify(s.serialize())) as Record<string, unknown>;
    delete saved['buildingLevels'];
    delete saved['resources'];
    delete saved['reputation'];
    delete saved['sites'];

    const back = CampaignSession.deserialize(saved as never);
    expect(back.buildingLevel(GUILD_HALL)).toBe(1);
    expect(back.maxPartySize()).toBe(4);
    expect(back.reputationTotal()).toBe(0);
    expect(back.securedSites()).toEqual([]);
    expect(back.shopStock().length).toBeGreaterThan(0);
  });

  it('a hand-mangled save is repaired, not fatal', () => {
    const s = wealthy('mangled');
    const saved = JSON.parse(JSON.stringify(s.serialize())) as Record<string, unknown>;
    saved['buildingLevels'] = [['nope', 2], [GUILD_HALL, 2], [3, -1]];
    saved['resources'] = 'not an array';
    saved['reputation'] = 'lots';
    saved['sites'] = [{ regionId: 'region_haven' }, 7];

    const back = CampaignSession.deserialize(saved as never);
    expect(back.buildingLevel(GUILD_HALL)).toBe(2);
    expect(back.reputationTotal()).toBe(0);
    expect(back.securedSites()).toEqual([]);
    expect(back.maxPartySize()).toBe(5);
  });
});
