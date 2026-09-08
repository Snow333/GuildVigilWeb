-- ============================================================================
-- Brief #20 (CREATURE SIZE) — the content half.
--
-- Adds `enemies.size` and authors the rows that are not Medium. The RADIUS is
-- NOT stored: it derives in `buildEnemy` from a map in src/content/combat.ts,
-- so the tuning knob (convention B, and S2's doubling) lives beside ARENA with
-- the other translation knobs and the content stays a statement about the
-- creature. Brief #20 §5.
--
-- Convention B is MEASURED, not assumed — see output/briefs/
-- creature-size-findings.md §2: Medium-only fights hash bit-identical to
-- main under B and differ under A.
--
-- One nullable-with-default column; the converter is `SELECT *` and both count
-- gates count ROWS, so no tooling change and no gate change (`enemies: 45`
-- stays put).
--
-- Apply:   pnpm db:apply data/seeds/seed_creature_size.sql
-- Then:    pnpm convert
-- ============================================================================


-- ── The column ──────────────────────────────────────────────────────────────
--
-- TEXT, not a radius. PF2E puts Small AND Medium in one 5-ft square, so no
-- `small` value is authored (brief #20 §5, Steven's decision 2026-09-02): one
-- less value that means nothing mechanically. Only 'large' and 'huge' move
-- anything.

ALTER TABLE enemies ADD COLUMN size TEXT NOT NULL DEFAULT 'medium';


-- ── The 8 non-Medium rows ───────────────────────────────────────────────────
--
-- Seven Large, one Huge — PF2E bestiary sizes, and exactly the set the costing
-- probe hardcoded (arena-costing.md §1).
--
-- ⚠ Only SIX of these can spawn at d1-d5 (levelBand is 1, so a d-difficulty
-- combat room draws [d-1, d+1]). Hill Giant Chief (L8) and Adult Red Dragon
-- (L12) are unreachable until d7+/d11+ content exists, which means HUGE IS
-- UNMEASURED by any probe including the costing's. Findings §6. The first d6+
-- balance pass must re-measure size rather than inherit the "free" finding.

UPDATE enemies SET size = 'large' WHERE id = 8;    -- Giant Spider       L3
UPDATE enemies SET size = 'large' WHERE id = 14;   -- Minotaur           L5
UPDATE enemies SET size = 'large' WHERE id = 16;   -- Ogre               L5
UPDATE enemies SET size = 'large' WHERE id = 17;   -- Troll              L6
UPDATE enemies SET size = 'large' WHERE id = 22;   -- Hill Giant Chief   L8  (unreachable <d7)
UPDATE enemies SET size = 'huge'  WHERE id = 24;   -- Adult Red Dragon   L12 (unreachable <d11)
UPDATE enemies SET size = 'large' WHERE id = 102;  -- Warg               L2
UPDATE enemies SET size = 'large' WHERE id = 111;  -- Warg Alpha         L5

-- Dragon Wyrmling (id 20, L7) — Steven's decision 2026-09-02 (§12 Q5): Large.
-- A red dragon wyrmling is Large in PF2E, and it is the only `dragon`-type row
-- that was left Medium. Zero measured risk today because L7 cannot spawn at
-- d1-d5; it is, however, the row that will make Large/Huge exposure real first
-- when d6+ content lands.
UPDATE enemies SET size = 'large' WHERE id = 20;   -- Dragon Wyrmling    L7


-- ── Guard: the authored set is exactly what the brief says ──────────────────
--
-- ⚠ RAISE() is trigger-only in SQLite, so the guard is a CHECK-style trick:
-- select from a subquery that violates a NOT NULL if the counts are wrong.
-- A mismatch aborts the statement, and apply-seed.mjs wraps the whole file in
-- a transaction, so the ALTER and the UPDATEs roll back together.

CREATE TEMP TABLE _size_guard (ok INTEGER NOT NULL);

INSERT INTO _size_guard (ok)
SELECT CASE
  WHEN (SELECT COUNT(*) FROM enemies WHERE size = 'large') = 8
   AND (SELECT COUNT(*) FROM enemies WHERE size = 'huge')  = 1
   AND (SELECT COUNT(*) FROM enemies WHERE size NOT IN ('medium','large','huge')) = 0
  THEN 1
  ELSE NULL          -- NOT NULL violation => statement fails => transaction rolls back
END;

DROP TABLE _size_guard;
