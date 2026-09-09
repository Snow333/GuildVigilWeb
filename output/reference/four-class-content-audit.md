# Four-class content audit — Fighter · Wizard · Cleric · Rogue

**Status:** measured reference, not a design decision. Gathered 2026-09-09 against
`data/game_data.db` and `src/` at commit `e377a7a`.
**Companions:** `output/briefs/character-workstream.md` (the pre-brief sequence),
`output/reference/pf2e-character-systems.md` (PF2E numbers).

Every number below came from a query or a grep, not from the briefs. Where a brief
disagrees with this file, this file was measured later — but re-measure rather than
assume, because content grows.

Class ids: **Fighter 1 · Wizard 2 · Cleric 3 · Rogue 4.**

---

## 1. Headline: the schedule is authored, the payload is mostly missing

| Axis | Authored in data | Defined in code | Reachable by player |
|---|---|---|---|
| Feat slots (4 kinds × 20 levels) | complete, all 4 classes | **nothing reads the columns** | 0 |
| Class features (`features` JSON) | 47 keys across the four | **2 of 47** resolve | 2 |
| Class feats | 93 across the four | all parse; ~21 repo-wide reach a resolver | 3 (hard-coded on Shade) |
| Spell slots | complete L1–20, both casters | read by `assembly.ts` | slots exist, pool does not |
| Known spells | — | **no model at all** | 2 hard-coded + 1 auto-cantrip |
| Ability boosts | `ABILITY_BOOST_LEVELS` in code | applied atomically, retro-CON HP | **yes — this one works** |

The stat-increase half of "abilities, spells, stat points" is the only one already
standing. The other two are schedule-without-payload.

---

## 2. Feat slots — supply vs demand

Cumulative slots granted by `class_progression` against cumulative feats whose
`level_req` has been met. A positive **short** column means the wizard would offer the
player fewer choices than slots.

### 2.1 Slot totals to L20

| Class | class | general | skill | ancestry |
|---|---|---|---|---|
| Fighter | **30** | 10 | 10 | 5 |
| Wizard | 10 | 10 | 10 | 5 |
| Cleric | 10 | 10 | 10 | 5 |
| Rogue | 10 | 10 | 10 | 5 |

Fighter's cadence is `1` at odd levels and `2` at even — a PF1-style bonus-feat track on
top of the PF2E class-feat schedule. Every other base class is the flat PF2E `10`.

### 2.2 Where supply runs out

| Class | class feats owned | slots | first level short | short at L20 |
|---|---|---|---|---|
| Fighter | 23 | 30 | **L16** | **7** |
| Wizard | 24 | 10 | — | 0 |
| Cleric | 23 | 10 | — | 0 |
| Rogue | 23 | 10 | — | 0 |

General (23 rows) and skill (20 rows) pools are shared across all classes and never run
short against 10 slots each.

⚠ **Ancestry slots have a 100% shortfall at every level for every class.**
`feat_slot_ancestry` grants 5 over a career; `select count(*) from feats where
ancestry_id is not null` returns **0**. There is no ancestry feat in the game, and
ancestry is cosmetic by law (`muster.test.ts` enforces it). The column is currently a
promise nothing can keep.

### 2.3 Prerequisite shapes (all 227 feats)

| Shape | Rows | Example |
|---|---|---|
| none | 200 | — |
| `{"feat": "<name>"}` | 17 | Improved Knockdown ← Knockdown |
| `{"skill_rank": ...}` | 10 | Battle Medicine, Cat Fall |

Two shapes only. A prereq checker is small and total — this is not an open-ended DSL.

### 2.4 Class-feat effect mix for the four

| effect_type | Fighter | Wizard | Cleric | Rogue |
|---|---|---|---|---|
| `combat_action` | **16** | 1 | 3 | 6 |
| `passive_modifier` | 4 | 14 | 16 | 12 |
| `reaction` | 3 | 2 | 1 | 4 |
| `resource_grant` | — | 3 | 3 | — |
| `spell_modifier` | — | 2 | — | — |
| `stat_mod` / `skill_mod` / `special` | — | 2 | — | 1 |

⚠ **The Fighter is the class most blocked by the `combat_action` hold.** 16 of its 23
class feats are `combat_action`, and that loadout verb is HELD by measurement. Turning on
feat selection without lifting the hold gives the Fighter the emptiest menu of the four,
which is the opposite of the intended feel.

---

## 3. Class features — 45 of 47 keys are undefined

`class_progression.features` is a JSON array of string keys. `assembly.ts::classFeatures`
accumulates them into a `Set<string>`; **exactly one key is ever read** —
`attack_of_opportunity`, which adds the `aoo` reaction.

| Class | Feature grants | Distinct keys | Keys that resolve |
|---|---|---|---|
| Fighter | 10 | 10 | 1 (`attack_of_opportunity`) |
| Wizard | 6 | 5 | 0 |
| Cleric | 5 | 5 | 0 |
| Rogue | 26 | 12 | 0 (see 3.1) |

