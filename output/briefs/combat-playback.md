# Design Brief #12 — Combat Playback: The Field

**Status:** APPROVED 2026-08-12 (Steven, on comp r01 — "Approved — write the brief")
**Covers:** playtest finding #3 unparked — the full combat view for *every* fight, surface and dungeon; the first sanctioned addition to the frozen event schema; and the live beat-feed naming bug.
**Authorities:** `core-loop.md` (D2 no intervention once engaged, D4 loadout priority), `decision-ledger.md` (Area 2), **brief #8 (art direction) — normative for all UI**, `brief-event-vocabulary.md` (freeze policy), migration plan risks R1/R2/R3.
**Comp:** `output/exploration/brief12-combat-view-comp-r01.html` — interactive, driven by three real recorded streams.
**Measured findings:** `migration/briefs/combat-playback-findings.md` (project knowledge). Read it before disputing any number here.

---

## 1. Why this exists, and what the diagnosis got wrong

R2 (did the PF2E→real-time translation keep the feel) and R3 (kiting loops, heal stalemates, degenerate combat) are the two risks the plan cannot close from histograms alone. Combat is never *watched*. A player who cannot intervene must at least be able to see. That is the whole justification, and it is unchanged.

Three claims in the prior diagnosis did not survive contact with the code. They do not touch either taken decision; they change what the view can be built out of, and this brief is written to the measured facts.

| The handoff said | The sim does | Consequence |
|---|---|---|
| "the sim emits continuous 2D positions" | `combat.unit_moved` has **one** call site (`moveTick`, `encounter.ts:365`) and fires only on the `!arrivedBefore && arrivedAfter` edge. A 4v4 emits ~6; a whole 4-fight dispatch emitted 23. | No recorded motion. The field **interpolates between waypoints and says so** (§5, D1). |
| `purpose` is `engage \| standoff \| flee \| reposition` | Only `engage` and `standoff` are ever emitted. `combat.unit_fled` is emitted **nowhere**. | Flee-oscillation is *unsimulated*, not unrendered. Logged, not chased (D4). |
| show a stalemate forming | Stalemate needs 300 ticks of damage silence; fights end in 32–143 (P50–P90). All four harness scenarios: `stalemateRate: 0`. | No bespoke visual. A **silence gauge** against the 300-tick window (§4.5). |

Two more measurements shaped the layout. **Combat is 43–82% of a dispatch stream's events and 27–79% of its ticks**, and the current screen renders a room graph for the *other* side of that split. And **16× is not a viewing speed** — a whole dispatch at 16× is 1–3 seconds.

## 2. The schema addition — `combat.unit_spawned`

**DECISION RECORD.** The event schema was frozen 2026-08-10 (milestone 1.1). The freeze policy permits *additions* and forbids renames and removals; the `EVENT_TYPE_MANIFEST` snapshot test is what enforces it. This is the first sanctioned addition, approved 2026-08-12, and R1 (event-vocabulary churn) is the plan's #1 risk — it is treated with that weight.

**Rationale.** A combat stream today carries instance ids and nothing else. Verified by serialising a whole fight and searching it: no display name, no `maxHp`, no side metadata appears anywhere. A consumer can therefore place a dot but cannot label it, and `damage_applied.hpAfter` has no denominator so no HP bar can be sized. Reconstructing that from the registry means every consumer re-deriving identity from instance-id string shape — brittle, un-replayable, and already the cause of the live bug in §3. Emitting spawn facts makes combat streams **self-describing**: they survive save/replay, they serve the harness and the view identically, and they fix the naming bug at its source rather than per screen.

```ts
'combat.unit_spawned': {
  unitId: string; side: 'heroes' | 'enemies'; baseId: string;
  name: string; maxHp: number; x: number; y: number;
};
```

Exactly the approved payload — **no additional fields**. (`speed` was offered for the interpolation and declined; §5 does not need it.)

**Emission.** In `runEncounter`, immediately after `placeFormation` and immediately after the `combat.started` emit, one event per unit at tick 0, `cause = startEv.seq`, in `sideA` order then `sideB` order. `combat.started` stays `events[0]` — the existing stream-contract test that asserts this keeps passing, deliberately.

**Additive-only obligations, all of which the implementation must demonstrate:**

