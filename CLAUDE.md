# Guild Vigil (web) — Claude Code Orientation

Guild Vigil is a story-driven, multi-team guild-management RPG (PF2E-flavored,
continuous-time auto-battler combat) being rebuilt from Godot in TypeScript.
**Stack:** TS strict · React 19 · Vite (single-file artifact) · Vitest · Playwright. (Tauri 2 planned — brief #7 parked.)
**Phase:** 3 COMPLETE (art direction — "The Cartographer's Table", brief #8: rollout steps 1–7 all shipped; every screen speaks the desk grammar). Phases 1–2 complete earlier: beat-feed contract pinned; content slice shipped. Brief #9 (type program) and **brief #10 (art integration — pastes, portraits, the founding muster)** and **brief #11 (the readability pass — quest-board hierarchy, difficulty bands, display labels, the charter)** shipped since. Suite: **323 tests + 9 e2e** green. Next: **combat playback (brief #12)** → audio (Phase 3's unfinished business) → content pipeline (R4) → Phase 4 packaging. ART IS PARKED by decision 2026-08-12 — the silhouette fallback IS the placeholder for every un-drawn subject.

## Authoritative documents — read before designing anything

- `output/core-loop.md` — the settled game loop and all structural decisions. Conflicts resolve toward this file.
- `output/decision-ledger.md` — per-feature Keep/Change/Remove verdicts, all confirmed.
- `output/guild-vigil-migration-plan.md` — phases, scaffolding, risks (Part IV = this repo's layout).
- `output/briefs/*.md` — APPROVED design briefs (8: event vocabulary, escalation, loot grammar, profile AI, content slice, phase-2 UI, art direction, Tauri wrap [parked]). New systems get a brief BEFORE code (implementation-brief process). **Brief #8 (art direction) is the normative contract for ALL UI work** — see the desk grammar section below.

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
- Use **pnpm**, not npm. Native deps build via `pnpm.onlyBuiltDependencies`.
- Planning docs live in BOTH `output/` (repo) and project knowledge (`migration/*` on claude.ai) — update both or say which is stale.

## Process

- New systems: implementation brief → approval → code. Keep-rebuilds from the ledger may cite the plan milestone as their brief.
- `pnpm check` green before every commit. Commit messages name the milestone/chunk.
- Two-machine workflow: offer to push at session end; unpushed commits block the other machine.