Undefined keys, verbatim: `advanced_talents, arcane_bond, arcane_supremacy,
armor_fortress, armor_mastery, armor_training, bonus_feat, bravery, channel_energy,
divine_avatar, divine_grace, divine_intervention, domain, evasion,
improved_uncanny_dodge, master_strike, spellbook, trap_sense, uncanny_dodge,
weapon_mastery, weapon_training_1..4`, plus the sneak-attack ladder below.

### 3.1 ⚠ The sneak-attack ladder is authored twice and only one copy is live

`class_progression` carries a 10-step Rogue ladder (`sneak_attack_1d6` … `10d6`, two rows
per step). **Nothing reads it.** `assembly.ts::sneakDice` instead derives
`ceil(classLevel / 2)` dice from feat #68's own `damage_scaling` payload.

The two agree today by coincidence of arithmetic. They are separate sources of truth for
the same number, and a content edit to either one silently desynchronises them. Any
class-feature brief must pick one and delete the other — this is the clearest instance in
the repo of the "never store what you can derive" constraint being violated in data.

### 3.2 Only two features have a matching `feats.feature_key` row

`attack_of_opportunity` → Reactive Strike (#2) · `sneak_attack_1d6` → Sneak Attack (#68).
The scoping note's "auto-grant `feature_key` feats (6 rows)" is repo-wide; for **these
four classes it is 2 rows.** Auto-granting is therefore not a route to defining the other
45 keys — those need either new feat rows or a features-to-effects table.

---

## 4. Spells — slots without a pool, and a pool that mostly does nothing

### 4.1 The slot schedule is complete and identical for both casters

Wizard and Cleric share one table: 5 cantrips from L1, first L1 slots at L1 (2), L2 slots
at L3, L3 at L5, L4 at L7, L5 at L9 — reaching 4/4/4/3/2 by L10. `assembly.ts` already
reads all ten `spell_slots_*` columns into `Combatant.casting.slots`, and `spells.ts`
decrements them on cast. **The consumption side is built.**

### 4.2 There is no known-spells model

Grepping `src/` for `knownSpells`, `spellbook`, or `prepared` returns nothing. A hero's
castable set is whatever `muster.ts` hard-coded (Mira: Heal; Elandra: Magic Missile) plus
one auto-appended cantrip from `defaultCantripFor`. Only two cantrips carry the
`default_cantrip` flag: Electric Arc (arcane) and Divine Lance (divine).

### 4.3 ⚠ The reachable pool is roughly a quarter of the authored one

`resolveCast` handles `damage` and `healing`. Everything else is inert (#21, unchanged).

| Caster | Spell levels 0–3 | Authored | Reachable | Share |
|---|---|---|---|---|
| Wizard (`arcane`) | 0,1,2,3 | 72 | **17** | 24% |
| Cleric (`divine`) | 0,1,2,3 | 43 | **12** | 28% |

Worst cells: **arcane L1 offers 3 usable of 22** (9 of the 19 unusable are `debuff`), and
**arcane L2 offers 2 of 16** (9 are `buff`). A spell-selection UI built today would show
the player a menu where three of four entries resolve to nothing.

Repo-wide the split is `damage` 58 · `buff` 52 · `debuff` 44 · `utility` 40 ·
`healing` 20 · `summon` 4 — **140 of 218 inert.**

---

## 5. Ability boosts — the one axis that already works

`levelUp.ts` grants **one +2 boost at character levels 5, 10, 15, 20** — four boosts,
+8 points of raw score across a career. It is atomic, it projects the pending boost into
class eligibility and skill points (the fixed Godot INT bug), and a CON boost pays
retroactive HP at `modDiff × prior character level`. The wizard UI already surfaces it
(`boostRequired`).

PF2E grants **four boosts at each of those levels — 16 total**, with a +4 creation cap and
a partial-boost rule above 18. Guild Vigil is at **one quarter of PF2E's rate.**

No caps are enforced on ability scores at level-up. There is no maximum-score check in
`applyLevelUp`.

---

## 6. Supporting content that is complete and needs no work

- **`class_skills`** — Fighter 6, Wizard 4, Cleric 4, Rogue 7. Populated and read.
- **`class_proficiency_tiers`** — full tier ladders for all four, including `spell_attack`
  and `spell_dc` for both casters. Read by `proficiency.ts`.
- **Save/BAB/HP progression** — all 20 levels, all four classes, no gaps.

---

## 7. The five gaps, ranked by rows unlocked per unit of risk

1. **Feat slots at level-up** — reads 4 authored columns, unlocks 93 class + 43
   general/skill feats as *choices*. Balance risk is bounded by how few feats have wired
   effects, but is not zero.
2. **Known-spells model** — unlocks the caster half of the loop. Gated by 4.3: the pool
   must either be filtered to what resolves, or more `effect_type`s must land first.
3. **Class features** — 45 undefined keys, and one duplicated source of truth (3.1).
   Largest authoring job of the five; smallest code job.
4. **Ancestry feats** — 5 slots per career, 0 rows, and the cosmetic-ancestry law in the
   way. Either author the content or zero the column; leaving it is a visible hole.
5. **Fighter class-feat supply** — 7 short at L20, first bites at L16. Content authoring,
   no code.
