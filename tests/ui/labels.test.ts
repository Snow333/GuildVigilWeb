import { describe, expect, it } from 'vitest';
import { CAUTION_LABELS, PROFILE_LABELS, cautionLabel, profileLabel } from '../../src/ui/labels';
import type { Caution, MissionProfile } from '@sim/dungeon/dispatch';

/**
 * The same shape as the beat interpreter's totality test: a sim id that reaches
 * the screen without a label is a bug the type system alone will not catch once
 * someone widens the union.
 */
const PROFILES: MissionProfile[] = ['fullExplore', 'bossRush', 'mysteryHunt', 'lootRun'];
const CAUTIONS: Caution[] = ['cautious', 'standard', 'bold'];

describe('display labels are total over the sim ids (brief #11)', () => {
  it('every mission profile has a label and a line of consequence', () => {
    for (const p of PROFILES) {
      const l = profileLabel(p);
      expect(l.label, p).toBeTruthy();
      expect(l.blurb, p).toBeTruthy();
      expect(l.label, `${p} must not show its raw id`).not.toBe(p);
    }
    expect(Object.keys(PROFILE_LABELS).sort()).toEqual([...PROFILES].sort());
  });

  it('every caution has a label; the field is NERVE so no value repeats its own label', () => {
    for (const c of CAUTIONS) {
      const l = cautionLabel(c);
      expect(l.label, c).toBeTruthy();
      expect(l.blurb, c).toBeTruthy();
    }
    expect(Object.keys(CAUTION_LABELS).sort()).toEqual([...CAUTIONS].sort());
    // "Caution: cautious" was the old read. The label may keep the word; the
    // FIELD may not — that rename lives in the screen, this pins the value set.
    expect(CAUTION_LABELS.standard.label).not.toBe('standard');
  });

  it('labels are player-facing prose, never camelCase ids', () => {
    for (const l of Object.values(PROFILE_LABELS)) {
      expect(l.label).not.toMatch(/[a-z][A-Z]/);
    }
  });

  it('an unmapped id degrades to itself rather than rendering blank', () => {
    const rogue = 'someFutureProfile' as MissionProfile;
    expect(profileLabel(rogue).label).toBe('someFutureProfile');
    expect(cautionLabel('reckless' as Caution).label).toBe('reckless');
  });
});
