/**
 * THE TOWN (M3) — building levels, resources, reputation, and upgrading.
 *
 * Pure derivation over the generated `buildings` table plus the hand-authored
 * resource bills in `@content/town`. No session state lives here; the session
 * owns the stock and the levels and passes them in, so this module stays
 * testable without a campaign.
 */

import { buildingsById } from '@sim/registry';
import { buildings } from '@content/generated/buildings';
import {
  EFFECT_COPY, RESOURCE_KINDS, UPGRADE_RESOURCES,
  type EffectCopy, type ResourceKind, type ResourceStock,
} from '@content/town';

/** Level 0 = not built. A building the guild has never paid for has no effects. */
export type BuildingLevels = Record<number, number>;

export interface UpgradeCost {
  gold: number;
  resources: Partial<ResourceStock>;
}

export interface BlockedReason {
  kind: 'maxed' | 'gold' | 'resources' | 'prerequisite' | 'reputation';
  /** One short sentence the UI shows verbatim. */
  text: string;
}

export interface BuildingView {
  id: number;
  name: string;
  level: number;
  maxLevel: number;
  /** null when already at max level. */
  next: { level: number; cost: UpgradeCost; effect: EffectCopy | null } | null;
  /** Empty = the next level can be bought right now. */
  blocked: BlockedReason[];
  /** What the guild gets at the level it currently holds. */
  current: EffectCopy | null;
}

/**
 * Gold for the step to `level`.
 *
 * ⚠ DERIVED FROM THE AUTHORED COLUMNS, NEVER RETYPED. `base_cost` and
 * `cost_multiplier` are content; the same discipline as `build-class-chart.mjs`
 * (parse the source, do not re-enter the numbers).
 *
 * ⚠ THE GUILD HALL'S `base_cost` IS AUTHORED AS 0, SO ITS LADDER COSTS NO GOLD.
 * Measured, not assumed. That is left standing rather than "corrected" here,
 * because it makes the headline upgrade — the party-size ladder — payable
 * purely in TIMBER AND STONE from secured sites, which is exactly what M3 is
 * asking the player to go and get. Raise the column in a seed if it should
 * also cost coin; do not special-case it in this function.
 */
export function upgradeGold(buildingId: number, level: number): number {
  const row = buildingsById.get(buildingId);
  if (!row) return 0;
  const base = (row.base_cost as number) ?? 0;
  const mult = (row.cost_multiplier as number) ?? 1;
  return Math.round(base * Math.pow(mult, Math.max(0, level - 1)));
}

export function upgradeCost(buildingId: number, level: number): UpgradeCost {
  return {
    gold: upgradeGold(buildingId, level),
    resources: UPGRADE_RESOURCES[buildingId]?.[level] ?? {},
  };
}

