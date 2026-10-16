# Design Brief #19 — The Combat Room

**Status:** **SCOPED BY STEVEN 2026-08-13 — see §9/§10.** §11's two questions answered 2026-08-13 (§12). **One decision left: the re-tune (§12.4).** Nothing implemented. `src/` carries only brief #18's findings 2/4 (speed persistence, after-action); the probe is deleted and verified. No gameplay code before Steven approves.
**Covers:** Steven's call, 2026-08-13: *"we should move forward building the room out as a fully featured room that supports a solid digital translation of the pathfinder ruleset"* — with the scope line *"a longer term step will be to let players take control of fights and pilot the characters themselves. But for 1.0 we just want to leave this as an auto-battler."*
**Authorities:** `core-loop.md` D2 (no player intervention once engaged), `decision-ledger.md` Area 2 (universal AI, continuous time), brief #8 (the desk grammar), brief #12 (the field, and why combat has its own transport), brief #15 (`engageRange`), brief #16 (the precision rule), brief #17 (position confers nothing), brief #18 §1 (the off-sheet measurement that started this).
**Measured twice:** the original analysis (§§0–7), then re-measured against Steven's scope (§10). Both by a throwaway probe under `probe/` over patched copies of `ai.ts`, `encounter.ts` and `dispatch.ts`, on the **curve's own seeds** so every number below is directly comparable to the committed contract. Deleted before shipping.
**Suite at time of measurement:** 445 unit + 11 e2e green.

---

## 0. The headline

**Room geometry is a balance parameter of the first order, and nobody knew, because there has only ever been one room.**

Every fight in the game — a goblin ambush in a corridor, the boss in its chamber — resolves in the same 14 × 10 box. `PopulatedRoom` carries `type`, `trap`, `lock`, `enemyIds`, `hasClue`, `restCharge` and **no geometry whatsoever**. Measured, at level, on the curve's own seeds:

