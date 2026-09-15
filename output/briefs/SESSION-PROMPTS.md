# Session start prompts — copy and paste

Three sessions, in this order. Each block below is the **entire** opening message — paste it into a
new session and nothing else is needed.

**Order: #29 → #30 → #28.** #29 and #30 may run at the same time (they own different directories).
#28 runs last.

---

## 1️⃣ SESSION #29 — Class abilities and specialization paths

*Run this first. May run in parallel with #30.*

```
Read output/briefs/SESSION-class-abilities.md in C:\GuildVigilWeb and follow it.

Start with the Phase 1 feat audit and do not design anything until its numbers are
on the table. The audit is the point: 144 of 227 feats reach nothing and 5 of 13
classes have no feats at all, so any specialization design written before the audit
would be designing against a system that cannot express it.

Read §0 before anything else — do not benchmark against superseded goals or
re-open settled decisions. Build, don't theorycraft.

You own src/sim/heroes/** for this session. A parallel session may own
src/sim/combat/**. Never `git add -A`; stage by explicit path.
```

---

## 2️⃣ SESSION #30 — Enemy specification: races, classes, classifications

*May run at the same time as #29.*

```
Read output/briefs/SESSION-enemy-specification.md in C:\GuildVigilWeb and follow it.

Verify the §3.1 claim first — that pickAction already works for a non-hero Combatant
with a populated loadout. The whole races-times-classes proposal rests on it being
wiring rather than a new system, so if it is false, stop and report that before
designing anything.

Read §0 before anything else. The 40–50% fodder target in §5 is SETTLED — author to
it and move on. Do not re-derive it or compare it to the old ≥60% ratio or the
300–500 row-count target; those are dead goals.

You own src/sim/combat/** (including build.ts), src/content/generated/enemies.ts and
data/seeds/**. A parallel session may own src/sim/heroes/**. Never `git add -A`;
stage by explicit path.
```

---

## 3️⃣ SESSION #28 — Ranged enemies

*Run this LAST, after #29 and #30 are done.*

```
Read output/briefs/SESSION-ranged-enemies.md in C:\GuildVigilWeb and follow it.

This is a BALANCE brief, not a wiring task. The three hardcoded lines in build.ts are
cheap to change; the consequences are not, because ranged enemies change every closure
time in the game and every measured completion rate was taken without them. Write the
brief and get approval before touching any code.

Read §0 before anything else. Also read brief #30's delivered output first — it may
have restructured how an enemy statblock reaches Combatant, which changes where
weaponRange should come from.

Never `git add -A`; stage by explicit path.
```

---

## What each session delivers

| # | Session | Deliverable | First action |
|---|---|---|---|
| **#29** | Class abilities | A brief proposing 3–5 specialization paths per class, annotated with what the engine needs to express each | **Audit the 144 inert feats** |
| **#30** | Enemy specification | A brief specifying races × classes, which rows stay hand-crafted, and the composition gate | **Verify `pickAction` works for non-heroes** |
| **#28** | Ranged enemies | A balance brief for unblocking ranged (and, with it, real enemy magic) | **Write the brief — no code** |

---

## Standing rules every session inherits

These live in `CLAUDE.md` and the `guild-vigil` skill; they are repeated here so a session that
skips a file still gets them.

- **Process law: brief → Steven's approval → code.** Never code a new system first.
- **Never `git add -A` or `git add .`** — stage by explicit path. Two sessions have committed probe
  artifacts by ignoring this.
- **Always run a negative control**, and make the sabotage real: confirm the *expected* tests fail,
  restore, confirm `git diff` on `src/` is empty.
- **A test that checks a gate by calling that gate is a tautology.** Assert against the real
  consumer, never through the predicate under test.
- **Green tests are not proof the game runs** — sessions verify on Linux, Steven plays on Windows.
- **Steven is dyslexic:** end any answer longer than ~2 paragraphs with a summary block at the very
  end — one short paragraph plus at most 5 bullets. Tables over prose. Player-facing terms before
  code terms.
- **Ask design questions as numbered options with measured tradeoffs**, never as a finished opinion.
