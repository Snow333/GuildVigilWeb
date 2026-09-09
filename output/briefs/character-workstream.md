# Character workstream — scoping note (pre-brief)

**Status:** FOR DECISION. Not an implementation brief — this is the shape of a *sequence*
of briefs (#22 onward), with the audit that justifies it and the open questions that must
be answered before any one of them gets written.
**Date:** 2026-09-09
**Companion:** `output/reference/pf2e-character-systems.md` (PF2E numbers, cited)

---

## 0. The pivot in one line

Combat and dungeon work (#13–#21) built a sim that resolves fights well. The *character*
half of the loop — level-up choices, ability selection, gear that matters — is scaffolded
in code and populated in data, but **almost none of it is reachable by the player**.

---

## 1. Audit: what exists vs. what is reachable

Measured against the repo on 2026-09-09, not inferred.

| System | Data | Code | Reachable by player | Gap |
|---|---|---|---|---|
| Level-up | `class_progression` 460 rows | `applyLevelUp` atomic, prereqs, caps, retro-CON HP | class + boost + skill ranks | **feat slots, class features** |
| Feats | **227 rows**, all parse | `featEffects.ts` classifies all 227 | 0 chosen by player — muster hard-codes 3 | **206 of 227 feats do nothing** |
| Spells | **218 rows** | `resolveCast` handles damage + healing | 2 hard-coded in muster + 1 auto-cantrip | **no known-spell model at all** |
| Equipment | 183 bases, 33 properties | `deriveItem` full derivation, potency→AC fixed | equip/unequip by slot, buy from shop | **shop sells 52 of 105 rows, no armour** |
| Loadout | — | `pickAction` priority walk, 3 verbs | reorder + "add strike nearest" | **can't add a spell or a toggle in the UI** |
| Ancestry | 8 rows | `ancestry.ts` | chosen at muster | **cosmetic by law — zero stat effect** |

### 1.1 The feat number, broken down

227 feats parse; **21** reach any resolver. The wired ones are Sneak Attack, Reactive
Strike, Nimble Dodge, Rage, the three Monk stances, Weapon Specialization ×2, the 12
`stat_mod`/`skill_mod` passives, and Trap Finder's dungeon bonus.

| effect_type | rows | inert | who would own it |
|---|---|---|---|
| `passive_modifier` | 119 | 118 | combat (`strike.ts`, `conditions.ts`) |
| `combat_action` | 51 | 51 | loadout verb — **HELD by measurement** |
| `reaction` | 16 | 14 | combat reaction hook (AoO precedent exists) |
| `resource_grant` | 12 | 12 | campaign/prep |
| `special` | 6 | 6 | campaign |
| `spell_modifier` | 3 | 3 | `spells.ts` |
| others | 20 | 2 | already wired |

Feat types: class 184 · general 23 · skill 20. Level requirements cluster at
1 (53), 4 (40), 6 (33), 2 (32), 8 (27), 10 (22), 12 (17) — i.e. the content is authored on
an **even-level cadence that matches PF2E's class-feat schedule**, and
`class_progression` already carries `feat_slot_class / _general / _ancestry / _skill`
for all 460 rows. **Nothing in `src/` reads those four columns.** The level-up wizard
sends `feats: []` and `autoGrantedFeatIds: []` on every commit.

That is the cheapest large unlock in the repo: the schedule is authored, the effects
parse, the atomic apply already takes the arguments.

### 1.2 The spell number

218 spells; `resolveCast` handles `damage` (58) and `healing` (20). **140 are inert**
(buff 52, debuff 44, utility 40, summon 4) — flagged in #21 as its own brief.

Separately and more urgently for this workstream: **there is no known-spells model.**
Grepping `src/` for `knownSpells`, `spellbook`, or `prepared` returns nothing. A hero's
castable set is (a) whatever the muster template hard-coded and (b) one auto-appended
cantrip from `defaultCantripFor`. Core-loop D4's "known pool → ordered active loadout" has
its **loadout** half built and its **pool** half missing entirely. The loadout UI says so
in its own margin note: *"spell entries join the editor with the known-spells model."*

### 1.3 The equipment number

Derivation is genuinely good — instances are `(baseId, tier, propertyIds[], seed)`,
everything recomputes, #14 fixed potency-on-armour. The problems are all acquisition and
ladder shape:

- **The shop skips 53 of 105 rows** (`required_building_level > 1`), including every
  armour row and the +2/+4 wondrous items (CLAUDE.md, standing).
- `TIER_GRANTS` is a flat 5-tier placeholder (masterwork +1, enchanted +2, legendary +4/+1
  striking). PF2E's actual ladder is a **schedule**: potency +1/+2/+3 at item level 2/10/16,
  striking/greater/major at 4/12/19. Our items carry `item_level` on all 183 rows and
  **nothing reads it**.
- Slots in data are `main_hand` 62 · `armor` 28 · `accessory` 16 · `off_hand` 4 · `head` 3 ·
  `boots` 2 · `ring` 1. D3 promised **11 gear + 4 consumable quick-slots + 2 weapon sets**.
  We have 7 slot values and no consumable or weapon-set concept in the sim at all.
- 12 consumable rows and 52 scrolls exist. Neither is usable.

---

## 2. What PF2E gives us, and what to decline

Full numbers in `output/reference/pf2e-character-systems.md`. The three findings that
should actually shape our design:

**(a) PF2E's item math is a level curve wearing a shopping-trip costume.** The Automatic
Bonus Progression variant grants attack potency at 2/10/16, devastating dice at 4/12/19,
defense at 5/11/18 — *exactly* the levels the corresponding runes were expected. That is
Paizo confirming the treadmill is a schedule. **This matters for us**: our autopilot
deliberately never equips (`gearBrackets.ts` lives in `tests/`, not `src/`, by decision),
so the harness assumes bracket-appropriate gear anyway. We can adopt the schedule as the
*balance* backbone and let shopping be the *pleasure* layer, without the two fighting.

**(b) Cantrip auto-heightening is the anti-whiff rule.** Cantrips scale to half level,
which removes "out of slots, I do nothing." We already append a cantrip in `assembleHero`
for exactly this reason (#15 measured hero deaths 686 → 156). Extending the same principle
to focus-spell-like abilities is cheap and on-model.

**(c) PF2E multiclassing is archetype dedication, not class levels.** We ship 3.x-style
class-level multiclassing (ability ≥13, caps 20/10, max 5) — a ledger-confirmed divergence
from the bible. That is fine and I am not proposing changing it. Recording it here so no
future brief "corrects" it.

Decline, at least for now: proficiency-adds-full-level (our `level/2 + 1` curve is
load-bearing for the tuned dungeon curve), the 10-invest cap, Bulk enforcement, and the
partial-boost rule above +4.

---

## 3. Proposed sequence — four briefs, in dependency order

Each is separately shippable and separately measurable.

### Brief #22 — **Feat slots at level-up** (the unlock)

Read the four `feat_slot_*` columns; offer eligible feats at the level-up wizard; enforce
prerequisites (27 feats carry them, all `{"feat": "<name>"}` chains today); apply through
the existing `plan.feats` path. Auto-grant `feature_key` feats (6 rows) from class features.

- **Cost:** small in `src/` (one selector + one query + wizard tab), moderate in tests.
- **Risk:** every newly-selectable feat with a *wired* effect is a balance change. Only 21
  are wired, so the blast radius is knowable and small — but it is not zero, and the
  autopilot's `buildAutoLevelUpPlan` will start taking feats too unless we gate it.
- **Measurement:** the dungeon curve moves or it does not; the ±8-point precision rule
  applies, so an exposure test (à la #20) is mandatory — assert feats are actually being
  taken, or the whole feature can silently no-op green.

### Brief #23 — **Known spells + the loadout editor** (the ability half of D4)

A `knownSpells` list on `HeroState` (backfilled append-only per constraint 8), populated by
class/level/tradition; the loadout editor gains "add cast" and "add toggle" rows drawing
from that pool and the hero's feats. Spellbook acquisition (scroll transcription — 52
scroll rows exist) is a natural follow-on but should NOT be in the same brief.

- **This is the feature Steven has been implicitly waiting for** — it is the only thing
  standing between the player and the tactical layer that already works in the sim.
- **Depends on:** nothing. Can run before or in parallel with #22.

### Brief #24 — **The gear ladder** (potency/striking on a schedule)

Wire `item_level`; replace the flat `TIER_GRANTS` with a level-keyed schedule; open the
shop (the `required_building_level` skip); decide the consumable/quick-slot question.

- **This one is a balance brief, not a feature brief.** It moves every fight.
- ⚠ **It collides with the RE-TUNE.** CLAUDE.md's standing next-step is the re-tune (the
  at-level curve overshoots: d1–d5 at 95.3/91.3/88.3/57.0/64.7 vs a ~80% target), and #19
  warned that arena geometry is a first-order balance parameter. Gear potency is another
  one. **Do not tune gear against a geometry that is about to change, and do not re-tune
  the curve against a gear ladder that is about to change.**

### Brief #25 — **Feat effects, one domain at a time**

Not one brief — a *series*, ordered by rows unlocked per unit of risk:
`reaction` (14) → `spell_modifier` (3) → `passive_modifier` (118, the big one) →
`combat_action` (51, needs the HELD loadout verb revisited).

- `combat_action` is the one that needs Steven's permission first: the `combat_action`
  loadout verb is **HELD by measurement**, and 51 feats are waiting behind it.

---

## 4. Open questions — these need answers before #22 is written

**Q1 — Sequencing against the re-tune.** Three candidate orders:

| Option | Order | Argument |
|---|---|---|
| **A** | #23 (spells/loadout) → re-tune → #22 → #24 | #23 is the only one that adds player agency without moving the curve. Re-tune once, on a stable arena, then add power. |
| **B** | re-tune → #22 → #23 → #24 | Fix the overshoot first, on today's content, then never re-tune again this phase. |
| **C** | #22 + #23 together → re-tune → #24 | One player-facing "character update," then one re-tune absorbing both. Fewest re-tunes, largest single measurement. |

My read: **A**, because #23 is measurably neutral to the curve (the autopilot doesn't use
the editor) and it is the highest player-visible value in the repo. But this is a
sequencing call with real cost either way and it is yours.

**Q2 — Does the autopilot take feats?** If `buildAutoLevelUpPlan` starts selecting feats,
every harness baseline moves and `career-distribution` (already degenerate) gets noisier.
If it does not, hero power diverges between autopilot runs and hand play, which makes the
harness a weaker proxy. Options: autopilot takes a fixed per-class priority list · autopilot
takes nothing (feats become a purely player lever) · autopilot takes only auto-grants.

**Q3 — Gear ladder shape.** PF2E-schedule (potency by item level, matching ABP's 2/10/16)
· keep the tier-multiplier placeholder and just tune its numbers · hybrid (schedule for
fundamentals, tiers for flavour properties). Only the first makes `item_level` mean anything.

**Q4 — Consumables and weapon sets.** D3 locked 11+4+2. Today we have 7 slot values, no
quick-slots, no sets. Build the full D3 shape · build gear slots only and defer consumables ·
declare 4+2 out of scope and amend the ledger.

**Q5 — Does the `combat_action` hold lift?** 51 feats are behind it. It was held by
measurement; re-measuring it is a probe, not a brief.

**Q6 — Ancestry.** It is cosmetic by law and `muster.test.ts` enforces it. The bible's
launch table gives every ancestry boosts, a flaw, HP, speed, and a signature trait. Turning
that on is a systems brief with a save-backfill; leaving it off is free. Not urgent — but
if it is ever going to happen, it is cheaper *before* #22 ships feat selection than after.

---

## 5. What I would NOT do

- Don't build a "best in slot" or gear-scoring helper in `src/` — Steven declined it, and
  `gearBrackets.ts` lives in `tests/` for that reason.
- Don't widen the founding muster's class list as part of this; that is content work with
  a starting-gear-by-class table behind it.
- Don't touch the proficiency curve. It is `level/2 + 1` and the whole dungeon balance sits
  on it.
- Don't fix the flanking/concealment disagreement here — it is re-tune scope.
