#!/usr/bin/env node
/**
 * pnpm notes — collect in-game playtest notes (gv-note-*.json) from the
 * Downloads folder into output/playtest/inbox/, then append a readable line per
 * note to output/playtest/inbox/INDEX.md. Moves the files, so a note is never
 * collected twice. Usage: node tools/collect-notes.mjs [downloadsDir]
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, copyFileSync, unlinkSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const downloads = process.argv[2] ?? join(homedir(), 'Downloads');
const inbox = join(repo, 'output', 'playtest', 'inbox');
const index = join(inbox, 'INDEX.md');

if (!existsSync(downloads)) {
  console.error(`Downloads folder not found: ${downloads}`);
  process.exit(1);
}
mkdirSync(inbox, { recursive: true });
if (!existsSync(index)) {
  appendFileSync(index, '# Playtest note inbox\n\nCollected by `pnpm notes`. Hermes triages these into the milestone playtest file.\n\n| File | When | Screen | Week | Note |\n|---|---|---|---|---|\n');
}

const files = readdirSync(downloads).filter((f) => /^gv-note-.*\.json$/.test(f)).sort();
let collected = 0;
for (const f of files) {
  const src = join(downloads, f);
  let note;
  try {
    note = JSON.parse(readFileSync(src, 'utf8'));
  } catch {
    console.warn(`skip (not valid JSON): ${f}`);
    continue;
  }
  if (note.kind !== 'guild-vigil-playtest-note') continue;
  const dest = join(inbox, f);
  try {
    renameSync(src, dest);
  } catch {
    copyFileSync(src, dest); // cross-device move
    unlinkSync(src);
  }
  const oneLine = String(note.note ?? '').replace(/\s+/g, ' ').replace(/\|/g, '/').slice(0, 200);
  appendFileSync(index, `| ${f} | ${note.createdAt ?? ''} | ${note.screen?.kind ?? ''} | ${note.week ?? ''} | ${oneLine} |\n`);
  collected++;
}
console.log(`Collected ${collected} note(s) into ${inbox}`);
