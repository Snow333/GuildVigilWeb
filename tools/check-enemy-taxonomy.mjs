#!/usr/bin/env node
/**
 * THE COMPOSITION GATE (brief #27 M1, rewritten per #30).
 *
 * Makes inert enemy content fail the build. The Vanguard batch — 21 rows with
 * an empty `abilities` string, 3 distinguishing only by accident — is the
 * argument for this file existing: that was not a decision, it was an accident
 * no check caught.
 *
 * ⚠ IT READS THE DECLARED `classification` COLUMN AND NEVER INFERS ONE.
 * Two honest readings of the same 45 rows put fodder at 80.0% and at 28.9% —
 * 51.1 points apart (brief #30 §2). A gate whose verdict depends on its own
 * classifier's opinion is not reporting a fact. Fodder is a legitimate authored
 * choice; leaving the column blank is not.
 *
 * Usage: node tools/check-enemy-taxonomy.mjs
 * Exits 1 on any violation, naming every offending row.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const gen = join(repoRoot, 'src', 'content', 'generated');

/** Read a generated `export const X = [...] as const;` table. */
function table(name) {
  const src = readFileSync(join(gen, `${name}.ts`), 'utf8');
  const start = src.indexOf('[');
  const end = src.lastIndexOf(']');
  if (start < 0 || end < 0) throw new Error(`${name}.ts: no array literal found`);
  return JSON.parse(src.slice(start, end + 1));
}

const enemies = table('enemies');
const races = table('enemy_races');
const classes = table('enemy_classes');

const CLASSIFICATIONS = ['Fodder', 'Melee', 'Ranged', 'Magic'];
const FODDER_MIN_PCT = 40;
const FODDER_MAX_PCT = 50;

const racesById = new Map(races.map((r) => [r.id, r]));
const classesById = new Map(classes.map((c) => [c.id, c]));

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);

// ── Rule 1: every row declares a valid classification ──────────────────────
for (const e of enemies) {
  if (!e.classification || !CLASSIFICATIONS.includes(e.classification)) {
    fail(`#${e.id} ${e.name}: classification is '${e.classification ?? '(blank)'}' — must be one of ${CLASSIFICATIONS.join('/')}`);
  }
}

// ── Rule 2: every row declares a real race; class is null or real ──────────
for (const e of enemies) {
  if (e.race_id === null || e.race_id === undefined) {
    fail(`#${e.id} ${e.name}: no race_id. Every enemy is something.`);
  } else if (!racesById.has(e.race_id)) {
    fail(`#${e.id} ${e.name}: race_id ${e.race_id} does not exist`);
  }
  if (e.class_id !== null && e.class_id !== undefined && !classesById.has(e.class_id)) {
    fail(`#${e.id} ${e.name}: class_id ${e.class_id} does not exist`);
  }
}

// ── Rule 3: classification agrees with the class ───────────────────────────
//
// The column is independent BY DESIGN (see the header), so this cross-check is
// real work rather than a tautology: it catches a row that says Fodder while
// carrying a Melee class, which would make the composition figure a lie.
for (const e of enemies) {
  const cls = e.class_id === null || e.class_id === undefined ? null : classesById.get(e.class_id);
  if (cls === null) {
    if (e.classification !== 'Fodder') {
      fail(`#${e.id} ${e.name}: declares '${e.classification}' but has no class. Only Fodder may be classless.`);
    }
  } else if (cls && e.classification !== cls.classification) {
    fail(`#${e.id} ${e.name}: declares '${e.classification}' but its class ${cls.name} is '${cls.classification}'`);
  }
}

// ── Rule 4: the composition target — Fodder 40-50% ─────────────────────────
const counts = Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0]));
for (const e of enemies) {
  if (counts[e.classification] !== undefined) counts[e.classification]++;
}
const total = enemies.length;
const fodderPct = (counts.Fodder / total) * 100;
if (fodderPct < FODDER_MIN_PCT || fodderPct > FODDER_MAX_PCT) {
  fail(
    `composition: Fodder is ${fodderPct.toFixed(1)}% of ${total} rows — target is ${FODDER_MIN_PCT}-${FODDER_MAX_PCT}%. ` +
    (fodderPct > FODDER_MAX_PCT
      ? 'Too many rows do nothing mechanically; give some a class.'
      : 'Too few plain rows; the pool needs mooks to mow down.'),
  );
}

