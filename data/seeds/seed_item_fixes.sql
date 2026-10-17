-- ============================================================================
-- SEED: item fixes — the Raise Dead scroll, and weapon prices (track I2, M2)
--
-- ── 1. SCROLL OF RAISE DEAD (item #53) ──────────────────────────────────────
-- Steven found it casting Scorching Ray. The row pointed at spell 46 (a
-- copy-paste of #79). Auditing every scroll by parsing the tables found this
-- to be the ONLY remaining name/spell mismatch: 51 of 52 resolve to the spell
-- they are named for.
--
-- ⚠ POINTING IT AT THE REAL RAISE DEAD (spell 106) WOULD ONLY MOVE THE LIE.
-- Spell 106 is `healing` with NO dice and `effects {"resurrect":true}`. Nothing
-- in the sim reads `resurrect`: `resolveCast` rolls the (empty) dice, heals 0,
-- and the scroll is spent. Measured through a real runEncounter: a Cleric
-- reading it at a dying ally spends the scroll and the ally stays dying.
-- (There is also no permanent-death state for it to undo: combat deaths never
-- set `HeroStatus 'dead'`.) Making it work needs combat/** and session.ts,
-- which this track may not touch.
--
-- DECISION: repoint #53 at spell 110, Breath of Life, and rename it. That
-- spell is `healing` 4d8, and a heal on a dying hero wakes them (healDying) —
-- the nearest working thing to "bring the fallen back", and the scroll keeps
-- its price, level and loot tier. Item ids are append-only, so the row is
-- re-purposed rather than dropped.
--
-- ── 2. WEAPON PRICES ────────────────────────────────────────────────────────
-- Magic weapons were priced as base price × a multiplier, so a Dagger +2 cost
-- 16g and a Longsword +2 cost 120g, and the Staff cost 0g. In PF2E the rune
-- is the value; the stick it is carved into barely matters.
--
-- THE RULE:   price = plain base price of the same weapon  +  rune prices
--
--   masterwork            + 25                 (a flat fee, not a rune)
--   potency rune   +1 100 · +2 250 · +3 600 · +4 1500
--   striking rune  1: 120 · 2: 300 · 3: 700
--   property rune  +200 each  (rolled loot only; named items keep their price)
--
-- Every tier is worth the same on any weapon. Within one weapon the order is
-- plain < masterwork < +1 < +2 < +3 (< striking). Even across weapons a
-- masterwork (<= 55g) is below every +1 (>= 102g), and every +1 is below every
-- +2 (>= 252g).
--
-- Gold-curve check (tests/items/scrollsAndPrices.test.ts pins it): a party's
-- unspent gold when its WEAKEST hero first reaches level L, worst of 12
-- seeded careers, is 650g at L2 · 4,116 at L4 · 11,636 at L6 · 18,383 at L8
-- · 21,993 at L9. The dearest weapon at its item_level (Greatsword +3, 630g
-- at L9) is under 3% of that; no weapon costs over 10% of it.
--
-- SCOPE: the 16 masterwork and 17 generic `+N` weapon rows, plus the Staff.
-- Named enchanted / legendary weapons keep their authored price — they are
-- already well above the generic rune price for their potency (a test pins
-- that). Armour, shields and wondrous items are NOT repriced here.
--
-- The same constants live in src/sim/heroes/equipment.ts (rolled loot uses
-- them); tests/items/scrollsAndPrices.test.ts fails if the two ever drift.
--
-- This seed changes COLUMN VALUES ONLY — no new rows — so neither count gate
-- moves.
--
-- Apply: pnpm db:apply data/seeds/seed_item_fixes.sql && pnpm convert
-- ============================================================================

-- 1. The scroll ---------------------------------------------------------------
UPDATE items
   SET name = 'Scroll of Breath of Life',
       spell_id = 110,
       description = 'A scroll containing Breath of Life.'
 WHERE id = 53;

-- 2. Weapon prices ------------------------------------------------------------
-- 2a. The Staff is not free. 2g, the same as a Dagger, so it still sells for 1g
--     (the shop pays half, rounded down: a 1g Staff would sell for 0g). Runs
--     FIRST: the masterwork Staff below is priced off this.
UPDATE items SET price = 2 WHERE id = 16;

-- 2b. Masterwork = plain base of the same weapon + 25.
UPDATE items
   SET price = (SELECT b.price FROM items b
                 WHERE b.item_type = 'weapon' AND b.quality_tier = 'mundane'
                   AND b.item_subtype = items.item_subtype) + 25
 WHERE item_type = 'weapon' AND quality_tier = 'masterwork';

-- 2c. Generic +N weapons = plain base + potency rune + striking rune.
UPDATE items
   SET price = (SELECT b.price FROM items b
                 WHERE b.item_type = 'weapon' AND b.quality_tier = 'mundane'
                   AND b.item_subtype = items.item_subtype)
             + CASE potency_bonus WHEN 1 THEN 100 WHEN 2 THEN 250 WHEN 3 THEN 600 WHEN 4 THEN 1500 ELSE 0 END
             + CASE striking_tier WHEN 1 THEN 120 WHEN 2 THEN 300 WHEN 3 THEN 700 ELSE 0 END
 WHERE item_type = 'weapon' AND quality_tier = 'magical';
