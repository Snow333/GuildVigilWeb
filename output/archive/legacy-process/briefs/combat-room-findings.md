# Brief #19 — The Combat Room: IMPLEMENTATION RECORD

**Companion to** `output/briefs/combat-room.md` (the brief; §§0–14 are design and measurement).
Same shape as `combat-playback-findings.md`: the brief stays as approved, this carries what building it actually produced.

**Status:** BUILT, GREEN, and **SHIPPED as two commits** — `565826e` (the room) and `65ecfba` (AoO from content + the backstab), both on top of `cacc4d1` and pushed.
**Suite:** 483 unit + 11 e2e green · bundle **1,239.30 kB** (was 445 + 11 / 1,238.56 kB).

---

## 1. The headline number

n=300/cell, at level, gear bracket, on the curve's own seeds.

| | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| **shipped before this pass** | 91.7 | 85.3 | 80.7 | 39.7 | 49.3 |
| **+ the 20 × 20 room** (commit 1) | 89.3 | 87.0 | 82.0 | 39.7 | 47.7 |
| **+ AoO from content + backstab** (commit 2) | **95.3** | **91.3** | **88.3** | **57.0** | **64.7** |
| wipes, final | 1.0 | 2.3 | 4.7 | 16.3 | 10.0 |

Against §12.3's projection at a 75% conceal pass rate (95.0 / ~91 / 89.0 / 61.7 / 67.3): **every cell inside the ±8-point bar**, and slightly under at d4/d5 exactly as a measured ~50% pass rate should be. The 4–6 band takes most of the benefit, which is where brief #17 wanted to reach and brief #14 called a content problem.

The room alone measured −2.4 / +1.7 / +1.3 / 0.0 / −1.6 against shipped — **free**, as §10.1 said, and consistent with its A1 arm (89.7 / 83.7 / 78.7 / 40.0 / 49.0).

---

## 2. ⚠ THREE CORRECTIONS TO THE BRIEF

### 2.1 The rogue was never untrained in Stealth (§12.1 and §13.4 are wrong)

§12.1: *"the autopilot's skill priorities are `['perception','athletics','thievery']`, so Stealth would never be raised on level-up either"*, and §13.4's table prints **"Stealth ranks: 0 — NOT TRAINED"** at every level.

**Measured, before any code changed:** `buildAutoLevelUpPlan` builds its order as `[...priorities, ...skillNames.filter(n => !priorities.includes(n))]` — capped skills **spill into the rest of the registry in order**, and Stealth is third in `skills` (Athletics, Acrobatics, **Stealth**, Thievery, …). Shade's actual ranks:

| | L1 | L2 | L3 | L5 | L7 |
|---|---|---|---|---|---|
| Stealth ranks | **0** | 1 | 2 | 4 | 6 |

**Only L1 was ever 0.** So §14.3's edit #2 was two edits and only half of one was needed.

**Steven's call (2026-08-13): muster only, no priority change.** The rogue's founding template gains `stealth: 1`; the global priority list is untouched. Adding `'stealth'` there would have spent **Torvald's and Mira's** points on a skill neither can ever use — they have no sneak dice, and **no enemy in the registry has sneak dice either**, so hero Stealth is never a defensive term. That would have been a silent nerf dressed as the approved change.

### 2.2 The pass rate does NOT fall with depth (§13.4's curve is wrong)

§13.4 predicted ~70% at L1 falling to ~45% at L7, and called the falloff *"the right direction: backstabbing a wyrmling should be harder than backstabbing a goblin."*

It does not happen, and the cause is **Steven's own §14.2 rule**. §13.4 was written against a *static* Perception DC. Under an **opposed** roll where the defender may use `max(Stealth, Perception)`, enemy Stealth scales with level exactly as the rogue's does, so the two curves track. Measured against the median same-level enemy:

| | L1 | L2 | L3 | L5 | L7 |
|---|---|---|---|---|---|
| rogue total | +3 | +3 | +4 | +7 | +9 |
| median defender | +3 | +4 | +4 | +6 | +10 |
| **pass rate** | **52.5%** | **47.5%** | **52.5%** | **57.3%** | **47.5%** |

