# Track M — Town & Upgrades screen: mockup variants for Steven to pick

**Read `output/briefs-m2/_shared.md` first** for the sandbox rules.
**This track writes NO application code.** It produces HTML mockups only.

- **Worktree:** `C:\GuildVigilWeb-townui`  **Branch:** `m3/town-ui-mockups`
- **Milestone:** M3 — "The town grows"

---

## Why this exists

Steven reviews UI as **visual mockups before anything is implemented**, picks a
variant, and names amendments. M3 adds the first genuinely new screen since the
reset, so he needs options in front of him.

## What M3 adds that the screen must carry

The sim side is being built in parallel; design to this contract.

1. **Resources** — a second currency beside gold. Named kinds drawn from what
   the regions actually produce: **timber, iron, stone, grain, furs, fish, clay,
   salt, mithril**. The guild holds a stock of each.
2. **Resource sites** — places on the map a party secures. A secured site pays
   its resource every week. They can presumably be lost or contested.
3. **18 buildings**, each up to level 2 or 3, each upgrade costing **gold +
   resources** and gated behind a prerequisite building/level and sometimes
   reputation. Real examples from the data:
   - Guild Hall L1/2/3 → party size **4 / 5 / 6**
   - Barracks → hero cap 6 / 10 / 15
   - Blacksmith → weapons / armour / masterwork stock
   - Chapel → rest heals 50% / full
   - Tavern → recruit common / uncommon / rare
4. **The payoff must be legible.** 45 of 105 shop rows are currently
   unreachable because they need building level 2–3. "Upgrade this, and these
   become buyable" is the single clearest thing the screen can say.

## Your job

Produce **three labelled variants** of the town/upgrades screen as standalone
HTML files in `output/exploration/`:

- `town-variant-A-<yourname>.html`
- `town-variant-B-<yourname>.html`
- `town-variant-C-<yourname>.html`

Plus `output/exploration/town-variants-index.html` that embeds or links all
three with a one-paragraph rationale each, so Steven can compare them in one go.

Make the three **genuinely different approaches**, not three paint jobs. For
example (you choose): a ledger-style list of all 18 buildings; a map/plan of the
town you click; a "next upgrades worth doing" priority queue with the rest
behind a fold. At least one variant must be honest about **18 buildings being a
lot** — a flat list of 18 × 3 levels can be overwhelming, and solving that is
the real design problem here.

### Hard requirements

- **Match the existing look.** Read `output/art-style-bible.md` and
  `output/reference/ui-and-art.md`, and read `src/ui/screens/TownHub.tsx` plus
  `src/ui/styles/*.css` to reuse the real classes and tokens (`gv-sheet`,
  `gv-ledger`, `gv-head`, `gv-sub`, the paste/tilt treatment). The UI is pure
  CSS + inline SVG with a **zero-image-asset guard** — do not add image files.
- **Use realistic data** from `src/content/generated/buildings.ts` and the region
  `known_resources` — real building names, real costs, real effect strings. Do
  not invent buildings.
- **Steven is dyslexic.** Short labels, tables over prose, no dense paragraphs,
  a clear "what do I get" column. Say what an upgrade *gives the player* in
  plain words, never in effect-string jargon (`rest_heal_50pct` must read as
  "resting heals half your wounds").
- Each variant must show: the resource stocks, at least one affordable upgrade,
  at least one blocked upgrade **with the reason visible**, and the Guild Hall
  party-size ladder.
- Self-contained HTML (inline `<style>`), no external fetches, no build step.

### Done means

- Three variants plus the index, committed on `m3/town-ui-mockups`.
- You have **looked at each one yourself** — open it and check the layout is not
  broken, columns line up, nothing overflows. Report what you saw.
- Do not push, do not merge, do not touch `src/`.
- Report: the three approaches in one line each, which you recommend and why,
  and the absolute paths of the four files.
