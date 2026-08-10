/**
 * Entry-check sequence — the Godot modal machine reborn as the AI's per-doorway
 * decision procedure emitting events (profile-AI brief). Ported mechanics:
 * best-modifier hero first; detection stops on first success; retries at
 * DC + 2·retries with rotation; disarm miss-by-<5 is safe; impossibility
 * (max roll < DC) is a blocked edge, never an infinite grind.
 */

import { HAZARDS } from '@content/dungeon';
import type { EventStream } from '@sim/core/events/stream';
import type { RollBreakdown } from '@sim/core/events/types';
import type { Rng } from '@sim/core/rng';
import { determineDegree } from '@sim/combat/dice';
import type { Combatant } from '@sim/combat/types';
import type { RoomHazard } from './population';

export interface DispatchHero {
  c: Combatant;
  skills: { perception: number; thievery: number; athletics: number };
}

const activeHeroes = (party: DispatchHero[]): DispatchHero[] =>
  party.filter((h) => h.c.hp > 0 && !h.c.conditions.has('unconscious'));

function skillRoll(mod: number, dc: number, rng: Rng): RollBreakdown {
  const d20 = rng.die(20);
  const { degree, natStep } = determineDegree(d20 + mod, dc, d20);
  return { d20, modifier: mod, total: d20 + mod, dc, degree, natStep };
}

const succeeded = (r: RollBreakdown): boolean => r.degree === 'success' || r.degree === 'critSuccess';

/** Detection (ported): heroes best-modifier first, stop on the first success. */
export function detectTrap(
  party: DispatchHero[], trap: RoomHazard, roomId: string, trapId: string,
  stream: EventStream, tick: number, rng: Rng, autoDetect: boolean,
): boolean {
  const detectDc = trap.dc - 2; // spotting is easier than defusing
  const heroes = activeHeroes(party).sort((a, b) => b.skills.perception - a.skills.perception || (a.c.id < b.c.id ? -1 : 1));
  if (autoDetect && heroes.length > 0) {
    // Trap Finder's dungeon bonus: automatic detection, no roll spent.
    const roll: RollBreakdown = { d20: 20, modifier: 0, total: 20, dc: detectDc, degree: 'critSuccess', natStep: 0 };
    stream.emit(tick, 'explore.trap_detected', { roomId, trapId, roll, heroId: heroes[0]!.c.id });
    trap.detected = true;
    return true;
  }
  for (const h of heroes) {
    const roll = skillRoll(h.skills.perception, detectDc, rng);
    if (succeeded(roll)) {
      stream.emit(tick, 'explore.trap_detected', { roomId, trapId, roll, heroId: h.c.id });
      trap.detected = true;
      return true;
    }
  }
  return false;
}

export interface AttemptOutcome {
  ok: boolean;
  /** Trap fired during the attempt (disarm miss by ≥5). */
  triggered: boolean;
  /** No hero can EVER beat the escalated DC — blocked, stop grinding. */
  impossible: boolean;
}

/** Disarm with retry escalation + hero rotation; miss-by-<5 is a safe retry. */
export function disarmTrap(
  party: DispatchHero[], trap: RoomHazard, trapId: string,
  stream: EventStream, tick: number, rng: Rng,
): AttemptOutcome {
  const heroes = activeHeroes(party).sort((a, b) => b.skills.thievery - a.skills.thievery || (a.c.id < b.c.id ? -1 : 1));
  let retries = 0;
  for (const h of heroes) {
    for (;;) {
      const dc = trap.dc + HAZARDS.retryDcStep * retries;
      if (20 + h.skills.thievery < dc) break; // this hero's ceiling passed — rotate
      const roll = skillRoll(h.skills.thievery, dc, rng);
      stream.emit(tick, 'explore.trap_disarm_attempted', { trapId, roll, heroId: h.c.id, retry: retries });
      if (succeeded(roll)) return { ok: true, triggered: false, impossible: false };
      retries++;
      if (dc - roll.total >= 5) return { ok: false, triggered: true, impossible: false }; // fumbled into it
    }
  }
  const anyoneCould = heroes.some((h) => 20 + h.skills.thievery >= trap.dc);
  return { ok: false, triggered: false, impossible: !anyoneCould || retries > 0 };
}

/** Lock: pick (thievery) then force (athletics), same escalation; impossibility detected. */
export function openLock(
  party: DispatchHero[], lock: RoomHazard, edgeId: string,
  stream: EventStream, tick: number, rng: Rng,
): AttemptOutcome {
  const heroes = activeHeroes(party);
  const attempts: { h: DispatchHero; mod: number; method: 'pick' | 'force' }[] = [
    ...heroes.map((h) => ({ h, mod: h.skills.thievery, method: 'pick' as const })),
    ...heroes.map((h) => ({ h, mod: h.skills.athletics, method: 'force' as const })),
  ].sort((a, b) => b.mod - a.mod || (a.h.c.id < b.h.c.id ? -1 : 1));

  let retries = 0;
  for (const a of attempts) {
    const dc = lock.dc + HAZARDS.retryDcStep * retries;
    if (20 + a.mod < dc) continue;
    const roll = skillRoll(a.mod, dc, rng);
    stream.emit(tick, 'explore.lock_attempted', { edgeId, method: a.method, roll, heroId: a.h.c.id, retry: retries });
    if (succeeded(roll)) {
      stream.emit(tick, 'explore.lock_opened', { edgeId, method: a.method }, stream.length - 1);
      return { ok: true, triggered: false, impossible: false };
    }
    retries++;
  }
  return { ok: false, triggered: false, impossible: true };
}

/** Ambush tiers from party perception (ported: everyone rolls, best total counts). */
export function ambushTier(
  party: DispatchHero[], detectDc: number, rng: Rng,
): 'partySurprise' | 'normal' | 'partial' | 'severe' | 'total' {
  const best = Math.max(...activeHeroes(party).map((h) => rng.die(20) + h.skills.perception), 0);
  if (best >= detectDc + 10) return 'partySurprise';
  if (best >= detectDc) return 'normal';
  if (best >= detectDc - 5) return 'partial';
  if (best >= detectDc - 10) return 'severe';
  return 'total';
}
