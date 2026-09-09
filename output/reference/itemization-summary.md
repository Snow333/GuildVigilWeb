# Guild Vigil — itemization: high-level summary

**Date:** 2026-09-09. Sources: the live registries in `src/content/generated/` (`items` 183,
`item_properties` 33, `loot_tables` 97 rows / 12 tables, `shop_stock` 105 rows) plus the design
intent mined from the frozen Godot repo (`migration_item_quality.sql`,
`migration_equipment_slots.sql`, `PROMPT_LOOT_PHASE_4_SHOP.md`, `.claude/memory/prototype_economy.md`).

Companion documents: `output/reference/pf2e-character-systems.md` (§8–15 = the PF2E item rules),
`output/reference/class-progression-sheets.md`, `output/briefs/character-workstream.md`.

---

## 1. The one-paragraph version

Itemization is **four systems stacked**: a slot model that forces trade-offs, a five-tier quality
taxonomy, a 33-entry named-property vocabulary, and a loot/shop economy that decides who gets
access to what. Three of the four are authored and derive correctly in code today. The fourth —
acquisition — is where everything is stuck: **the shop skips half its own stock**, the tier ladder
is a flat placeholder that ignores the `item_level` column on all 183 rows, and 12 of the 33
properties are attached to no item at all.

---

## 2. The slot model — designed for opportunity cost

The Godot migration defined **15 columns per hero**: 11 gear + 4 consumable quick-slots.

```sql
equip_main_hand · equip_off_hand · equip_main_hand_2 · equip_off_hand_2 · active_weapon_set
equip_armor · equip_head · equip_accessory1 · equip_accessory2 · equip_ring1 · equip_ring2 · equip_boots
equip_quick_1..4
```

Three deliberate design decisions are encoded here, and they are the reason the ledger locked
**11 + 4 + 2** in D3:

| Decision | Why |
|---|---|
| **Neck and belt collapsed into two generic `accessory` slots** | You *drop* something to gain something. Two amulets and a belt compete for two slots instead of each having a guaranteed home. |
| **Two full weapon sets with an action-cost swap** | Melee/ranged is a commitment made before the fight, not a free toggle. |
| **Four quick-slots restricted to `consumable` and `scroll`** | The pre-expedition pouch loadout becomes a real planning decision — this is what makes 12 consumables and 52 scrolls matter. |

**Status in the TS rewrite:** partial. We have **7 slot values in data** (`main_hand` 62 ·
`armor` 28 · `accessory` 16 · `off_hand` 4 · `head` 3 · `boots` 2 · `ring` 1) and `session.equip()`
enforces one item per slot value. There are **no weapon sets and no quick-slots in the sim at all**.

⚠ **The single sharpest content gap: one ring exists, for two ring slots.**

---

## 3. Quality tiers — a taxonomy, not a ladder

The five tiers classify *what kind of decision an item represents*. The Godot SQL argues this
explicitly: potions are mundane because "quality_tier doesn't govern potion power"; scrolls because
"spell level governs power, not item tier"; silver arrows because "silver arrows are material, not
enchantment."

| Tier | Rows | What it means | Price mult (live code) |
|---|---|---|---|
| **mundane** | 96 | baseline | ×1 |
| **masterwork** | 24 | exceptional craft, *not* magical — buys off the armour check penalty | ×4 |
| **magical** | 41 | clean numeric bonuses, nothing exotic | ×16 |
| **enchanted** | 15 | numbers **plus** named properties | ×48 |
| **legendary** | 7 | named, unique, never sold, never rolled | ×1 (authored) |

**Properties are what separate `magical` from `enchanted`** — that is the load-bearing rule of the
whole tier system.

The Godot price curve was super-linear and stated in the SQL headers: masterwork ×3, potency +2
≈ ×8, +2 with striking ≈ ×12, potency +3 ≈ ×20. Accessories charge **4× the price for 2× the
effect** (+2 stat ≈ 400g at ilvl 5; +4 stat ≈ 1600g at ilvl 10).

⚠ One deliberate inversion worth preserving: **Bulwark Full Plate** (enchanted, +3, two properties)
costs 2,000g while **Full Plate +3** (magical, pure numbers) costs 4,500g. Properties are priced
*below* equivalent raw numbers — a nudge toward texture over stats.

### The live tier grants are a placeholder

`TIER_GRANTS` in `heroes/equipment.ts` is flat and level-blind:

| Tier | potency | striking |
|---|---|---|
| mundane | 0 | 0 |
| masterwork | 1 | 0 |
| magical | 1 | 0 |
| enchanted | 2 | 0 |
| legendary | 4 | 1 |

Against PF2E's actual schedule — potency +1/+2/+3 at item level **2/10/16**, striking/greater/major
at **4/12/19** — this is a stub. And **`item_level` is populated on all 183 rows and read by
nothing.** Distribution: ilvl 1 (47), 2 (23), 3 (18), 4 (13), 5 (21), 6 (7), 7 (12), 8 (11),
9 (9), 10 (12), 11 (1), 12 (2), then **a hard gap at 13–14**, 15 (4), 16 (3).

