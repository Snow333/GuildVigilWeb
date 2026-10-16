# Design Brief #5 — Phase 2: Unstyled UI

**Status:** APPROVED 2026-08-10 (Steven: "Lets plan on moving forward to 2.0")
**Covers:** ledger new-system ⑥ (dispatch hub, beat feed, formation, loadout, after-action, team switcher) + the session layer Phase 2 stands on
**Authorities:** `core-loop.md` (beat/dispatch/chapter loops), `decision-ledger.md` (Areas 3–5), migration plan Phase 2 outline
**Style budget:** plain HTML, monospace, zero CSS effort. Phase 3 owns beauty. Phase 2 owns *correctness of structure* — the trouble signal is styling requiring markup rewrites later.

---

## 1. The architecture decision everything else hangs on: `CampaignSession`

Phase 1's `runCampaign()` is an **autopilot**: it plays whole campaigns with fixed
v1 policies (easiest-first accept, auto level-up, one party). Live play needs the
*player* making exactly those calls. The wrong move is a parallel code path; the
right move is the one the constraints already dictate:

**Extract `src/sim/campaign/session.ts` — an interactive state machine — and
rebuild `runCampaign()` as an autopilot driving a session with the v1 policies.**

- One resolution path serves live play, the career harness, and forecasting
  (constraint 3, proven in anger).
- The career-harness snapshot becomes the refactor's proof: **same numbers after
  extraction, or the extraction changed behavior and must justify itself.**
- Every game rule stays sim-side. The Phase 2 trouble signal from the plan —
  "any game rule discovered living in a component" — becomes structurally hard
  to commit: components can only call commands and render query results.

### Commands (mutate, synchronous, deterministic)

| Command | Notes |
|---|---|
| `newCampaign(seed, roster)` | world gen, week 1, starting gold/stash |
| `advanceWeek()` | expiry sweep → posting → weekly economy tick |
| `acceptQuest(questId)` | moves board → active; does NOT launch |
| `configureDispatch(cfg)` | team members, profile, caution, loadout order per hero |
| `launchDispatch()` | travel + ambush + dungeon headless; returns the `DispatchRecord` (stream included) for playback |
| `applyLevelUp(heroId, plan)` | the existing atomic `applyLevelUp`, player-chosen plan |
| `equip(heroId, slot, itemRef)` / `unequip(heroId, slot)` | stash ↔ hero slots, slot-compatibility enforced sim-side |
| `setLoadout(heroId, entries)` | ordered priorities (core-loop D4) |
| `sellItem(itemRef)` / `buyItem(shopIndex)` | derived pricing; shop v1 (below) |
| `serialize()` / `CampaignSession.deserialize(state)` | the SaveEnvelope body |

### Queries (pure, no mutation)

`roster()`, `heroSheet(heroId)` (derived stats via assembly — the UI never
computes a modifier), `stash()`, `board()`, `worldMap()`, `travelPreview(questId)`
(A* path + ETA), `pressure(regionId)`, `shopStock()`, and
**`forecast(questId, cfg, n)`** — n headless dispatches on forked seeds
(`Seeds.forecast`) → outcome distribution. Forecast honesty is already a
risk-register fixture (R5): forecast seeds ≠ live seed, same resolution path.

### Serialized state (constraint 7 discipline)

Campaign seed, week, gold, hero states, stash instances, board/active quest state,
escalation **facts** (the sanctioned history), dispatch counter, shop rotation
week. Everything else — world terrain, derived stats, prices, tiers — recomputes.

### Phase-1 debt folded in (flagged, not hidden)

Plan milestone 1.5 listed weekly economy (restock/rotation/POI income) and
shop/haul glue; 1.5 shipped without them — a shop with no screen is untestable by
hand. They land here, with their screens: **shop restock + rotation (seeded via
`Seeds.rotation`) and sell/buy in 2.2**. POI income stays stubbed until POI
capture exists (content workstream).

---

## 2. UI wiring — React 19, no state library

- `GameProvider` owns the session + a version counter. `exec(fn)` runs a command,
  bumps the version; screens re-render and re-query. The sim is synchronous and a
  full dispatch is ≤50 ms — no async state machinery, no Redux/zustand dependency.
- The ONLY async in the app is `SaveStore` (platform layer), at the title screen
  and autosave points.
- Routing: a `screen` discriminated union in React state, not a router dep.
  Eight screens don't need URLs; Tauri wrap prefers no history coupling.

## 3. The screens (plain HTML)

