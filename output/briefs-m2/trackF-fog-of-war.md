# Track F — Fog of war: the world map reveals as you explore (M4)

**Read `output/briefs-m2/_shared.md` first** for the sandbox rules.

- **Worktree:** `C:\GuildVigilWeb-fog`  **Branch:** `m4/fog-of-war`
- **Playwright port:** `GV_PORT=4185` (never 4173 — a shared port tests the WRONG build)
- **Milestone:** M4 — "Multiple parties, exploration, outposts"

---

## The job

Right now the world map shows **everything** from week one, so exploring
reveals nothing and the map has no sense of frontier. Make the map start dark
and open up as the guild walks the land.

**Player-facing goal:** looking at the map should tell you *where you have been*
and make the unknown parts feel worth going to.

## The seam already exists — do NOT change session.ts

Committed on `main` before you branched:

| Call | Gives you |
|---|---|
| `session.visitedTiles()` | `{x,y}[]` — every world tile the party has stood on, including every step of each travel path. Haven is always present. |
| `session.buildingLevel(11)` | the **Watchtower**'s level (0 = not built) |
| `session.worldMap()` | the `WorldMap` (terrain, `cost(x,y)`) |
| `WORLD` from `@content/world` | `width` 80, `height` 60, `haven` |

`visited` is persisted and backfilled, so you do not need to touch saves.

### The design rule that matters

**THE VISIT LOG IS STATE; WHAT IT REVEALS IS DERIVED.** Compute the revealed
area as a pure function of `visitedTiles()` + the guild's sight range. Do NOT
store a revealed set. The reason: the Watchtower widens sight, and a derived
layer means building one **re-reveals history** (everywhere you have already
walked gets a bigger halo) instead of leaving a permanent dark hole where you
walked before you had it.

## Files you own

- `src/sim/world/reveal.ts` (new) — the pure fog layer
- `src/ui/screens/WorldMapScreen.tsx` — render it
- `src/ui/screens/worldChart.ts` — if the chart needs the fog too (your call)
- `src/ui/styles/*.css` — additive only
- `tests/world/reveal.test.ts` (new), `e2e/fog.spec.ts` (new)

⚠ **DO NOT TOUCH** `src/sim/campaign/*.ts`, `src/content/*.ts`, or
`src/sim/save/*`. A parallel track is restructuring `session.ts` for multiple
parties and will conflict with you. If you need something from the session,
**write it in your report** — do not add it yourself.

## What to build

1. **`src/sim/world/reveal.ts`** — something like:
   ```ts
   export interface FogView { isRevealed(x: number, y: number): boolean; revealedCount: number; }
   export function computeFog(visited: readonly {x:number;y:number}[], sightRange: number): FogView;
   export function sightRangeFor(watchtowerLevel: number): number;
   ```
   Shape it as you see fit, but it must be **pure** and **cheap enough to call
   on every render** of an 80×60 map (4,800 tiles). Precompute once per call,
   do not do an O(tiles × visited) scan per lookup.

2. **Sight range from the Watchtower**, wiring two of the 22 inert effects:
   - no Watchtower → a small range (base walking awareness, suggest 3)
   - `map_reveal_small` (level 1) → wider
   - `map_reveal_large` (level 2) → wider still
   Read the **effect key** off the buildings table, not the level number, and
   **not** the player-facing copy. See `EFFECT_COPY` in `src/content/town.ts`
   for the keys; `src/sim/campaign/town.ts` has `effectAt`/`hasEffect` helpers
   you may import (read-only).
   ⚠ Then update those two entries' `wired` flag — **that is the one edit you
   may make to `src/content/town.ts`**, and `tests/campaign/town.test.ts` pins
   the wired list, so update that expectation too. Nothing else in those files.

3. **Render it on the world map.** Unrevealed tiles should read as unknown —
   not merely dimmed, but clearly *not information*. Quest and site pins in
   unrevealed areas should be hidden or shown as a rumour, your call; say which
   you chose and why. Haven must always be visible.

4. **Tests.** Unit: a fresh guild reveals only a halo around Haven; walking a
   path reveals along it; a Watchtower widens the halo *around tiles already
   visited* (the re-reveal property above — this is the important one);
   `revealedCount` never shrinks as visits accumulate. e2e on `GV_PORT=4185`:
   the map starts mostly dark, and after a mission more of it is visible.

## Done means

- `npx tsc -p tsconfig.json --noEmit`, `npx eslint src tests tools e2e --max-warnings 0`,
  `node node_modules/vitest/vitest.mjs run`, `node node_modules/vite/bin/vite.js build`,
  `GV_PORT=4185 npx playwright test` — all clean.
  ⚠ Note: vitest currently exits 1 on main with an unhandled
  `[vitest-worker]: Timeout calling "onTaskUpdate"` even when every test passes.
  That is a known pre-existing runner flake — report the **Tests NN passed**
  line, and do not try to fix it.
- **Negative controls:** sabotage the fog (reveal everything; reveal nothing;
  make sight ignore the Watchtower) and confirm the right tests go red, then
  restore and check `git diff` on `src/` is clean. Report which fired.
- **You have LOOKED at the map yourself** — load the `verify-html-mockups-offline`
  skill and screenshot the built artifact, fresh and after a mission. A fog
  layer is exactly the kind of thing that passes tests and looks wrong.
- Committed on `m4/fog-of-war`, staged **by explicit path** (never `git add -A`).
  Do not push, do not merge.

## Report back

The sight ranges you chose and why, what you did with pins in the dark, which
negative controls fired, your screenshot paths, and anything you needed from
`session.ts` but could not get.
