# Guild Vigil — Stack Migration Plan

**Produced:** 2026-08-10 · Steps 4–6 of the migration planning brief
**Companion documents (living authorities):** `core-loop.md` (loop + divergences + constraint weights), `decision-ledger.md` (per-feature verdicts, all 8 areas confirmed)
**Target stack:** TypeScript (strict) · React 19 · Vite (single-file artifact) · Tauri 2 · Vitest · Playwright

---

# Part I — The core loop (settled)

Four nesting levels:

1. **The beat** — combat and exploration auto-resolve; the player watches the focused team's live map + beat feed. Between rooms: adjust priorities or recall. Once a fight engages: no intervention — preparation is everything. Combat is continuous-time in continuous 2D space; beats are emitted facts.
2. **The dispatch** — pick quest, team, mission profile (Full Explore / Boss Rush / Mystery Hunt / Loot & Resources), gear (manual, slot-by-slot — the ritual is the point), loadout + priority order, formation. Select target on the world map; the party self-paths (terrain-weighted A*). Push-your-luck attrition vs. reward. Ends: resolved, retreat, or TPK.
3. **The chapter** — building order, roster investment, story threads vs. filler with limited teams and weeks. Rep ladder (5/10/15/20/30) is the pacing spine. Escalating world pressure punishes neglect.
4. **The campaign** — authored storyline selected at start; ends at its resolution. Failure is absorbed (permadeath, degraded world), never game-over.

**Structural decisions:** up to 4 teams, Tavern-gated · single global clock, dungeons pause it · authored spine + authored side-quest pool (300–400), procedurally scheduled · escalation + attrition failure model · progress = rep tiers + town growth + story · PF2E-flavored real-time combat (d20 degree-of-success per attack event; 3-action → cooldowns, MAP → flurry decay, initiative → engagement speed) · no mid-fight intervention, soft anti-stall · graph-first dungeons from a 20–30 template pool, population seeded per dispatch · 11+4+2 equipment slots, authored bases × generated tiers/properties, instances as tuples · abilities chosen + deed-earned, costed respec, known pool → ordered active loadout.

**Constraint weights:** #1/#3/#4/#5 way up (sim IS the game; headless dispatches during normal play; one event vocabulary for everything; RNG namespacing is correctness under concurrent teams). #7 harder than the league case: escalation is history-dependent → persisted compact fact-ledger, everything else derived. #8 up: backfill chain before first release.

---

# Part II — Decision ledger summary

Full tables with notes in `decision-ledger.md`. Verdict counts across 8 areas: **~70 Keep · ~30 Change · 7 Remove · 6 New systems.**

**Removed:** manual turn control, initiative/turn order, 3-action structure, buyback ledger, legacy DungeonManager, FreezeTrace, SQLite plumbing, Godot z-order/scaling workarounds.

**New systems needing design briefs:** ① unified event vocabulary, ② world pressure/escalation ledger, ③ loot generation grammar, ④ quest scheduler + arc graph, ⑤ SaveStore, ⑥ new screens (dispatch hub, beat feed, formation, loadout, after-action, team switcher).

**Verification stance (confirmed per-area):** no differential GDScript↔TS harness anywhere. Instead: machine-converted content (never retyped) with count gates; ported XP test fixtures; rules-example fixtures for every resolver; graph property tests validating the layout pool; golden-seed snapshot tests; an encounter/career distribution harness with golden scenarios.

---

# Part III — Phased build order (Step 4)

Order follows the brief: headless sim → unstyled UI → visual identity → platform wrap. One deviation, justified inline: **content workstream runs parallel from Phase 2**, because the campaign layer (quests, arcs, enemies, NPCs) is the long pole and mostly unwritten, while the combat/build layer arrives ~90 % complete as data.

## Phase 1 — Headless sim core (DETAILED)

**Entry criteria:** this plan approved; design briefs written and approved (via `implementation-brief` skill) for the four Phase-1 new systems: event vocabulary, escalation ledger, loot grammar, mission-profile AI.

**Deliverable:** a Node-runnable sim package that plays complete campaigns with no UI, plus its test and harness suite.

**Milestones:**

