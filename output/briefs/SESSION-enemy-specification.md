# SESSION SETUP — Enemy specification: races, classes, and the four classifications

**Status:** READY TO START — this file IS the session prompt.
**Created:** 2026-09-13, from brief #27 Q4 and Q5.
**Run in:** a NEW session. See §6 for collision rules.

---

## 1. Start here — paste this as the opening prompt

> Read `output/briefs/SESSION-enemy-specification.md` and follow it. Start with Phase 1; the
> `isCaster: false` finding in §3 is the thing to verify first.

---

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
3. ⚠ **Tell Steven the number in §5** — his instruction was "keep this low", and the target he gave
   is not low.

---

## 5. ⚠ The number this session must surface early

Steven said *"lets keep this low"*, and the four-classification target sounds modest. It is not:

| | Fodder | Non-fodder |
|---|---|---|
| **Today (45 rows)** | **80.0%** | **20.0%** |
| **Steven's target** | 40–50% | **50–60%** |
| *(the ≥60% ratio it replaced)* | *≤40%* | *≥60%* |

**The four-classification target lands at the bottom edge of the ratio it replaced and requires
roughly TRIPLING today's distinguishing share** — ~8 of 14 rows in Bracket I, ~9 of 16 in II, ~11 of
20 in III.

That is not an argument against it. The four-way split is a **better instrument** than the single
ratio: it says *what kind* of different, not just *how many*, and it legitimises fodder as a real
authoring choice rather than a failure. But Steven should know it is a 3× move, not a relaxation.

⚠ **Two of the four classifications are blocked today:**

- **Ranged: 0%, not buildable.** `weaponRange: 1` is hardcoded. Blocked on brief #28 (see
  `SESSION-ranged-enemies.md`).
- **Magic: partial.** With `isCaster: false` and `casting: null`, "buffs allies / debuffs enemies /
  casts ranged damage spells" reaches the engine ONLY as on-hit riders — i.e. **melee-range magic**.
  True enemy casting is blocked by the same wiring as §3.1.

**Until both unblock, Melee + Fodder must carry the entire pool**, and the 50–60% non-fodder target
cannot be met. Sequencing this is the session's first design question for Steven.

---

## 6. Collision rules

⚠ **Two agents must never share a working directory.** If the class-abilities session runs
concurrently:

- This session owns `src/sim/combat/**`, `src/content/generated/enemies.ts`, `data/seeds/**`.
- That session owns `src/sim/heroes/**`, `output/briefs/class-*.md`.
- **Never `git add -A`.** Stage by explicit path — probe artifacts have been committed twice by
  exactly that mistake.
- ⚠ **Brief #28 (ranged enemies) also edits `src/sim/combat/build.ts`.** If #28 is running, this
  session must NOT touch `build.ts` — coordinate or sequence them.

---

## 7. Deliverable

A brief (**#30**) specifying:

1. The enemy race/ancestry model and how classes attach to it.
2. Which rows stay hand-crafted (bosses, elites) and which are generated from race × class.
3. The four-classification composition gate, and how `tools/check-enemy-taxonomy.mjs` (brief #27 M1)
   enforces it.
4. A recorded decision on ancestries-as-DLC versus the existing storyline-shaped DLC model.
5. The sequencing answer for §5's blocked classifications.
