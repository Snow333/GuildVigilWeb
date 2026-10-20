# Handoff

**Last session:** 2026-10-20 — **M4 is built.** Two parties, fog of war,
outposts. **Waiting on Steven's playtest.**

Playtest notes, newest first: `playtest/2026-10-20-M4.md`,
`2026-10-19-M3.md`, `2026-10-18-M2.md` (none played yet).

## M4 — what works

| System | State |
|---|---|
| **Barracks → reserve** | Hiring is capped by beds, not by the marching band |
| **Second/third band** | 10 beds → 2 bands, 15 → 3. Each takes its own job |
| **Fog of war** | Map starts dark, opens along walked roads; Watchtower widens it |
| **Outposts** | A held site stages travel for jobs in its own region |

**24 of 43 building effects are wired** (was 21): M4 added `hero_cap_*` and
`map_reveal_*`. The other 19 carry `wired: false` and the Town screen greys
them. A test pins the list — do not flip one without wiring it.

## Next session

1. **If Steven has played:** `pnpm notes`, triage into the M4 note.
2. **The obvious gap: there is no UI for bands.** The engine has
   `partyRosters()`, `unassignedHeroes()`, `assignHero()`, `activeByParty()`
   and `launchDispatch(partyIndex)`, but the Town/Dispatch screens still drive
   band 1 only. Bands fill automatically as you hire. **This is the first thing
   to build if he likes two parties.**
3. **Then M5** — "Gear and enemies you can outplay".

## ⚠ Traps — read before touching these

**DO NOT make the attack burst retarget.** `encounter.ts`'s
`if (target.hp <= 0) break;` is reserved design space for **Cleave** —
Steven's call, 2026-10-17.

**DO NOT widen the fight-plan auto-add past `grant_party_condition`.**
Measured three ways; "buffs can't overkill so they're safe" was WRONG.

**DO NOT use `this.active` in party-aware code.** It is a getter over
`actives[0]`, i.e. band 1. An ambushed second band once freed the FIRST band's
slot and kept its own job forever. Use `actives[partyIndex]`.

**DO NOT start every building at level 0** — the shop gates on building level
and a town at 0 has an EMPTY shop. See `STARTING_BUILDINGS`.

**DO NOT parse numbers out of player-facing copy**, and **do not write effect
copy by paraphrasing the effect NAME** — both shipped bugs this month.

**DO NOT `rm -rf` or PowerShell-`Remove-Item` a worktree's `node_modules`
junction** — it destroys the MAIN checkout's. Use Python `os.rmdir(path)`.

**NEGATIVE CONTROLS ARE THE HIGHEST-YIELD CHECK HERE — AND FOUR FAILED TO
FIRE THIS MONTH**, each exposing a test that passed by a route around the code
it claimed to guard (one seed instead of forty; a value the setup had set
rather than the code derived; a posting already spliced out of the board; a
geometry case that hid the bug). When a sabotage leaves the suite green, go
and find the route the test is taking.

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