Flat, near 50%. Per §12.2's sweep that is worth roughly **+10 at d4 and +12 at d5** — noise where the party wins anyway, decisive where the fight is close. (Note the wyrmling is a *poor* hider: DEX 12, WIS 14 → +9. The L7 median is +10 because of its neighbours, not the dragon.)

**Steven's call: ship it flat, bend the depth curve in the re-tune.**

### 2.3 A lever the brief never costed — THE MUSTER SEPARATION

§0 established that room *size* re-tunes the game. Implementation found that the **distance between the two muster lines** is a second, sharper lever, and it is aimed specifically at **surface** fights.

`career-distribution` is 480 records of surface quests (it never dispatches a dungeon):

| muster separation | completed | wiped |
|---|---|---|
| shipped (14 × 10 box, sep 10) | 91.3% | 8.8% |
| 20 × 20, sep 10 | 96.0% | 4.0% |
| 20 × 20, sep 12 | 99.8% | 0.2% |
| **20 × 20, sep 14 ← chosen** | **99.8%** | **0.2%** |

The step sits between 10 and 12 and the mechanism is arithmetic: enemies close at 5 units/s, so a 12-unit walk outlasts one 20-tick `attackIntervalTicks` where a 10-unit walk does not — past that threshold the party's casters land a **second free cantrip volley before contact, every fight**. The at-level **dungeon** curve is nearly flat across all three arms (every cell inside ±8) because a dungeon is attritional and a surface quest is one encounter.

**Steven chose 14 (proportional to the old box) knowing the consequence**, with surface difficulty going on the re-tune list. Recorded in the `ARENA` comment so it is inherited deliberately rather than rediscovered.

---

## 3. ⚠ `career-distribution` IS NOW DEGENERATE

```
completionRate 1.0 · wipeRate 0 · failRate 0 · idleWeekRate 0 · ambushDeaths 0
```

Its named assertions are all one-sided floors — `completionRate > 0.5`, `wipeRate < 0.2` — so **nothing fires** to say the surface loop has stopped having teeth. The cause is cumulative: the muster separation, then the AoO fix, then the backstab.

No ceiling assertion was added, because it would fail today and the re-tune has not happened. **Restoring this harness's signal belongs ON the re-tune list, not after it.**

## 3.1 NC6's pooled wipe control was re-anchored (band moved, threshold NOT)

NC6 pools three cells so the low base rate tightens the bar (±3.8 points at n=900/side). That only works while there are wipes to avert. With at-level wipes now 1.0 / 2.3 / 4.7 / 16.3 / 10.0, d1 and d2 have collapsed into a floor: on the old **d1–d3** band the control reads 2.7 vs 4.2 — a 1.5-point delta **inside** the noise bar. On **d3–d5** it reads 10.3 vs 21.8.

**Same threshold (> 4), same n, band moved to where the signal lives** — the same reasoning brief #16 §8 used to put the completion half of this control at d3. Lowering the threshold would have quietly let a negative control assert a difference smaller than the noise floor, which is the one thing the precision rule forbids.

---

## 4. What was built, exactly

**Commit 1 — the room** (`565826e`; 4 src, 2 tests, 4 snapshots)
* `ARENA` 14 × 10 → **20 × 20**, musters at `sideAx 3` / `sideBx 17`.
* `boundToRoom()` in `ai.ts`, applied in `moveTick` after the step and in `placeFormation`. **The clamp is per-axis and that IS the wall-slide** (Steven confirmed slide over hard stop; §3.1 measured it free).
* `CombatField` draws at **one uniform scale** and derives its sheet height from the room. The old code took SX and SY independently from a hard 700 × 520 sheet — invisible only because 14:10 matched it. A square room under two scales would ink as a squashed rectangle while the margin still said `1 SQUARE = 5 FT`.
* `tests/combat/room.test.ts` (new) — reads `Combatant.pos`, **not the event stream**. It cannot use the stream, and that is why the bug survived: `combat.unit_moved` fires at waypoint granularity, so a caster backing away inside its own engage range emits nothing and walks off the sheet in silence.

