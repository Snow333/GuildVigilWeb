#!/usr/bin/env node
/**
 * Portrait module generator — brief #10 "Art Integration".
 * Rebuilds src/content/generated/portraits.ts from the ACCEPTED bust originals
 * in art/. The base64 payload is MACHINE-WRITTEN — never hand-edit portraits.ts
 * (same discipline as the rest of src/content/generated and fonts.css).
 *
 * Usage: node tools/build-portraits.mjs   (alias: pnpm portraits)
 *
 * Pipeline per bust:  deterministic square crop → 256px → webp → data URI.
 *
 * ⚠ THE CROP IS THE WHOLE TRICK. The bible §3b specifies 1:1 bust generations;
 * the generator does not honor it. Batch 1 came back 1024x1536, 1122x1402 (x2),
 * and 1402x1122 — three portrait, one LANDSCAPE, none square, none consistent
 * with each other. So this tool must never assume aspect. It center-crops
 * horizontally and crops vertically with a TOP BIAS: heads sit high in a bust,
 * so a true center crop shaves the crown while leaving dead chest at the
 * bottom. One constant, applied to every file, no per-file tuning — a hand-
 * tuned crop table would fork the art the way retouching forks the style.
 * (Landscape inputs have no vertical slack, so the bias is a no-op there and
 * the horizontal centering does the work.)
 *
 * Re-run after dropping new accepted art in art/ — that IS the art-swap
 * procedure. A contracted artist replacing every hero portrait is a file drop
 * and one command; no integration code changes.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const artRoot = join(repoRoot, 'art');
const outPath = join(repoRoot, 'src', 'content', 'generated', 'portraits.ts');
const sheetPath = join(repoRoot, 'output', 'exploration', 'portrait-contact-sheet.html');

/** Subject classes, in the bible's art-staging order. Empty folders are fine. */
const CLASSES = ['heroes', 'npcs', 'enemies'];

/** Output edge in px — the largest the UI ever paints a paste (hero sheet, 150px @2x). */
const EDGE = 256;
/** webp quality: visually lossless at this size, ~20 KiB a bust. */
const QUALITY = 82;
/**
 * Vertical crop anchor, 0 = flush top, 0.5 = true center. 0.25 keeps headroom
 * above the crown while trimming the chest — validated against all four
 * batch-1 busts (portrait AND landscape) via the contact sheet.
 */
const TOP_BIAS = 0.25;

/** `hero-halforc-f-bust-01.png` → { key: 'hero-halforc-f', variant: 1 } */
function parseBust(cls, file) {
  const m = /^(.+)-bust-(\d+)\.png$/.exec(file);
  if (!m) return null;
  const subject = m[1];
  const singular = { heroes: 'hero', npcs: 'npc', enemies: 'enemy' }[cls];
  // Files already carry their class prefix (bible §4 naming); trust it, and
  // fail loudly rather than silently keying art under the wrong class.
  if (!subject.startsWith(`${singular}-`)) {
    throw new Error(`[build-portraits] ${cls}/${file}: expected a "${singular}-" prefix per bible §4 naming`);
  }
  return { key: subject, variant: Number(m[2]) };
}

