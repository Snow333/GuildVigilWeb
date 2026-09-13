#!/usr/bin/env node
/**
 * Figure module generator — the paperdoll's body (brief #24 sheet work).
 *
 * Companion to build-portraits.mjs. Same discipline, different crop: a BUST is
 * a 1:1 head-and-shoulders paste for the roster; a FIGURE is the full standing
 * body the character sheet hangs equipment slots around.
 *
 * Usage: node tools/build-figures.mjs   (alias: pnpm figures)
 *
 * ⚠ NO GENERATION HAPPENED HERE, AND THAT IS THE POINT. Four accepted
 * full-body renders were already sitting in art/ as `*-02.png`, produced in the
 * same batch and the same style as the busts, and NOTHING in the codebase read
 * them — `parseBust` only matches `-bust-NN`, so they were skipped in silence.
 * They are renamed to `-figure-NN` (bible §4 naming) and consumed here. Before
 * commissioning art, check what the repo already owns.
 *
 * ── WHY THE CROP DIFFERS FROM THE BUST PIPELINE ──────────────────────────
 *
 * build-portraits center-crops to a SQUARE with a top bias, because a bust is
 * a face. A figure must keep the whole body — crown to feet — so this tool
 * does NOT crop at all. It only trims uniform background margin, then fits the
 * result into a fixed portrait box. Cropping a figure would cut off the boots,
 * which are a slot.
 *
 * ⚠ THE OUTPUT IS TRANSPARENT, not dark-backgrounded. The source renders sit on
 * a near-black field; the character sheet is cream parchment, so a rectangular
 * dark plate would look pasted on. The background is keyed out by luminance and
 * the figure composited onto transparency, letting the paperdoll's slot boxes
 * sit against paper.
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const artRoot = join(repoRoot, 'art');
const outPath = join(repoRoot, 'src', 'content', 'generated', 'figures.ts');

const CLASSES = ['heroes', 'npcs', 'enemies'];

/**
 * Output box. Tall portrait aspect: the paperdoll column is ~300px wide in the
 * sheet layout and the figure is the tallest thing in it. 2x for retina.
 */
const BOX_W = 600;
const BOX_H = 900;
/** webp quality — a figure carries more area than a bust, so trim a little. */
const QUALITY = 78;

/**
 * The background colour, sampled from the render's own corner, and how far a
 * pixel may sit from it before it counts as figure.
 *
 * ⚠ A LUMINANCE THRESHOLD WAS THE WRONG TOOL AND I SHIPPED IT ONCE. Keying on
 * "darker than X" deleted every DARK PART OF THE FIGURE too — the half-orc's
 * black hair, his shadowed hands and feet were punched clean through, because
 * dark hair and a dark background have the same luminance. Verified by
 * compositing onto parchment and looking at it.
 *
 * Keying on COLOUR DISTANCE from the actual background instead separates them:
 * the field is a desaturated blue-grey (#232833-ish), while the figure's dark
 * regions carry hue — green skin, warm brown hair. Same luminance, different
 * colour, so distance tells them apart where brightness cannot.
 */
const BG_TOLERANCE = 26;
/** Distance above which a pixel is fully opaque; between the two it ramps. */
const BG_FEATHER = 22;

/** `hero-human-m-figure-01.png` → { key: 'hero-human-m', variant: 1 } */
function parseFigure(cls, file) {
  const m = /^(.+)-figure-(\d+)\.png$/.exec(file);
  if (!m) return null;
  const subject = m[1];
  const singular = { heroes: 'hero', npcs: 'npc', enemies: 'enemy' }[cls];
  if (!subject.startsWith(`${singular}-`)) {
    throw new Error(`[build-figures] ${cls}/${file}: expected a "${singular}-" prefix per bible §4 naming`);
  }
  return { key: subject, variant: Number(m[2]) };
}