- **1.0 Scaffolding + content conversion.** Repo per Part IV; Vite + TS strict + ESLint boundary rule + Vitest + CI (typecheck, lint, test, bundle-size). The converter tool: reads built `game_data.db` → emits typed registries; gates on expected counts; maps grid-square ranges to continuous distance units. *Done when:* CI green; registries loaded and wiring-tested; converted counts match source exactly (205+12 spells, 227 feats, 230 progression rows, 112 milestones, items, enemies, loot, stock, lore).
- **1.1 Foundations.** `Rng` (string-seeded, namespaced — convention doc: `dispatch_{id}_room_{n}`, `loot_{dispatchId}_{roomId}`, `deed_{heroId}_{factHash}`…); the **event vocabulary** (the single biggest Phase-1 design artifact — one schema spanning exploration + combat + world; versioned; additive-only after freeze); SaveStore interface + in-memory impl; save envelope + backfill-chain skeleton; sim clock. *Done when:* seed → identical event-stream hash across 1,000 replay runs; consumer contract fixtures exist (a canned stream each future consumer must parse).
- **1.2 Character core.** Stats/proficiency/save math, feat-effects registry interpreter (passive modifiers first, `affects:` metadata + wiring test), equipment instance tuples → derived stats, XP (ported fixtures), level-up application, loadout model. *Done when:* rules-example fixtures green; a fixture hero's derived sheet matches hand-computed values.
- **1.3 Combat.** Continuous-time resolver: cooldowns/cast times, d20 degree-of-success per attack event, flurry decay, engagement zones + reaction strikes, conditions (seconds-based), dying/wounded, AoE with basic saves, friendly fire; universal AI (threat/target scoring + ability-priority loadouts, both sides); formations; stalemate detector. **Encounter-distribution harness** stands up here, not later. *Done when:* every generated encounter terminates (10k-seed property test, stalemate rate < 1 %); golden-scenario histograms look sane and are checked in as baselines.
- **1.4 Dungeon.** Graph model; offline layout tool (port of the generator, Kruskal + loops + landmarks) producing the curated 20–30 template pool, build-time validated; per-dispatch population seeding (room typing, hazard DCs, enemies, loot, clue placement); entry-check AI sequence; mission-profile pathing; `runDispatchHeadless()`. *Done when:* all four profiles complete dungeons across the full pool × 100 seeds with zero non-termination; a full dispatch resolves in ≤ ~50 ms (forecasting needs ~150 of them interactively).
- **1.5 World & campaign.** Global clock; terrain gen + A* travel + self-pathing; multi-team dispatch state; quest scheduler v1 over a starter pool; escalation ledger v1; weekly economy tick (restock, rotation, POI income); shop/inventory/haul-capacity logic; **career harness**: hundreds of multi-week campaigns → outcome *distributions* (level curves, gold curves, death rates, pressure trajectories), not averages.

**Exit criteria:** a scripted campaign (create heroes → dispatch teams on both profiles → level → build → advance weeks) runs headless end-to-end deterministically; full Vitest suite green; career-harness baseline distributions reviewed and committed.

