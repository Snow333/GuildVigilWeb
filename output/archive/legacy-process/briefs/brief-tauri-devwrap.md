# Implementation Brief #7 — Tauri Dev Wrap: Guild Vigil as a standalone .exe

**Date:** 2026-08-10
**Status:** DRAFT — awaiting Steven's approval
**Covers:** the desktop-shell half of plan Phase 4, pulled forward as a DEV wrap
(store packaging, signing, auto-update, mobile all stay Phase 4 proper)
**Authorities:** migration plan Part III Phase 4 outline · constraint 6 (persistence
through SaveStore only) · plan Part IV ("the itch browser build and the
Tauri-wrapped build are the SAME artifact, differing only in persistence backend")

---

## Summary

Wrap the existing single-file artifact in a Tauri 2 shell so `pnpm tauri build`
on Steven's machine produces `guild-vigil.exe`. One real code deliverable — the
filesystem SaveStore the interface was designed for in Phase 1 — plus shell
config and one small title-screen adaptation. Zero changes under `src/sim`
(the architecture's standing bet; this brief must not be the one that breaks it).

## Scope

**In:** Tauri 2 scaffold (`src-tauri/`), FS SaveStore over the app-data dir,
platform-detected store selection, title screen handling unlimited desktop
slots, build scripts + docs, dev icon.
**Out (explicit):** code signing (unsigned .exe → SmartScreen warning, accepted
for dev), auto-update, installer polish, Steam/GOG/itch packaging, mobile,
any styling, any sim change.

## The pieces

1. **`src-tauri/` scaffold** — `tauri.conf.json` (window "Guild Vigil"
   1280×800, `frontendDist: ../dist`, `beforeBuildCommand: pnpm build`),
   generated `main.rs`/`Cargo.toml`/`build.rs` (no hand-written Rust), fs
   plugin capability scoped to the app-data dir, placeholder icon.
   **CSP note:** the single-file artifact inlines all JS — Tauri's default CSP
   blocks inline scripts, so the config must allow it (dev-wrap acceptable;
   revisit at store packaging).
2. **`src/platform/tauriSaveStore.ts` (~90 lines + tests)** — implements
   `SaveStore` over `@tauri-apps/plugin-fs`: one JSON file per slot under
   `<appData>/saves/`, `list()` scans the dir, `maxSlots()` returns Infinity
   (the Phase 1 interface docstring finally honored). Filesystem calls injected
   for tests, same pattern as `LocalStorageSaveStore`'s injectable storage.
3. **Store selection (~10 lines)** — GameProvider detects the Tauri runtime
   (`__TAURI_INTERNALS__` present) and picks FS store vs localStorage. The web
   build keeps its 3-slot itch-demo cap untouched.
4. **Title screen: unbounded slots** — today it renders `maxSlots()` fixed rows;
   `Infinity` would crash it. Change: render EXISTING saves as rows + one
   "new campaign" row; when `maxSlots()` is finite and reached, the new-row
   disables with the cap note. Web behavior stays visually identical (3 slots).
5. **Scripts + docs** — `pnpm tauri` passthrough script; deps
   `@tauri-apps/cli` (dev), `@tauri-apps/api`, `@tauri-apps/plugin-fs`;
   README note for the one-time machine setup.

## Verification split (honest about the cloud's limits)

Windows binaries can't be built in the cloud workspace. Cloud verifies: FS-store
unit tests (mocked fs), store-selection logic, title-screen behavior in the
browser (unchanged web path), `pnpm check` + e2e green, config JSON validity.
**Steven verifies:** one-time `rustup` + MSVC Build Tools install, then
`pnpm install; pnpm tauri dev` (live window) and `pnpm tauri build` (the .exe),
plus the desktop hand-check below.

## Edge cases

- Corrupt/foreign file in the saves dir → listed as absent, load → null (same
  contract as the localStorage store; test-pinned).
- First run: saves dir doesn't exist → created on first save; empty `list()`.
- Same campaign name on web and desktop: different stores, no collision.
- Deleting a save on disk while the game runs: next `list()` reflects it (reads
  are live, nothing cached).
- WebView2 missing (rare on Win10/11): the Tauri installer bootstraps it.

## Acceptance criteria

- [ ] Cloud: `pnpm check` + e2e green; FS-store tests green; web title screen
      unchanged at 3 slots
- [ ] Steven: `pnpm tauri build` produces a runnable `guild-vigil.exe`
- [ ] Desktop hand-check: new campaign → Marshal greets → save → close the app
      → relaunch → load → identical state; save visible as a JSON file under
      the app-data dir; more than 3 saves possible
- [ ] `git grep`-level proof: zero diffs under `src/sim`

## Risks / watch points

- Tauri CLI/plugin version drift vs. my knowledge cutoff — if `pnpm tauri dev`
  errors on config shape, the error text comes back to me and the fix is config,
  not architecture.
- Rust toolchain install friction on Steven's machine (one-time, ~10 min).
- The `dist/` artifact must exist before `tauri build` — the
  `beforeBuildCommand` handles it, but `tauri dev` uses the dev server URL
  instead (configured `devUrl`), so both paths need the config to be right.
