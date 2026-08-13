/**
 * The continuous-time encounter loop — no player intervention once engaged
 * (core-loop D2). Single synchronous loop over 100ms ticks; every fact emits
 * into the EventStream; presentation and the harness both consume it.
 *
 * Anti-stall per the settled decision: NO hard duration cap as pacing — a
 * damage-silence window forces resolution by state; maxTicks exists only as
 * the HANG guard (its firing is a bug, and the harness treats it as one).
 */

import { ARENA, DYING, ENCOUNTER, ENGAGEMENT_RANGE, TICKS_PER_SECOND } from '@content/combat';
import { EventStream } from '@sim/core/events/stream';
import { Rng } from '@sim/core/rng';
import { boundToRoom, desiredPosition, inAttackRange, moveStep, stepToward } from './ai';
import { decayFlurry, flurryPenalty } from './dice';
import { canMove, expireConditions, hasCondition, speedMod } from './conditions';
import { damageWhileDying, healDying, knockOut, resolveDyingRecovery } from './dying';
import { featEffectsById } from '@sim/heroes/featEffects';
import { pickAction } from './loadout';
import { applyConditionFromCast, resolveCast, spellRange } from './spells';
import { spellsById } from '@sim/registry';
import { resolveStrike } from './strike';
import { dist, type Combatant } from './types';

export interface EncounterResult {
  result: 'victory' | 'defeat' | 'stalemate';
  ticks: number;
  stream: EventStream;
  survivors: { heroes: string[]; enemies: string[] };
  /** True only if the HANG guard fired — always a bug, never pacing. */
  hitMaxTicks: boolean;
}

interface UnitRuntime {
  targetId: string | null;
  lastDyingCheckTick: number;
}

const livingFighters = (all: Combatant[], side: Combatant['side']): Combatant[] =>
  all.filter((u) => u.side === side && u.hp > 0 && !hasCondition(u, 'unconscious'));

const aliveAtAll = (all: Combatant[], side: Combatant['side']): Combatant[] =>
  all.filter((u) => u.side === side && (u.hp > 0 || hasCondition(u, 'dying')));

/**
 * Line formation placement: side A on the left column, B on the right,
 * vertically centered — and inside the room, which is now a real constraint
 * rather than a drawing (brief #19). A side larger than the room is tall
 * stacks its overflow on the wall rather than spawning outside it; the view
 * says so in the margin via `formationFits`.
 */
export function placeFormation(units: Combatant[], side: Combatant['side']): void {
  const x = side === 'heroes' ? ARENA.sideAx : ARENA.sideBx;
  const startY = (ARENA.height - (units.length - 1)) / 2;
  units.forEach((u, i) => {
    u.pos = boundToRoom({ x, y: startY + i }, ARENA);
  });
}

