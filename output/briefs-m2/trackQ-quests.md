# Track Q: quest board, early easy quests, the Marshal's commission

**Worktree:** `C:\GuildVigilWeb-quests`, branch `m2-quests`. **GV_PORT=4181.**
Read `C:/GuildVigilWeb/output/briefs-m2/_shared.md` first.

## What Steven asked (verbatim intent)
1. "We need some 'easy' quests that surface during the first 4 weeks to give the player a chance to
   secure some wins with their level 1 team. The Goblin camp fits this bill." (His sentence was cut off.)
2. "Expand the quest board to support more than 4 quests, target 10 for now, but don't populate it
   fully each week. Offering 4 to 6 quests a week is good for variance testing/feel."
3. The Marshal's letter on the town screen has a **"We'll look into it."** button that does nothing.
   "Have this button auto-generate a special quest that shows up on the quest board."

## Where things are
- Posting/expiry: `src/sim/campaign/session.ts` `advanceWeek` posting block (~line 495–545);
  constants `SCHEDULER` in `src/content/world.ts` (`maxOpenQuests: 4`, `expiryWeeks: 2`, level band).
- Quests come from `src/content/generated/quests.ts` (generated from game_data.db — **do not edit
  generated files**). L1 quests today: 1 Clear the Goblin Camp, 2 The Abandoned Mine, 6 Wolf Pack
  Menace, 100 The Burned Granary, 101 Tracks in the Ashes (100–109 are the storyline arc).
- Quest board UI: `src/ui/screens/QuestBoard.tsx`. Town + Marshal letter: `src/ui/screens/TownHub.tsx`
  (the choice buttons ~line 105 have no onClick). Dialogue: `session.pendingDialogue()`.
- Save shape: `session.serialize()` / `deserialize` (~line 1443); old saves need backfill.

## Build
1. **Board capacity 10; 4–6 new postings per week.** The weekly count comes from the seeded rng
   (deterministic per seed). Expiry and cooldown rules stay. Keep storyline quests posting first.
2. **Easy early quests.** In weeks 1–4 the board always carries at least 2 quests a fresh level-1
   party wins most of the time. Measure it: run real launches (see `tests/harness/` and
   `tests/campaign/session.test.ts` for how) and report each early quest's win rate for the default
   level-1 party. Target: easy quests ≥ 80% wins. If the existing L1 quests are not easy enough
   (the Goblin Camp has 6 enemies), add a few **hand-authored easy quests** in a new TS content file
   (e.g. `src/content/earlyQuests.ts`, merged into the registry so `questsById` finds them) — small
   fights, low reward, plain names ("Rats in the Granary Cellar"). Ids must not collide with
   generated ids (use 900+). They need a position on the map like other quests; follow how
   `questPos` places them.
3. **The Marshal's commission.** Clicking a Marshal letter choice:
   - marks that letter as answered (it stops showing; persists in the save),
   - posts a **special commission** on the board: a real, launchable quest built from the current
     story beat (for letter 1, a granary/goblin job that fits a level-1 party), clearly marked on
     the board (e.g. a red wax seal + "Marshal's commission"), with a modest bonus reward, and a
     longer expiry than normal postings. It does not count against the 4–6 weekly postings.
   - One commission per letter. Deterministic (seeded). Saves and reloads correctly.
   Keep it simple: a commission can reuse an existing quest row's fight with an overriding name,
   reward and flag, if that is cleaner than synthesising quests.
4. **Board UI** shows up to 10 postings without becoming a wall: compact rows, easiest first or
   grouped, with a plain difficulty word ("easy", "fair", "hard") from the party's level.

## Files you own
`src/sim/campaign/session.ts` (posting block, dialogue answer, serialize/deserialize — keep edits
local), `src/content/world.ts`, new `src/content/earlyQuests.ts` (or similar), `src/sim/registry/index.ts`
(only to merge your quests in), `src/ui/screens/QuestBoard.tsx`, `src/ui/screens/TownHub.tsx` (the
Marshal letter block only), new tests under `tests/campaign/`, new `e2e/quest-board.spec.ts`.
Other tracks are editing: HeroPanel/knownSpells/levelUp/campaign.ts (spells), equipment/attribution/
SheetTab (items), styles/*.css (perf). Stay out of those.

## Tests
- Board: weekly postings in [4,6], never above 10, deterministic per seed.
- Weeks 1–4: ≥2 easy postings every week, across several seeds.
- Easy quests win ≥80% for the default L1 party (real launches) — report the measured numbers.
- Commission: click → letter gone, commission on board, launchable, survives serialize/deserialize.
- e2e: new campaign → click "We'll look into it." → board shows the commission → accept → launch.
- Existing snapshot/harness tests may shift because the board changes. Re-baseline ONLY after you
  have read the diff and can explain it in one line in your report.
