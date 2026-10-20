# Track BV — Build the band screen (variant B), for real

**Read `output/briefs-m2/_shared.md` first.**

- **Worktree:** `C:\GuildVigilWeb-bandscreen`  **Branch:** `m4/band-screen`
- **Port:** `GV_PORT=4186` (never 4173; main is 4174)
- **Milestone:** M4 — the last missing piece

## What you are building

M4 gave the guild **2–3 bands** that each take their own job. The engine is
done and tested. There is **no UI**, so bands fill automatically as you hire
and only band 1 can be sent. You are building that screen.

**Steven chose variant B.** Build it from the approved mockup:

- `output/exploration/band-variant-B-matrix.html` — **the design to follow**
- `output/exploration/scenarios/B-01-early.html` (1 band), `B-02-normal.html`
  (2 bands), `B-03-crowded.html` (3 bands, one out, wounded heroes) — the same
  design populated three ways. **Match these layouts.**
- PNGs of all three are in `output/exploration/scenarios/png/`.

### ⚠ Build it so migrating to variant C is cheap

Steven's words: *"we probably need to migrate to C eventually but B is going
to be easier for testing right now."* So **C is coming.** C is a different
arrangement of the same decisions, which means anything C also needs must NOT
be trapped inside B's table:

- Put every decision in a **pure, separately tested module**
  `src/ui/screens/bandPicks.ts` — best job per band, each band's reading of a
  job, whether a band can be sent and why not, the hall-move hints.
- The component renders what that module returns and owns no rules.
- `src/ui/screens/townPicks.ts` + `tests/ui/townScreen.test.ts` is the
  precedent in this repo. Follow it.

A reviewer will check that C could be built by writing a new component against
the same module. If a rule only exists inside JSX, that is a defect.

## The sim API — all of this EXISTS; do not change `src/sim/**`

| Call | Gives you |
|---|---|
| `session.partyRosters()` | `string[][]` hero ids per band, index 0 = Band 1 |
| `session.unassignedHeroes()` | hero ids waiting at the guild hall |
| `session.partyCount()` | bands the Barracks supports (1–3) |
| `session.maxPartySize()` | how many may march in ONE band (Guild Hall) |
| `session.heroCapacity()` | how many heroes the guild may employ (Barracks) |
| `session.assignHero(heroId, bandIndex \| null)` | move a hero; `null` = the hall |
| `session.partyLevel(bandIndex)` | **that band's** level |
| `session.partyLevelIf(heroId, bandIndex \| null)` | what it WOULD read — for "stays 7" / "7 → 6" |
| `session.activeByParty()` | `({questId, regionId} \| null)[]` per band |
| `session.board(bandIndex)` | the board **as that band reads it** |
| `session.forecast(questId, cfg, n, bandIndex)` | odds for that band |
| `session.acceptQuest(questId, bandIndex)` | that band takes the job |
| `session.launchDispatch(bandIndex)` | that band marches |
| `session.roster()` | per hero: id, name, level, status, wounded, maxHp, ancestry |

### Rules the sim already enforces — render them, never re-implement them

- **`board(i)` is the whole point.** The same posting is *"Dangerous — a level
  above them"* to a veteran band and *"Beyond us — 5 levels over them"* to
  recruits. Each cell shows **that band's own** word and reason. Never compute
  difficulty yourself.
- **An empty band cannot take a job.** `acceptQuest` throws
  *"party N has no heroes — assign someone before taking a job"*. **So do not
  render a Send button for an empty band** — the mockup had this bug and it was
  fixed; do not reintroduce it.
- **A band that is OUT cannot be reshuffled.** `assignHero` throws. Show the
  state; do not offer a move that will fail.
- **The Guild Hall caps a band** (`maxPartySize`), **the Barracks caps the
  roster** (`heroCapacity`). Different numbers. Do not fuse them.
- Show errors by rendering `lastError` **verbatim** from the sim, as the Town
  screen does. Do not invent your own wording for a refusal.

## Reaching the screen

Follow how `TownScreen.tsx` is reached from the Town Hub. Add a **"Bands"**
button, the screen union entry and the router case — those one-line edits to
`App.tsx` / `TownHub.tsx` / the screen union are yours for this track.

Study `src/ui/screens/TownScreen.tsx` for the house pattern
(`useGame` / `session` / `exec` / `nav` / `lastError`) and reuse the real
classes from `src/ui/styles/*.css`. **There is a zero-image-asset guard**: add
no image files.

## Done means

1. `npx tsc -p tsconfig.json --noEmit` and
   `npx eslint src tests tools e2e --max-warnings 0` clean.
2. Unit tests for **`bandPicks.ts` as a pure module** (its own file), plus
   component tests for the screen in `tests/ui/bandScreen.test.ts`.
3. e2e in `e2e/bands.spec.ts`, green with `GV_PORT=4186 npx playwright test`.
4. **Negative controls: sabotage each rule in `bandPicks.ts`, confirm the
   suite goes RED, restore, and confirm `git diff src/` is empty.** Report
   each one. ⚠ **A control that does NOT fire means your test is weak — say
   so and fix the test.** Six vacuous tests have been caught this month; the
   usual cause is a fixture that cannot express the thing under test (e.g.
   every hero at the same level, so a band's level cannot move).
5. **LOOK at the screen yourself** at 1440 and 1024, in all three states
   (1 band / 2 bands / 3 bands with one out). Load
   `skill_view(name='verify-html-mockups-offline')`. Report what you saw.
6. Commit on `m4/band-screen`, staging **by explicit path**. Do not push, do
   not merge.

## Report back

Which files you added; what `bandPicks.ts` exposes and why C could reuse it;
every negative control and whether it fired; what you saw in the screenshots;
test and e2e counts; and anything the sim would not give you (**report it, do
not add it yourself**).
