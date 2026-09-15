# SESSION SETUP — Brief #28: ranged enemies

**Status:** READY TO START — this file IS the session prompt.
**Created:** 2026-09-13, from brief #27 Q3 (Steven approved unblocking).
**Run in:** a NEW session. ⚠ **THIRD IN SEQUENCE** — start only after #29 (class abilities)
and #30 (enemy specification) are done. See §5.

---

## 1. Start here — paste this as the opening prompt

> Read `output/briefs/SESSION-ranged-enemies.md` and follow it. This is a BALANCE brief, not a
> wiring task — write the brief and get approval before changing `build.ts`.

---

---

## 0. ⚠ WORKING RULE — build, don't theorycraft

Steven, 2026-09-13: *"Lets not over think this… get to work rather than keep theory crafting against
old goals."*

**The targets and structure in this file are SETTLED. Do not re-derive them.** Specifically:

- ⛔ **Do not benchmark new work against superseded goals** — the 300–500 row count, the ≥60%
  distinguishing ratio, the migration plan's targets. They are dead. Citing them to justify or
  question current work is the exact time-sink this rule exists to stop.
- ⛔ **Do not re-open a decision Steven has already made** unless *measurement contradicts it* — in
  which case say so in one line, with the number, and proceed.
- ✅ **Measure to decide what to build. Not to re-litigate what to build.**
- ✅ **When a question is genuinely open, ask it as numbered options and keep working** on the parts
  that do not depend on the answer.

**The deliverable is a brief Steven can approve, not an analysis of the problem space.**

## 2. The finding

`src/sim/combat/build.ts` lines 50–52:

```ts
weaponRange: 1,
engageRange: 1, // enemy statblocks are melee until the registry grows ranged rows
weaponAgile: false,
```

**Every enemy in Guild Vigil is melee.** There is no ranged enemy and there cannot be one.

**In player terms:** nothing in the game can hurt your party before your party reaches it. Every
fight is "walk up and trade blows" — there is no enemy archer to close distance on, no reason to
prioritise a back line, no cost to a slow approach.

⚠ **Brief #27's Archer role is blocked by this**, and so are two of the four enemy classifications:
**Ranged** entirely, and **Magic** in practice (with `isCaster: false` hardcoded, enemy "magic"
reaches the engine only as on-hit riders — melee-range magic). Authoring "Bandit Archer" today
produces a melee creature wearing a bow — the content-with-no-consumer defect this repo has hit
eight times.

**This session unblocks both.**

---

## 3. ⚠ Why this is a balance brief, not a wiring task

Brief #26 listed ranged enemies as an explicit **anti-goal**, and that reasoning still holds:

**Ranged enemies change every closure time in the game.** Today, a hero's approach is free — nothing
punishes it. Give enemies range and:

- Every existing measured completion rate at d1–d5 is taken against a different game.
- `engageRange` interacts with the party AI's `engageRange` split (brief #15) and with the backstab
  (brief #19).
- The dungeon curve will move, and the move will be **real**, not noise — this is exactly the
  situation the ±8 bar exists to distinguish.

⚠ **Do not treat "it's only three hardcoded lines" as evidence it is cheap.** The lines are cheap;
the consequences are not.

---

## 4. What the brief must answer

1. **Where does an enemy's range come from?** A new `enemies.weapon_range` column, derived from
   `weapon_traits` (15 rows already author `agile` / `reach` / `finesse` and `build.ts` hardcodes
   them off), or from the four-classification tag in brief #27?
2. **What does a ranged enemy do when a hero closes?** Kite, or stand and shoot? Kiting needs AI the
   game does not have.
3. **Does `reach` (melee, range 2) ship with this, or separately?** 15 rows already author it.
4. **The measured cost.** Take the d1–d5 curve before and after with the SAME seeds, and state the
   expectation in the brief before measuring — per `output/reference/measurement.md`.
5. **Which existing rows become ranged?** ⚠ Changing an existing enemy's behaviour is a balance
   change to content the player has already met. Prefer NEW rows over re-classifying old ones.

---

## 5. Sequencing — this session runs THIRD

Steven, 2026-09-13: *"Lets just tackle ranged and magic after we finish the abilities and
monster/enemy scoping work. That's a fine order of approach."*

**Order: #29 (class abilities) → #30 (enemy specification) → #28 (this).**

✅ **Because this runs last, there is no `build.ts` collision** — #30 will have finished with it.
Read #30's delivered brief before starting: it may have already restructured how an enemy's
statblock reaches `Combatant`, which changes where `weaponRange` should come from.

⚠ **Never `git add -A`.** Stage by explicit path.


## 6. Deliverable

Brief **#28**, following the repo's brief conventions: the finding, the player-facing statement of
what is wrong, the options as numbered tradeoffs with measured costs, a balance expectation stated
BEFORE measuring, anti-goals, and questions for Steven.

⚠ **No code until Steven approves the brief.** Process law: brief → approval → code.
