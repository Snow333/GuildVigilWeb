# Design Brief #14 — The dungeon_level 5+ Wall

**Status:** **DECIDED 2026-08-12 · APPROVED HALVES SHIPPED 2026-08-13** inside brief #15's milestone. Decision record §9. R2, H4 and bugs A/B are in; the wall-3 AC term was NOT taken and remains a costed option.
**Covers:** queue item 1 — "dungeon_level 5+ looks unwinnable, and it's gear, not levels."
**Authorities:** `core-loop.md`, `decision-ledger.md` Area 3, brief #4 (profile AI), brief #13 (dungeon balance), brief #8 (UI grammar, normative for anything that reaches the screen).
**Measured by:** a throwaway probe (`probe/`, deleted before ship) over the real `populate()`, `runDungeonDispatch()`, `assembleParty()` and `CampaignSession`. Every number below is measured. Where an option required changing dispatch logic to cost it, a **patched copy** lives in `probe/variant/` — `src/sim/dungeon/dispatch.ts` was never touched and is verified byte-identical.
**Suite at time of measurement:** 420 unit + 10 e2e green, bundle 1,232.52 kB, HEAD `7346735` with brief #13's seven files uncommitted in the working tree.

---

## 0. The headline

**The hypothesis is refuted. It is not gear, and it is not levels.** Best-case gear at difficulty 7 moves completion from **0.0% to 0.0%**. Party levels 8 through 11 are all 0.0%. Giving every hero +5 AC on top of best-case gear *and* fixing the rest economy is **still** 0.0%.

There are **three independent walls**, with three different mechanisms and three different onsets. They have looked like one wall because `dungeonTierFor()` ties difficulty to dungeon *size*, so a high-`dungeon_level` quest is automatically a 24-room dungeon, and all three arrive together.

| # | wall | mechanism | onset | measured |
|---|---|---|---|---|
| **1** | **Attrition over length** | rest charges are created and then unreachable | **tier `medium`, at any difficulty** | at difficulty **2**, completion falls 70% (tiny) → **2%** (large) |
| **2** | **Sealed routes** | `hazardDc` includes `floor(partyLevel/2)`; the party's own growth raises the DC | **difficulty 6** | impossible locks 0% at d≤5 → 6.6% at d6 → **37.9% at d7** → 56.1% at d8 |
| **3** | **Defensive arithmetic** | AC has no level term; the attack roll does | **difficulty 5** | wedge AC is **16 at level 1 and 16 at level 11**; hit on 3–4+ (88–93%) at d7, every level |

Gear is a real but **fourth and minor** channel: it converts wipes into retreats and never converts either into a completion.

> ⚠ **CORRECTED 2026-08-12 by §10.** That last sentence is true *in isolation* and wrong *in combination*. Once the doors open and rests work, **gear becomes the single largest lever** — at difficulty 6 it takes completion 4.7% → 36.0%. Every measurement in §2–§5 holds; the conclusion about gear's rank does not. Read §10 before acting on §7's ordering.

---

## 1. The instrument

**The party is the game's own.** `starterParty()` → `buildAutoLevelUpPlan()` → `applyLevelUp()` → `assembleParty()`. No invented sheets: the four founding heroes levelled through the autopilot's exact path, spending the registry's own skill-point budget and taking the class key-ability boost at 5/10/15/20.

**Three layers, measured separately.** Pure `populate()` over the whole shipped pool (24 templates × 60 seeds) for hazards and rooms; real `runDungeonDispatch()` for outcomes (100–150 runs per cell); and real `CampaignSession` autopilot campaigns (12 × 156 weeks) to confirm the controlled runs against live play.

**Calibration against a green baseline.** The probe reproduces `career-distribution`'s snapshot independently: measured avg final level **2.00** (snapshot `avgFinalLevelX100: 200`), gold **2775** (snapshot `goldP50: 2820`), stash items **0.0** (snapshot `itemsP50: 0`). The instrument agrees with the baseline the repo already trusts.

