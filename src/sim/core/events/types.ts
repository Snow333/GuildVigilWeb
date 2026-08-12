/**
 * The Event Vocabulary — architecture constraint #4 made concrete.
 * See briefs/brief-event-vocabulary.md (APPROVED 2026-08-10).
 *
 * Rules:
 *  - Events are FACTS. No prose, no presentation hints, no derived text.
 *  - Atomic facts + cause links: `cause` is the seq of the DIRECT trigger only.
 *  - Time: dispatch streams tick in 100ms integers; world streams in game-minutes.
 *  - FREEZE POLICY: ★ FROZEN 2026-08-10 (milestone 1.1) ★ — types may be ADDED
 *    but never renamed or removed (the manifest snapshot test enforces this).
 *  - Consumers meeting an unknown type must skip-and-log, never crash.
 */

export const SCHEMA_VERSION = 1;

// ── Shared value shapes ──────────────────────────────────────────────────────

/** PF2E degree of success, resolved per attack/check event. */
export type Degree = 'critFailure' | 'failure' | 'success' | 'critSuccess';

export interface RollBreakdown {
  d20: number;
  modifier: number;
  total: number;
  dc: number;
  degree: Degree;
  /** nat 20 / nat 1 stepping applied (kept explicit so consumers can narrate it). */
  natStep: -1 | 0 | 1;
}

/** Item instance tuple — never denormalized (decision-ledger Area 6). */
export interface ItemInstance {
  baseId: string;
  tier: 'mundane' | 'masterwork' | 'magical' | 'enchanted' | 'legendary';
  propertyIds: string[];
  seed: string;
}

// ── Payloads by event type ───────────────────────────────────────────────────

export interface EventPayloads {
  // dispatch.*
  'dispatch.started': { dispatchId: string; partyId: string; questId?: string; profile: 'fullExplore' | 'bossRush' | 'mysteryHunt' | 'lootRun'; caution: 'cautious' | 'standard' | 'bold' };
  'dispatch.travel_leg_started': { fromX: number; fromY: number; toX: number; toY: number; etaMinutes: number };
  'dispatch.travel_arrived': { poiId: string };
  'dispatch.travel_ambushed': { regionId: string; encounterId: string };
  'dispatch.dungeon_entered': { dungeonId: string; templateId: string; seed: string };
  'dispatch.dungeon_exited': { dungeonId: string };
  'dispatch.retreated': { reason: 'doctrine' | 'hardFloor' | 'objectiveFailed' | 'decisionBudget' | 'playerRecall' };
  'dispatch.completed': { outcome: 'success' | 'partial' };
  'dispatch.wiped': { regionId: string };

  // explore.*
  'explore.room_entered': { roomId: string; roomType: string };
  'explore.area_revealed': { roomIds: string[]; corridorIds: string[] };
  'explore.entry_check_started': { edgeId: string };
  'explore.trap_detected': { roomId: string; trapId: string; roll: RollBreakdown; heroId: string };
  'explore.trap_disarm_attempted': { trapId: string; roll: RollBreakdown; heroId: string; retry: number };
  'explore.trap_triggered': { trapId: string; trapKind: 'damage' | 'aoe' | 'status' | 'alarm' };
  'explore.lock_attempted': { edgeId: string; method: 'pick' | 'force' | 'spell'; roll: RollBreakdown; heroId: string; retry: number };
  'explore.lock_opened': { edgeId: string; method: 'pick' | 'force' | 'spell' };
  'explore.door_forced': { edgeId: string };
  'explore.enemy_presence_detected': { roomId: string; roll: RollBreakdown; heroId: string };
  'explore.ambush_resolved': { roomId: string; tier: 'partySurprise' | 'normal' | 'partial' | 'severe' | 'total' };
  'explore.clue_found': { roomId: string; clueId: string; arcId: string };
  'explore.shrine_activated': { roomId: string };
  'explore.cache_looted': { roomId: string; gold: number };
  'explore.room_cleared': { roomId: string };
  'explore.rested': { locationId: string; package: string };
  'explore.route_blocked': { edgeId: string; reason: 'impossibleDc' | 'noRoute' };

