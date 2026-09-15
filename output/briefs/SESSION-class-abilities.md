# SESSION SETUP — Class abilities and specialization paths

**Status:** READY TO START — this file IS the session prompt.
**Created:** 2026-09-13, from brief #27 Q2.
**Run in:** a NEW session. ⚠ **FIRST IN SEQUENCE** — #29 → #30 → #28. May run in parallel with
#30 (enemy specification); the two own different directories. See §6.

---

## 1. Start here — paste this as the opening prompt

> Read `output/briefs/SESSION-class-abilities.md` and follow it. Start with the Phase 1 audit;
> do not design anything until the audit numbers are on the table.

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

> *"We want abilities to be a series of choices that augment flavors of a class as the player's
> characters level up. Examples: This Warrior starts to specialize more as a tank that attracts
> damage and can take damage as he progresses. This Warrior starts to deal damage using a specific
> weapon type… This Barbarian attracts damage and deals more damage the lower their health."*
>
> *"Can you list the classes and propose 7 flavorful progression types for each class? Then we will
> pare that down to 3 to 5 options per class. Then we model out the abilities from there."*

He also flagged that **legacy design exists in `C:\GuildVigil`** and is worth mining — his example
was *"wizards who specialize in touch damage spells."*

---

## 3. ⚠ Read this before proposing a single specialization path

**The system Steven is describing already exists. It is the feat system. It is 63% inert.**

Measured 2026-09-13 through `isEffectReady` (the repo's own readiness predicate — not a text search):

| | count |
|---|---|
| Feats authored | **227** |
| Feats that reach the engine | **83** |
| **Feats that do NOTHING** | **144 (63%)** |
| Classes with ZERO feats authored | **5 of 13** |

Per class:

| Class | live / authored |
|---|---|
| (general + skill feats) | 26 / 43 |
| Fighter | 9 / 23 |
| Rogue | 9 / 23 |
| Cleric | 9 / 23 |
| Monk | 7 / 21 |
| Wizard | 7 / 24 |
| Sorcerer | 6 / 24 |
| Warlock | 6 / 23 |
| **Barbarian** | **4 / 23** |
| **Ranger** | **0 / 0** |
| **Bard** | **0 / 0** |
| **Arcane Trickster** | **0 / 0** |
| **Eldritch Knight** | **0 / 0** |
| **Mystic Theurge** | **0 / 0** |

⚠ **Steven's own example is the worst case.** The Barbarian who "attracts damage and deals more
damage the lower their health" has **4 of 23** feats working. That character cannot be built today.

⚠ **This is the EIGHTH occurrence of this project's recurring defect** — content authored against a
contract with no consumer — and by far the largest. Precedents: `class_weapon_proficiency` (70 rows),
`items.onHitEffects`, `items.stat_bonus`, 96 buff/debuff spell rows, `enemies.abilities` (brief #26),
`items.loot_tier`, `quests.prerequisites`.

**Designing 7 paths × 13 classes on top of this would author a ninth.**

---

## 4. Phase 1 — THE AUDIT (do this first, design nothing yet)

✅ **Steven approved this ordering explicitly** (2026-09-13): *"Agreed on putting the feat audit
before the session-class-abilities.md work."* The audit is not optional and not a formality.

**Goal: a table of the 144 inert feats, grouped by what they need in order to work.**

The instrument already exists — `src/sim/heroes/featEffects.ts` exposes `isEffectReady(featId)`,
which fails a feat for one of three reasons: `implemented: false` in its effects JSON, an
`effect_type` with no engine consumer (`EFFECT_HAS_CONSUMER`), or a `combat_action` that is not in
`ACTIVE_WIRED`.

Produce, as measured output:

1. **The 144, bucketed by `UnreadyReason`.** How many are blocked by each of the three causes?
2. **By `effect_type`.** Authored distribution is `passive_modifier` 119 · `combat_action` 51 ·
   `reaction` 16 · `resource_grant` 12 · `stat_mod` 8 · `special` 6 · `stance` 4 · `skill_mod` 4.
   Which of those types have NO consumer at all? Those are whole categories of dead design.
3. **Cost to revive, per bucket.** Which buckets are wiring (cheap, follows an existing pattern) and
   which need a new engine system (expensive)? ⚠ **`stance` and `resource_grant` are the ones to
   look at hardest** — they smell like systems, not wiring.
4. **What the 5 empty classes would need.** Ranger, Bard, and the three hybrids have no feats at all.
   Is that an authoring gap or an engine gap?

⚠ **Use the throwaway-probe recipe, not a new test file.** Copy `vitest.config.ts` to
`vitest.probe.config.ts` changing only `include` to `['probe/**/*.probe.ts']` — **a minimal config
fails**, because the probe needs the `@sim` / `@content` / `@platform` path aliases. Delete `probe/`
and the config afterwards and confirm `git status` is clean.

---

## 5. Phase 2 — the design work Steven asked for

**Only after Phase 1's numbers exist.**

1. **13 classes × 7 proposed paths**, each with a one-line player-facing pitch.
   ⚠ **Mark each path with whether the engine can express it today**, using Phase 1's audit. A path
   that needs 6 dead feats revived is a different proposition from one that needs 1.
2. **Mine `C:\GuildVigil` for legacy design.** Steven named "wizards who specialize in touch damage
   spells" specifically. Start with `game_bible.md` (§7 multi-classing, §13 launch roster) and
   `.claude/memory/project_feat_action_system.md`, `project_abilities_equip.md`,
   `project_boss_loadouts.md`. ⚠ The legacy repo is FROZEN — **read only, never write**.
3. **Present for paring to 3–5 per class**, as numbered options with measured tradeoffs.
4. ⚠ **Do not write the ability content in this session.** Steven's sequence is explicit: list 7 →
   pare to 3–5 → *then* model the abilities.

---

## 6. Collision rules

⚠ **Two agents must never share a working directory.** The enemy-specification session (#30) may run
concurrently:

- **This session owns** `src/sim/heroes/**`, `output/briefs/class-*.md`, `output/briefs/SESSION-class-abilities.md`.
- **#30 owns** `src/sim/combat/**` (including `build.ts`), `src/content/generated/enemies.ts`,
  `data/seeds/**`.
- **Never `git add -A`.** Stage by explicit path. This repo has had probe artifacts committed twice
  by exactly that mistake.
- Expect `npx tsc -p` and the full suite to show failures in the other session's mid-edit files.
  Check `git status --porcelain` for ownership before assuming a red suite is yours.


## 7. Deliverable

A brief (**#29**) proposing 3–5 specialization paths per class, each annotated with what the engine
would need in order to express it — backed by the Phase 1 audit table.

⚠ **The audit table is the more valuable half.** Even if the specialization design changes
completely, knowing which of 144 feats are cheap to revive and which need new systems is what makes
every later decision here honest.
