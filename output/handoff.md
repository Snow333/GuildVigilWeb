# Handoff

**Last session:** 2026-10-19 — **M3 core is built** (the town economy).
**Waiting on Steven:** a playtest, and a pick between three town-screen mockups.

Playtest note: `output/playtest/2026-10-19-M3-core.md`.
M2's note (still unplayed): `output/playtest/2026-10-18-M2.md`.

## M3 — what works now

| System | State |
|---|---|
| **Resources** | 9 kinds, derived from what each region says it produces |
| **Resource sites** | 12 on the map, L1–L7, secured sites pay every week |
| **Building levels** | All 18 buildings, real levels, costs, prereqs, reputation gates |
| **Upgrades** | Spend gold **and** resources; blockers explained in plain words |
| **Guild-hall ladder** | 4 → 5 → 6 heroes, and it is REAL (see below) |
| **Recruiting** | New — gated on the Tavern's own `recruit_*` effects |
| **Reputation** | Now banked from quests; was announced and thrown away |

**21 of 43 building effects are wired.** The other 22 carry
`wired: false` in `EFFECT_COPY` so the UI greys them rather than promising
them. That flag is pinned by a test — do not flip one without wiring it.

## Next session

1. **If Steven picked a mockup:** build the town screen from
   `output/exploration/town-variant-{A,B,C}-claude.html`. My recommendation
   was **B (do-this-next)**, possibly with A's full ledger behind a toggle.
2. **Make securing a site a real mission.** Today `secureSite()` banks a site
   but there is no "go and take it" quest. This is the biggest gap in the loop.
3. **Then the rest of M3's effects, or M4** (two parties, map reveal, outposts).

## ⚠ Traps — read before touching these

**DO NOT make the attack burst retarget.** `encounter.ts`'s
`if (target.hp <= 0) break;` looks like an obvious bug (a party wastes 42% of
its damage on corpses at L1) and it is **reserved design space for Cleave** —
Steven's call, 2026-10-17. Logged in `decisions.md`, `questions.md` and the
`guild-vigil` skill.

**DO NOT widen the fight-plan auto-add past `grant_party_condition`.** Measured
three ways: every ability 95.0%→89.8%, every non-strike 95.0%→90.4%, songs-only
unchanged with +1.7 party win rate. "A buff cannot overkill so it is safe to
auto-add" was reasoned, built, measured and is WRONG.

**DO NOT start every building at level 0.** The shop gates on building level,
and a town at 0 everywhere has an EMPTY shop — measured, 0 offers.
`STARTING_BUILDINGS` (Guild Hall, General Store, Blacksmith) exists for that
reason, and the save backfill grants the same set because a pre-M3 save had a
working shop and must keep it.

**DO NOT trust a single seed for map placement.** The duplicate-tile negative
control PASSED against one seed and the bug was still there — across 60 seeds
it reproduces in 9. `tests/campaign/town.test.ts` sweeps 40 seeds.

**Subagents keep dying** with "owner exited before recording a terminal
result" — three times now. They commit fine; recover their work from the
worktree branch by hand and verify it yourself.

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