export function runEncounter(
  combatId: string,
  roomId: string,
  heroes: Combatant[],
  enemies: Combatant[],
  seed: string,
): EncounterResult {
  const rng = new Rng(seed);
  const all = [...heroes, ...enemies].sort((a, b) => (a.id < b.id ? -1 : 1));
  const stream = new EventStream('dispatch', combatId);
  const runtime = new Map<string, UnitRuntime>(all.map((u) => [u.id, { targetId: null, lastDyingCheckTick: 0 }]));

  placeFormation(heroes, 'heroes');
  placeFormation(enemies, 'enemies');

  const startEv = stream.emit(0, 'combat.started', {
    combatId, roomId, sideA: heroes.map((u) => u.id), sideB: enemies.map((u) => u.id),
  });

  // Brief #12: spawn facts, sideA then sideB so emission order stays
  // deterministic and `combat.started` remains events[0]. This is what makes a
  // combat stream self-describing — identity, and the HP denominator that
  // `damage_applied.hpAfter` otherwise lacks.
  for (const u of [...heroes, ...enemies]) {
    stream.emit(0, 'combat.unit_spawned', {
      unitId: u.id, side: u.side, baseId: u.baseId, name: u.name,
      maxHp: u.maxHp, x: round2(u.pos.x), y: round2(u.pos.y),
    }, startEv.seq);
  }

  // Initiative → engagement speed: total = d20 + bonus; delay = base − total; heroes shave the tie-break tick.
  for (const u of all) {
    u.nextActionTick = initiativeDelay(rng.die(20) + u.initiativeBonus, u.isHero);
  }
  // Within-tick processing follows initiative order, HEROES FIRST on ties —
  // this is where "players win ties" lives in continuous time.
  const actionOrder = [...all].sort((a, b) =>
    a.nextActionTick - b.nextActionTick ||
    Number(b.isHero) - Number(a.isHero) ||
    (a.id < b.id ? -1 : 1),
  );

  let lastProgressTick = 0;
  let tick = 0;
  let result: EncounterResult['result'] | null = null;
  let hitMaxTicks = false;

  /** Shared damage path: temp HP absorbs first; dying/downed/died all flow through here. */
  const applyDamage = (target: Combatant, amount: number, kind: string, s: EventStream, t: number, cause: number): void => {
    lastProgressTick = t;
    if (hasCondition(target, 'dying')) {
      const newVal = damageWhileDying(target);
      const dmgEv = s.emit(t, 'combat.damage_applied', { targetId: target.id, amount, kind, hpAfter: 0 }, cause);
      if (newVal >= DYING.deathAt) s.emit(t, 'combat.unit_died', { unitId: target.id }, dmgEv.seq);
      return;
    }
    const absorbed = Math.min(target.tempHp, amount);
    target.tempHp -= absorbed;
    const through = amount - absorbed;
    target.hp = Math.max(target.hp - through, 0);
    const dmgEv = s.emit(t, 'combat.damage_applied', { targetId: target.id, amount, kind, hpAfter: target.hp }, cause);
    if (target.hp === 0 && through > 0) {
      if (target.isHero) {
        const dyingVal = knockOut(target);
        s.emit(t, 'combat.unit_downed', { unitId: target.id, dyingValue: dyingVal }, dmgEv.seq);
      } else {
        s.emit(t, 'combat.unit_died', { unitId: target.id }, dmgEv.seq);
      }
    }
  };

  const applyHealing = (target: Combatant, amount: number, s: EventStream, t: number, cause: number): void => {
    if (amount <= 0) return;
    lastProgressTick = t;
    if (hasCondition(target, 'dying')) {
      healDying(target, amount);
    } else {
      target.hp = Math.min(target.hp + amount, target.maxHp);
    }
    s.emit(t, 'combat.healing_applied', { targetId: target.id, amount, hpAfter: target.hp }, cause);
  };

  const emitCastResults = (cast: ReturnType<typeof resolveCast>, caster: Combatant, s: EventStream, t: number, castSeq: number): void => {
    const saveTargets = cast.targets.filter((r) => r.save);
    if (saveTargets.length > 0) {
      s.emit(t, 'combat.aoe_resolved', {
        casterId: caster.id, spellId: String(cast.spell.id),
        shape: ((cast.spell.aoe_shape as string | null) ?? 'burst') as 'burst' | 'cone' | 'line',
        targets: saveTargets.map((r) => ({ unitId: r.unit.id, save: r.save! })),
      }, castSeq);
    }
    for (const r of cast.targets) {
      if (r.attack) {
        s.emit(t, 'combat.attack_resolved', {
          attackerId: caster.id, targetId: r.unit.id, roll: r.attack, flurryPenalty: 0, flanked: false,
        }, castSeq);
      }
      if (r.damage > 0) applyDamage(r.unit, r.damage, (cast.spell.damage_type as string | null) ?? 'magic', s, t, castSeq);
      if (r.healing > 0) applyHealing(r.unit, r.healing, s, t, castSeq);
      if (r.conditionApplied) {
        applyConditionFromCast(r.unit, r.conditionApplied);
        s.emit(t, 'combat.condition_applied', {
          targetId: r.unit.id, conditionId: r.conditionApplied.id,
          value: r.conditionApplied.value, durationTicks: r.conditionApplied.durationTicks,
        }, castSeq);
      }
    }
  };

  const reactionReady = (u: Combatant, t: number): boolean => t - u.lastReactionTick >= ENCOUNTER.attackIntervalTicks;
  const hasAoo = (u: Combatant): boolean => !u.isHero || u.reactions.includes('aoo');

  /** Nimble Dodge: +2 AC against one incoming attack per interval. */
  const nimbleDodge = (target: Combatant, attacker: Combatant, s: EventStream, t: number): number => {
    if (!target.reactions.includes('nimbleDodge') || !reactionReady(target, t)) return 0;
    if (hasCondition(target, 'unconscious')) return 0;
    target.lastReactionTick = t;
    s.emit(t, 'combat.reaction_triggered', { unitId: target.id, reactionId: 'nimbleDodge', againstId: attacker.id });
    return 2;
  };

  /** One free strike from each ready, engaged AoO-capable enemy (adjacent cast / disengage). */
  const provokeReactions = (provoker: Combatant, allUnits: readonly Combatant[], s: EventStream, t: number, r: Rng): void => {
    for (const e of allUnits) {
      if (e.side === provoker.side || e.hp <= 0 || hasCondition(e, 'unconscious')) continue;
      if (!hasAoo(e) || !reactionReady(e, t)) continue;
      if (dist(e.pos, provoker.pos) > ENGAGEMENT_RANGE) continue;
      e.lastReactionTick = t;
      const reactEv = s.emit(t, 'combat.reaction_triggered', { unitId: e.id, reactionId: 'attackOfOpportunity', againstId: provoker.id });
      const strike = resolveStrike(e, provoker, { rng: r, flurryPenalty: 0, all: allUnits });
      const atkEv = s.emit(t, 'combat.attack_resolved', {
        attackerId: e.id, targetId: provoker.id, roll: strike.roll, flurryPenalty: 0, flanked: strike.flanked,
      }, reactEv.seq);
      if (strike.damage > 0) applyDamage(provoker, strike.damage, 'weapon', s, t, atkEv.seq);
      if (provoker.hp <= 0) return; // dropped — later reactors lose their trigger
    }
  };

  /** Move with disengage reactions: leaving an engaged enemy's zone provokes. */
  const moveWithReactions = (u: Combatant, rt: UnitRuntime, t: number): void => {
    const engagedBefore = all.filter(
      (e) => e.side !== u.side && e.hp > 0 && !hasCondition(e, 'unconscious') &&
        hasAoo(e) && dist(e.pos, u.pos) <= ENGAGEMENT_RANGE,
    );
    moveTick(u, all, rt, stream, t);
    for (const e of engagedBefore) {
      if (dist(e.pos, u.pos) > ENGAGEMENT_RANGE && reactionReady(e, t)) {
        e.lastReactionTick = t;
        const reactEv = stream.emit(t, 'combat.reaction_triggered', { unitId: e.id, reactionId: 'attackOfOpportunity', againstId: u.id });
        const strike = resolveStrike(e, u, { rng, flurryPenalty: 0, all });
        const atkEv = stream.emit(t, 'combat.attack_resolved', {
          attackerId: e.id, targetId: u.id, roll: strike.roll, flurryPenalty: 0, flanked: strike.flanked,
        }, reactEv.seq);
        if (strike.damage > 0) applyDamage(u, strike.damage, 'weapon', stream, t, atkEv.seq);
        if (u.hp <= 0) return;
      }
    }
  };

  /** Toggles/stances via the feat registry (Rage: raging + level temp HP; Monk stances). */
  const executeToggle = (u: Combatant, featId: number, s: EventStream, t: number): void => {
    const fx = featEffectsById.get(featId);
    if (!fx) return;
    const conditionId = TOGGLE_CONDITIONS[fx.featName];
    if (!conditionId) return;
    const onActivate = fx.raw['on_activate'] as Record<string, unknown> | undefined;
    if (onActivate?.['temp_hp'] === 'level') u.tempHp += u.level;
    u.conditions.set(conditionId, { value: 1, expiresAtTick: null });
    lastProgressTick = t;
    s.emit(t, 'combat.stance_changed', { unitId: u.id, stanceId: conditionId });
  };

  while (result === null) {
    tick++;

    // HANG guard — never pacing.
    if (tick >= ENCOUNTER.maxTicks) {
      hitMaxTicks = true;
      result = forceResolution(stream, tick);
      break;
    }

    for (const u of actionOrder) {
      // Timed condition expiry.
      for (const id of expireConditions(u, tick)) {
        stream.emit(tick, 'combat.condition_expired', { targetId: u.id, conditionId: id });
      }

      // Dying heroes roll recovery on the timer. Recovery churn counts as
      // PROGRESS — the silence window must not read a party mid-death-spiral
      // as a stalemate (harness finding, 2026-08-11).
      if (hasCondition(u, 'dying')) {
        const rt = runtime.get(u.id)!;
        if (tick - rt.lastDyingCheckTick >= DYING.recoveryIntervalTicks) {
          rt.lastDyingCheckTick = tick;
          const check = resolveDyingRecovery(u, rng);
          lastProgressTick = tick;
          stream.emit(tick, 'combat.dying_check_resolved', { unitId: u.id, roll: check.roll, dyingAfter: check.dyingAfter });
          if (check.died) {
            stream.emit(tick, 'combat.unit_died', { unitId: u.id });
          }
        }
        continue; // dying units take no actions
      }

      if (u.hp <= 0 || hasCondition(u, 'unconscious') || hasCondition(u, 'paralyzed')) continue;
      if (tick < u.nextActionTick) {
        // Not ready to act — but keep closing distance toward the chosen target.
        moveWithReactions(u, runtime.get(u.id)!, tick);
        continue;
      }

      u.flurrySwings = decayFlurry(u.flurrySwings, tick - u.lastSwingTick);

      // The loadout-priority layer decides what this unit DOES (core-loop D4).
      const picked = pickAction(u, all);
      const rt = runtime.get(u.id)!;

      // Toggles/stances (Rage, Monk stances): apply and spend the action.
      if (picked.entry.action === 'toggle') {
        executeToggle(u, picked.entry.featId, stream, tick);
        u.nextActionTick = tick + attackInterval(u);
        continue;
      }

      const target = picked.target;
      if (!target) break; // no valid targets anywhere — outer check will resolve
      if (rt.targetId !== target.id) {
        rt.targetId = target.id;
        stream.emit(tick, 'combat.unit_engaged', { unitId: u.id, targetId: target.id }, startEv.seq);
      }

      const reach = picked.entry.action === 'cast'
        ? spellRange(spellRow(picked.entry.spellId))
        : Math.max(u.weaponRange, ENGAGEMENT_RANGE * 0.99);

      // Move-then-act as one action: a unit that closes into range this tick
      // acts THIS tick — first to arrive is first to strike (with heroes-first
      // tie ordering, this is where the players-win-ties feel actually lands).
      if (dist(u.pos, target.pos) > reach) moveWithReactions(u, rt, tick);
      if (dist(u.pos, target.pos) > reach) continue; // still closing

      if (picked.entry.action === 'cast') {
        // Casting adjacent to an enemy provokes (the old adjacent-spellcast AoO).
        provokeReactions(u, all, stream, tick, rng);
        if (u.hp <= 0 || hasCondition(u, 'unconscious')) continue; // dropped mid-cast: fizzles, nothing spent
        const cast = resolveCast(u, picked.entry.spellId, target, all, tick, rng);
        const castEv = stream.emit(tick, 'combat.spell_cast', {
          casterId: u.id, spellId: String(cast.spell.id), resource: cast.resource, cost: cast.cost,
          tier: (cast.spell.spell_level as number | null) ?? 0,
        });
        emitCastResults(cast, u, stream, tick, castEv.seq);
        u.nextActionTick = tick + attackInterval(u);
        continue;
      }

      // Strike: basic attack = a burst; MAP lives INSIDE the burst (0/−5, agile 0/−4).
      for (let swing = 0; swing < ENCOUNTER.swingsPerAction; swing++) {
        if (target.hp <= 0 && !hasCondition(target, 'dying')) break;
        if (hasCondition(target, 'unconscious') && swing > 0) break; // don't wail on the downed
        const penalty = flurryPenalty(u.flurrySwings + swing, u.weaponAgile);
        const reactionAc = nimbleDodge(target, u, stream, tick);
        const strike = resolveStrike(u, target, { rng, flurryPenalty: penalty, reactionAcBonus: reactionAc, all });
        const atkEv = stream.emit(tick, 'combat.attack_resolved', {
          attackerId: u.id, targetId: target.id,
          roll: strike.roll, flurryPenalty: strike.flurryPenalty,
          flanked: strike.flanked, ...(strike.isSneakAttack ? { sneakDice: strike.sneakDamage } : {}),
        });
        if (strike.damage > 0) applyDamage(target, strike.damage, 'weapon', stream, tick, atkEv.seq);
      }
      u.flurrySwings += ENCOUNTER.swingsPerAction;
      u.lastSwingTick = tick;
      u.nextActionTick = tick + attackInterval(u);
    }

    // Terminal checks.
    if (livingFighters(all, 'enemies').length === 0) result = 'victory';
    else if (livingFighters(all, 'heroes').length === 0) result = 'defeat';
    else if (tick - lastProgressTick >= ENCOUNTER.stalemateWindowTicks) {
      result = forceResolution(stream, tick);
    }
  }

  stream.emit(tick, 'combat.ended', { combatId, result: result === 'stalemate' ? 'stalemate' : result, ticks: tick });
  return {
    result,
    ticks: tick,
    stream,
    survivors: {
      heroes: aliveAtAll(all, 'heroes').map((u) => u.id),
      enemies: aliveAtAll(all, 'enemies').map((u) => u.id),
    },
    hitMaxTicks,
  };
}

