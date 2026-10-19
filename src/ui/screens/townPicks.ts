/**
 * Town & Upgrades — the pure half (M3 track T).
 *
 * Everything the screen DECIDES lives here, not in the component, so it can be
 * unit-tested without React: which three upgrades to recommend, which shelf a
 * building sits on, what an upgrade leaves in the stores, and what to say when
 * fewer than three qualify.
 *
 * ⚠ NOTHING HERE RE-DERIVES A SIM RULE. Costs, blockers and effect copy all
 * arrive on `BuildingView` from `session.town()`. This file only sorts, groups
 * and subtracts what the sim already said.
 */

import type { BuildingView, UpgradeCost } from '@sim/campaign/town';
import { RESOURCE_KINDS, type ResourceKind, type ResourceStock } from '@content/town';

export const MAX_PICKS = 3;

/** A building with an upgrade that is on offer (`next` is not null). */
export type Upgradable = BuildingView & { next: NonNullable<BuildingView['next']> };

export interface Pick {
  /** 1-based place in the ranking. */
  rank: number;
  building: Upgradable;
}

/** Total resource units a bill asks for — the second tie-break of the ranking. */
export function resourceUnits(cost: UpgradeCost): number {
  return RESOURCE_KINDS.reduce((sum, kind) => sum + (cost.resources[kind] ?? 0), 0);
}

/** Has a next level on offer. */
const isUpgradable = (b: BuildingView): b is Upgradable => b.next !== null;

/**
 * May this building be RECOMMENDED? Unblocked now, AND the effect is one the
 * engine really keeps. ⚠ `effect?.wired === true` is strict on purpose: an
 * upgrade with no effect copy at all (`effect === null`) is not a promise we
 * can make either, so it is never recommended.
 */
export function isRecommendable(b: BuildingView): b is Upgradable {
  return isUpgradable(b) && b.blocked.length === 0 && b.next.effect?.wired === true;
}

/**
 * THE RULE for the three picks (track T brief):
 *
 *   candidates = next !== null AND blocked is empty AND next.effect.wired
 *   rank by    = gold ascending, then total resource units ascending, then id
 *   take       = 3
 *
 * Cheapest-first on purpose: it is the upgrade the player can act on soonest,
 * and it never offers a blocked row or a dead effect. Returns FEWER than
 * `limit` when fewer qualify — the caller says why; this never pads.
 * Does not mutate its input.
 */
export function rankPicks(town: readonly BuildingView[], limit = MAX_PICKS): Pick[] {
  return town
    .filter(isRecommendable)
    .map((building) => ({
      building,
      gold: building.next.cost.gold,
      units: resourceUnits(building.next.cost),
    }))
    .sort((a, b) => a.gold - b.gold || a.units - b.units || a.building.id - b.building.id)
    .slice(0, Math.max(0, limit))
    .map((entry, i) => ({ rank: i + 1, building: entry.building }));
}

/**
 * The sentence that stands where missing picks would be. null when the list is
 * full. It counts the ready-but-unwired upgrades honestly: they exist, they are
 * in the full list, and they are NOT recommended.
 */
export function gapLine(town: readonly BuildingView[], picks: readonly Pick[], limit = MAX_PICKS): string | null {
  if (picks.length >= limit) return null;
  const deadButReady = town.filter(
    (b) => isUpgradable(b) && b.blocked.length === 0 && b.next.effect?.wired !== true,
  ).length;
  const base = picks.length === 0
    ? 'Nothing is ready to buy yet.'
    : 'Nothing else is ready to buy this week.';
  if (deadButReady === 0) return base;
  const verb = deadButReady === 1 ? 'is' : 'are';
  return `${base} ${deadButReady} more ${verb} ready but do nothing yet.`;
}

// ── which shelf a building sits on ──────────────────────────────────────────

export type TownStatus = 'ready' | 'short' | 'locked' | 'maxed';

/**
 * Locked = needs another building or more reputation (the player must DO
 * something else first). Short = only gold or materials are missing (just wait
 * or gather). The split follows the sim's own blocker kinds.
 */
export function statusOf(b: BuildingView): TownStatus {
  if (b.next === null) return 'maxed';
  if (b.blocked.length === 0) return 'ready';
  if (b.blocked.some((r) => r.kind === 'prerequisite' || r.kind === 'reputation')) return 'locked';
  return 'short';
}

export const STATUS_ORDER: readonly TownStatus[] = ['ready', 'short', 'locked', 'maxed'];

export const STATUS_LABEL: Record<TownStatus, string> = {
  ready: 'Ready',
  short: 'Short',
  locked: 'Locked',
  maxed: 'Fully built',
};

export function statusCounts(town: readonly BuildingView[]): Record<TownStatus, number> {
  const out: Record<TownStatus, number> = { ready: 0, short: 0, locked: 0, maxed: 0 };
  for (const b of town) out[statusOf(b)] += 1;
  return out;
}

/** The ledger order: ready first, then short, locked, fully built; id inside a shelf. */
export function ledgerOrder(town: readonly BuildingView[]): BuildingView[] {
  return [...town].sort(
    (a, b) => STATUS_ORDER.indexOf(statusOf(a)) - STATUS_ORDER.indexOf(statusOf(b)) || a.id - b.id,
  );
}

// ── what an upgrade costs, against what the guild holds ─────────────────────

export interface NeedRow {
  /** 'gold' or a resource kind. */
  item: 'gold' | ResourceKind;
  costs: number;
  have: number;
  /** have − costs; negative = short. */
  left: number;
}

/** One row per thing the upgrade charges for. Zero-cost items are left out. */
export function needRows(cost: UpgradeCost, gold: number, stock: ResourceStock): NeedRow[] {
  const rows: NeedRow[] = [];
  if (cost.gold > 0) rows.push({ item: 'gold', costs: cost.gold, have: gold, left: gold - cost.gold });
  for (const kind of RESOURCE_KINDS) {
    const costs = cost.resources[kind] ?? 0;
    if (costs > 0) rows.push({ item: kind, costs, have: stock[kind], left: stock[kind] - costs });
  }
  return rows;
}

/** Could the guild pay for ALL the picks at once (gold and every material summed)? */
export function picksTogether(
  picks: readonly Pick[],
  gold: number,
  stock: ResourceStock,
): { totalGold: number; affordable: boolean } {
  let totalGold = 0;
  const totals: Partial<Record<ResourceKind, number>> = {};
  for (const p of picks) {
    totalGold += p.building.next.cost.gold;
    for (const kind of RESOURCE_KINDS) {
      const n = p.building.next.cost.resources[kind] ?? 0;
      if (n > 0) totals[kind] = (totals[kind] ?? 0) + n;
    }
  }
  const affordable =
    totalGold <= gold && RESOURCE_KINDS.every((k) => (totals[k] ?? 0) <= stock[k]);
  return { totalGold, affordable };
}

// ── the Guild Hall ladder ───────────────────────────────────────────────────


/** Tier word for the Tavern table. */
export const TIER_LABEL: Record<'common' | 'uncommon' | 'rare', string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
};
