/**
 * THE TOWN ECONOMY (M3) — resources, reputation, and what an upgrade costs.
 *
 * Hand-authored content beside the generated tables, same pattern as
 * `earlyQuests.ts` and `midQuests.ts`. It lives here rather than in the db
 * because `buildings` has no resource-cost column and adding one to a tracked
 * binary is a merge hazard; the gate in `tests/campaign/town.test.ts` asserts
 * every building the generated table knows about has a bill here, so a new
 * building row cannot silently arrive without a price.
 *
 * ── WHAT WAS ALREADY AUTHORED AND UNUSED ───────────────────────────────────
 *
 * Measured before designing any of this:
 *  - `buildings` holds 18 rows with `max_level`, `base_cost`,
 *    `cost_multiplier`, `prerequisite_building_id/level`,
 *    `reputation_required` and a per-level `effects` string. NOTHING read any
 *    of it — the single consumer in the codebase used `shop_display_name` for
 *    a label.
 *  - `world_regions.known_resources` names what each region produces
 *    (timber, iron, stone, grain, furs, fish, clay, salt, mithril). No consumer.
 *  - `shop_stock` has 105 rows, of which **45 require building level 2 or 3**
 *    and were unreachable behind a hardcoded `continue`.
 *  - Quest completion awards `rep` into an event payload and **nothing stores
 *    it**, so `reputation_required` had nothing to check against.
 *
 * M3 gives all four a consumer.
 */

/**
 * The nine resource kinds, taken from what the regions actually say they
 * produce. ⚠ Not invented: every kind here appears in some region's
 * `known_resources`, and `tests/campaign/town.test.ts` asserts that, so a
 * resource with no home on the map cannot be added by accident.
 */
export const RESOURCE_KINDS = [
  'timber', 'iron', 'stone', 'grain', 'furs', 'fish', 'clay', 'salt', 'mithril',
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export type ResourceStock = Record<ResourceKind, number>;

/**
 * What a new guild already has standing.
 *
 * ⚠ THIS SET IS LOAD-BEARING FOR THE SHOP, NOT FLAVOUR. `shop_stock` gates
 * each row on `required_building_level`, and before M3 that gate was a
 * hardcoded "level 1 or nothing", so all 60 level-1 rows were on sale from
 * week one. With real building levels, a town starting at level 0 everywhere
 * has an EMPTY shop — measured, 0 offers — which is a straight regression.
 *
 * So the three buildings Haven's own description implies are standing:
 *  - Guild Hall: its `level_1` effect IS `party_size_4`, the size every
 *    pre-M3 save played with. Level 0 would shrink the party to nothing.
 *  - General Store and Blacksmith: "farmers, trappers, prospectors" have a
 *    store and a smith. 31 shop rows stay available from week one.
 *
 * The Chapel, Wizard Guild and Market are deliberately NOT here. They are
 * institutions the town grows into, and their 74 rows — every scroll in the
 * game among them — are now something the player earns. That is the milestone,
 * and it is a real nerf to the week-one shop (60 rows → 31); it is called out
 * in the playtest note so it can be reversed if it feels mean.
 */
export const STARTING_BUILDINGS: Readonly<Record<number, number>> = {
  1: 1, // Guild Hall  — party_size_4
  4: 1, // General Store
  3: 1, // Blacksmith
};

export const emptyStock = (): ResourceStock =>
  Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 0])) as ResourceStock;

/** How common a kind is, which sets how much a site pays and what things cost. */
const TIER: Record<ResourceKind, 1 | 2 | 3> = {
  // Tier 1 — the region next door produces it; every early upgrade wants it.
  timber: 1, grain: 1, stone: 1, fish: 1, clay: 1,
  // Tier 2 — the contested regions.
  iron: 2, furs: 2, salt: 2,
  // Tier 3 — the deep frontier only.
  mithril: 3,
};

/** Units a secured site pays per week, by how rare its resource is. */
export const SITE_YIELD: Record<1 | 2 | 3, number> = { 1: 6, 2: 3, 3: 1 };

export const resourceTier = (kind: ResourceKind): 1 | 2 | 3 => TIER[kind];

/**
 * The resource bill for taking a building to a given level.
 *
 * ⚠ GOLD IS NOT HERE. Gold comes from the generated table
 * (`base_cost * cost_multiplier^(level-1)`), because that is authored data and
 * retyping it would be the mistake `build-class-chart.mjs` exists to prevent.
 * This table is only the resource half, which the db has no column for.
 *
 * Shape: `[buildingId]: { [level]: Partial<ResourceStock> }`. A level with no
 * entry costs no resources — true of the cheap early tiers on purpose, so the
 * first upgrade a player makes is never gated behind a site they have not
 * secured yet.
 */
