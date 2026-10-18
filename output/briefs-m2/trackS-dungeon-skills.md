# Track S — Skills that matter on a mission (Arcana, Religion, Survival, Trickery)

**Read `output/briefs-m2/_shared.md` first.** Sandbox rules, commands, "done means".

- **Worktree:** `C:\GuildVigilWeb-skills`  **Branch:** `m2/dungeon-skills`  **e2e port:** `4183`
- **Milestone:** M2, the roadmap line *"Skills start to matter on missions
  (Arcana, Religion, Survival, Trickery… each with a visible payoff)"*

---

## The problem, in player terms

You build a wizard with good Arcana or a cleric with good Religion, send them into
a dungeon, and nothing ever asks for it. Only **Perception, Thievery and
Athletics** do anything. Picking any other skill is picking nothing.

## The measured fact (confirmed — build on it, do not re-derive)

`src/sim/dungeon/checks.ts` declares:

```ts
export interface DispatchHero {
  c: Combatant;
  skills: { perception: number; thievery: number; athletics: number };
}
```

Three skills. That interface is the entire dungeon skill surface. A grep of
`src/sim/dungeon/` for any other skill name returns **nothing**.

## Your goal

**Four more skills each earn their keep on a mission, with a payoff the player
can see in the mission report.** Keep it thin and real rather than broad and
decorative — four working payoffs beat twelve stubs.

### Suggested shape (you decide the details)

| Skill | A payoff that fits what exists |
|---|---|
| **Arcana** | Identify a magical hazard or a rune-sealed door; a success disarms or bypasses it where Thievery cannot |
| **Religion** | Undead-heavy rooms: a success weakens or wards them (or recovers a dying hero faster) |
| **Survival** | Travel/exploration: a success avoids an ambush, or finds a shortcut that skips a room |
| **Trickery** | Avoid a fight entirely, or open a room with surprise (enemies start flat-footed) |

These are suggestions. If the room/hazard data supports something better, do that
and say so. **Reuse the existing check machinery** (`skillRoll`, `determineDegree`,
the retry/impossibility rules, the `explore.*` event vocabulary) rather than
inventing a parallel system.

### Hard requirements

1. **Widen `DispatchHero.skills` properly.** It is built in
   `src/sim/campaign/assembly.ts` (`assembleHero`). Make sure the new skills are
   populated from the hero's real skill ranks, not defaulted to 0 — a silent 0 is
   indistinguishable from "the feature does nothing", which is this repo's
   recurring defect.
2. **The payoff must be VISIBLE.** The player must be able to tell it happened,
   in the mission report / after-action text. A payoff nobody can see is a payoff
   nobody will build for.
3. **Prove reach with a real dungeon run**, not a unit test on the check helper:
   run `launchDispatch`/the dungeon and assert the event fires and the outcome
   differs. Then run the negative control — set the skill to 0, confirm the
   payoff stops.
4. **Do not make dungeons dramatically easier.** Re-run
   `tests/harness/dungeon-curve.test.ts` and report the completion/wipe drift. If
   completion moves more than ~3 points, dial the DCs until it doesn't, and say
   what you changed. Re-baseline snapshots deliberately, in their own commit,
   with the reason.

### Files you own

- `src/sim/dungeon/**` (`checks.ts`, `dispatch.ts`, `population.ts`, `graph.ts`, `pool.ts`)
- `src/content/dungeon.ts`
- `src/sim/campaign/assembly.ts`  ← only to widen the skills object
- `tests/dungeon/**`, `tests/campaign/dispatch*.ts`
- Mission-report wording for your new events (`src/ui/**` labels/record ONLY if a
  new event needs a line — keep it to the smallest edit and list it in your report)

**Do NOT touch** (another track is in them right now): `src/sim/combat/abilities.ts`,
`src/sim/heroes/featEffects.ts`, `src/sim/heroes/feats.ts`, `data/game_data.db`,
`data/seeds/**`, `src/content/generated/**`. If you think you need a new feat or a
content-table column, **stop and report it** instead.

### Done means

- Four gate commands green (`GV_PORT=4183`).
- A real-dungeon exposure test per skill, each with its negative control run.
- The dungeon-curve drift reported with numbers.
- Committed on `m2/dungeon-skills`. Do not push, do not merge.
- Report: what each skill now does, the event the player sees, the exposure +
  control results, and the curve drift.