  // combat.*
  'combat.started': { combatId: string; roomId: string; sideA: string[]; sideB: string[]; ambushTier?: string };
  /**
   * Brief #12 — the first sanctioned addition since the 2026-08-10 freeze.
   * Without it a stream carries instance ids and nothing else: a consumer can
   * place a dot but cannot label it, and `damage_applied.hpAfter` has no
   * denominator. Spawn facts make combat streams SELF-DESCRIBING for every
   * consumer (view, harness, replay) instead of making each one re-derive
   * identity from instance-id string shape.
   */
  'combat.unit_spawned': { unitId: string; side: 'heroes' | 'enemies'; baseId: string; name: string; maxHp: number; x: number; y: number };
  'combat.unit_engaged': { unitId: string; targetId: string };
  'combat.attack_resolved': { attackerId: string; targetId: string; weaponBaseId?: string; roll: RollBreakdown; flurryPenalty: number; flanked: boolean; sneakDice?: number };
  'combat.spell_cast': { casterId: string; spellId: string; resource: 'slot' | 'pact' | 'atWill'; cost: number; tier: number };
  'combat.aoe_resolved': { casterId: string; spellId: string; shape: 'burst' | 'cone' | 'line'; targets: { unitId: string; save: RollBreakdown }[] };
  'combat.damage_applied': { targetId: string; amount: number; kind: string; hpAfter: number };
  'combat.healing_applied': { targetId: string; amount: number; hpAfter: number };
  'combat.condition_applied': { targetId: string; conditionId: string; value: number; durationTicks: number };
  'combat.condition_save_resolved': { targetId: string; conditionId: string; roll: RollBreakdown };
  'combat.condition_expired': { targetId: string; conditionId: string };
  'combat.reaction_triggered': { unitId: string; reactionId: string; againstId: string };
  'combat.unit_moved': { unitId: string; toX: number; toY: number; purpose: 'engage' | 'standoff' | 'flee' | 'reposition' };
  'combat.unit_downed': { unitId: string; dyingValue: number };
  'combat.dying_check_resolved': { unitId: string; roll: RollBreakdown; dyingAfter: number };
  'combat.unit_died': { unitId: string };
  'combat.unit_fled': { unitId: string };
  'combat.stance_changed': { unitId: string; stanceId: string | null };
  'combat.stalemate_forced': { resolution: 'attackersWithdraw' | 'byState' };
  'combat.ended': { combatId: string; result: 'victory' | 'defeat' | 'fled' | 'stalemate'; ticks: number };

  // hero.*
  'hero.xp_awarded': { heroId: string; amount: number; source: 'combat' | 'quest' };
  'hero.level_up_applied': { heroId: string; newLevel: number; classId: string };
  'hero.deed_earned': { heroId: string; deedId: string; dispatchId: string };
  'hero.died': { heroId: string; dispatchId?: string };
  'hero.wounded_changed': { heroId: string; wounded: number };

  // loot.*
  'loot.rolled': { sourceKind: 'enemy' | 'boss' | 'vault' | 'cache' | 'quest'; sourceId: string; tableId: string };
  'loot.item_generated': { item: ItemInstance };
  'loot.collected': { items: ItemInstance[]; gold: number };
  'loot.left_behind': { items: ItemInstance[] };

