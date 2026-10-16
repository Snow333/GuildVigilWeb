# Track I: itemization pass, what items actually do and say

**Worktree:** `C:\GuildVigilWeb-items`, branch `m2-items`. **GV_PORT=4182.**
Read `C:/GuildVigilWeb/output/briefs-m2/_shared.md` first.

## What Steven saw
On the hero's Worn panel: **"Magical Cloak of Resistance +1 — +1 to every strike"**, **"Enchanted
Keen Unholy Shortsword +2 — +2 to every strike"**, and **"Leather Armor — +2"** with no label.
"It looks like every magic item is just adding +1 to every strike. Let's do a high-level pass to get
itemization somewhat accurate with player-facing expectations/information."

## What I already found (verify, don't trust)
- `src/sim/heroes/equipment.ts` `deriveItem`: `attackBonus: potency` for **every** item type, so a
  cloak or ring rolled at "magical" tier gets potency 1 → the card says "+1 to every strike".
  `assembly.ts` only reads `attackBonus` from the weapon, so the cloak's claim is probably a lie
  (no real strike bonus). Cloak of Resistance's real effect is `stat_bonus` saves (aliased in
  `aggregateStatBonuses`).
- `src/sim/heroes/attribution.ts` `itemContributions` builds the card text; `SheetTab.tsx` renders it.
- Weapon riders ("Keen", "Unholy") come from item properties; some are live, some inert.

## Build (PF2E as the player expects it, simplified)
| Item kind | Should do | Card should say |
|---|---|---|
| Weapon +N | +N to hit with THIS weapon; striking adds dice | "+2 to hit · 2d6 piercing" + each rider in plain words ("Keen: crits on 19–20") |
| Armour / shield +N | AC = base + N; Dex cap; check penalty | "AC +3 (Dex max +2)" |
| Cloak of Resistance +N | +N to all saves | "+1 to all saves" |
| Rings, amulets, belts, boots, head | their authored stat_bonus / effect | the stat in words ("+2 Strength") |
| Anything the engine cannot do yet | nothing | shown greyed: "not working yet" — never a false claim |

1. Fix the routing so potency only means attack on weapons and AC on armour/shields. Decide what
   "magical"/"enchanted" tier means on accessories (e.g. scales their authored bonus, or a
   resistance-style save bonus) — pick the simplest rule that reads right, and log it.
2. Every number on an item card must be **proven to reach the combatant**: a test assembles a hero
   with and without the item (`assembleHero` in `src/sim/campaign/assembly.ts`) and checks the
   claimed change (attack, AC, saves, damage dice, stat). Cover one item of every slot.
3. Item names: tier word + properties + base + "+N" should not double up or contradict the card.
4. Shop and loot screens show the same plain card text (find where items are described in
   `ShopScreen.tsx` and the stash/pouch; reuse one describer).
5. Quick sanity scan of prices vs power (a +1 item should not cost less than its mundane base;
   tiers go up in price). Report anomalies; fix only clear bugs.

## Files you own
`src/sim/heroes/equipment.ts`, `src/sim/heroes/attribution.ts`, `src/sim/loot/**` (if needed),
`src/ui/screens/SheetTab.tsx` (item cards/paperdoll/stash), `src/ui/screens/ShopScreen.tsx`, new tests
under `tests/heroes/` or `tests/items/`, new `e2e/items.spec.ts`. `src/sim/campaign/assembly.ts` only if
routing truly needs it (keep it minimal; another track is not editing it). `session.ts`: avoid; if you
must, add one small query method at the end of the class.
Other tracks edit HeroPanel/knownSpells/levelUp/campaign.ts, QuestBoard/TownHub/world.ts, styles/*.css.

## Tests
- Per slot: claimed effect == measured combatant change (and a cloak gives NO strike bonus).
- Negative control: re-route accessory potency to attack, confirm the cloak test fails, restore.
- Harness/career snapshots may shift if real numbers change. Explain the diff in one line before re-baselining.
- e2e: open a hero sheet with a magic cloak and weapon (dev panel / shop) and assert the card text.
