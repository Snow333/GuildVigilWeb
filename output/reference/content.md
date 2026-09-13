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

- ⚠ **THE RECURRING DEFECT IN THIS REPO IS CONTENT AUTHORED AGAINST A CONTRACT WITH NO CONSUMER.** It has now happened five times — `class_weapon_proficiency`, `items.onHitEffects`, `items.stat_bonus`, the 96 buff/debuff spell rows, and `enemies.abilities` — and nothing catches it, because inert content breaks no test. **Brief #24 §7 proposes content-reachability tests; they are NOT built.** When authoring a column, write the consumer and a reachability assertion in the same commit.
- ⚠ **Still-dead content, read by NOTHING:** `item_level`, and ⚠ **`enemies.abilities` — 21 of 45 rows name 35 distinct abilities (`undead_immunities`, `pack_tactics`, `ferocity`, `breath_weapon_6d6`, `frightful_presence`, `paralysis`, `regeneration_10`, `spellcasting_5/9`…) and `buildEnemy` (`src/sim/combat/build.ts`) reads hp/ac/attack/damage/speed/size/`aoo_count` and NOTHING ELSE.** Every enemy in the game therefore fights identically apart from its numbers — this is the measured centre of the enemy-content brief. **Retired from this list by #22–#24:** the four `feat_slot_*` columns (460 rows, now `heroes/feats.ts`), `athletics`, **`class_weapon_proficiency` (44 rows — #23 wired it into `heroes/gearProficiency.ts`; CLAUDE.md called it dead and was WRONG, it was merely unread)**, **`items.stat_bonus`** and **`items.onHitEffects`** (#24 — `heroes/equipment.ts` and `combat/weaponRiders.ts`). ⚠ **`class_progression.features` is STILL 45-of-47 dead for the founding four** — only `attack_of_opportunity` and `sneak_attack_1d6` resolve; the rest (`bravery`, `evasion`, `weapon_training_1..4`, `channel_energy`, `domain`…) name features NOTHING defines. ⚠ **`feat_slot_ancestry` grants 5 slots/career against ZERO ancestry feats** — the wizard shows that track as future content by decision, not by oversight. #19 retired `aoo_count` and `armor_check_penalty`. Also dead by arithmetic: the **ambush ladder** (`detectDc = 12 + difficulty × 2` needs 32 at d5, so `partySurprise` fires 5.3% at d1 and **0% at d3 and d5**) and `2^(level − difficulty)` in `pickEnemies` (a no-op — `levelBand` is 1). Don't rediscover these; they are queued content fixes.
- ⚠ **THE SHOP SELLS NO ARMOUR AT ALL.** `session.shopStock()` hard-skips every row with `required_building_level > 1` — **53 of 105**, including every armour row *and* the +2/+4 wondrous items the backstab loop now wants. `assembly.ts` already folds `stat_bonus` into ability mods, so Gloves of Dexterity +2 would raise every conceal check with no further work — they are **lootable but not purchasable**. Do not design a gear solution that assumes the shop can supply it.

