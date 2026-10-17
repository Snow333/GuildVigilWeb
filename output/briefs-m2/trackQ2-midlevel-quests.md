# Track Q2 — Mid-level quests: keep the board alive past week 17

**Read `output/briefs-m2/_shared.md` first.** It has the sandbox rules, commands and "done means".

- **Worktree:** `C:\GuildVigilWeb-questsmid`  **Branch:** `m2/quests-midlevel`  **e2e port:** `4181`
- **Milestone:** M2 content to-do (from Steven's playtest of the M2 feedback round)

---

## The problem, in player terms

Steven played to about week 17 and the quest board went thin — the same few jobs,
or empty rows. A guild that has levelled up has nothing worth doing.

## The measured fact (already checked — do not re-derive, build on it)

`src/content/generated/quests.ts` holds **22 quests**. Their `min_level` spread:

| min_level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 |
|---|---|---|---|---|---|---|---|---|
| quests | 5 | 2 | 5 | 3 | 3 | 2 | 1 | 1 |

Types: 7 `combat`, 15 `dungeon`. Plus hand-authored ids 900–904 (early easy,
first weeks only) and 950–953 (Marshal commissions, posted by letter only).

So past roughly party level 7 there are **two** quests in the whole game. The
board's weekly draw wants 4–6 postings and simply cannot fill them.

## Your goal

**A guild at level 6–14 always has a full, varied board.** Author enough
mid-level quest content that the weekly draw can fill 4–6 rows with jobs that
suit the party, all the way to about level 14.

### What to build

1. **New hand-authored quests, ids 1000+**, in a new file
   `src/content/midQuests.ts`, following the exact pattern of
   `src/content/earlyQuests.ts` (same `QuestRow` shape, wired through
   `src/sim/registry/index.ts` and `src/content/world.ts` the same way).
   - Target roughly **4–6 quests per level band** for min_level 6, 8, 10, 12, 14.
     Judge the real number by what the board needs — see step 3.
   - Mix `combat` and `dungeon` types in roughly the existing 1:2 ratio.
   - Reuse existing enemy rows and dungeon levels. **Do not invent new enemies** —
     if the enemy roster cannot support a level band, say so in your report
     rather than adding enemy content (that is another track's territory).
2. **Rewards must scale.** Check what the existing L5–L7 quests pay and continue
   the curve; do not copy L1 numbers upward by hand. Quest XP interacts with the
   level curve decided in M1 (`output/decisions.md`) — a mid-level quest that pays
   L1 gold is worthless and one that pays 10x is a trap.
3. **Prove the board actually fills.** The weekly posting draw lives in
   `src/sim/campaign/session.ts` (`board`, the `candidates` filter, `SCHEDULER`).
   Run a real campaign simulation for 60 weeks on autopilot at several party
   levels and assert the board holds 4+ rows the player can take. If the
   candidate filter (cooldowns, arc gating, `min_level` vs party level) is what
   starves the board rather than content volume, **fix the filter and say so** —
   that is the more valuable finding.
4. Quest names and descriptions are player-facing: short, plain, concrete.
   No purple prose. Steven is dyslexic.

### Files you own

- `src/content/midQuests.ts` (new)
- `src/content/earlyQuests.ts`
- `src/content/world.ts`
- `src/sim/registry/index.ts`
- `src/sim/campaign/session.ts`  ← **hot file, you are the only track touching it**
- `src/sim/campaign/campaign.ts`
- `tests/campaign/**`

Do NOT touch: `src/sim/combat/**`, `src/content/combat.ts`, anything under
`src/content/generated/` (another track regenerates those), `src/ui/**` except a
one-line label fix if a board row genuinely renders wrong.

### Done means

- The four gate commands green (`GV_PORT=4181` for e2e).
- A test that **fails without your content** proving the board fills at mid level —
  run that negative control and report it.
- Committed on `m2/quests-midlevel`. Do not push, do not merge.
- Report: what levels are now covered, how many quests you added, the board
  occupancy numbers you measured before and after, and whether the starvation
  was content volume or the candidate filter.
