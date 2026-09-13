#!/usr/bin/env node
/**
 * Bundle size gate — specified in the 2026-08-10 migration plan (Part V) and never built.
 *
 * The single-file artifact IS the product: one HTML file the player downloads, with every
 * script, style, font and image inlined as data URIs. Its size is the player's download.
 *
 * WHY THIS EXISTS: brief #24 took the bundle from 1,239.30 kB to 2,377.54 kB — +92% in a
 * single brief — and that was caught by eye, not by a gate. Art and fonts inline, so growth
 * is silent and easy.
 *
 * Thresholds are the migration plan's: warn at 8 MB, fail at 12 MB, uncompressed.
 *
 * Run:  node tools/check-bundle-size.mjs          (after a build)
 *       node tools/check-bundle-size.mjs --json   (machine-readable)
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACT = resolve(ROOT, 'dist/index.html');

// ⚠ Vite reports sizes in 1000-byte kB, and every size written down in this repo
// (CLAUDE.md's "2,377.54 kB", the migration plan's 8/12 MB) uses that convention.
// Use it here too, so the gate's numbers reconcile with the docs instead of reading
// ~2.4% smaller and quietly starting an argument about which figure is right.
const MB = 1000 * 1000;
const WARN_BYTES = 8 * MB;
const FAIL_BYTES = 12 * MB;

const json = process.argv.includes('--json');

if (!existsSync(ARTIFACT)) {
  console.error(`✗ No artifact at dist/index.html — run the build first.`);
  process.exit(1);
}

const bytes = statSync(ARTIFACT).size;
const gzipped = gzipSync(readFileSync(ARTIFACT)).length;

const kb = (n) => `${(n / 1000).toFixed(2)} kB`;
const pct = ((bytes / FAIL_BYTES) * 100).toFixed(1);

const status = bytes >= FAIL_BYTES ? 'fail' : bytes >= WARN_BYTES ? 'warn' : 'ok';

if (json) {
  console.log(JSON.stringify({ status, bytes, gzipped, warnBytes: WARN_BYTES, failBytes: FAIL_BYTES }));
} else {
  console.log(`Bundle: ${kb(bytes)} uncompressed · ${kb(gzipped)} gzipped`);
  console.log(`Gate:   warn ${kb(WARN_BYTES)} · fail ${kb(FAIL_BYTES)} — currently ${pct}% of the fail ceiling`);
}

if (status === 'fail') {
  console.error(`\n✗ FAIL: the artifact is ${kb(bytes)}, over the ${kb(FAIL_BYTES)} ceiling.`);
  console.error(`  This is the player's download. Do not raise the ceiling to make this pass.`);
  console.error(`  Lazy-load src/content/generated/figures.ts before dropping any art.`);
  process.exit(1);
}

if (status === 'warn') {
  console.warn(`\n⚠ WARN: the artifact is ${kb(bytes)}, past the ${kb(WARN_BYTES)} warning line.`);
  console.warn(`  Still passing, but the next art or font addition should be deliberate.`);
}

if (!json && status === 'ok') console.log(`\n✓ OK`);
