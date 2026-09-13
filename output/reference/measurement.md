# Measurement & harness discipline

> Split out of `CLAUDE.md` because it exceeded the 20,000-char context-injection cap and
> was being silently truncated. **This file is authoritative for its domain** — do not
> copy these facts back into CLAUDE.md, and do not re-derive them.

Read this before writing ANY test that claims a balance number, before touching
`tests/harness/**`, and before believing a green harness means anything. This file is the
repo's rules of evidence.

---

- **Dungeon generation IS guarded now — by `tests/harness/dungeon-*` and nothing else.** `career-distribution` still never dispatches a dungeon (480 records, 0 dungeon runs — the autopilot only accepts quests 1/6/100), and `encounter-distribution` runs hand-authored rosters and never calls `populate()` or `pickEnemies` — which is why brief #15's positioning change left it byte-identical. (#19 moved it for the first time: it calls `runEncounter`, and its `fromRegistry` helper now mirrors `buildEnemy` for `reactions` and the two skill totals.) Do not read a green `encounter-distribution` as cover for anything in `src/sim/campaign/assembly.ts`.
- ⚠ **`career-distribution` IS DEGENERATE AND CANNOT REPORT IT.** It now reads `completionRate 1.0 · wipeRate 0 · failRate 0 · idleWeekRate 0 · ambushDeaths 0`, and every named assertion is a **one-sided floor** (`completionRate > 0.5`, `wipeRate < 0.2`), so **nothing fires** to say the surface loop lost its teeth. No ceiling was added because it would fail today. **A green `career-distribution` is currently worth nothing as evidence about the surface game.** Restoring its signal is part of the re-tune, not a follow-up to it.
- ⚠ **No assertion may claim a completion difference smaller than ~8 points.** Measured (brief #16 §3): eight independent blocks of the SAME dungeon cell land **30 points apart at 30 runs/cell**, 8.0 at 100, 7.0 at 300. This caught a wrong number in brief #16's own text. Harness grid n affects only cost (snapshots are seed-pinned and exact); curve n IS the precision of the contract.
- ⚠ **When a negative control loses its headroom, MOVE THE BAND — never lower the threshold.** Lowering it quietly lets a control assert a difference smaller than the noise floor, which is the one thing the precision rule forbids. #19 hit this: NC6's pooled wipe control moved from d1–d3 to **d3–d5** at the **same threshold and the same n**, because d1/d2 wipes had collapsed into a floor and it was reading a 1.5-point delta inside its own ±3.8 bar.
- **Harness snapshots are load-bearing and `vitest -u` defeats them.** Three of brief #16's five negative controls are caught by the exact snapshot ALONE, with no named invariant firing. Re-baseline consciously and justify each moved baseline in the commit; there is no mechanical substitute.
- **Measure a NEW option with a throwaway probe** — a scratch vitest config OUTSIDE `tests/`, deleted before shipping; to cost an option needing logic changes, patch a COPY under `probe/` and verify `src/` byte-identical afterwards. The harness is a regression gate, not an exploration instrument.
- ⚠ **A "FREE" FEATURE AND A BROKEN FEATURE LOOK IDENTICAL ON THE CURVE.** Every #20 delta sat inside the ±8 bar, so `tests/combat/size.test.ts` carries an **exposure test** asserting Large+ bodies are ≥15% of the d4/d5 spawn band — without it the whole feature could silently no-op and every harness would stay green. Two of that file's assertions were **decoration on the first pass**, both worth not repeating: asserting `gap > 0` for spawn spacing passes under flat `+1` too (1 − 0.5 − 0.5 = 0), and reading positions **after `runEncounter`** measures where units MOVED to, not where they spawned — call `placeFormation` directly. ⚠ **The same trap caught brief #20 §9.4 itself**: its convention gate asked a 300-run curve cell to resolve a 0.3-point difference. When a question is deterministic ("is this bit-identical?"), hash the event stream; do not put it to a statistical harness.
- ⚠ **`encounter-distribution` IS NOT BLIND TO SPELL WORK, unlike the other harnesses.** Its caster scenario hand-authors Fireball, so it reaches the AoE branch that no autopilot spell can (every autopilot-castable spell carries `aoe_size: 0`). #21's side policy moved it hard — winRate **0.893 → 0.993**, hero deaths **51 → 23** — and that was attributed by isolation, not assumed: restoring `sideRule` to `'all'` with the discriminator still in place reproduced the old snapshot exactly. **When a spell change leaves this snapshot untouched, check that your change is actually reachable before believing it is free.**

## Reading outcomes correctly

- `QuestRecord.outcome` is `'completed' | 'failed' | 'wiped' | 'ambushKilled'` — a dungeon **retreat** surfaces as `'failed'`. Reading it as `'retreated'` silently miscounts retreats as wipes.

## ⚠ Balance numbers dated before 2026-09-12 are VOID

**Every balance number taken before 2026-09-12 was measuring ILLEGAL ARMOUR.**
`tests/harness/gearBrackets.ts` armed the Rogue in a Chain Shirt (medium) from L2 and the Cleric in
Half/Full Plate (heavy) from L5, under a docstring that claimed the opposite. Brief #23 replaced
them with legal equal-or-better gear.

⚠ **Older briefs still contain those void numbers and read as authoritative.** Before citing any
completion rate, wipe rate or delta from a brief, check its date. If it predates 2026-09-12, it was
measured against gear the class cannot legally wear — re-measure rather than quote it.

## ⚠ An immunity/resistance test must assert the DAMAGE, never the table

Brief #26 M2 shipped an exposure test reading `skeleton.damageModifiers.immune.has('poison')`. A
sabotage run gutted `applyDamage` of its modifier lookup — **and that test stayed green**, because
it read the table the builder had just populated rather than the effect the engine produces.

Same family as brief #22's tautological gate and brief #24's assert-the-aggregator-against-itself.
The replacement drives a venomous weapon into a Skeleton and asserts **zero poison damage with the
damage event still emitted**, plus a Giant Spider control proving the weapon fires at all.

**Generalise it:** for any "X reduces/blocks Y" feature, the test must run Y through the real path
and compare against a subject without X. A field lookup proves only that a builder ran.

## Reading a curve move that is inside the noise bar

Brief #26 M1+M2 moved at-level completion by −0.3 / −1.0 / −0.3 / −3.6 / −1.3 at d1–d5. **Every one
of those is inside the ±8 bar**, so the curve neither confirms nor denies that the feature works.

⚠ **That is not a reason to skip re-baselining, and not a reason to claim the feature is free.** The
snapshot moved because the sim genuinely changed; it was re-taken deliberately with the reason in the
commit. The EVIDENCE the feature works is the exposure suite and its three negative controls — the
curve is a regression gate, not an instrument for measuring a change this size.
