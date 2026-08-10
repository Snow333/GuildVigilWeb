import type { ItemInstance, SimEvent } from './types';
import { SCHEMA_VERSION } from './types';
import type { EventStream } from './stream';

/**
 * Dispatch summary — the PERSISTED artifact of a dispatch (brief-event-vocabulary,
 * decision 2: streams regenerate within a build; summaries survive across builds).
 * Derivation is a pure function of the stream: same stream → same summary, always.
 */

export interface HeroTally {
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  kills: number;
  timesDowned: number;
  died: boolean;
  checksAttempted: number;
  checksSucceeded: number;
  xp: number;
}

export interface DispatchSummary {
  schemaVersion: number;
  dispatchId: string;
  partyId: string;
  profile: string;
  caution: string;
  outcome: 'completed' | 'retreated' | 'wiped' | 'unterminated';
  retreatReason?: string;
  ticks: number;
  heroes: Record<string, HeroTally>;
  combats: { count: number; victories: number; defeats: number; fled: number; stalemates: number };
  exploration: {
    roomsEntered: number; roomsCleared: number; trapsTriggered: number; trapsDisarmed: number;
    locksOpened: number; cluesFound: number; rests: number;
  };
  loot: { gold: number; collected: ItemInstance[]; leftBehindCount: number };
}

const isHero = (id: string): boolean => id.startsWith('hero_');

function emptyTally(): HeroTally {
  return {
    damageDealt: 0, damageTaken: 0, healingDone: 0, kills: 0,
    timesDowned: 0, died: false, checksAttempted: 0, checksSucceeded: 0, xp: 0,
  };
}

/** Walk `cause` links from an event to find the acting unit of the triggering attack/spell. */
function attributeActor(stream: EventStream, ev: SimEvent): string | undefined {
  let cur: SimEvent | undefined = ev;
  const guard = new Set<number>();
  while (cur && !guard.has(cur.seq)) {
    guard.add(cur.seq);
    if (cur.type === 'combat.attack_resolved') return cur.data.attackerId;
    if (cur.type === 'combat.spell_cast' || cur.type === 'combat.aoe_resolved') {
      return cur.data.casterId;
    }
    cur = cur.cause === undefined ? undefined : stream.at(cur.cause);
  }
  return undefined;
}

export function deriveDispatchSummary(stream: EventStream): DispatchSummary {
  const heroes: Record<string, HeroTally> = {};
  const tally = (id: string): HeroTally => (heroes[id] ??= emptyTally());

  const summary: DispatchSummary = {
    schemaVersion: SCHEMA_VERSION,
    dispatchId: stream.head.originId,
    partyId: '',
    profile: '',
    caution: '',
    outcome: 'unterminated',
    ticks: 0,
    heroes,
    combats: { count: 0, victories: 0, defeats: 0, fled: 0, stalemates: 0 },
    exploration: {
      roomsEntered: 0, roomsCleared: 0, trapsTriggered: 0, trapsDisarmed: 0,
      locksOpened: 0, cluesFound: 0, rests: 0,
    },
    loot: { gold: 0, collected: [], leftBehindCount: 0 },
  };

  for (const ev of stream.all()) {
    summary.ticks = ev.tick;
    switch (ev.type) {
      case 'dispatch.started': {
        const d = ev.data;
        summary.partyId = d.partyId;
        summary.profile = d.profile;
        summary.caution = d.caution;
        break;
      }
      case 'dispatch.completed':
        summary.outcome = 'completed';
        break;
      case 'dispatch.retreated':
        summary.outcome = 'retreated';
        summary.retreatReason = ev.data.reason;
        break;
      case 'dispatch.wiped':
        summary.outcome = 'wiped';
        break;

      case 'combat.started':
        summary.combats.count++;
        break;
      case 'combat.ended': {
        const r = ev.data.result;
        if (r === 'victory') summary.combats.victories++;
        else if (r === 'defeat') summary.combats.defeats++;
        else if (r === 'fled') summary.combats.fled++;
        else summary.combats.stalemates++;
        break;
      }

      case 'combat.damage_applied': {
        const { targetId, amount } = ev.data;
        if (isHero(targetId)) tally(targetId).damageTaken += amount;
        const actor = attributeActor(stream, ev);
        if (actor && isHero(actor)) tally(actor).damageDealt += amount;
        break;
      }
      case 'combat.healing_applied': {
        const actor = attributeActor(stream, ev);
        if (actor && isHero(actor)) tally(actor).healingDone += ev.data.amount;
        break;
      }
      case 'combat.unit_downed':
        if (isHero(ev.data.unitId)) tally(ev.data.unitId).timesDowned++;
        break;
      case 'combat.unit_died': {
        const { unitId } = ev.data;
        if (isHero(unitId)) {
          tally(unitId).died = true;
        } else {
          const killer = attributeActor(stream, ev);
          if (killer && isHero(killer)) tally(killer).kills++;
        }
        break;
      }

      case 'explore.room_entered':
        summary.exploration.roomsEntered++;
        break;
      case 'explore.room_cleared':
        summary.exploration.roomsCleared++;
        break;
      case 'explore.trap_triggered':
        summary.exploration.trapsTriggered++;
        break;
      case 'explore.clue_found':
        summary.exploration.cluesFound++;
        break;
      case 'explore.rested':
        summary.exploration.rests++;
        break;
      case 'explore.lock_opened':
        summary.exploration.locksOpened++;
        break;

      case 'explore.trap_detected':
      case 'explore.enemy_presence_detected': {
        const { heroId, roll } = ev.data;
        tally(heroId).checksAttempted++;
        if (roll.degree === 'success' || roll.degree === 'critSuccess') tally(heroId).checksSucceeded++;
        break;
      }
      case 'explore.trap_disarm_attempted': {
        const { heroId, roll } = ev.data;
        tally(heroId).checksAttempted++;
        const ok = roll.degree === 'success' || roll.degree === 'critSuccess';
        if (ok) {
          tally(heroId).checksSucceeded++;
          summary.exploration.trapsDisarmed++;
        }
        break;
      }
      case 'explore.lock_attempted': {
        const { heroId, roll } = ev.data;
        tally(heroId).checksAttempted++;
        if (roll.degree === 'success' || roll.degree === 'critSuccess') tally(heroId).checksSucceeded++;
        break;
      }

      case 'hero.xp_awarded':
        tally(ev.data.heroId).xp += ev.data.amount;
        break;
      case 'hero.died':
        tally(ev.data.heroId).died = true;
        break;

      case 'loot.collected':
        summary.loot.gold += ev.data.gold;
        summary.loot.collected.push(...ev.data.items);
        break;
      case 'loot.left_behind':
        summary.loot.leftBehindCount += ev.data.items.length;
        break;
      case 'explore.cache_looted':
        summary.loot.gold += ev.data.gold;
        break;

      default:
        // Forward tolerance: unhandled/unknown types are facts we don't tally. Fine.
        break;
    }
  }

  return summary;
}