- `EVENT_TYPE_MANIFEST` **grows by one entry**; its snapshot test must report a grown array, never a broken one. If it breaks, something was renamed and the change is wrong.
- `interpret.ts` gains `case 'combat.unit_spawned': return null;` — setup fact, not narration. The `combat.started` line already names both sides.
- The contract fixture (`src/sim/fixtures/dispatchFixture.ts`) is **extended, never forked** (CLAUDE.md). Extending it moves the `stream.test.ts` and `interpret.test.ts` snapshots and the e2e beat-feed spec. Those diffs are expected, must be regenerated deliberately, and must be justified in the commit message.
- **The harness snapshots must NOT move.** `encounter-distribution` and `career-distribution` measure resolution, not emission. If either moves, the addition leaked into behaviour and must be reverted, not re-baselined.

## 3. The live bug, fixed at the source

`PlaybackScreen` calls `interpretStream(stream, id => names.get(id) ?? id)` with `names` built from the hero roster only, and `interpretEvent`'s `nameFor` defaults to identity — so dungeon playback has been printing `disp_1:camp_e0 → Torvald: hit (14+7=21 vs DC 16)` since brief #5.

Fix: a single resolver in `src/ui/beats/`, `namesFromStream(stream, roster?)`, folding `combat.unit_spawned` into a `Map<string,string>` and unioning the roster over it. Every consumer gets it; no screen re-implements it.

**Disambiguation (D3, approved).** Four goblins are four identical labels. `namesFromStream` numbers repeats **by spawn order** — `Goblin ɪ`, `Goblin ɪɪ`, `Goblin ɪɪɪ`. Presentation-only, derived from the stream, deterministic, zero sim change. Unique names pass through untouched.

## 4. The field — the view

One component, `src/ui/screens/CombatField.tsx`, pure over `{ spawns, events, tick }`. It is a **plan-view sheet in the chart's hand** — the same ink-on-vellum voice as the dungeon sketch, per brief #8.

### 4.1 Geometry and scale

`ARENA` is 14 × 10 world units at 1 unit = 5 ft → **70 × 50 ft**. Ruled grid every unit, heavier every second unit; tick marks on the top and left rules; muster lines dashed at `sideAx` and `sideBx`. Bottom margin carries a 5-unit **scale bar reading "25 ft"** and the legend. Geometry is presentation's problem — it lives here, never in the sim.

### 4.2 Units — side by form, never by colour

Heroes are **solid ink discs**; enemies are **hollow discs with a centre dot**. Downed heroes are hollow with a slash and the word `DOWN`; the dead become an ×. Side is carried by glyph form and by the label, so the frozen status set is never the sole carrier of anything — brief #8 law, and `tests/ui/style-tokens.test.ts` enforces the family of it.

Each unit carries name (small caps), `hp/maxHp` as a **number**, and an HP bar in the frozen set (`--gv-s0/1/2/3`) — the bar is always paired with the number, never alone.

### 4.3 Labels at scale — this must not assume 4v4

**Party size grows: heroes to 6, and enemy groups larger later.** Nothing in this component may hardcode a side size.

- Layout is driven entirely by `spawns.length` per side, matching `placeFormation`'s own N-driven `startY = (height − (n−1)) / 2`.
- Labels collide badly once units converge, so a **displacement pass** runs per side: sort by y, enforce a minimum lane spacing, clamp inside the arena, and draw a leader line from glyph to label whenever it has been pushed more than a few pixels. Heroes label left, enemies label right, keeping the melee scrum in the middle legible.
- `ARENA.height` is 10, so ~11 units per side is the ceiling before formation rows overlap. Add an **explicit guard and a test at 6v6**, rather than letting labels silently pile up. Room-shaped arenas were always slated for 1.4; when they arrive this is the component that has to flex.

### 4.4 What the fight looks like

Dashed **targeting lines** from each unit to its current target — `combat.unit_engaged` is the second-most-common event in a fight and the feed drops it entirely today, so this is where target thrash becomes visible. Strikes draw as a stroke between attacker and target for a couple of ticks: misses faint and dashed, hits solid, crits doubled with a ring on the target. Reaction strikes draw dashed-heavy. Damage shows as a `−N` beside the target.

