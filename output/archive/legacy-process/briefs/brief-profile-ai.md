# Implementation Brief: Mission-Profile Party AI
**Date:** 2026-08-10
**Status:** DRAFT — pending Steven's approval
**Phase:** 1, milestone 1.4 · Design brief #4 of 4
**Authorities:** `core-loop.md` (D2), `decision-ledger.md` (Areas 3, 5), `brief-event-vocabulary.md`, `brief-loot-grammar.md`

## Summary
The party's brain between fights: given the dungeon graph, a mission profile, and party state, decide where to go next, who attempts each check, and when to stop — every decision emitted as events. Four profiles (Full Explore / Boss Rush / Mystery Hunt / Loot & Resources) are objective functions over one decision engine. Combat belongs to the universal combat AI; this system owns everything the old entry-check modals and player clicks used to.

## Decisions (settled in design interview, 2026-08-10)
1. **Profile × caution dial** — two orthogonal dispatch knobs: the mission profile and a caution setting (*Cautious / Standard / Bold*) mapping to withdrawal thresholds (party HP%, slots spent, heroes downed). A cautious Boss Rush and a bold Loot run are both expressible.
2. **Limited in-dungeon rest** — shrine rooms (activated) and cleared boss rooms each hold **one rest charge**; resting restores per a registry-defined short-rest package. Shrines finally earn their room type. Charges tracked in dungeon deltas; no rest anywhere else.
3. **Completion predicates (defaults confirmed via goal):** Full Explore = all reachable nodes visited (or doctrine bailout) · Boss Rush = boss dead → leave by cheapest safe route · Mystery Hunt = clue secured → leave · Loot & Resources = haul capacity reached.

## Scope
**In scope:** the decision loop (frontier scoring, traverse, reassess) · four profile objective/scoring functions · doctrine thresholds + the rest decision · check assignment with retry rotation · termination guards · profile/caution/rest registries · tests.
**Out of scope:** combat resolution (1.3) · dungeon population (1.4 sibling) · the dispatch *UI* (Phase 2) · enemy AI.

## Files to Create
- `src/sim/dungeon/profileAI/engine.ts` — decision loop: pick target → traverse (entry-check sequence) → resolve → reassess (~80 lines)
- `src/sim/dungeon/profileAI/objectives.ts` — four scoring functions + completion predicates (~60 lines)
- `src/sim/dungeon/profileAI/doctrine.ts` — caution thresholds, press/detour/rest/withdraw decision, hard floor (~40 lines)
- `src/sim/dungeon/profileAI/checks.ts` — check assignment (best modifier first), DC+2 retry rotation, impossibility detection (~40 lines)
- `src/content/profiles.ts` — profile params, caution threshold table, rest package, decision budget (~40 lines)
- `tests/profileAI/` — termination, predictability fixtures, doctrine fixtures, rest-charge behavior

## Core Rules
- **Decision budget** — a hard cap on total decisions per dispatch (the teardown's `e++<100` bound, generalized). Hitting it forces withdrawal with a logged reason; the property suite treats any budget hit as a failure to explain.
- **Hard floor** — one-hero-standing (or all-wounded-critical) forces withdrawal regardless of doctrine. Bold lowers thresholds; nothing disables the floor.
- **Impossibility detection** — a lock/obstacle whose DC exceeds the party's maximum possible roll is a *blocked edge*: reroute; if the objective is unreachable, withdraw with `objective_failed`. No infinite grinding.
- **Rest decision** — if withdrawal thresholds are near AND a rest charge is reachable AND the objective is incomplete, spend the charge instead of retreating. One charge per location, ever.
- **Predictability over optimality** — scoring stays simple enough that the player can narrate the route ("of course the Boss Rush skipped that vault"). The AI is a competent squad, not a solver.

## Events
Uses the frozen vocabulary (`room_entered`, entry-check series, `dispatch_retreated` with reason). Two additive types: `explore.rested (locationId, package)` and `explore.route_blocked (edgeId, reason)`.

## Edge Cases to Handle
- **Mystery Hunt, no clue present** (defensive; the scheduler should prevent it) → degrade to Full Explore until absence is proven, then withdraw `objective_failed`.
- **Boss behind an impossible lock** → blocked-edge reroute; no route → withdraw with reason (the beat feed can say *why*).
- **Capacity mid-run for non-Loot profiles** → AI keeps collecting tuples; the player trims at the capacity-capped loot screen (Area 5). Loot & Resources treats capacity as its completion predicate instead.
- **Check candidate exclusions** → downed/unconscious heroes never assigned; wounded heroes deprioritized for trap disarms (they trigger the KO cascade fastest).
- **Doctrine change between rooms** (the one permitted intervention) → takes effect at the next decision point; never mid-traverse.
- **Retry rotation** — after a hero fails at DC+2·retries, rotate to next-best if their ceiling still beats the DC; else blocked-edge logic.

## Acceptance Criteria
- [ ] Termination: 10k runs (4 profiles × full template pool × seeds), zero non-termination, decision-budget hits < 0.1% and all explained
- [ ] Predictability fixtures: Boss Rush ignores off-path vaults unless blocked; Cautious withdraws where Bold presses (same seed)
- [ ] Hard floor unoverridable under adversarial doctrine fixture
- [ ] Rest: exactly one charge per location; restore package from registry; charge state survives save/resume
- [ ] Full dispatch (travel + dungeon + combats) within the ≤50ms headless budget
- [ ] Every decision visible in the event stream; beat-feed contract fixture parses a full run

## Known Risks / Watch Points
- **Profile scoring is the new balance surface** — per-profile outcome baselines (completion %, deaths, haul value) come from the distribution harness; tune scoring against those, not anecdotes.
- **Rest-fishing** — one charge per earned location bounds it structurally; watch the harness for shrine-detour rates distorting Boss Rush times.
- **Predictability erosion** — every scoring term added makes routes harder to narrate; new terms require a fixture demonstrating the player-visible rule they implement.
