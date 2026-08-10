# Implementation Brief: Event Vocabulary
**Date:** 2026-08-10
**Status:** APPROVED 2026-08-10 — ready for implementation (milestone 1.1)
**Phase:** 1, milestone 1.1 · Design brief #1 of 4
**Authorities:** `core-loop.md`, `decision-ledger.md`, `guild-vigil-migration-plan.md`

## Summary
One typed vocabulary of simulation facts. Every resolver emits events into an append-only stream; every consumer (beat feed, after-action report, deed detection, forecast, GameLog, tests) interprets the stream. The sim states *what happened*, never how it reads. Freezes additive-only at end of milestone 1.1.

## Decisions (settled in design interview, 2026-08-10)
1. **Atomic facts + cause links** — each fact is one event; `cause` points to the triggering event's `seq`. Consumers group by cause-chain.
2. **Regenerate, don't store** — saves persist dispatch *summaries* (seed, inputs, outcome, derived after-action facts); full streams re-derive on demand within a build.
3. **Fixed integer time** — combat/dungeon streams tick in 100ms integers; world stream ticks in game-minutes. No floats in sim time.
4. **Forward tolerance** — a consumer meeting an unknown event type skips and logs, never crashes.

## Scope
**In scope:**
- The event envelope + discriminated-union type set (initial taxonomy below)
- `EventStream` (append, ordered iteration, cause-chain helpers)
- Entity ID conventions (shared with RNG seed namespacing — constraint 5)
- Dispatch summary derivation (the persisted artifact)
- Consumer contract fixtures + determinism tests
- Freeze mechanism (schema version + CI guard against removals/renames)

**Out of scope (explicitly):**
- Beat feed UI and narration text (Phase 2; consumes this)
- Deed *definitions* (content; only the detector interface contract here)
- Audio event mapping (presentation-side lookup from event types)
- After-action report layout

## Files to Create (all under `src/sim/core/`)
- `events/types.ts` — envelope + full event union, by domain (~300 lines, mostly type defs)
- `events/stream.ts` — `EventStream`: append, iterate, `chainOf(seq)`, `byType()` (~80 lines)
- `events/ids.ts` — entity ID builders/conventions (~40 lines)
- `events/summary.ts` — `deriveDispatchSummary(stream)` → persisted summary object (~100 lines)
- `tests/events/` — contract fixtures (canned streams), determinism hash test, freeze-manifest snapshot test

## The Envelope
```ts
interface SimEvent<T extends EventType = EventType> {
  seq: number;        // stream-local, monotonic — the identity consumers reference
  tick: number;       // combat/dungeon: 100ms integer ticks · world: game-minutes
  type: T;            // discriminant
  cause?: number;     // seq of the DIRECT trigger only (no transitive chains)
  data: EventData[T]; // plain JSON payload, no classes/methods
}
// Stream head carries { schemaVersion, streamKind: 'dispatch' | 'world', originId }
```

## Initial Taxonomy (~55 types — the freeze-review list)
**dispatch.** `started · travel_leg_started · travel_arrived · travel_ambushed · dungeon_entered · dungeon_exited · retreated · completed · wiped`
**explore.** `room_entered · area_revealed · entry_check_started · trap_detected · trap_disarm_attempted · trap_triggered · lock_attempted · lock_opened · door_forced · enemy_presence_detected · ambush_resolved · clue_found · shrine_activated · cache_looted · room_cleared`
**combat.** `started · unit_engaged · attack_resolved (full roll breakdown + degree) · spell_cast (resource spent) · aoe_resolved (template + per-target degrees) · damage_applied · healing_applied · condition_applied · condition_save_resolved · condition_expired · reaction_triggered · unit_moved (per waypoint/decision, NEVER per tick) · unit_downed · dying_check_resolved · unit_died · unit_fled · stance_changed · stalemate_forced · ended`
**hero.** `xp_awarded · level_up_applied · deed_earned · died · wounded_changed`
**loot.** `rolled · item_generated (instance tuple) · collected · left_behind`
**world.** `week_tick · quest_posted · quest_accepted · quest_expired · quest_completed · quest_failed · escalation_changed · poi_state_changed · poi_income_paid · building_upgrade_started · building_upgrade_completed · shop_restocked · rotation_changed · hero_recruited · respec_purchased`

Notes: no `clock_advanced` (chatty; time lives on the envelope) · no `gold_changed` (balances derive from causal events — each fact once) · motion interpolation is presentation's job, hence the `unit_moved` waypoint rule.

## ID Conventions (shared with RNG namespacing)
`hero_{n}` · `party_{n}` · `disp_{n}` · enemy instances `{dispId}:e{n}` · rooms `{templateId}:r{n}` · registry IDs (quests, items, feats, spells) verbatim · item instances as tuples `(baseId, tier, propertyIds[], seed)`. Seeds are built from these IDs (e.g. `loot_{dispId}_{roomId}`), so event references and RNG namespaces never diverge.

## Consumers & Contracts
| Consumer | Reads | Contract test |
|---|---|---|
| Beat feed (P2) | live stream, groups by cause-chain | parses fixture stream, renders N beats |
| After-action | full stream at dispatch end | summary derivation is deterministic |
| Deed detector | full stream at dispatch end → pure fn → `deed_earned` facts | same stream → same deeds, always |
| Forecast | outcome tallies across ~150 headless runs | aggregation matches hand-count on fixtures |
| GameLog | filtered world+dispatch view | filter correctness on fixtures |
| Tests | everything | the fixtures ARE the contract |

## Edge Cases to Handle
- **Unknown type at consumer** → skip + log (forward tolerance).
- **Dangling `cause`** (regeneration mismatch) → treat event as chain root, log; never throw.
- **Same-tick ordering** → `seq` disambiguates; resolvers are synchronous single-writers, so emission order is deterministic by construction.
- **Minimum stream** → every dispatch stream contains at least `started` + one terminal (`completed`/`retreated`/`wiped`); consumers may rely on it.
- **Version skew** → summaries persist with `schemaVersion`; streams only regenerate within the same build. Old dispatches stay *describable* (summary) even when no longer *replayable*.
- **Forecast memory** → forecast streams are discarded after aggregation; only tallies survive.

## Acceptance Criteria
- [ ] Compiles under `strict`; boundary lint clean (no React/DOM/platform imports)
- [ ] Committed fixture dispatch stream; all consumer contract tests parse it
- [ ] Determinism: same seed → identical stream hash across 1,000 replays (CI)
- [ ] `deriveDispatchSummary` deterministic on fixtures
- [ ] Freeze guard: type-manifest snapshot test fails on any removal/rename (additions pass)
- [ ] Taxonomy review (this document's list) signed off before freeze

## Known Risks / Watch Points
- **Gaps found in 1.3/1.4** — additive types are fine; renames are forbidden post-freeze, so the taxonomy list above is the one naming review that matters. Read it slowly once.
- **Chattiness** — the `unit_moved` waypoint rule is the guard; if any stream exceeds ~10k events/dispatch, something is emitting per-tick.
- **Cause misuse** — `cause` = direct trigger only; transitive chains reconstruct by walking, never by pointing far.
