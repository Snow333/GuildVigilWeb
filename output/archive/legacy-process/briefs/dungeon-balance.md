# Design Brief #13 — The Three Dungeon Balance Questions

**Status:** APPROVED 2026-08-12 (Steven) — Q1 flat band · Q2 report + boss-blocked-fails · Q3 re-draw. Shipped in the same session; see §8 for the decision record and §9 for what landed.
**Covers:** the three questions brief #12's combat field surfaced: boss rooms holding one creature, blocked routes counting as "completed", and single-enemy combat rooms.
**Authorities:** `core-loop.md`, `decision-ledger.md` Area 3, brief #4 (profile AI), brief #6 (authored boss rosters), brief #8 (UI grammar — normative for anything §4 changes on screen).
**Measured by:** a throwaway probe (`probe/`, deleted before ship) over the real `populate()` and `runDungeonDispatch()`. Every number below is measured, not modelled. The repo is untouched — `pnpm check` is green at 407 unit + 10 e2e, and `population.ts` is byte-identical to `7346735`.

---

## 1. The instrument, and where it can and cannot see

**Population layer.** Pure `populate()` over the whole shipped template pool — 6 templates × 40 seeds × difficulties 2–7. Party-independent, so it isolates what the *generator* builds from what the party does about it.

**Dispatch layer.** Real `runDungeonDispatch()` runs — 720 per variant: 3 difficulties × 4 profiles × 60 seeds, standard caution, four heroes.

**The party is the game's own.** `starterParty()` → `applyLevelUp()` → `assembleParty()`. No invented sheets: the four founding heroes, levelled through the real path, spending the registry's own skill-point budget and taking the class key-ability boost at 5/10/15/20.

**The measurement window is difficulty 2–4, party level = difficulty + 2.** This is a limit worth stating plainly, because it is also a finding (§7). Levelling does not rescue deeper dungeons: at dungeon_level 7 the wedge completes **0 of 150** runs and wipes 38–47% at *every* party level from 8 to 11. Balance deltas are only readable where the party is genuinely in its weight class.

**Calibration.** At difficulty 2 the probe reproduces the known combat-room distribution — measured 1 → 23.4% · 2 → 46.0% · 3 → 26.2% · 4 → 4.3%, mean 2.11, against the recorded 24/43/26/7 at mean 2.15. Boss single-creature rate measures 82.7% pooled across 2–7 and moves by difficulty (74.6% at d6, 89.6% at d5) — the recorded 89% is this same phenomenon read at a different difficulty mix, not a different one.

### Baseline, for reference

| | value |
|---|---|
| boss room creatures | mean **1.17**, single **82.7%** |
| boss fight length | **76.7** ticks |
| ordinary combat room fight length | **76.0** ticks |
| **boss : ordinary room length ratio** | **1.01** |
| boss fight hero downs / ordinary room | 0.84 / 0.75 |
| boss fight loss rate | 1.7% |
| run outcomes | 68.1% completed · 29.6% retreated · 2.4% wiped |
| fights per run | 1.91 (26.9% of runs have exactly one, 14% have none) |
| gold per run | mean 237 |

**The single most useful number in this document is that ratio: 1.01.** The climax is not longer, not more dangerous, and not different from the third room on the left. That is what the field made visible.

---

## 2. Q1 — Boss rooms are one creature

### The mechanism, precisely

`pickEnemies(rng.int(1,2), difficulty+1, difficulty+2, difficulty+1, rng)`. The cost base is `difficulty+1`, so a creature at `difficulty+1` costs 1 slot and one at `difficulty+2` costs 2. Budget 1 always yields exactly one creature. Budget 2 yields two only if *both* draws land on the lower band. So the ceiling is structural: **the budget can never seat more than two.**

### The options, costed

All measured, four heroes, 720 runs each. "Ratio" is boss fight length ÷ ordinary combat room length — the number that says whether the climax reads as a climax.

