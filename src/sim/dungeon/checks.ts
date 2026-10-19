/**
 * Entry-check sequence — the Godot modal machine reborn as the AI's per-doorway
 * decision procedure emitting events (profile-AI brief). Ported mechanics:
 * best-modifier hero first; detection stops on first success; retries at
 * DC + 2·retries with rotation; disarm miss-by-<5 is safe; impossibility
 * (max roll < DC) is a blocked edge, never an infinite grind.
 */

import { HAZARDS, SKILL_PAYOFFS } from '@content/dungeon';
import type { EventStream } from '@sim/core/events/stream';
import type { RollBreakdown } from '@sim/core/events/types';
import type { Rng } from '@sim/core/rng';
import { applyCondition } from '@sim/combat/conditions';
import { determineDegree } from '@sim/combat/dice';
import type { Combatant } from '@sim/combat/types';
import type { RoomHazard } from './population';

export interface DispatchHero {
  c: Combatant;
  /**
   * Full check modifiers (rank + ability + feats), never a default. A skill that
   * silently reads 0 is indistinguishable from a skill that does nothing, which
   * is the defect this struct widened to end.
   *   perception / thievery / athletics - doorways, traps, locks, ambush
   *   arcana     - dispels the runes on sealed doors and traps
   *   religion   - wards the undead before a fight
   *   survival   - forages on a rest
   *   deception  - feints a fight open (the vision's "Trickery")
   */
  skills: {
    perception: number; thievery: number; athletics: number;
    arcana: number; religion: number; survival: number; deception: number;
  };
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

/** One way a hero can try a hazard: which skill, and what it is worth against THIS hazard. */
interface Approach { h: DispatchHero; mod: number; skill: 'thievery' | 'arcana' }

const byModThenId = (a: Approach, b: Approach): number => b.mod - a.mod || (a.h.c.id < b.h.c.id ? -1 : 1);

/**
 * Thievery against a hazard. Magic runes make hands-on work worse
 * (`runePenalty`); on a runed hazard every hero ALSO gets an Arcana approach,
 * which is the whole point of the skill.
 */
function thieveryApproaches(heroes: DispatchHero[], hazard: RoomHazard): Approach[] {
  const penalty = hazard.runed ? SKILL_PAYOFFS.arcana.runePenalty : 0;
  const out: Approach[] = heroes.map((h) => ({ h, mod: h.skills.thievery - penalty, skill: 'thievery' as const }));
  if (hazard.runed) for (const h of heroes) out.push({ h, mod: h.skills.arcana, skill: 'arcana' as const });
  return out;
}

/** Disarm with retry escalation + hero rotation; miss-by-<5 is a safe retry. */
export function disarmTrap(
  party: DispatchHero[], trap: RoomHazard, trapId: string,
  stream: EventStream, tick: number, rng: Rng, roomId: string = trapId,
): AttemptOutcome {
  const approaches = thieveryApproaches(activeHeroes(party), trap).sort(byModThenId);
  let retries = 0;
  for (const a of approaches) {
    for (;;) {
      const dc = trap.dc + HAZARDS.retryDcStep * retries;
      if (20 + a.mod < dc) break; // this approach's ceiling passed — rotate
      const roll = skillRoll(a.mod, dc, rng);
      stream.emit(tick, 'explore.trap_disarm_attempted', {
        trapId, roll, heroId: a.h.c.id, retry: retries, ...(a.skill === 'arcana' ? { skill: 'arcana' as const } : {}),
      });
      if (succeeded(roll)) {
        if (a.skill === 'arcana') {
          stream.emit(tick, 'explore.skill_used', { roomId, skill: 'arcana', effect: 'runes_dispelled', heroId: a.h.c.id, roll, amount: 0 });
        }
        return { ok: true, triggered: false, impossible: false };
      }
      retries++;
      if (dc - roll.total >= 5) return { ok: false, triggered: true, impossible: false }; // fumbled into it
    }
  }
  const anyoneCould = approaches.some((a) => 20 + a.mod >= trap.dc);
  return { ok: false, triggered: false, impossible: !anyoneCould || retries > 0 };
}

/**
 * Lock: pick (thievery) then force (athletics), same escalation; impossibility
 * detected. A RUNED lock is a spell as much as a lock: pick and force both lose
 * `runePenalty`, and Arcana can dispel it (method `spell`).
 */
export function openLock(
  party: DispatchHero[], lock: RoomHazard, edgeId: string,
  stream: EventStream, tick: number, rng: Rng, roomId: string = edgeId,
): AttemptOutcome {
  const heroes = activeHeroes(party);
  const penalty = lock.runed ? SKILL_PAYOFFS.arcana.runePenalty : 0;
  const attempts: { h: DispatchHero; mod: number; method: 'pick' | 'force' | 'spell' }[] = [
    ...heroes.map((h) => ({ h, mod: h.skills.thievery - penalty, method: 'pick' as const })),
    ...heroes.map((h) => ({ h, mod: h.skills.athletics - penalty, method: 'force' as const })),
    ...(lock.runed ? heroes.map((h) => ({ h, mod: h.skills.arcana, method: 'spell' as const })) : []),
  ].sort((a, b) => b.mod - a.mod || (a.h.c.id < b.h.c.id ? -1 : 1));

  let retries = 0;
  for (const a of attempts) {
    const dc = lock.dc + HAZARDS.retryDcStep * retries;
    if (20 + a.mod < dc) continue;
    const roll = skillRoll(a.mod, dc, rng);
    stream.emit(tick, 'explore.lock_attempted', { edgeId, method: a.method, roll, heroId: a.h.c.id, retry: retries });
    if (succeeded(roll)) {
      stream.emit(tick, 'explore.lock_opened', { edgeId, method: a.method }, stream.length - 1);
      if (a.method === 'spell') {
        stream.emit(tick, 'explore.skill_used', { roomId, skill: 'arcana', effect: 'runes_dispelled', heroId: a.h.c.id, roll, amount: 0 });
      }
      return { ok: true, triggered: false, impossible: false };
    }
    retries++;
  }
  return { ok: false, triggered: false, impossible: true };
}

// ── Religion · Survival · Deception (Track S) ──────────────────────────────
// Each is ONE roll by the party's best hero at that skill, drawn from a stream
// the caller owns. The roll is taken whether or not the skill is any good, so a
// high skill and a zero skill consume the same draws and a paired comparison of
// two parties on one seed isolates the skill itself.

/**
 * One roll, with the same ceiling rule the hazard checks use: a modifier that
 * cannot reach the DC on a natural 20 (`20 + mod < dc`) is a failure, full stop.
 * The die is still drawn so a hopeless party and a gifted one consume the same
 * stream. Without the clamp a nat 20 would "succeed" at any modifier, and a hero
 * with no skill would still ward the undead one time in twenty.
 */
function reachRoll(mod: number, dc: number, rng: Rng): RollBreakdown {
  const roll = skillRoll(mod, dc, rng);
  return 20 + mod < dc ? { ...roll, degree: 'failure', natStep: 0 } : roll;
}

const bestAt = (party: DispatchHero[], skill: keyof DispatchHero['skills']): DispatchHero | null =>
  activeHeroes(party).sort((a, b) => b.skills[skill] - a.skills[skill] || (a.c.id < b.c.id ? -1 : 1))[0] ?? null;

/** Religion: undead lose their nerve (`frightened`) for the whole fight. Living foes are untouched. */
export function wardUndead(
  party: DispatchHero[], undead: Combatant[], roomId: string, dc: number,
  stream: EventStream, tick: number, rng: Rng,
): void {
  const h = bestAt(party, 'religion');
  if (!h || undead.length === 0) return;
  const roll = reachRoll(h.skills.religion, dc, rng);
  const set = SKILL_PAYOFFS.religion.frightened;
  const value = roll.degree === 'critSuccess' ? set.critSuccess : roll.degree === 'success' ? set.success : 0;
  if (value > 0) for (const u of undead) applyCondition(u, 'frightened', value, null);
  stream.emit(tick, 'explore.skill_used', {
    roomId, skill: 'religion', effect: 'undead_warded', heroId: h.c.id, roll, amount: value, targets: value > 0 ? undead.length : 0,
  });
}

/** Deception: a feint as the fight opens — the enemy is flat-footed for a while. */
export function feintOpening(
  party: DispatchHero[], enemies: Combatant[], roomId: string, dc: number,
  stream: EventStream, tick: number, rng: Rng,
): void {
  const h = bestAt(party, 'deception');
  if (!h || enemies.length === 0) return;
  const roll = reachRoll(h.skills.deception, dc, rng);
  const set = SKILL_PAYOFFS.deception.flatFootedTicks;
  const ticks = roll.degree === 'critSuccess' ? set.critSuccess : roll.degree === 'success' ? set.success : 0;
  if (ticks > 0) for (const e of enemies) applyCondition(e, 'flat_footed', 1, ticks);
  stream.emit(tick, 'explore.skill_used', {
    roomId, skill: 'deception', effect: 'feint', heroId: h.c.id, roll, amount: ticks, targets: ticks > 0 ? enemies.length : 0,
  });
}

/** Survival: forage while resting. Returns the HP healed on top of the normal rest. */
export function forage(
  party: DispatchHero[], roomId: string, dc: number,
  stream: EventStream, tick: number, rng: Rng,
): number {
  const h = bestAt(party, 'survival');
  if (!h) return 0;
  const roll = reachRoll(h.skills.survival, dc, rng);
  const set = SKILL_PAYOFFS.survival.bonusHealFrac;
  const frac = roll.degree === 'critSuccess' ? set.critSuccess : roll.degree === 'success' ? set.success : 0;
  let healed = 0;
  if (frac > 0) {
    for (const m of party) {
      if (m.c.hp <= 0) continue; // the dead are not helped by a good meal
      const gain = Math.min(Math.floor(m.c.maxHp * frac), m.c.maxHp - m.c.hp);
      m.c.hp += gain;
      healed += gain;
    }
  }
  stream.emit(tick, 'explore.skill_used', { roomId, skill: 'survival', effect: 'forage', heroId: h.c.id, roll, amount: healed });
  return healed;
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
