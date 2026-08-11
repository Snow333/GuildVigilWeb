# Implementation Brief #10: Art Integration — Pastes, Portraits & the Founding Muster
**Date**: 2026-08-11
**Status**: APPROVED 2026-08-11 (Steven: "This brief is good") — ready for implementation (workspace rebuild required before code)
**Process**: Wireframe phase complete — exploration round 01 approved 2026-08-11 (`output/exploration/art-integration-r01.html`, desktop artifact `guild-vigil-art-integration`). The comp's treatment CSS is the draft implementation spec. Edge-case interview decisions recorded below.
**Authorities**: Art Style Bible v1 (`migration/art-style-bible.md`) for everything about the images themselves; brief #8 for the desk grammar; brief #9 for the settings/persistence pattern this brief reuses.

## Summary
Wire generated art into the desk. The bible's §5 treatment layer becomes generic CSS (any paste, any grade, driven by data); portrait frames land on every hero surface plus named-NPC slots; a build tool turns accepted sheets into an inlined bust module; `HeroState` gains `ancestry` and `gender` (player-chosen at muster, deterministically backfilled for old saves); and new campaigns open with the player creating the founding party — name, ancestry, gender, and class per hero.

## Decision record (2026-08-11, from wireframe review + edge-case interview)
1. **Ancestry is player-chosen, persisted on HeroState** — not derived, not rolled. Cosmetic-for-now: identity + portrait only, zero stat effects until a future systems brief deliberately hires Pathfinder ancestry mechanics.
2. **Starting party is player-created** — each founding hero gets name, ancestry, gender, and class from the player. Stats, gear, and everything downstream still roll from the sim exactly as today.
3. **Old saves backfill deterministically** — ancestry + gender seeded from the hero's id (stable string hash → registry pick), persisted on first load via the save envelope's backfill chain. A veteran's face never changes between loads.
4. **Bust-only shipping** — a build tool crops busts from accepted sheets, compresses, and writes a machine-generated data-URI module. Full sheets are repo-side identity records and never ship in the app.
5. **Wiring scope: heroes + named NPCs** — all four hero surfaces (roster, hero sheet, dispatch, after-action) plus portrait slots where named figures appear (e.g. the marshal on town-hub correspondence). Enemy wiring waits for its art batch; the treatment layer itself is subject-agnostic from day one.
6. **Sketch-pending silhouette** is the universal fallback wherever art doesn't exist yet — never a wrong portrait, never an empty hole (approved in the mock).
7. **Flat mode** per the bible §5 decision, as demonstrated: portrait + frame stay (data), tilt/tape/grain/ornament grades drop, wounded/lost desat stays (label-paired).
8. **Art staging folder**: `art/` at repo root — `art/heroes/`, `art/npcs/`, `art/enemies/` — resolving the location the bible left open. Accepted originals commit there (repo is the reference of record, same discipline as `output/anchors/`). `output/` continues to hold only anchors + exploration comps.
9. **Mid-campaign recruits** (working assumption, flip if wrong): the existing recruit economy is untouched; the muster sheet inserts the ancestry + gender choice before signing, while recruit name and class continue to roll as today. Full authorship is the founding party's privilege.

## Scope
**In scope**:
- `treatment.css` — the §5 grades as composable classes (`t-base`, `t-haven`, `t-krath`, `c-wounded`, `c-lost`, `f-elite`) per the r01 recipes, including flat-mode behavior.
- Portrait paste component (chip / large variants, grade props from data, silhouette fallback, error → silhouette).
- Bust build tool + machine-generated portraits module; `art/` staging tree + crop metadata.
- `HeroState.ancestry` + `HeroState.gender`; backfill chain entry; ancestry registry linkage.
- Founding muster screen (new-campaign flow); ancestry + gender choice added to the existing recruit flow.
- Hero surface wiring: roster ledger, hero sheet, dispatch strip, after-action; named-NPC slots.