| option | creatures | single | boss ticks | **ratio** | boss loss | run wipe | completion |
|---|---|---|---|---|---|---|---|
| **A. leave the generator alone** | 1.17 | 82.7% | 77 | **1.01** | 1.7% | 2.4% | 68.1% |
| **B. flat band only** (`bossLevelBonus` 2→1) | 1.49 | 51% | 85 | **1.13** | 2.3% | 2.6% | 69.9% |
| **C. budget 2–3, keep the +1..+2 band** | 1.71 | 39% | 108 | **1.45** | 5.3% | 4.2% | 67.1% |
| **D. exactly 2, flat band** | 2.00 | 0% | 117 | **1.54** | 4.7% | 4.0% | 68.1% |
| **E. budget 2–3, flat band** | 2.49 | 0% | 145 | **1.97** | 12.0% | 7.2% | 66.1% |
| **F. budget 3–4, keep the band** | 2.42 | 9.2% | 150 | **2.02** | 17.9% | 10.6% | 64.2% |
| **G. budget 3–4, flat band** | 3.49 | 0% | 185 | **2.59** | 35.5% | 18.5% | 58.1% |
| **H. budget 4–5, keep the band** | 3.11 | 0% | 179 | **2.49** | 34.8% | 18.2% | 56.9% |

Three readings worth having before you choose:

**The flat band is the legibility lever, not just a power lever.** With `bossLevelBonus: 1` the band collapses to `difficulty+1` exactly, every pick costs exactly 1, and **the budget becomes a literal creature count**. "The boss room holds 2–3 creatures" is then a sentence that is true, tunable, and scales with party size by multiplication (§5). With the current +1..+2 band the budget is an abstraction whose output you cannot predict without a probability calculation — which is how a stated budget of "1–2" became a played result of "1, 83% of the time."

**Danger climbs much faster than length.** From D to E is +28 ticks and +7.3 points of boss loss rate. From E to G is +40 ticks and +23.5 points. The elbow sits between D and E.

**The elevated duel is not currently dangerous either.** Option A's boss loses 1.7% of the time and downs 0.84 heroes — statistically the same as an ordinary room (0.75). So "the spike is the point" is not what the code delivers today: it delivers neither a spike nor a fight.

### The authoring option is already half-taken, and it votes against the duel

Brief #6 lets a quest pin its boss roster. **7 of the 15 shipped dungeon quests already do** — so the band roll only governs the other 8. What the authors chose is informative:

| quest | dungeon level | roster | levels vs difficulty |
|---|---|---|---|
| 102 The Scout's Satchel | 2 | 2 | +1, 0 |
| 104 The Supply Cache | 4 | 2 | 0, −1 |
| 105 What the Graves Gave Up | 4 | 3 | 0, −1, −1 |
| 106 The Whisper's Man | 5 | 1 | +2 |
| 107 Find the Fort | 6 | 2 | 0, −2 |
| 108 Break the Engines | 6 | 2 | 0, −1 |
| 109 The Vanguard-Captain | 7 | 2 | +1, 0 |

Mean authored roster: **1.86 creatures**, and in 9 of 13 non-lead slots the creature sits *at or below* the dungeon's difficulty. The authoring convention already prefers **more bodies at level** over **one body elevated** — which is precisely the choice Q1 poses, decided one way by content and the other way by the generator.

Measured on the same dungeons: q102's authored pair runs **104 ticks against the generated boss's 69**. q105's authored trio runs 108 ticks and loses 0% of the time, against the generated boss's 84 ticks and 5.4%. Authored climaxes are *longer and safer* — they buy their length with numbers rather than elevation.

So "author more boss fights" is a real option, but it is not a *do-nothing* option: it would leave 8 of 15 dungeons on a generator whose output disagrees with the house style, and it does not touch procedurally-generated dungeons at all. It composes well with B or D, badly with A.

**What I need from you on Q1:** which row. My read of the numbers, offered as a read and not a recommendation: **D (exactly 2, flat band)** buys a climax that is half again as long as an ordinary room for four-tenths of a point of wipe rate and zero completion-rate cost, and it makes the tunable legible. **E** buys a genuine two-to-one climax at a real cost — 12% of boss fights lost. Anything past E stops being a climax and starts being a wall.

---

## 3. Q2 — Blocked routes count as "completed"

### The mechanism, precisely

`fullExplore`'s objective is `every room visited OR blocked`. A room joins `blocked` when its own lock beats every hero (`openLock` → `impossibleDc`). Rooms *behind* a blocked room are neither visited nor blocked — so they already fail honestly: `pickTargetNode()` returns null and the run ends `retreated / objectiveFailed`. **That path is 22.6% of all runs.**

