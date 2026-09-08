-- ============================================================================
-- Brief #21 (SPELL SHAPE) — the content half.
--
-- Adds `spells.target_side`, the EXCEPTION channel for who an area spell hits.
-- Steven's decision 2026-09-02 (§9 Q2): option C's schema with option B's
-- behaviour — the column is nullable and NULL DERIVES from `effect_type`, so
-- every one of the 218 current rows is authored correctly by leaving it empty.
--
--     target_side NULL  ->  derive: healing/buff -> allies, else enemies
--     target_side SET   ->  that value wins ('all' | 'enemies' | 'allies')
--
-- Rationale recorded in the brief: zero authoring cost today, no re-authoring
-- later when an exception is wanted, and it obeys constraints 5 and 7 (derive
-- where possible; never store what you can derive).
--
-- ⚠ NO ROWS ARE AUTHORED HERE, AND THAT IS THE POINT. If you find yourself
-- adding UPDATEs to this file for ordinary spells, the derivation is wrong and
-- should be fixed instead. Author a row only for a DELIBERATE exception — a
-- wild-magic burst that catches everyone, a cursed item property.
--
-- The 20 mis-gated spells (brief #21 §2) need NO content change at all: they
-- were always authored correctly with `aoe_shape` + `aoe_size`. It is the ENGINE
-- that ignored them by inferring shape from `save_type`. Nothing to seed.
--
-- One nullable column; the converter is `SELECT *` and both count gates count
-- ROWS, so no tooling change and no gate change (`spells: 218` stays put).
--
-- Apply:   pnpm db:apply data/seeds/seed_spell_target_side.sql
-- Then:    pnpm convert
-- ============================================================================


-- ── The column ──────────────────────────────────────────────────────────────

ALTER TABLE spells ADD COLUMN target_side TEXT NULL;


-- ── Guard: the derivation must cover every row, and nothing is authored yet ──
--
-- ⚠ RAISE() is trigger-only in SQLite, so the guard inserts into a TEMP table
-- with a NOT NULL column: a mismatch fails the statement, and apply-seed.mjs
-- wraps the file in a transaction, so the ALTER rolls back with it.
--
-- Checks:
--   1. target_side is entirely NULL (the derivation is doing all the work)
--   2. every row has an effect_type the derivation can read, so no row falls
--      through to a silent default
--   3. any value that IS present later must be one of the three legal strings

CREATE TEMP TABLE _side_guard (ok INTEGER NOT NULL);

INSERT INTO _side_guard (ok)
SELECT CASE
  WHEN (SELECT COUNT(*) FROM spells WHERE target_side IS NOT NULL) = 0
   AND (SELECT COUNT(*) FROM spells WHERE effect_type IS NULL OR effect_type = '') = 0
   AND (SELECT COUNT(*) FROM spells
         WHERE target_side IS NOT NULL
           AND target_side NOT IN ('all','enemies','allies')) = 0
  THEN 1
  ELSE NULL          -- NOT NULL violation => statement fails => rolls back
END;

DROP TABLE _side_guard;
