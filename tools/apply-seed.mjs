#!/usr/bin/env node
/**
 * Seed applier — runs a content seed SQL file against data/game_data.db inside
 * a transaction (all-or-nothing). The seed files are the REVIEWABLE authoring
 * artifact (decision-ledger Area 6: never retype content); the db is derived
 * output we also commit, like src/content/generated.
 *
 * Usage: node tools/apply-seed.mjs <seed.sql> [path-to-game_data.db]
 */
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const seedPath = process.argv[2];
if (!seedPath) {
  console.error('Usage: node tools/apply-seed.mjs <seed.sql> [path-to-game_data.db]');
  process.exit(1);
}
const dbPath = process.argv[3] ?? join(repoRoot, 'data', 'game_data.db');

const sql = readFileSync(seedPath, 'utf8');
const db = new Database(dbPath);
db.exec('BEGIN');
try {
  db.exec(sql);
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  console.error(`Seed FAILED (rolled back): ${e.message}`);
  process.exit(1);
}
console.log(`Applied ${seedPath} to ${dbPath}`);