**One correction made mid-measurement, recorded because it nearly reached this brief.** A first pass reported 80–100% wipe rates in live campaigns. That was a probe bug: `QuestRecord.outcome` is `'completed' | 'failed' | 'wiped' | 'ambushKilled'` — a dungeon *retreat* surfaces as `'failed'`, and the probe's `else` branch counted it as a wipe. Corrected, live campaigns reconcile with the controlled runs to within a few points. The numbers below are post-correction.

---

## 2. Wall 1 — attrition over length

### The decisive experiment

`dungeonTierFor()` maps difficulty → tier, so difficulty and size always move together. Holding them apart is the whole finding.

**Difficulty held at 2** — enemies a level-3 wedge crushes — **tier varied**, 100 runs each, starter gear:

| tier | rooms | completed | retreated | wiped | boss | rooms visited |
|---|---|---|---|---|---|---|
| tiny | 7 | **70.0%** | 17.0% | 13.0% | 80.0% | 6.6 |
| small | 10 | 54.0% | 34.0% | 12.0% | 66.0% | 8.3 |
| medium | 16 | 17.0% | 63.0% | 20.0% | 34.0% | 10.9 |
| large | 24 | **2.0%** | 66.0% | 32.0% | 18.0% | 12.5 |

Same party. Same enemies. Only the dungeon got longer, and completion fell 68 points. Rooms visited plateaus near **12.5 of 24** — the party is not being killed, it is running out of hit points about halfway through and walking home.

### The mechanism, precisely

`dispatch.ts` line ~344:

```ts
if (frac < caution.withdrawHpFrac) {
  if (restAvailable.has(current)) {      // <- must be STANDING IN the rest room
```

`restAvailable` is a `Set<number>` of *node ids*. A charge is banked when a shrine is activated or the boss room is cleared, and it is spendable **only if the party happens to be standing in that exact room at the moment party HP crosses the withdraw threshold.** Otherwise the run retreats with the charge still in the set.

Measured, 150 runs per cell — charges created vs charges actually spent:

| cell | charges created / run | rests taken / run | **unspent** | retreat reasons |
|---|---|---|---|---|
| tiny · d2 · L3 | 1.31 | 0.05 | **1.26** | completed 71%, wiped 14%, doctrine 8%, objectiveFailed 7% |
| large · d2 · L3 | 1.13 | 0.05 | **1.07** | doctrine 52%, wiped 27%, objectiveFailed 13%, completed 8% |
| medium · d5 · L6 | 0.43 | 0.02 | 0.41 | wiped 34%, doctrine 34%, objectiveFailed 31% |
| large · d7 · L8 | 0.17 | 0.00 | 0.17 | wiped 44%, objectiveFailed 33%, doctrine 23% |

**96% of the healing in the game is banked and unspendable.** The dungeon is effectively a single HP pool with no recovery, so length alone is a hard difficulty axis nobody tuned.

### The options, costed

Measured on the patched copy, 150 runs per cell, `fullExplore` / `standard`. `R0` is shipped behaviour.

| option | small d3 L4 | medium d5 L6 | **large d2 L3** | large d7 L8 |
|---|---|---|---|---|
| **R0 shipped** (must stand in it) | 24.7% | 0.7% | **5.3%** | 0.0% |
| **R1 rest anywhere** (drop the locality check) | 34.0% | 1.3% | **16.7%** | 0.0% |
| **R2 anywhere + 1 charge per 4 rooms cleared** | **40.7%** | **4.0%** | **28.7%** | 0.0% |
| R3 anywhere + 1 per 3 rooms | 36.7% | 1.3% | 25.3% | 0.0% |
| R4 anywhere + `restHealFrac` 0.5 → 0.75 | 36.7% | 2.0% | 22.7% | 0.0% |
| R5 anywhere + 1 per 4 + heal 0.75 | 36.7% | 4.0% | 29.3% | 0.0% |

**R2 is the knee.** On `large` at difficulty 2 it takes completion 5.3% → **28.7%**, rooms visited 12.6 → **16.4**, boss defeated 20.7% → **44.0%**, at 1.02 rests per run. R3 (more charges) is *worse* than R2 — the party pushes deeper and dies, wipe 43.3% → 50.7%. Raising the heal fraction is strictly weaker than granting charges.

**None of them touch difficulty 7.** That is wall 2 and wall 3.

