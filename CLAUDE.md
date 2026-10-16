# Guild Vigil (web) — Orientation

Guild-management RPG: run a guild from a run-down town, send parties on missions across a world
map, watch them as an auto-battler, level them, grow the town, uncover a story that ends with a lich.
PF2E-based, not PF2E-faithful. **Stack:** TS strict · React 19 · Vite (single-file artifact) · Vitest · Playwright · pnpm.

## Read these first, in order

1. **`output/vision.md`** — what the game is. **The only file Hermes may not change.** Everything serves it.
2. **`output/working-agreement.md`** — how we work: Hermes builds and decides; Steven steers by playtesting.
3. **`output/roadmap.md`** — milestones and current status.
4. **Newest `output/playtest/*.md`** — open feedback is worked first. Also run `pnpm notes` to pull
   in-game notes from Steven's Downloads folder into `output/playtest/inbox/`.
5. **`output/handoff.md`** — what the last session left half-done.

Log every design call in **`output/decisions.md`** (one line). Park questions for Steven in
**`output/questions.md`** and keep building — never block on an answer.

Everything in `output/archive/` (old briefs, design law, core loop, ledger) is **history, not law**.
Read it only to avoid relearning a lesson. `output/reference/*.md` are engine notes — useful, not binding.

## Engineering guardrails (cheap; keep unless one costs more than it saves — log why)

- `pnpm check` green before every commit; CI (`.github/workflows/check.yml`) green after push.
- `src/sim/**` is pure TS: no React/DOM/browser globals, no `Math.random`/`Date.now` — ESLint enforces.
  Randomness via `Rng`/`Seeds` (`src/sim/core/`). Sim emits events; UI turns them into text.
- **Every new feat / item / ability / enemy trait gets a test proving it changes a fight** — assert the
  outcome (damage, hits, conditions) through the real production path, never by reading back the
  table you populated. Inert content was this project's biggest recurring defect.
- Saves **may break between milestones** — say so in the playtest note. Keep `CampaignSession.deserialize`
  working for the current format only until Steven has a campaign worth keeping.
- Content: `data/game_data.db` → `pnpm convert` → `src/content/generated/` (never hand-edit generated).
  Changes go via `data/seeds/seed_<name>.sql` → `pnpm db:apply <path>` → `pnpm convert`. Adding rows
  means updating the count gates (`tests/content/count-gates.test.ts` + converter) in the same commit.
- Parallel sessions use separate git worktrees/branches. Stage files by explicit path, never `git add -A`.

## Commands (Windows / Hermes terminal)

```bash
node node_modules/vitest/vitest.mjs run            # unit tests
npx tsc -p tsconfig.json --noEmit                  # typecheck
npx eslint src tests tools e2e --max-warnings 0    # lint
node node_modules/vite/bin/vite.js build           # build dist/index.html (npx vite build is refused)
npx playwright test                                # e2e against the built artifact
node tools/collect-notes.mjs                       # = pnpm notes
```

`pnpm` from git-bash is broken (corepack shim); call it via PowerShell:
`powershell -NoProfile -Command "& 'C:\Program Files\nodejs\pnpm.CMD' check"`.
Steven plays through the desktop shortcut → `tools/play.ps1` (rebuilds, opens `dist/index.html` in Edge).

## Layout

```
src/sim/      pure sim: core/ heroes/ combat/ dungeon/ world/ campaign/ loot/ save/ registry/
src/content/  typed registries; generated/ is machine-written
src/ui/       React app (may import sim; sim never imports UI). screens/, styles/, state/GameProvider.tsx,
              dev/ (dev panel + playtest note button)
src/platform/ SaveStore impls (localStorage)
tools/        content converter, seed applier, chart/portrait builders, notes collector
tests/        Vitest; e2e/ Playwright
```

## Gotchas that still bite

- `SimEvent` is a distributive union — `switch (ev.type)` narrows `ev.data` (the field is `.data`, not `.payload`).
  `EventStream.events` is private — use `.all()`; vitest won't notice, tsc will.
- Generated tables are `as const` → widen lookups: `new Map<number, Row>(...)`.
- No two `src/` modules may differ only by case — Windows resolves the wrong one and renders a blank page.
- Sessions verify headless; Steven runs Windows/Edge. Green CI is not proof the game runs — the
  playtest note tells him what to check.
- Ability scores are all even, mods are `floor((score-10)/2)` — a `+1` boost does nothing. Do the arithmetic.
- An AI-driven unit using a single-swing ability loses damage vs its 2-swing normal action unless rationed
  (`abilityCadenceTicks`). Heroes stay at cadence 0. See `output/reference/combat.md`.
- `isEffectReady` overstates which feats work; `tests/heroes/featReach.test.ts` measures real reach.
- Terminal heredocs silently break `&&` chains — write commit messages to a file and `git commit -F`.
