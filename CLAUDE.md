# Guild Vigil (web) — Claude Code Orientation

Guild Vigil is a story-driven, multi-team guild-management RPG (PF2E-flavored,
continuous-time auto-battler combat) being rebuilt from Godot in TypeScript.
**Stack:** TS strict · React 19 · Vite (single-file artifact) · Vitest · Playwright. (Tauri 2 planned — brief #7 parked.)
**Phase:** 3 substantially complete but **NOT to its exit criteria** — audio (no audio code in `src/` at all) and Playwright visual baselines are both unmet, so **Phase 4 is not next.** Phases 1–2 complete. Briefs #8–#19 shipped: art direction, type program, art integration, the readability pass, combat playback, dungeon balance (#13), the dungeon regression harness (#16), the party-AI milestone (#15 + #14's approved halves: cantrips, intent-derived `engageRange`, R2, H4, the two equipment contract bugs), the playtest pass (#18 findings 2+4) and **the combat room (#19 — walls, AoO from content, the backstab)**. **#17 (melee interdiction) is committed FOR DECISION only** — §12's four questions are open and none of its code has shipped. Suite: **483 unit + 11 e2e** green, bundle **1,239.30 kB**. ⚠ **The at-level curve now OVERSHOOTS the ~80% target**: d1–d5 complete at **95.3 / 91.3 / 88.3 / 57.0 / 64.7**, wipes **1.0 / 2.3 / 4.7 / 16.3 / 10.0** (`tests/harness/dungeon-curve.test.ts`), and the contract floors (84 / 78 / 73) sit **slack** beneath it. Next: **THE RE-TUNE** (levels, mob counts, statblocks, surface difficulty, `career-distribution`'s lost signal, the backstab's flat depth curve) and/or **further arena work** — ⚠ **these interact**: room geometry is a first-order balance parameter (#19 §0 measured a corridor at 11–13 points of completion at d3–d5), so do not re-tune against a geometry that is about to change. Then audio → the shop-sells-no-armour problem → R4 (7+ band, HELD) → visual baselines → Phase 4. ART IS PARKED by decision 2026-08-12 — the silhouette fallback IS the placeholder for every un-drawn subject.

## Authoritative documents — read before designing anything

- `output/core-loop.md` — the settled game loop and all structural decisions. Conflicts resolve toward this file.
- `output/decision-ledger.md` — per-feature Keep/Change/Remove verdicts, all confirmed.
- `output/guild-vigil-migration-plan.md` — phases, scaffolding, risks (Part IV = this repo's layout).
- `output/briefs/*.md` — design briefs. APPROVED: event vocabulary, escalation, loot grammar, profile AI, content slice, phase-2 UI, art direction, type program, art integration, ux-pass, combat-playback, dungeon-balance, dungeon-level-wall (#14, decision record §9), party-ai (#15, implementation record §12), dungeon-harness (#16), playtest-pass (#18), **combat-room (#19)**. **FOR DECISION, not approved:** melee-interdiction (#17). PARKED: Tauri wrap.
- ⚠ **A brief with a `-findings.md` companion has been CORRECTED by it.** The brief stays as approved; the findings doc is the implementation record and **wins on every measured fact**. `combat-room-findings.md` overrides brief #19 §§12.1 and 13.4 in three places (see the combat-room gotchas below) — do not re-derive them, and do not trust the brief over them. Same for `combat-playback-findings.md`.
- **HELD by measurement, do not revive casually:** the threat/taunt mechanic (measured −3.5 completion / +8.5 wipes — it needs tank survivability first) and the `combat_action` loadout verb. New systems get a brief BEFORE code (implementation-brief process); design calls go to Steven as numbers and options, never as a finished opinion. **Brief #8 (art direction) is the normative contract for ALL UI work** — see the desk grammar section below.

## The Eight Constraints (law, not guidance)

1. **The sim has zero renderer dependency.** Everything under `src/sim/**` is pure TS: no React, no DOM, no Tauri, no browser globals. Constructible and runnable from Node with no UI.
2. **The boundary is enforced at build time** — `eslint.config.js` fails the build on violations. If the sim seems to need a browser global, the design is wrong.
3. **The sim runs headless and cheaply.** One resolution path serves live play, forecasting, and harnesses. Budget: a full dispatch ≤ ~50ms.
4. **Sim emits events; presentation interprets.** No player-facing text in resolvers, ever. Events are facts.
5. **Randomness is string-seeded and namespaced** (`Rng`, `Seeds` in `src/sim/core/`). Derived content recomputes from facts; never store what you can derive.
6. **Persistence goes through `SaveStore`** (`src/sim/save/`). Never touch localStorage/fs directly. This includes the player-wide `UserSettings` record (`loadSettings`/`saveSettings`; web key `gv_settings`, outside the slot prefix; absent/corrupt → defaults, never fatal).
7. **World state is derived where possible.** The escalation ledger is the one sanctioned history-dependent exception.
8. **Save migration is the idempotent backfill chain** — stages early-return unchanged; backfilled values seed on entity ID.

## Layout & import rules

```
src/sim/        pure sim (core/ heroes/ combat/ dungeon/ world/ campaign/ save/ registry/)
art/            ACCEPTED generated-art originals (heroes/ npcs/ enemies/), bible §4
                naming, append-only. The repo is the reference of record; only
                256px webp busts ever ship (tools/build-portraits.mjs).
src/content/    typed registries; generated/ is machine-written (converter, and
                portraits.ts by build-portraits) — NEVER hand-edit
src/ui/         React app (may import sim; sim may NEVER import it). ALL screens
                speak the desk grammar. accessories.tsx = ambience layer;
                screens/worldChart.ts = procedural chart (DENSITY = round-03 lock).
src/ui/styles/  brief #8 style layer: tokens → materials → grammar components →
                treatment (brief #10 paste grades) → screen conversions. Status set
                is FROZEN + label-paired; zero image assets — both guarded by
                tests/ui/style-tokens.test.ts. Reference: #style-drawer (which now
                shows every paste grade on one subject).
src/ui/portrait.tsx  the ONE component that puts generated art on the desk.
                Grades arrive as props from DATA; missing key OR a broken data URI
                both fall to the sketch-pending silhouette. 8 of 12 hero subjects
                have no art — the fallback is a normal play path, not an error.
src/platform/   SaveStore impls (localStorage today; Tauri glue when brief #7 unparks)
tools/          content converter + seed applier (Node scripts); distribution
                harnesses live in tests/harness/
tests/          Vitest (unit, fixtures, property); e2e/ Playwright (Phase 2+)
```

Aliases: `@sim/*`, `@content/*`, `@platform/*`. Commands: `pnpm check` (typecheck+lint+test) · `pnpm e2e` (built artifact; set `GV_CHROMIUM` to a preinstalled Chromium where needed, e.g. the cloud workspace) · `pnpm convert` · `pnpm portraits` (rebuild the bust module from `art/`) · `pnpm db:apply` · `pnpm dev` · `pnpm build`.

## The desk grammar (UI law — brief #8)

- **One meaning per affordance, no exceptions:** brass pin = actionable now · tape = standing record/reference · wax seal = irreversible commitment · red ink = the world talking back (marginalia in margins only; max one stamp per sheet; thread from the spool) · vellum age = information age.
- **Status colors:** FROZEN set `#0ca30c/#fab219/#ec835a/#d03b3b`, ALWAYS label-paired, never the sole carrier of a state. Flourish never replaces the number.
- **Accessories** (quill, letter knife, thread spool, pounce pot — `accessories.tsx`) are pure presentation: aria-hidden, pointer-events none, driven by queries the screen already renders. Never add a sim query for ambience. Every accessory state has a labeled twin on screen.
- **Flat mode** (Settings; player-wide via `UserSettings`) strips ALL ambience/tilt/texture but keeps the full grid, data, labels, and actions. Every new surface honors it from its first build.
- Chart density is LOCKED at round-03 (executable as `worldChart.ts` DENSITY) — no new chart features without a deliberate revisit.
- Every new surface gets a grammar audit line in the test-validation checklist — grammar erosion is brief #8's #1 named risk.

## Determinism discipline

- No `Math.random`, `Date.now`, or argless `new Date` in sim — lint enforces; use `Rng` and the sim clock.
- **String hashing goes through `@sim/core/hash`** — ONE FNV-1a, shared by the save
  signature and identity backfill. Anything taking `hash % n` MUST go through
  `hashIndex`/`mix32` first: raw FNV's low bits are just the input's XOR-parity, so
  two namespaced hashes of the same id correlate (this bit us — ancestry and gender
  produced only 6 of 12 possible pairs until the avalanche step landed).
- Backfilled values seed on the ENTITY ID, never the campaign `Rng` — drawing from
  the Rng would move its stream position by however many entities needed repair.
- Seed strings come from `Seeds`/`Ids` builders — never ad-hoc string concat.
- No `async` in sim resolvers. Emission order = resolution order.
- **The event schema is FROZEN (2026-08-10).** Adding types is legal; renaming/removing is forbidden — the manifest snapshot test will fail, and it is right. Consumers must skip-and-log unknown types.
- Combat/dungeon time = integer 100ms ticks; world time = game-minutes. No float time.

## Data discipline

- Content IDs are **append-only forever** — saves reference them. Never renumber; leave gaps.
- `src/content/generated/**` is rebuilt by `pnpm convert` from `data/game_data.db` — the db lives IN this repo (moved with brief #6); the old Godot repo `C:\GuildVigil` is frozen and no tool reads it. Count gates in the converter AND `tests/content/count-gates.test.ts` must both be updated when content legitimately grows, in the same commit.
- Item instances are tuples `(baseId, tier, propertyIds[], seed)` — stats/name/price always derive (`heroes/equipment.ts`). Never denormalize.
- Every feat effect must parse and classify at load (`heroes/featEffects.ts`) — an unknown `effect_type` is a build error by design.
- **Columns are free.** The converter is `SELECT *` and the count gates count ROWS, so adding a column costs no tooling change and no gate change. Adding a *row* costs both gates, in the same commit.
- ⚠ **Still-dead content, read by NOTHING:** `item_level` and `class_weapon_proficiency` (44 rows). #19 retired `aoo_count` and `armor_check_penalty` off this list. Also dead by arithmetic: the **ambush ladder** (`detectDc = 12 + difficulty × 2` needs 32 at d5, so `partySurprise` fires 5.3% at d1 and **0% at d3 and d5**) and `2^(level − difficulty)` in `pickEnemies` (a no-op — `levelBand` is 1). Don't rediscover these; they are queued content fixes.
- ⚠ **THE SHOP SELLS NO ARMOUR AT ALL.** `session.shopStock()` hard-skips every row with `required_building_level > 1` — **53 of 105**, including every armour row *and* the +2/+4 wondrous items the backstab loop now wants. `assembly.ts` already folds `stat_bonus` into ability mods, so Gloves of Dexterity +2 would raise every conceal check with no further work — they are **lootable but not purchasable**. Do not design a gear solution that assumes the shop can supply it.

## Testing conventions

- Every resolver lands WITH rules-example fixtures. Balance-critical values get tests pinned to the real registries (see the Fighter-19/Barbarian-20 proficiency test).
- Property tests for invariants (termination, no-legendary-from-rolls, graph connectivity); golden-seed snapshots for generators; `EventStream.hash()` for replay determinism.
- The contract fixture (`tests/fixtures/dispatch-fixture.ts`) is what every stream consumer must parse — extend it, don't fork it.
- Distribution harnesses (1.3+) assert on histograms vs committed baselines, not averages.

## Style

- TS strict is non-negotiable (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` are on — expect `!`-free code via proper narrowing).
- Single-responsibility files; if you describe a module with "and", split it. Prefer pure functions over classes except where identity/state is the point (`Rng`, `EventStream`).
- Comments explain WHY (ported nuances, deliberate divergences), not what.

## Gotchas (things that will bite you in THIS repo)

- `SimEvent` is a **distributive** union — `switch (ev.type)` narrows `ev.data`. Don't cast payloads.
- Generated tables are `as const` → literal-typed IDs. Widen lookups: `new Map<number, Row>(...)`.
- Ability mods use **PF-RAW floor** (score 7 → −2). The Godot code truncated (−1) — that divergence is deliberate and documented in `heroes/levelUp.ts`. Don't "fix" it back.
- Masterwork's +1 is craftsmanship, not enhancement — no `+1` name suffix (`equipment.ts` composeName).
- The INT-boost/skill-points bug from Godot is FIXED here (`skillPointsForLevel` takes the pending boost). Don't reintroduce the old ordering.
- XP is cumulative and never spent; level 20 uses a `-1` sentinel, not an error.
- `UserSettings` lives beside the slots (web key `gv_settings`), NOT inside campaign saves — don't route preferences through the envelope/backfill chain.
- `HeroState.ancestry`/`gender` are **cosmetic** — identity + portrait only, ZERO stat
  effect. `tests/campaign/muster.test.ts` enforces it; hiring PF2E ancestry mechanics
  is a deliberate systems brief, not a drive-by.
- The founding muster's class list is the four archetypes the registry can outfit at
  level 1. There is no starting-gear-by-class table — widening it is CONTENT work.
- `CampaignSession.deserialize` runs the backfill chain (`@sim/save/backfills`) over a
  clone before anything reads state. Add stages there, append-only.
- **No two modules under `src/` may differ only by case.** `tests/ui/module-casing.test.ts` enforces it. Vite resolves `.ts` before `.tsx`, so `CombatField.tsx` beside `combatField.ts` made Windows import the wrong module and render a blank page while every Linux test stayed green. A helper beside a screen gets its OWN stem (`worldChart.ts`, `afterActionXp.ts`, `fieldReading.ts`) — never a case variant.
- **Sessions verify on Linux; Steven develops on Windows. Green tests are not proof the app runs.** After any change that adds files or moves module wiring, ask Steven to run `pnpm dev` and confirm.
- **Dungeon generation IS guarded now — by `tests/harness/dungeon-*` and nothing else.** `career-distribution` still never dispatches a dungeon (480 records, 0 dungeon runs — the autopilot only accepts quests 1/6/100), and `encounter-distribution` runs hand-authored rosters and never calls `populate()` or `pickEnemies` — which is why brief #15's positioning change left it byte-identical. (#19 moved it for the first time: it calls `runEncounter`, and its `fromRegistry` helper now mirrors `buildEnemy` for `reactions` and the two skill totals.) Do not read a green `encounter-distribution` as cover for anything in `src/sim/campaign/assembly.ts`.
- ⚠ **`career-distribution` IS DEGENERATE AND CANNOT REPORT IT.** It now reads `completionRate 1.0 · wipeRate 0 · failRate 0 · idleWeekRate 0 · ambushDeaths 0`, and every named assertion is a **one-sided floor** (`completionRate > 0.5`, `wipeRate < 0.2`), so **nothing fires** to say the surface loop lost its teeth. No ceiling was added because it would fail today. **A green `career-distribution` is currently worth nothing as evidence about the surface game.** Restoring its signal is part of the re-tune, not a follow-up to it.
- ⚠ **No assertion may claim a completion difference smaller than ~8 points.** Measured (brief #16 §3): eight independent blocks of the SAME dungeon cell land **30 points apart at 30 runs/cell**, 8.0 at 100, 7.0 at 300. This caught a wrong number in brief #16's own text. Harness grid n affects only cost (snapshots are seed-pinned and exact); curve n IS the precision of the contract.
- ⚠ **When a negative control loses its headroom, MOVE THE BAND — never lower the threshold.** Lowering it quietly lets a control assert a difference smaller than the noise floor, which is the one thing the precision rule forbids. #19 hit this: NC6's pooled wipe control moved from d1–d3 to **d3–d5** at the **same threshold and the same n**, because d1/d2 wipes had collapsed into a floor and it was reading a 1.5-point delta inside its own ±3.8 bar.
- **Harness snapshots are load-bearing and `vitest -u` defeats them.** Three of brief #16's five negative controls are caught by the exact snapshot ALONE, with no named invariant firing. Re-baseline consciously and justify each moved baseline in the commit; there is no mechanical substitute.
- **Measure a NEW option with a throwaway probe** — a scratch vitest config OUTSIDE `tests/`, deleted before shipping; to cost an option needing logic changes, patch a COPY under `probe/` and verify `src/` byte-identical afterwards. The harness is a regression gate, not an exploration instrument.
- **`engageRange` vs `weaponRange` is a deliberate split.** `engageRange` = `max(weaponRange, default cantrip range)`, derived once in `assembleHero`; `ai.ts` POSITIONS on it, weapon strikes still resolve on `weaponRange`. A caster holds at 6 and casts; it must never close to 6 and swing a staff. Collapsing the two reintroduces brief #15's central bug.
- **THE COMBAT ROOM (#19) — the arena has walls now.** `ARENA` in `src/content/combat.ts` is **20 × 20**, musters at `sideAx 3` / `sideBx 17`. `boundToRoom()` (`combat/ai.ts`) clamps **per axis**, and that IS the wall-slide — a unit driven into a wall keeps its tangential motion. Applied in `moveTick` after the step and in `placeFormation`. `CombatField` draws at **one uniform scale** and derives its sheet height from the room; the old code took SX and SY independently from a hard 700 × 520 sheet, which a square room would have inked as a squashed rectangle. The room is **one type**; there is no second layout, no cover, no reach, no difficult terrain — all ruled out for #19.
- ⚠ **THE MUSTER SEPARATION IS A SHARP LEVER AND IT IS AIMED AT SURFACE FIGHTS.** sep 10 → 96.0% surface completion, sep 12 or 14 → **99.8%**. The step is arithmetic: at 12+ the enemy's walk outlasts one 20-tick `attackIntervalTicks`, so the casters get a **second free volley every fight**. The dungeon curve is flat across all three (a dungeon is attritional, a surface quest is one encounter). **Steven chose 14 knowing this** — recorded in the `ARENA` comment. Any arena brief must say what it does to this number.
- ⚠ **`combat.unit_moved` fires at WAYPOINT granularity only — the event stream does not see everything.** A caster backing away inside its own engage range emits nothing and can walk off the sheet in silence. **A test about positions MUST read `Combatant.pos`** (see `tests/combat/room.test.ts`). This blind spot is exactly why units escaped the field for months.
- **AoO comes from content on BOTH sides, and it is departure-only.** `hasAoo` is `u.reactions.includes('aoo')`; `buildEnemy` fills `reactions` from `enemies.aoo_count`. ⚠ **`aoo_count: 2` is NOT two reactions** — Ruk Mor-Tal gets one per `attackIntervalTicks` like everyone else; #19 §10.2 measured the boolean.
- **THE BACKSTAB is an opposed conceal check and the defender uses the HIGHER of Stealth or Perception.** ⚠ **That is a deliberate divergence from PF2E** (which is Stealth vs Perception DC only) — **do not "fix" it back.** It is also *why* the pass rate is **flat at ~50% across depth** rather than falling: enemy Stealth scales with level exactly as the rogue's does. `rollConceal()` (`combat/strike.ts`) is called **once per ACTION** by the encounter loop and **emits no event** — `attack_resolved` already carries `sneakDice` on any swing the check bought. Bending the depth curve is a re-tune lever, not a bug.
- **Stealth is trained at the MUSTER only — and the rogue was never untrained past L1.** `buildAutoLevelUpPlan` spills past its priority trio into the rest of the registry and Stealth is third, so Shade's ranks are **0 / 1 / 2 / 4 / 6** at L1/2/3/5/7. Adding `'stealth'` to the global priority list would spend the **fighter's and cleric's** points on a skill neither can ever use (no hero or enemy in the registry has sneak dice, so hero Stealth is never a defensive term). `Combatant` carries `stealth`/`perception` totals; `armor_check_penalty` is folded into Stealth and is read here for the first time.
- ⚠ **FLANKING AND CONCEALMENT DISAGREE, deliberately logged and NOT fixed.** `isFlatFooted` returns true when flanked, but `acMod` only reads `isFlatFootedByCondition` — so flanking grants **sneak damage but no −2 AC**, while a passed conceal check applies the **full** off-guard (−2 AC *and* sneak). Fixing flanking rebalances every fight in the game; it is a decision for the re-tune, not a drive-by.
- **The gear bracket lives in `tests/harness/gearBrackets.ts`, NOT `src/`, and that is a decision.** The autopilot deliberately never equips — gearing is a *player* pleasure (paper-doll on return, the thing you've been eyeing in the shop). A gear-scoring helper in `src/` is the first step toward the feature Steven declined; if the UI wants a "recommended" marker it gets its own brief.
- **Every regression test gets a negative control.** Revert the fix, watch the test fail, restore, and report the observed failures. A test that passes both ways is decoration.
- Prefer a **return-value field to a new event** where it will do — brief #13's `sealedRoutes`/`bossRoomSealed` on `DungeonDispatchResult` are the precedent. The event schema is additive-only and the manifest snapshot must always grow.
- `QuestRecord.outcome` is `'completed' | 'failed' | 'wiped' | 'ambushKilled'` — a dungeon **retreat** surfaces as `'failed'`. Reading it as `'retreated'` silently miscounts retreats as wipes.
- Use **pnpm**, not npm. Native deps build via `pnpm.onlyBuiltDependencies`. **A plain `pnpm install --frozen-lockfile` worked in the cloud container on 2026-08-13** — `prebuild-install` found a `better-sqlite3` binary, and `pnpm convert` was verified to round-trip `src/content/generated/**` byte-identical, so **content work is doable from a cloud session**. Try plain first; if the native build 403s on node headers (it has before), fall back to `--config.onlyBuiltDependencies[]=esbuild --config.onlyBuiltDependencies[]=sharp` — only `pnpm convert`/`pnpm db:apply` need it, `src` and tests never do.
- **Content changes go through a reviewable seed, never a hand-edit:** write `data/seeds/seed_<name>.sql` → `pnpm db:apply <path>` → `pnpm convert`. The converter is `SELECT *` and the count gates count ROWS not columns, so **adding a column costs no tooling change and no gate change**. `data/game_data.db` is committed alongside the generated output.
- Planning docs live in BOTH `output/` (repo) and project knowledge (`migration/*` on claude.ai) — **write both halves in the same commit**, or say plainly which is stale. The two DO drift: `combat-room-findings.md` existed only in project knowledge for a full session, and `output/briefs/dungeon-balance.md` still has no `migration/` twin.

## Process

- New systems: implementation brief → approval → code. Keep-rebuilds from the ledger may cite the plan milestone as their brief.
- `pnpm check` green before every commit. Commit messages name the milestone/chunk.
- Two-machine workflow: offer to push at session end; unpushed commits block the other machine.
