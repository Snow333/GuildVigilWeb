# M1 Track B — the mission report (subagent brief)

**Worktree:** `C:\GuildVigilWeb-trackB` (branch `m1-trackB`, from `fb0906b`). `node_modules` is a junction
to the main checkout — do NOT run `pnpm install` there.
**Owner of files:** this track may edit ONLY the files listed under "Files you own". Track A (another
agent) is editing `src/sim/heroes/**`, `src/sim/campaign/campaign.ts`, `src/ui/screens/HeroPanel.tsx`
and parts of `src/sim/campaign/session.ts` in parallel.

## Player-facing goal

When a party comes home, the player should understand **what happened, who did what, and what to do
next** in under ten seconds — and be able to level heroes with one click.

## Tasks

1. **Real quest names everywhere.** `DispatchSetup.tsx` passes `` `#${active.questId}` `` as `questName`
   and its heading says "quest #3". Add ONE session query `questName(questId: number): string` to
   `src/sim/campaign/session.ts` (append it next to `regionName`, ~line 1369 — touch nothing else in
   that file) reading `questsById.get(id)?.name`. Use it in DispatchSetup's heading and `questName`,
   and in TownHub's "Dispatch: quest #N" button.
2. **Readable mission summary** on `AfterActionScreen.tsx`, above the existing XP table. A new
   "What happened" block with:
   - one plain sentence for the outcome (e.g. "Cleared the dungeon — 6 rooms, 4 fights won, boss slain"
     or "Retreated after 3 rooms: the party was too hurt to go on"),
   - a per-hero table: **damage dealt, damage taken, healing done, kills, times downed, died?** — use
     `deriveDispatchSummary(record.dispatch.stream)` from `src/sim/core/events/summary.ts` (it already
     tallies all of this per hero). For surface fights (`record.fights`, no dispatch) merge the tallies
     from each fight's stream the same way.
   - Name heroes via `session.roster()`; never show raw ids.
   - Put the text-building logic in a NEW pure helper `src/ui/screens/missionSummary.ts` (stem must not
     case-collide with any existing module) so it is unit-testable.
3. **"Auto level up" buttons** (one click = apply every level the hero has earned, class-template picks):
   - Call `autoLevelHero(session, heroId)` from `@sim/campaign/campaign` inside `exec(...)` then
     `void saveGame()`. It already exists and is tested; do not modify it.
   - TownHub roster: beside each hero whose `heroSheet(id).canLevelUp` is true, an "Auto level up" button
     next to the existing "Open ● level up!" button. Also one "Auto level up all" button in the Orders
     sheet, shown only when at least one hero can level.
   - AfterActionScreen Orders sheet: next to the existing "Ready to level: <name> ▸" buttons, an
     "Auto level up all" button.
   - Give each new button a `data-auto-level` attribute (e2e handle).

## Files you own

`src/ui/screens/AfterActionScreen.tsx`, `src/ui/screens/TownHub.tsx`, `src/ui/screens/DispatchSetup.tsx`,
NEW `src/ui/screens/missionSummary.ts`, NEW `tests/ui/missionSummary.test.ts`, NEW `e2e/mission-report.spec.ts`,
and the single appended `questName` method in `src/sim/campaign/session.ts`.

## Rules (from the repo's CLAUDE.md)

- `src/sim/**` never imports React/DOM. The UI computes no game rule — it reads session queries.
- Screens use the existing CSS classes (`gv-sheet`, `gv-head`, `gv-btn`, `gv-xptable`, `gv-statline`,
  `gv-marg`); copy the patterns already in AfterActionScreen. Status colour is never the only signal.
- Plain player language: no "dispatch", "tick", "event". Short sentences — the player is dyslexic.
- Tests: assert real output. For missionSummary, build a real dispatch (see
  `tests/campaign/session.test.ts` for how a session launches one) and check the sentence and the
  per-hero numbers match `deriveDispatchSummary`. Add a negative control: break the helper and confirm
  the test fails, then restore.
- e2e: new campaign → accept easiest quest → launch → After-action shows "What happened" with every hero
  name; use the dev panel (` key, "+1 level (auto)" / "+XP to level") to make a hero eligible, then click a
  `data-auto-level` button and assert the roster level went up. See `e2e/dev-tools.spec.ts`,
  `e2e/core-loop.spec.ts`, `e2e/newCampaign.ts`.
- Existing e2e pins texts: "After-action ▸", "Return to town", "Dispatch setup", "Launch dispatch",
  "Open", "level up!". Keep them.

## Commands (run inside `C:/GuildVigilWeb-trackB`, git-bash)

```bash
npx tsc -p tsconfig.json --noEmit
npx eslint src tests tools e2e --max-warnings 0
node node_modules/vitest/vitest.mjs run
node node_modules/vite/bin/vite.js build && npx playwright test
```
`npx vite build` is refused by the terminal tool — use the line above. The Playwright web server is
`pnpm preview` on port 4173 with reuseExistingServer — if port 4173 is busy (the main checkout may be
running e2e), wait and retry rather than killing anything.

## Done means

All four commands green; work committed on branch `m1-trackB` (stage files by explicit path, never
`git add -A`; commit message starts `M1 track B:`); do NOT push, do NOT merge. Report back: commit hash,
files changed, test counts, any design calls you made (one line each — the parent logs them in
`output/decisions.md`), and anything you could not finish.
