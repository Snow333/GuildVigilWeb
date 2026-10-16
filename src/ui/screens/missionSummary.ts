/**
 * Mission summary for the after-action report — pure, so the sentence and the
 * per-hero numbers are unit-testable without rendering a component.
 *
 * Every number comes from `deriveDispatchSummary` (the sim's own tally of a
 * stream). Nothing here re-derives a rule: it only adds tallies together and
 * turns facts into short, plain sentences. The player is dyslexic, so the
 * wording is short and avoids game jargon.
 */

import { deriveDispatchSummary, type HeroTally } from '@sim/core/events/summary';
import type { QuestRecord } from '@sim/campaign/session';

/** One line of the "who did what" table. */
export interface MissionHeroRow {
  heroId: string;
  /** Looked up from the roster — never a raw id. */
  name: string;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  kills: number;
  timesDowned: number;
  died: boolean;
}

export interface MissionSummary {
  /** One plain sentence (or two short ones) for how the mission went. */
  sentence: string;
  /** Heroes who took part, in roster order. */
  rows: MissionHeroRow[];
}

/** Why a party turned back, in words a player would use. */
const RETREAT_WORDS: Record<string, string> = {
  doctrine: 'The party was too hurt to go on.',
  hardFloor: 'The party was too hurt to go on.',
  objectiveFailed: 'The party could not reach its goal.',
  decisionBudget: 'The party ran out of time.',
  playerRecall: 'You called the party back.',
};

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

type Tally = Omit<HeroTally, 'checksAttempted' | 'checksSucceeded' | 'xp'>;

function addInto(into: Tally, from: HeroTally): void {
  into.damageDealt += from.damageDealt;
  into.damageTaken += from.damageTaken;
  into.healingDone += from.healingDone;
  into.kills += from.kills;
  into.timesDowned += from.timesDowned;
  into.died = into.died || from.died;
}

/**
 * Build the summary for one launch record.
 * `roster` names the heroes; heroes missing from it are shown as "A hero".
 */
export function buildMissionSummary(
  record: QuestRecord,
  roster: readonly { id: string; name: string }[],
): MissionSummary {
  const dungeon = record.dispatch ? deriveDispatchSummary(record.dispatch.stream) : null;
  const surface = (record.fights ?? []).map((f) => ({ site: f.site, stream: f.stream }));
  const surfaceSummaries = surface.map((f) => ({ site: f.site, summary: deriveDispatchSummary(f.stream) }));

  // Per-hero numbers: add the dungeon stream and every surface fight together.
  const merged = new Map<string, Tally>();
  const take = (id: string): Tally => {
    let t = merged.get(id);
    if (!t) {
      t = { damageDealt: 0, damageTaken: 0, healingDone: 0, kills: 0, timesDowned: 0, died: false };
      merged.set(id, t);
    }
    return t;
  };
  const all = [...(dungeon ? [dungeon] : []), ...surfaceSummaries.map((s) => s.summary)];
  for (const s of all) {
    for (const [id, tally] of Object.entries(s.heroes)) addInto(take(id), tally);
  }
  // A hero who stood in a fight but never struck or got hit still took part.
  for (const f of surface) {
    for (const ev of f.stream.all()) {
      if (ev.type === 'combat.started') for (const id of ev.data.sideA) if (id.startsWith('hero_')) take(id);
    }
  }
  if (record.dispatch) {
    for (const ev of record.dispatch.stream.all()) {
      if (ev.type === 'combat.started') for (const id of ev.data.sideA) if (id.startsWith('hero_')) take(id);
    }
  }

  const names = new Map(roster.map((r) => [r.id, r.name]));
  const rows: MissionHeroRow[] = [];
  for (const r of roster) {
    const t = merged.get(r.id);
    if (t) rows.push({ heroId: r.id, name: names.get(r.id) ?? 'A hero', ...t });
  }
  for (const [id, t] of merged) {
    if (!names.has(id)) rows.push({ heroId: id, name: 'A hero', ...t });
  }

  return { sentence: outcomeSentence(record, dungeon?.combats.victories ?? 0, surfaceSummaries), rows };
}

function outcomeSentence(
  record: QuestRecord,
  dungeonFightsWon: number,
  surface: { site: 'road' | 'camp'; summary: ReturnType<typeof deriveDispatchSummary> }[],
): string {
  const d = record.dispatch;
  const rooms = d ? plural(d.roomsVisited, 'room', 'rooms') : '';
  const won = (site: 'road' | 'camp'): boolean =>
    surface.some((s) => s.site === site && s.summary.combats.victories > 0);
  const ambushBeaten = won('road') ? ' The party beat an ambush on the road.' : '';

  switch (record.outcome) {
    case 'ambushKilled':
      return 'The party was cut down by ambushers on the road.';
    case 'completed':
      if (d) {
        const parts = [rooms, `${plural(dungeonFightsWon, 'fight', 'fights')} won`];
        if (d.bossDefeated) parts.push('boss slain');
        return `Cleared the dungeon: ${parts.join(', ')}.${ambushBeaten}`;
      }
      return `Won the fight at the camp.${ambushBeaten}`;
    case 'failed':
      if (d) {
        const why = RETREAT_WORDS[d.retreatReason ?? ''] ?? 'The party turned back.';
        return `Retreated after ${rooms}. ${why}${ambushBeaten}`;
      }
      return `Lost the fight at the camp. The party pulled back.${ambushBeaten}`;
    case 'wiped':
      if (d) return `The party was wiped out after ${rooms}.${ambushBeaten}`;
      return `The party was wiped out at the camp.${ambushBeaten}`;
  }
}