export const UPGRADE_RESOURCES: Readonly<Record<number, Readonly<Record<number, Partial<ResourceStock>>>>> = {
  // 1 Guild Hall — the party-size ladder. The headline upgrade, priced to be
  // the thing a player saves for rather than stumbles into.
  1: { 2: { timber: 20, stone: 12 }, 3: { timber: 40, stone: 30, iron: 15 } },
  // 2 Barracks — hero cap.
  2: { 2: { timber: 15, stone: 8 }, 3: { timber: 30, stone: 20, iron: 10 } },
  // 3 Blacksmith — weapons, then armour, then masterwork stock.
  3: { 2: { iron: 12, stone: 6 }, 3: { iron: 30, stone: 15, mithril: 2 } },
  // 4 General Store — consumables, better stock, rare items.
  4: { 2: { timber: 8, grain: 10 }, 3: { timber: 18, grain: 20, salt: 8 } },
  // 5 Chapel — resting heals more.
  5: { 2: { stone: 18, clay: 10 } },
  // 6 Tavern — recruit quality.
  6: { 2: { timber: 10, grain: 12 }, 3: { timber: 22, grain: 25, furs: 8 } },
  // 7 Library / 8 Wizard Guild / 14 Archive / 17 Arcane Tower — the book trades.
  7: { 2: { timber: 12, clay: 8 }, 3: { timber: 25, clay: 18, salt: 6 } },
  8: { 2: { stone: 15, iron: 8 }, 3: { stone: 30, iron: 18, mithril: 3 } },
  14: { 2: { clay: 14, timber: 10 }, 3: { clay: 28, timber: 22, salt: 10 } },
  17: { 2: { stone: 25, mithril: 4 }, 3: { stone: 50, mithril: 10, iron: 20 } },
  // 9 Training Grounds / 11 Watchtower / 10 Stables — the martial yard.
  9: { 2: { timber: 14, stone: 10 }, 3: { timber: 28, stone: 22, iron: 12 } },
  10: { 2: { timber: 12, grain: 14 }, 3: { timber: 24, grain: 28, furs: 10 } },
  11: { 2: { stone: 20, timber: 10 }, 3: { stone: 40, timber: 20, iron: 14 } },
  // 12 Market / 13 Infirmary — the civic pair.
  12: { 2: { timber: 16, clay: 12 }, 3: { timber: 32, clay: 24, salt: 12 } },
  13: { 2: { clay: 12, grain: 10 }, 3: { clay: 24, grain: 20, fish: 12 } },
  // 15 Enchanter / 16 Mythril Forge — the late trades, mithril-hungry.
  15: { 2: { clay: 16, mithril: 3 }, 3: { clay: 30, mithril: 8, iron: 15 } },
  16: { 2: { iron: 25, mithril: 5 }, 3: { iron: 50, mithril: 15, stone: 30 } },
  // 18 Monument — pure prestige, pure stone.
  18: { 2: { stone: 35, clay: 15 }, 3: { stone: 70, clay: 30, mithril: 6 } },
};

/**
 * RECRUIT TIERS — which classes turn up, and what hiring one costs.
 *
 * ⚠ THE TAVERN IS WHY THE GUILD-HALL LADDER IS NOT DECORATION. Measured before
 * building any of this: the session's roster is fixed at construction and there
 * was NO way to gain a fifth hero, so `party_size_5` would have been a number
 * nothing could ever use. Recruiting is the other half of the ladder.
 *
 * Tiers are gated on the Tavern's own authored effects — `recruit_common`,
 * `recruit_uncommon`, `recruit_rare` — so the gate is content, not a level
 * number hardcoded here. A guild with no Tavern recruits nobody: there is
 * nowhere in town to meet them.
 *
 * Only classes with a founding template appear. The other three (Arcane
 * Trickster, Eldritch Knight, Mystic Theurge) are multiclass prestige shells
 * with no template, and offering them would crash `musterHero`.
 */
export const RECRUIT_TIERS: Readonly<Record<'common' | 'uncommon' | 'rare', readonly number[]>> = {
  // The classic wedge — the classes the starting party is drawn from.
  common: [1, 4, 3, 2],
  // Trained specialists.
  uncommon: [5, 8, 6, 7],
  // The strange ones, who do not drift into frontier villages by accident.
  rare: [9, 13],
};

/** Hiring fee by tier. Authored here because no column exists for it. */
export const RECRUIT_COST: Readonly<Record<'common' | 'uncommon' | 'rare', number>> = {
  common: 150, uncommon: 300, rare: 600,
};

export type RecruitTier = keyof typeof RECRUIT_TIERS;

