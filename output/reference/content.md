# Content authoring — units, naming, the muster

> Split out of `CLAUDE.md` because it exceeded the 20,000-char context-injection cap and
> was being silently truncated. **This file is authoritative for its domain** — do not
> copy these facts back into CLAUDE.md, and do not re-derive them.

Read this before authoring or wiring any content column, item, or enemy row.
The dead-content inventory and the shop defect live here too.

---

- Masterwork carries **no `+1` name suffix** (`equipment.ts` composeName) — it is craftsmanship, not enchantment. Design rule and rationale: `output/design-law.md` §3.
- Widening the founding muster's class list is **CONTENT work** — there is no starting-gear-by-class table. `output/design-law.md` §1.
- ⚠ **UNIT TRAPS IN AUTHORED CONTENT: `speed` IS IN FEET, THE ENGINE IS IN WORLD UNITS.** Boots of Speed author `{"speed": 10}` meaning ten *feet*; `BASE_SPEED` is 5 world units and 1 unit = 5 ft. A raw add TRIPLES hero movement. Converted and pinned in `heroes/equipment.ts` — check the unit before folding any authored number into a sim value.

## The recurring defect, and the current dead-content inventory

> **Audited against the code at `922171e` on 2026-09-13.** Two verdicts flipped and seven numbers
> were wrong. ⚠ **This inventory goes stale silently** — it is a manual record of what has no
> consumer, and wiring a consumer does not update it. Re-audit it whenever a brief wires a column.

- ⚠ **THE RECURRING DEFECT IN THIS REPO IS CONTENT AUTHORED AGAINST A CONTRACT WITH NO CONSUMER.**
  Five occurrences so far — `class_weapon_proficiency`, `items.onHitEffects`, `items.stat_bonus`,
  the 96 buff/debuff spell rows, and `enemies.abilities` — and nothing catches it, because inert
  content breaks no test. **Brief #24 §7 proposes content-reachability tests; they are NOT built.**
  When authoring a column, write the consumer and a reachability assertion in the same commit.

### Still dead — verified 2026-09-13

- **`item_level`** — 5 hits repo-wide, every one a comment. All 183 item rows carry a value.
- **`items.loot_tier`** — zero consumers outside `src/content/generated/`. ⚠ Newly found; this was
  never on the list.
- **`feat_slot_ancestry`** — **0 of 227 feat rows carry a non-null `ancestry_id`**, so the pool is
  provably empty. The column IS read (`heroes/feats.ts` `slotsForLevel`, and `matchesSlot` filters
  on `ancestry_id !== null`) — the track is shown to the player as future content **by decision**
  (brief #22 D1), not by oversight. ⚠ 5 slots/career holds for the ten 20-level classes; the three
  prestige classes have 10 progression rows and sum to 3 each.
- **`class_progression.features` — 44 of 47 occurrences dead for the founding four**, across 33
  distinct keys. ⚠ **Not 45** — `sneak_attack_1d6` is named on BOTH Rogue L1 and L2, so three
  occurrences resolve, not two. Only 6 of 227 feat rows carry a `feature_key` at all. Across all 13
  classes: **307 of 314 dead**. Consumers: `heroes/feats.ts` `autoGrantsForLevel`, and
  `assembly.ts` reading `features.has('attack_of_opportunity')` for the `aoo` reaction.
- **THE SHOP SELLS NO ARMOUR.** `session.shopStock()` skips every row with
  `required_building_level > 1` — **exactly 53 of 105 rows; 0 of the 8 armour rows survive.**
  Shields DO survive (2 of 4), so the defect is `item_type='armor'` only. ⚠ **Gloves of Dexterity +2
  is NOT a valid example** — it is absent from `shop_stock` at every building level, so it is
  unpurchasable for a different reason. The real skipped `stat_bonus` items are Cloak of Resistance
  +1/+2, Headband of Intellect +2, Belt of Strength +2 and Boots of Speed. `assembly.ts` does fold
  `stat_bonus` into ability mods, so any of them would work the day it became purchasable.
- **The ambush ladder is dead by arithmetic.** `detectDc = 12 + difficulty × 2`, and `partySurprise`
  needs `best ≥ detectDc + 10` — so 32 at d5 against a d20 max of 20. **0% at d3 and d5 is correct.**
  ⚠ **d1 is exactly 5.0%, not 5.3%** — only the Cleric (perception 4) can reach the 24 bar, on a
  natural 20 alone. 5.3% exceeds the arithmetic ceiling and was never derivable.
- ⚠ **AND THE AMBUSH LADDER IS DEADER THAN THIS DOC CLAIMED.** Even when `partySurprise` fires it
  changes **nothing mechanically**: `dispatch.ts` emits `explore.ambush_resolved` and then calls
  `runEncounter(combatId, roomId, heroes, enemies, seed)` — a 5-parameter signature with **no tier
  argument**. `combat.started.ambushTier` exists in the event type and is **never populated**. All
  five tiers are pure UI narration in `ui/beats/interpret.ts`.

### Retired from the dead list — these are ALIVE

- **`enemies.abilities`** — ⚠ **WAS LISTED DEAD HERE AND IS NOT.** Brief #26 M1+M2 (`da5c38a`) wired
  it through `combat/build.ts` → `resolveEnemyAbilities` into riders, damage modifiers, sneak dice
  and stealth. **This doc was written one commit before that landed** — the same failure mode as
  `class_weapon_proficiency`, and the second time it has happened. Current state: 21 of 45 rows
  carry abilities, 45 mentions, 35 distinct names; **9 names live, 26 explicitly DEFERRED, 0
  unknown**; 17 of 45 statblocks now produce a distinguishing engine effect. `buildEnemy` also reads
  `dex`, `wis`, `str` and `enemy_type` — the old "and NOTHING ELSE" is false.
- **`class_weapon_proficiency`** — alive since #23 (`heroes/gearProficiency.ts`). ⚠ **70 rows, not
  44** (`count-gates.test.ts` gates it at 70).
- **The four `feat_slot_*` columns** — alive since #22 (`heroes/feats.ts`). ⚠ **`class_progression`
  has 230 rows, not 460.** The same wrong figure is repeated in the source comment at
  `src/sim/heroes/feats.ts:5`.
- **`athletics`, `items.stat_bonus`, `items.onHitEffects`, `aoo_count`, `armor_check_penalty`** —
  all re-verified alive.
- **The 96 buff/debuff spell rows** — alive since #25 (`combat/spells.ts`), gated per-row by
  `isBuffShapeResolvable`. Exactly 52 buff + 44 debuff.

### ⚠ `2^(level − difficulty)` in `pickEnemies` is NOT a no-op — that claim was false arithmetic

`levelBand: 1` does **not** flatten the band. For COMBAT rooms `populate` passes
`minL = max(difficulty − 1, 1)` and `maxL = difficulty + 1` — a **three-level** band — so the
exponent ranges over {−1, 0, +1} and cost takes two values: **1** (levels d−1 and d) and **2**
(level d+1). Measured against the real 45-row registry, roughly a third of every draw pool costs
double at every difficulty (d1 7/6, d2 13/7, d3 13/5, d4 12/6, d5 11/4). It also drives the
over-budget re-draw.

It IS a no-op in exactly one place — the **boss branch**, which passes `difficulty + 1` as both the
band floor and the difficulty, making the exponent identically 0. That is deliberate and commented
(brief #13 Q1). **The old claim generalised the boss special case to the whole function.**

