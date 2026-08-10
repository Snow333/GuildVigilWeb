/**
 * The continuous-time encounter loop — no player intervention once engaged
 * (core-loop D2). Single synchronous loop over 100ms ticks; every fact emits
 * into the EventStream; presentation and the harness both consume it.
 *
 * Anti-stall per the settled decision: NO hard duration cap as pacing — a
 * damage-silence window forces resolution by state; maxTicks exists only as
 * the HANG guard (its firing is a bug, and the harness treats it as one).
 */

import { ARENA, DYING, ENCOUNTER, TICKS_PER_SECOND } from '@content/combat';
import { EventStream } from '@sim/core/events/stream';
import { Rng } from '@sim/core/rng';
import { chooseTarget, desiredPosition, inAttackRange, moveStep, stepToward } from './ai';
import { decayFlurry, flurryPenalty } from './dice';
import { canMove, expireConditions, hasCondition, speedMod } from './conditions';
import { damageWhileDying, knockOut, resolveDyingRecovery } from './dying';
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

/** Line formation placement: side A on the left column, B on the right, vertically centered. */
export function placeFormation(units: Combatant[], side: Combatant['side']): void {
  const x = side === 'heroes' ? ARENA.sideAx : ARENA.sideBx;
  const startY = (ARENA.height - (units.length - 1)) / 2;
  units.forEach((u, i) => {
    u.pos = { x, y: startY + i };
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
        moveTick(u, all, runtime.get(u.id)!, stream, tick);
        continue;
      }

      u.flurrySwings = decayFlurry(u.flurrySwings, tick - u.lastSwingTick);

      const target = chooseTarget(u, all);
      if (!target) break; // no living enemies — outer check will resolve
      const rt = runtime.get(u.id)!;
      if (rt.targetId !== target.id) {
        rt.targetId = target.id;
        stream.emit(tick, 'combat.unit_engaged', { unitId: u.id, targetId: target.id }, startEv.seq);
      }

      // Move-then-strike as one action: a unit that closes into range this tick
      // swings THIS tick — first to arrive is first to strike (with heroes-first
      // tie ordering, this is where the players-win-ties feel actually lands).
      if (!inAttackRange(u, target)) moveTick(u, all, rt, stream, tick);

      if (inAttackRange(u, target)) {
        // Basic attack = a burst: MAP lives INSIDE the burst (0/−5, agile 0/−4).
        // The persistent counter carries into the burst for future rapid abilities.
        for (let swing = 0; swing < ENCOUNTER.swingsPerAction; swing++) {
          if (target.hp <= 0 && !hasCondition(target, 'dying')) break;
          if (hasCondition(target, 'unconscious') && swing > 0) break; // don't wail on the downed
          const penalty = flurryPenalty(u.flurrySwings + swing, u.weaponAgile);
          const strike = resolveStrike(u, target, { rng, flurryPenalty: penalty, all });
          const atkEv = stream.emit(tick, 'combat.attack_resolved', {
            attackerId: u.id, targetId: target.id,
            roll: strike.roll, flurryPenalty: strike.flurryPenalty,
            flanked: strike.flanked, ...(strike.isSneakAttack ? { sneakDice: strike.sneakDamage } : {}),
          });

          if (strike.damage > 0) {
            lastProgressTick = tick;
            if (hasCondition(target, 'dying')) {
              const newVal = damageWhileDying(target);
              const dmgEv = stream.emit(tick, 'combat.damage_applied', { targetId: target.id, amount: strike.damage, kind: 'weapon', hpAfter: 0 }, atkEv.seq);
              if (newVal >= DYING.deathAt) stream.emit(tick, 'combat.unit_died', { unitId: target.id }, dmgEv.seq);
            } else {
              target.hp = Math.max(target.hp - strike.damage, 0);
              const dmgEv = stream.emit(tick, 'combat.damage_applied', { targetId: target.id, amount: strike.damage, kind: 'weapon', hpAfter: target.hp }, atkEv.seq);
              if (target.hp === 0) {
                if (target.isHero) {
                  const dyingVal = knockOut(target);
                  stream.emit(tick, 'combat.unit_downed', { unitId: target.id, dyingValue: dyingVal }, dmgEv.seq);
                } else {
                  stream.emit(tick, 'combat.unit_died', { unitId: target.id }, dmgEv.seq);
                }
              }
            }
          }
        }
        u.flurrySwings += ENCOUNTER.swingsPerAction;
        u.lastSwingTick = tick;
        u.nextActionTick = tick + attackInterval(u);
      }
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
  u.pos = stepToward(u.pos, want, step);
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
