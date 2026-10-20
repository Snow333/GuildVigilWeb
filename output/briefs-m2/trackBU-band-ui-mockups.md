# Track BU — The band screen: mockup variants for Steven to pick

**Read `output/briefs-m2/_shared.md` first** for the sandbox rules.
**This track writes NO application code.** HTML mockups only.

- **Worktree:** `C:\GuildVigilWeb-bandui`  **Branch:** `m4/band-ui-mockups`
- **Milestone:** M4 — "Multiple parties, exploration, outposts"

---

## Why this exists

M4 gave the guild **two or three bands**, each able to take its own job. The
engine supports all of it; there is **no UI**, so bands currently fill
automatically as you hire and only band 1 can be sent. Steven reviews UI as
mockups, picks one, and names amendments.

The milestone's playtest question is **"is running two parties fun, or
busywork?"** — so the screen's whole job is to make a second band feel like
leverage rather than paperwork. A design that needs six clicks per week to
send two parties has failed even if it displays everything correctly.

## The sim API that exists (read-only — do NOT design past it)

| Call | Gives you |
|---|---|
| `session.partyRosters()` | `string[][]` — hero ids per band, index 0 = band 1 |
| `session.unassignedHeroes()` | hero ids waiting at the guild hall |
| `session.partyCount()` | how many bands the Barracks supports (1–3) |
| `session.maxPartySize()` | how many may march in ONE band (4/5/6) |
| `session.heroCapacity()` | how many heroes the guild may employ (4/6/10/15) |
| `session.assignHero(heroId, bandIndex \| null)` | move a hero; `null` = back to the hall |
| `session.activeByParty()` | `({questId, regionId} \| null)[]` — what each band is doing |
| `session.partyLevel(bandIndex)` | **that band's** level |
| `session.board(bandIndex)` | the board with difficulty words **as that band sees them** |
| `session.forecast(questId, cfg, n, bandIndex)` | odds for **that band** |
| `session.acceptQuest(questId, bandIndex)` / `launchDispatch(bandIndex)` | per band |
| `session.roster()` | per hero: id, name, level, status, wounded, maxHp, ancestry |

### Two facts that should drive the design

1. **The same job reads differently per band.** On a real guild the identical
   posting is *"Dangerous — a level above them"* to a veteran band and
   *"Beyond us — 5 levels over them"* to four green recruits. That contrast is
   the most useful thing the screen can show, and it is free from `board(i)`.
2. **A band that is OUT cannot be reshuffled.** `assignHero` throws for a band
   with an active job. Show that state; do not offer a move that will fail.

## Your job

Three labelled variants plus a comparison index, as self-contained HTML in
`output/exploration/`:

- `band-variant-A-<name>.html`, `-B-`, `-C-`, and `band-variants-index.html`

Make them **genuinely different answers to "how do I run two bands without it
being a chore"**. Some directions you may take or reject:

- A **two-column war table** — bands side by side, drag/assign between them.
- A **week planner** — "band 1 → this job, band 2 → that job", confirm once.
- A **band-at-a-time** flow with a switcher, so the screen is never crowded.
- Something that leans on the per-band difficulty words to recommend a job.

At least one variant must show how the player handles **heroes waiting at the
hall** (a reserve exists now: 10 beds, 6 marching).

### Hard requirements

- **Match the existing look.** Read `output/art-style-bible.md`,
  `output/reference/ui-and-art.md`, and the real
  `src/ui/screens/TownScreen.tsx` + `src/ui/styles/*.css`. Reuse the real
  classes (`gv-sheet`, `gv-head`, `gv-sub`, `gv-plate`, `gv-btn`, `gv-chip`,
  `gv-ledger`). Pure CSS + inline SVG; **there is a zero-image-asset guard**,
  so add no image files.
- **Use realistic data.** Real class names, a plausible 10-hero roster with a
  level-7 founding four and green recruits, real quest names from
  `src/content/generated/quests.ts` / `midQuests.ts`, and the real difficulty
  words (`Routine`, `Measured`, `Dangerous`, `Beyond us`) with reasons phrased
  as "...them".
- **Steven is dyslexic.** Short labels, tables over prose, bold lead-ins, a
  clear "what happens if I press this". No dense paragraphs.
- Show at least once: a band that is **out on a job**, a hero **waiting at the
  hall**, and the **same quest judged differently** by two bands.
- Self-contained HTML (inline `<style>`), no external fetches, no build step.

### Done means

- Three variants + the index, committed on `m4/band-ui-mockups`.
- **You have LOOKED at each one** — load the `verify-html-mockups-offline`
  skill and screenshot them; check nothing overflows at 1440 / 1024, columns
  line up, and no text sits under another element. Report what you saw.
- Do not push, do not merge, do not touch `src/` or `tests/`.
- Report: each variant in one line, which you recommend and **why it reduces
  clicks per week**, the absolute file paths, and anything the sim API cannot
  currently give you that your design wants.
