# Implementation Brief: World Pressure / Escalation
**Date:** 2026-08-10
**Status:** APPROVED 2026-08-10 — ready for implementation (milestone 1.5; interfaces earlier)
**Phase:** 1, milestone 1.5 (interfaces defined earlier; consumed by scheduler brief #4) · Design brief #2 of 4
**Authorities:** `core-loop.md` (D1 failure model, constraint 7 flag), `decision-ledger.md` (Area 4), `brief-event-vocabulary.md`

## Summary
The world's memory of neglect: per-region pressure derived from an append-only ledger of player-caused facts. Rising pressure makes ignored regions concretely more dangerous and paces the authored villain arcs. It is the campaign's failure model — punishing, visible, recoverable, never game-over.

## Decisions (settled in design interview, 2026-08-10)
1. **Relief by player action only** — regional quest completions, camp clears, liberation pushes. Time never heals; neglect stands until addressed. Villain-arc milestones can permanently raise a region's floor.
2. **Regions are fallable and recoverable; Haven protected** — top tier (Overrun) flips POIs to enemy-held and swaps the region's quests for a liberation chain; winning it back is authored content. Haven's home region caps below Overrun — no unwinnable spiral.
3. **Thresholds fire authored villain beats** — each region binds to a villain/faction from the arc graph; crossing a tier fires that villain's next authored beat. No generic random-event pool. Escalation is the story's pacing engine.
4. **Tiers visible, score hidden** — *Quiet / Restless / Threatened / Overrun* on the map (tint + iconography); the number stays internal.

## Scope
**In scope:** ledger (persisted shape + append API) · pure score/tier derivation · tier-effect lookups for consumers · weights/thresholds/effects as registries · Haven cap · villain-beat trigger interface (consumed by arc/scheduler systems) · fixtures + property tests.
**Out of scope:** the villain beats themselves (arc content) · liberation quest content · scheduler internals (brief #4) · map presentation of tiers (Phase 2).

## Files to Create
- `src/sim/world/escalation/ledger.ts` — append-only ledger, persistence shape, save/load (~60 lines)
- `src/sim/world/escalation/score.ts` — pure fn: `(ledger, registries) → per-region {score, tier, floor}` with hysteresis (~50 lines)
- `src/sim/world/escalation/effects.ts` — tier → modifiers (ambush mult, quest mix, POI income, level-band drift) (~40 lines)
- `src/content/escalation.ts` — fact weights, tier thresholds, per-tier effect table, region→villain bindings (~60 lines)
- `tests/escalation/` — ledger→tier fixtures; determinism; Haven-cap; one-beat-per-crossing ordering

## Data Shapes
```ts
// A ledger entry is a FACT — weights live in the registry, not the entry (derive, don't store)
interface EscalationFact {
  week: number; regionId: string;
  kind: 'quest_failed' | 'quest_expired' | 'dispatch_wiped' | 'camp_cleared'
      | 'quest_completed' | 'poi_recaptured' | 'liberation_completed'
      | 'villain_beat_fired' | 'floor_raised';
  refId: string;   // quest/dispatch/poi/beat id
}
// score(region) = clamp(Σ weight(kind) over region facts, floor(region), max)
// tier from thresholds with a hysteresis margin on the way down (no flapping)
```

## Tier Effects (initial values — registry-tunable, harness-validated)
| Tier | Ambush mult | Quest mix drift | POI income | Other |
|---|---|---|---|---|
| Quiet | 0.5× | baseline | 100% | — |
| Restless | 1× | +combat share | 100% | map tint shift |
| Threatened | 2× | +combat, level band +1 | 50% | travel warnings |
| Overrun | 3× | liberation chain replaces board | 0% (POIs enemy-held) | villain holds region |

Haven's home region: hard cap at Threatened. Liberation success drops a region to Threatened's lower bound (earned recovery, no oscillation exploit) — tunable.

## Events
Consumes world-stream facts (`quest_failed/expired/completed`, `dispatch_wiped`, `poi_state_changed`). Emits `escalation_changed (regionId, oldTier, newTier, cause)` — already in the frozen vocabulary — plus one **additive** new type: `villain_beat_fired (regionId, villainId, beatId)` (additions are legal post-freeze; noted here as the first).

## Edge Cases to Handle
- **Multiple tier crossings in one week tick** → fire beats in order, exactly one per crossing, deterministic by event seq.
- **Region with no bound villain** (filler regions) → tier effects apply; no beats fire. Legal state, not an error.
- **Facts for undiscovered regions** → accumulate silently; revealed when the region is.
- **Relief + harm in the same week** → ledger order (event seq) decides; derivation stays pure.
- **Score below floor** → clamp; floors only ever rise (`floor_raised` facts).
- **Ledger growth** → O(player actions), no per-tick entries; property test asserts no fact kind can be emitted by a clock tick alone.

## Acceptance Criteria
- [ ] Same ledger + registries → identical tiers, always (determinism fixture)
- [ ] Haven cap holds under adversarial fixture (mass failures in home region)
- [ ] One beat per tier crossing, ordered, under multi-crossing fixture
- [ ] Zero balance constants in code — weights/thresholds/effects all registry
- [ ] Career harness (1.5) reports pressure trajectories; baseline distributions committed
- [ ] Boundary lint + strict compile clean

## Known Risks / Watch Points
- **Pacing is the whole game here** — weights that escalate too fast make a 4-team roster mandatory early; too slow and neglect is free. The career-harness pressure trajectories are the tuning instrument; treat the initial table as placeholder until harness baselines exist.
- **Recovery must stay winnable** — liberation content scales to party level, never to pressure, or Overrun becomes a ratchet in disguise.
- **Interface coupling** — the scheduler (brief #4) consumes tier effects; the arc graph consumes beat triggers. Both interfaces are defined *here* and must not drift when those briefs land.
