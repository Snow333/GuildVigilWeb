# Implementation Brief: Loot Generation Grammar
**Date:** 2026-08-10
**Status:** APPROVED 2026-08-10 — ready for implementation (milestone 1.4)
**Phase:** 1, milestone 1.4 (consumed by dungeon population) · Design brief #3 of 4
**Authorities:** `core-loop.md` (D3), `decision-ledger.md` (Areas 5–7), `brief-event-vocabulary.md`

## Summary
Drop-time item generation over the authored data: pick a base from the loot table, roll a quality tier, roll properties within the tier's budget, emit an instance tuple `(baseId, tier, propertyIds[], seed)`. Stats, name, and price derive from registries; `potency/striking` finally enter combat math. This is the reward heartbeat of the dispatch loop.

## Decisions (settled in design interview, 2026-08-10)
1. **Tier odds = source × difficulty table** — trash rolls mostly mundane; bosses and vaults shift the whole distribution up ("tougher hazards guard better loot," extended).
2. **Source guarantees, no hidden pity** *(settled 2026-08-10: soft pity was considered and deferred to Claude's call; reverted)* — deterministic floors: boss kills and vault caches always drop ≥ *magical*. Since every dungeon has exactly one boss (generator invariant), every completed dispatch carries a guaranteed magical+ moment; retreat-before-boss going lean is push-your-luck stakes, not bad luck. Generation stays a pure seeded function — no persisted counters, no backfill, honest forecasts. *Escape hatch:* if playtests show trash dry-streaks corroding the loop, a soft pity counter is a purely additive later change; the harness dry-streak metric (below) is the tripwire.
3. **Shops stay authored-only at launch** — generated items come from loot exclusively; exploration remains the source of exciting gear (found-spell philosophy, extended). Revisit post-launch.
4. **Legendary never rolls** (standing, from D3) — hand-authored, hand-placed, unique-enforced; excluded from the tier table entirely.

## Property Budgets (by tier)
| Tier | Properties | Other |
|---|---|---|
| Mundane | 0 | — |
| Masterwork | 0 | flat quality bonus |
| Magical | 1 | — |
| Enchanted | 2 | + potency |
| Legendary | — | **not generatable** |

Properties are type-tagged (flaming → weapons, fortification → armor); rolls draw only compatible, non-duplicate properties.

## Scope
**In scope:** the roll pipeline · tier/property/pity registries · tuple → stats/name/price derivation · pity counter state + backfill · combat wiring of potency/striking · tests + distribution baselines. Gold drops keep the existing formula (`5–15 × level`), untouched.
**Out of scope:** shop supply of generated items · legendary authoring · loot *table* content (which enemies drop which bases — content work) · name-composition styling (presentation, though the grammar guarantees the tuple carries everything needed).

## Files to Create
- `src/sim/loot/generate.ts` — `rollLoot(tableId, source, difficulty, pity, rng)` → tuples (~80 lines)
- `src/sim/loot/derive.ts` — tuple → `{stats, displayName, price}` pure derivation (~60 lines)
- `src/content/loot-grammar.ts` — tier weights by (source × difficulty), source floors (boss/vault ≥ magical), property budgets + type tags, price multipliers (~80 lines)
- `tests/loot/` — determinism given seed; no-legendary-ever property test; type-tag compatibility; source-floor guarantee test; distribution baselines via harness

## Edge Cases to Handle
- **Property pool exhausted** for an item type at budget → roll fewer, never duplicate on one item; never substitute incompatible.
- **Authored items with embedded quality** (e.g., the 4 authored magic weapons) → converter flags them fixed-tier/non-rollable; the grammar only rolls bases flagged rollable.
- **Source floors** → boss/vault floor applies to the *tier roll*, never the base pick — a floor can't conjure an item the loot table doesn't contain.
- **Floor + weights interaction** → floors clamp the rolled tier upward (mundane→magical), preserving the seeded roll's determinism; no re-roll loops.

## Acceptance Criteria
- [ ] Same `(seed, table, source, difficulty)` → identical tuples, always
- [ ] Property test: 100k rolls, zero legendary, zero incompatible/duplicate properties, zero `is_unique` from random tables
- [ ] Source-floor test: 100k boss/vault rolls, zero results below magical
- [ ] Derivation: no stored stats/prices anywhere — instances are tuples only (save validator enforces)
- [ ] Potency/striking measurably affect attack/damage in combat fixtures
- [ ] Distribution baselines (per source × difficulty × pity level) committed from the harness

## Known Risks / Watch Points
- **Dry-streak watch metric** — the distribution harness reports longest sub-magical streak per campaign percentile; if playtests plus this metric show corrosive streaks on trash content, activate the soft-pity escape hatch (additive change, per decision 2).
- **Economy inflation** — property/tier price multipliers feed sell income; the career harness gold-curve baseline is the guard against enchanted-vendor-trash inflation.
- **Name sprawl** — two-property enchanted names ("Enchanted Keen Flaming Longsword +1") need a presentation composition rule; the tuple ordering (potency, properties by registry order) makes it deterministic.