**Out of scope** (explicitly excluded):
- Enemy portrait wiring (art doesn't exist; treatment layer ready for it).
- Full-sheet display in-app; any runtime image fetching.
- Ancestry mechanics (feats, stats, traits) — future systems brief.
- Chart flourishes (still parked by the recorded decision); combat-playback surfaces (playtest finding #3, parked).
- Any change to the recruit economy, event schema, or content pipeline.

## Files to create (directional — exact paths finalized against the repo at implementation start, per brief #8 precedent)
- `art/heroes/`, `art/npcs/`, `art/enemies/` — accepted originals, bible §4 naming (`hero-halforc-f-01.png`), append-only.
- `art/crops.json` — per-sheet bust crop rect (hand-tunable); build tool fails loudly on a missing entry.
- `tools/build-portraits.mjs` — reads accepted sheets + crops.json → 256px webp busts → base64 → writes `src/content/generated/portraits.ts` (key `{class}-{subject}` → data URI); also emits `output/exploration/portrait-contact-sheet.html` for quick visual review of every crop. Needs `sharp` as a pinned devDependency (same offline-after-install shape as build-fonts).
- `src/ui/styles/treatment.css` — the §5 layer, from the r01 comp.
- Portrait paste component + founding muster screen (+ muster additions to the recruit surface).

## Files to modify
- `src/sim/save/saveStore.ts` (+ save envelope/backfill chain) — `HeroState.ancestry: AncestryId`, `HeroState.gender: 'f' | 'm'`; deterministic backfill (FNV-style string hash of hero id → registry index — no `Math.random`, identical across machines).
- Hero creation path — muster-supplied fields flow in as creation inputs; seeded generation still covers anything the player doesn't author.
- New-campaign flow — founding muster precedes campaign start; campaign remains deterministic given the same choices + seed.
- Roster / hero sheet / dispatch / after-action screens + the town-hub NPC surface — paste wiring.
- `src/ui/state/GameProvider.tsx` — whatever plumbing the muster + portrait lookup need.
- Tests: saveStore round-trip + backfill determinism; portrait key resolution + fallback; muster state; e2e for founding muster and flat-mode portrait behavior (counts justified in the commit message, per the working agreement).

## Edge cases to handle
- **Missing art for an ancestry × gender** (8 of 12 after batch 1): silhouette fallback, everywhere, including muster tiles ("awaiting field sketch" — still choosable).
- **Old save, first load after this ships**: backfill assigns ancestry + gender once, persists; identical result on every machine and every reload.
- **Hero-creation events**: the event schema is FROZEN. If hero data rides an event payload, ancestry/gender live in state + backfill only — **verify against the repo before any code is written**; if the frozen schema can't carry the fields and state can't either, stop and re-brief.
- **Founding muster names**: empty → suggested name from the existing generator; overlong → ellipsized per the grammar (numbers never truncate; names may).
- **Duplicate portraits** (two human-f heroes): same bust by design — the 12-sheet matrix is the identity system, names + labels differentiate. Variant sheets (`-02`) can widen the pool later, append-only.
- **Corrupt/undecodable bust data-URI**: img error handler → silhouette; the UI never blanks.
- **Flat mode / readable type composition**: portraits behave per §5; readable type only swaps label faces around them — no interaction.
- **Muster + flat mode**: the founding muster and recruit choice must be fully usable flat (it's a required flow, not ornament).

## Acceptance criteria
- [ ] `pnpm check` green; suite grows only by the justified additions above.
- [ ] Zero-image-asset guard on `src/ui/styles` still passes — `treatment.css` uses `data:` URIs only; the portraits module lives in `src/content/generated/` (art is CONTENT), outside the guard's scope and inside the never-hand-edit discipline.
- [ ] Backfill determinism proven by test: same save → same ancestry/gender, twice, cold.
- [ ] New campaign cannot start without a founding party; given identical choices + seed, the campaign start is deterministic.
- [ ] Every hero surface shows the correct paste + grade from data; wounded/lost desat always accompanied by its numeric/label twin.
- [ ] Flat mode on every new/touched surface matches the §5 decision from first build.
- [ ] Grammar audit line per new surface (founding muster, recruit muster additions, NPC slots): pin/tape/wax/red-ink usage per brief #8; status colors from the frozen set, label-paired.
- [ ] Performance gate on Steven's machine: full textures + fonts + portraits, no perceptible jank (size is not a gate; paint cost is).

## Known risks / watch points
- **Event-schema pressure** is the one stop-the-line risk — resolved by the pre-code verification step above.
- **`sharp` native dep** — pin it; keep the tool build-time only so the app stays dependency-free at runtime.
- **Crop quality varies per sheet** — the contact-sheet output exists precisely so crop tuning is a fast visual loop, not a guessing game.
- **First new screens since the rollout** (founding muster) — grammar-erosion risk; the audit line is mandatory, not ceremonial.
- **Bundle growth** — ~30–60 KB per bust is fine now; if the full matrix + NPCs ever pushes paint cost (not size), revisit compression before cutting scope.