---

## 3. Wall 2 — the hazard DC outruns the party by construction

`population.ts`:

```
DC = 10 + 2·difficulty + tierBonus + floor(partyLevel/2) + roomDcMod + jitter(±2)
```

**The party's own level is a term in the DC.** Party skill grows about **+1 per level** (rank, capped at character level, plus a static ability mod). The DC grows **+0.5 per level** from `floor(partyLevel/2)`. So levelling buys ~0.5 net headroom per level — while each difficulty step costs **+2** and each tier step **+1**, and the content moves both together (`dungeon_level ≥ min_level`). The party can never catch up. This is the direct reason "levelling does not rescue deeper dungeons."

`openLock` and `disarmTrap` declare a check **impossible** when `20 + mod < dc` — a natural 20 cannot pass. Measured over the whole shipped pool, 24 templates × 60 seeds:

| tier | diff | party L | best thievery | best athletics | **impossible locks** | **impossible traps** |
|---|---|---|---|---|---|---|
| tiny | 2 | 3 | 7 | 6 | 0.0% | 0.0% |
| small | 4 | 5 | 10 | 9 | 0.0% | 0.0% |
| medium | 5 | 6 | 11 | 10 | 0.0% | 0.0% |
| medium | 6 | 7 | 12 | 11 | **6.6%** | 2.7% |
| large | 7 | 8 | 13 | 12 | **37.9%** | **20.5%** |
| large | 8 | 9 | 14 | 13 | **56.1%** | 40.0% |
| large | 2 | 3 | 7 | 6 | 0.0% | 0.0% |

At difficulty 7 **more than a third of every door in the dungeon is mathematically sealed.** That is why rooms visited collapses to 4.1 of 24, and why `objectiveFailed` is 33% of outcomes — brief #13's `!bossRoomSealed()` is now correctly reporting that the boss chamber is behind an unopenable door. **Brief #13 did not cause this; it made it visible, exactly as intended.**

Note the interaction: the last row shows difficulty 2 on `large` has **zero** impossible checks. Wall 2 is purely a difficulty phenomenon; wall 1 is purely a size phenomenon. They are cleanly separable.

### The options (not yet costed by simulation — these need your steer first)

| option | change | cost | risk |
|---|---|---|---|
| **H1** | drop `floor(partyLevel/2)` from `hazardDc` | one term in one function | DCs stop tracking the party at all; low-difficulty dungeons get easier. Cheap to measure. |
| **H2** | cap the DC at what the party can actually reach (`20 + bestMod − k`) | small, in `population.ts` | makes "impossible" impossible by construction; removes a designed failure mode |
| **H3** | give skills a proficiency term the way attacks have one | touches `assembleHero` | the honest structural fix; largest blast radius |
| **H4** | lower `difficultyDcScale` 2 → 1 | one number in `content/dungeon.ts` | pure data, no code, trivially reversible; halves the per-difficulty cost |
| **H5** | leave it — sealed routes are the intended texture — and fix only the *objective* so a sealed boss doesn't fail the run | reverts part of brief #13 Q2 | you approved report-AND-fail eight hours ago; this would undo it |

**H4 is the cheapest thing that could possibly work and it is data, not code.** I would want to measure H1 and H4 before you choose.

---

## 4. Wall 3 — AC has no level term

### The arithmetic

`assembleHero`: `ac = 10 + gear.acBonus + dexToAc + itemStat.ac`.

There is **no proficiency term**. Compare the attack roll one block above it: `totalProficiency(hero, 'weapon_attack') + atkMod + weapon potency` — which does scale, at `floor(level/2) + 1 + tierBonus`.

So offence keeps pace with the enemy ladder and defence is frozen at level 1:

| level | Torvald | Shade | Mira | Elandra |
|---|---|---|---|---|
| 1 | AC 16 / +4 | AC 15 / +4 | AC 15 / +2 | AC 12 / +0 |
| 5 | AC 16 / +9 | AC 16 / +9 | AC 15 / +6 | AC 12 / +2 |
| 8 | AC 16 / +11 | AC 16 / +11 | AC 15 / +8 | AC 12 / +6 |
| **11** | **AC 16** / +13 | **AC 16** / +13 | **AC 15** / +9 | **AC 12** / +7 |

