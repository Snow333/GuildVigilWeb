# Track P: scrolling feels laggy in Edge (dispatch + after-action)

**Worktree:** `C:\GuildVigilWeb-perf`, branch `m2-perf`. **GV_PORT=4183.**
Read `C:/GuildVigilWeb/output/briefs-m2/_shared.md` first.

## What Steven said
"The framerate/draw performance in Microsoft Edge is low. Is there an artificial cap on the framerate?
In the dispatch and after-action screens just scrolling can feel 'laggy'."
He plays the built `dist/index.html` from `file://` in Edge (Chromium) on Windows.

## Answer the question first, with evidence
- Is there an artificial frame cap? (`CombatViewer.tsx` and `PlaybackScreen.tsx` use
  `requestAnimationFrame`; check for any throttle, interval, or React re-render every frame that makes
  scrolling heavy while playback runs.)

## Measure, then fix
1. Build a repeatable measurement: Playwright (Chromium) at 1280×900 and at deviceScaleFactor 1.5,
   open the dispatch playback screen and the after-action screen, scroll by wheel steps, and record
   frame timing via CDP (`Tracing` or `Performance` metrics, or a rAF frame-time sampler injected with
   `page.evaluate`). Report median and p95 frame time and dropped-frame % per screen. Also run with
   CPU throttling ×4 to make the cost visible (Steven's machine may be slower than CI).
2. Find the cost. Suspects (verify each with numbers, do not assume):
   - `.gv-desk { background-attachment: fixed }` with several texture layers (`materials.css` ~line 21):
     fixed backgrounds force a full-viewport repaint on every scroll.
   - `mix-blend-mode: multiply` on every `.gv-sheet::before` grain layer and portrait tints
     (`materials.css`, `treatment.css`) — blend modes break compositing.
   - big `box-shadow`s and `transform: rotate()` on sheets; `filter:` on portraits/buttons.
   - inlined SVG-noise textures (`--gv-tex-*`) repainted at full size.
   - React re-rendering the whole screen on every animation frame during playback.
3. Fix while keeping the look (Steven cares about the paper-on-a-desk style). Typical fixes:
   replace fixed background with a `position: fixed` pseudo-element layer (`will-change: transform`),
   pre-flatten blend layers, `contain: paint` on sheets, memoise heavy rows. A `body.gv-flat` mode
   already exists in Settings; the DEFAULT must become smooth, not just the flat mode.
4. Re-measure. Report a before/after table per screen. Take before/after screenshots and compare them
   visually; any visible style change must be small and listed.

## Files you own
`src/ui/styles/*.css`, `src/ui/screens/PlaybackScreen.tsx`, `src/ui/screens/CombatViewer.tsx`,
`src/ui/screens/CombatField.tsx`, a new perf script under `tools/` or `e2e/perf.spec.ts`.
`AfterActionScreen.tsx`: CSS class/memo changes only. Other tracks edit HeroPanel/SheetTab/QuestBoard/
TownHub/session.ts — stay out of those.

## Done means
The shared "done" plus: the before/after numbers table, the frame-cap answer in one sentence, and how
Steven can feel the difference (which screen to scroll).
