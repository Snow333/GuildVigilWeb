-- ============================================================================
-- Brief #15 milestone — the content half.
--
-- Two independent changes, both approved:
--   A. `default_cantrip` — the marker that settles brief #15 §11.2's conflict
--      between "derived from the class spell list" and "Electric Arc".
--   B. Bug B (brief #14 §5) — striking is applied TWICE. Steven's call: the
--      CODE is authoritative, so the extra die comes out of the content rows
--      and `striking_tier` adds it back at derivation.
--
-- Apply:   pnpm db:apply data/seeds/seed_brief15_cantrips_and_striking.sql
-- Then:    pnpm convert
-- ============================================================================


-- ── A. The default-cantrip marker ───────────────────────────────────────────
--
-- Brief #15 §11.2: no simple derivation rule yields Electric Arc + Divine
-- Lance. Best-expected-damage picks Telekinetic Projectile; lowest-id picks
-- Electric Arc + Produce Flame. Only an authored designation gives the approved
-- pair, and §11.1 measured the spell choice as free (Electric Arc is within
-- noise of Telekinetic Projectile everywhere), so designating on flavour costs
-- nothing.
--
-- The derivation SURVIVES: candidates still come from the class spell list, so
-- it stays self-maintaining as content grows. This column only expresses a
-- preference among them, and falls back to best-expected-damage when a list has
-- nothing marked. One nullable column; the converter is `SELECT *`, so no
-- tooling change and no count-gate change (gates count rows, not columns).

ALTER TABLE spells ADD COLUMN default_cantrip INTEGER;

-- Electric Arc (arcane -> Wizard). Note it is the only damage cantrip with a
-- save_type, so it deals half on a successful save rather than missing outright
-- — part of why it measured on par with a d6 cantrip.
UPDATE spells SET default_cantrip = 1 WHERE id = 1;

-- Divine Lance (divine -> Cleric).
UPDATE spells SET default_cantrip = 1 WHERE id = 14;


-- ── B. Striking, de-duplicated ──────────────────────────────────────────────
--
-- Every row below is authored at DOUBLE its base weapon's dice AND carries
-- `striking_tier: 1`, so `deriveItem` -> `applyStriking` adds a third die:
-- Striking Longsword +2 reads `2d8` and fights as `3d8` (13.5 avg against an
-- intended 9.0). Dropping each to its base die makes `striking_tier` mean what
-- it says and the derived value land on the authored intent.
--
-- ⚠ Brief #14 §5 named FIVE rows (145, 146, 147, 166, 168). There are NINE.
-- The four it missed are all high-level enchanted/legendary weapons that no
-- measurement had reached, which is exactly why they went unnoticed. Fixing
-- five and leaving four would leave the bug alive at the top of the ladder.

UPDATE items SET damage_dice = '1d8'  WHERE id = 145; -- Striking Longsword +2   (Longsword 1d8)
UPDATE items SET damage_dice = '1d12' WHERE id = 146; -- Striking Greatsword +2  (Greatsword 1d12)
UPDATE items SET damage_dice = '1d8'  WHERE id = 147; -- Striking Longbow +2     (Longbow 1d8)
UPDATE items SET damage_dice = '1d8'  WHERE id = 166; -- Dreadblade              (longsword-class 1d8)
UPDATE items SET damage_dice = '1d12' WHERE id = 168; -- Lifedrinker Axe         (Greataxe 1d12)
UPDATE items SET damage_dice = '1d8'  WHERE id = 171; -- Stormhammer             (Warhammer 1d8)   [not in brief #14]
UPDATE items SET damage_dice = '1d6'  WHERE id = 177; -- Ashenmere's Spear       (Spear 1d6)       [not in brief #14]
UPDATE items SET damage_dice = '1d8'  WHERE id = 178; -- The Last Edict          (longsword-class 1d8) [not in brief #14]
UPDATE items SET damage_dice = '1d8'  WHERE id = 182; -- Silvertide's Bow        (Longbow 1d8)     [not in brief #14]