**Trouble signals:** event schema still churning after 1.3 starts · any `src/sim` import of React/DOM (build fails — if you're *tempted*, the design is wrong) · dispatch resolution creeping past 50 ms · stalemate detector firing above noise · harness distributions bimodal (steamroll-or-wipe means the combat translation lost the PF2E feel).

## Phase 2 — Unstyled UI (outline)

React 19 over the sim, plain HTML, zero styling effort. Screens: title/save slots → town + dispatch hub → hero panel (view/create/level-up + loadout tab) → equipment → world map (crude SVG, tokens, self-path preview) → live dungeon map + beat feed → after-action report → settings stub. Beat feed and forecast consume the event stream/headless runs — proving constraint 4 and 3 in anger. Playwright starts here (flows: create → dispatch → loot → level).
**Entry:** Phase 1 exit. **Deliverable:** the full loop playable ugly, in a browser. **Exit:** a complete short campaign playable by hand; Playwright core-flow suite green; beat feed replay of a fixture dispatch is pixel-identical (text-identical) across runs. **Trouble:** any game rule discovered living in a component; UI needing sim internals not expressible as events/queries.
**Parallel content workstream begins:** vertical slice first (1 arc, ~10 quests, ~20 enemy bases + undead variants, 2 NPCs), then batch production toward 300–400 quests / 300–500 enemy bases with validators gating every batch.

## Phase 3 — Visual identity (outline)

Design tokens (UITheme roles + 8-step ramp → CSS custom properties); layered portrait treatments (frames, faction tints, condition overlays, wounded desaturation — CSS compositing over static AI portraits); procedural SVG (crests, sigils, world map, dungeon maps, charts); beat-feed presentation polish (round bucketing, narration); audio (sorted `raw_audio` → manifest → Web Audio, category dB presets); responsive groundwork.
**Entry:** Phase 2 exit + art direction brief. **Deliverable:** the game looking like itself. **Exit:** full-reskin-by-stylesheet demonstrated (the teardown's parchment moment); Playwright visual snapshots baselined. **Trouble:** styling requiring markup rewrites (Phase 2 structure was wrong); any styling change touching `src/sim`.

## Phase 4 — Tauri wrap, packaging, mobile (outline)

Tauri 2 desktop shells (Win/macOS/Linux); SaveStore FS backend; itch: the *same* single-file artifact browser-playable with localStorage backend as capped demo; Steam/GOG packaging; mobile layout passes; iOS/Android via Tauri 2 mobile.
**Entry:** Phase 3 exit. **Deliverable:** store-ready builds up the publishing ladder (itch → Steam/GOG → mobile). **Exit:** identical campaign playable on desktop app, browser, and one mobile target from one artifact differing only in persistence backend. **Trouble:** platform-conditional code outside `src/platform`; mobile WebView perf forcing sim changes (it must only ever force *presentation* changes); bundle size past budget (see CI gate).

---

# Part IV — Project scaffolding (Step 5)

## Repository layout

```
guild-vigil-web/
├── src/
│   ├── sim/                # ← THE BOUNDARY: pure TS, no React/DOM/Tauri/browser globals
│   │   ├── core/           # rng, events, clock, ids, result types
│   │   ├── heroes/         # stats, progression, feats, spells, loadouts
│   │   ├── combat/         # continuous-time resolver, universal AI, formations
│   │   ├── dungeon/        # graph model, population, entry checks, mission profiles
│   │   ├── world/          # terrain, travel, POIs, escalation ledger
│   │   ├── campaign/       # arcs, quest scheduler, clock/week tick, economy
│   │   └── save/           # SaveStore interface, envelope, backfill chain, validators
│   ├── content/            # typed registries: generated (converter) + authored
│   ├── ui/                 # React app: screens, beat feed, components, theme tokens
│   └── platform/           # SaveStore impls (tauri-fs, local-storage), shell glue
├── tools/                  # content converter, dungeon layout tool, career harness CLI
├── tests/                  # vitest: unit, fixtures, property, contract
├── e2e/                    # playwright
└── src-tauri/              # Tauri 2 project (Phase 4)
```

## The boundary rule (constraint 2 — the deliverable, not a convention)

```js
// eslint.config.js (flat config) — fails the build on any renderer leak into the sim
{
  files: ['src/sim/**', 'src/content/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['react', 'react-dom', 'react/*'],        message: 'sim must not import React' },
        { group: ['**/ui/**', '**/platform/**'],           message: 'sim must not import UI or platform code' },
        { group: ['@tauri-apps/*'],                        message: 'sim must not touch Tauri' },
        { group: ['*.css', '*.svg', '*.png'],              message: 'sim must not import assets' },
      ],
    }],
    'no-restricted-globals': ['error',
      { name: 'window',   message: 'no browser globals in sim' },
      { name: 'document', message: 'no browser globals in sim' },
      { name: 'localStorage', message: 'persistence goes through SaveStore' },
      { name: 'fetch',    message: 'the sim does not do IO' },
      { name: 'requestAnimationFrame', message: 'the sim has no frames' },
    ],
    'no-restricted-properties': ['error',
      { object: 'Math', property: 'random', message: 'all randomness through Rng (string-seeded)' },
      { object: 'Date', property: 'now',    message: 'all time through the sim clock' },
    ],
  },
}
```

Plus `tsconfig` with `"strict": true` and project references so `src/sim` compiles standalone — the sim must be constructible from a Node script with no UI present (constraint 1/3), and the career harness in `tools/` is exactly that script.

## Test responsibilities

| Layer | Owns |
|---|---|
| **Vitest** | Sim units; rules-example fixtures (every resolver); ported XP fixtures; property tests (encounter termination, loot-never-unique, layout-pool invariants, save-ref validation, registry wiring/`affects:` orphans); determinism (seed → event-stream hash); backfill-chain idempotency; converter count gates. |
| **Distribution harnesses** (`tools/`, asserted via Vitest thresholds) | Encounter histograms vs. golden baselines; career outcome distributions; stalemate rate. |
| **Playwright** | E2E flows (create → dispatch → loot → level → build); beat-feed fixture replay; visual snapshots (Phase 3); single-file build boot smoke; per-platform smoke (Phase 4). |

## Skills disposition

- **Transfer unchanged:** `implementation-brief` (gates every new system, starting with the four Phase-1 briefs), `work`, `context-file-validator` (retargeted at the new CLAUDE.md).
- **Revised:** `test-validation-protocol` — add: boundary-lint gate, Vitest suite, *distribution-harness delta check* (did tuning move the histograms?), and a Playwright step before any hand-off.
- **Retired:** `gdscript-audit` — replaced by `tsc --strict` + ESLint (including the boundary rule) + size norms in CLAUDE.md.

## Replacement CLAUDE.md outline (new workspace)

1. **Identity & stack** — what Guild Vigil is (one paragraph), the stack, the single-file artifact requirement.
2. **The eight constraints** — verbatim, as law; boundary rule location; "if the sim wants a browser global, the design is wrong."
3. **Authoritative documents** — `core-loop.md`, `decision-ledger.md`; conflicts resolve toward core-loop.md.
4. **Directory map & import rules** — who may import whom; where new code goes.
5. **Determinism discipline** — Rng namespacing conventions with examples; no `Math.random`/`Date.now` in sim; derived-not-stored checklist (constraint 7); event-vocabulary version policy (additive-only post-freeze).
6. **Data discipline** — registries; append-only IDs (never renumber — saves reference them); converter + count gates; instance tuples; `affects:` wiring required on registry entries.
7. **Size & style norms** — carry the spirit of the old standards (single-responsibility files, small functions) with TS idioms; strict mode non-negotiable.
8. **Testing conventions** — the table above; fixtures live with the systems they pin; every resolver lands with rules-example fixtures.
9. **Process** — implementation-brief gate before new systems; `work` workflow; session hygiene; commit/push discipline (two-machine workflow preserved).

---

# Part IV-B — Development environment (Windows)

The environment phases like the project does: **Phases 1–3 need only the JavaScript toolchain** — Rust and the mobile stacks don't enter until Phase 4. Don't install ahead of need.

## Install now (Phases 1–3) — ~500 MB total

| Tool | Install | Why |
|---|---|---|
| **Node.js LTS** (24.x at time of writing; ≥ 22 required by Vite) | `winget install OpenJS.NodeJS.LTS` — or `nvm-windows` if you want side-by-side versions | Runs Vite, Vitest, the sim harnesses, the content converter. *The machine already has some Node from `build_db.js` — check `node -v` and upgrade if < 22.* |
| **pnpm** (via corepack, ships with Node) | `corepack enable` | Package manager — fast, strict, lockfile-reproducible across your two machines. |
| **Git** | Already installed (the Godot repo uses it). | — |
| **VS Code extensions** | ESLint, Prettier, Vitest, Playwright | The ESLint extension surfaces boundary-rule violations while typing, not just at build. |
| **Playwright browsers** | `pnpm exec playwright install chromium` (after repo setup) | ~400 MB Chromium download, one-time. Phase 2 onward. |

Everything else Phase 1 needs (TypeScript, Vite, ESLint, Vitest, better-sqlite3 for the converter) arrives as `package.json` dev dependencies — nothing global to install. `better-sqlite3` ships prebuilt binaries for LTS Node versions; you already ran it happily in `build_db.js`.

**Verification:** `node -v` ≥ 22 · `pnpm -v` prints a version · `git --version` · then `pnpm install && pnpm test` in the scaffolded repo goes green.

**Reproducibility across your two machines:** commit `pnpm-lock.yaml`; pin Node in `package.json#engines` and `.nvmrc`; `corepack` pins the pnpm version. No "works on the other machine" drift.

## Install at Phase 4 — desktop (Tauri 2) — ~8 GB

| Tool | Install | Why |
|---|---|---|
| **Rust (MSVC)** | `winget install Rustlang.Rustup`, then `rustup default stable-msvc` | Tauri's shell is Rust. |
| **Visual Studio 2022 Build Tools** | `winget install Microsoft.VisualStudio.2022.BuildTools` with the **"Desktop development with C++"** workload | Required by the Rust MSVC toolchain. |
| **WebView2 runtime** | Almost certainly already present (ships with Win 10/11; Edge installs it) | Tauri's Windows renderer — this is why Windows builds are ~3 MB. |
| **Tauri CLI** | `@tauri-apps/cli` as a dev dependency — no global install | `pnpm tauri dev` / `pnpm tauri build`. |

macOS and Linux desktop builds are produced on those platforms (or via GitHub Actions runners — recommended, free tier is plenty; the same workflow later does Steam depot uploads).

## Install at Phase 4 — mobile

- **Android (on this machine):** Android Studio (SDK + NDK + platform tools), JDK 17, plus `rustup target add aarch64-linux-android`. ~10 GB. Env vars `JAVA_HOME` / `ANDROID_HOME` / `NDK_HOME`.
- **iOS: requires a Mac.** Xcode does not run on Windows — plan for either Mac hardware or macOS CI runners (GitHub Actions) when the iOS rung of the publishing ladder arrives. Flagging now so it's a scheduled cost, not a surprise.

## Explicitly not needed

- **No WSL** — the whole stack is Windows-native.
- **No Python** — the converter is Node/TS; the old `build_game_db.py` stays behind in the Godot repo (run it once more if `game_data.db` is stale before conversion).
- **No global TypeScript/Vite/ESLint installs** — everything versioned in the repo.
- **No database server** — per the Area 6 decision.

---

# Part V — Risk register (Step 6)

**R1 — Event-vocabulary churn.** *Everything* consumes the event stream (beat feed, after-action, deeds, forecast, GameLog views); a schema break after Phase 1.3 cascades through every consumer. **Mitigation:** it gets the first and heaviest design brief; freeze at end of 1.1 with additive-only changes after; versioned schema; consumer contract fixtures in CI (each consumer parses a canned stream) so a break is a red build, not an archaeology session.

**R2 — The PF2E→real-time translation loses the tuned feel.** MAP→flurry decay and 3-action→cooldowns have no precedent in the tuned data; the auto-battler means no player skill masks imbalance, and the bimodal failure mode (steamroll-or-wipe) is exactly what the D&D dev's 14-point forecast error episode warns about. **Mitigation:** distribution harness live from day one of milestone 1.3, not after; translation knobs (decay rates, cooldown curves, engagement radii) in data, never in code; golden scenarios hand-checked against Godot playtest memory; tune to histograms, not averages.

**R3 — Degenerate no-intervention combat.** Kiting loops, heal stalemates, flee-oscillation — the old code's `HANG!` guard class reborn as a *design* failure the player must watch, powerless. **Mitigation:** stalemate detection is a sim invariant with a defined resolution rule (not UI-level); 10k-seed termination property test in CI; stalemate-rate telemetry in every harness run with a < 1 % budget; AI scoring keeps an explicit anti-oscillation term (the old anti-clustering weight generalized).

**R4 — The campaign-content long pole.** Combat/build data arrives ~90 % complete; the layer the new loop *lives on* — 300–400 quests, 300–500 enemy bases, arcs, NPCs, deed-feats — is ~0 % and solo-authored. **Mitigation:** content formats + exemplars are Phase-1 brief deliverables; Phase-2 vertical slice (1 arc, 10 quests, 20 bases) proves the pipeline before batch production; AI-assisted batch authoring with machine gates (wiring test, count gates, schema validation) so volume never outruns integrity; the quest scheduler is designed to degrade gracefully with a small pool so the game is playable at every content level.

**R5 — Determinism leaks.** One stray `Math.random`, one iteration over an unordered structure, one async race in a resolver — and replay, forecasting honesty, and derived world state all silently break; these bugs are found months later as "the forecast lied." **Mitigation:** the lint bans above (mechanical, not disciplinary); no async anywhere in `src/sim` resolvers; seed→event-stream-hash replay test runs in CI on every commit; forecast honesty gets its own fixture (forecast distribution vs. actual outcomes over the same seeds must converge).

*Watched but not top-five:* single-file bundle growth (CI size gate: warn 8 MB, fail 12 MB uncompressed; registries lazy-parsed if ever needed); mobile WebView performance (Phase-4 trouble signal: may force presentation changes, must never force sim changes); localStorage 5 MB cap (by design the itch demo limiter; IndexedDB designated fallback behind SaveStore).

---

# Part VI — Files & project knowledge

Created/maintained during this planning session, all committed to `C:\GuildVigilWeb\output\`:

1. `C:\GuildVigilWeb\output\core-loop.md` — the settled loop, divergences, constraint weights. **→ add to project knowledge (done).**
2. `C:\GuildVigilWeb\output\decision-ledger.md` — all 8 areas, every verdict, all confirmed. **→ add to project knowledge (done).**
3. `C:\GuildVigilWeb\output\guild-vigil-migration-plan.md` — this document. **→ add to project knowledge (done).**

Recommended next actions, in order: ⓪ install the Phase 1–3 toolchain per Part IV-B (Node LTS + pnpm — ~15 minutes); ① write the four Phase-1 design briefs (event vocabulary first) via `implementation-brief`; ② stand up the repo per Part IV; ③ build the content converter while the briefs are in review — it has no design dependencies and de-risks the data early.
