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

## Waiting on Steven

**Brief #27 is APPROVED WITH AMENDMENTS (2026-09-13).** Steven's five answers are recorded in its
§9. Three follow-on sessions are set up and ready to start — see `output/briefs/INDEX.md`:

| Order | Session file | Becomes | First thing it must do |
|---|---|---|---|
| 1 | `SESSION-class-abilities.md` | #29 | **Audit the 144 inert feats** before designing anything |
| 1 | `SESSION-enemy-specification.md` | #30 | Verify `pickAction` works for non-heroes |
| 2 | `SESSION-ranged-enemies.md` | #28 | Write the balance brief; no code first |

⚠ **Copy-paste prompts: `output/briefs/SESSION-PROMPTS.md`.**

✅ **`build.ts` collision resolved by sequencing** — #30 owns it; #28 runs after #30, not in parallel (Steven, 2026-09-13).

*Nothing else is blocked on a decision.*

---

## The ranked backlog

### 1. Enemy abilities — brief #26 — ✅ M1+M2+M3 SHIPPED 2026-09-13

**M1 (riders), M2 (resistance/weakness/immunity) and M3 (positional/conditional) are built.**
`enemies.abilities` now reaches the engine: `src/sim/combat/enemyAbilities.ts`, wired through
`buildEnemy`, `applyDamage`, `resolveStrike` and the encounter tick loop.

Shipped: poison, disease, trip, gore, energy_drain, dark_bolt, sneak_attack_1d6, stealth,
undead_immunities (derived), fire_weakness, **pack_tactics, formation_bonus, charge, ferocity,
regeneration_10**. **16 of the 19 reachable abilities.**

**M3 decisions and traps, recorded:**

- **`pack_tactics` is NOT flanking.** Flanking needs two allies on opposite sides and grants sneak
  damage; pack tactics needs ONE ally in contact from any angle and grants +2 to hit. Collapsing
  them would make every wolf pair a flanking pair and rebalance the rogue.
- **`formation_bonus` requires an ally of the SAME base**, not any ally — a hobgoblin beside a wolf
  is not in formation. The discipline is the point.
- **`charge` pays out once**, on the swing that ends an approach of ≥6 units, and is cleared after
  the swing. ⚠ `chargeStartDistance` is set ONCE per approach, not per tick — setting it per tick
  would leave it holding the last step's distance and the bonus would never fire.
- **`ferocity` lives in `applyDamage`**, the only place hp reaches zero, so riders/spells/AoO/traps
  all trigger it. It emits `combat.reaction_triggered` with `reactionId: 'ferocity'` — ⚠ **reusing
  the frozen event schema rather than adding a type**, since it genuinely is a reaction.
- **`regeneration_10` ticks on `attackIntervalTicks`, not per sim tick.** At 100ms/tick, per-tick
  regeneration would return 10 hp ten times a second and no party could kill a Troll. It also
  requires `hp > 0`, so it never raises the dead — `fire_weakness` is the authored counterplay and
  both landed in the same brief on purpose.
- ⚠ **All five M3 numbers live in `enemyAbilities.ts`, not in the combat loop** — migration-plan
  risk R2: translation knobs belong in data, so the re-tune edits one file.

Decisions taken (Steven, 2026-09-13):

- **Q1 scope — M1+M2 only.** M3/M4 deferred below.
- **Q2 — `undead_immunities` covers poison and disease ONLY**, not the full PF2E bundle. Authoring
  immunity to systems that do not exist would repeat the very defect this brief fixed.
- **Q3 — immunity DERIVES from `enemy_type`, not from the ability string.** ⚠ Measured consequence:
  10 rows are `enemy_type: 'undead'` but only 7 name the ability, so at playable depths the count of
  immune enemies went **4 → 7** — Bone Conscript, Grave-Whisperer and Barrow Wight gained immunity
  they never had. Intended: they are undead.
- **Q4 — `slow` not built.** It lives in M4, which is deferred; the zombie-differentiation question
  is deferred with it.
- **Q5 — the 16 L7+ abilities deferred** to the 7+ band brief. Nothing can meet them at d1–d5.

**Measured effect on the curve** (n=300/cell, baselines re-taken):

| | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| completion before | 95.0 | 92.7 | 89.3 | 61.3 | 71.0 |
| completion after | 94.7 | 91.7 | 89.0 | **57.7** | 69.7 |
| wipes before | 1.3 | 1.3 | 4.0 | 10.3 | 4.0 |
| wipes after | 1.7 | 2.3 | 3.7 | **14.3** | — |

**M3's additional effect** (n=300, measured on top of M1+M2): d3 89.0 → 88.7, **d5 69.7 → 65.0**,
d5 wipes 6.3 → 10.7. ⚠ **d5's −4.7 is the largest single move of the whole brief and it is STILL
inside the ±8 bar** — see `output/reference/measurement.md`, where the bar is now measured rather
than extrapolated (worst observed spread at d5: 8.3 at n=300).

⚠ **EVERY COMPLETION DELTA IS INSIDE THE ±8 NOISE BAR, so the curve is NOT evidence that this
works.** The direction is right (harder, as predicted) and d4 moved most, but −3.6 at d4 cannot be
distinguished from noise at n=300. **The exposure tests are the evidence** —
`tests/combat/enemyAbilities.test.ts` (12 tests) and `tests/combat/enemyAbilitiesM3.test.ts`
(11 tests), verified by **eight separate negative controls**. M1+M2: stripping the rider wiring
fails 3, stripping the damage-modifier lookup fails 2, switching immunity back to the ability string
fails 1. M3: zeroing each of pack tactics, formation, charge, ferocity and regeneration fails
exactly one test apiece, with `src/` confirmed byte-identical after each restore.

⚠ **One exposure test was rewritten because a sabotage run proved it worthless.** It asserted
`skeleton.damageModifiers.immune.has('poison')` — reading the TABLE — and stayed green with
`applyDamage` gutted. It now drives a venomous weapon into a Skeleton and asserts zero poison
damage **with the event still emitted**. Same family as brief #22's tautological gate; the lesson
keeps re-earning its place.

**Still deferred — M4 only:**

- **M4 (save-gated control):** `paralysis`, `web`, `slow`, `trap_expertise`. ⚠ **The brief itself
  flags M4 as the one to cut** — enemy control effects applied to the party are the sharpest balance
  lever in the game, and the curve still overshoots at d1–d3. `slow` carries an open design question
  (slow-but-tough zombie, or one that ignores speed penalties) deferred with it.
- ⚠ **`trip` currently applies `prone` WITHOUT an opposed athletics check** — the rider channel has
  no place to hang a contest. Revisit with M3/M4, where the contest machinery is in scope.

### 1b. ⚠ THE FEAT SYSTEM IS 63% INERT — the largest instance of the recurring defect

