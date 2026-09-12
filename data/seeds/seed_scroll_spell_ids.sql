-- ============================================================================
-- SEED: scroll spell_id repair (brief #23 M4)
--
-- Six scroll rows point at the WRONG spell. Not missing — wrong: every target
-- spell exists, the ids were simply assigned before the spells table settled
-- and were never re-pointed. Invisible in play because nothing reads scrolls
-- yet; it would have surfaced the moment they became usable.
--
--   #47 Scroll of Magic Missile    -> 11  Chill Touch
--   #48 Scroll of Heal             -> 13  Message
--   #49 Scroll of Fireball         -> 31  Harm
--   #50 Scroll of Lightning Bolt   -> 32  Ray of Enfeeblement
--   #51 Scroll of Haste            -> 33  (NO SUCH SPELL — dangling id)
--   #52 Scroll of Invisibility     -> 22  Mage Armor
--
-- CORROBORATION, not guesswork: each scroll's authored price and item_level
-- already match the level of the spell its NAME claims —
--   spell L1 -> ilvl 1, 25g   ·   L2 -> ilvl 3, 60g   ·   L3 -> ilvl 5, 150g
-- The names and the economy were always right; only the pointer was wrong.
--
-- Scrolls #64-#108 were authored later and are ALL correct, which is why this
-- rot stayed contained to the original batch.
--
-- ⚠ #53 Scroll of Raise Dead is DELIBERATELY NOT FIXED (brief #23 D3). No
-- Raise Dead spell exists in the game, item ids are append-only so the row
-- cannot be dropped, and Steven's call is to leave it pointing at a
-- valid-but-wrong spell and flag it for the content pass.
-- tests/content/validators.test.ts carries it as a one-row allow-list citing
-- this decision — if you are here to "fix the failing scroll test", read that
-- allow-list first; weakening it is the wrong move.
--
-- This seed changes COLUMN VALUES ONLY — no new rows — so neither count gate
-- moves (CLAUDE.md, Data discipline).
--
-- Apply: pnpm db:apply data/seeds/seed_scroll_spell_ids.sql && pnpm convert
-- ============================================================================

UPDATE items SET spell_id = 16 WHERE id = 47;  -- Magic Missile   (L1 damage, arcane/occult)
UPDATE items SET spell_id = 18 WHERE id = 48;  -- Heal            (L1 healing, divine)
UPDATE items SET spell_id = 63 WHERE id = 49;  -- Fireball        (L3 damage, arcane)
UPDATE items SET spell_id = 64 WHERE id = 50;  -- Lightning Bolt  (L3 damage, arcane)
UPDATE items SET spell_id = 65 WHERE id = 51;  -- Haste           (L3 buff, arcane/occult)
UPDATE items SET spell_id = 42 WHERE id = 52;  -- Invisibility    (L2 buff, arcane/occult)
