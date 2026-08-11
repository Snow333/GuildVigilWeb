# Implementation Brief #9: The Type Program — Alegreya + Readable Type
**Date**: 2026-08-11
**Status**: APPROVED 2026-08-11 (Steven: "Approved — build it")
**Process**: Font exploration round 01 (`output/exploration/font-programs-r01.html`, artifact `guild-vigil-font-programs`) served as the wireframe phase. Steven chose Program B ("The Scriptorium") and a standalone readable-type accessibility toggle (decisions recorded 2026-08-11).

## Summary
Replace the Georgia/Segoe stand-ins in `tokens.css` with the licensed program: **Alegreya** (text voice) + **Alegreya Sans SC** (label/plate voice), embedded as data-URI `@font-face` so the single-file artifact stays self-contained. Add **Readable type**, a standalone accessibility toggle in Settings that swaps both token slots to **Atkinson Hyperlegible** with relaxed spacing and no italics — the typographic sibling of flat mode, persisted through the same `UserSettings` record. All three faces are SIL OFL (Google Fonts).

## Decision record (2026-08-11)
- Program B chosen from three-program exploration (over A: EB Garamond + Fell accent; C: Vollkorn/Vollkorn SC).
- Readable type = **standalone** Preferences row, NOT tied to flat mode — players get readable text without giving up the leather desk. Rationale: dyslexia research shows letterform clarity + spacing help; period serifs/italics/tracked caps are anti-patterns; Atkinson Hyperlegible is the evidence-informed pick.
- Fonts ship **inlined** (base64 woff2 in CSS), not CDN: offline Tauri later, no runtime network dependency, and the style-layer guard (every `url()` in `src/ui/styles` is a `data:` URI) already enforces exactly this shape. File size is explicitly not a gate (brief #8).

## Scope
**In scope**:
- `@font-face` layer: Alegreya (variable, roman + italic, latin subset), Alegreya Sans SC (statics 500/700/800, latin), Atkinson Hyperlegible (400/700, roman + italic, latin).
- Token swap: `--gv-serif: 'Alegreya', Georgia, …` · `--gv-sans: 'Alegreya Sans SC', 'Segoe UI', …` (stand-ins stay as fallbacks).
- True small-caps conversion: remove `text-transform: uppercase` at `--gv-sans` label sites so the SC face renders mixed small caps as approved in the specimen (~8 selectors across components/materials/screens.css); letter-spacings kept, tuned only if a site visibly breaks.
- Readable type toggle: `UserSettings.readableType` (default `false`) → `body.gv-readable` → token override block (both slots → Atkinson Hyperlegible; marginalia un-italicized; label letter-spacing → normal; body line-height 1.55). New Preferences row in Settings mirroring the flat-mode pressed-button pair (`[data-readable-on]/[data-readable-off]`).
- A small regeneration script (`tools/build-fonts.mjs`) that downloads the pinned font files and rebuilds `fonts.css` — the base64 payload is machine-written, never hand-edited (same discipline as `content/generated`).

**Out of scope** (explicitly excluded):
- Any change to type scale, sizes, or layout metrics beyond the readable-mode line-height bump.
- Font subsetting beyond latin; non-latin locales are a localization-era problem.
- The IM Fell cartouche accent (Program A's extra) — not hired.
- Art style bible / generated art (next task, unchanged).

## Files to create
- `src/ui/styles/fonts.css` — `@font-face` declarations, data-URI woff2 (machine-generated header comment; ~10 declarations).
- `tools/build-fonts.mjs` — pinned URLs → subset woff2 → base64 → rewrites fonts.css (Node, ~60 lines).

## Files to modify
- `src/ui/styles/tokens.css` — the two font tokens + `body.gv-readable` override block.
- `src/ui/styles/components.css` / `materials.css` / `screens.css` — drop `text-transform: uppercase` at label sites; readable-mode component tweaks (marginalia style, spacing).
- `src/ui/main.tsx` (or the existing style import site) — import `fonts.css` first.
- `src/sim/save/saveStore.ts` — `UserSettings.readableType: boolean`, `DEFAULT_SETTINGS` update (v stays 1; the merge-with-defaults degradation path makes the field backward compatible with existing `gv_settings` records).
- `src/ui/state/GameProvider.tsx` — `readableType/setReadableType`, drives `body.gv-readable` (parallel to `gv-flat`).
- `src/ui/screens/SettingsScreen.tsx` — "Readable type" Preferences row (same pattern as Flat mode).
- `tests/platform/saveStore.test.ts` — extend round-trip + degradation coverage to the new field.
- `e2e/settings.spec.ts` — extend: toggle readable → body class applied + persists across reload (extended in place, no new spec file).

## Edge cases to handle
- **Old settings records** (no `readableType`): merge-to-defaults path resolves `false` — never fatal, no migration needed.
- **Font decode failure / partial CSS**: fallback chains keep Georgia/Segoe/system-ui; the UI never blanks.
- **Readable + flat both on**: orthogonal, both apply; readable must not resurrect anything flat mode hides.
- **Tabular figures on plates/ledger**: verify Alegreya Sans SC honors `tabular-nums`; if the face lacks `tnum`, plates accept default lining figures (numbers stay untruncated and label-paired — the grammar cares about explicitness, not monospacing).
- **Mid-toggle stuck styles**: class swap on `body` only — no per-component state, same guarantee flat mode already meets.
- **Title screen before any campaign**: settings load at boot in GameProvider; readable type honored from the first paint, like flat mode.

## Acceptance criteria
- [ ] `pnpm check` green; suite grows only by the justified settings/e2e extensions (counts recorded in the commit message).
- [ ] Every `url()` in `src/ui/styles` remains a `data:` URI (existing guard passes with fonts.css included).
- [ ] No binary font files in the repo — the base64 CSS is the only artifact, regenerable via `tools/build-fonts.mjs`.
- [ ] All screens render the new program with no layout breakage at the three breakpoints (spot-check town, board, chart, settings, title).
- [ ] Readable type: toggling swaps every text surface (including deskbar plates and chart labels), persists across full reload, and composes with flat mode.
- [ ] Desk grammar audit line: no affordance meaning changed by the type swap; status colors untouched and label-paired.
- [ ] Performance gate on Steven's machine: no perceptible jank with full textures + embedded fonts (artifact grows ~0.5 MB — size is not a gate, paint cost is).

## Known risks / watch points
- **SC conversion misses a label site** — an uppercase-transformed string in a converted screen would render full-caps in the SC face and look wrong; sweep `text-transform` across `src/ui/styles` and screens during implementation.
- **Variable-font weight rendering** differs subtly from Georgia's synthetic bolds — headings may need a one-notch weight adjustment; handle per-site, don't touch the scale.
- **Base64 CSS size** — dist grows to ~1.4 MB; acceptable per brief #8's explicit call, but note it in the commit message for the record.
