/**
 * Track P guards: scrolling must stay cheap in Edge.
 *
 * The real measurement lives in tools/perf-scroll.mjs (frame times in a browser).
 * These tests pin the two causes it found, so a later style edit cannot bring the
 * lag back unseen:
 *  1. Nothing may use `background-attachment: fixed` (full repaint on every scroll).
 *  2. The hover lift on sheets must switch off while the page scrolls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { installScrollQuiet } from '../../src/ui/styles/scrollQuiet';

const STYLES_DIR = join(process.cwd(), 'src', 'ui', 'styles');
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('style layer: no scroll-hostile paint', () => {
  it('no stylesheet uses a fixed background', () => {
    for (const f of readdirSync(STYLES_DIR).filter((n) => n.endsWith('.css'))) {
      const css = stripComments(readFileSync(join(STYLES_DIR, f), 'utf8'));
      expect(css, `${f} must not use background-attachment: fixed`).not.toMatch(/background-attachment\s*:\s*fixed/);
    }
  });

  it('the desk leather is a fixed layer of its own, so it is painted once', () => {
    const css = stripComments(readFileSync(join(STYLES_DIR, 'materials.css'), 'utf8'));
    const layer = css.match(/\.gv-desk::before\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(layer).toMatch(/position:\s*fixed/);
    expect(layer).toMatch(/will-change:\s*transform/);
    expect(layer).toContain('var(--gv-tex-leather)');
  });

  it('a scrolling page holds sheets at rest (no hover lift)', () => {
    const css = stripComments(readFileSync(join(STYLES_DIR, 'materials.css'), 'utf8'));
    const rule = css.match(/body\.gv-scrolling\s+\.gv-sheet:hover\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain('box-shadow: var(--gv-shadow-sheet)');
    expect(rule).toMatch(/transition:\s*none/);
    expect(rule).toContain('rotate(var(--gv-tilt, 0deg))');
  });
});

describe('installScrollQuiet', () => {
  type Handler = () => void;
  let handlers: Handler[];
  let classes: Set<string>;
  const target = {
    addEventListener: (_t: string, h: Handler) => { handlers.push(h); },
    removeEventListener: (_t: string, h: Handler) => { handlers = handlers.filter((x) => x !== h); },
  } as unknown as Window;
  const body = {
    classList: {
      add: (c: string) => { classes.add(c); },
      remove: (c: string) => { classes.delete(c); },
    },
  } as unknown as HTMLElement;

  beforeEach(() => { vi.useFakeTimers(); handlers = []; classes = new Set(); });
  afterEach(() => { vi.useRealTimers(); });

  it('marks the body while scrolling and clears it shortly after the last scroll', () => {
    installScrollQuiet(target, body);
    expect(classes.has('gv-scrolling')).toBe(false);

    handlers[0]!();
    expect(classes.has('gv-scrolling')).toBe(true);

    vi.advanceTimersByTime(100);
    handlers[0]!(); // still scrolling: the idle timer restarts
    vi.advanceTimersByTime(100);
    expect(classes.has('gv-scrolling')).toBe(true);

    vi.advanceTimersByTime(100);
    expect(classes.has('gv-scrolling')).toBe(false);
  });

  it('the disposer removes the listener and the class', () => {
    const dispose = installScrollQuiet(target, body);
    handlers[0]!();
    dispose();
    expect(handlers).toHaveLength(0);
    expect(classes.has('gv-scrolling')).toBe(false);
    vi.advanceTimersByTime(500); // a stale timer must not fire into a disposed listener
    expect(classes.has('gv-scrolling')).toBe(false);
  });
});
