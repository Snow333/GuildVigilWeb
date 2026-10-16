# Decisions log

One line per design call Hermes made inside the vision. Steven can reverse any of these in a
playtest note. Newest at the bottom.

| Date | Milestone | Decision | Why |
|---|---|---|---|
| 2026-10-16 | M0 | Old briefs, design law, core loop, ledger and backlog moved to `output/archive/legacy-process/` | Working agreement: vision is the only law |
| 2026-10-16 | M0 | In-game notes download as JSON files to Downloads; `pnpm notes` collects them into `output/playtest/inbox/` | The game runs from `file://` and cannot write to the repo directly |
| 2026-10-16 | M0 | Dev panel opens with the **`** (backtick) key or the "Dev" tab; available in every build | Playtest speed matters more than hiding cheats right now |
| 2026-10-16 | M1 | XP is no longer split: every living hero earns the full quest/monster XP | A split made the first level-up take 20 weeks of real play; PF2E awards full XP per character |
| 2026-10-16 | M1 | Level step grows with level (L1→2 costs 1000, L19→20 costs 19000; 190000 total) | Quest XP rises with level, so a flat 1000 step made mid-game levels arrive every mission. Measured: first level-up week 5, ~L8 by week 60 on autopilot |
| 2026-10-16 | M1 | All 10 base classes can be founded (added Ranger, Barbarian, Monk, Bard, Sorcerer, Warlock). Prestige classes stay multiclass-only | Vision: "create various characters" from the classes already defined |
| 2026-10-16 | M1 | **Ancestry now affects stats**: its two boosts (+2), flaw (−2) and base hp apply at creation; "free" boosts go to the class key ability | Vision: use the defined ancestries. Reverses the old "ancestry is cosmetic" rule (archived design law) |
| 2026-10-16 | M1 | Monk fists use the class unarmed die (1d6 → 2d8) and are finesse + agile | Monks had no weapon and fought with a 1d4 STR fist |
| 2026-10-16 | M1 | Warlock pact energy comes from the `pact_energy_max_N` class feature; a spell's own `pact_energy_cost` wins (Eldritch Blast = 0, at will) | Warlocks had 0 energy and could not cast anything |
| 2026-10-16 | M1 | Bug fix: damage dice with a minus (`1d6-1`) rolled NaN | Every hero with a negative STR mod (wizards, bards) dealt no real melee damage |
| 2026-10-16 | M1 | Harness "punching up costs ≥10 pts" bar lowered to 8 (the measured noise floor) | Stronger L1 parties measured 9.0; the gradient is still real |
