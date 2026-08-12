import { describe, expect, it } from 'vitest';
import { groupXpByHero, type XpAward } from '../../src/ui/screens/afterActionXp';

const award = (heroId: string, heroName: string, amount: number, source: string): XpAward =>
  ({ heroId, heroName, amount, source });

/** What a four-hero party that fights AND completes actually emits: eight awards. */
const fourHeroRun: XpAward[] = [
  award('hero_1', 'Torvald', 25, 'combat'),
  award('hero_2', 'Shade', 25, 'combat'),
  award('hero_3', 'Mira', 25, 'combat'),
  award('hero_4', 'Elandra', 25, 'combat'),
  award('hero_1', 'Torvald', 23, 'quest'),
  award('hero_2', 'Shade', 23, 'quest'),
  award('hero_3', 'Mira', 23, 'quest'),
  award('hero_4', 'Elandra', 23, 'quest'),
];

describe('after-action XP consolidation (brief #11)', () => {
  it('EIGHT AWARDS FOR FOUR HEROES BECOME FOUR ROWS', () => {
    const s = groupXpByHero(fourHeroRun);
    expect(s.rows).toHaveLength(4);
    expect(s.rows.map((r) => r.heroName)).toEqual(['Torvald', 'Shade', 'Mira', 'Elandra']);
  });

  it('source becomes a column, and the total is shown rather than implied', () => {
    const s = groupXpByHero(fourHeroRun);
    expect(s.sources).toEqual(['combat', 'quest']);
    for (const row of s.rows) {
      expect(row.bySource['combat']).toBe(25);
      expect(row.bySource['quest']).toBe(23);
      expect(row.total).toBe(48);
    }
    expect(s.partyBySource).toEqual({ combat: 100, quest: 92 });
    expect(s.partyTotal).toBe(192);
  });

  it('accumulates repeats within one source (several fights, one dispatch)', () => {
    const s = groupXpByHero([
      award('hero_1', 'Torvald', 10, 'combat'),
      award('hero_1', 'Torvald', 15, 'combat'),
      award('hero_1', 'Torvald', 23, 'quest'),
    ]);
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]!.bySource['combat']).toBe(25);
    expect(s.rows[0]!.total).toBe(48);
  });

  it('a hero who earned from only one source shows a gap, not a zero', () => {
    const s = groupXpByHero([
      award('hero_1', 'Torvald', 25, 'combat'),
      award('hero_2', 'Shade', 23, 'quest'),
    ]);
    expect(s.rows[0]!.bySource['quest']).toBeUndefined();
    expect(s.rows[1]!.bySource['combat']).toBeUndefined();
    expect(s.partyTotal).toBe(48);
  });

  it('COLUMNS COME FROM THE DATA: a future XP source appears instead of vanishing', () => {
    // The report must never hardcode ['combat','quest'] — the event vocabulary
    // is append-only, and a silently dropped column is a lying report.
    const s = groupXpByHero([...fourHeroRun, award('hero_1', 'Torvald', 5, 'deed')]);
    expect(s.sources).toEqual(['combat', 'quest', 'deed']);
    expect(s.rows[0]!.total).toBe(53);
    expect(s.partyTotal).toBe(197);
  });

  it('rows and columns hold first-seen order, so the report is stable', () => {
    const s = groupXpByHero([
      award('hero_4', 'Elandra', 1, 'quest'),
      award('hero_1', 'Torvald', 1, 'combat'),
    ]);
    expect(s.rows.map((r) => r.heroId)).toEqual(['hero_4', 'hero_1']);
    expect(s.sources).toEqual(['quest', 'combat']);
  });

  it('an empty run summarises to nothing, so the screen keeps its empty state', () => {
    const s = groupXpByHero([]);
    expect(s.rows).toHaveLength(0);
    expect(s.sources).toHaveLength(0);
    expect(s.partyTotal).toBe(0);
  });
});
