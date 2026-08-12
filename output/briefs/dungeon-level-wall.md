# Design Brief #14 — The dungeon_level 5+ Wall

**Status:** FOR DECISION — nothing implemented, `src/` byte-identical to the working tree I received. No gameplay code before Steven approves.
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

## 9. Decision record

*To be filled in on your call. Options are H1/H4/H2/H3/H5 for wall 2, R1/R2/R3/R4/R5 for wall 1, the AC term for wall 3, and Bugs A and B independently.*
