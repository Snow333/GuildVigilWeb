# Implementation Brief #8: Art Direction — The Cartographer's Table
**Date**: 2026-08-10
**Status**: APPROVED 2026-08-10 (Steven: "Looks good, lets keep moving forward") — Phase 3 contract
**Process**: Exploration rounds 1–3 served as the wireframe phase (round 01: five directions; round 02: deep pass on the chosen direction; round 03: full screen assembly + accessories — all approved in the `guild-vigil-cartographers-table` artifact). This brief pins the converged direction as the Phase 3 contract.

## Summary
The Guild Vigil UI becomes the guildmaster's desk: vellum sheets pinned and taped to a leather map-table, with a small set of physical affordances carrying all interaction meaning. Everything is diegetic on the surface and a strict modern grid underneath. The entire UI layer is **pure CSS + inline SVG — zero image assets**; generated art enters later only as "daguerreotype" pastes on vellum.

## Decision record (pinned 2026-08-10)
- Direction D5 "The Cartographer's Table" chosen from five-direction exploration.
- **Accessories**: hire the indicators + turn anchor — **quill** (out + inked = player input pending), **letter knife** (lies across unread correspondence), **thread spool** (source of red thread), **pounce pot** (anchors week-advance / "resolve week"). Sealing-taper flame-lean and blotter-mirror stay pure ambience; their proposed jobs are parked as polish candidates.
- **Width**: breakpointed — chart grows first above comp width; at very wide widths the board's 4th notice also becomes visible.
- **Locked as shown in round 03**: chart density, deckled edges on oldest sheets only, brass-plate deskbar with explicit numbers.

## Scope
**In scope**:
- Design token system (CSS custom properties) and material recipes (leather, vellum ×3 ages, brass, wax, red ink, textures via feTurbulence data-URIs).
- Shared desk-grammar components: sheet (3 ages + deckle variant), pin, tape, wax-seal button, plain button, status chip, stamp, marginalia, red thread, ledger ruling, tally, meter, portrait frame, deskbar plate/plaque.
- Hired accessories (quill, knife, spool, pounce pot) with their state semantics; ambience accessories (inkwell body, taper, blotter) as decoration.
- Procedural SVG chart system spec (terrain, POIs, route, pressure wash, discovery states).
- Flat mode as a first-class accessibility setting.
- Screen-by-screen re-skin rollout of the existing app.