/** Highest variant wins — append-only naming, newest accepted figure is live. */
function collectFigures() {
  const best = new Map();
  for (const cls of CLASSES) {
    const dir = join(artRoot, cls);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).sort()) {
      const parsed = parseFigure(cls, file);
      if (!parsed) continue;
      const prev = best.get(parsed.key);
      if (!prev || parsed.variant > prev.variant) {
        best.set(parsed.key, { ...parsed, path: join(dir, file), file });
      }
    }
  }
  return [...best.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Key the field out to alpha by FLOOD FILL from the image border.
 *
 * ⚠ TWO EARLIER APPROACHES FAILED, AND THE MEASUREMENT EXPLAINS WHY.
 *
 *   1. Luminance threshold — deleted every dark part of the FIGURE too. The
 *      half-orc's hair, hands and feet were punched through, because dark hair
 *      and a dark field share a brightness.
 *   2. Colour distance from the sampled background — better, but probing the
 *      hair region measured a MINIMUM DISTANCE OF 0.0: the darkest hair pixels
 *      are *literally the background colour*. No per-pixel rule can separate
 *      them, because they are not different. Both attempts left white holes
 *      where hair should be.
 *
 * The distinguishing fact is not colour, it is CONNECTIVITY: the field touches
 * the border and the figure does not. A flood fill from the edges removes
 * everything reachable without crossing the figure's silhouette, and leaves
 * enclosed dark regions — hair, shadowed hands — completely intact.
 *
 * The vignette that made a naive flood stop early is handled by a generous
 * in-fill tolerance plus a soft alpha ramp on the boundary pixels.
 */
async function keyBackground(image) {
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const s = (4 * width + 4) * channels;
  const bg = [data[s], data[s + 1], data[s + 2]];

  const dist = (o) => Math.sqrt(
    (data[o] - bg[0]) ** 2 + (data[o + 1] - bg[1]) ** 2 + (data[o + 2] - bg[2]) ** 2,
  );

  // Flood from every border pixel inward. Iterative stack, not recursion —
  // a 1024x1536 field would blow the call stack.
  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + width - 1);
  }

  while (stack.length > 0) {
    const i = stack.pop();
    if (seen[i]) continue;
    const o = i * channels;
    if (dist(o) > BG_TOLERANCE + BG_FEATHER) continue; // hit the figure
    seen[i] = 1;

    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - width);
    if (y < height - 1) stack.push(i + width);
  }

  for (let i = 0; i < width * height; i++) {
    if (!seen[i]) continue;
    const o = i * channels;
    const d = dist(o);
    // Inside the field proper: fully transparent. On the vignette boundary:
    // ramp, so the cut-out has no hard edge against parchment.
    data[o + 3] = d <= BG_TOLERANCE
      ? 0
      : Math.round(((d - BG_TOLERANCE) / BG_FEATHER) * data[o + 3]);
  }

  /**
   * ⚠ SECOND PASS: ENCLOSED POCKETS OF FIELD.
   *
   * The flood only reaches background CONNECTED to the border. Where the
   * silhouette encloses a scrap of field — the gap between the human's jaw and
   * her shoulder, the triangle inside a bent elbow — it survives as a dark
   * patch floating on parchment. Observed exactly there.
   *
   * Those pockets are safe to clear by colour alone, because this pass only
   * considers pixels that are BOTH within the tight background tolerance and
   * part of a small unreached region. A large unreached region would be the
   * figure itself, so the area cap is what keeps hair safe.
   */
  const MAX_POCKET = Math.round(width * height * 0.004); // 0.4% of the canvas
  const visited = new Uint8Array(width * height);
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || visited[start]) continue;
    if (dist(start * channels) > BG_TOLERANCE) continue;

    // Collect this connected pocket of background-coloured pixels.
    const pocket = [];
    const queue = [start];
    visited[start] = 1;
    let touchesBorder = false;

    while (queue.length > 0 && pocket.length <= MAX_POCKET) {
      const i = queue.pop();
      pocket.push(i);
      const x = i % width;
      const y = (i - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;

      for (const n of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]) {
        if (n < 0 || visited[n] || seen[n]) continue;
        if (dist(n * channels) > BG_TOLERANCE) continue;
        visited[n] = 1;
        queue.push(n);
      }
    }

    if (pocket.length <= MAX_POCKET && !touchesBorder) {
      for (const i of pocket) data[i * channels + 3] = 0;
    }
  }

  return sharp(data, { raw: { width, height, channels } });
}

async function build() {
  const figures = collectFigures();
  if (figures.length === 0) {
    console.warn('[build-figures] no *-figure-*.png under art/ — writing an empty module');
  }

  const rows = [];
  for (const fig of figures) {
    const src = sharp(fig.path);
    const { width, height } = await src.metadata();

    const keyed = await keyBackground(sharp(fig.path));
    const buf = await keyed
      .png() // intermediate: trim needs a real alpha channel
      .toBuffer()
      .then((b) => sharp(b)
        .trim({ threshold: 1 }) // drop the now-transparent margin
        .resize(BOX_W, BOX_H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: QUALITY, alphaQuality: 90 })
        .toBuffer());

    rows.push({ ...fig, width, height, kib: buf.length / 1024, uri: `data:image/webp;base64,${buf.toString('base64')}` });
    console.log(
      `[build-figures] ${fig.key.padEnd(20)} ${String(width).padStart(4)}x${String(height).padEnd(4)}` +
      ` → keyed → ${BOX_W}x${BOX_H} webp ${(buf.length / 1024).toFixed(1)} KiB`,
    );
  }

  const total = rows.reduce((s, r) => s + r.kib, 0);
  const body = rows.map((r) => `  // ${r.file} — ${r.width}x${r.height} source, ${r.kib.toFixed(1)} KiB\n  '${r.key}': '${r.uri}',`).join('\n');

  const module = `// GENERATED by tools/build-figures.mjs from art/**/*-figure-*.png — DO NOT EDIT BY HAND.
// Regenerate: pnpm figures
// Full-body standing figures for the character sheet paperdoll. Backgrounds are
// keyed to transparency so they composite onto parchment. Keys match portraits.ts.
export const figures: Readonly<Record<string, string>> = Object.freeze({
${body}
});

/** Does this subject have an accepted figure? Callers fall back to a silhouette. */
export function hasFigure(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(figures, key);
}
`;
  writeFileSync(outPath, module, 'utf8');
  console.log(`[build-figures] wrote ${rows.length} figure(s), ${total.toFixed(1)} KiB total → ${outPath}`);
}

build().catch((err) => {
  console.error('[build-figures]', err);
  process.exit(1);
});