**Measured 2026-09-13 via `isEffectReady`** (the repo's own predicate, not a text search):

| | count |
|---|---|
| Feats authored | **227** |
| Feats that reach the engine | **83** |
| **Feats that do NOTHING** | **144 (63%)** |
| Classes with ZERO feats authored | **5 of 13** — Ranger, Bard, Arcane Trickster, Eldritch Knight, Mystic Theurge |

Per class (live / authored): general+skill 26/43 · Fighter 9/23 · Rogue 9/23 · Cleric 9/23 ·
Monk 7/21 · Wizard 7/24 · Sorcerer 6/24 · Warlock 6/23 · **Barbarian 4/23**.

**In player terms: you pick a feat at level-up and, 63% of the time, nothing changes in the fight.**

⚠ **This is the EIGHTH occurrence of content authored against a contract with no consumer**, after
`class_weapon_proficiency`, `items.onHitEffects`, `items.stat_bonus`, the 96 buff/debuff spell rows,
`enemies.abilities`, `items.loot_tier` and `quests.prerequisites`. It is the largest by a wide
margin.

⚠ **It also blocks the specialization design Steven asked for.** The "Barbarian who deals more damage
the lower their health" is his own example, and the Barbarian is the worst class in the table at
**4 of 23**. You cannot design 7 paths × 13 classes on a system that cannot express them.

**Next step:** `output/briefs/SESSION-class-abilities.md` — Phase 1 is the audit, design comes after.

### 2. Arena / room geometry — ⛔ DROPPED 2026-09-13 (Steven's call)

**Dropped as a feature.** A player cannot perceive room shape: the arena is one room, no collision,
no cover, no line of sight. It was only ever ranked high because it must precede the re-tune — and
the re-tune is itself held (#3). It is a **balance lever worth 11–13 completion points**, not
something a player would notice as content.

Costing is preserved in `output/briefs/arena-costing.md` if it is ever revived.


### 3. THE RE-TUNE

**Blocked by items 1 and 2.** Scope: levels, mob counts, surface difficulty, the backstab's flat
depth curve, and restoring `career-distribution`'s lost signal.

Standing call (brief #22 D5): **the dungeon curve is not a gate until enemy content lands.** Dungeons
are expected to get harder as enemies gain abilities; tuning before that measures the wrong game.

⚠ **Re-measure creature size during this pass.** Huge is entirely unmeasured — its only row (Adult
Red Dragon, L12) cannot spawn at d1–d5, so the "size is free" finding rests on six Large rows, not
eight, and does not transfer to d6+.

**⚠ The re-tune's named failure mode was predicted in advance (migration plan, risk R2).** The
PF2E→real-time translation has no precedent in the tuned data: MAP became flurry decay, the 3-action
economy became cooldowns, initiative became engagement speed. Because this is an auto-battler, **no
player skill masks an imbalance** — the failure mode is bimodal, steamroll-or-wipe. The mitigations
specified then, and still correct:

- **Tune to histograms, never to averages.** A mean hides a bimodal distribution completely.
- **Translation knobs — decay rates, cooldown curves, engagement radii — live in DATA, never in code.**
- Hand-check golden scenarios against playtest memory rather than trusting aggregate rates.

### 4. The shop sells armour — ✅ SHIPPED 2026-09-13 (commit `a422c50`)

All 8 armour rows moved to `required_building_level: 1` via `data/seeds/seed_shop_sells_armour.sql`
(Option A). **In player terms: you can now buy armour.**

⚠ **The gate is DEFERRED, not deleted.** `session.shopStock()` still skips `required_building_level
> 1`, and **building levels do not exist anywhere** in save, session or campaign state. The seed
preserves each row's original intended level in a comment so the gate can be restored when town
systems land. 45 non-armour rows remain gated behind levels 2–3.

Evidence: `tests/campaign/shopArmour.test.ts`, 4 tests asserting the **consumer** (armour reaching a
player through 20–40 weeks of real shop rotation), not the content table. Negative control: putting
the rows back behind levels 2/3 fails 3 of the 4.


### 5. Content-reachability tests

Proposed in brief #24 §7, **not built**.

⚠ **The recurring defect in this repo is content authored against a contract with no consumer — it
has happened five times**, and nothing catches it because inert content breaks no test. This is the
structural fix. Details in `output/reference/content.md`.

### 6. Dead content fixes

⚠ **Re-audited 2026-09-13 against the code. Two entries flipped and seven numbers were wrong** —
full corrected inventory in `output/reference/content.md`. Headlines:

- **The ambush ladder is worse than recorded.** 0% at d3 and d5 is right (d1 is exactly 5.0%, not
  5.3%), but even when surprise DOES fire it changes nothing: `runEncounter` takes **no tier
  argument** and `combat.started.ambushTier` is never populated. **All five tiers are pure UI
  narration.** Fixing the DC alone would buy nothing — the mechanical channel does not exist.
- **`class_progression.features` is 44 of 47 dead** for the founding four (not 45 — `sneak_attack_1d6`
  is named on both Rogue L1 and L2). Across all 13 classes: **307 of 314**.
- **`items.loot_tier` is dead and was never on the list.** Zero consumers.
- ⚠ **`2^(level − difficulty)` in `pickEnemies` was NEVER a no-op** — that claim was false
  arithmetic. The combat band spans three levels, so a third of every draw pool costs double. Only
  the boss branch is flat, by design. **Nothing to fix here; the entry was wrong.**
- **The shop defect is exact:** 53 of 105 rows skipped, 0 of 8 armour rows survive. But **Gloves of
  Dexterity +2 is not in `shop_stock` at any level**, so it was never a valid example of it.


### 6b. ⚠ THE CONTENT LONG POLE — brief #27 FOR APPROVAL

The 2026-08-10 migration plan named this risk **R4**: combat/build data arrives ~90% complete
because it converts from Godot, while the layer the loop *lives on* is solo-authored and starts near
zero. It called that correctly. **What it got wrong was the axis.**

⚠ **THE ROW-COUNT TARGET (300–500 enemies / 300–400 quests) IS SUPERSEDED** by Steven's 2026-09-13
instruction and by brief #27: specify the **taxonomy**, not the count.

**The measurement that settles it:** the last enemy batch this project authored — the 21-row
Vanguard's Shadow set, ids 100–120 — wrote an **EMPTY `abilities` string on 21 of 21 rows**. Three
distinguish at all, and all three by accident, via derived undead immunity. Fingerprinting real
fights over 31 rows × 6 seeds yields **8 behavioural signatures, with 17 rows sharing one**. Reaching
300 rows that way produces 300 statblocks that fight identically.

**The engine has exactly six behavioural channels** (rider · damage modifier · sneak dice · stealth ·
AoO · size radius, plus `speed` as a borderline seventh). Everything else is a number, and two rows
differing only in numbers fight identically. That is the binding constraint on all content volume.

**Brief #27 proposes 7 families × 5 brackets × 6 roles**, absorbing 39 of the 45 existing rows.

⚠ **BRACKETS IV AND V (L13–20) ARE UNREACHABLE.** No quest exceeds difficulty 10, and with
`levelBand: 1` the highest enemy level a player can meet is **11**. Authoring them would be
unverifiable — the same anti-goal that deferred #26's 16 L7+ abilities. The existing L12 Adult Red
Dragon is already past the ceiling.

⚠ **The Archer role is BLOCKED.** `build.ts:50–52` hardcodes `weaponRange: 1` / `engageRange: 1` —
**every enemy in the game is melee.** Ranged enemies change every closure time in the game and need
their own brief.

⚠ **Zero legal-but-unused vocabulary.** All 14 live ability words (9 + M3's 5) are already in use, so
new distinguishing rows need new abilities, not recombination.

Remaining content state, for reference — but **do not read these as targets**:

| Content | Built | Note |
|---|---|---|
| Enemy bases | 45 | 42.2% distinguishing after #26 M3 |
| Quests | 22 | ceiling is difficulty 10 |
| Items | 183 | `loot_tier` still dead on all of them |
| Spells / Feats / Class progression | 218 / 227 / 230 | ✓ complete |


### 6c. CI and the bundle-size gate — ✅ BUILT 2026-09-13

`.github/workflows/check.yml` runs on every push to `main`, every PR, and on demand:

| Job | Steps |
|---|---|
| **check** | typecheck · lint · unit tests · build · **bundle-size gate** · uploads the artifact |
| **e2e** | installs Chromium · `pnpm e2e` (builds, then Playwright against the BUILT artifact) · uploads the report on failure |

**The size gate** is `tools/check-bundle-size.mjs`, wired as `pnpm size`. Thresholds are the ones the
migration plan specified in August: **warn at 8 MB, fail at 12 MB**, uncompressed. The artifact sits
around **20% of the fail ceiling**; `pnpm size` prints the current figure.

⚠ **The gate reports in 1000-byte kB, matching Vite and every size written down in this repo.** Using
1024 makes it read ~2.4% smaller than `vite build` and starts an argument about which number is real.

⚠ **`--json` exists for tooling. Do not raise the ceiling to make a build pass** — the ceiling is the
player's download. Lazy-load `src/content/generated/figures.ts` before dropping any art.

**Verified by negative control** (2026-09-13): padded the artifact to 9.4 MB → warns, exits 0; padded
to 13.4 MB → fails, exits 1; restored → passes. A size gate that has never been seen to fail is
decoration.

⚠ **CI PASSING IS STILL NOT PROOF THE GAME RUNS.** These jobs run on Linux; Steven plays on Windows,
and the one bug class that has actually shipped a blank page — two modules differing only by case —
passes every Linux test. **The `pnpm dev` check on Windows remains required** after any change that
adds files or moves module wiring.

**Not yet done, deliberately:** no branch protection is configured, so CI reports but does not block.
Turn that on in the GitHub repo settings when the red X has proven itself trustworthy.

### 7. Audio

**No audio code exists in `src/` at all.** Not placeholder sounds — none. **The game is completely
silent.**

This is a **Phase 3 exit criterion**, which is why Phase 4 is not next. The design survived the
migration (4-domain event tree, category presets, Web Audio + a build-time manifest) — see
`output/decision-ledger.md` Area 8. Sorting the raw audio remains a content task.

### 8. Playwright visual baselines — ⏸ DEFERRED 2026-09-13 (Steven's call)

A Phase 3 exit criterion, unmet, and **deliberately staying unmet for now.**

**Player-facing value when it lands:** it catches the game *looking* broken while working — an
invisible button, overlapping text, a collapsed panel. Unit tests structurally cannot see any of
that.

⚠ **Why deferred:** baselines against a UI that is still moving generate constant false failures,
and a gate that cries wolf gets ignored — which is worse than not having it. Revisit when the UI
settles.


### 8b. A repeatable doc→visual pipeline (`pnpm viz`)

**Why this is on the backlog:** Steven is dyslexic and asks for a visual every time a dense read-out
appears. Today each one is hand-built as a throwaway HTML file in `$LOCALAPPDATA/Temp`, which means
the same layout work is redone every session and **none of it is version-controlled or regenerable**
when the underlying numbers move.

**In player-facing terms this ships nothing** — it is pure workflow. It earns its place by making
every future design review faster and by killing a recurring failure mode.

**The precedent already exists and works:** `tools/build-class-chart.mjs` (`pnpm class-chart`) parses
`output/reference/class-progression-sheets.md` into a tabbed HTML chart, and **asserts 13 classes /
230 rows with `process.exit(1)` if the parse loses data**. That validate-or-die rule is the whole
value: a reformatted source fails loudly instead of silently emitting a half-empty chart.

**Proposed scope:**

- `tools/build-viz.mjs`, wired as `pnpm viz`, emitting into `output/reference/*.html`.
- **Generators read the repo's own data** (`src/content/generated/*.ts`, the harness snapshots, the
  markdown docs) — never retyped numbers. Retyping is how a visual drifts from the game.
- Every generator **asserts its input shape and exits non-zero on a mismatch**, following the
  class-chart precedent.
- Shared theme header so output matches the desk grammar and the app's injected CSS vars
  (`var(--foreground)`, `var(--border)`, …) rather than hardcoded colours.
- First three generators, chosen because each already had to be hand-built once:
  **the enemy taxonomy matrix** (brief #27), **the content-reachability status board**, and
  **the dungeon curve vs the ±8 bar**.

⚠ **Three environment traps this must route around** — all three were hit on 2026-09-13 and all
three are already documented in the `guild-vigil` skill:

| Trap | What happens | The working path |
|---|---|---|
| `file://` in the automated browser | `ERR_BLOCKED_BY_ADMINISTRATOR` | render inline with `::preview{file="..."}` |
| localhost in the automated browser | "URL targets a private or internal address" | same — `::preview` needs no server |
| `python -m http.server` from `terminal` | refused as a long-lived process; needs `background=true` | avoid entirely; `::preview` is the supported path |

⚠ **`::preview{file="C:/abs/path.html"}` is the ONLY verified way to show Steven an HTML artifact on
this box.** Both browser paths are blocked by policy. The generator should therefore emit a file
path and let the chat surface render it — never try to screenshot its own output.

**Estimated effort:** half a session for the harness plus the first generator; each additional
generator is small once the theme header and the assert helper exist.

### 9. Art pass

- **Hero figures: 12 of 12 ship.** All ancestry/sex paperdoll figures are done.
- **Hero busts: 4 of 12.** Eight hero subjects fall back to the sketch-pending silhouette — that
  fallback is a normal play path, not an error.
- **NPC and enemy art is PARKED by decision (2026-08-12)** — the silhouette IS the placeholder.

Pipeline and its hard-won traps: `output/reference/ui-and-art.md`. Style law:
`output/art-style-bible.md`.

### 10. `career-distribution` — ⛔ DROPPED FROM THE PLAN 2026-09-13 (Steven's call)

**Removed from the roadmap. Something more robust will replace it later.**

The harness is DEGENERATE and cannot report anything: `completionRate 1.0 · wipeRate 0 · failRate 0
· idleWeekRate 0 · ambushDeaths 0`, with every assertion a one-sided floor, so nothing can fire.
⚠ **A green `career-distribution` is worth nothing as evidence** — do not cite it.

It was the only harness that answered "is a 20-week campaign actually fun?" (snowball, gold
relevance, hero death). That question still matters; this instrument is not the answer, and fixing
it now would measure a game that is about to change.

⚠ **The snapshot file stays** (`tests/harness/__snapshots__/career-distribution.test.ts.snap`) —
deleting the test would silently drop coverage of the campaign loop's *shape*, degenerate or not.


---

## Held, parked and not-yet-built

| Item | State | Note |
|---|---|---|
| **Threat / taunt mechanic** | ⚠ **HELD BY MEASUREMENT** | Measured **−3.5 completion, +8.5 wipes**. It made the game worse. Revisit only after tank survivability improves. |
| **Melee interdiction — the PIN form** | ⚠ **HELD BY MEASUREMENT** (brief #17 §4) | Enemy engaged by a melee hero cannot walk past him. **Measured −5.3 to −8.3 completion, wipes up 3.7 to 9.5.** It redistributed damage roughly TWICE as hard as threat did (back-line share of incoming 61.2% → 12.2%) and lost for the same reason. |
| **R4 — the 7+ level band** | HELD | |
| **Multi-team play (up to 4)** | NOT BUILT | Core loop L3. One team today; the 4-team Tavern-gated structure is the target, not the code. |
| **Authored story spine** | NOT BUILT | Core loop L4. No storyline packs, no authored ending. |
| **Tauri desktop wrap (brief #7)** | PARKED | Parked by decision, not cancelled. |
| **Dialogue trees** | DEFERRED | Post-launch (decision ledger Area 7). |

### ⚠ The rule both held combat mechanics share

Threat/taunt and the interdiction pin were designed on different axes — threat changes target
SELECTION, the pin changes REACHABILITY — and brief #17 was written specifically to test whether
that difference mattered. It does not:

> **Any mechanic that MOVES the party's incoming damage onto the fighter loses. Any mechanic that
> DELETES the attack wins. Where the damage is aimed is not the variable — whether it lands at all is.**

The cause is the same in both cases: **the fighter has no mitigation**, so concentrating damage on
him converts spread chip damage into a dead front line. ⚠ **Do not propose a third
damage-redistribution mechanic before tank survivability exists** — it has now been independently
measured twice, and the second test was designed to escape the first's verdict and did not.

⚠ **A HOLD FOR SCOPE IS NOT A HOLD BY MEASUREMENT.** The table above says which kind each one is,
because the two have been conflated here before: the `combat_action` loadout verb was logged as
"unmeasured" in the same sentence as the threat mechanic, drifted into "held", and eventually shipped
in brief #22 as the `ability` verb. **Check which kind of hold you are looking at before reviving or
dismissing anything.**

---

## Then — Phase 4, and what it will cost

Phase 4 (platform wrap and packaging) is gated behind audio and the visual baselines above.

**Scope:** Tauri 2 desktop shells (Win/macOS/Linux) · `SaveStore` FS backend · the *same* single-file
artifact browser-playable on itch with the localStorage backend as a capped demo · Steam/GOG
packaging · mobile layout passes · iOS/Android via Tauri 2 mobile.

⚠ **Unbought toolchain cost — budget this as schedule, not as a surprise.** Phases 1–3 need only the
JavaScript toolchain, which is why none of it is installed yet.

| Target | Needs | Size |
|---|---|---|
| Desktop (Tauri 2) | Rust MSVC (`rustup default stable-msvc`) + VS 2022 Build Tools with the **Desktop development with C++** workload. WebView2 already ships with Windows. | **~8 GB** |
| Android | Android Studio (SDK + NDK + platform tools), JDK 17, `rustup target add aarch64-linux-android`. Env: `JAVA_HOME` / `ANDROID_HOME` / `NDK_HOME`. | **~10 GB** |
| **iOS** | ⚠ **REQUIRES A MAC.** Xcode does not run on Windows. | **Mac hardware or macOS CI runners** |

macOS and Linux desktop builds are produced on those platforms, or on GitHub Actions runners — which
is the recommended route and the same workflow that would later do Steam depot uploads.

**Exit criterion:** an identical campaign playable on the desktop app, in the browser, and on one
mobile target, from one artifact differing only in its persistence backend.

⚠ **Trouble signals:** platform-conditional code outside `src/platform` · mobile WebView performance
forcing sim changes (it must only ever force *presentation* changes).
