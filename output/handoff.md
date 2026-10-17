# Handoff

**Last session:** 2026-10-17 — portraits finished, the ability model fixed, items and the
mid-level board merged. **Waiting on Steven's playtest.**

Playtest note: `output/playtest/2026-10-17-M2-round2.md`. Decisions: `output/decisions.md`.

## What shipped this session

| Thing | State |
|---|---|
| 8 missing ancestry busts | Done — 12/12 portraits are real art, contact sheet shown to Steven |
| Ability model (Power Attack) | Fixed — an ability rides a normal action and pays a cooldown |
| Scroll of Raise Dead | Repointed to Breath of Life and renamed (Raise Dead is inert) |
| Weapon prices | Rebuilt on a rune-based rule; the Staff is no longer free |
| Mid-level quests | 41 jobs, min_level 6–15, plus a takeable-first board draw |

All merged to `main` and pushed. Gate: 78 files / 1186+ unit tests, 31 e2e on
`GV_PORT=4174`, bundle 2,538.96 kB (21.2% of the fail ceiling).

## Next session

1. **If Steven has played:** run `pnpm notes` (moves Downloads `gv-note-*.json` into
   `playtest/inbox/`), then triage into the M2 round-2 playtest note.
2. **The best-value piece of work on the table — the non-retargeting burst.**
   `encounter.ts` runs an action as a burst of `swingsPerAction` swings and does
   `if (target.hp <= 0) break;` — it never turns to the next living enemy. Measured
   against real enemy rows: a party wastes **42% of its damage at level 1**, 29% at
   level 3, still **15% at level 7**. Fixing it lifts every hero in the game and would
   very likely flip Power Attack positive at all levels as a side effect. It changes
   every fight, so it needs its own measured pass and a re-baseline. Steven has been
   asked and has not answered yet.
3. **Then revisit auto-adding abilities** — either unconditionally (if the retarget fix
   removes the early-game penalty) or gated on level. The numbers are in `questions.md`.
4. **M2's remaining scope:** "signature classes, round 1" is only half done. The ability
   model is fixed, but **Ranger and Bard still have ZERO class feats**, so the "ranged
   ranger" flagship does not exist. Wizard has 24 feats of which **0** are live actives.
5. Still open from M1: debuffs need a "target lacks condition" loadout check; the playback
   heading still says "quest <name>".

## Content debt found and NOT fixed (from the track reports)

- **29 of 52 scrolls point at spells the engine cannot execute** (Haste, Fly, Telekinesis,
  Dispel Magic, Mirror Image…). They would do nothing if read.
- `canReadScroll` is **never called from `src/`** — only from tests. The scroll-literacy
  gate is not wired to anything player-facing.
- `isConsumableUsable` treats any `healing` spell as usable even with no dice, so a
  dice-less healing scroll can be spent for nothing. `isSpellResolvable` gets this right;
  `quickSlots.ts` does not.
- **No magic weapon is purchasable**: the shop's only one (Longsword +1) is gated at
  `required_building_level 3`, and rows above level 1 are skipped entirely.
- **Armour +N rows (60g–4500g) still use the old tier multiplier** and may have the same
  oddness the weapons had.

## Traps worth remembering

- ⚠ **A sandbag probe does not predict party results.** Power Attack measured +15% against
  a 1,000,000-hp dummy and −5.2 points of completion across a career. Overkill and the
  burst-break only exist when the target can die.
- ⚠ **`questBoard.test.ts`'s `launchFresh` seeded all 40 launches identically** (a camp
  fight seeds from `dispatchN`, which the helper never set), so its win rates were one
  fight counted 40 times. Fixed. Look for the same shape in other "N launches" helpers.
- ⚠ **A vitest probe is NOT typechecked.** A probe read `r.winner` when the field is
  `r.result` and silently reported 0% wins everywhere. Point a temporary tsconfig at the
  probe dir before trusting its numbers.
- ⚠ `e2e/perf.spec.ts` "hover lift is off while scrolling" is **flaky under full-suite
  load** — it failed twice in full runs and passed 3/3 in isolation and on re-run. Re-run
  before investigating.
- ⚠ Backgrounded vitest runs lose their output ("stdin is not a tty"). Redirect to a file
  and keep the foreground call under 600s.

## Parallel-work recipe (worked again — 2 tracks, 1 crashed and was recovered)

- Split tracks by **file ownership**, not by feature.
- `git worktree add C:/GuildVigilWeb-<track> -b <branch>`, then link `node_modules` with a
  PowerShell `New-Item -ItemType Junction` (cmd `mklink` fails from git-bash).
- Set the subagent model with `hermes config set delegation.model <id>`; unset it afterwards.
- Give each track its own `GV_PORT` (main 4174, tracks 4181+).
- ⚠ **A subagent can die with everything uncommitted.** Track Q2 did — 41 quests and a real
  board fix sat in the worktree plus one `git stash`. Check the worktree and `git stash list`
  before assuming a crashed track produced nothing.
- Merge the track that touches `session.ts` into your branch FIRST, re-baseline the career
  snapshot ONCE on the combined code, then merge up.

## Worktrees

`C:\GuildVigilWeb-questsmid` (m2/quests-midlevel) and `C:\GuildVigilWeb-itemfix`
(m2/item-fixes) are merged and can be removed. **Delete the `node_modules` junction before
`git worktree remove`.**
