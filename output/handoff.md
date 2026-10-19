# Handoff

**Last session:** 2026-10-19 — **M3 is built and playable.** The town economy
earns AND spends. **Waiting on Steven's playtest.**

Playtest note: `output/playtest/2026-10-19-M3.md`.
M2's note (still unplayed): `output/playtest/2026-10-18-M2.md`.

## M3 — what works

| System | State |
|---|---|
| **Resources** | 9 kinds, derived from each region's `known_resources` |
| **Site expeditions** | 12 quests (ids 2000+), never on the board, taken from the sites list |
| **Weekly income** | A secured site pays forever |
| **Building levels** | All 18, with costs, prerequisites and reputation gates |
| **Upgrades** | Gold + resources; blockers explained in plain words |
| **Guild-hall ladder** | 4 → 5 → 6, and recruiting exists so it is real |
| **Town & Upgrades screen** | Variant B: 3 ranked picks + the full 18 as a fold |

**21 of 43 building effects are wired.** The other 22 carry `wired: false` and
the screen greys them with "Not working yet". A test pins the wired list.

## Next session

1. **If Steven has played:** `pnpm notes`, triage into the M3 note.
2. **The open design question** he may answer: stone is only in Gravel Downs
   (L3), so the 5th hero is gated behind levelling to ~L3. Add a second stone
   region, or lower the Guild Hall's stone cost, if he says it drags.
3. **Then either** wire more building effects (Infirmary, Training Grounds,
   Watchtower, hero caps — each needs its own engine hook, none is a seed fix)
   **or move to M4** (two parties, map reveal, outposts).

## ⚠ Traps — read before touching these

**DO NOT make the attack burst retarget.** `encounter.ts`'s
`if (target.hp <= 0) break;` is **reserved design space for Cleave** —
Steven's call, 2026-10-17.

**DO NOT widen the fight-plan auto-add past `grant_party_condition`.** Measured
three ways; "buffs can't overkill so they're safe" was built, measured, WRONG.

**DO NOT start every building at level 0.** The shop gates on building level
and a town at 0 everywhere has an EMPTY shop — measured, 0 offers.
`STARTING_BUILDINGS` exists for that, and the save backfill grants the same set.

**DO NOT parse numbers out of player-facing copy.** The ladder briefly regexed
"(\d+) heroes" out of `EFFECT_COPY.text`; four of those strings had been
reworded one commit earlier. Use the machine key (`partySizeAtLevel`).

**DO NOT write effect copy by paraphrasing the effect NAME.** Four false
promises shipped that way (`armor` claimed armour the shop already sold at L1).
Write it from the rows the level unlocks; `tests/campaign/town.test.ts` pins them.

**DO NOT `rm -rf` or PowerShell-`Remove-Item` a worktree's `node_modules`
junction** — both destroy the MAIN checkout's `node_modules`. It happened twice
this session. Use Python `os.rmdir(path)`, then `git worktree remove --force`.
Symptom: `tsc` says "This is not the tsc command you are looking for" and
vitest reports fewer test FILES. Check `node_modules/.bin` exists.

**A single seed is not a test for anything procedural.** Two negative controls
this milestone failed to fire against one seed and only bit across 40.

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