Clicking a glyph or a roster row selects a unit and rings it: **engagement 7.5 ft** (dashed) and, for ranged units, **weapon reach** (dotted). Only the selection — eight rings at once is noise. `ENGAGEMENT_RANGE` is what decides whether a reaction strike is even possible, and reach is what makes a standoff read as a deliberate distance rather than a unit failing to close.

### 4.5 The margin — the world talking back

Red ink is margin-only (brief #8). The field's margin carries one derived line at a time: the fight has gone quiet, targets are thrashing, both lines still closing, or the closing state. Beside the roster sit two gauges:

- **Silence** — ticks since the last `damage_applied`/`healing_applied`, drawn against `ENCOUNTER.stalemateWindowTicks` (300). This is the stalemate answer: one derived number, no bespoke art for an event that has never fired, and in the meantime it is the *kiting* read — silence plus motion is exactly the R3 failure.
- **Target churn** — `unit_engaged` count over the last 50 ticks.

### 4.6 Flat mode and readable type, from the first build

Flat strips vellum, grain, tilt, pins and shadow. It keeps the arena grid, rules and tick marks, the scale bar, every glyph, every name, every HP number *and* bar, targeting lines, both gauges, the marginalia text, and the whole feed. Nothing that is a fact disappears. Readable type swaps both voices and relaxes the italic marginalia, per brief #9.

## 5. Motion — interpolated, and declared (D1)

**Approved: interpolate.** Anchors are the `unit_spawned` position at t=0 plus every `unit_moved` waypoint. Between anchors the field eases; after the last it holds. Implemented as a pure, unit-tested function — `positionAt(track, tick)` — with the track built once per fight.

The drawn path is **never** used to derive any number, distance, or judgement; it is presentation over facts, which is constraint 4 exactly. The sheet carries a filenote saying so, so nobody later mistakes an eased curve for a recording.

Rejected for now: emitting more `unit_moved` and populating `flee`/`reposition`. It is a behaviour change, roughly doubles fight-stream size, and moves every harness snapshot — R1 weight for a benefit that cannot be judged until we have actually watched fights. Revisit after playtesting, on its own brief.

## 6. Carrying the stream to the screen

**Segmentation is one function, both mountings.** `combatSegments(stream)` in `src/sim/core/events/` splits any stream into `{ combatId, roomId, startTick, endTick, events }` by `combat.started`/`combat.ended` pairs. Dungeon fights are already `absorb`ed into the dispatch stream, so they need no new carrier at all — they segment out of what `PlaybackScreen` already holds.

**Surface fights need a carrier.** `QuestRecord` gains `fights?: CombatRecord[]` where `CombatRecord = { combatId, site: 'road' | 'camp'; label: string; stream: EventStream }`. Both sites in `session.ts` currently use `fight.stream` for `killsFrom()` XP and then discard it:

- `~532` road ambush — attach the fight **including on the `ambushKilled` early return**. A road death is the case that most needs watching.
- `~560` camp quest (`quest_type === 'combat'` + `enemy_group`) — attach the fight on every outcome.

`QuestRecord` lives in `lastLaunch` in `GameProvider` and is never written to `SessionSaveState`, so **widening it is not a save-format change**. Confirm that with a test rather than a comment.

`PlaybackScreen`'s `if (!dispatch || !feed)` dead end — "The mission resolved on the surface (no dungeon record)" — goes away.

## 7. The transport (D2)

Measured: median fight 3.2–9.1 s at 1×, P90 14.3 s. The existing 1×/4×/16× ladder was sized for travel-and-explore.

- **Watch** — ¼×, ½×, 1× — the field animates. **½× is the default** for an opened fight.
- **Skim** — 4×, 16× — the field **holds its state and is marked as held**; the record carries the fight. 16× becomes the honest skip control it always was.
- Pause, scrub, and **step-by-beat** (◂ ▸) throughout. The stream is a finished fact, so scrubbing is exact and free.
- Reuse the existing tick→wall-time clock; do not invent a second one. `ReplaySpeed` widens to include `0.25 | 0.5` — additive, and `loadSettings` already falls back to defaults on anything unrecognised, so old persisted `defaultSpeed` values stay valid.

**Mountings.** Dungeon: the room graph stays exactly as it is, the room in play ringed in red ink, a **dispatch strip** beneath it marking each combat segment along the run's ticks (clicking one opens its field), and the field below. Surface: no graph exists, so the field takes its place and the sheet header names the site. The field component itself is identical in both.

## 8. Milestones

- **12.0 The event.** `combat.unit_spawned` + emission + manifest growth + `namesFromStream` with ɪ/ɪɪ/ɪɪɪ disambiguation + fixture extension. *Done when:* the manifest snapshot **grows**; both harness snapshots are **byte-identical**; the beat feed prints `Goblin ɪ` where it printed `disp_1:camp_e0`; the e2e beat-feed spec pins the new exact lines.
- **12.1 The carrier.** `combatSegments()` + `QuestRecord.fights` + both surface sites wired, ambush early-return included. *Done when:* a camp quest and a road death each produce a watchable record, and a test proves `SessionSaveState` is unchanged.
- **12.2 The field.** The component: geometry, glyphs, labels + displacement, rings, `positionAt`, roster rail, both gauges, marginalia, flat mode, readable type. *Done when:* it renders correctly at 4v4 **and 6v6**, the N-guard fires above the arena ceiling, flat mode keeps every datum, and the grammar audit line passes.
- **12.3 Mountings and transport.** Dungeon strip + room ringing, surface mounting, watch/skim ladder, scrub and step. *Done when:* an e2e spec opens a real fight, asserts units are labelled by name, asserts skim holds the field, and asserts flat mode retains the HP numbers.

## 9. Testing and validation

*(The `test-validation-protocol` and `implementation-brief` skills still speak Godot — GDScript line targets, autoloads, scenes. Their discipline is mapped onto TS/React by hand here, as brief #11 did. `gdscript-audit` is slated for retirement per the migration plan. Fixing or retiring all three is still outstanding work.)*

- **Unit.** `positionAt` (anchor ordering, monotonicity, hold-after-last, single-anchor case); `combatSegments` (none, one, several, and a truncated trailing segment); `namesFromStream` (roster union, repeat numbering, unique passthrough, unknown id passthrough); spawn emission determinism (`stream.hash()` equal across two runs); manifest growth; the 6v6 layout case; `SessionSaveState` unchanged by the `QuestRecord` widening.
- **e2e.** Open a surface fight from a camp quest and watch it; assert named units; assert skim holds; assert flat mode retains numbers; the existing beat-feed contract spec re-pinned.
- **Grammar audit** (brief #8's #1 named risk): one meaning per affordance; red ink in the margin only; status colours label-paired and never sole carriers; zero image assets in `src/ui/styles`; flat mode honoured from first build.
- `pnpm check` green before the commit. Commit message names the milestone and **justifies every snapshot diff**.

## 10. Risks

| Risk | Mitigation |
|---|---|
| **R1 — event-vocabulary churn** (plan's #1) | Additive only. Manifest snapshot must *grow*. Fixture extended, not forked. Every moved snapshot explained in the commit. |
| Addition leaks into behaviour | Harness snapshots are the lock: if `encounter-distribution` or `career-distribution` moves, revert — do not re-baseline. |
| Interpolated motion mistaken for recorded truth | Filenote on the sheet; the drawn path feeds no derived number; `positionAt` is isolated and tested. |
| Grammar erosion (brief #8 risk #1) | Audit line in the checklist; side by form not colour; red ink margin-only. |
| Party growth to 6 and larger enemy groups | Layout is N-driven from spawn count; explicit guard + 6v6 test; arena-height ceiling documented against the 1.4 room-shaped-arena work. |
| Feed/field perf on long streams | Fights are ≤143 ticks at P90; the dispatch strip bounds what is mounted at once. Virtualisation stays deferred. |
| Speed union widening breaks stored settings | Purely additive; `loadSettings` already defaults on unrecognised values. |

## 11. Out of scope — logged, not chased (D4)

Three combat-model findings, recorded in the decision ledger rather than fixed here:

1. `combat.unit_fled` is in the frozen vocabulary and has a narration case in `interpret.ts`, but **nothing emits it**.
2. `stalemate_forced.resolution` can only ever be `'byState'`; `'attackersWithdraw'` is unreachable.
3. **Reaction strikes are nearly extinct** — 1 `reaction_triggered` across 40 4v4 fights, because units close and swing in the same tick so almost nothing provokes.

Also out of scope and unchanged in their queue position: audio (Phase 3's unfinished business), Playwright visual baselines, the content pipeline brief (R4), Phase 4 packaging. Art stays parked.
