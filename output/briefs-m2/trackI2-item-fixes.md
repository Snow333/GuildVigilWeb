# Track I2 — Item fixes: the Raise Dead scroll and the odd prices

**Read `output/briefs-m2/_shared.md` first.** It has the sandbox rules, commands and "done means".

- **Worktree:** `C:\GuildVigilWeb-itemfix`  **Branch:** `m2/item-fixes`  **e2e port:** `4182`
- **Milestone:** M2 content to-do (from Steven's playtest of the M2 feedback round)

---

## Two bugs Steven hit in play

### 1. Scroll of Raise Dead casts the wrong spell

Measured, already confirmed — build on this, do not re-derive:

- Item `53` "Scroll of Raise Dead" has `spell_id 46`, which is **Scorching Ray**.
- The real `Raise Dead` is spell **106** (spell_level 5). `Breath of Life` is 110.
- Item `79` "Scroll of Scorching Ray" correctly has `spell_id 46`, so 53 is a
  straight copy-paste error in the data.

**Check every other scroll the same way** — parse the item and spell tables with a
script and assert each `Scroll of X` resolves to a spell actually named `X`. Do not
eyeball the list. Report every mismatch you find, not just this one.

Then ask the question that matters: **does Raise Dead actually do anything in the
sim?** This codebase's recurring defect is inert content (see `CLAUDE.md` and the
`guild-vigil` skill: eight systems shipped inert). If spell 106 has no working
effect, pointing the scroll at it only moves the lie. In that case either make it
work (a dead hero returns at 1 hp after the fight is the obvious reading) or point
the scroll at a spell that works and rename it. **Decide, build it, report which.**

### 2. Prices are nonsense on magic weapons, and one item is free

Measured:

| Item | Price |
|---|---|
| `Staff` (id 16) | **0 gold** — the only free item in the table |
| `Masterwork Dagger` | 6 |
| `Dagger +2` (id 132) | **16** |
| `Masterwork Longsword` | 45 |
| `Longsword +1` (id 17) | 100 |
| `Longsword +2` (id 133) | 120 |
| `Greatsword +2` | 240 |
| `Spear +2` | 24 |

The `+N` rows are priced as *base weapon price × a multiplier*, so a +2 dagger
(16g) costs a third of a masterwork longsword (45g) and a +2 spear costs less
than a +1 anything. In PF2E the potency rune is the value; the stick it is
carved into barely matters.

**Your call to make:** a coherent price rule where the magic matters more than the
base weapon. Something like `base weapon price + a flat potency/striking rune
price per tier` is the obvious shape, but you decide the numbers. Constraints:

- Prices must be **monotone**: +3 > +2 > +1 > masterwork > plain, for the same weapon.
- A rune tier must be worth roughly the same on any weapon.
- The shop must stay affordable on the actual gold curve — check what a party has
  banked by the level each item unlocks (`item_level`) before pricing it. A sanity
  simulation beats a spreadsheet guess.
- `Staff` must not be free.

Fix the **data**, not a display hack: author a new seed under `data/seeds/`
(follow `data/seeds/seed_scroll_spell_ids.sql` for the pattern), apply it with
`pnpm db:apply`, regenerate with `pnpm convert`, and commit the regenerated
`src/content/generated/items.ts`.

### Files you own

- `data/seeds/*.sql` (new seeds)
- `data/game_data.db`
- `src/content/generated/items.ts` and `spells.ts` (regenerated, never hand-edited)
- `src/sim/heroes/equipment.ts`
- `src/sim/loot/generate.ts`
- `src/ui/components/ItemTooltip.tsx`, `src/ui/screens/ShopScreen.tsx`
- `tests/items/**`, `tests/loot/**`

Do NOT touch: `src/sim/combat/**`, `src/sim/campaign/session.ts`,
`src/content/earlyQuests.ts`, `src/content/midQuests.ts`. Other tracks own those.
`pnpm convert` rewrites all of `src/content/generated/` — **stage only the
generated files you actually changed** (`git status` will show the rest unchanged;
if quests.ts or feats.ts show a diff, something is wrong — report it).

### Done means

- The four gate commands green (`GV_PORT=4182` for e2e).
- A test that parses the item table and asserts **every** scroll resolves to its
  named spell, plus a test asserting price monotonicity across potency tiers.
  Run the negative control on both (break the data, confirm red, restore).
- A screenshot of the Shop screen that you have looked at yourself.
- Committed on `m2/item-fixes`. Do not push, do not merge.
- Report: every scroll mismatch found, the price rule you chose and why, whether
  Raise Dead works in the sim, and the gold-curve check behind your prices.
