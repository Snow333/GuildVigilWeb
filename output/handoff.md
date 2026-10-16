# Handoff

**Last session:** 2026-10-16 — M1 in progress (M0 done, commit `70fb25e`).

## M1 plan (work top to bottom; commit after each chunk)

1. **XP pacing** — awards no longer split (every living hero gets full quest/monster XP); level step grows
   with level (`src/sim/heroes/xp.ts`). Update `tests/heroes/xp.test.ts`.
2. **Muster: 10 base classes + ancestry stats** — templates for Ranger, Barbarian (Rage toggle), Monk
   (unarmed), Bard, Sorcerer, Warlock in `src/sim/campaign/muster.ts`. Ancestry rows' hp/boosts/flaws
   apply at creation. Prestige classes stay multiclass-only.
3. **Warlock fix** — pact energy from `pact_energy_max_N` class features; spell cost uses
   `spells.pact_energy_cost` when set (Eldritch Blast = 0 = at-will). Today a warlock can cast nothing.
4. **Level-up teaches spells** (`spellsLearnedAtLevel` exists, nothing calls it) and **new spells/active
   feats auto-join the loadout**. Auto level-up picks spells too.
5. **Picker hides dead feats/spells** and empty ancestry-feat tracks.
6. **Auto level up button** (hero panel, town roster, after-action) via `autoLevelHero`.
7. **Readable mission summary** on After-action; real quest names (DispatchSetup passes `#id`).
8. Playtest note `output/playtest/2026-10-16-M1.md`, decisions log, roadmap status, e2e, commit, push.

Throwaway files to delete before commit: `probeM1/`, `vitest.probeM1.config.ts`, `e2e/zz-survey.spec.ts`.