  // world.*
  'world.week_tick': { week: number };
  'world.quest_posted': { questId: string; regionId: string; kind: 'story' | 'filler'; expiresWeek?: number };
  'world.quest_accepted': { questId: string; partyId: string };
  'world.quest_expired': { questId: string; regionId: string };
  'world.quest_completed': { questId: string; regionId: string; xp: number; gold: number; rep: number };
  'world.quest_failed': { questId: string; regionId: string };
  'world.escalation_changed': { regionId: string; oldTier: number; newTier: number };
  'world.villain_beat_fired': { regionId: string; villainId: string; beatId: string };
  'world.poi_state_changed': { poiId: string; state: 'neutral' | 'cleared' | 'captured' | 'enemyHeld' };
  'world.poi_income_paid': { poiId: string; resource: string; amount: number };
  'world.building_upgrade_started': { buildingId: string; toLevel: number; completesWeek: number };
  'world.building_upgrade_completed': { buildingId: string; level: number };
  'world.shop_restocked': { buildingId: string };
  'world.rotation_changed': { buildingId: string; week: number };
  'world.hero_recruited': { heroId: string };
  'world.respec_purchased': { heroId: string; cost: number };
}

export type EventType = keyof EventPayloads;

// ── The envelope ─────────────────────────────────────────────────────────────

/**
 * Distributive over EventType so `switch (ev.type)` narrows `ev.data` —
 * SimEvent is a true discriminated union, not a correlated-generic bag.
 */
export type SimEvent<T extends EventType = EventType> = T extends EventType
  ? {
      /** Stream-local, monotonic. The identity other events reference via `cause`. */
      seq: number;
      /** Dispatch streams: 100ms integer ticks. World streams: game-minutes. */
      tick: number;
      type: T;
      /** Seq of the DIRECT trigger only. Chains are walked, never pointed-through. */
      cause?: number;
      data: EventPayloads[T];
    }
  : never;

export interface StreamHead {
  schemaVersion: number;
  streamKind: 'dispatch' | 'world';
  originId: string;
}

/** Every event type, for the freeze-manifest snapshot test. */
export const EVENT_TYPE_MANIFEST = Object.freeze([
  'dispatch.started', 'dispatch.travel_leg_started', 'dispatch.travel_arrived', 'dispatch.travel_ambushed',
  'dispatch.dungeon_entered', 'dispatch.dungeon_exited', 'dispatch.retreated', 'dispatch.completed', 'dispatch.wiped',
  'explore.room_entered', 'explore.area_revealed', 'explore.entry_check_started', 'explore.trap_detected',
  'explore.trap_disarm_attempted', 'explore.trap_triggered', 'explore.lock_attempted', 'explore.lock_opened',
  'explore.door_forced', 'explore.enemy_presence_detected', 'explore.ambush_resolved', 'explore.clue_found',
  'explore.shrine_activated', 'explore.cache_looted', 'explore.room_cleared', 'explore.rested', 'explore.route_blocked',
  'combat.started', 'combat.unit_spawned', 'combat.unit_engaged', 'combat.attack_resolved', 'combat.spell_cast', 'combat.aoe_resolved',
  'combat.damage_applied', 'combat.healing_applied', 'combat.condition_applied', 'combat.condition_save_resolved',
  'combat.condition_expired', 'combat.reaction_triggered', 'combat.unit_moved', 'combat.unit_downed',
  'combat.dying_check_resolved', 'combat.unit_died', 'combat.unit_fled', 'combat.stance_changed',
  'combat.stalemate_forced', 'combat.ended',
  'hero.xp_awarded', 'hero.level_up_applied', 'hero.deed_earned', 'hero.died', 'hero.wounded_changed',
  'loot.rolled', 'loot.item_generated', 'loot.collected', 'loot.left_behind',
  'world.week_tick', 'world.quest_posted', 'world.quest_accepted', 'world.quest_expired', 'world.quest_completed',
  'world.quest_failed', 'world.escalation_changed', 'world.villain_beat_fired', 'world.poi_state_changed',
  'world.poi_income_paid', 'world.building_upgrade_started', 'world.building_upgrade_completed',
  'world.shop_restocked', 'world.rotation_changed', 'world.hero_recruited', 'world.respec_purchased',
] as const satisfies readonly EventType[]);