AC moves by **one point across ten levels**, and only because the rogue's dex boost clears the leather's `max_dex` cap. Against the difficulty-7 enemy band (avg AC 18.7, avg attack +12.5):

| party level | Torvald hits on | Torvald **is hit on** |
|---|---|---|
| 7 | 9+ (61%) | **4+ (88%)** |
| 9 | 8+ (66%) | **4+ (88%)** |
| 11 | 6+ (76%) | **4+ (88%)** |

Mira is hit on 3+ (93%), Elandra on anything. **This is why levelling does nothing:** every level makes the party better at hitting and no better at not being hit.

### Costed — and it is not sufficient on its own

Adding `baseProficiency(level)` to AC (the same base the attack roll gets), 150 runs per cell:

| cell | shipped | +half prof | +full prof (AC 20–21) | with R2 rest fix + full prof |
|---|---|---|---|---|
| medium d5 L6 | 2.0% | 3.3% | 1.3% | **5.3%** |
| medium d6 L7 | 0.0% | 0.7% | 0.0% | 0.0% |
| large d7 L8 | 0.0% | 0.0% | **0.0%** | **0.0%** |
| large d8 L9 | 0.0% | 0.0% | 0.0% | 0.0% |

Torvald at **AC 21** with the rest economy fixed still completes **0.0%** of difficulty-7 dungeons, because wall 2 has already sealed a third of the doors. **Wall 3 cannot be tested honestly until wall 2 is dealt with.** That ordering matters for how you sequence the work.

---

## 5. Gear — what it actually does, and two contract bugs found on the way

### Gear moves wipes into retreats and nothing else

Difficulty 7 / large, 100 runs per cell. `V5` is the best AC *and* best weapon the content offers at that level.

| variant | L8 completed | L8 wiped | L11 completed | L11 wiped |
|---|---|---|---|---|
| V0 starter (never re-equipped) | 0.0% | 57.0% | 0.0% | 48.0% |
| V5 best AC + best weapon | **0.0%** | **30.0%** | **0.0%** | 28.0% |

Halving the wipe rate is worth having. It is not the wall.

### Bug A — armour enchantment is completely inert

`deriveItem` reads `ac_bonus` for AC and puts the row's `potency_bonus` into `attackBonus`, which `equippedGear` only ever reads for weapons. Measured:

| item | level | row potency | **derived AC bonus** |
|---|---|---|---|
| Chain Mail | 2 | 0 | 5 |
| Masterwork Chain Mail | 3 | 0 | 5 |
| Chain Mail +2 | 6 | 2 | **5** |
| Chain Mail +3 | 10 | 3 | **5** |
| Full Plate | 7 | 0 | **8** |
| Full Plate +3 | 12 | 3 | **7** |

Chain Mail +3 is identical to Chain Mail. Worse, **mundane Full Plate (AC 8, 300 gp, level 7) is strictly better than Full Plate +3 (AC 7, 4500 gp, level 12)** — the most expensive armour in the game is a downgrade. Every magical armour row in the registry is currently decoration.

### Bug B — striking is applied twice

Authored striking weapons already carry the extra die in `damage_dice`, and `deriveItem` applies `striking_tier` again on top:

| item | row `damage_dice` | `striking_tier` | **derived** | avg dmg |
|---|---|---|---|---|
| Striking Longsword +2 | `2d8` | 1 | **`3d8`** | 13.5 (intended 9.0) |
| Striking Greatsword +2 | `2d12` | 1 | **`3d12`** | 19.5 (intended 13.0) |
| Dreadblade | `2d8` | 1 | **`3d8`** | 13.5 |
| Lifedrinker Axe | `2d12` | 1 | **`3d12`** | 19.5 |

Items 145, 146, 147, 166, 168. Either the content double-counts or the code does; it is one line either way, but **which side is authoritative is your call**, and `src/content/generated/**` is machine-generated so a content fix means the converter and the seed DB.

### The autopilot genuinely never equips — but that is not the lever