/** Highest variant wins — append-only naming means the newest accepted bust is the live one. */
function collectBusts() {
  const best = new Map();
  for (const cls of CLASSES) {
    const dir = join(artRoot, cls);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).sort()) {
      const parsed = parseBust(cls, file);
      if (!parsed) continue;
      const prev = best.get(parsed.key);
      if (!prev || parsed.variant > prev.variant) {
        best.set(parsed.key, { ...parsed, path: join(dir, file), file });
      }
    }
  }
  return [...best.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** The deterministic square window. Pure math on (width, height) — testable by eye on the contact sheet. */
export function cropRect(width, height) {
  const side = Math.min(width, height);
  return {
    left: Math.round((width - side) / 2),
    top: Math.round((height - side) * TOP_BIAS),
    width: side,
    height: side,
  };
}

async function build() {
  const busts = collectBusts();
  if (busts.length === 0) {
    console.warn('[build-portraits] no *-bust-*.png under art/ — writing an empty module (silhouette everywhere)');
  }

  const rows = [];
  for (const bust of busts) {
    const image = sharp(bust.path);
    const { width, height } = await image.metadata();
    const rect = cropRect(width, height);
    const buf = await image
      .extract(rect)
      .resize(EDGE, EDGE, { fit: 'fill' })
      .webp({ quality: QUALITY })
      .toBuffer();
    rows.push({ ...bust, width, height, rect, kib: buf.length / 1024, uri: `data:image/webp;base64,${buf.toString('base64')}` });
    console.log(
      `[build-portraits] ${bust.key.padEnd(20)} ${String(width).padStart(4)}x${String(height).padEnd(4)}` +
      ` → crop ${rect.width}² @ (${rect.left},${rect.top}) → ${EDGE}² webp ${buf.length > 0 ? (buf.length / 1024).toFixed(1) : '0'} KiB`,
    );
  }

  const total = rows.reduce((s, r) => s + r.kib, 0);
  const module = `// GENERATED by tools/build-portraits.mjs from art/**/*-bust-*.png — DO NOT EDIT BY HAND.
// Regenerate: pnpm portraits
// Source busts are the repo-side identity record (art/); only these ${EDGE}px webp
// crops ever ship. Keys are \`{class}-{subject}\` — see heroes/ancestry portraitKey().
export const portraits: Readonly<Record<string, string>> = Object.freeze({
${rows.map((r) => `  // ${r.file} — ${r.width}x${r.height} → ${r.kib.toFixed(1)} KiB\n  '${r.key}':\n    '${r.uri}',`).join('\n')}
});

/** Subjects with accepted art, for tooling and coverage checks. */
export const PORTRAIT_KEYS: readonly string[] = Object.freeze([
${rows.map((r) => `  '${r.key}',`).join('\n')}
]);
`;
  writeFileSync(outPath, module);

  // The contact sheet exists so crop quality is a fast VISUAL loop, not a
  // guessing game — every crop, at paint size and full size, on the slate.
  mkdirSync(dirname(sheetPath), { recursive: true });
  writeFileSync(sheetPath, contactSheet(rows, total));

  console.log(`[build-portraits] wrote ${outPath} (${rows.length} busts, ${total.toFixed(1)} KiB of payload)`);
  console.log(`[build-portraits] wrote ${sheetPath}`);
}

function contactSheet(rows, total) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Guild Vigil — portrait contact sheet</title>
<style>
 body{margin:0;padding:28px 34px 60px;background:#2a211c;color:#ece0c2;font:14px/1.5 Georgia,serif}
 h1{font-size:19px;letter-spacing:.12em;margin:0 0 4px}
 p.note{color:#a89370;font-style:italic;margin:0 0 24px;font-size:13px}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:26px}
 figure{margin:0;background:#332a22;border:1px solid #55401c;border-radius:3px;padding:12px}
 img.full{display:block;width:100%;background:#2e3138;border:1px solid #6e5426}
 .chips{display:flex;gap:10px;align-items:flex-end;margin-top:10px}
 .chips img{background:#2e3138;border:1px solid #6e5426;display:block}
 figcaption{margin-top:9px;font-size:12px;color:#c9a86a}
 figcaption b{color:#ece0c2;font-size:13px}
 figcaption span{color:#a89370}
</style></head><body>
<h1>PORTRAIT CONTACT SHEET</h1>
<p class="note">Every accepted bust after the deterministic top-biased square crop (bias ${TOP_BIAS}) and ${EDGE}px resize —
${rows.length} subjects, ${total.toFixed(1)} KiB total payload. Check: crown has headroom, chin is not clipped, the face reads at chip size (52px).</p>
<div class="grid">
${rows.map((r) => `<figure>
  <img class="full" src="${r.uri}" alt="${r.key}">
  <div class="chips"><img src="${r.uri}" width="150" height="150" alt=""><img src="${r.uri}" width="52" height="52" alt=""></div>
  <figcaption><b>${r.key}</b><br><span>${r.file} · ${r.width}×${r.height} → crop ${r.rect.width}² at (${r.rect.left},${r.rect.top}) · ${r.kib.toFixed(1)} KiB</span></figcaption>
</figure>`).join('\n')}
</div>
</body></html>
`;
}

await build();
