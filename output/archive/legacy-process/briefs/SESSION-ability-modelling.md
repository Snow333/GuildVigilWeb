# SESSION SETUP — Model the abilities for the 33 approved paths

**Status:** READY TO START — this file IS the session prompt.
**Created:** 2026-09-15, from `29-approved-selection.md`.
**Run in:** a NEW session.
⚠ **CHECK #30's STATE BEFORE STARTING — see §6.** The design half is always safe to run; the
implementation half collides with #30 and may have to wait.

---

## 1. Start here — paste this as the opening prompt

> Read `output/briefs/SESSION-ability-modelling.md` and follow it. Start with §6 and tell me in one
> line whether the implementation half is blocked before you do anything else.

---

## 0. ⚠ WORKING RULE — build, don't theorycraft

**The path list is SETTLED. Do not re-derive it, re-price it, or re-open it.**

- ⛔ **Do not re-litigate the 33 paths.** Steven pared 79 → 33 on 2026-09-15 and every class landed
  inside the 3–5 band. The selection is in `29-approved-selection.md`. Author to it.
- ⛔ **Do not re-run the feat audit.** It is done and committed:
  `class-abilities-phase1-findings.md`. Cite it; do not re-measure it. **It WINS over the older 63%
  figure** wherever the two disagree.
- ⛔ **Do not benchmark against superseded goals** — the 300–500 row count, the ≥60% distinguishing
  ratio, the migration plan's targets. Dead.
- ✅ **Measure to decide HOW to build. Not to re-decide WHAT to build.**
- ✅ **A cost note is one line with a number, then keep working.** §3 records three that are already
  flagged; do not expand them into an analysis.

## 2. What Steven asked for, and where we are in it

His sequence, stated once and followed since: **list 7 per class → pare to 3–5 → then model the
abilities.** The first two are done. **This session is "model the abilities."**

| step | state |
|---|---|
| Audit the feat system first | ✅ `class-abilities-phase1-findings.md` |
| List 7 paths per class | ✅ `29-class-specialization-paths.md` (79 paths) |
| Pare to 3–5 | ✅ `29-approved-selection.md` (33 paths) |
| **Model the abilities** | ⬅ **this session** |
| Implement | after the modelling brief is approved |

## 3. The 33 paths, and what they rest on

Read `29-approved-selection.md` — it is short and it is the spec. Summary of what it commits to:

- **33 paths across 10 classes.** Prestige classes were dropped to post-launch.
- **The hooks it needs would revive 89 of the 197 dead feats.** Most engine work here pays for
  itself in content already authored — prefer reviving an authored feat over writing a new one.
- **Three cost notes are already flagged and already accepted** (§3 of that file): four paths revive
  zero authored feats (threat/taunt, aura); Metamagician is the thinnest return; Sorcerer is the
  costliest class and declined the one hook being built anyway. ⚠ **Do not re-argue these.** If a
  measurement contradicts one, say so in a single line with the number and carry on.

⚠ **`29-class-specialization-paths.md` is SUPERSEDED by its selection.** Read it only for per-path
engine reasoning. The approved 33 are the plan.

## 4. THE WORK — model each path as 3–5 abilities

**Goal: a brief Steven can approve that says, for every one of the 33 paths, what the player
actually gets at each level.**

For each path:

1. **3–5 abilities, level-tagged**, forming a progression a player picks over a career.
2. **Reuse an authored feat wherever one exists.** The audit found 197 dead feats, and 89 of them
   sit under hooks this selection already buys. ⚠ **Check before inventing:** an authored row with
   real numbers already in `feats` beats a new design, and Steven's own touch-damage wizard turned
   out to be authored twice over. Name the feat id you are reviving.
3. **Real numbers, not adjectives.** Damage, duration in ticks, AC deltas, action cost. A path
   described only in flavour cannot be implemented or balanced.
4. **State the hook each ability needs**, using the audit's names. An ability needing a hook no
   other approved path needs is a red flag worth one line.

⚠ **ABILITY LIMITERS ARE THREE DISTINCT SYSTEMS AND ONLY TWO ARE BUILT** (`characters.md`):
cooldown-in-ticks and once-per-combat live on `Combatant` and die with the encounter;
**once-per-long-rest is NOT built** and needs `HeroState` plus a save backfill. Cleric Field Medic
is the approved path that needs it. Do not collapse the tiers, and do not silently assume the third
exists.

⚠ **`actions: N` is a TIME cost, not flavour.** Without it every active is strictly better than
striking and the loadout choice is fake. Every active ability needs one.

