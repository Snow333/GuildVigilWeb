/**
 * After-action XP consolidation (brief #11) — pure, so the report's one piece of
 * real logic is unit-testable without rendering a component.
 *
 * The stream awards XP per SOURCE, so a four-hero party that fights and completes
 * emits eight `hero.xp_awarded` events. The report used to print one row each,
 * showing every hero twice, portrait and all. Group by hero; make source a column.
 *
 * Columns are built from the sources actually PRESENT, never a hardcoded
 * ['combat','quest'] — if the vocabulary ever gains a third source, it appears
 * instead of silently vanishing from the report.
 */

export interface XpAward {
  heroId: string;
  heroName: string;
  amount: number;
  source: string;
}

export interface XpHeroRow {
  heroId: string;
  heroName: string;
  /** Amount per source id; absent means none from that source. */
  bySource: Record<string, number>;
  total: number;
}

export interface XpSummary {
  /** Source ids in first-seen order — the column order. */
  sources: string[];
  rows: XpHeroRow[];
  /** Column totals plus the party grand total. */
  partyBySource: Record<string, number>;
  partyTotal: number;
}

/** Awards in stream order → one row per hero, in first-seen order. */
export function groupXpByHero(awards: readonly XpAward[]): XpSummary {
  const sources: string[] = [];
  const rows: XpHeroRow[] = [];
  const byHero = new Map<string, XpHeroRow>();
  const partyBySource: Record<string, number> = {};
  let partyTotal = 0;

  for (const a of awards) {
    if (!sources.includes(a.source)) sources.push(a.source);

    let row = byHero.get(a.heroId);
    if (!row) {
      row = { heroId: a.heroId, heroName: a.heroName, bySource: {}, total: 0 };
      byHero.set(a.heroId, row);
      rows.push(row);
    }
    row.bySource[a.source] = (row.bySource[a.source] ?? 0) + a.amount;
    row.total += a.amount;

    partyBySource[a.source] = (partyBySource[a.source] ?? 0) + a.amount;
    partyTotal += a.amount;
  }

  return { sources, rows, partyBySource, partyTotal };
}
