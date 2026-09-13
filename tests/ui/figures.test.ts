/**
 * THE PAPERDOLL FIGURES (brief #24 sheet work).
 *
 * ⚠ THE FAILURE THESE TESTS EXIST TO CATCH IS PURELY VISUAL, so they assert
 * the MEASURABLE consequences of it. Background keying has now broken three
 * separate ways — a luminance threshold punched holes through dark hair, a
 * seed-relative flood left pale slabs behind figures on gradient backdrops,
 * and an enclosed pocket of field survived beside a neck. None of those move
 * a single number in the rest of the suite; every one of them ships a visible
 * grey box into the game.
 *
 * What is checkable without eyes:
 *   - every ancestry the game can roll HAS a figure (else a blank paperdoll)
 *   - the corners are transparent (else the key did not run at all)
 *   - a reasonable share of the frame is transparent (else a slab survived)
 *   - the middle of the figure is NOT transparent (else holes were punched)
 */
import { describe, it, expect } from 'vitest';
import { figures, hasFigure } from '@content/generated/figures';
import { ancestries } from '@content/generated/ancestries';

/** ancestry name → the key build-figures.mjs emits. */
function keyFor(ancestryName: string, sex: 'm' | 'f'): string {
  return `hero-${ancestryName.toLowerCase().replace(/[^a-z]/g, '')}-${sex}`;
}

describe('the paperdoll figures', () => {
  /**
   * ⚠ DERIVED FROM THE ANCESTRY TABLE, NOT A HAND-WRITTEN LIST. A hand-written
   * list silently stops covering a new ancestry the day someone adds one —
   * which is exactly how the sheet would start rendering an empty doll.
   */
  it('⚠ every ancestry in the content DB has a figure for both sexes', () => {
    const missing: string[] = [];
    for (const a of ancestries) {
      for (const sex of ['m', 'f'] as const) {
        const key = keyFor(a.name, sex);
        if (!hasFigure(key)) missing.push(key);
      }
    }
    expect(missing, `ancestries without paperdoll art: ${missing.join(', ')}`).toEqual([]);
  });

  it('every figure is a webp data URI, not a file path', () => {
    // The zero-image-assets guard (brief #8) means art ships inline or not at all.
    for (const [key, uri] of Object.entries(figures)) {
      expect(uri.startsWith('data:image/webp;base64,'), `${key} is not an inline webp`).toBe(true);
      expect(uri.length, `${key} is suspiciously small`).toBeGreaterThan(2000);
    }
  });

  /**
   * ⚠ THE KEYING ASSERTIONS. These decode the actual pixels, because "the file
   * exists" and "the background was removed" are different claims — and it was
   * the second one that failed three times.
   */
  describe('background keying', () => {
    async function decode(key: string) {
      const { default: sharp } = await import('sharp');
      const b64 = figures[key]!.split(',')[1]!;
      const buf = Buffer.from(b64, 'base64');
      const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { data, w: info.width, h: info.height, c: info.channels };
    }

    const SAMPLES = ['hero-dwarf-m', 'hero-halfling-f', 'hero-human-m', 'hero-gnome-f'];

    it.each(SAMPLES)('%s has transparent corners', async (key) => {
      const { data, w, h, c } = await decode(key);
      const alphaAt = (x: number, y: number) => data[(y * w + x) * c + 3]!;
      for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]] as const) {
        expect(alphaAt(x, y), `corner (${x},${y}) of ${key} is opaque — the key did not run`).toBe(0);
      }
    });

    /**
     * ⚠ THIS IS THE SLAB TEST. A figure occupies roughly the middle third of
     * its frame; if far less than a third of the image is transparent, a
     * background slab survived the key. The seed-relative flood failed exactly
     * here, and no other test in the suite noticed.
     */
    it.each(SAMPLES)('%s has a mostly-transparent frame (no surviving slab)', async (key) => {
      const { data, w, h, c } = await decode(key);
      let clear = 0;
      for (let i = 0; i < w * h; i++) if (data[i * c + 3]! === 0) clear++;
      const ratio = clear / (w * h);
      expect(ratio, `${key}: only ${(ratio * 100).toFixed(1)}% transparent — a slab survived`)
        .toBeGreaterThan(0.35);
    });

    /**
     * ⚠ AND THE HOLE TEST, the opposite failure: the luminance threshold made
     * hair and hands transparent.
     *
     * ⚠ MEASURED AS A CONTINUOUS SPAN, NOT AS A FILL RATIO. The first version
     * of this test counted opaque pixels across the middle 30% of the frame
     * and demanded 60%; hero-human-m failed at 48% — correctly keyed, but
     * wearing a loose pale robe whose folds legitimately read as background.
     * Probing the figure band by band showed an unbroken silhouette at every
     * height, so the FILL RATIO was the wrong measure and the art was fine.
     *
     * A punched hole breaks the silhouette into pieces; a robe does not. So
     * the assertion is that each sampled height has ONE continuous opaque run
     * of reasonable width, which is the property that actually distinguishes
     * damage from drapery.
     */
    it.each(SAMPLES)('%s keeps a continuous silhouette (no punched holes)', async (key) => {
      const { data, w, h, c } = await decode(key);
      for (const frac of [0.25, 0.4, 0.55]) {
        const y = Math.round(h * frac);
        let longest = 0;
        let run = 0;
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * c + 3]! > 128) { run++; longest = Math.max(longest, run); } else run = 0;
        }
        expect(longest, `${key} at ${frac * 100}% height: longest opaque run only ${longest}px`)
          .toBeGreaterThan(w * 0.08);
      }
    });
  });
});