⚠ **NEVER PROPOSE `+1` ABILITY BOOSTS** — mods are `floor((score − 10) / 2)` and every founding
hero's scores are EVEN, so four +1s is **zero** modifier change. This was briefed once already and
caught before code.

## 5. Deliverable

A brief — **#31** — holding the 33 paths × 3–5 abilities, with numbers, feat-id reuse, and the hook
each needs. Ordered so the hooks with the biggest content dividend come first (§5 of the approved
selection suggests an order; treat it as a starting point, not law).

**Present design calls as numbered options with measured tradeoffs, never as a finished opinion.**

## 6. ⚠ COLLISION — READ BEFORE TOUCHING CODE

**Five of the six hooks this selection needs live in `src/sim/combat/**`, which brief #30 owns.**

| hook | file | owner |
|---|---|---|
| spell-effect modifier layer | `combat/spells.ts` | ⚠ #30 |
| stance/rage modifier layer | `combat/conditions.ts` | ⚠ #30 |
| flat-footed/sneak layer | `combat/strike.ts` | ⚠ #30 |
| new active verbs | `combat/abilities.ts` | ⚠ #30 |
| reaction vocabulary | `combat/encounter.ts` | ⚠ #30 |
| healing modifier layer | `combat/spells.ts` | ⚠ #30 |

**So:**

- ✅ **The DESIGN half of this session is always safe.** Writing brief #31 touches no source at all.
  Start there regardless.
- ⛔ **Do NOT start hook implementation while #30 is mid-flight.** Check first:
  `git log --oneline -5` and `git status --porcelain`. #30 was awaiting approval at `63b28f4`.
- ✅ **One piece of code work does NOT collide** — see §7. It lives entirely in
  `src/sim/heroes/**`, which #29 owns.

**This session owns** `src/sim/heroes/**`, `output/briefs/31-*.md`, `output/briefs/class-*.md`.
**Never `git add -A`** — stage by explicit path. Probe artifacts have been committed twice by
exactly that mistake. Expect `npx tsc -p` to show failures in #30's mid-edit files; check
`git status --porcelain` for ownership before assuming a red suite is yours.

⚠ **A parallel session running the same probe recipe WILL delete your probe** — the canonical
cleanup is `rm -rf probe vitest.probe.config.ts`. Use brief-numbered names (`probe31/`,
`vitest.probe31.config.ts`) and copy output to `$LOCALAPPDATA/Temp/` before cleanup.

## 7. The one code task that is safe to do now

**Make the level-up picker grey out feats that do nothing.**

The audit's separate finding: `offersForSlot` greys a feat only when `isEffectReady` is false, but
that gate is inaccurate — it checks the effect *type* has a consumer while real consumers match a
narrower payload shape. **Result: the picker offers 67 selectable feats of which 42 reach no engine
code. A player picking at random gets a dead feat 63% of the time.**

- The change is at `src/sim/heroes/feats.ts:210` (`else if (!isEffectReady(row.id))`) plus a real-
  reach predicate beside `isEffectReady` in `featEffects.ts`. Both are in `src/sim/heroes/**`.
- **The UI needs no change** — `HeroPanel.tsx:62` already maps `not_yet_implemented` to
  "Not yet available", and the reason set is FROZEN. Reuse it; do not add a reason.
- ⚠ **This makes the picker SHORTER, which is player-visible.** Steven's standing decision (#22 D1)
  is that dead content stays VISIBLE and greyed as future content rather than being filtered out —
  so grey more rows, never hide them. Confirm the count with him before shipping.
- ⚠ **The test must assert against the REAL CONSUMER, never through the predicate.** This repo has
  shipped that tautology three times (#22's gate, #24's aggregator, #26's immunity table). Drive a
  hero with the feat through `assembleHero`/`runEncounter` and prove the effect lands; a test that
  asks `isEffectReady` whether a feat is ready is worthless. Run the negative control and make sure
  the sabotage is real.

---

## Summary

The next session models the abilities for the 33 approved paths — step three of Steven's own
sequence, after the audit and the paring. The design half writes brief #31 and touches no code, so
it can start immediately; the implementation half needs `src/sim/combat/**` and must wait for #30.

- **Start with §6** — one line on whether implementation is blocked, before anything else.
- **Design half is always safe**; five of six hooks collide with #30, so check `git log` first.
- **Reuse authored feats over inventing new ones** — 89 of the 197 dead feats sit under hooks this selection already buys.
- **One code task is safe now:** grey the 42 dead feats out of the level-up picker (`src/sim/heroes/**`).
- **Once-per-long-rest is NOT built** and Cleric Field Medic needs it — do not assume the third limiter tier exists.
