# SESSION SETUP — Enemy specification: races, classes, and the four classifications

**Status:** READY TO START — this file IS the session prompt.
**Created:** 2026-09-13, from brief #27 Q4 and Q5.
**Run in:** a NEW session. See §6 for collision rules.

---

## 1. Start here — paste this as the opening prompt

> Read `output/briefs/SESSION-enemy-specification.md` and follow it. Start with Phase 1; the
> `isCaster: false` finding in §3 is the thing to verify first.

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

## 2. What Steven asked for

**On structure (Q4):**

> *"I think we should setup races for enemies and then apply classes to them? Like is there really a
> lot of value establishing enemies as large data static blocks of statistics. We probably want to
> hand craft custom blocks for bosses and elites but I think we want to make races/ancestries as
> DLC."*

**On composition (Q5)** — four classifications replacing the single-ratio gate:

| Class | Share | What it does |
|---|---|---|
| **Fodder** | **40–50%** | Nothing mechanical. Differentiated by **name and art** — a kobold that reads differently from a goblin is a legitimate row. |
| **Melee** | — | charge, power attack, shield wall, large HP pools |
| **Ranged** | — | rapid fire, aimed shot |
| **Magic** | — | buff allies, debuff enemies, ranged damage spells |

---

## 3. ⚠ Three findings that shape this before you design anything

### 3.1 The machinery already exists. Enemies are opted out by three hardcoded lines.

`src/sim/combat/build.ts` sets, for **every** enemy:

```ts
weaponRange: 1,
engageRange: 1,   // "enemy statblocks are melee until the registry grows ranged rows"
isCaster: false,
casting: null,
loadout: [],
```

⚠ **`pickAction` in `src/sim/combat/loadout.ts` is unit-agnostic** — it walks `u.loadout` for heroes
and enemies alike, and already handles `ability` entries with cooldowns and once-per-combat
limiters. **Enemy classes are largely a WIRING problem, not a new system.** Verify this claim first;
it is the load-bearing assumption of the whole session.

### 3.2 The legacy repo planned exactly this and never built it

`C:\GuildVigil\.claude\memory\arch_enemy_classes.md` describes the refactor needed "when enemies get
class-based abilities": `CombatManager.class_resource` is keyed by `source_id`, which collides
because hero 5 and enemy 5 are different creatures. It prescribes switching to `unit_id`.

⚠ **Check whether the web rewrite inherited that collision or designed it out.** The TS `Combatant`
has both `id` (instance) and `baseId` (content row), which suggests it was designed out — but verify
rather than assume.

⚠ `C:\GuildVigil` is **FROZEN. Read only, never write.**

### 3.3 The DLC model already exists — and it is storyline-shaped, not ancestry-shaped

Game bible §10 (`C:\GuildVigil\game_bible.md`) defines DLC as **separate SQLite files attached at
runtime**, each containing quest chains, POI placements, story heroes, enemies, items, dialogue and
region unlocks.

⚠ **Ancestries-as-DLC would be a SECOND model alongside that one.** That may well be right, but it
is a deliberate architectural decision and must be recorded as one — not arrived at by default.

---

## 4. Phase 1 — verify, then measure

1. **Confirm §3.1.** Does `pickAction` genuinely work for a non-hero `Combatant` with a populated
   `loadout`? Build one in a throwaway probe and run a real `runEncounter`. ⚠ If this is false, the
   whole races+classes proposal costs an order of magnitude more, and the session should stop and
   report that.
2. **Measure today's composition** against Steven's four classifications. Current state, measured
   2026-09-13: **Fodder 80.0% · Melee 11.1% · Magic 8.9% · Ranged 0%.**
3. **Report the current split as a fact, in one line, then move on.** It is context for authoring,
   not a debate to open. ⚠ See §5 — the target is settled.

---

## 5. The composition target — SETTLED, do not relitigate

**Fodder 40–50% of the pool. The rest split across Melee / Ranged / Magic.** That is the number.
Steven set it on 2026-09-13 and closed the discussion:

> *"Lets not over think this. We can make it whatever we want. Lets just use the 40%/50% and offset
> with the specialist roles and get to work rather than keep theory crafting against old goals."*

⚠ **DO NOT re-derive, re-justify, or benchmark this against the old ≥60% ratio, the current 80%
fodder share, or the migration plan's row-count targets.** Those are superseded. Comparing new work
to a dead goal is how the last two sessions burned time. **Author to 40–50% and move on.**

⚠ **Ranged and Magic are blocked until brief #28 (see §5.1).** Until then, author the non-fodder
share as **Melee**, and leave room in the plan for Ranged/Magic rows to land later. Do not stall on
this — a pool that is 45% fodder and 55% melee today is fine and correct.

### 5.1 Sequencing — settled

**#29 (class abilities) and #30 (this session) come FIRST. #28 (ranged) comes after both.**
Steven, 2026-09-13: *"Lets just tackle ranged and magic after we finish the abilities and
monster/enemy scoping work."*

✅ **This removes the `build.ts` collision.** #28 no longer runs in parallel — **this session owns
`src/sim/combat/build.ts`.**


## 6. Collision rules

⚠ **Two agents must never share a working directory.** The class-abilities session (#29) may run
concurrently with this one:

- **This session owns** `src/sim/combat/**` (including `build.ts`), `src/content/generated/enemies.ts`,
  `data/seeds/**`, `tools/check-enemy-taxonomy.mjs`.
- **#29 owns** `src/sim/heroes/**` and `output/briefs/class-*.md`.
- **Never `git add -A`.** Stage by explicit path — probe artifacts have been committed twice by
  exactly that mistake.
- ✅ **#28 (ranged) is sequenced AFTER this session**, so `build.ts` is uncontested. See §5.1.


## 7. Deliverable

A brief (**#30**) specifying:

1. The enemy race/ancestry model and how classes attach to it.
2. Which rows stay hand-crafted (bosses, elites) and which are generated from race × class.
3. The four-classification composition gate, and how `tools/check-enemy-taxonomy.mjs` (brief #27 M1)
   enforces it.
4. A recorded decision on ancestries-as-DLC versus the existing storyline-shaped DLC model.
5. The sequencing answer for §5's blocked classifications.