The dishonest case is narrow and specific: **the blocked room IS the boss room.** Then it counts as blocked, the objective is satisfied, and the run reports cleared with the boss untouched.

### The measured honesty picture

| | value |
|---|---|
| runs hitting ≥1 impossible door | **36.4%** (0.46 blocked doors per run) |
| `fullExplore` completions with ≥1 door that stayed shut | **33.9%** |
| `fullExplore` runs reporting cleared with the boss never fought | **4.4%** (7.3% of completions) |
| runs already ending `objectiveFailed` | 22.6% |

So there are two different honesty problems, and they want different answers:

- **A third of "cleared" reports hide an unopened door.** This is common, and it is arguably *fine* as a rule — a sealed treasure alcove does not make a clearance a lie — but it is currently invisible. Nothing on the after-action screen says a door was left shut.
- **4.4% of `fullExplore` runs report cleared with the boss alive.** This one is a lie by any reading.

### The options

| option | changes | cost |
|---|---|---|
| **A. leave the sim, fix the report** | after-action states rooms sealed and, when it happened, that the boss room was never opened | zero sim change; zero harness movement; UI-only (brief #8 grammar applies — red ink in the margin, label-paired) |
| **B. boss room blocked ⇒ objective fails** | one condition in `objectiveComplete()` | ~4.4% of `fullExplore` completions become retreats; `fullExplore` completion 60.6% → ~56.2%; no harness snapshot moves (neither harness dispatches a dungeon) |
| **C. third state — `partial`** | `objectiveComplete()` returns `complete \| partial \| incomplete`; `DungeonDispatchResult.outcome` gains `'partial'` | touches the outcome union, the summary deriver, `QuestRecord`, the after-action screen, save backfill for old records, and the quest-resolution branch in `session.ts`. The event schema stays additive — but this is the largest of the three by a wide margin |

These compose: **A is worth doing whichever of B or C you pick**, because 33.9% of completions have a shut door and none of them currently say so. A alone is the cheapest honest answer. C is the most expressive and by far the most expensive; it is also the one that would let a quest *reward* differently for a partial clearance, which may be worth more later than it is now.

**What I need from you on Q2:** A alone, A+B, or A+C. If you want C, I would rather brief it separately — it is an outcome-model change, not a tuning change, and it will want its own testing section.

---

## 4. Q3 — 24% of combat rooms hold a single enemy

### The mechanism is not the budget

This is the finding I did not expect. `pickEnemies` **breaks out of the loop on the first over-budget draw** rather than drawing again:

```ts
if (spent + cost > budget && out.length > 0) break; // over budget — the room is full
```

At difficulty 2, band [1,3], a level-3 creature costs 2. Budget 2 with one cheap draw then one expensive draw yields **one creature and a wasted slot** — the room reports full while holding half its budget. So a large share of single-enemy rooms are not budget-limited; they are **one unlucky draw away from being a proper fight**.

Changing that one `break` to a re-draw (with a hard try cap, so termination stays trivially provable) is close to free:

| option | mean | single | fight ticks | hero downs | run wipe | completion |
|---|---|---|---|---|---|---|
| **A. leave it** | 2.29 | 19.1% | 76 | 0.75 | 2.4% | 68.1% |
| **B. re-draw instead of break** | 2.51 | **9.0%** | 81 | 0.79 | 2.6% | 68.3% |
| **C. budget 3–4** | 2.70 | 4.0% | 88 | 0.94 | 3.5% | 68.2% |
| **D. budget 3–5** | 3.09 | 2.7% | 100 | 1.22 | 6.9% | 65.6% |

**B halves the single-enemy rate for +5 ticks and +0.2 points of wipe rate.** It also lifts the boss room for free (single 82.7% → 71.4%) because the same rule governs both. C is a real but modest step further. D starts costing completions.

One caveat on B, stated so it is not a surprise: a re-draw consumes RNG differently, so **the same seed produces a different dungeon**. No shipped snapshot covers dungeon population (`career-distribution` never dispatches one; `encounter-distribution` uses hand-authored rosters), so nothing goes red — which is exactly the hazard the handoff warned about. If B is approved, the regression harness for dungeon population moves up the queue, because after B there is a baseline worth pinning.

**What I need from you on Q3:** whether a lone creature on a 70 × 50 ft field is a problem worth 5 ticks (B), worth 12 (C), or not a problem at all (A).

---

## 5. Party size — the constraint, quantified

Your note: *leave space for a party of 6, and eventually larger enemy parties; keep 4v4 for now.* Measured, this is not a nicety — **any budget written as a constant is wrong the moment the party grows.** Same dungeon knobs, six heroes instead of four:

| | 4 heroes | 6 heroes |
|---|---|---|
| ordinary combat room fight | 76 ticks | **43** ticks |
| boss fight (baseline) | 77 ticks | **40** ticks |
| run wipe rate | 2.4% | **0%** |
| completion | 68.1% | **82.1%** |
| option G's boss loss rate | 35.5% | **0.5%** |

Two extra bodies erase the entire difficulty range these options span.

**The rule that holds:** `budget = round(base × partySize / 4)`. Measured against it — boss base 2 at four heroes gives ratio 1.54; boss base 3 at six heroes gives **1.55**. Combat 2–4 at four heroes gives 0.75 downs per fight; 3–6 at six heroes gives **0.73**. The *texture* is preserved exactly.

What linear scaling does **not** preserve is lethality (wipe 4.0% → 0.4%): six level-appropriate heroes are simply a stronger party than four, and matching that would mean moving enemy *level*, not enemy *count*. That is a separate question and I am not proposing it here. But whatever you pick in §2 and §4 should be written as a base × party-size expression from the first line of code, not as a literal.

---

## 6. If approved — implementation shape

Small, and all of it in one file plus tunables:

1. `src/content/dungeon.ts` — `ENCOUNTERS` gains the chosen budgets expressed as a base plus a party-size scale, and `bossLevelBonus` moves if you take a flat band. Balance stays in data (Area 3).
2. `src/sim/dungeon/population.ts` — `pickEnemies` takes the scaled budget; the `break` becomes a capped re-draw if Q3-B is approved. `populate()` gains the party size it needs to scale. Both stay well inside the size targets.
3. `src/sim/dungeon/dispatch.ts` — only if Q2-B is approved: one condition in `objectiveComplete()`.
4. `src/ui/screens/AfterActionScreen.tsx` — only if Q2-A is approved: sealed-door and unopened-boss-room lines, brief #8 grammar, label-paired, red ink in the margin only.

**Testing, per the invariants:**

- New tests pin the *distributions*, not single rolls — the mean and single-creature rate of boss and combat rooms across the pool, at a fixed seed set.
- **Every regression test gets a negative control**: revert the change, watch it fail, restore. I will report the failure text for each.
- Harness snapshots must stay byte-identical. Neither harness touches dungeon generation, so if either moves, the change leaked and gets reverted rather than re-baselined.
- Event schema untouched — nothing here needs a new event. If Q2-C is chosen, that changes, and it gets its own brief.
- Visual smoke: after any file-adding or module-rewiring change, you run `pnpm dev` and confirm before I call it done. Green Linux tests are not proof it renders on Windows.

---

## 7. Two findings outside this brief — logged, not chased

**① `dungeon_level` 5+ is currently unwinnable, and it is gear, not levels.** At difficulty 5–7 the starter wedge completes 4.7% / 0% / 0% of runs; at difficulty 7 it completes **0 of 150 at every party level from 8 to 11**, wiping 38–47%. The party never re-equips — `equip()` is a player command the autopilot never issues — so it fights a level-9 dungeon in level-1 chain mail with a 1d8 longsword. **8 of the 15 shipped dungeon quests sit at `dungeon_level` ≥ 5.** This may well be the answer to the open question of why the autopilot only ever accepts quests 1, 6 and 100 across 480 harness weeks: the rest are unwinnable, and the accept logic is right to refuse them. Worth a brief of its own before the content pipeline (R4) adds more quests into that band.

**② The exponential cost curve is currently a no-op.** `2^(level − difficulty)` differs from a linear `1 + (level − difficulty)` only when the gap reaches 2. `levelBand` is 1, and the boss's band measured from its own elevated base is also 1 — so the gap is never more than 1, and the two curves are *identical*. I measured it: the linear variant produced numbers indistinguishable from baseline to the last decimal, across every statistic. The curve is dead tuning until a band widens. Not worth changing on its own; worth knowing before anyone reaches for it as a lever.

---

## 8. Decision record — taken 2026-08-12

| question | decision | why it was the cheap one |
|---|---|---|
| **Q1** | **§2 option B — flat boss band.** `bossLevelBonus` 2 → 1; budget stays 1–2. | Halves the lone-boss room (82.7% → 51%) for +0.2 points of run wipe rate, and — the part that mattered more than the numbers — makes `bossRoomEnemies` mean creatures rather than an abstraction, so the tunable is legible and scales by multiplication. The bigger budgets stay available and now do what they say. |
| **Q2** | **§3 A + B — report *and* fail.** | An unopened boss chamber fails `fullExplore`; the after-action reports sealed doors on every run that had them, whatever the outcome. C (a third `partial` state) was declined for now — it is an outcome-model change and would want its own brief. |
| **Q3** | **§4 option B — re-draw instead of break.** | The lone enemy was mostly an artifact of one unlucky draw ending a half-spent room, not of the budget. Re-drawing halves it (19.1% → 9.0%) for +5 ticks and +0.2 points of wipe rate, and lifts boss rooms for free. Budgets left at 2–4. |
| **§5** | **Budgets are `base × partySize / 4`, scaling up only.** | `partyScaledBudget()` in `content/dungeon.ts`. At four or fewer heroes it is the identity, so today's dungeons are byte-identical on this axis — the space is left, not spent. |

**Deliberately not done, and why:** authoring boss rosters on the 8 unauthored dungeon quests (content work, and the flat band now moves those dungeons anyway); the `partial` outcome state; anything about §7's two findings.

---

## 9. What landed

**Sim.** `ENCOUNTERS.bossLevelBonus` 2 → 1, plus `PARTY_BUDGET_BASE` and `partyScaledBudget()` (`src/content/dungeon.ts`). `pickEnemies` re-draws instead of breaking, bounded by `MAX_ENEMY_DRAWS = 12`, and `populate()` takes the party size its budgets scale against (`src/sim/dungeon/population.ts`). `objectiveComplete()` gains `!bossRoomSealed()` for `fullExplore`, and `DungeonDispatchResult` gains `sealedRoutes` and `bossRoomSealed` (`src/sim/dungeon/dispatch.ts`) — return-value fields, **not** events: the schema and its manifest are untouched.

**UI.** The after-action report gains a *"The doors"* statline when any door stayed shut, and — when the boss chamber was one of them — a red-ink margin line, per brief #8: label-paired, colour never the sole carrier, marginalia in the margin.

**Tests.** `tests/dungeon/population.test.ts` is new and is the **first coverage `populate()` has ever had** — the flat band (exact, not statistical), the boss-room distribution, the lone-enemy ceiling, termination bounds, and party-size scaling in both directions. `tests/dungeon/dispatch.test.ts` is extended (not forked) with the sealed-boss regression, including a non-vacuity assertion so the scan cannot silently stop finding sealed runs. **407 → 420 unit tests, 10 e2e, all green.**

**Negative controls, all four run and observed:**

| reverted | tests that went red | tests that stayed green |
|---|---|---|
| `bossLevelBonus` 1 → 2 | flat band; "no longer a duel" | everything else (7/9) |
| re-draw → `break` | "rarely holds a lone enemy" | everything else (8/9) |
| drop `!bossRoomSealed()` | "no run … reports completed"; "none claims a defeated boss" | everything else (22/24) |
| `partyScaledBudget` → identity | both six-hero scaling tests | everything else (7/9) |

**Harness snapshots did not move** — `career-distribution` and `encounter-distribution` are byte-identical, which confirms the handoff's warning rather than contradicting it: **neither harness dispatches a dungeon**, so this change moved real generation with every baseline green. That is the argument for the dungeon regression harness already in the queue, and it is now a better argument than it was this morning, because there is a baseline worth pinning.

**Bundle:** 1,231.70 → 1,232.52 kB.
