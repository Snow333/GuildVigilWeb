# Design Brief #16 — The Dungeon Regression Harness

**Status:** FOR DECISION — nothing implemented. `src/` and `tests/` verified byte-identical after every measurement below. No gameplay code before Steven approves.
**Covers:** queue item 1 — the approved prerequisite. Brief #14 §10.4 and brief #15 §8 both make this the thing that lands before any balance change.
**Authorities:** `core-loop.md`, `decision-ledger.md` Area 3, brief #4 (profile AI), brief #13 (dungeon balance), brief #14 (the three walls), brief #15 (party AI, APPROVED).
**Measured by:** a throwaway probe under `probe/` (scratch vitest config outside `tests/`, deleted before shipping), driving the real `populate()`, `runDungeonDispatch()`, `starterParty()`, `buildAutoLevelUpPlan()`, `applyLevelUp()` and `assembleParty()`. Six measurements, P1–P6.
**Suite at time of measurement:** 420 unit + 10 e2e green, bundle 1,232.52 kB, HEAD `8a63132` (= `origin/main`; the previously-unpushed `d4b3581` is pushed).

---

## 0. The headline

**The harness is cheap, the precision is the problem, and the gear policy is a design decision — not an implementation detail.**

Three measured facts reframe what this brief is about.

1. **Cost is a non-issue.** A dispatch runs in **1.4–4.1 ms**, 12–35× inside the ≤50 ms budget. The full 4 profiles × 4 tiers grid at 300 runs/cell costs **7.0 seconds**. Nothing here needs to be rationed.
2. **Precision is the real constraint.** Two honest measurements of the *same* cell land **30 points apart at 30 runs/cell**, 8.0 apart at 100, and **7.0 apart at 300**. That is the floor on what any threshold can assert. A harness that asserts the 80% contract at 30 runs/cell is not a harness, it is a coin.
3. **The naive gear policy is actively wrong.** "Best available stat at `item_level ≤ party level`" — the obvious reading of "a competently-equipping player" — puts **Full Plate on the wizard and the rogue at level 7** (`max_dex 0`, which deletes the rogue's entire defence) and a Frost Dagger in all four hands. It is not a conservative approximation of a good player; it is a different, worse party.

And one sequencing fact that has to be decided before code:

> ⚠ **The harness lands BEFORE brief #15's milestone, so the 80% contract cannot pass on the day it lands.** Today's at-level curve is **72.0 / 58.0 / 32.0** at d1–d3. The contract is **92.0 / 91.3 / 76.0**. Both numbers are correct; they describe different commits. §7 is the options for that.

---

## 1. What exists today, and precisely what it fails to guard

`tests/dungeon/population.test.ts` (brief #13, new) is the only distribution-level cover `populate()` has ever had, and it is population-only. Everything at dispatch level is uncovered. Confirmed by reading, not assumed:

| harness | what it drives | does it dispatch a dungeon? |
|---|---|---|
| `career-distribution` | `runCampaign` → autopilot → surface combat quests 1/6/100 | **no** — 480 records, 0 dungeon runs |
| `encounter-distribution` | `runEncounter` on hand-authored rosters | **no** — never calls `populate()` or `pickEnemies` |
| `dungeon/population.test.ts` | `populate()` directly | population only; no dispatch |
| `dungeon/dispatch.test.ts` | `runDungeonDispatch` | yes, but **behavioural, not distributional** |

**And one gap nobody has written down yet:** `dispatch.test.ts` hand-writes its `DispatchHero`s as literal combatants (`attackBonus: 7, damageDice: '1d8+3', maxHp: 30, ac: 17`) and passes `partyLevel: 3` as a bare number. **No test in the repo runs a real levelled, real-geared `HeroState` through `assembleHero` into a dungeon.** So the entire path `muster → levelUp → equipment.deriveItem → assembleHero → dispatch` — every line of which brief #15's milestone touches — has zero distribution cover. That path is what this harness must drive.

---

## 2. Cost — measured, and it changes the design (P1, P5)

Per-dispatch wall clock, `fullExplore`/`standard`, at-level, starter gear:

| tier | difficulty | party L | **ms / dispatch** |
|---|---|---|---|
| tiny | 1 | 1 | 4.13 (includes JIT warm-up) |
| small | 3 | 3 | 2.48 |
| medium | 5 | 5 | 1.94 |
| **large** | 7 | 7 | **1.41** |

**Cost falls as the dungeon gets bigger** — the inversion is the walls: at d7 the party is dead or turned around after 4.0 of 24 rooms, so a `large` dispatch resolves less work than a `tiny` one that runs to completion. Useful side effect: **the harness gets more expensive as the game gets better**, which is the right direction for a regression gate but is worth knowing before the milestone lands and the numbers move.

By profile (tiny d1 L1): `fullExplore` 1.60 · `bossRush` 1.13 · `lootRun` 1.35 · `mysteryHunt` 0.65 ms. `assembleParty` is 0.053 ms/call, so rebuilding a fresh party per run is free — the harness does **not** need to clone combatants by hand.

**The grid, measured end to end:** 4 profiles × 4 tiers × 100 runs = 1,600 dispatches in **2.3 s**. Extrapolated: **7.0 s at 300 runs/cell.**

The current suite is 20.6 s. There is no cost argument against measuring properly here.

---

## 3. Precision — the number that actually governs the design (P3)

Eight independent blocks of the same cell (tiny d2 L2, `fullExplore`, starter gear), varying only the seed prefix:

| runs/cell | blocks | min | max | **spread** | mean |
|---|---|---|---|---|---|
| 30 | 8 | 36.7% | 66.7% | **30.0** | 50.0% |
| 50 | 8 | 42.0% | 60.0% | 18.0 | 52.8% |
| 100 | 8 | 48.0% | 56.0% | **8.0** | 53.1% |
| 200 | 8 | 49.0% | 59.5% | 10.5 | 53.9% |
| 300 | 8 | 51.7% | 58.7% | **7.0** | 56.7% |

The arithmetic agrees: at n=300 and p≈0.55 the standard error is 2.87 points, so a *difference* between two independent measurements carries ±8 points at 95% confidence. **The observed 7.0-point spread is the honest noise floor, not a fluke of these eight blocks.**

Three consequences, and they are the whole design:

1. **The grid does not need precision — it needs reproducibility.** It is seed-pinned and deterministic, so `toMatchSnapshot()` is byte-exact regardless of n. **100 runs/cell is sufficient for the grid**, and it costs 2.3 s.
2. **The curve does need precision, because it carries a threshold.** A threshold must sit ~7 points below the measured value or it will fire on an honest re-seed. **300 runs/cell for the curve cells.**
3. **No assertion may claim a difference smaller than ~8 points.** This retires a temptation directly: several gear-policy variants in §5 differ by 5–6 points, and the brief does **not** claim those are real.

---

## 4. Calibration — the instrument agrees with brief #15 (P2)

Before measuring anything new, the probe reproduces brief #15 §10.3's `shipped` column independently (300 runs, `fullExplore`/`standard`, starter gear, party levelled through the autopilot's own plan):

| cell | brief #15 "shipped" | **this probe** | Δ |
|---|---|---|---|
| tiny d1 · L1 | 71.7% / 12.7% wiped | **72.0% / 12.7%** | +0.3 / 0.0 |
| tiny d2 · L2 | 54.0% / 23.0% | **58.0% / 20.3%** | +4.0 / −2.7 |
| tiny d3 · L3 | 28.7% / 44.3% | **32.0% / 42.7%** | +3.3 / −1.6 |
| small d4 · L4 | 5.0% / 48.3% | **5.0% / 40.7%** | 0.0 / −7.6 |

Every delta sits inside the §3 noise floor. **The instrument measures the same thing brief #15 measured** — which is the precondition for the harness being allowed to assert brief #15's numbers at all.

Also captured per cell, and worth snapshotting because they diagnose *why* a number moved rather than just that it did: boss-defeated rate (82.7% → 71.3% → 45.0% → 18.0%), rooms visited (6.6 → 6.2 → 5.5 → 5.3), sealed routes per run (**0.07 → 0.14 → 0.22 → 0.88**). That last column is wall 2 arriving on schedule.

---

## 5. The gear policy

### 5.1 Why the obvious policy is wrong (P4)

Implemented literally — best `ac_bonus + min(dex, max_dex)` in the armour slot, best expected damage in the main hand, everything at `item_level ≤ party level`:

| level | what it equipped |
|---|---|
| L1 | **Studded Leather on all four**, Greatsword (fighter), **Crossbow on the wizard and the rogue** |
| L7 | **Full Plate on all four** — including the rogue (dex +3) and the wizard — and a **Frost Dagger in every hand** |

Full Plate is `max_dex 0`. Putting it on the rogue deletes three points of AC the rogue's whole build is paying for. This is not a pessimistic-but-safe approximation; it is a party no player would field, and a baseline built on it would be measuring fiction.

**Three structural reasons it goes wrong, all confirmed in the code:**

* **`item_level` is dead data.** Nothing in `src/` reads it. Gating on it is a rule the *harness* invents, not one the game enforces.
* **`class_weapon_proficiency` (44 rows) is exported, counted in the manifest, and read by nothing.** `assembly.ts:194` uses the class proficiency tier, never the weapon. Any hero may wield any weapon at full attack bonus. Nothing stops the wizard taking a greatsword except the policy.
* **`armor_check_penalty` is also never read**, so the only columns that matter are `ac_bonus` and `max_dex` — which is exactly why bug A makes Full Plate +3 (ac 7) strictly worse than mundane Full Plate (ac 8), and why the whole Chain Mail line (25 → 129 → 151 → 153) is mechanically **identical** at ac 5 from 55 gp to 825 gp.

### 5.2 The recommended shape: a bracket table, as data (P6)

A hand-authored rung table per class, gated on character level — the seam Steven asked for, in the form he asked for it:

```ts
interface Rung { minLevel: number; armor: number | null; weapon: number }
const GEAR_BRACKETS: Record<number, Rung[]>   // keyed by classId
```

What it equips, and what the party becomes:

| | L1 | L4 | L7 |
|---|---|---|---|
| Torvald (F) | Chain Mail + Longsword · ac 16 | Half Plate + Longsword +1 · ac 17 | Full Plate + Longsword +2 · **ac 18, atk +12** |
| Shade (R) | Leather + Rapier · ac 15 | Chain Shirt + Rapier +2 · ac 17 | Chain Shirt + Rapier +2 · ac 17 |
| Mira (C) | Scale Mail + Mace · ac 15 | Chain Mail + MW Mace · ac 15 | Full Plate + Mace +2 · ac 18 |
| Elandra (W) | Staff · **ac 12** | Studded Leather + Dagger +2 · ac 15 | Studded Leather + Dagger +2 · **ac 15** |

**The table deliberately excludes every `striking_tier > 0` row** (ids 145/146/147/166/168), because those rows are bug B and derive at 1.5× their authored damage:

| id | name | authored | `striking_tier` | **derived** |
|---|---|---|---|---|
| 145 | Striking Longsword +2 | `2d8` | 1 | **`3d8`** |
| 146 | Striking Greatsword +2 | `2d12` | 1 | **`3d12`** |
| 147 | Striking Longbow +2 | `2d8` | 1 | **`3d8`** |
| 166 | Dreadblade | `2d8` | 1 | **`3d8`** |
| 168 | Lifedrinker Axe | `2d12` | 1 | **`3d12`** |

Excluding them keeps bug B out of the *first* baseline. When the milestone fixes B, the bracket gains the striking rungs and the snapshot moves for a stated reason. (Nothing currently derives any of these five items in any test — `tests/heroes/equipment.test.ts` only exercises `applyStriking` in isolation, which is why B survived.)

### 5.3 What gear is worth, measured (P6b, 300 runs/cell)

| at level | starter gear | **bracket** | bracket, wizard in chain shirt |
|---|---|---|---|
| tiny d1 · L1 | 74.0% / 12.3% wiped | 71.7% / 15.0% | 75.3% / 9.3% |
| tiny d2 · L2 | 54.7% / 22.0% | **65.3% / 12.7%** | 71.0% / 10.0% |
| tiny d3 · L3 | 26.7% / 43.0% | **37.3% / 26.3%** | 45.7% / 23.7% |
| small d4 · L4 | 4.7% / 49.7% | 9.3% / 36.7% | 9.0% / 37.7% |
| small d5 · L5 | 6.7% / 41.0% | 10.0% / 30.0% | 7.3% / 29.0% |

> ⚠ **CORRECTED at implementation (§12.1).** The row above reads "+10.6 points at d2 and d3". Re-measured on the harness's own seeds, the d2 figure is **+1.3** — it was seed-selection luck, caught by the noise floor this brief spends §3 establishing. **The corrected numbers are +0.3 (d1), +1.3 (d2), +12.3 (d3).** The conclusion below is rewritten accordingly; the table is left as measured.

**Read honestly against the §3 noise floor (corrected):**

* **Gear is worth nothing measurable at d1 and d2** (+0.3 and +1.3) and **a great deal at d3** (+12.3 completion, and wipes **42.0% → 25.7%**). The coherent reading: at d1–d2 the wedge wins comfortably either way and gear is slack; at d3 the fight is close enough that gear decides it.
* **Gear buys survival before it buys completion.** Pooled across d1–d3 the completion delta is +4.7 against a ±4.6 bar — marginal — while the wipe-rate delta is **−7.4 against a ±3.8 bar**. The wipe rate is the more sensitive instrument here, because its lower base rate tightens the interval.
* **The wizard-armour variant is NOT significant at n=300** (+5.7 at d2, +8.4 at d3, both at or under the bar). It is *suggestive* — Elandra is AC 12 and brief #15 measured the backline taking 65% of incoming — but this brief will not claim it. It is a §10 open call, not a finding.
* **Gear does nothing at d5–d6** (6.7% → 10.0%, and separately 0.3% → 0.7% at medium d6). This is brief #14 §10.3's "the fixes multiply, they do not add" seen from the other side: brief #14 measured gear at d6 as 4.7% → 36.0%, but *on top of* H4+R2+AC. **Gear's value is conditional on the walls being fixed** — which is the strongest possible argument for the milestone landing as one commit.

---

## 6. The proposed shape

Two new test files plus one data module. Single-responsibility, per house style — the grid and the contract are different jobs.

**`tests/harness/gearBrackets.ts`** — the bracket table and a `partyAt(level, bracket)` builder. Plain `.ts`, not `.test.ts`, so vitest's `tests/**/*.test.ts` glob does not collect it. This is the seam: it exports a provider signature so a richer party-bracket source can replace the table later without touching either test.

**`tests/harness/dungeon-distribution.test.ts`** — the dispatch-level half `population.test.ts` left missing.

* 4 profiles × 4 tiers, at-level, **100 runs/cell**, exact snapshot.
* Per cell: completed / retreated / wiped / bossDefeated / roomsVisited / sealedRoutesPerRun / p50 ticks.
* Always-on invariants that do not depend on balance: every run terminates; zero `decisionBudget` retreats; `sealedRoutes` equals the stream's `explore.route_blocked` count; no run reports `completed` with `bossRoomSealed`; `mysteryHunt` completions always carry `clueSecured`.
* Measured cost: **2.3 s**.

For reference, the grid as it stands today (100/cell, at-level, starter gear) — this is what the first baseline records:

| profile | tiny | small | medium | large |
|---|---|---|---|---|
| fullExplore | 80% | 15% | 1% | 0% |
| bossRush | 88% | 46% | 13% | 0% |
| mysteryHunt | **97%** | 62% | 30% | 5% |
| lootRun | 64% | 48% | 17% | 1% |

The profile spread at `tiny` (97% down to 64%) is itself worth pinning — nothing currently guards it, and brief #15's `engageRange` change touches every one of those cells.

**`tests/harness/dungeon-curve.test.ts`** — the 80% contract.

* At-level cells d1–d3 (plus d4/d5 recorded, not gated), **300 runs/cell**, under the **bracket** gear policy.
* Punch-up cells: party L1 into d2, L2 into d3, L3 into d4 — asserting the *gradient*.
* Measured cost: **~6 s**.

Suite impact: 20.6 s → **~29 s**. Acceptable; a knob (`GV_HARNESS_N`) can drop it for local iteration without changing what CI runs.

---

## 7. ⚠ The sequencing problem — the one thing that needs deciding first

The harness lands before the milestone. So on the day it lands:

| | today (measured) | contract (brief #15 §11.1) |
|---|---|---|
| d1 · L1 | 72.0% / 12.7% | **92.0% / 2.0%** |
| d2 · L2 | 58.0% / 20.3% | **91.3% / 4.3%** |
| d3 · L3 | 32.0% / 42.7% | **76.0% / 13.0%** |

**A harness that asserts the contract is red the moment it is written. A harness that asserts today's numbers has no contract in it.** Three ways out:

| id | approach | cost | risk |
|---|---|---|---|
| **S1** | One named `CONTRACT` table with a `phase` marker (`preMilestone` / `target`). The harness asserts the active phase's floors. **Brief #15's commit flips one constant.** | one exported const + a one-line diff at the milestone | the gate is only as honest as the flip; must be called out in the milestone commit message |
| S2 | Assert only *shape* now — monotone decline across d1→d3, punch-up gradient negative, wipe ceiling — and add absolute floors with the milestone | smaller now | ships a harness with no absolute number in it, which is most of what Steven asked for |
| S3 | Write the contract assertion now and mark it skipped until the milestone | trivial | a skipped test is a test nobody reads; this is how the 24-week career harness stayed green through 922 failed dispatches |

**Recommended: S1.** It puts both number sets in one reviewable place, makes the milestone's obligation explicit and mechanical, and — the deciding reason — it means the milestone commit *cannot* land without someone consciously moving the contract, which is exactly the discipline brief #14 §10.4 asked for.

Threshold placement under S1, derived from the §3 noise floor (target − 7 points for completion, target + 7 for wipes):

| | preMilestone floor | target floor (flipped by the milestone) |
|---|---|---|
| d1 · L1 | ≥ 65% completed, ≤ 20% wiped | **≥ 85% completed, ≤ 9% wiped** |
| d2 · L2 | ≥ 51%, ≤ 28% | **≥ 84%, ≤ 11%** |
| d3 · L3 | ≥ 25%, ≤ 50% | **≥ 69%, ≤ 20%** |

The punch-up gradient asserts **sign and minimum magnitude** (punching up one level must cost at least 10 points), not the measured −20 / −37 / −57 — those are snapshot territory, because a ±8 bar cannot hold a −20 to two significant figures.

---

## 8. Negative controls

Per the standing invariant, every regression test gets one. These are the reverts the implementation will run, observe, and report:

| # | revert | must break |
|---|---|---|
| NC1 | `objectiveComplete()` drops `!bossRoomSealed()` | grid invariant: sealed-boss runs reporting `completed` goes above 0 |
| NC2 | `HAZARDS.difficultyDcScale` 2 → 3 | grid: `sealedRoutesPerRun` rises at medium/large; medium completion falls |
| NC3 | `ENCOUNTERS.bossLevelBonus` 1 → 2 | grid: boss-defeated rate and p50 ticks both move (brief #13 Q1) |
| NC4 | `pickEnemies` re-draw reverted to `break` | grid: combat-room enemy counts fall (brief #13 Q3) |
| NC5 | rest-charge locality check removed (= R1) | grid: `large`/`medium` completion rises — proves the harness sees rest-economy changes at all |
| **NC6** | **gear provider swapped to starter gear** | **curve: d2/d3 completion falls ~10 points** |

**NC6 is the one that matters most and the one a normal review would skip.** If the harness silently fails to equip — a mistyped item id, a bracket that never matches, `equipped` overwritten downstream — the result looks exactly like a healthy green baseline, because a permanently-unequipped party is precisely the thing this harness exists to stop measuring. Without NC6 the gear policy is decoration.

---

## 9. Risks and watch points

* **This is `tests/`-only. No `src/` change, no new module under `src/`, so the casing trap does not apply** — but it adds files, so a `pnpm dev` confirmation on Windows is still cheap insurance.
* **The bracket lives in `tests/`, not `src/`.** That is deliberate: Steven's call is that the autopilot never auto-equips and gearing is a player pleasure. Putting a gear-scoring function in `src/` would be the first step toward the thing he declined. If the paper-doll screen later wants a "recommended" marker, that is its own brief and it can import the table upward.
* **The shop cannot supply this bracket, and that is a real content finding, not a harness problem.** `session.shopStock()` hard-skips every row with `required_building_level > 1` (building levels are unimplemented), which is **53 of 105 rows** — and *every armour row in the game* is behind that gate. The shop today sells 12 mundane weapons, a buckler, a wooden shield, consumables and scrolls. **A player cannot currently buy any armour at all.** The bracket therefore models a player who is *looting* well, not shopping well. Worth its own line in the queue.
* **`item_level` gating is a harness invention.** Nothing in the game reads that column. If it later becomes load-bearing, the bracket and the game must be reconciled deliberately.
* **The first baseline encodes bug A.** Full Plate is the best armour in the game at ac 8 and every magical armour row is inert, so the L7 bracket picks mundane Full Plate. When bug A lands, armour potency starts working and the curve moves again. Expected, and the milestone commit must say so.
* **Snapshots will move at the milestone — twice, deliberately.** `encounter-distribution` and `career-distribution` (brief #15 §11.3) plus both new dungeon baselines. Four moving baselines in one commit is a lot to review; the commit message needs to name each one and why.
* **Determinism holds.** Every cell is seed-pinned; the probe reproduced identical numbers across re-runs. The §3 spread is across *different* seed prefixes, which is the right thing to measure for threshold placement and the wrong thing to worry about for snapshot stability.

---

## 10. What I need from you

1. **§7 — S1, S2 or S3?** This is the blocking one. S1 recommended: one `CONTRACT` table, phase-marked, flipped by the milestone commit.
2. **The wizard's bracket — flavour or stats?** Robes/Studded Leather (ac 15 at L7) or the chain shirt the sim will happily allow (ac 17)? Measured at +5.7 / +8.4 points of completion at d2/d3 — **suggestive but inside the noise floor at 300 runs**, so I can re-measure at 1,000 runs/cell (~20 s of probe time) before you decide, if you want the call made on a number rather than on taste.
3. **Run counts — 100 grid / 300 curve, taking the suite 20.6 s → ~29 s?** Or tighter. The grid is snapshot-exact so its n only affects cost; the curve's n *is* the precision of the contract.
4. **Does the bracket ship with the striking rows excluded?** Recommended yes, so the first baseline does not encode bug B — with the rungs added back by the same milestone that fixes it.

Nothing else in this brief needs a decision; §§1–6 and 8–9 are measurement and structure.

---

## 11. Decision record — 2026-08-13 (Steven)

| decision | call |
|---|---|
| §7 the contract gate | **S1** — one phase-marked `CONTRACT` table; brief #15's milestone flips `PHASE` to `'target'` |
| Wizard's bracket rung | **Flavour** — robes and light armour. Backline exposure is a positioning problem, not an armour problem |
| Run counts | **100 grid / 300 curve** |
| Striking rows in the bracket | **Excluded**, added back by the milestone that fixes bug B |

**Also raised by Steven, logged not actioned:** *"we should have the melee characters in the party attempt to interdict the melee attacks."* This is a **new mechanic and wants its own brief.** It is mechanically distinct from the threat mechanic held in brief #15 §2 — threat changes target *selection* (and measured −3.5 completion / +8.5 wipes because the fighter has no mitigation), whereas interdiction changes *reachability*, so the "tank has no survivability" result does not automatically transfer. Brief #15 §10.2 already has the adjacent measurement: repositioning alone (C2) was catastrophic, repositioning plus a ranged option (C3) took hero deaths 686 → 156. Interdiction is a third point in that space and can be costed with the same probe. **Not folded into this milestone** — that milestone already carries six changes.

---

## 12. What the implementation found

Built and green: 3 files (`tests/harness/gearBrackets.ts`, `dungeon-distribution.test.ts`, `dungeon-curve.test.ts`), **436 unit + 10 e2e**, suite 20.6 s → **33.2 s**. `src/` byte-identical throughout — this milestone is `tests/`-only.

### 12.1 The harness corrected this brief on its first run

NC6 was written to assert the bracket beats the founding kit "at d2 and d3", on the strength of §5.3's +10.6/+10.6. On the harness's own seeds it failed at d2: **58.7% vs 57.3%, a delta of 1.3.** The d3 delta held at **+12.3**.

This is the §3 noise floor doing exactly what it was measured for, and it caught the brief's own author. The control now sits where the signal is — d3 completion, plus the pooled wipe rate across d1–d3 — and NC6's comment records the correction so the next reader does not re-derive the wrong number.

### 12.2 A finding: `lootRun` still reports CLEARED with the boss chamber sealed

The first grid run tripped an invariant written as "no profile completes with a sealed boss chamber". The invariant was too broad, not the code: brief #13 Q2's `!bossRoomSealed()` clause was approved into the **`fullExplore` case only**. `lootRun` completes on value collected, so a sealed boss door does not stop it — measured at **1 run in 100 at both `tiny` and `small`**.

Defensible on its own terms: the party went in for loot and came out with loot. But it is the same *shape* as the lie brief #13 fixed — a run reporting success with the climax untouched — so rather than assert it away, the count is now a snapshot field (`completedWithSealedBoss`) on **every** cell, and the assertion is scoped to `fullExplore` exactly as approved. `bossRush` gets its own assertion because there the zero is structural, not policy.

**This is a decision for Steven, not for the harness.** Options, roughly: leave it (a loot run is honest about its own objective), extend the `!bossRoomSealed()` clause to `lootRun`/`mysteryHunt` (consistent, but fails runs that met their stated goal), or surface it in the after-action without failing the run (the `sealedRoutes` return field already carries it — this may be purely a UI question). Not urgent at 1%.

### 12.3 Negative controls — observed, not asserted

All five reverts were applied to `src/`, the harness run, the failures recorded, and `src/` restored and verified byte-identical.

| # | revert | observed failures |
|---|---|---|
| NC1 | `objectiveComplete()` drops `!bossRoomSealed()` | **3** — the `fullExplore` sealed-boss invariant, plus both baselines |
| NC2 | `difficultyDcScale` 2 → 3 | **3** — **THE CONTRACT floor**, plus both baselines |
| NC3 | `bossLevelBonus` 1 → 2 | 2 — both baselines |
| NC4 | `pickEnemies` re-draw → `break` | 2 — both baselines |
| NC5 | rest-charge locality removed (= R1) | 2 — both baselines |
| NC6 | gear provider → founding kit | **built in as a permanent test**, not a one-off revert |

**Worth saying plainly: NC3, NC4 and NC5 are caught by the exact snapshots alone.** No named invariant fires for them. That is the correct design — generation changes should move a baseline rather than trip a floor, and NC5 is an *improvement*, which no floor should ever reject — but it means the snapshots are load-bearing in a way a careless `-u` would silently defeat. The standing rule (re-baseline consciously, justify in the commit) is what protects those three, and there is no mechanical substitute for it.
