# Guild Vigil (web) — Claude Code Orientation

Guild Vigil is a story-driven, multi-team guild-management RPG (PF2E-flavored,
continuous-time auto-battler combat) being rebuilt from Godot in TypeScript.
**Stack:** TS strict · React 19 · Vite (single-file artifact) · Tauri 2 · Vitest · Playwright.
**Phase:** 3 (art direction — "The Cartographer's Table", brief #8 APPROVED). Phases 1–2 complete: 267 tests + 4 e2e green; beat-feed contract pinned; content slice shipped.

## Authoritative documents — read before designing anything

- `output/core-loop.md` — the settled game loop and all structural decisions. Conflicts resolve toward this file.
- `output/decision-ledger.md` — per-feature Keep/Change/Remove verdicts, all confirmed.
- `output/guild-vigil-migration-plan.md` — phases, scaffolding, risks (Part IV = this repo's layout).
- `output/briefs/*.md` — APPROVED design briefs (event vocabulary, escalation, loot grammar, profile AI). New systems get a brief BEFORE code (implementation-brief process).

## The Eight Constraints (law, not guidance)

1. **The sim has zero renderer dependency.** Everything under `src/sim/**` is pure TS: no React, no DOM, no Tauri, no browser globals. Constructible and runnable from Node with no UI.
2. **The boundary is enforced at build time** — `eslint.config.js` fails the build on violations. If the sim seems to need a browser global, the design is wrong.
3. **The sim runs headless and cheaply.** One resolution path serves live play, forecasting, and harnesses. Budget: a full dispatch ≤ ~50ms.
4. **Sim emits events; presentation interprets.** No player-facing text in resolvers, ever. Events are facts.
5. **Randomness is string-seeded and namespaced** (`Rng`, `Seeds` in `src/sim/core/`). Derived content recomputes from facts; never store what you can derive.
6. **Persistence goes through `SaveStore`** (`src/sim/save/`). Never touch localStorage/fs directly.
7. **World state is derived where possible.** The escalation ledger is the one sanctioned history-dependent exception.
8. **Save migration is the idempotent backfill chain** — stages early-return unchanged; backfilled values seed on entity ID.

## Layout & import rules

```
src/sim/        pure sim (core/ heroes/ combat/ dungeon/ world/ campaign/ save/ registry/)
src/content/    typed registries; generated/ is machine-written (converter) — NEVER hand-edit
src/ui/         React app (may import sim; sim may NEVER import it)
src/ui/styles/  brief #8 style layer: tokens → materials → grammar components.
                Status set is FROZEN + label-paired; zero image assets — both
                guarded by tests/ui/style-tokens.test.ts. Reference: #style-drawer.
src/platform/   SaveStore impls, Tauri glue (same rule)
tools/          converter, layout tool, harnesses (Node scripts)
tests/          Vitest (unit, fixtures, property); e2e/ Playwright (Phase 2+)
```

Aliases: `@sim/*`, `@content/*`. Commands: `pnpm check` (typecheck+lint+test) · `pnpm convert` · `pnpm dev` · `pnpm build`.

## Determinism discipline

- No `Math.random`, `Date.now`, or argless `new Date` in sim — lint enforces; use `Rng` and the sim clock.
- Seed strings come from `Seeds`/`Ids` builders — never ad-hoc string concat.
- No `async` in sim resolvers. Emission order = resolution order.
- **The event schema is FROZEN (2026-08-10).** Adding types is legal; renaming/removing is forbidden — the manifest snapshot test will fail, and it is right. Consumers must skip-and-log unknown types.
- Combat/dungeon time = integer 100ms ticks; world time = game-minutes. No float time.

## Data discipline

- Content IDs are **append-only forever** — saves reference them. Never renumber; leave gaps.
- `src/content/generated/**` is rebuilt by `pnpm convert` from the Godot repo's `game_data.db` (`C:\GuildVigil` — read-only source material). Count gates in the converter AND `tests/content/count-gates.test.ts` must both be updated when content legitimately grows, in the same commit.
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
- Use **pnpm**, not npm. Native deps build via `pnpm.onlyBuiltDependencies`.
- Planning docs live in BOTH `output/` (repo) and project knowledge (`migration/*` on claude.ai) — update both or say which is stale.

## Process

- New systems: implementation brief → approval → code. Keep-rebuilds from the ledger may cite the plan milestone as their brief.
- `pnpm check` green before every commit. Commit messages name the milestone/chunk.
- Two-machine workflow: offer to push at session end; unpushed commits block the other machine.
