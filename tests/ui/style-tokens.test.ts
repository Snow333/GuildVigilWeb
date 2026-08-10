/**
 * Brief #8 acceptance guards for the style layer (rollout step 1):
 *  1. The FROZEN status set exists in tokens.css with exactly the validated
 *     values — and appears NOWHERE else as raw hex (components must go through
 *     var(--gv-s*), so a themed or drifted status color cannot slip in).
 *  2. Zero image assets in the UI layer: every url() in src/ui/styles is a
 *     data: URI (feTurbulence / inline SVG), never a file reference.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STYLES_DIR = join(process.cwd(), 'src', 'ui', 'styles');
const cssFiles = readdirSync(STYLES_DIR).filter((f) => f.endsWith('.css'));
/** CSS with block comments stripped — guards inspect rules, not prose. */
const read = (f: string) => readFileSync(join(STYLES_DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const FROZEN_STATUS = {
  '--gv-s0': '#0ca30c',
  '--gv-s1': '#fab219',
  '--gv-s2': '#ec835a',
  '--gv-s3': '#d03b3b',
} as const;

describe('the frozen status set (brief #8)', () => {
  it('tokens.css declares all four validated status colors, once each', () => {
    const tokens = read('tokens.css');
    for (const [name, hex] of Object.entries(FROZEN_STATUS)) {
      const decl = new RegExp(`${name}:\\s*${hex};`, 'g');
      expect(tokens.match(decl), `${name} must be declared as ${hex}`).toHaveLength(1);
      expect(tokens.match(new RegExp(hex, 'gi')), `${hex} must appear exactly once`).toHaveLength(1);
    }
  });

  it('status hexes appear in NO other style file — components use var(--gv-s*)', () => {
    for (const file of cssFiles.filter((f) => f !== 'tokens.css')) {
      const css = read(file);
      for (const hex of Object.values(FROZEN_STATUS)) {
        expect(css.toLowerCase(), `${file} must not hardcode ${hex}`).not.toContain(hex);
      }
    }
  });
});

describe('zero image assets in the UI layer (brief #8)', () => {
  it('every url() in src/ui/styles is a data: URI', () => {
    for (const file of cssFiles) {
      const urls = read(file).match(/url\(\s*["']?([^"')]+)/g) ?? [];
      for (const u of urls) {
        // data: is the inline payload; %23 is an SVG-internal fragment ref
        // (url(#filter) URL-encoded inside a data URI) — both are asset-free.
        expect(u, `${file}: ${u.slice(0, 60)}…`).toMatch(/url\(\s*["']?(data:|%23)/);
      }
    }
  });
});
