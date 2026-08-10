/**
 * The beat feed — brief #5 §4: the ONLY place narration exists. Resolvers stay
 * fact-only (constraint 4); this total function turns the FROZEN vocabulary
 * into terse feed lines. Deterministic: same stream → same lines, always.
 * Unknown event types skip-and-count (forward tolerance, the consumer rule).
 *
 * The Vitest snapshot over the contract fixture pins this text — the Phase 2
 * exit criterion is text-identical replay. Editorial filtering (collapsing
 * misses, round bucketing) is Phase 3 polish per the plan.
 */

import type { EventStream } from '@sim/core/events/stream';
import type { RollBreakdown, SimEvent } from '@sim/core/events/types';

export type BeatTone = 'good' | 'bad' | 'loot' | 'travel' | 'system' | 'neutral';

export interface BeatLine {
  tick: number;
  text: string;
  tone: BeatTone;
}

export interface BeatFeed {
  lines: BeatLine[];
  /** Unknown-type events skipped (forward tolerance) — surfaced, never fatal. */
  skipped: number;
  skippedTypes: string[];
}

/** Id → display name; defaults to identity (the snapshot contract uses raw ids). */
export type NameResolver = (id: string) => string;

const DEGREE_WORD: Record<RollBreakdown['degree'], string> = {
  critFailure: 'CRIT MISS',
  failure: 'miss',
  success: 'hit',
  critSuccess: 'CRIT',
};

const CHECK_WORD: Record<RollBreakdown['degree'], string> = {
  critFailure: 'botched',
  failure: 'failed',
  success: 'passed',
  critSuccess: 'aced',
};

const fmtRoll = (r: RollBreakdown): string => `${r.d20}+${r.modifier}=${r.total} vs DC ${r.dc}`;

