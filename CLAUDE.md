# Guild Vigil (web) — Claude Code Orientation

Guild Vigil is a story-driven, multi-team guild-management RPG (PF2E-flavored, continuous-time
auto-battler combat) being rebuilt from Godot in TypeScript.
**Stack:** TS strict · React 19 · Vite (single-file artifact) · Vitest · Playwright.

## Where things stand

- **Suite:** 892 unit + 14 e2e green. Bundle **2,379.24 kB** (brief #24's 12 paperdoll figures ship
  as inline data URIs — if load time ever bites, lazy-load `src/content/generated/figures.ts`
  rather than dropping the art).
- **Phase:** 3 substantially complete but **NOT to its exit criteria** (audio and the Playwright
  visual baselines). **Phase 4 is not next.**
- **Shipped:** briefs #8–#26 (M1+M2). Status per brief, and which findings file corrects which, is in
  **`output/briefs/INDEX.md`** — read that, not the directory.
- **What is next, what is blocked, what is held, and what is not built yet:
  `output/future-work.md`.** It is stack-ranked. Do not re-derive the roadmap from this file.
- ⚠ **#26 M1+M2 made the existing 45 statblocks fight differently; it did NOT author new ones.**
  The remaining gap is VOLUME: 45 of 300–500 enemy bases (12%) and 22 of 300–400 quests (6%), against
  spells/feats/progression at 100%. That is the campaign-content long pole, in `future-work.md`.
- ⚠ **#17 MELEE INTERDICTION IS UNDECIDABLE AS WRITTEN — every number in it is VOID.** Measured
  2026-08-12, a month before the illegal-armour fix; its own stated baseline (91.3/85.8/77.3/41.1/49.4)
  sits up to 21.6 points from today's, against a ±8 bar. §§1–8 survive, the option table does not.
  **Re-measure before putting it to Steven.**

### Three standing prohibitions

These stop work that looks helpful and is not. Each has its full rationale elsewhere; they are
repeated here because nothing would prompt you to go looking first.

1. ⚠ **DO NOT propose balance changes off the dungeon curve.** Steven's standing call (brief #22 D5):
   **the curve is not a gate right now** — "we haven't done any real work on enemies yet". Dungeons
   are expected to get harder as enemy content lands, and enemies are authored against the founding
   four's measured statblocks (`output/briefs/character-advancement-findings.md` §4). Reading a
   harness number as a problem to fix is the most likely way to waste a session here.
2. ⚠ **DO NOT re-tune against a geometry that is about to change.** Room geometry is a first-order
   balance parameter — #19 §0 measured a corridor at 11–13 points of completion at d3–d5. The arena
   work comes first. (`output/future-work.md` §2–3.)
3. ⚠ **DO NOT give ancestry a stat effect, and DO NOT add gear scoring to `src/`.** Ancestry and
   gender are **cosmetic by decision** (PF2E instinct says otherwise; `tests/campaign/muster.test.ts`
   enforces it), and **the autopilot deliberately never equips** — manual gearing is a player pleasure
   Steven declined to automate. Both are settled design, not oversights: `output/design-law.md`.

## Deep references — open the one that matches your task

CLAUDE.md is capped at 20,000 characters by the context injector; past that the MIDDLE is silently
dropped. These files hold the domain detail that used to live here and get truncated away. **They are
authoritative for their domain** — do not copy their contents back into this file.

| Touching… | Read first |
|---|---|
| combat, the arena, spells, size, AoO, positioning | `output/reference/combat.md` |
| any test claiming a balance number; `tests/harness/**` | `output/reference/measurement.md` |
| feats, boosts, abilities, level-up, attribution | `output/reference/characters.md` |
| `src/ui/**`, the art pipeline, the beat record | `output/reference/ui-and-art.md` |
| authoring or wiring a content column, item, or enemy row | `output/reference/content.md` |
| which brief governs what, and which findings file corrects it | `output/briefs/INDEX.md` |
| **a settled player-facing rule** (identity, gear, XP, failure) | **`output/design-law.md`** |
| **what is next / blocked / held / not built** | **`output/future-work.md`** |

## Authoritative documents

Conflicts resolve toward these, in this order:

- `output/core-loop.md` — what the game IS: the four nesting levels and the four pillars.
- `output/design-law.md` — the settled player-facing rules. Changing one needs a brief.
- `output/future-work.md` — the stack-ranked backlog: next, blocked, held, not built.
- `output/archive/` — **historical planning artifacts. Not authority.** The 2026-08-10 migration plan lives here; its live content was harvested into `future-work.md`. Read it only for *why* the architecture is shaped this way (Part V) or what was deliberately removed (Part II).
- `output/briefs/INDEX.md` — every brief's status and what it settled. **Start here, not in the directory.**
- `output/art-style-bible.md` — art law.
- ⚠ **A brief with a `-findings.md` companion has been CORRECTED by it.** The findings doc is the
  implementation record and **wins on every measured fact.** Do not trust the brief over it.