**Commit 2 — the two correctness fixes** (`65ecfba`; 7 src, 5 tests, 4 snapshots)
* `hasAoo` is now `u.reactions.includes('aoo')` for **both sides**; `buildEnemy` fills `reactions` from `aoo_count`. The trigger needed no work — departure-only is already RAW.
* The conceal chain: `SKILL_ABILITY.stealth = 'dex'` · muster trains Stealth on the rogue · `Combatant` gains `stealth`/`perception` totals (heroes in `assembleHero` beside `engageRange`, enemies from their own ability scores in `buildEnemy`) · `armor_check_penalty` **read for the first time** and folded into Stealth · `rollConceal()` in `strike.ts`, called **once per action** by the encounter loop.
* **It emits no event.** The schema is additive-only and a new type is the last resort; `attack_resolved` already carries `sneakDice` on any swing the check bought, and an extra `reaction_triggered` per rogue action would draw a reaction line on the field every two seconds — a lie about what happened.

### Deliberate gaps, logged not fixed
* ⚠ **`aoo_count: 2` is not modelled as two reactions.** Ruk Mor-Tal gets one per `attackIntervalTicks` like everyone else; PF2E's reaction budget has no home in continuous time yet, and §10.2 measured the boolean.
* ⚠ **Flanking grants sneak damage but NO AC penalty.** `isFlatFooted` returns true when flanked, but `acMod` only reads `isFlatFootedByCondition`. A passed conceal check applies the full PF2E off-guard (−2 AC **and** sneak damage — what §12.2 measured), so the two paths now differ. Fixing flanking would rebalance every fight in the game for a reason nobody stated.
* **Contract floors (84 / 78 / 73) untouched and now slack.** Re-anchoring them upward would be taking §12.4 option (a), which Steven did not choose.

---

## 5. Negative controls — all five observed, restored, and re-verified

| reverted | observed |
|---|---|
| the room bound in `moveTick` | **130 escapes across 40 seeds** — `h0 at (93.25, −3.17)`, `h0 at (−81.36, −25.42)`: nearly five room-widths out, reproducing brief #18 §1 exactly |
| `SKILL_ABILITY.stealth` | `expected 2 to be 4` — the rogue's Stealth silently re-keys from DEX to WIS. §14.3's first named silent failure, caught on a *number*, not an error |
| the muster's `stealth: 1` | `expected undefined to be 1` |
| intrinsic enemy AoO restored | `expected true to be false` — a goblin provokes again |
| the conceal result dropped from `offGuard` | `expected false to be true` |

The Stealth-ranks NC §14.3 demanded by name is in `tests/combat/backstab.test.ts`: a **trained** rogue out-conceals a goblin measurably more often than an untrained one, over n=20,000 rolls, and the gap widens with ranks. No test in that file asserts that a code path runs.

---

## 6. What the re-tune inherits

1. **The surface loop has no teeth** — 99.8% completion, and `career-distribution` cannot report it (§3).
2. **d1–d3 sit at 95 / 91 / 88** against a target of "about 80%", with the contract floors slack beneath them.
3. **The backstab's depth curve is flat**, not falling (§2.2). Bending it means either a defender proficiency term or revisiting the `max(Stealth, Perception)` rule.
4. **The muster separation is a cheap, sharp knob on one-encounter fights specifically** (§2.3).
5. Still costed and unused: brief #14's **Wall 3** (AC proficiency term), **H4**'s `difficultyDcScale`, **R2**'s rest-charge rate.
6. The **ambush DC curve** remains a content fault worth fixing on its own: `detectDc = 12 + difficulty × 2` needs 32 at d5, so `partySurprise` fires 5.3% at d1 and **0% at d3 and d5**.

---

## 7. What #19 deliberately did NOT build

One 20 × 20 room, walls, and nothing else. Ruled out in the brief and **still un-costed** except where noted:

* **Creature size** — deferred in §9 ("future 2×1 and 2×2 creatures"). `enemies` has no `size` column.
* **Line of sight + a fog-of-war overlay** — deferred wanting the overlay, not just the maths.
* **Room features** — pillars, rubble, doorways. Nothing to hide behind exists in a bare box, which is why the backstab had to be a pure skill check with no geometry in it.
* **Reach · cover · difficult terrain** — all ruled OUT. §5 layer 3 calls cover "the largest balance risk in the brief", and cover needs LOS first.

Reopening any of these is a decision, not a drive-by, and each needs its own costing probe.