/** One event → one line, or null to drop it silently (structural noise). */
export function interpretEvent(ev: SimEvent, nameFor: NameResolver = (id) => id): BeatLine | null {
  const t = (text: string, tone: BeatTone = 'neutral'): BeatLine => ({ tick: ev.tick, text, tone });
  switch (ev.type) {
    // ── dispatch.* ──
    case 'dispatch.started':
      return t(`The party sets out (${ev.data.profile}, ${ev.data.caution}).`, 'system');
    case 'dispatch.travel_leg_started':
      return t(`On the road — ETA ${ev.data.etaMinutes} min.`, 'travel');
    case 'dispatch.travel_arrived':
      return t(`Arrived at ${ev.data.poiId}.`, 'travel');
    case 'dispatch.travel_ambushed':
      return t(`AMBUSH on the road through ${ev.data.regionId}!`, 'bad');
    case 'dispatch.dungeon_entered':
      return t(`They descend into the dungeon (${ev.data.templateId}).`, 'system');
    case 'dispatch.dungeon_exited':
      return t(`Back to daylight.`, 'travel');
    case 'dispatch.retreated':
      return t(`The party withdraws (${ev.data.reason}).`, 'bad');
    case 'dispatch.completed':
      return t(ev.data.outcome === 'success' ? `Objective complete.` : `Objective partially met.`, 'good');
    case 'dispatch.wiped':
      return t(`The party is wiped out.`, 'bad');

    // ── explore.* ──
    case 'explore.room_entered':
      return t(`Entered ${ev.data.roomId} (${ev.data.roomType}).`);
    case 'explore.area_revealed':
      return null; // map bookkeeping — the graph view consumes it, the feed doesn't
    case 'explore.entry_check_started':
      return null;
    case 'explore.trap_detected':
      return t(`${nameFor(ev.data.heroId)} spots a trap (${fmtRoll(ev.data.roll)}).`, 'good');
    case 'explore.trap_disarm_attempted':
      return t(
        `${nameFor(ev.data.heroId)} ${CHECK_WORD[ev.data.roll.degree]} disarming the trap (${fmtRoll(ev.data.roll)}).`,
        ev.data.roll.degree === 'success' || ev.data.roll.degree === 'critSuccess' ? 'good' : 'bad',
      );
    case 'explore.trap_triggered':
      return t(`A ${ev.data.trapKind} trap goes off!`, 'bad');
    case 'explore.lock_attempted':
      return t(
        `${nameFor(ev.data.heroId)} ${CHECK_WORD[ev.data.roll.degree]} the lock (${ev.data.method}, ${fmtRoll(ev.data.roll)}).`,
        ev.data.roll.degree === 'success' || ev.data.roll.degree === 'critSuccess' ? 'good' : 'neutral',
      );
    case 'explore.lock_opened':
      return t(`The way opens (${ev.data.method}).`, 'good');
    case 'explore.door_forced':
      return t(`The door gives way to force.`, 'good');
    case 'explore.enemy_presence_detected':
      return t(`${nameFor(ev.data.heroId)} senses enemies ahead (${fmtRoll(ev.data.roll)}).`, 'good');
    case 'explore.ambush_resolved':
      return t(
        ev.data.tier === 'partySurprise' ? `The party gets the drop on them.` : `Contact — surprise: ${ev.data.tier}.`,
        ev.data.tier === 'partySurprise' ? 'good' : 'bad',
      );
    case 'explore.clue_found':
      return t(`A clue surfaces: ${ev.data.clueId} (${ev.data.arcId}).`, 'good');
    case 'explore.shrine_activated':
      return t(`The shrine hums — the party is restored.`, 'good');
    case 'explore.cache_looted':
      return t(`Cache looted: ${ev.data.gold} gold.`, 'loot');
    case 'explore.room_cleared':
      return t(`${ev.data.roomId} cleared.`, 'good');
    case 'explore.rested':
      return t(`The party rests (${ev.data.package}).`, 'system');
    case 'explore.route_blocked':
      return t(`Route blocked (${ev.data.reason === 'impossibleDc' ? 'impassable' : 'no way through'}).`, 'bad');

    // ── combat.* ──
    case 'combat.started':
      return t(`Combat: ${ev.data.sideA.map(nameFor).join(', ')} vs ${ev.data.sideB.map(nameFor).join(', ')}.`, 'system');
    case 'combat.unit_engaged':
      return null; // movement intent — the attack line carries the story
    case 'combat.attack_resolved': {
      const d = ev.data;
      const extras: string[] = [];
      if (d.flanked) extras.push('flanked');
      if (d.sneakDice) extras.push(`sneak ${d.sneakDice}d`);
      const suffix = extras.length > 0 ? ` [${extras.join(', ')}]` : '';
      return t(`${nameFor(d.attackerId)} → ${nameFor(d.targetId)}: ${DEGREE_WORD[d.roll.degree]} (${fmtRoll(d.roll)})${suffix}`);
    }
    case 'combat.spell_cast':
      return t(`${nameFor(ev.data.casterId)} casts spell ${ev.data.spellId}.`, 'system');
    case 'combat.aoe_resolved':
      return t(`The ${ev.data.shape} catches ${ev.data.targets.length} target(s).`, 'system');
    case 'combat.damage_applied':
      return t(`${nameFor(ev.data.targetId)} takes ${ev.data.amount} ${ev.data.kind} (${ev.data.hpAfter} hp left).`,
        ev.data.hpAfter <= 0 ? 'bad' : 'neutral');
    case 'combat.healing_applied':
      return t(`${nameFor(ev.data.targetId)} is healed ${ev.data.amount} (${ev.data.hpAfter} hp).`, 'good');
    case 'combat.condition_applied':
      return t(`${nameFor(ev.data.targetId)} is ${ev.data.conditionId}${ev.data.value ? ` ${ev.data.value}` : ''}.`, 'bad');
    case 'combat.condition_save_resolved':
      return t(`${nameFor(ev.data.targetId)} ${CHECK_WORD[ev.data.roll.degree]} a save vs ${ev.data.conditionId} (${fmtRoll(ev.data.roll)}).`,
        ev.data.roll.degree === 'success' || ev.data.roll.degree === 'critSuccess' ? 'good' : 'bad');
    case 'combat.condition_expired':
      return t(`${nameFor(ev.data.targetId)} shakes off ${ev.data.conditionId}.`, 'good');
    case 'combat.reaction_triggered':
      return t(`${nameFor(ev.data.unitId)} reacts (${ev.data.reactionId}) against ${nameFor(ev.data.againstId)}.`, 'neutral');
    case 'combat.unit_moved':
      return null; // positional noise at feed granularity
    case 'combat.unit_downed':
      return t(`${nameFor(ev.data.unitId)} goes DOWN (dying ${ev.data.dyingValue}).`, 'bad');
    case 'combat.dying_check_resolved':
      return t(`${nameFor(ev.data.unitId)} ${CHECK_WORD[ev.data.roll.degree]} a death save (dying ${ev.data.dyingAfter}).`,
        ev.data.dyingAfter === 0 ? 'good' : 'bad');
    case 'combat.unit_died':
      return t(`${nameFor(ev.data.unitId)} is slain.`, 'bad');
    case 'combat.unit_fled':
      return t(`${nameFor(ev.data.unitId)} flees.`, 'neutral');
    case 'combat.stance_changed':
      return t(`${nameFor(ev.data.unitId)} shifts stance${ev.data.stanceId ? ` (${ev.data.stanceId})` : ''}.`, 'system');
    case 'combat.stalemate_forced':
      return t(`Stalemate — resolved by ${ev.data.resolution === 'attackersWithdraw' ? 'withdrawal' : 'the numbers'}.`, 'system');
    case 'combat.ended':
      return t(`Combat ends: ${ev.data.result} (${ev.data.ticks} ticks).`,
        ev.data.result === 'victory' ? 'good' : ev.data.result === 'defeat' ? 'bad' : 'neutral');

    // ── hero.* ──
    case 'hero.xp_awarded':
      return t(`${nameFor(ev.data.heroId)} gains ${ev.data.amount} XP (${ev.data.source}).`, 'good');
    case 'hero.level_up_applied':
      return t(`${nameFor(ev.data.heroId)} reaches level ${ev.data.newLevel}!`, 'good');
    case 'hero.deed_earned':
      return t(`${nameFor(ev.data.heroId)} earns deed ${ev.data.deedId}.`, 'good');
    case 'hero.died':
      return t(`${nameFor(ev.data.heroId)} has died.`, 'bad');
    case 'hero.wounded_changed':
      return t(`${nameFor(ev.data.heroId)} is wounded ${ev.data.wounded}.`, 'bad');

    // ── loot.* ──
    case 'loot.rolled':
      return null; // the generated item line carries the news
    case 'loot.item_generated':
      return t(`Found: ${ev.data.item.tier} ${ev.data.item.baseId}${ev.data.item.propertyIds.length > 0 ? ` [${ev.data.item.propertyIds.join(', ')}]` : ''}.`, 'loot');
    case 'loot.collected':
      return t(`Haul secured: ${ev.data.items.length} item(s), ${ev.data.gold} gold.`, 'loot');
    case 'loot.left_behind':
      return t(`Left behind: ${ev.data.items.length} item(s).`, 'bad');

    // ── world.* (the town feed consumes these later; playback may see a few) ──
    case 'world.week_tick':
      return t(`Week ${ev.data.week}.`, 'system');
    case 'world.quest_posted':
      return t(`Posted: quest ${ev.data.questId} in ${ev.data.regionId}.`, 'system');
    case 'world.quest_accepted':
      return t(`Quest ${ev.data.questId} accepted.`, 'system');
    case 'world.quest_expired':
      return t(`Quest ${ev.data.questId} expired unanswered (${ev.data.regionId}).`, 'bad');
    case 'world.quest_completed':
      return t(`Quest ${ev.data.questId} COMPLETE: +${ev.data.gold}g, +${ev.data.xp}xp.`, 'good');
    case 'world.quest_failed':
      return t(`Quest ${ev.data.questId} failed (${ev.data.regionId}).`, 'bad');
    case 'world.escalation_changed':
      return t(`${ev.data.regionId} pressure: tier ${ev.data.oldTier} → ${ev.data.newTier}.`,
        ev.data.newTier > ev.data.oldTier ? 'bad' : 'good');
    case 'world.villain_beat_fired':
      return t(`Something stirs: ${ev.data.beatId} (${ev.data.regionId}).`, 'bad');
    case 'world.poi_state_changed':
      return t(`${ev.data.poiId} is now ${ev.data.state}.`, 'system');
    case 'world.poi_income_paid':
      return t(`${ev.data.poiId} pays ${ev.data.amount} ${ev.data.resource}.`, 'loot');
    case 'world.building_upgrade_started':
      return t(`${ev.data.buildingId} upgrade to L${ev.data.toLevel} begun (done wk ${ev.data.completesWeek}).`, 'system');
    case 'world.building_upgrade_completed':
      return t(`${ev.data.buildingId} reaches L${ev.data.level}.`, 'good');
    case 'world.shop_restocked':
      return t(`${ev.data.buildingId} restocks.`, 'system');
    case 'world.rotation_changed':
      return t(`${ev.data.buildingId} rotates its wares.`, 'system');
    case 'world.hero_recruited':
      return t(`${nameFor(ev.data.heroId)} joins the guild.`, 'good');
    case 'world.respec_purchased':
      return t(`${nameFor(ev.data.heroId)} retrains (${ev.data.cost}g).`, 'system');
  }
}

/** Whole-stream interpretation with forward tolerance for unknown types. */
export function interpretStream(stream: EventStream, nameFor?: NameResolver): BeatFeed {
  const lines: BeatLine[] = [];
  const skippedTypes = new Set<string>();
  let skipped = 0;
  for (const ev of stream.all()) {
    let line: BeatLine | null;
    try {
      line = interpretEvent(ev, nameFor);
    } catch {
      line = null;
    }
    // An event type outside the frozen vocabulary falls through the exhaustive
    // switch as undefined — skip-and-count, never crash (the consumer rule).
    if (line === undefined) {
      skipped++;
      skippedTypes.add((ev as { type: string }).type);
      continue;
    }
    if (line) lines.push(line);
  }
  return { lines, skipped, skippedTypes: [...skippedTypes].sort() };
}
