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
import type { SimEvent } from '@sim/core/events/types';
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
  /**
   * What Arcana, Religion, Survival and Deception did on this mission, one short
   * line each. Empty when none of them was called on. A skill the player built a
   * hero around must be able to SEE that it mattered (Track S).
   */
  skillLines: SkillLine[];
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

export interface SkillLine { skill: 'Arcana' | 'Religion' | 'Survival' | 'Deception'; text: string }

const SKILL_ORDER = ['arcana', 'religion', 'survival', 'deception'] as const;
const SKILL_LABEL = { arcana: 'Arcana', religion: 'Religion', survival: 'Survival', deception: 'Deception' } as const;

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

  return {
    sentence: outcomeSentence(record, dungeon?.combats.victories ?? 0, surfaceSummaries),
    skillLines: record.dispatch ? skillLines(record.dispatch.stream.all(), names) : [],
    rows,
  };
}

/**
 * One line per skill that was called on. Counts are read straight off the
 * `explore.skill_used` facts: a line only says "worked" for a roll that really
 * succeeded, and says how many tries missed so the player sees the whole story.
 */
function skillLines(events: readonly SimEvent[], names: ReadonlyMap<string, string>): SkillLine[] {
  type Use = Extract<SimEvent, { type: 'explore.skill_used' }>['data'];
  const uses = events.filter((e): e is Extract<SimEvent, { type: 'explore.skill_used' }> => e.type === 'explore.skill_used').map((e) => e.data);
  const out: SkillLine[] = [];
  const ok = (u: Use): boolean => u.roll.degree === 'success' || u.roll.degree === 'critSuccess';
  const who = (us: Use[]): string => {
    const set = [...new Set(us.map((u) => names.get(u.heroId) ?? 'A hero'))];
    return set.length <= 2 ? set.join(' and ') : `${set[0]} and ${set.length - 1} more`;
  };
  for (const skill of SKILL_ORDER) {
    const mine = uses.filter((u) => u.skill === skill);
    if (mine.length === 0) continue;
    const wins = mine.filter(ok);
    const label = SKILL_LABEL[skill];
    let text: string;
    switch (skill) {
      case 'arcana':
        // Arcana is only reported when it worked: it is one option among several.
        text = `${who(mine)} broke the runes on ${plural(mine.length, 'seal', 'seals')}.`;
        break;
      case 'religion':
        text = wins.length === 0
          ? `${who(mine)} tried to ward the undead. It failed ${plural(mine.length, 'time', 'times')}.`
          : `${who(wins)} warded the undead in ${wins.length} of ${plural(mine.length, 'fight', 'fights')}. They fought weaker.`;
        break;
      case 'survival': {
        const hp = wins.reduce((s, u) => s + u.amount, 0);
        text = wins.length === 0
          ? `${who(mine)} found nothing to forage.`
          : `${who(wins)} foraged on ${wins.length} of ${plural(mine.length, 'rest', 'rests')}. The party healed ${hp} more HP.`;
        break;
      }
      case 'deception':
        text = wins.length === 0
          ? `${who(mine)} tried to feint. It failed ${plural(mine.length, 'time', 'times')}.`
          : `${who(wins)} feinted in ${wins.length} of ${plural(mine.length, 'fight', 'fights')}. The foe was caught off guard.`;
        break;
    }
    out.push({ skill: label, text });
  }
  return out;
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
