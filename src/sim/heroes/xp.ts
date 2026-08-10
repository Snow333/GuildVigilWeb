/**
 * XP system — faithful port of scripts/xp_manager.gd + xp_constants.gd
 * (the freshly-reworked system; decision-ledger Area 1: Keep, fixtures ported).
 *
 * Flat 1000 XP per character level, cumulative (XP is never spent).
 * Source-stored values (enemies.xp_reward / quests.reward_xp).
 * Party split is round-half-up per hero; drift ≤ party size is deliberate.
 * Dead heroes excluded unless the includeDeadHeroes option is on (default OFF).
 */

import { characterLevel, type HeroState } from './types';

export const XP_PER_LEVEL = 1000;
export const CHARACTER_LEVEL_CAP = 20;
export const L_CAP_SENTINEL = -1;

export type XpSourceType = 'monster' | 'quest' | 'action';

/** Content lookup seam — production wires the generated registries; tests wire fixtures. */
export interface XpSourceResolver {
  /** Returns the source's XP value, or null when the row is missing. Zero is valid. */
  monsterXp(sourceId: number): number | null;
  questXp(sourceId: number): number | null;
}

export interface XpAwardResult {
  totalAwarded: number;
  perHeroShare: number;
  recipientCount: number;
}

export type XpAwardError =
  | { error: 'actionReserved' }
  | { error: 'sourceNotFound'; sourceType: XpSourceType; sourceId: number };

/** Round half-up per hero (GD: int(total/count + 0.5)). Drift accepted by design. */
export function perHeroShare(total: number, count: number): number {
  if (count <= 0) return 0;
  return Math.floor(total / count + 0.5);
}

function isRecipient(hero: HeroState, includeDead: boolean): boolean {
  return includeDead || hero.status !== 'dead';
}

/**
 * Award source-stored XP to a party, split across living members. Mutates hero.xp.
 * Mirrors XPManager.award_xp — including the reserved-ACTION no-op and the
 * "missing source row" error path.
 */
export function awardXp(
  party: HeroState[],
  sourceType: XpSourceType,
  sourceId: number,
  resolver: XpSourceResolver,
  opts: { includeDeadHeroes?: boolean } = {},
): XpAwardResult | XpAwardError {
  if (sourceType === 'action') return { error: 'actionReserved' };

  const sourceXp = sourceType === 'monster' ? resolver.monsterXp(sourceId) : resolver.questXp(sourceId);
  if (sourceXp === null) return { error: 'sourceNotFound', sourceType, sourceId };
  if (sourceXp === 0) return { totalAwarded: 0, perHeroShare: 0, recipientCount: 0 };

  const includeDead = opts.includeDeadHeroes ?? false;
  const recipients = party.filter((h) => isRecipient(h, includeDead));
  if (recipients.length === 0) return { totalAwarded: 0, perHeroShare: 0, recipientCount: 0 };

  const share = perHeroShare(sourceXp, recipients.length);
  if (share <= 0) return { totalAwarded: 0, perHeroShare: 0, recipientCount: recipients.length };

  for (const hero of recipients) hero.xp += share;
  return { totalAwarded: share * recipients.length, perHeroShare: share, recipientCount: recipients.length };
}

/** Dev cheat / story reward — no split, no source lookup. Capped at level 20. */
export function awardXpFlat(hero: HeroState, amount: number): void {
  if (amount <= 0) return;
  if (characterLevel(hero) >= CHARACTER_LEVEL_CAP) return;
  hero.xp += amount;
}

export interface XpProgress {
  currentXp: number;
  threshold: number;
  progress: number;
  atCap: boolean;
}

/** Mirrors get_xp_for_next_level, including the -1 sentinel at the cap. */
export function xpForNextLevel(hero: HeroState): XpProgress {
  const level = characterLevel(hero);
  if (level >= CHARACTER_LEVEL_CAP) {
    return { currentXp: hero.xp, threshold: L_CAP_SENTINEL, progress: L_CAP_SENTINEL, atCap: true };
  }
  const progress = hero.xp - (level - 1) * XP_PER_LEVEL;
  return {
    currentXp: hero.xp,
    threshold: XP_PER_LEVEL,
    progress: Math.min(Math.max(progress, 0), XP_PER_LEVEL),
    atCap: false,
  };
}

export function canLevelUp(hero: HeroState): boolean {
  const level = characterLevel(hero);
  if (level >= CHARACTER_LEVEL_CAP) return false;
  return hero.xp >= level * XP_PER_LEVEL;
}