/** The raw `effects` map for a building, parsed. */
function effectsOf(buildingId: number): Record<string, string> {
  const row = buildingsById.get(buildingId);
  if (!row) return {};
  try {
    return JSON.parse((row.effects as string | null) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * The plain-English payoff at a level, or null when the building has none.
 *
 * ⚠ Returns the `wired` flag with the text. A caller that shows the text and
 * drops the flag is promising the player something the engine may not do.
 */
export function effectAt(buildingId: number, level: number): EffectCopy | null {
  if (level < 1) return null;
  const key = effectsOf(buildingId)[`level_${level}`];
  if (!key) return null;
  return EFFECT_COPY[key] ?? null;
}

/**
 * The party size a building level allows, or null if that level is not a
 * party-size rung.
 *
 * ⚠ READS THE EFFECT KEY (`party_size_5`), NEVER THE PLAYER-FACING PROSE. The
 * UI first did this by regexing "(\d+) heroes" out of `EFFECT_COPY.text` —
 * which works until someone rewords the copy to "a party of five", and then
 * the ladder silently shows the wrong number. The key is a machine contract
 * and is safe to parse; the prose is written for humans and is expected to
 * change. `maxPartySize()` keys on the same strings, so the two cannot drift.
 */
export function partySizeAtLevel(buildingId: number, level: number): number | null {
  const key = effectsOf(buildingId)[`level_${level}`];
  const m = /^party_size_(\d+)$/.exec(key ?? '');
  return m ? Number(m[1]) : null;
}

/** Does the guild hold this effect string at its current levels? */
export function hasEffect(levels: BuildingLevels, effectKey: string): boolean {
  for (const row of buildings) {
    const id = row.id as number;
    const level = levels[id] ?? 0;
    const eff = effectsOf(id);
    for (let l = 1; l <= level; l++) if (eff[`level_${l}`] === effectKey) return true;
  }
  return false;
}

/**
 * The highest level the guild holds of a building. Used by every consumer of a
 * building effect, and by the shop's `required_building_level` gate.
 */
export const levelOf = (levels: BuildingLevels, buildingId: number): number => levels[buildingId] ?? 0;

export function blockersFor(
  buildingId: number,
  levels: BuildingLevels,
  gold: number,
  stock: ResourceStock,
  reputation: number,
): BlockedReason[] {
  const row = buildingsById.get(buildingId);
  if (!row) return [{ kind: 'maxed', text: 'No such building.' }];
  const level = levelOf(levels, buildingId);
  const maxLevel = (row.max_level as number) ?? 1;
  if (level >= maxLevel) return [{ kind: 'maxed', text: 'Fully built.' }];

  const out: BlockedReason[] = [];
  const next = level + 1;
  const cost = upgradeCost(buildingId, next);

  // Prerequisite building, e.g. the Barracks needs a Guild Hall.
  const prereqId = row.prerequisite_building_id as number | null;
  const prereqLevel = (row.prerequisite_level as number) ?? 0;
  if (prereqId !== null && levelOf(levels, prereqId) < prereqLevel) {
    const prereqName = buildingsById.get(prereqId)?.name ?? `building ${prereqId}`;
    out.push({
      kind: 'prerequisite',
      text: `Needs ${prereqName} at level ${prereqLevel} first.`,
    });
  }

  const repNeeded = (row.reputation_required as number) ?? 0;
  if (reputation < repNeeded) {
    out.push({
      kind: 'reputation',
      text: `Needs ${repNeeded} reputation — the guild has ${reputation}.`,
    });
  }

  if (gold < cost.gold) {
    out.push({ kind: 'gold', text: `Needs ${cost.gold} gold — the guild has ${gold}.` });
  }

  const short: string[] = [];
  for (const kind of RESOURCE_KINDS) {
    const need = cost.resources[kind] ?? 0;
    if (need > 0 && (stock[kind] ?? 0) < need) short.push(`${need - (stock[kind] ?? 0)} more ${kind}`);
  }
  if (short.length > 0) out.push({ kind: 'resources', text: `Short ${short.join(', ')}.` });

  return out;
}

/** Every building, with what it gives now and what the next level costs. */
export function townView(
  levels: BuildingLevels,
  gold: number,
  stock: ResourceStock,
  reputation: number,
): BuildingView[] {
  return buildings.map((row) => {
    const id = row.id as number;
    const level = levelOf(levels, id);
    const maxLevel = (row.max_level as number) ?? 1;
    const blocked = blockersFor(id, levels, gold, stock, reputation);
    const atMax = level >= maxLevel;
    return {
      id,
      name: row.name as string,
      level,
      maxLevel,
      next: atMax ? null : {
        level: level + 1,
        cost: upgradeCost(id, level + 1),
        effect: effectAt(id, level + 1),
      },
      blocked: atMax ? [] : blocked,
      current: effectAt(id, level),
    };
  });
}

/** Resource kinds a building's remaining upgrades will ever ask for. */
export function resourcesWanted(buildingId: number, fromLevel: number): ResourceKind[] {
  const row = buildingsById.get(buildingId);
  const maxLevel = (row?.max_level as number) ?? 1;
  const out = new Set<ResourceKind>();
  for (let l = fromLevel + 1; l <= maxLevel; l++) {
    for (const k of Object.keys(UPGRADE_RESOURCES[buildingId]?.[l] ?? {})) out.add(k as ResourceKind);
  }
  return [...out];
}
