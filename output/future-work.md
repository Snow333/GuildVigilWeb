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

### 1. Enemy abilities — brief #26 — ✅ M1+M2 SHIPPED 2026-09-13

**M1 (riders) and M2 (resistance/weakness/immunity) are built.** `enemies.abilities` now reaches the
engine: `src/sim/combat/enemyAbilities.ts`, wired through `buildEnemy` and `applyDamage`.

Shipped: poison, disease, trip, gore, energy_drain, dark_bolt, sneak_attack_1d6, stealth,
undead_immunities (derived), fire_weakness. **11 of the 19 reachable abilities.**

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

⚠ **EVERY COMPLETION DELTA IS INSIDE THE ±8 NOISE BAR, so the curve is NOT evidence that this
works.** The direction is right (harder, as predicted) and d4 moved most, but −3.6 at d4 cannot be
distinguished from noise at n=300. **The exposure tests are the evidence** —
`tests/combat/enemyAbilities.test.ts`, 12 tests, verified by three separate negative controls:
stripping the rider wiring fails 3 tests, stripping the damage-modifier lookup fails 2, and
switching immunity back to reading the ability string fails 1.

⚠ **One exposure test was rewritten because a sabotage run proved it worthless.** It asserted
`skeleton.damageModifiers.immune.has('poison')` — reading the TABLE — and stayed green with
`applyDamage` gutted. It now drives a venomous weapon into a Skeleton and asserts zero poison
damage **with the event still emitted**. Same family as brief #22's tautological gate; the lesson
keeps re-earning its place.

**Still deferred here — M3 and M4:**

- **M3 (positional/conditional):** `pack_tactics`, `formation_bonus`, `charge`, `ferocity`,
  `regeneration_10`. 5 more abilities, no new engine systems.
- **M4 (save-gated control):** `paralysis`, `web`, `slow`, `trap_expertise`. ⚠ **The brief itself
  flags M4 as the one to cut** — enemy control effects applied to the party are the sharpest balance
  lever in the game, and the curve still overshoots at d1–d3.
- ⚠ **`trip` currently applies `prone` WITHOUT an opposed athletics check** — the rider channel has
  no place to hang a contest. Revisit with M3/M4, where the contest machinery is in scope.

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

**⚠ The re-tune's named failure mode was predicted in advance (migration plan, risk R2).** The
PF2E→real-time translation has no precedent in the tuned data: MAP became flurry decay, the 3-action
economy became cooldowns, initiative became engagement speed. Because this is an auto-battler, **no
player skill masks an imbalance** — the failure mode is bimodal, steamroll-or-wipe. The mitigations
specified then, and still correct:

- **Tune to histograms, never to averages.** A mean hides a bimodal distribution completely.
- **Translation knobs — decay rates, cooldown curves, engagement radii — live in DATA, never in code.**
- Hand-check golden scenarios against playtest memory rather than trusting aggregate rates.

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

### 6b. ⚠ THE CONTENT LONG POLE — the largest unbuilt thing in the game

The 2026-08-10 migration plan named this as risk **R4**: combat/build data would arrive ~90%
complete because it converts from Godot, while the layer the loop actually *lives on* is solo-authored
and starts near zero. **Measured 2026-09-13, it called this correctly:**

| Content | Built | Target | Of target |
|---|---|---|---|
| **Enemy bases** | **45** | 300–500 | **12%** |
| **Quests** | **22** | 300–400 | **6%** |
| Items | 183 | 300–500 bases | ~46% |
| Spells | 218 | 205 + 12 | ✓ complete |
| Feats | 227 | 227 | ✓ complete |
| Class progression | 230 | 230 | ✓ complete |

⚠ **Brief #26 does NOT address this.** It makes the 45 existing enemies fight differently; it does not
author the missing 255–455. Both are needed and they are separate pieces of work.

**The mitigations the plan specified, still valid:**

- A **vertical slice proves the pipeline before batch production** — brief #6 did this for content;
  do it again per content type rather than authoring 300 quests against an unproven format.
- **Machine gates so volume never outruns integrity** — count gates, schema validation, and the
  content-reachability tests in item 5 above. ⚠ Volume without reachability tests is how this repo
  produced five separate cases of content with no consumer.
- **The quest scheduler is designed to degrade gracefully with a small pool**, so the game stays
  playable at every content level. Do not let a large authoring push become a prerequisite for play.

### 6c. CI and the bundle-size gate — ✅ BUILT 2026-09-13

`.github/workflows/check.yml` runs on every push to `main`, every PR, and on demand:

| Job | Steps |
|---|---|
| **check** | typecheck · lint · 880 unit tests · build · **bundle-size gate** · uploads the artifact |
| **e2e** | installs Chromium · `pnpm e2e` (builds, then Playwright against the BUILT artifact) · uploads the report on failure |

**The size gate** is `tools/check-bundle-size.mjs`, wired as `pnpm size`. Thresholds are the ones the
migration plan specified in August: **warn at 8 MB, fail at 12 MB**, uncompressed. Today's artifact is
2,377.54 kB — **19.8% of the fail ceiling**.

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