Also note **`striking_tier: 2` is used by zero items** — half the designed damage axis was specced
and never populated. Potency spread: 0 (125) · +1 (21) · +2 (21) · +3 (13) · +4 (3).

---

## 4. The 33 named properties

Four categories. The vocabulary is genuinely good and mostly ahead of the content.

**Weapon (13)** — five elemental runes share a template (**1d6 on every hit**, a distinct debuff on
crit): flaming (crit persistent fire 1d10/3r) · frost (crit slowed 1) · shock (crit stunned 1) ·
corrosive (crit −2 AC/3r) · thundering (crit deafened 3r). Then the filtered pair — disrupting
(1d6 positive **vs undead only**, crit fleeing) and holy/unholy (1d6 vs evil-or-undead / good, crit
doubles instead of debuffing). Then wounding (persistent bleed 1d6, no upfront burst) and four
passives: **keen** (crit range 19–20), **ghost_touch** (bypass incorporeal — an answer-key
property), **returning** (gated on the `thrown` trait), **shifting** (reshape, 1 action).

**Armour (9)** — all passive, all defensive. **shadow** (+2 Stealth) · **fortification** (25% chance
to downgrade a crit — the only anti-variance property in the game) · **slick** (+4 escape) ·
**ethereal** (phase through terrain, 1/rest, full combat — the most build-defining) · and a flat
**resistance 5** suite for fire/cold/shock/acid/sonic, designed for swapping against known dungeon
themes.

**Utility (6)** — all `wondrous`, all out-of-combat, and this is the category that makes gear pay
off in the *guild-management* layer: pathfinding (ignore difficult terrain + 10 world-map speed) ·
trapfinding (+4 dungeon traps) · shadowstep (+4 ambush resist, +15 encounter avoidance) · truesight
(reveal hidden rooms and POIs) · lockbreaker (+4 locks) · everlight (+2 fog of war).

**guild_vigil (5) — the setting's signature.** dread (frightened → fleeing on crit) · venom
(persistent poison → sickened 2) · **lifedrinker** (25% lifesteal, 50% on crit — the only sustain on
a weapon) · **binding** (target cannot retreat; an anti-kiting tool) · **sorvai_marked** (+2 vs
Sorvai, and it **unlocks a language and a lore archive** — the only property whose mechanical effect
is narrative access).

⚠ **Only 21 of 33 properties are attached to any item.** Unused: acid/cold/shock/sonic_resistant,
corrosive, ethereal, everlight, ghost_touch, shadowstep, shifting, truesight, unholy. Twelve
properties are sitting there waiting for content — that is a *cheap* content win.

---

## 5. The seven legendaries — why they're legendary is structural

All seven are `is_unique`, all seven carry `legendary_effects` JSON, and they are **the only seven
items in the database with `lore_entry` populated** — acquisition writes a Guild Archive entry. Loot
*is* the lore-delivery system.