`autopilotWeek` never calls `session.equip()`. Confirmed. But over 20 campaigns × 24 weeks the stash ends **empty** (0.0 items, matching the green `itemsP50: 0` baseline) because the autopilot only ever takes surface combat quests, which pay gold and no items. There is nothing to equip. Fixing the autopilot to equip is correct housekeeping and worth doing; measured, it changes completion at difficulty 7 by **zero**.

---

## 6. Two findings about reach, since they change what "unwinnable" means

**The autopilot does get there — very slowly.** 12 campaigns × 156 weeks, real session, lowest-challenge policy:

| challenge | dungeon dispatches | avg party L | completed | retreated | wiped | first reached (median week) |
|---|---|---|---|---|---|---|
| 2 | 5 | 3.0 | **100.0%** | 0.0% | 0.0% | wk 42 |
| 3 | 302 | 3.4 | 18.5% | 44.0% | 37.4% | wk 43 |
| 5 | 188 | 5.2 | **0.0%** | 67.6% | 32.4% | wk 72 |
| 6 | 52 | 6.1 | **0.0%** | 44.2% | 55.8% | wk 89 |
| 8 | 487 | 7.4 | **0.0%** | 44.6% | 55.4% | wk 99 |
| 10 | 195 | 9.0 | **0.0%** | 63.1% | 36.9% | wk 141 |

**Across 922 real dispatches at `dungeon_level` ≥ 5, completions: zero.** The 24-week career harness never sees any of this — it stops at week 24 with the party at level 2, which is why the harness has been green through all of it.

**"Take harder jobs to level faster" is refuted.** A policy taking the *hardest* survivable posting instead of the easiest reaches **level 5.1 at week 104 against the current policy's 7.0**, at 13% completion versus 51% and a flat 47% wipe rate. Wipes lose the haul and pay no XP; the current lowest-challenge policy is already the better one. Autopilot policy v2 is not the answer here.

---

## 7. What I recommend you decide, and in what order

Nothing here is implemented. My suggested sequencing, because the walls interact and measuring out of order gives false readings:

1. **Wall 2 first (H4 and/or H1).** It is pure data or a single term, it is the hardest stop, and until sealed routes are gone **wall 3 cannot be measured honestly** — every AC experiment at difficulty 7 reads 0.0% regardless.
2. **Then wall 1 (R2).** Independent of wall 2, biggest measured win, well-characterised knee.
3. **Then re-measure wall 3.** With doors open and rests working, the AC question becomes answerable. It may turn out to be smaller than it looks.
4. **Bugs A and B** are separable from all of it and can go any time — A is a one-line derivation change plus a decision about the Full Plate +3 row; B needs you to say which side is authoritative.
5. **Autopilot equipping** — correct, cheap, and measured at zero effect. Do it for honesty, not for balance.

**Content pipeline (R4) should stay held.** Not for the reason in the queue — the band isn't dead because of gear — but because authoring more quests at `dungeon_level` ≥ 5 authors into a band with a measured 0% completion rate across 922 dispatches.

---

## 8. Risks and watch points

