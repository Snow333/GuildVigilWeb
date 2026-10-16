# Implementation Brief #10: Art Integration — Pastes, Portraits & the Founding Muster
**Date**: 2026-08-11
**Status**: **IMPLEMENTED 2026-08-11** — shipped green (305 unit + 9 e2e). As-built deviations, the grammar audit, and the one scope flip are recorded in `migration/status.md`; the short version is at the bottom of this file. Approved 2026-08-11 (Steven: "This brief is good").
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
- [x] `pnpm check` green; suite grows only by the justified additions above (+27 unit, +2 e2e, justified in the commit message).
- [x] Zero-image-asset guard on `src/ui/styles` still passes — `treatment.css` contains no `url()` at all (it reuses `--gv-tex-grain`); the portraits module lives in `src/content/generated/`, outside the guard's scope.
- [x] Backfill determinism proven by test: same save → same ancestry/gender, twice, cold (`tests/save/backfill.test.ts`), plus the exact backfill values pinned in `tests/heroes/ancestry.test.ts`.
- [x] New campaign cannot start without a founding party (e2e asserts the gate); identical choices + name reproduce the campaign exactly (unit).
- [x] Every hero surface shows the correct paste + grade from data; wounded/lost desat always accompanied by its numeric/label twin.
- [x] Flat mode on every new/touched surface matches the §5 decision from first build — verified on the BUILT artifact, not just in dev.
- [x] Grammar audit done (founding muster, pastes, NPC slot) — two red-ink misuses caught in screenshot review and fixed. Recruit-muster additions N/A: see the scope flip. No status hexes in `treatment.css`.
- [ ] Performance gate on Steven's machine: full textures + fonts + portraits, no perceptible jank. **STILL OPEN — needs Steven's hardware.** Bundle 1,197 KB (was 1,137 KB); +60 KB for four inlined busts.

## Known risks / watch points
- **Event-schema pressure** is the one stop-the-line risk — resolved by the pre-code verification step above.
- **`sharp` native dep** — pin it; keep the tool build-time only so the app stays dependency-free at runtime.
- **Crop quality varies per sheet** — the contact-sheet output exists precisely so crop tuning is a fast visual loop, not a guessing game.
- **First new screens since the rollout** (founding muster) — grammar-erosion risk; the audit line is mandatory, not ceremonial.
- **Bundle growth** — ~30–60 KB per bust is fine now; if the full matrix + NPCs ever pushes paint cost (not size), revisit compression before cutting scope.

---

## As built (2026-08-11) — read `migration/status.md` for the full record

**Stop-the-line: GREEN.** Hero creation does not ride an event payload; `world.hero_recruited` is `{ heroId }` and every `hero.*` payload is id-only. `EVENT_TYPE_MANIFEST` untouched.

**Scope flip on §9 (pre-authorized by the brief).** There is no recruit flow to insert a choice into — nothing emits `world.hero_recruited`, and there is no recruit surface or economy. The ancestry/gender chooser ships as a component the founding muster consumes, ready for the future recruit brief. The recruit-flow line item is not shipped, by design.

**Deviations, each deliberate:**
1. No `art/crops.json` — dedicated 1:1 bust generations plus a deterministic top-biased square crop (`TOP_BIAS = 0.25`, validated visually against all four accepted busts) replaced the hand-tunable crop table. The contact sheet is the verification loop.
2. Treatment classes ship `gv-`-prefixed (`gv-t-base`, `gv-c-wounded`, `gv-f-elite`) — same contract, house spelling.
3. Founding class list = the four archetypes the registry can outfit at level 1. No starting-gear-by-class table exists; widening it is content work, which this brief excludes.
4. The default founding party is authored, and **Elandra is an Elf on purpose** — no elf art exists, so the silhouette fallback is on screen in every default campaign and every e2e run.
5. Title screen's "New campaign here" demoted from wax seal to plain button; the seal moved to "Sign the charter", where the commitment now happens.
6. `#style-drawer` gained a treatment row (every grade, one subject, desk and flat) — not in the brief, added because an unseen grade drifts.

**Bug found by a test written for this brief:** ancestry and gender produced only 6 of 12 possible pairs. FNV-1a's odd prime preserves parity, so bit 0 of the digest is the input's XOR-parity and two namespaced hashes of the same id correlate. Fixed with a murmur3 `fmix32` avalanche before the modulus; `fnv1a32` itself untouched because `signState` is a persisted save signature (a test pins them together).
