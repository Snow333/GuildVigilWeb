# Guild Vigil — Future Work

**What this file is:** the stack-ranked backlog. Everything the game still needs, in the order it
should be done, with what blocks what.

**Authority:** this file states what is NOT built and what is NEXT. It is the only place that
tracks roadmap. CLAUDE.md points here and does not duplicate it.

**Maintenance:** when an item ships, delete it from this file and record it in
`output/briefs/INDEX.md`. This file should shrink as the game grows.

⚠ **Balance numbers deliberately do NOT live here.** They move every time the harness runs. The
harnesses are the record: `tests/harness/dungeon-curve.test.ts` and friends.

---

## Waiting on Steven — nothing proceeds past these

| # | Item | State |
|---|---|---|
| 1 | **Enemy abilities (brief #26)** | ⚠ **AWAITING APPROVAL.** Brief written and committed. |
| 2 | **Melee interdiction (brief #17)** | ⚠ **AWAITING DECISION.** Code committed FOR DECISION only; §12's four questions are open and none of it has shipped. |

---

## The ranked backlog

### 1. Enemy abilities — brief #26

**The measured hole:** 21 of 45 enemy rows name 35 distinct abilities (`undead_immunities`,
`pack_tactics`, `ferocity`, `breath_weapon_6d6`, `frightful_presence`, `paralysis`,
`regeneration_10`, `spellcasting_5/9`…) and `buildEnemy` reads hp/ac/attack/damage/speed/size and
nothing else.

**In player terms: every monster in the game fights identically.** A dragon and a goblin use the same
behaviour and differ only in how tough they are and how hard they hit.

This is the single largest gap in the game and it blocks any meaningful balance work.

### 2. Arena / room geometry

⚠ **MUST be settled BEFORE the re-tune.** Room geometry is a first-order balance parameter — brief
#19 §0 measured a corridor at **11–13 points of completion** at d3–d5. Re-tuning against a geometry
that is about to change means doing the work twice and shipping neither version tuned.

The arena today is one 20×20 room: no second layout, no cover, no reach, no difficult terrain, and
**no unit-unit collision at any size**. Collision is its own brief — it changes closure times for
every unit in the game.

Costing already exists: `output/briefs/arena-costing.md`.

### 3. THE RE-TUNE

**Blocked by items 1 and 2.** Scope: levels, mob counts, surface difficulty, the backstab's flat
depth curve, and restoring `career-distribution`'s lost signal.

Standing call (brief #22 D5): **the dungeon curve is not a gate until enemy content lands.** Dungeons
are expected to get harder as enemies gain abilities; tuning before that measures the wrong game.

⚠ **Re-measure creature size during this pass.** Huge is entirely unmeasured — its only row (Adult
Red Dragon, L12) cannot spawn at d1–d5, so the "size is free" finding rests on six Large rows, not
eight, and does not transfer to d6+.

### 4. The shop sells no armour

`session.shopStock()` hard-skips every row with `required_building_level > 1` — **53 of 105 rows**,
including **every armour row** and the +2/+4 wondrous items the backstab loop wants.

**In player terms: you cannot buy armour at all.** Those items are lootable but not purchasable.

⚠ Do not design any gear solution that assumes the shop can supply it until this is fixed.

### 5. Content-reachability tests

Proposed in brief #24 §7, **not built**.

⚠ **The recurring defect in this repo is content authored against a contract with no consumer — it
has happened five times**, and nothing catches it because inert content breaks no test. This is the
structural fix. Details in `output/reference/content.md`.

### 6. Dead content fixes

Known-inert content, queued rather than rediscovered. Full inventory in
`output/reference/content.md`. The headline items:

- **`class_progression.features` is 45-of-47 dead for the founding four** — only
  `attack_of_opportunity` and `sneak_attack_1d6` resolve. `bravery`, `evasion`, `weapon_training_1..4`,
  `channel_energy`, `domain` and the rest name features nothing defines.
- **The ambush ladder is dead by arithmetic** — `detectDc = 12 + difficulty × 2` needs 32 at d5, so
  surprise fires 5.3% at d1 and **0% at d3 and d5**.
- `item_level` is read by nothing.

### 7. Audio

**No audio code exists in `src/` at all.** Not placeholder sounds — none. **The game is completely
silent.**

This is a **Phase 3 exit criterion**, which is why Phase 4 is not next. The design survived the
migration (4-domain event tree, category presets, Web Audio + a build-time manifest) — see
`output/decision-ledger.md` Area 8. Sorting the raw audio remains a content task.

### 8. Playwright visual baselines

The other **Phase 3 exit criterion**. Unmet.

### 9. Art pass

- **Hero figures: 12 of 12 ship.** All ancestry/sex paperdoll figures are done.
- **Hero busts: 4 of 12.** Eight hero subjects fall back to the sketch-pending silhouette — that
  fallback is a normal play path, not an error.
- **NPC and enemy art is PARKED by decision (2026-08-12)** — the silhouette IS the placeholder.

Pipeline and its hard-won traps: `output/reference/ui-and-art.md`. Style law:
`output/art-style-bible.md`.

### 10. Restore `career-distribution`'s signal

⚠ **The harness is currently DEGENERATE and cannot report it** — `completionRate 1.0 · wipeRate 0 ·
failRate 0 · idleWeekRate 0 · ambushDeaths 0`, and every assertion is a one-sided floor, so nothing
can fire. **A green `career-distribution` is presently worth nothing as evidence about the surface
game.** Part of the re-tune, not a follow-up to it.

---

## Held, parked and not-yet-built

| Item | State | Note |
|---|---|---|
| **Threat / taunt mechanic** | ⚠ **HELD BY MEASUREMENT** | Measured **−3.5 completion, +8.5 wipes**. It made the game worse. Revisit only after tank survivability improves. |
| **R4 — the 7+ level band** | HELD | |
| **Multi-team play (up to 4)** | NOT BUILT | Core loop L3. One team today; the 4-team Tavern-gated structure is the target, not the code. |
| **Authored story spine** | NOT BUILT | Core loop L4. No storyline packs, no authored ending. |
| **Tauri desktop wrap (brief #7)** | PARKED | Parked by decision, not cancelled. |
| **Dialogue trees** | DEFERRED | Post-launch (decision ledger Area 7). |

⚠ **A HOLD FOR SCOPE IS NOT A HOLD BY MEASUREMENT.** The table above says which kind each one is,
because the two have been conflated here before: the `combat_action` loadout verb was logged as
"unmeasured" in the same sentence as the threat mechanic, drifted into "held", and eventually shipped
in brief #22 as the `ability` verb. **Check which kind of hold you are looking at before reviving or
dismissing anything.**

---

## Then

Phase 4 — gated behind audio and the visual baselines above.
