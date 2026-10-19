# Track T — The Town & Upgrades screen (M3)

**Read `output/briefs-m2/_shared.md` first** for the sandbox rules.

- **Worktree:** `C:\GuildVigilWeb-townscreen`  **Branch:** `m3/town-screen`
- **Playwright port:** `GV_PORT=4184` (never 4173 — a shared port tests the WRONG build)
- **Milestone:** M3 — "The town grows"

---

## The job

Build the real Town & Upgrades screen. **Steven has chosen variant B** —
`output/exploration/town-variant-B-claude.html`, the "Do This Next" layout.
Open it with the `verify-html-mockups-offline` skill and build to it.

Keep A's full-ledger table (`town-variant-A-claude.html`) as a **"Show all 18"
fold** under B's picks. Do not build C's prerequisite map.

## The sim API already exists — do NOT change it, and do NOT re-derive it

All of this is on `CampaignSession` and is tested in `tests/campaign/town.test.ts`.
Read via `session.x()`, mutate via `exec((s) => s.x())`, exactly like
`src/ui/screens/ShopScreen.tsx` does.

| Call | Gives you |
|---|---|
| `session.town()` | `BuildingView[]` — all 18: `id, name, level, maxLevel, current, next{level,cost{gold,resources},effect}, blocked[]` |
| `session.resourceStock()` | `Record<ResourceKind, number>` — all 9 kinds |
| `session.weeklyIncome()` | same shape — what secured sites pay per week |
| `session.reputationTotal()` | number |
| `session.goldAmount()` | number |
| `session.resourceSites()` | sites with `regionName, kind, yield, level, pos, secured` |
| `session.recruitPool()` | `{ classId, className, tier, cost }[]` |
| `session.maxPartySize()` / `session.rosterSize()` | the guild-hall ladder |
| `exec(s => s.upgradeBuilding(id))` | buys the next level; THROWS if blocked |
| `exec(s => s.recruitHero(classId, name))` | hires; THROWS if illegal |

`blocked[]` entries are `{ kind: 'maxed'|'gold'|'resources'|'prerequisite'|'reputation', text }`
and **`text` is already a finished player-facing sentence** — render it verbatim,
do not rebuild it from the parts.

### Two rules that are not negotiable

1. **`next.effect` carries `{ text, wired }`. If `wired === false`, the row MUST
   say it does not work yet** (grey it, tag it "not working yet", your call on
   styling) and must NOT read as a promise. 22 of 43 building effects are
   authored but not implemented; charging the player for one while implying it
   works is the single worst thing this screen could do. There is a test
   pinning which effects are wired — read `EFFECT_COPY` in `src/content/town.ts`.
2. **Never print a raw effect string.** `rest_heal_50pct` must never reach the
   DOM. `next.effect.text` is the plain-English version; use it.

## The ranking rule for B's three picks

The mockup hand-picked its top 3. Implement this rule instead, and put it in a
**pure exported function with its own unit test** (not inline in the component):

```
candidates = buildings where next !== null AND blocked is empty
             AND next.effect?.wired === true      // never recommend a dead effect
rank by:  next.cost.gold ascending, then total resource units ascending, then id
take 3
```

If fewer than 3 qualify, show what there is and fill the gap with a short line
explaining why (e.g. "nothing else is affordable this week") — do NOT pad the
list with blocked or unwired rows.

## Files you own

- `src/ui/screens/TownScreen.tsx` (new), plus any `src/ui/screens/town*.ts` helpers
- `src/ui/styles/*.css` — additive only; reuse existing tokens/classes
  (`gv-sheet`, `gv-head`, `gv-sub`, `gv-ledger`, `gv-plate`, `gv-btn`, `gv-chip`)
- `src/ui/state/GameProvider.tsx` — add `| { kind: 'townUpgrades' }` to `Screen`
- `src/ui/App.tsx` — one `case 'townUpgrades':` in `Router`
- `src/ui/screens/TownHub.tsx` — one button into the new screen
- `tests/ui/townScreen.test.ts`, `e2e/town.spec.ts`

⚠ **DO NOT TOUCH `src/sim/**`, `src/content/town.ts`, or
`tests/campaign/town.test.ts`** — a parallel track owns those and is adding
site-securing missions. If you think the sim API is wrong, write it in your
report; do not edit it.

## Done means

- The screen shows: all 9 resource stocks **with weekly income**, gold,
  reputation, roster vs `maxPartySize`, the three ranked picks, the folded
  "Show all 18" ledger, every blocked row with its reason visible, the Guild
  Hall 4/5/6 ladder, and the Tavern recruit pool when it is non-empty.
- Upgrading and recruiting work from the screen and the numbers update.
- `lastError` from a refused action is surfaced (see how other screens do it).
- **Unit tests** for the ranking function (including the <3-candidates case and
  that an unwired effect is never recommended).
- **e2e** on `GV_PORT=4184`: navigate to the screen, buy an upgrade, assert the
  stock went down and the level went up.
- `npx tsc -p tsconfig.json --noEmit`, `npx eslint src tests tools e2e --max-warnings 0`,
  `node node_modules/vitest/vitest.mjs run`, `node node_modules/vite/bin/vite.js build`
  all clean.
- **You have looked at the real screen yourself** (the
  `verify-html-mockups-offline` skill, or a Playwright screenshot of the running
  build) and checked the layout is not broken. Tests passed once while a tab had
  grown to 5,700px of greyed rows — screenshots are not optional.
- Committed on `m3/town-screen`, staged **by explicit path** (never `git add -A`).
  Do not push, do not merge.

## Report back

The ranking rule's behaviour on a fresh campaign (which 3 it picks and why),
anything in the sim API that fought you, and the screenshot paths.