| room | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| 20 × 14 hall | 89.7 | 84.7 | **77.0** | **42.7** | **50.7** |
| 14 × 10 (today's box) | 88.7 | 84.3 | 71.7 | 38.0 | 44.7 |
| 10 × 8 chamber | 89.3 | 83.3 | 72.3 | 35.0 | 44.3 |
| 8 × 6 cramped | 85.7 | 80.7 | 69.0 | 30.7 | 39.7 |
| 6 × 5 corridor | 83.7 | 79.0 | **65.7** | **31.7** | **38.0** |

n=300/cell, walls on, wall-slide on. **Hall to corridor costs 11.3 points at d3, 11.0 at d4 and 12.7 at d5** — all outside the ±8 bar at that n. Wipes at d4 go **34.7% → 46.0%**.

The mechanism is the thing that should worry us: **brief #15's cantrip fix — the change that met your 80% target — depends on the caster holding a 6-unit standoff, and a 6 × 5 room cannot contain a 6-unit standoff at all.** Back-line share of hero deaths climbs as the room tightens (d3: 76.7% → 85.6%). The fix that got the game to 80% is *geometry-dependent* and has only ever been measured in one geometry.

So: authoring rooms is not set-dressing. **A room's dimensions re-tune the game as hard as the gear bracket did (+12.3 at d3) or H4.** That is the reason to build this deliberately rather than incrementally, and it is the strongest argument for your call.

And one boundary that governs everything below:

> ⚠ **The spatial rules translate. The action economy must not be imported.** PF2E is turn-based, 5-foot-grid, three actions. Guild Vigil is continuous-time, continuous-space, 100 ms ticks, and the event schema, both harnesses and every committed baseline are built on that. Cover, line of sight, reach, size and difficult terrain are all *geometry* and port cleanly. Three-action turns, Step-vs-Stride and per-turn reaction refresh are *turn structure* and porting them is a rewrite of the engine, not a feature.

---

## 1. What a "room" is today

Confirmed by reading, not assumed.

* `ARENA = { width: 14, height: 10, sideAx: 2, sideBx: 12 }` is referenced in exactly two places: `placeFormation` (start positions) and `CombatField.tsx` (drawing). **It is not a constraint anywhere.**
* `PopulatedRoom` has no width, height, shape, terrain or feature list. The dungeon knows a room's *type* (9 kinds) and nothing about its space.
* Positions are float `Vec2`; `dist` is Euclidean; 1 unit = 5 ft (`FEET_PER_UNIT`).
* `stepToward` has no collision. Units pass through each other and through nothing else, because there is nothing else.
* Brief #18 §1 measured the consequence: **51–76% of fights render at least one unit off the sheet**, with excursions to six arena-widths out.

**The single positional rule that exists in the whole engine is flanking** (`isFlanked`, a dot-product test over adjacent allies). Brief #17 §0 put it plainly and it is worth repeating here because it is the design constraint: *position confers nothing.* `resolveStrike` reads distance and flanking and nothing else.

---

## 2. The audit — what PF2E asks for, and what the engine has

| PF2E rule | content carries it? | sim reads it? | note |
|---|---|---|---|
| flanking / off-guard | n/a | ✅ **yes** | the one positional rule that works today |
| prone · grabbed · restrained | ✅ conditions | ✅ yes | 23 conditions modelled |
| MAP (multiple attack penalty) | n/a | ✅ yes | translated as flurry decay *inside* a burst — a good precedent |
| **room bounds / walls** | ❌ none | ❌ **no** | brief #18 §1; the whole reason this brief exists |
| **creature size** | ❌ **no column on `enemies`** | ❌ no | every combatant is a dimensionless point |
| **reach** (10 ft weapons, Large creatures) | ⚠ partial | ❌ no | `weapon_range: 2` exists on 5 items but is read as a *ranged* range; `ENGAGEMENT_RANGE` is a universal 1.5 for everyone |
| **cover** (lesser +1 / standard +2 / greater +4) | ❌ none | ❌ no | needs line-of-sight first |
| **line of sight / line of effect** | ❌ none | ❌ no | every unit can currently target every unit through anything |
| **difficult terrain** | ❌ none | ❌ no | |
| concealed · hidden · undetected · invisible | ❌ none | ❌ no | the whole detection axis is absent |
| elevation | ❌ none | ❌ no | 2D only; out of scope, say so once |
| squeezing | ❌ none | ❌ no | out of scope |
| AoO trigger conditions | ⚠ `aoo_count`, `attack_of_opportunity` | ⚠ partial | fires on disengage and adjacent-cast only |
| Step vs Stride | ❌ | ❌ | ⚠ **do not import** — see §4 |
| the three-action economy | ❌ | ❌ | ⚠ **do not import** — see §4 |

**Two content gaps are load-bearing and cheap:** `enemies` has no `size` and nothing anywhere has `reach`. Both are single nullable columns through the seed → `db:apply` → `convert` path, and the converter is `SELECT *` with row-counting gates, so **a column costs no tooling change and no gate change.**

---

## 3. Measured — what walls cost, and what they do not

### 3.1 Walls, and the wall-slide question

n=1000/cell, curve seeds, so these sit directly against the committed contract.

| | shipped (no walls) | walls, hard stop | walls, wall-slide |
|---|---|---|---|
| d1 · L1 | 91.3 / 5.3 wiped | 89.3 / 7.2 | 89.0 / 7.3 |
| d2 · L2 | 85.8 / 7.8 | 84.2 / 9.1 | 84.3 / 9.1 |
| d3 · L3 | 77.3 / 14.1 | **72.9** / 18.4 | **72.8** / 18.3 |
| d4 · L4 | 41.1 / 34.2 | 39.2 / 35.3 | 38.2 / 36.9 |
| d5 · L5 | 49.4 / 27.7 | 45.1 / 32.5 | 43.8 / 33.9 |

* **Walls make the game harder, consistently** — five of five cells down, −1.6 to −4.4, wipes up everywhere. That is the honest fiction arriving: a caster can no longer retreat forever, so it gets caught. It is not a regression; it is the rule starting to exist.
* ⚠ **The wall-slide is a FEEL choice, not a balance one.** It fires 7,000–12,500 times per 1,000 runs and moves nothing measurable (largest delta 1.3 points, against a ±2–4.4 bar). Pick it because a caster sliding along a wall reads as a person and one pressed into a corner reads as a bug — not because of the numbers. **Recommended: slide.**
* ⚠ **WALLS ALONE MAY TRIP THE CONTRACT.** `dungeon-curve`'s d3 floor is **73**, and walls measure **72.8–72.9**. The floor was anchored to an n=300 reading of 80.7 for a cell that reads 77.3 at n=1000 (brief #18 §3.2 flagged that it sat at the top of its band). **Expect the CONTRACT test to fail when walls land, and expect to re-anchor d3 deliberately.** Not silently — that is exactly the clause status.md protects.

### 3.2 Room size — the finding

§0's table. The short version: **a corridor costs 11–13 points against a hall at d3–d5**, wipes at d4 go 34.7% → 46.0%, and the back line's share of deaths climbs as the room tightens.

**What this means for authoring:** room dimensions must be a *designed* quantity with a stated range, not a free parameter a content author picks for flavour. If the dungeon starts handing out 6 × 5 corridors, the tuning target is gone and no test will say why.

---

## 4. The translation principle — and the fork you should decide now

Three buckets. The middle one is this brief; the third is the trap.

**KEEP — already translated, do not revisit.** MAP → flurry decay inside a burst. Initiative → start delay in ticks. Dying/recovery on a timer. The condition tracker. Flanking. These are the proof the continuous-time translation works.

**ADD — spatial rules, they port cleanly.** Walls, creature size, reach, line of sight, cover, difficult terrain. All of these are geometry read at resolution time; none of them needs turns.

**DO NOT IMPORT — turn structure.** The three-action economy, Step vs Stride, per-turn reaction refresh, movement-as-an-action. Every one of these presumes a turn boundary that does not exist here, and the event schema, `attackIntervalTicks`, both harnesses and every committed baseline are built on its absence. Importing them is not a feature; it is a new engine.

### 4.1 ⚠ The fork: what "players pilot the characters" means

You said 1.0 stays an auto-battler and player control comes later. **The *shape* of that later step decides whether this brief is a foundation or a detour, so it is worth calling now even though you build it later.**

| | what it is | does the current engine survive? |
|---|---|---|
| **Real-time with pause** | continuous time continues; the player pauses, issues orders (move here, target that, cast this), unpauses. The AI drives anyone without a standing order. | ✅ **yes.** The sim already resolves continuously and deterministically; player orders become another input to `pickAction`/`desiredPosition`. Everything in §5 is a direct prerequisite. |
| **Turn-based PF2E** | initiative order, three actions per turn, Step/Stride, reactions per round. | ❌ **no.** Ticks, the event schema, `attackIntervalTicks`, both harnesses and every baseline assume no turns. This is a rewrite of `encounter.ts` and a re-baseline of everything. |

**Real-time-with-pause is the one that fits, and it is also the one that matches "auto-battler with the player allowed to intervene."** If that is the intent, §5 is exactly the right foundation and the room work pays for itself twice. If you want true turn-based PF2E later, say so now — it changes what we should build, and it would be much cheaper to know before the room lands than after.

---

## 5. The staged build — four layers, each shippable and measurable alone

Deliberately staged so each layer lands with its own probe, its own negative control and its own baseline move, rather than one milestone nobody can review. Sizes are the honest shape of the work, not estimates I can defend to the hour.

**Layer 1 — THE ROOM EXISTS.** `RoomGeometry { w, h }` on `PopulatedRoom`, produced by `populate()` from room type and tier; `runEncounter` takes it; `placeFormation` scales to it; positions bound to it with the wall-slide. `CombatField` draws the real room instead of a fixed box.
*Measured already (§3).* Moves: both dungeon baselines, **and `encounter-distribution` this time** — it calls `runEncounter`, so unlike brief #15 it will not stay byte-identical. Expect the d3 contract floor to need re-anchoring.
*Negative control:* revert the bound → brief #18 §1's off-sheet invariant fires at ~50%.

**Layer 2 — BODIES HAVE SIZE AND REACH.** `size` on `enemies` (one nullable column, seeded), `reach` derived from size and weapon. `ENGAGEMENT_RANGE` stops being universal: a Large creature threatens further, a reach weapon threatens further, and `isFlanked`/AoO/interdiction all read it.
*Unmeasured.* This is where brief #17's interdiction becomes implementable as a real spatial rule rather than an abstract adjacency test.

**Layer 3 — LINE OF SIGHT, THEN COVER.** Room features (pillars, rubble, doorways) as blockers; a segment test from attacker to target; cover as the PF2E ladder (+1 lesser / +2 standard / +4 greater) into `resolveStrike`'s AC side.
*Unmeasured, and the largest balance risk in the brief* — cover is an AC swing applied to every attack in the game.

**Layer 4 — DIFFICULT TERRAIN.** Movement cost multipliers on regions; `moveStep` reads the terrain under the unit.
*Unmeasured.* Cheapest of the four and the most optional.

**I would ship 1, then 2, then stop and re-measure the whole curve before deciding on 3.** Layers 1–2 make the room real and make interdiction implementable. Layer 3 changes every attack roll in the game and deserves its own decision after we see where 1–2 leave the tuning target.

---

## 6. What it costs

* **Baselines.** Layer 1 moves `dungeon-curve`, `dungeon-distribution` **and `encounter-distribution`** (it calls `runEncounter`). Three baselines in one commit, each justified in the message. `career-distribution` will move slightly (surface fights resolve in rooms too — ⚠ *and "what room is a surface fight in?" is an open question §9 asks you*).
* **The contract.** §3.1: d3 lands at 72.8–72.9 against a floor of 73. Re-anchor deliberately.
* **Content.** Layers 2–3 add columns and a room-feature vocabulary. All through `data/seeds/seed_<name>.sql` → `pnpm db:apply` → `pnpm convert`; columns are free (converter is `SELECT *`, gates count rows).
* **The field.** `CombatField` currently hard-codes a 14:10 aspect and a fixed grid. A variable room means variable aspect — and brief #8's chart density is LOCKED at round-03, so the field's rules (scale bar, grid, muster lines) need a deliberate pass rather than a stretch.
* **Runtime.** A non-issue: dispatches run 2.1–3.5 ms against a ≤50 ms budget (brief #17 §7). Line of sight in layer 3 is the first thing here that is not free, and it is a segment test against a handful of blockers.

---

## 7. Risks and watch points

* ⚠ **This touches `desiredPosition`, where brief #15's central bug lived.** `engageRange` POSITIONS, `weaponRange` STRIKES. Layer 2 adds a third range (reach) and the three must not collapse into each other.
* ⚠ **Room size silently re-tunes the game (§0).** Whatever produces `RoomGeometry` needs a stated, tested range, and the harness should assert it — otherwise a content change moves the curve and the commit message says "added a room".
* **Small rooms attack brief #15's fix specifically.** A caster cannot hold 6 units in a 6-wide room. If cramped rooms are wanted for flavour, the back line needs an answer for them, and that is a design question, not a tuning one.
* **The dungeon harness is a regression gate, not an exploration instrument** — every layer gets a throwaway probe first.
* **Windows check.** Layer 1 adds files and moves module wiring in the combat loop; `pnpm dev` after.
* **Nothing here needs an event-schema change yet.** Positions already ride on `unit_spawned`/`unit_moved`. Cover and reach would want a *field on an existing event* before a new type — brief #13's `sealedRoutes` precedent.
* **Out of scope, stated once so nobody re-opens it:** elevation, squeezing, the detection axis (concealed/hidden/undetected/invisible), and the three-action economy.

---

## 8. What I need from you

1. **§4.1 — real-time-with-pause, or true turn-based, for the later player-control step?** The biggest question in the brief. It does not change 1.0, and it changes what layers 1–2 should be built toward. My reading of *"leave this as an auto-battler for 1.0"* is that real-time-with-pause is what you want, but I do not want to assume it.
2. **Ship layers 1 → 2, then re-measure before deciding on 3 (cover)?** Or a different cut.
3. **§3.1 — wall-slide confirmed?** It is free in balance terms and I recommend it on feel.
4. **Room geometry: where does it come from?** Options: (a) by room `type` — a boss chamber is a hall, a trap room is cramped; (b) by tier; (c) authored per template node in content; (d) a seeded roll within a designed range. **(a) + (d) is what I would build** — legible to the player, and the range keeps §0's lever under control.
5. **What room does a SURFACE fight happen in?** Surface quests have no dungeon room. Today they get the same 14 × 10 box by default. Left alone, layer 1 makes dungeon fights variable and surface fights fixed, which is a defensible answer but should be a chosen one.

Nothing else here needs a decision; §§1–3 and 6–7 are measurement and structure.

---

## 9. DECISION RECORD — 2026-08-13 (Steven)

| question | call |
|---|---|
| §4.1 the player-control fork | **REAL-TIME WITH PAUSE.** The current engine is the foundation; the three-action economy stays out permanently. |
| room geometry (§8 q4) | **Do not overcomplicate it. ONE room type, 20 × 20**, sized to hold 4v4, 6v6 and 6v8. No per-type sizing, no seeded range, no authored shapes. |
| surface fights (§8 q5) | Moot — there is only one room. |

**The PF2E rule list, ruled line by line:**

| rule | call | state |
|---|---|---|
| Flanking | **yes** | ✅ already shipped |
| Prone / grabbed / restrained | **yes** | ✅ already shipped |
| MAP | **yes** | ✅ already shipped (flurry decay) |
| Room bounds / walls | **yes** | **this pass** |
| AoO | **yes** — melee engagement and departure from it | **this pass** |
| Concealed / hidden | **yes, for backstab purposes** | **this pass — but see §11** |
| Creature size | eventually, **not this pass**; future 2×1 and 2×2 creatures | deferred |
| Line of sight | eventually, **not this pass** — wants a fog-of-war overlay to convey what the party can and cannot see | deferred, logged as a future feature |
| Reach | **no** | out |
| Cover | **not at this time** | out |
| Difficult terrain | **not at this time** | out |
| Elevation · squeezing | **no** | out |
| Step vs Stride | not critical | out |
| Three-action economy | **no** | out, permanently |

⚠ **§5's four-layer plan is superseded.** With size, reach, cover, LOS and terrain all deferred, layers 2–4 fall away. The pass is now three changes, and §10 measures all three.

---

## 10. THE SCOPED PASS, MEASURED

n=300/cell, at level, gear bracket, **on the curve's own seeds** — the probe reproduced the committed snapshot exactly (91.7 / 85.3 / 80.7, wipes 4.7 / 8.3 / 12.3) before anything was changed.

| arm | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| **A0 shipped** | 91.7 / 4.7 | 85.3 / 8.3 | 80.7 / 12.3 | 39.7 / 35.0 | 49.3 / 25.3 |
| **A1 + the 20 × 20 room** | 89.7 / 6.7 | 83.7 / 10.3 | 78.7 / 14.0 | 40.0 / 35.7 | 49.0 / 24.7 |
| **A2 + AoO from content** | 93.3 / 3.0 | 90.0 / 3.7 | 86.3 / 6.7 | **49.3** / 24.0 | **57.3** / 17.3 |
| **A3 + ambush wired** | 93.3 / 3.0 | 90.0 / 3.7 | 86.7 / 6.3 | 49.3 / 24.0 | 57.7 / 17.0 |

### 10.1 The 20 × 20 room is essentially free — and your size call is the reason

−2.0 / −1.6 / −2.0 / +0.3 / −0.3 against the shipped curve, every cell inside the ±8 bar at n=300. Compare §3.1, where walls at the **current 14 × 10** cost −4.4 at d3 and put the cell *on* its contract floor.

**The extra space is what pays for the walls.** §0's finding running the other way: a bigger room lets the caster keep the 6-unit standoff that brief #15's cantrip fix depends on, which offsets the cost of no longer being able to retreat forever. **20 × 20 was the right call for reasons beyond fitting 6v8** — at 14 × 10 this pass would have tripped the contract; at 20 × 20 it does not.

### 10.2 ⚠ The AoO finding — a real bug, and the biggest rebalance in the pass

**`enemies.aoo_count` is read by nothing.** 40 of the 45 enemy rows carry `aoo_count: 0`; only five carry ≥ 1 (Hobgoblin Legionnaire, Hobgoblin Tactician, Vanguard Champion, The Whisper's Blade at 1, Vanguard-Captain Ruk Mor-Tal at 2). Meanwhile `encounter.ts` reads `hasAoo = (u) => !u.isHero || u.reactions.includes('aoo')` — **every enemy in the game gets an attack of opportunity**, and `buildEnemy` sets `reactions: []` with the comment *"enemies have intrinsic AoO in the encounter loop."*

**Content is authoritative here, and PF2E agrees with it.** Attacks of opportunity are a Fighter class feature and a property of specific monsters; a goblin does not have one. This is the mirror image of brief #14's bug B, where the code was authoritative — and it is worth stating the rule that decides it: *the side that matches the ruleset wins.*

Honouring the column takes AoOs per 300 runs from **1,304 → 575** at d1 and is worth **+3.6 / +6.3 / +7.6 / +9.3 / +8.3** on top of the room, d4 and d5 outside the ±8 bar. It also raises sneak-attack counts (156 → 240 at d1), because heroes surviving longer means the rogue swings more.

⚠ **This pushes d1–d3 to 93.3 / 90.0 / 86.3 against a target of "about 80%."** Same shape as brief #17 §9: a correctness fix that makes the entry band easier than the sentence asks for. The contract floors would need re-anchoring, and the honest question is whether difficulty comes back down to meet them.

### 10.3 ⚠ The ambush wiring measured at ZERO — and the reason matters

**`ambushTier` is rolled every combat room, emitted as `explore.ambush_resolved`, and never passed to `runEncounter`.** The entire five-tier surprise ladder is cosmetic today.

Wiring it — the surprised side opens off-guard for 10–30 ticks, which is what would make the rogue's opening strike a backstab — measured at **+0.0 / +0.0 / +0.4 / +0.0 / +0.4**. Nothing.

The tier distribution says why:

| | normal | partySurprise | partial | severe | total |
|---|---|---|---|---|---|
| d1 | 87.4% | **5.3%** | 6.9% | 0.4% | — |
| d3 | 85.2% | **0.0%** | 12.3% | 2.4% | 0.1% |
| d5 | 76.9% | **0.0%** | 19.6% | 3.6% | — |

**The party-favourable tier essentially never fires, and above d1 it fires never.** `detectDc = 12 + difficulty × 2`, and `partySurprise` needs `d20 + perception ≥ dc + 10` — that is 32 at d5, which a level-5 party cannot roll. **The ladder is structurally incapable of granting the party a surprise at depth**, so it cannot be the vehicle for backstab. That is a content/tuning fault in the DC curve, not a wiring fault, and wiring it without fixing the curve would ship a dead branch that *looks* implemented.

---

## 11. What is still open — two questions

1. ⚠ **AoO on arrival, or departure only?** You said *"as it pertains to melee engagement and departure from melee engagement."* **PF2E RAW: closing into reach does NOT provoke — only leaving does** (plus ranged/manipulate actions in reach, which the engine already models as the adjacent-cast provoke). Today the engine does departure + adjacent-cast and not arrival, i.e. it is already RAW. If you want arrival to provoke as well that is a deliberate divergence and I will measure it; if "melee engagement" meant "the melee engagement lifecycle", we are already there and only the `aoo_count` fix is needed.
2. ⚠ **What should "concealed / hidden for backstab" mean, given §10.3?** The ambush ladder cannot deliver it, and without cover or line of sight — both deferred — there is nothing in a bare 20 × 20 room to hide behind. Options:
   * **(a) Fix the ambush DC curve** so `partySurprise` is reachable at depth, then wire it. Content change, keeps the existing system, makes Perception matter.
   * **(b) A rogue-specific opening**: the rogue starts a fight undetected unless the enemy beats its Stealth, granting one guaranteed sneak. Smallest surface, most legible, does not need LOS.
   * **(c) Defer with LOS.** Hiding is a spatial rule and you have already deferred the spatial rules it depends on; take it in the same pass as the fog-of-war overlay.
   * My reading of *"for backstab purposes"* is that **(b)** is what you actually want and (a) is a separate content fix worth doing anyway — but this is a design call, not a measurement.

**Also for your call, since §10.2 forces it:** the AoO fix alone takes the entry band to 93 / 90 / 86. Re-anchor the contract floors upward, or bring difficulty back down to meet the 80% sentence? I would not bundle that decision into this pass — but the pass cannot land without one of the two.

---

## 12. §11 ANSWERED — and the pass is a much bigger rebalance than it looks

| §11 question | Steven's call |
|---|---|
| AoO on arrival or departure? | **Departure only.** |
| concealed/hidden for backstab | **"If the attacker backstabbing passes their conceal check it should trigger sneak attack damage."** |

**Departure-only means the AoO *trigger* needs no work at all** — `moveWithReactions` already provokes on leaving engagement, and the adjacent-cast provoke is PF2E's manipulate-in-reach trigger. The engine is already RAW. **The only AoO change in this pass is §10.2's `aoo_count` fix: who threatens at all.**

### 12.1 ⚠ The conceal check has no die to roll

`Stealth` is one of the 15 skills in the content registry. **The word `stealth` does not appear anywhere in `src/sim`.**

* The founding muster trains `athletics/perception` (fighter), `thievery/perception/athletics` (**rogue**), `perception/athletics` (cleric), `perception` (wizard). **Nobody trains Stealth — including the rogue, whose entire identity is sneak attack.**
* The autopilot's skill priorities are `['perception', 'athletics', 'thievery']`, so Stealth would never be raised on level-up either.
* `DispatchHero.skills` carries exactly `{ perception, thievery, athletics }`.
* **`Combatant` carries no skills at all**, so `resolveStrike` — where the check has to live — has nothing to read.
* Enemies have no `perception` column, so the DC has to derive (level + WIS).

This is the third instance of the same shape: `weapon_range: null` (brief #15 §1), `class_weapon_proficiency` read by nothing (brief #16 §5.1), and now Stealth. **The content carries the concept and the sim never reads it.** So the feature is a chain, not a line: muster → autopilot priorities → `DispatchHero` → `Combatant` → a derived enemy Perception DC → the check in `resolveStrike`. Touching the muster moves `career-distribution`.

### 12.2 What the backstab is worth, by pass rate

Rather than pick a DC and defend it, I swept the **outcome**: if the conceal check passes P% of the time, what happens? Measured on top of the approved pass (20 × 20 room + AoO from content), n=300, curve seeds, per ACTION, only for units with sneak dice, only when the target is not already off-guard.

| conceal passes | d1 | d3 | d4 | d5 | sneak attacks (d1) |
|---|---|---|---|---|---|
| **0% (approved pass)** | 93.3 / 3.0 | 86.3 / 6.7 | 49.3 / 24.0 | 57.3 / 17.3 | 240 |
| 25% | 94.0 / 2.3 | 85.0 / 7.0 | 55.7 / 18.0 | 58.0 / 15.3 | 444 |
| 50% | 95.0 / 1.3 | 86.3 / 6.0 | 59.3 / 13.7 | 61.0 / 13.0 | 657 |
| 75% | 95.0 / 1.3 | 89.0 / 3.7 | 61.7 / 10.3 | 67.3 / 6.3 | 856 |
| 100% | 95.3 / 1.0 | 89.7 / 3.3 | 62.3 / 9.0 | 69.3 / 5.0 | 1,063 |

**0% → 100% is worth +2.0 at d1, +3.4 at d3, and +13.0 at d4 / +12.0 at d5** — noise at the top of the band, decisive at the bottom, both outside the ±8 bar.

**This is the third time this exact shape has appeared** — gear (brief #16 §5.3: nothing at d1–d2, +12.3 at d3), interdiction (brief #17 §5: +2.6 at d1, +10.0 at d4), and now the backstab. Worth stating as a property of the game rather than rediscovering a fourth time: **a lever is worth nothing where the party wins anyway and everything where the fight is close.** It also means every one of these levers is really a *depth* lever, not a difficulty lever.

⚠ **One honesty note on the model.** I implemented a passed check as PF2E off-guard, which is −2 AC **and** sneak damage. You said "trigger sneak attack damage"; off-guard is the rules-correct carrier of that, but it brings the AC penalty with it. If you want sneak damage *only*, that is a deliberate divergence and the numbers above overstate it slightly.

### 12.3 The cumulative picture — this is the part that needs a decision

| | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| **shipped today** | 91.7 | 85.3 | 80.7 | 39.7 | 49.3 |
| + the 20 × 20 room | 89.7 | 83.7 | 78.7 | 40.0 | 49.0 |
| + AoO from content | 93.3 | 90.0 | 86.3 | 49.3 | 57.3 |
| **+ backstab @ 75%** | **95.0** | ~91 | **89.0** | **61.7** | **67.3** |

**The scoped "just build the room" pass is the largest rebalance since brief #15's milestone.** The room itself is free (§10.1). The other two changes are *correctness* fixes — the content says most enemies have no AoO, and a rogue should have Stealth — and correctness here means **substantially easier**: d3 goes 80.7 → 89.0, d4 goes 39.7 → 61.7, d5 goes 49.3 → 67.3.

Two consequences worth naming:

* **The 80% target is comfortably overshot at d1–d3** and the `dungeon-curve` floors (84 / 78 / 73) become meaningless as gates.
* **The 4–6 band gets most of the benefit**, which is where brief #17 wanted to reach and brief #14 called a content problem. The 7+ band is untouched and R4 still stands.

### 12.4 ⚠ The one decision left

**Does difficulty come back down to meet the 80% sentence, or does the sentence move?**

* **(a) Re-anchor the floors upward** and accept that at-level is now ~90% at d1–d3. Cheapest; changes what "at level" means.
* **(b) Re-tune difficulty back to ~80%** using the levers already costed and sitting unused — brief #14's Wall 3 (the AC proficiency term, NOT TAKEN because the band cleared without it), H4's `difficultyDcScale`, R2's rest-charge rate. This is what the headroom was being saved for.
* **(c) Land the pass in two commits** — the room alone first (free, §10.1), then the two correctness fixes with the re-tune in the same commit so the curve never sits in a state nobody chose.

**I would take (c) with (b) inside it.** The room is genuinely free and should not wait behind a balance argument; the AoO and Stealth fixes are correctness and should land *with* the re-tune that pays for them, so the contract is never silently wrong.

**And the sub-question (b) forces:** what conceal pass rate do you actually want? 50% reads as "the rogue gets a backstab about every other action", 75% as "usually". That choice sets the Stealth-vs-Perception DC curve, and it is a feel call, not a numbers one — the numbers above only say what each costs.

---

## 13. THE CONCEAL CHECK — specified, with the real numbers

**Steven, 2026-08-13:** *"the characters stealth skill plus a d20 plus equipment bonuses plus spell bonuses vs the other characters same values. If the roll check passes they are 'stealthed' for the attack and get sneak attack damage regardless if the enemy is flanked or not. If the enemy is flanked we don't bother with a stealth check and apply sneak attack damage anyway. We want the stealth skill to have some value."*

### 13.1 The two terms you named that do not exist

* **Equipment bonuses to Stealth: there is no such content concept.** `item_properties` rows carry `on_hit_effect` / `on_crit_effect` / `passive_effect` and nothing skill-shaped; no item anywhere grants a skill bonus.
* ⚠ **But the PF2E-correct equipment term DOES exist and is dead data: `armor_check_penalty`.** 17 item rows carry −1 to −4, and brief #16 §5.1 flagged it as read by nothing — **it still is**. In PF2E the armour check penalty applies to Stealth. Wiring it is the equipment term, it is free, and it makes the rogue's armour choice matter twice: the bracket already puts Shade in a Chain Shirt for `max_dex`, and now that Chain Shirt also costs **−1 to every backstab attempt**.
* **Spell bonuses to skills: none exist.** No spell in the registry buffs a skill check. Build the seam so the term is there; it sums to zero today.

### 13.2 ⚠ One reading to confirm

You wrote *"vs the other characters same values."* Taken literally that is an **opposed Stealth vs Stealth** check. PF2E — and the fiction — say **Stealth vs Perception**: hiding from someone turns on *their* awareness, not on how sneaky they are. I have specified it as **Stealth vs Perception, both sides composed identically** (skill + d20 + equipment + spell), which I believe is what "same values" meant. **If you meant opposed Stealth, it is a one-line change — say so.**

### 13.3 The check

```
attacker: d20 + stealthTotal   (ranks + DEX mod + feat + armor_check_penalty + spell[0 today])
defender: d20 + perceptionTotal (ranks + WIS mod + feat + spell[0 today])
attacker wins ties → "stealthed" for this ACTION → off-guard → sneak attack damage
```

* Rolled **once per action**, not per swing (PF2E: you Hide, then you Strike; per-swing would double it).
* **Skipped entirely when the target is already off-guard** — flanking, prone, grabbed, restrained, unconscious. Your rule: flanked means sneak applies with no check.
* Only attempted by units that have sneak dice. No enemy currently has any, so this is Shade-only in practice.
* ⚠ **`SKILL_ABILITY` is `{ perception: wis, thievery: dex, athletics: str }` — Stealth is absent, so it would silently default to WIS.** It must be added as `stealth: 'dex'` or the rogue's whole backstab keys off the wrong ability.

### 13.4 What the real numbers produce

Measured off the actual party and the actual enemy registry:

| | rogue | |
|---|---|---|
| L1 | DEX **+3**, Leather Armor, acp **0** | Stealth ranks: **0 — NOT TRAINED** |
| L3 | DEX **+3**, Chain Shirt, acp **−1** | " |
| L5 | DEX **+4**, Chain Shirt, acp **−1** | " |
| L7 | DEX **+4**, Chain Shirt, acp **−1** | " |

Enemy Perception DC on a `10 + level + WIS` derivation: **Goblin 11 · Skeleton 10 · Kobold 11 · Dragon Wyrmling (L7) 19.**

With Stealth trained on the same pattern as the rogue's other skills (muster grants 1, autopilot raises it), the attacker sits at roughly **+4 at L1–L3 and +6–7 at L5–L7**, which against those DCs is a pass rate of about:

| level | stealth total | typical DC | **pass rate** |
|---|---|---|---|
| L1 | +4 | 11 | **~70%** |
| L3 | +4 | ~13 | **~60%** |
| L5 | +6 | ~15 | **~60%** |
| L7 | +7 | 19 | **~45%** |

**~45–70%, centred near 60%** — which lands squarely inside §12.2's sweep, i.e. worth roughly **+10 at d4 and +4 to +10 at d5** on top of the approved pass, and noise at d1–d3. The rate *falls* with depth, which is the right direction: backstabbing a wyrmling should be harder than backstabbing a goblin.

### 13.5 The chain this actually requires

Because Stealth does not exist in `src/sim` at all (§12.1), the feature is six edits, not one:

1. `SKILL_ABILITY` gains `stealth: 'dex'`.
2. The founding muster trains Stealth on the rogue (and it is a class skill question for the others).
3. The autopilot's skill priorities — currently `['perception','athletics','thievery']` — must be able to raise it, or Stealth never grows. **This is what "we want the stealth skill to have some value" actually costs.**
4. `Combatant` gains `stealth` and `perception` totals, derived once in `assembleHero` (same place `engageRange` is derived).
5. `armor_check_penalty` is read for the first time and folded into the Stealth total.
6. `resolveStrike` takes the check, gated on `sneakAttackDice` and on the target not already being off-guard.

Touching the muster moves `career-distribution`. Items 1 and 3 are the silent ones: without them the feature ships and does nothing, which is exactly the failure mode brief #16's NC6 exists to catch — **so the regression test must assert that a trained rogue actually out-rolls a goblin more often than an untrained one, not merely that the code path runs.**

### 13.6 Still blocking

**§12.4 — the re-tune.** This pass now stacks the room (free), the AoO correctness fix (+3.6 to +9.3) and the backstab (+10 at d4). The at-level curve ends near **95 / 91 / 89 / 62 / 67** against a target of "about 80%". The re-tune decision is the last thing gating a landing, and I would still take §12.4 (c) with (b) inside it: ship the room alone first, then the two correctness fixes together with the re-tune that pays for them.

---

## 14. THE CHECK, FINAL — and a correction in your favour

**Steven, 2026-08-13:** *"Lets have stealth default to dexterity as a stat. Lets also have stealth checks go against either the stealth skill or perception, whichever is higher. Also regarding armor use penalties, don't forget that as characters level up every so often they can increase a core ability point which would affect their stat bonus. These can be further increased with equipment as well. Such as belt of dexterity or ring of strength. We just haven't gotten to implementing the content yet."*

### 14.1 ⚠ The correction: that content and that code path BOTH already exist

You flagged ability boosts and stat-boosting equipment as things to remember for later. **Both are already built, and the equipment content is already authored.**

* **Level-up ability boosts are fully implemented** (`levelUp.ts`), including boost-before-class ordering, CON boosts paying retroactive HP, and INT boosts feeding skill points. This is why §13.4's rogue measures DEX **+3 at L1–L3 and +4 at L5+** — the boost is already in those numbers.
* **`assembly.ts:203–212` already folds equipment into the ability mod:**
  ```ts
  const itemStat = aggregateStatBonuses(equipped);
  mods[key] = abilityMod(hero.abilities[key] + (itemStat[key] ?? 0));
  ```
* **And 19 items already carry `stat_bonus`** — including **Gloves of Dexterity +2**, **Gloves of the Thief +4**, Belt of Strength +2, Belt of Giant Strength +4, Headband of Intellect, Circlet of Wisdom, Cloak of Charisma, Boots of Speed.

**So the seam you asked me to remember is not a future task — it is live.** Because `skill(name) = ranks + mods[ability] + featSkill`, the moment Stealth is a derived skill keyed to DEX, **Gloves of Dexterity +2 raises every backstab check automatically, with no further work.** Gloves of the Thief +4 is worth +2 to the mod, i.e. +2 on every conceal roll — an item built for the rogue, wired to the rogue's mechanic, for free.

⚠ *One caveat worth carrying:* the shop finding (status.md) filters every `required_building_level > 1` row out of `shopStock()`, **which is exactly where the +2/+4 wondrous items live.** So these are lootable but not purchasable until town systems land. The backstab loop works; the *shopping* half of it does not.

### 14.2 The final check

```
attacker  = d20 + stealthTotal
defender  = d20 + max(stealthTotal, perceptionTotal)      ← your rule
attacker wins ties → "stealthed" for this ACTION → off-guard → sneak attack damage

stealthTotal    = ranks + mods.dex + featSkill + armor_check_penalty   (+ spell: 0 today)
perceptionTotal = ranks + mods.wis + featSkill                          (+ spell: 0 today)
mods.<ability>  = abilityMod(score + itemStat)   ← level-up boosts AND Gloves of Dexterity, already live
```

* `SKILL_ABILITY` gains **`stealth: 'dex'`** — settled. Without it Stealth silently defaults to WIS.
* **Defender uses whichever of Stealth or Perception is higher** — your call, and a deliberate divergence from PF2E (which is Stealth vs Perception DC only). It means a sneaky creature is also hard to sneak up on, which is coherent. Recorded as a divergence so nobody "fixes" it back.
* Rolled **once per action**; **skipped entirely if the target is already off-guard** (flanked, prone, grabbed, restrained, unconscious) — flanking grants sneak with no check.
* `armor_check_penalty` is read for the first time (brief #16 §5.1 flagged it as dead in the same breath as `item_level` and `class_weapon_proficiency`; this retires one of the three).

### 14.3 What is left to build

Down from §13.5's six edits to **four**, because the ability/equipment path is already there:

1. `SKILL_ABILITY.stealth = 'dex'`.
2. The muster trains Stealth on the rogue; the autopilot's priorities must be able to raise it (**this is what "stealth has some value" actually costs** — without it the skill never grows).
3. `Combatant` gains `stealth` and `perception` totals, derived once in `assembleHero` beside `engageRange`; `armor_check_penalty` folded in.
4. The check in `resolveStrike`, gated on `sneakAttackDice` and on the target not already being off-guard.

Negative control, per the standing rule: **a trained rogue must out-roll a goblin measurably more often than an untrained one.** Asserting the code path runs is not enough — items 1 and 2 are exactly the silent failures that would ship a feature that does nothing.

**Still blocking a landing: §12.4, the re-tune.** Nothing else.