/**
 * What a building level GIVES, in words a player would use.
 *
 * ⚠ THE KEYS ARE THE GENERATED `effects` STRINGS, VERBATIM. The db says
 * `rest_heal_50pct`; the player must read "resting heals half your wounds".
 * Keeping the mapping keyed on the raw string means a new effect string with
 * no plain-English entry fails the gate instead of leaking jargon into the UI.
 *
 * ⚠ `wired: false` means THE EFFECT STRING HAS NO CONSUMER YET. The UI must
 * say so rather than promise it — never ship a claim the engine does not keep.
 * M3 wires party size and the shop stock gates; the rest are honest future work.
 */
export interface EffectCopy {
  /** Plain-language payoff, shown to the player. */
  text: string;
  /** Does the engine actually do this today? */
  wired: boolean;
}

export const EFFECT_COPY: Readonly<Record<string, EffectCopy>> = {
  // ── WIRED IN M3 ──────────────────────────────────────────────────────────
  // The guild-hall ladder: the headline upgrade.
  party_size_4: { text: 'Send 4 heroes on a mission', wired: true },
  party_size_5: { text: 'Send 5 heroes on a mission', wired: true },
  party_size_6: { text: 'Send 6 heroes on a mission', wired: true },
  // Shop stock gates — 45 of 105 shop rows were unreachable before M3.
  weapons: { text: 'The smith sells weapons', wired: true },
  armor: { text: 'The smith sells armour too', wired: true },
  masterwork: { text: 'The smith sells masterwork gear', wired: true },
  consumables: { text: 'The store sells potions and kit', wired: true },
  better_stock: { text: 'The store keeps better stock', wired: true },
  rare_items: { text: 'The store gets rare items in', wired: true },
  scroll_shop: { text: 'The wizards sell scrolls', wired: true },
  transcription: { text: 'The wizards sell better scrolls', wired: true },
  // Market: SHOP.sellFraction was a fixed 0.5, so this is a real lever.
  sell_price_80pct: { text: 'Sell your loot for 80% of its worth', wired: true },
  sell_price_90pct: { text: 'Sell your loot for 90% of its worth', wired: true },
  sell_price_100pct: { text: 'Sell your loot for its full worth', wired: true },
  // Library: a flat multiplier on quest XP.
  xp_bonus_5pct: { text: 'Heroes learn 5% faster', wired: true },
  xp_bonus_10pct: { text: 'Heroes learn 10% faster', wired: true },
  // Stables: cuts travel time to a mission.
  travel_speed_25pct: { text: 'Travel to missions 25% faster', wired: true },
  travel_speed_50pct: { text: 'Travel to missions 50% faster', wired: true },

  // ── AUTHORED, NOT YET WIRED ──────────────────────────────────────────────
  // ⚠ The UI greys these and says "not working yet". Never promise an effect
  // the engine does not keep — that is this repo's oldest defect, and an
  // upgrade the player PAID for would be the worst place to do it.
  hero_cap_6: { text: 'Keep up to 6 heroes in the guild', wired: false },
  hero_cap_10: { text: 'Keep up to 10 heroes in the guild', wired: false },
  hero_cap_15: { text: 'Keep up to 15 heroes in the guild', wired: false },
  rest_heal_50pct: { text: 'Resting heals half your wounds', wired: false },
  rest_heal_full: { text: 'Resting heals you completely', wired: false },
  recruit_common: { text: 'Fighters, rogues, clerics and wizards look for work here', wired: true },
  recruit_uncommon: { text: 'Rangers, bards, barbarians and monks turn up too', wired: true },
  recruit_rare: { text: 'Sorcerers and warlocks drift in', wired: true },
  map_reveal_small: { text: 'See a little more of the map', wired: false },
  map_reveal_large: { text: 'See much more of the map', wired: false },
  remove_conditions: { text: 'The infirmary clears lingering ailments', wired: false },
  revive_dead: { text: 'The infirmary can bring back the dead', wired: false },
  train_level_5: { text: 'Train heroes up to level 5', wired: false },
  train_level_10: { text: 'Train heroes up to level 10', wired: false },
  train_level_15: { text: 'Train heroes up to level 15', wired: false },
  quest_hints: { text: 'The archive hints at what a job involves', wired: false },
  lore_unlock: { text: 'The archive opens up older records', wired: false },
  spell_research: { text: 'Research new spells', wired: false },
  custom_spells: { text: 'Commission custom spells', wired: false },
  enchant_basic: { text: 'Enchant gear, simply', wired: false },
  enchant_mid: { text: 'Enchant gear well', wired: false },
  enchant_high: { text: 'Enchant gear superbly', wired: false },
  craft_mythril: { text: 'Forge mithril gear', wired: false },
  craft_legendary: { text: 'Forge legendary gear', wired: false },
  reputation_aura: { text: 'The monument raises the guild\'s standing', wired: false },
};

