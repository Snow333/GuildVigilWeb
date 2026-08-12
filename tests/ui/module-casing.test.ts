import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * TWO MODULES MAY NEVER DIFFER ONLY BY CASE.
 *
 * This repo is written on Windows and its automated runs happen on Linux, so
 * the two filesystems disagree about what a module specifier means. Import
 * paths drop the extension, which makes `./combatField` and `./CombatField` the
 * SAME path on a case-insensitive filesystem.
 *
 * It bit us in brief #12: `CombatField.tsx` (the component) shipped alongside
 * `combatField.ts` (its pure half). Every test, the typecheck, the lint and the
 * whole Playwright suite passed on Linux, and the dev server rendered a blank
 * white page on Windows — `./CombatField` resolved to the helper, so the screen
 * imported a component that was not there. The helper is now `fieldReading.ts`.
 *
 * The house convention already avoided this everywhere else (`worldChart.ts`
 * beside `WorldMapScreen.tsx`, `afterActionXp.ts` beside `AfterActionScreen.tsx`)
 * — this test makes the convention enforceable rather than remembered.
 */

const SRC = join(process.cwd(), 'src');

function modules(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) modules(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** The path an import specifier addresses: no extension, lowercased. */
const specifierKey = (file: string): string =>
  relative(SRC, file).replace(/\.tsx?$/, '').replace(/\\/g, '/').toLowerCase();

describe('module specifiers are unambiguous on a case-insensitive filesystem', () => {
  it('no two modules under src/ share a path that differs only by case', () => {
    const byKey = new Map<string, string[]>();
    for (const file of modules(SRC)) {
      const key = specifierKey(file);
      byKey.set(key, [...(byKey.get(key) ?? []), relative(SRC, file).replace(/\\/g, '/')]);
    }

    const collisions = [...byKey.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([key, files]) => `${key} → ${files.join(' <-> ')}`);

    expect(collisions, [
      'These modules resolve to the SAME specifier on Windows and to different',
      'ones on Linux. Rename one so it has its own stem — the helper beside a',
      'screen is named for what it computes (worldChart.ts, afterActionXp.ts),',
      'never for the component with different capitalisation.',
    ].join('\n')).toEqual([]);
  });

  it('the scan actually walks the tree (a guard that guards nothing is worse than none)', () => {
    const found = modules(SRC);
    expect(found.length).toBeGreaterThan(50);
    expect(found.some((f) => f.endsWith('fieldReading.ts'))).toBe(true);
    expect(found.some((f) => f.endsWith('CombatField.tsx'))).toBe(true);
  });

  it('would catch the exact collision that shipped', () => {
    // The bug, in miniature: same stem, different case, different extension.
    const key = (f: string) => f.replace(/\.tsx?$/, '').toLowerCase();
    expect(key('CombatField.tsx')).toBe(key('combatField.ts'));
    expect(key('CombatField.tsx')).not.toBe(key('fieldReading.ts'));
  });
});