**Out of scope** (explicitly excluded):
- Licensed typefaces — system stand-ins (Georgia serif / Segoe UI sans stacks) until a separate font-selection task after this brief.
- Generated-art style bible + portrait/monster generation (follows this brief; Steven provides orc/tiefling anchors then).
- Taper-lean and blotter-mirror animations (parked proposals).
- Secondary flourish-art app; Tauri dev wrap (brief #7, parked).
- Any change to event schema, sim logic, or content pipeline.

## The desk grammar (normative — one meaning per affordance, no exceptions)
- **Brass pin** = actionable now. Pinned sheets are things you can act on.
- **Tape** = standing record / reference. Never on actionable sheets.
- **Wax seal (seal-red button)** = irreversible commitment (Accept, Launch, "resolve week").
- **Red ink** = the world talking back: marginalia (beat feed, margins only — never body text), stamps (arc beats / urgency, max one per sheet), red thread (quest ↔ chart linkage, drawn from the spool).
- **Vellum age** = information age: fresh = current, aged = standing, old/stained (+deckle) = history.
- **Status colors**: frozen validated set `#0ca30c / #fab219 / #ec835a / #d03b3b`, ALWAYS label-paired, never themed, never the only carrier of a state. Flourish never replaces the number.

## Hired accessory semantics
- **Quill**: rests in inkwell when nothing awaits the player; lies out, inked, when a choice or order is pending anywhere.
- **Letter knife**: lies across any unopened letter — unread correspondence visible at a glance.
- **Thread spool**: the red thread's visual origin; hovering a quest draws thread spool → notice → chart X.
- **Pounce pot**: the week-advance anchor — "resolve week" is the scribe sanding the ledger; hosts its brief resolution shimmer.
- All accessories vanish in flat mode; every accessory state must have an explicit label/number twin elsewhere on screen.

## Chart spec (density locked at round-03 level)
Procedural inline SVG driven by real sim data: neatline + graticule ticks, cartouche, hachured mountains, forest masses, marsh, river + bridge, roads (faint dashed), sea stipple + italic sea name, compass rose, scale bar, five named regions. POIs and A* routes in red ink with X markers; undiscovered objectives marked "?" (fort until quest finds it). **Pressure wash**: threatened regions redden using the frozen status colors at low opacity, ALWAYS paired with a red-ink annotation ("raids reported ×3") — color never stands alone. The watch report remains the labeled numeric twin.

## Layout & breakpoints
Strict grid underneath at all sizes. ≤980px: single column, thread overlay hidden. ~1140px: comp baseline (board 285 / chart flex / rail 315). Above baseline: chart column absorbs extra width first; at wide desktop (~1500px+), the board shows its 4th notice slot. Deskbar always full-width with explicit numbers (week, gold, renown, region).

## Flat mode (accessibility contract)
Off: tilt/rotation, grain/texture layers, stamps' rotation, accessories, thread overlay, deckle clipping, blotter pad, hover-lift transforms. Unchanged: the full grid, all data, all labels and numbers, status chips (color + label), all actions. Flat mode is a persisted user setting, honored by every screen from its first converted build.

## Files to create / modify (directional — exact paths finalized against the repo at implementation start)
- `src/styles/tokens.css` (new) — color, texture, radius, shadow, tilt, motion, type tokens. The single source; components consume tokens only.
- `src/styles/materials.css` (new) — sheet/leather/brass/wax recipes composed from tokens.
- Shared component styles/templates for the grammar vocabulary (sheet, pin, tape, seal button, chip, stamp, marginalia, thread, tally, meter, ledger, deskbar).
- Per-screen style conversions, in rollout order below. Reference comps live in `output/exploration/` (rounds 01–03) and the desktop artifact gallery.

## Rollout order
1. Tokens + materials + shared grammar components (no screen conversion yet; existing UI untouched).
2. Town hub / Marshal's Table (letter, deskbar, beat marginalia).
3. Quest board (notices, stamps, empty slots, thread to chart).
4. Roster ledger.
5. The chart (largest single piece — procedural cartography from sim data).
6. Dispatch/run + after-action screens (old vellum for history).
7. Dialogs, settings, remaining surfaces + accessory states wired (quill, knife, spool, pounce pot).

## Edge cases to handle
- Flat mode + mid-hover state changes: no stuck transforms.
- Thread overlay at breakpoints: hidden below 980px; endpoints recompute on layout change, never point at stale positions.
- Pressure wash with no annotation data: wash must not render without its red-ink label (fall back to label-only).
- Many marginalia (busy beat weeks): margins overflow gracefully — scroll/stack, never overlap body text.
- Long quest names / region names on notices, chart labels, and deskbar plates: truncate with full text on hover, numbers never truncated.
- Undiscovered POIs: "?" markers must not leak names via tooltips or DOM.

## Acceptance criteria
- [ ] `pnpm check` green; full suite (264 tests + 3 e2e) passes untouched — beat-feed contract and event schema unchanged.
- [ ] Zero image asset files added for the UI layer; textures and art are CSS/inline-SVG only (data-URI SVG counts as inline).
- [ ] Status colors appear only from the frozen set and are label-paired everywhere (spot-check per converted screen).
- [ ] Flat mode toggle works on every converted screen and persists.
- [ ] Each converted screen visually matches its comp's grammar (pin/tape/wax/red-ink usage audited against this brief).
- [ ] Performance: no perceptible scroll/hover jank on Steven's machine with full textures on (performance is the only gate; file size is explicitly not one).

## Known risks / watch points
- **feTurbulence layering cost** — multiple texture layers per sheet could add paint cost on large screens; measure early (chart screen especially), simplify layers before cutting the look.
- **Grammar erosion** — future UI added without affordance discipline is the biggest threat to the direction; every new surface gets a grammar audit line in the test-validation checklist.
- **Comp ↔ implementation drift** — comps are the reference of record; keep them committed in `output/exploration/` and update the artifact in place if the direction shifts.
- **Chart complexity growth** — the procedural chart will attract feature ideas; density is locked at round-03 level until a deliberate revisit.