| Item | Type | Price | ilvl | The hook |
|---|---|---|---|---|
| Ashenmere's Spear | spear | 5,000 | 15 | summons a spectral copy; senses undead through walls |
| The Last Edict | longsword | 6,000 | 16 | 1/**week** Geas; unlocks Sorvanic + the Sorvai archive |
| Worldweft Mantle | cloak | 5,000 | 15 | indefinite shapechange; auto-passes identity deception |
| Sunforge Gauntlets | gloves | 5,000 | 15 | **rewrites Power Attack** to add 1d6 fire |
| Ironmane's Pelt | heavy armor | **7,000** | 16 | AC+7 with max_dex 1 and **zero** check penalty |
| Silvertide's Bow | longbow | 6,000 | 16 | damage scales off **Perception**; ignores concealment |
| Voss Phylactery Fragment | amulet | 5,500 | 15 | drop to 1 HP instead of 0, 1/day |

Four override channels appear **only** on legendaries: `unique_ability` (named, with a
day/rest/week cadence), `grants` (new verbs — water breathing, shapechange), **`feat_mod`**
(rewrites a feat the hero already has), and **`spell_mod`** (rewrites a spell's rules). That last
pair is the real design statement: **a legendary changes what your existing build does rather than
inflating its numbers.**

Uniqueness is triple-locked: filtered out of loot rolls, absent from all shop rows, and blocked at
inventory-add.

⚠ Known anomaly, already flagged in CLAUDE.md and confirmed here: **Ironmane's Pelt is legendary,
ilvl 16, 7,000g and carries `potency_bonus 0`**, so it derives to ac 7 — worse than a mundane Full
Plate's 8. Content bug, not code.

---

## 6. Loot — weighted tables, one item per enemy

12 tables, 97 rows. Tables 1–9 are the difficulty ladder; **weights sum to exactly 100** on tables
1,2,3,4,5,7,9, so weight reads directly as a percentage. Tables 6 and 8 sum to 75 and 80 — that
shortfall *is* the "no drop" chance. Tables 101–103 are a separate scroll-only pool.

The Godot roll was: `level×5–15` gold per enemy, then **exactly one weighted pick** per enemy (not
per-item independent chance), legendaries filtered first, identical items merged with a quantity
counter.

**Tier progression is a smooth reweight, not a swap.** Mundane weapons dominate T1–T3 (Dagger 30% in
T1); magical accessories enter at 5% in T2, reach 10% by T4; the first enchanted item (Flaming
Sword) appears at 8% in T5 and peaks at 12% in T7; by T9 the table is entirely
magical/enchanted/masterwork plus consumables.

**Quantity ranges are reserved almost entirely for consumables** — 89 of 97 rows are exactly 1.
Gear drops singular; supplies come in stacks. That is a clean rule worth keeping.

---

## 7. Shop — the access ladder, and the bug

105 rows across 5 buildings: Wizard Guild 40 (scrolls) · Blacksmith 29 · Market 18 · General Store
15 · Tavern 3.

Gating is one comparison — `required_building_level <= building_level` — so upgrading a building
never removes stock, only adds. Building level is gated by the reputation ladder, so **shop
inventory is downstream of reputation, which is downstream of completing quests.** You cannot buy
your way past the curve.

Pricing: `base × price_modifier` (only two deviate from 1.0 — Tavern 0.8, Blacksmith 1.2), sell-back
at 50%, rising to **55/60/65% at Market L1/L2/L3** — which makes hauling loot home a real logistics
decision.

**Shops sell almost nothing magical: 97 mundane, 7 magical, 1 enchanted, 0 legendary.** The message
is deliberate — *the shop keeps your guild functional; the dungeon makes it exceptional.*

### ⚠ The standing bug

`session.shopStock()` hard-skips every row with `required_building_level > 1` — **53 of 105 rows**,
which is **every armour row in the game** plus the +2/+4 wondrous items. Broken down, the skipped
set is: scroll 20 · consumable 11 · armor 8 · weapon 5 · wondrous 5 · ammo 2 · shield 2.

Two further inherited dead ends: **all 105 rows have `restock_rate: -1`**, so the weekly restock
matches zero rows; and **all 105 have `rotation_group: NULL`**, so the featured rotation is fully
plumbed and never fires.

---

## 8. Data-integrity finding — the half-done properties migration

The Godot migration declared a new convention (`properties` = a JSON **array** of property ids) and
never finished converting. Verified in the *current TS registries*:

| Form | Rows |
|---|---|
| `{}` — empty object (legacy) | 77 |
| `[]` — empty array (new) | 70 |
| `{"heal":"5d8+20"}` etc — **legacy object with data** | 20 |
| `["flaming","keen"]` — real named properties | **16** |

**97 of 183 rows still hold the object form.** Anything that parses this column as an array breaks
on more than half the catalogue. Only 16 items actually carry named properties — which is why 12 of
the 33 properties are orphaned.

---

## 9. What itemization is FOR — the intent, in one table

Recovered from the Godot SQL comments and design docs. This is the ladder the tiers were built to
express:

| Tier | The question the player is asked |
|---|---|
| mundane | Can I afford to equip everyone at all? |
| masterwork | Is +1 attack, or −1 check penalty, worth 3× the price? |
| magical | How much gold per point of potency? |
| enchanted | Raw numbers, or a property that changes how this hero *fights*? |
| legendary | Will I rebuild this hero around this object? |

Supporting principles worth carrying forward verbatim:

- **Gear must pay off in all three layers** — combat, world map, dungeon. The `passive_effect`
  column is documented as "persistent benefits across combat/world_map/dungeon contexts," and the
  six utility properties deliver exactly that. Pathfinder's Boots (250g) competing with combat gear
  for the same accessory slot *is the design*.
- **Slots exist to force trade-offs**, not to be filled.
- **Progression is gated by earned access, not by wallet.**
- **The economy should be legible** — no haggling minigame; clear prices and a visible 50% sell tax
  that makes buying-then-regretting cost real money.

---

## 10. Open questions for the gear brief (#24)

1. **Ladder shape.** Adopt the PF2E/ABP schedule (potency by item level at 2/10/16, striking at
   4/12/19 — which finally makes `item_level` mean something), tune the existing tier multipliers,
   or hybrid: schedule for fundamentals, tiers for flavour properties.
2. **Open the shop.** Removing the `required_building_level` skip restores 53 rows including all
   armour — but that is a balance change, not a bug fix, and it lands on the re-tune.
3. **Slots.** Build the full D3 shape (11+4+2), gear-only and defer consumables, or amend the ledger.
4. **The properties migration.** Convert the 97 legacy-object rows, or teach the parser both forms.
5. **The 12 orphaned properties.** Cheapest content win available — attach them to items, or cut them.
6. **`striking_tier: 2` and the ilvl 13–14 gap** — content holes to fill or deliberately close.
7. **One ring, two ring slots.** Content.

⚠ Whatever is chosen here **collides with the re-tune**. Gear potency is a first-order balance
parameter exactly like arena geometry, and CLAUDE.md's standing warning applies: do not tune the
curve against a gear ladder that is about to change.
