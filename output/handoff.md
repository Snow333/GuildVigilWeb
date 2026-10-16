# Handoff

**Last session:** 2026-10-16 — M1 in progress (M0 done, commit `70fb25e`).

## M1 plan (work top to bottom; commit after each chunk)

1. ✅ **XP pacing** (commit `5443881`).
2. ✅ **Muster: 10 base classes + ancestry stats** (commit `fb0906b`).
3. ✅ **Warlock fix + Monk unarmed + dice NaN bug** (commit `fb0906b`).

> **Parallel run in progress (2026-10-16):** Track A (chunks 4, 5 + auto button on the hero tab) is
> DONE in commit `5d30186` on `main` (not pushed). Track B (chunks 6, 7: town/after-action auto-level
> buttons, mission summary, quest names) is a Sonnet subagent in worktree `C:\GuildVigilWeb-trackB`,
> branch `m1-trackB`, brief `output/briefs-m1/trackB.md`. When it reports: review its diff, merge
> `m1-trackB` into `main`, run the full gate, then do chunk 8. Afterwards: `git worktree remove
> C:/GuildVigilWeb-trackB` (delete the node_modules junction first — it points at main's node_modules)
> and `hermes config set delegation.model ""` to put subagents back on the main model.
4. **Level-up teaches spells** (`spellsLearnedAtLevel` exists, nothing calls it) and **new spells/active
   feats auto-join the loadout**. Auto level-up picks spells too.
5. **Picker hides dead feats/spells** and empty ancestry-feat tracks.
6. **Auto level up button** (hero panel, town roster, after-action) via `autoLevelHero`.
7. **Readable mission summary** on After-action; real quest names (DispatchSetup passes `#id`).
8. Playtest note `output/playtest/2026-10-16-M1.md`, decisions log, roadmap status, e2e, commit, push.

Throwaway files to delete before commit: `probeM1/`, `vitest.probeM1.config.ts`, `e2e/zz-survey.spec.ts`.