/** Ties-to-players in continuous time: equal totals → the hero starts strictly sooner. */
export function initiativeDelay(total: number, isHero: boolean): number {
  return Math.max(0, ENCOUNTER.initiativeBase - total - (isHero ? ENCOUNTER.heroTieBreakTicks : 0));
}

function attackInterval(u: Combatant): number {
  let interval = ENCOUNTER.attackIntervalTicks;
  if (hasCondition(u, 'hasted')) interval += ENCOUNTER.hastedIntervalDelta;
  if (hasCondition(u, 'slowed')) interval += ENCOUNTER.slowedIntervalDelta;
  if (hasCondition(u, 'stunned')) interval += ENCOUNTER.slowedIntervalDelta;
  return Math.max(interval, 5);
}

/** Per-tick motion; unit_moved events fire at waypoint granularity, never per tick. */
function moveTick(u: Combatant, all: readonly Combatant[], rt: UnitRuntime, stream: EventStream, tick: number): void {
  if (!rt.targetId) return;
  const target = all.find((t) => t.id === rt.targetId);
  if (!target || (target.hp <= 0 && !hasCondition(target, 'dying'))) return;
  if (!canMove(u)) return;
  const want = desiredPosition(u, target);
  if (want.x === u.pos.x && want.y === u.pos.y) return;
  const step = moveStep(u, speedMod(u), TICKS_PER_SECOND);
  const arrivedBefore = inAttackRange(u, target);
  // The room is the only spatial rule in the engine that isn't flanking, and it
  // applies HERE — one place, after the step, so `desiredPosition` stays free to
  // want something outside and the wall decides what it gets (brief #19 §9).
  u.pos = boundToRoom(stepToward(u.pos, want, step), ARENA);
  const arrivedAfter = inAttackRange(u, target);
  if (!arrivedBefore && arrivedAfter) {
    stream.emit(tick, 'combat.unit_moved', {
      unitId: u.id, toX: round2(u.pos.x), toY: round2(u.pos.y),
      purpose: dist(u.pos, target.pos) <= 2 ? 'engage' : 'standoff',
    });
  }
}

/** Soft anti-stall: the silence window trips → resolve by state, attackers hold nothing. */
function forceResolution(stream: EventStream, tick: number): 'stalemate' {
  stream.emit(tick, 'combat.stalemate_forced', { resolution: 'byState' });
  return 'stalemate';
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function spellRow(spellId: number): NonNullable<ReturnType<typeof spellsById.get>> {
  const row = spellsById.get(spellId);
  if (!row) throw new Error(`unknown spell ${spellId}`);
  return row;
}

/** Feat name → the condition its toggle applies (conditions.ts owns the modifiers). */
const TOGGLE_CONDITIONS: Record<string, import('./conditions').ConditionId> = {
  'Rage': 'raging',
  'Tiger Stance': 'tiger_stance',
  'Crane Stance': 'crane_stance',
  'Mountain Stance': 'mountain_stance',
};
