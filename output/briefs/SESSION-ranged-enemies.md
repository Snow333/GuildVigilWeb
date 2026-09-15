# SESSION SETUP — Brief #28: ranged enemies

**Status:** READY TO START — this file IS the session prompt.
**Created:** 2026-09-13, from brief #27 Q3 (Steven approved unblocking).
**Run in:** a NEW session, in parallel with the taxonomy work. See §5.

---

## 1. Start here — paste this as the opening prompt

> Read `output/briefs/SESSION-ranged-enemies.md` and follow it. This is a BALANCE brief, not a
> wiring task — write the brief and get approval before changing `build.ts`.

---

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

⚠ **Brief #27's Archer role is blocked by this**, and so is one of the four enemy classifications
(Ranged). Authoring "Bandit Archer" today produces a melee creature wearing a bow — the
content-with-no-consumer defect this repo has now hit eight times.

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

## 5. Collision rules

⚠ **This session edits `src/sim/combat/build.ts`.** The enemy-specification session may also want
that file (`SESSION-enemy-specification.md` §3.1).

- **Sequence them, or assign `build.ts` to exactly one.** Two agents in one file is how this repo
  got probe artifacts committed twice.
- **Never `git add -A`.** Stage by explicit path.
- This session is otherwise independent of the taxonomy and class-ability work and can run in
  parallel with either.

---

## 6. Deliverable

Brief **#28**, following the repo's brief conventions: the finding, the player-facing statement of
what is wrong, the options as numbered tradeoffs with measured costs, a balance expectation stated
BEFORE measuring, anti-goals, and questions for Steven.

⚠ **No code until Steven approves the brief.** Process law: brief → approval → code.