- **Every one of these changes moves dungeon generation, and nothing guards it.** `career-distribution` never dispatches a dungeon; `encounter-distribution` uses hand-authored rosters. `tests/dungeon/population.test.ts` (new in brief #13) is the only distribution-level cover that exists, and it is population-only. **Queue item 3 — the dungeon regression harness — is now a prerequisite, not a nice-to-have.** I would want it before any of this lands.
- **H1/H4 change `hazardDc`, which draws RNG.** Room types and template ids are unaffected (the DC roll happens after typing), but stream hashes for any dungeon with a hazard will move. That needs saying in the commit.
- **R1/R2 change `dispatch.ts` control flow only** — no RNG draw is added or removed, so seeds stay comparable. Verified on the patched copy.
- **Anything touching `assembleHero` (H3, AC term, Bug A) changes every combatant on both surface and dungeon paths**, so `encounter-distribution` *will* move and the commit must justify it.
- **Negative controls are required** on every regression test that comes out of this, per the standing invariant.
- **Windows check.** None of this adds files, but Bug A touches `equipment.ts`, which is imported everywhere — worth a `pnpm dev` on your side after.

---

## 9. Decision record — 2026-08-12 / 2026-08-13 (Steven)

| item | call | status |
|---|---|---|
| **Wall 1** (attrition over length) | **R2** — rest anywhere + 1 charge per 4 rooms cleared | **SHIPPED** in brief #15's milestone |
| **Wall 2** (sealed routes) | **H4** — `difficultyDcScale` 2 → 1. Measured strictly stronger than H1 (§10.1): H4 eliminates impossibility through difficulty 10, H1 leaves 6.4% at d8 | **SHIPPED** |
| **Wall 3** (AC has no level term) | **NOT TAKEN.** With the rest of the stack in place the band cleared its target without it (d1–d3 at 91.7 / 85.3 / 80.7). Left standing as a costed option should the curve need it later | deferred |
| **Bug A** (armour potency inert) | **FIX.** Resolved as pure code — potency reaches AC using the same maxed value the attack roll uses. No content edit needed; the ladder is monotone after it | **SHIPPED** |
| **Bug B** (striking double-counted) | **FIX, code authoritative** — the extra die comes out of the content rows. ⚠ **NINE rows, not the five §5 named** (171, 177, 178, 182 are the additions) | **SHIPPED** |
| Autopilot equipping | **NO — deliberate.** Gearing is a player pleasure. The harness models a competent player instead, via `tests/harness/gearBrackets.ts` | discharged by brief #16 |
| Sequencing | **Regression harness FIRST**, then one milestone | done — brief #16 (`d6f8527`), then the milestone |
| Content pipeline (R4) | **stays HELD** | held |

**§7's ordering was superseded by §10.4 and the outcome confirms it:** these landed as ONE milestone, not five. §10.2's warning reproduced almost exactly — at `large`/d7 the milestone took wipes from 40% to **81%** against §10.2's predicted 78.7%, because opening the doors without fixing survival converts honest retreats into total party kills. That band is a CONTENT question (§10.3), and it is now measurably louder about being unfinished.

**One row §5 could not have caught, found while fixing bug A:** **Ironmane's Pelt (181)** — legendary, level 16, 7,000 gp, `potency_bonus 0` — remains **worse than a 300 gp mundane Full Plate** even after the fix. It is the only armour above masterwork with no potency. Content, not code; flagged, not patched.

---

## 10. Post-decision measurements (2026-08-12, after Steven's §9 calls)

**Decisions taken:** wall 2 — *measure H1 and H4 first* · wall 1 — **R2 approved** · Bugs A and B — **both to be fixed** · sequencing — **regression harness first**. This section is the wall-2 costing that was asked for, plus what it revealed. Still no gameplay code: `src/` byte-identical, patched copies under `probe/variant/` (`populationVariant.ts` for the DC knobs, `dispatchVariant.ts` for the rest knobs). `hazardDc` still calls `rng.int` exactly once under both options, so draw counts — and therefore room types, template ids and downstream stream positions — are unchanged.

### 10.1 H1 vs H4 on impossibility — H4 is strictly stronger

Share of generated locks/traps that no hero can ever beat (`20 + mod < dc`), whole shipped pool, 24 templates × 40 seeds:

| cell | H0 shipped | H1 drop `partyLevel/2` | H4 `difficultyDcScale` 2→1 | H1+H4 |
|---|---|---|---|---|
| medium d6 L7 | 8.8% locks / 2.8% traps | **0.0% / 0.0%** | **0.0% / 0.0%** | 0.0% / 0.0% |
| large d7 L8 | **36.6% / 21.3%** | **0.0% / 0.0%** | **0.0% / 0.0%** | 0.0% / 0.0% |
| large d8 L9 | 54.6% / 41.6% | 6.4% / 2.6% | **0.0% / 0.0%** | 0.0% / 0.0% |
| large d10 L11 | 81.1% / 76.9% | 11.6% / 5.2% | **0.0% / 0.0%** | 0.0% / 0.0% |

**H4 eliminates impossibility outright through difficulty 10; H1 does not.** H1 removes only `floor(partyLevel/2)` (≈5 at level 11) while H4 removes one point per difficulty (10 at d10). H1 remains worth taking on its own merits — it is the term that makes the party's own growth work against it — but as an impossibility fix it is the weaker of the two.

### 10.2 The uncomfortable middle result: opening doors alone trades retreats for wipes

At large / d7 / L8, `fullExplore` / standard, 150 runs:

| stack | completed | retreated | **wiped** | sealed routes/run |
|---|---|---|---|---|
| R0 H0 shipped | 0.0% | 50.0% | 50.0% | 1.17 |
| R2 H4 | 0.0% | 21.3% | 78.7% | 0.65 |
| R2 H1+H4 | 0.0% | 10.0% | **90.0%** | 0.23 |

The mechanism works exactly as designed — sealed routes fall 1.17 → 0.23 per run — and the party responds by walking into rooms it cannot survive. **Fixing access without fixing survival converts honest retreats into total party kills**, which is a worse felt outcome, not a better one. **§7's ordering was wrong: these do not ship one at a time.**

### 10.3 The cumulative stack — where the band actually becomes playable

Each row adds to the row above. 150 runs per cell, `fullExplore` / standard. "AC" = `+baseProficiency(level)`; "gear" = best in-family weapon and best effective-AC armour at `item_level ≤ party level`.

| cell | shipped | +H4 | +H4+R2 | +H4+R2+AC | **+H4+R2+AC+gear** |
|---|---|---|---|---|---|
| small d4 L5 | 21.3% | 30.0% | 46.7% | 64.0% | **86.0%** (wipe 23.3% → **0.7%**) |
| medium d5 L6 | 0.0% | 3.3% | 10.0% | 17.3% | **46.7%** (wipe 32.0% → 4.7%) |
| medium d6 L7 | 0.7% | 0.7% | 2.0% | 4.7% | **36.0%** (wipe 32.7% → 19.3%) |
| large d7 L8 | 0.0% | 0.0% | 0.0% | 0.0% | **6.7%** (boss 0.0% → 12.7%, rooms 3.6 → 11.2) |
| large d8 L9 | 0.0% | 0.0% | 0.0% | 0.0% | **2.0%** |

**Three conclusions.**

1. **The fixes multiply; they do not add.** At difficulty 6 the first three are worth 4 points between them and the fourth is worth 31. At difficulty 7 the first three are worth *nothing* and the stack is worth 6.7. Any one of them measured alone will read as a failure — which is precisely why §5 mis-ranked gear.
2. **`dungeon_level` 4–6 becomes genuinely playable** — 86% / 47% / 36% completion with wipe rates of 0.7% / 4.7% / 19.3%. That is a working difficulty curve where there was a wall.
3. **`dungeon_level` 7+ does not.** 6.7% and 2.0% are not a band anyone would ship. The remaining gap is very likely **content, not systems**: the enemy registry has 5 rows at level 7, 2 at level 8, 1 each at 9, 10 and 12, and the party's damage output cannot chew through 67–115 HP creatures inside its HP budget. That is an R4 question, and it is a different brief.

### 10.4 What this changes

* **"The autopilot never equips" is promoted from housekeeping to a real lever.** §5 measured it at zero effect and that was measured with everything else broken. With the stack in place gear is the biggest single jump. The stash being empty (0.0 items over 20 × 24 weeks) is now a balance problem, not a curiosity — and it points straight at Bug A, since armour is half of the gear channel and every magical armour row is currently inert.
* **Bugs A and B are no longer separable side-quests.** They *are* the gear channel. Fix them with the stack, not after it.
* **The four changes want one milestone, not four.** Landing them separately means three landings that each measure as a regression.
* **Steven's "harness first" call is now clearly right** — four interacting changes against generation code that nothing currently guards.
* **Revised recommendation, replacing §7:** dungeon regression harness → then one milestone carrying H4 (+H1 on its own merits), R2, the AC term, and Bugs A/B together → then re-measure → then treat `dungeon_level` 7+ as a content question for R4.

**Not yet measured, flagged rather than assumed:** whether H4 makes the *easy* end trivial (probe N3 is written but the low-difficulty regression numbers are not in this document yet), and whether a six-hero party closes the d7+ gap that gear does not — Steven has said the roster is going to 6, and `partyScaledBudget()` already exists to scale enemy budgets with it.