- ⚠ **`output/decision-ledger.md` is HISTORICAL, not authoritative.** It is the frozen 2026-08-10
  migration triage — "did we carry this Godot feature over?" — and it has since been overtaken in
  places (its Area 2 still says friendly fire stays; brief #21 structurally rejected that). Read it
  for intent and for what was deliberately REMOVED; never as a statement of current design.
- ⚠ **A HOLD FOR SCOPE IS NOT A HOLD BY MEASUREMENT, and the two have been conflated here before** —
  the `combat_action` loadout verb was logged as "unmeasured" in the same sentence as the
  measurement-held threat mechanic, drifted into "held", and shipped in #22 as the `ability` verb.
  `output/future-work.md` labels which kind each held item is. Check before reviving or dismissing.

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
art/            ACCEPTED art originals, bible §4 naming, append-only. The repo is
                the reference of record; only derived webp (busts, figures) ever
                ships, always as inline data URIs. Pipeline: reference/ui-and-art.md.
src/content/    typed registries; generated/ is machine-written (converter, and
                portraits.ts by build-portraits) — NEVER hand-edit
src/ui/         React app (may import sim; sim may NEVER import it). ALL screens
                speak the desk grammar. accessories.tsx = ambience layer;
                screens/worldChart.ts = procedural chart (DENSITY = round-03 lock).
src/ui/styles/  brief #8 style layer: tokens → materials → grammar components →
                treatment (brief #10 paste grades) → screen conversions. Status set
                is FROZEN + label-paired; zero image assets — both guarded by
                tests/ui/style-tokens.test.ts. Reference: #style-drawer.
src/ui/portrait.tsx  the ONE component that puts generated art on the desk.
                Grades arrive as props from DATA; missing key OR a broken data URI
                both fall to the sketch-pending silhouette. ⚠ FIGURES are 12/12 but
                BUSTS are 4/12 — the fallback is a normal play path, not an error.
src/platform/   SaveStore impls (localStorage today; Tauri glue when brief #7 unparks)
tools/          content converter + seed applier (Node scripts); distribution
                harnesses live in tests/harness/
tests/          Vitest (unit, fixtures, property); e2e/ Playwright
```

Aliases: `@sim/*`, `@content/*`, `@platform/*`. Commands: `pnpm check` (typecheck+lint+test) · `pnpm size` (bundle gate: warn 8 MB / fail 12 MB — **never raise the ceiling to pass**) · `pnpm e2e` (built artifact; set `GV_CHROMIUM` to point at a preinstalled Chromium if needed) · `pnpm convert` · `pnpm portraits` (rebuild the bust module from `art/`) · `pnpm figures` (rebuild the paperdoll figure module from `art/heroes/*-figure-*.png`) · `pnpm db:apply` · `pnpm dev` · `pnpm build`.

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
- `src/content/generated/**` is rebuilt by `pnpm convert` from `data/game_data.db`, which lives IN this repo. ⚠ **The Godot repo `C:\GuildVigil` is FROZEN — no tool reads it, nothing is resumed from it.** Count gates in the converter AND `tests/content/count-gates.test.ts` must both be updated when content legitimately grows, in the same commit.
- Item instances are tuples `(baseId, tier, propertyIds[], seed)` — stats/name/price always derive (`heroes/equipment.ts`). Never denormalize.
- Every feat effect must parse and classify at load (`heroes/featEffects.ts`) — an unknown `effect_type` is a build error by design.
- **Columns are free.** The converter is `SELECT *` and the count gates count ROWS, so adding a column costs no tooling change and no gate change. Adding a *row* costs both gates, in the same commit.
- ⚠ **THE RECURRING DEFECT IN THIS REPO IS CONTENT AUTHORED AGAINST A CONTRACT WITH NO CONSUMER** —
  five times so far, and nothing catches it because inert content breaks no test. When authoring a
  column, write the consumer and a reachability assertion in the same commit. **The full inventory of
  still-dead content, and the shop-sells-no-armour defect, live in `output/reference/content.md`.**

## Testing conventions

- Every resolver lands WITH rules-example fixtures. Balance-critical values get tests pinned to the real registries (see the Fighter-19/Barbarian-20 proficiency test).
- Property tests for invariants (termination, no-legendary-from-rolls, graph connectivity); golden-seed snapshots for generators; `EventStream.hash()` for replay determinism.
- The contract fixture (`tests/fixtures/dispatch-fixture.ts`) is what every stream consumer must parse — extend it, don't fork it.
- Distribution harnesses (1.3+) assert on histograms vs committed baselines, not averages.
- **The rules of evidence — the ±8-point precision floor, negative controls, probe discipline, and
  which harnesses are degenerate — live in `output/reference/measurement.md`. Read it before writing
  any test that claims a balance number.**

## Style

- TS strict is non-negotiable (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` are on — expect `!`-free code via proper narrowing).
- Single-responsibility files; if you describe a module with "and", split it. Prefer pure functions over classes except where identity/state is the point (`Rng`, `EventStream`).
- Comments explain WHY (ported nuances, deliberate divergences), not what.

## Gotchas (things that will bite you in THIS repo)

These are the cross-cutting ones — they bite regardless of what you are touching. Domain-specific
traps live in the `output/reference/` files named above.

- `SimEvent` is a **distributive** union — `switch (ev.type)` narrows `ev.data`. Don't cast payloads.
- Generated tables are `as const` → literal-typed IDs. Widen lookups: `new Map<number, Row>(...)`.
- ⚠ **`HeroState.ancestry`/`gender` are COSMETIC — zero stat effect**, enforced by `tests/campaign/muster.test.ts`. PF2E instinct says otherwise; this is settled design (`output/design-law.md` §1).
- `CampaignSession.deserialize` runs the backfill chain (`@sim/save/backfills`) over a
  clone before anything reads state. Add stages there, append-only.
- **No two modules under `src/` may differ only by case.** `tests/ui/module-casing.test.ts` enforces it. Vite resolves `.ts` before `.tsx`, so `CombatField.tsx` beside `combatField.ts` made Windows import the wrong module and render a blank page while every Linux test stayed green. A helper beside a screen gets its OWN stem (`worldChart.ts`, `afterActionXp.ts`, `fieldReading.ts`) — never a case variant.
- **Sessions verify on Linux; Steven develops on Windows. Green tests are not proof the app runs — and neither is green CI.** `.github/workflows/check.yml` runs typecheck/lint/test/build/size and the e2e on every push, all on Linux. After any change that adds files or moves module wiring, ask Steven to run `pnpm dev` and confirm.
- ⚠ **The gear bracket lives in `tests/harness/gearBrackets.ts`, NOT `src/` — that placement IS the decision.** The autopilot never equips; gearing is a player pleasure Steven declined to automate. A gear-scoring helper in `src/` is the first step toward a declined feature (`output/design-law.md` §3).
- **Every regression test gets a negative control.** Revert the fix, watch the test fail, restore, and report the observed failures. A test that passes both ways is decoration.
- Prefer a **return-value field to a new event** where it will do — brief #13's `sealedRoutes`/`bossRoomSealed` on `DungeonDispatchResult` are the precedent. The event schema is additive-only and the manifest snapshot must always grow.
- Use **pnpm**, not npm. Native deps build via `pnpm.onlyBuiltDependencies`. Try a plain `pnpm install --frozen-lockfile` first; if the native build 403s on node headers (it has before), fall back to `--config.onlyBuiltDependencies[]=esbuild --config.onlyBuiltDependencies[]=sharp` — only `pnpm convert`/`pnpm db:apply` need it, `src` and tests never do.
- **Content changes go through a reviewable seed, never a hand-edit:** write `data/seeds/seed_<name>.sql` → `pnpm db:apply <path>` → `pnpm convert`. The converter is `SELECT *` and the count gates count ROWS not columns, so **adding a column costs no tooling change and no gate change**. `data/game_data.db` is committed alongside the generated output.
- ⚠ **`output/` IN THIS REPO IS THE ONLY HOME FOR PLANNING DOCS.** A parallel copy was kept in claude.ai project knowledge and the two drifted badly (a findings file existed in one and not the other for a full session). If a doc is not in the repo, it does not exist.
- ⚠ **A TEST THAT CHECKS A GATE BY CALLING THE GATE IS WORTHLESS — #22 shipped one and a sabotage run caught it.** Asserting "feats of a ready type pass `isEffectReady`" is a TAUTOLOGY, because `isEffectReady` reads the very map under test; flipping `resource_grant` to `true` left it green. The fix is a **WITNESS TABLE** (`tests/heroes/feats.test.ts`): every type marked ready must name an assertion that reaches the REAL consumer, with no reference to the map. Generalise it: assert against the CONSUMER, never through the predicate you are testing.
- ⚠ **A TEST CAN ASSERT THE AGGREGATOR AGAINST ITSELF AND STAY GREEN THROUGH A TOTAL OUTAGE.** `tests/heroes/equipment.test.ts` asserted the RAW AUTHORED KEYS of `stat_bonus` — i.e. it checked `aggregateStatBonuses` against its own input — and was green for the entire period every Cloak of Resistance did nothing. Assert the CONSUMER CONTRACT (what `assembleHero` actually produces), never the shape you just fed in.

## Process

- New systems: implementation brief → approval → code. Keep-rebuilds from the ledger may cite the plan milestone as their brief.
- `pnpm check` green before every commit. Commit messages name the milestone/chunk.
- Two-machine workflow: offer to push at session end; unpushed commits block the other machine.
