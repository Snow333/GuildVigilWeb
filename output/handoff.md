# Handoff

**Last session:** 2026-10-18 — **M2 is built.** Signature classes and mission skills
merged. **Waiting on Steven's playtest.**

Playtest note: `output/playtest/2026-10-18-M2.md`. Decisions: `output/decisions.md`.

## What shipped (this session + the one before it)

| Thing | State |
|---|---|
| 8 missing ancestry busts | 12/12 portraits are real art |
| Ability model | An ability rides a normal action and pays a cooldown (was a 45–53% tax) |
| Scroll of Raise Dead | Repointed to Breath of Life and renamed (Raise Dead is inert) |
| Weapon prices | Rune-based rule; the Staff is no longer free |
| Mid-level quests | 41 jobs, min_level 6–15, takeable-first board draw |
| **Ranger** | **8 feats — had ZERO** |
| **Bard** | **9 feats — had ZERO**; `grant_party_condition` verb added |
| **Wizard** | 3 of 24 feats made live (touch hit, touch damage, Protective Ward) |
| **Mission skills** | Arcana, Religion, Survival, Deception each do something visible |

All merged to `main` and pushed, CI green. Gate: 82 files / 1246 unit tests,
32 e2e on `GV_PORT=4174`, bundle 2,551.62 kB (21.3% of the fail ceiling).
Career harness: completion 96.5%, wipes 3.3%.

## Live-active count per class (the M2 scorecard)

| Class | Feats | Live actives |
|---|---|---|
| Fighter | 23 | 6 |
| Bard | 9 | 8 |
| Ranger | 8 | 5 |
| Cleric | 23 | 2 |
| Wizard | 24 | 1 (+2 live touch passives) |
| Rogue | 23 | 1 (+ Sneak Attack, which works) |

## Next session

1. **If Steven has played:** `pnpm notes`, then triage into
   `playtest/2026-10-18-M2.md`.
2. **M2's thin spots, if the playtest says they matter:**
   - **Rogue** is the thinnest flagship — one active (Poison Weapon) plus Sneak Attack.
   - **Wizard still has 21 inert feats** (Counterspell, Familiar, Spell Mastery,
     Effortless Concentration…). Each needs its own engine hook; none is a seed fix.
   - **Sorcerer/Warlock/Barbarian/Monk** have not been looked at for M2 standard.
3. **Then M3 — the town grows** (`roadmap.md`): resource sites, building upgrades,
   the guild-hall size ladder.

⚠ **DO NOT make the attack burst retarget.** `encounter.ts`'s
`if (target.hp <= 0) break;` looks like an obvious bug (a party wastes 42% of its
damage on corpses at L1, 15% at L7) and it is **reserved design space for the
Cleave feat** — Steven's call, 2026-10-17. Giving every attack carry-through
would hand out for free the thing Cleave is meant to sell. Logged in
`decisions.md`, `questions.md` and the `guild-vigil` skill.

⚠ **Only `grant_party_condition` is auto-planned into the fight plan.** Measured
three ways: every ability 95.0%→89.8%, every non-strike 95.0%→90.4%, songs-only
95.0% unchanged with +1.7 party win rate. "A buff cannot overkill so it is safe
to auto-add" was reasoned, built, measured and is WRONG. Do not widen
`autoPlannable` without re-measuring.

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