| # | Screen | Reads | Commands | Notes |
|---|---|---|---|---|
| 1 | **Title / save slots** | `SaveStore.list()` | load / delete / `newCampaign` | localStorage impl in `src/platform` (first platform code) |
| 2 | **Town hub** | week, gold, pressure summary, active dispatch state | `advanceWeek()` | the chapter-loop home; nav to everything |
| 3 | **Quest board** | `board()`: level, region, expiry, rewards, pressure badge | `acceptQuest` | declining has consequences the screen must show (expiry → escalation) |
| 4 | **Dispatch setup** | team roster, `forecast()` | `configureDispatch`, `launchDispatch` | profile/caution pickers; **forecast panel**: completion/retreat/wipe bars, median haul, ETA — constraint 3 on screen |
| 5 | **World map** | `worldMap()`, `travelPreview()` | — | crude SVG: terrain cells, Haven, POI tokens, the A* path drawn for the selected quest |
| 6 | **Dispatch playback** | the `DispatchRecord` stream | — | dungeon graph SVG revealing per `explore.*` events + the **beat feed**; speed 1×/4×/16×/skip |
| 7 | **Hero panel** | `heroSheet()` | `applyLevelUp`, `equip/unequip`, `setLoadout` | level-up wizard (eligibility from sim), slot-by-slot equipment *ritual* (ledger: psychological value), loadout reorder |
| 8 | **After-action** | record summary + world consequence events | — | outcome, haul, XP, level-up prompts, escalation changes |
| 9 | **Settings stub** | — | — | replay speed default; save management |

Team switcher (ledger ⑥) ships as a one-party stub — the structure (team id on
every dispatch command) lands now so multi-team is additive later.

## 4. The beat feed — presentation contract

`src/ui/beats/interpret.ts`: `SimEvent → BeatLine { tick, text, tone }`.

- **The only place narration exists.** Resolvers stay fact-only (constraint 4).
- Total function over the FROZEN vocabulary; unknown types skip-and-count
  (forward tolerance, already the consumer rule).
- Deterministic: same stream → same lines. **The Phase 2 exit criterion** —
  text-identical replay of a fixture dispatch — is a Vitest snapshot of this
  function's output over the contract fixture, plus a Playwright assertion that
  the DOM shows exactly those lines.
- Playback maps 100 ms sim-ticks → wall time by speed multiplier; skip renders
  the full feed instantly. v1 maps every event to a line; editorial filtering
  (collapsing misses, round bucketing) is Phase 3 polish per the plan.

## 5. Playwright (starts here, per plan)

`e2e/`: boot smoke on the built single-file artifact; the core flow —
new campaign → advance week → accept quest → forecast renders → launch →
skip replay → after-action → level-up → save → reload → state persists.
Fixture-replay test pins the beat feed text. (One-time on your machine:
`pnpm exec playwright install chromium`, ~400 MB — flagged in the plan's
Part IV-B.)

## 6. Milestones

- **2.0 Session extraction.** `CampaignSession` + autopilot refactor of
  `runCampaign` + localStorage SaveStore + GameProvider + title/save slots +
  town hub with a working Advance Week. *Done when:* career-harness snapshot
  **unchanged**; save → reload → identical serialized state; the ugly app boots.
- **2.1 The roster ritual.** Hero panel: sheet, level-up wizard, equipment
  slots, loadout tab. *Done when:* a hand-played level-up and regear round-trips
  through serialize and matches sim-computed sheets.
- **2.2 The board and the map.** Quest board, dispatch setup + forecast, world
  map SVG + path preview, shop v1 (restock/rotation/sell/buy). *Done when:* a
  quest can be accepted, forecast, configured, and launched by hand.
- **2.3 The show.** Dispatch playback (dungeon map + beat feed) + after-action.
  *Done when:* a fixture dispatch replays text-identically; a real dispatch
  watched at 4× reads coherently.
- **2.4 Proof.** Playwright suite + the full-loop hand-played campaign.
  *Done when:* Phase 2 exit criteria all green.

**Parallel content workstream** (plan: vertical slice — 1 arc, ~10 quests,
~20 enemy bases, 2 NPCs) can start after 2.0 in separate sessions; validators
gate every batch.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Session refactor drifts campaign behavior | career-harness exact snapshot is the lock; any diff must be explained in the commit |
| Rules leak into components | every displayed number comes from a query; review checklist item; the lint boundary already blocks the import direction |
| Beat feed perf on 6 000-tick streams | render batched per animation frame at high speeds; virtualization deferred to Phase 3 |
| Forecast cost (100 × ≤50 ms ≈ 5 s) | chunked execution with progressive bars; n configurable; budget guard asserts ≤50 ms/dispatch in CI |
| localStorage 5 MB cap | by design (itch demo limiter); envelope size logged on save; IndexedDB fallback already designated behind SaveStore |