// ── Rule 5: no race names a vocabulary word the engine cannot read ─────────
//
// Parsed out of enemyAbilities.ts rather than duplicated here — a second copy
// of the vocabulary would rot the first time someone added a word.
const abilitySrc = readFileSync(join(repoRoot, 'src', 'sim', 'combat', 'enemyAbilities.ts'), 'utf8');
const liveVocab = new Set();
for (const m of abilitySrc.matchAll(/^\s{2}(\w+):\s*\{$/gm)) liveVocab.add(m[1]);
for (const block of ['FIELD_ABILITIES', 'DEFERRED_ABILITIES']) {
  const i = abilitySrc.indexOf(`const ${block}`);
  if (i < 0) continue;
  const chunk = abilitySrc.slice(i, abilitySrc.indexOf(']);', i));
  for (const m of chunk.matchAll(/'([a-z0-9_]+)'/g)) liveVocab.add(m[1]);
}
if (liveVocab.size === 0) {
  fail('vocabulary parse found ZERO words — the parser broke, not the content.');
}
for (const r of races) {
  let words;
  try {
    words = JSON.parse(r.intrinsic_abilities || '[]');
  } catch {
    fail(`race ${r.name}: intrinsic_abilities is not valid JSON`);
    continue;
  }
  for (const w of words) {
    if (!liveVocab.has(w)) fail(`race ${r.name}: '${w}' is not a vocabulary word any engine code reads`);
  }
}

// ── Rule 6: no inert race or class ─────────────────────────────────────────
const usedRaces = new Set(enemies.map((e) => e.race_id));
const usedClasses = new Set(enemies.map((e) => e.class_id).filter((c) => c !== null && c !== undefined));
for (const r of races) {
  if (!usedRaces.has(r.id)) fail(`race ${r.name} is authored but no row uses it — inert content`);
}
for (const c of classes) {
  if (!usedClasses.has(c.id)) fail(`class ${c.name} is authored but no row uses it — inert content`);
}

// ── Rule 7: every class ends in a strike ───────────────────────────────────
for (const c of classes) {
  let entries;
  try {
    entries = JSON.parse(c.loadout || '[]');
  } catch {
    fail(`class ${c.name}: loadout is not valid JSON`);
    continue;
  }
  if (entries.length === 0) {
    fail(`class ${c.name}: empty loadout — it would behave identically to Fodder`);
  } else if (entries[entries.length - 1].action !== 'strike') {
    fail(`class ${c.name}: loadout must end in a plain strike, or the unit can stall`);
  }
}

// ── Advisory: Ranged is thin, and it is worth saying so out loud ───────────
if (counts.Ranged === 0) {
  warnings.push('no Ranged rows exist — the player never meets an enemy that attacks from range.');
} else {
  const reachable = enemies.filter((e) => e.classification === 'Ranged' && e.base_level <= 6).length;
  if (reachable === 0) {
    warnings.push(
      `all ${counts.Ranged} Ranged rows are above level 6, so no player at d1-d5 can meet one. ` +
      'Ranged is authored but unreachable.',
    );
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
const pct = (k) => ((k / total) * 100).toFixed(1);
console.log(`Enemy taxonomy — ${total} rows, ${races.length} races, ${classes.length} classes`);
for (const c of CLASSIFICATIONS) console.log(`  ${c.padEnd(7)} ${String(counts[c]).padStart(3)}  ${pct(counts[c]).padStart(5)}%`);

for (const w of warnings) console.log(`\n  ADVISORY: ${w}`);

if (errors.length > 0) {
  console.error(`\nTAXONOMY GATE FAILED — ${errors.length} violation(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log('\nTaxonomy gate passed.');
