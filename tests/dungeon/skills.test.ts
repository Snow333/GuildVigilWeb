import { describe, expect, it } from 'vitest';
import type { DungeonTier } from '@content/dungeon';
import { assembleHero, assembleParty } from '@sim/campaign/assembly';
import { starterParty } from '@sim/campaign/starterParty';
import type { HeroState } from '@sim/heroes/types';
import type { EventStream } from '@sim/core/events/stream';
import type { SimEvent } from '@sim/core/events/types';
import type { DispatchHero } from '@sim/dungeon/checks';
import { runDungeonDispatch, type DungeonDispatchResult, type MissionProfile } from '@sim/dungeon/dispatch';

/**
 * TRACK S (M2) — Arcana, Religion, Survival, Deception on a REAL dungeon run.
 *
 * Why these tests drive `runDungeonDispatch` and read the stream: the defect
 * this repo keeps shipping is a feature that exists, is wired, and does nothing.
 * A test that calls `wardUndead()` and checks its return would pass with the
 * call site deleted. Every test below runs the dungeon twice on the SAME seed —
 * once with the skill on, once with it sabotaged — and asserts the OUTCOME the
 * player sees differs. Only the skill under test varies; every other mission
 * skill is switched off in both runs so nothing else can explain the gap.
 */

const OFF = -30; // `20 + mod < dc` for any DC in the game: the skill cannot succeed at all

type Skill = 'arcana' | 'religion' | 'survival' | 'deception';
const MISSION_SKILLS: readonly Skill[] = ['arcana', 'religion', 'survival', 'deception'];

/** A real, assembled L1 party. Only `on` skills keep a usable modifier. */
function party(on: Partial<Record<Skill, number>>): DispatchHero[] {
  const p = assembleParty(starterParty());
  for (const h of p) for (const s of MISSION_SKILLS) h.skills[s] = on[s] ?? OFF;
  return p;
}

interface Cell { tier: DungeonTier; difficulty: number; profile?: MissionProfile }

function run(cell: Cell, i: number, p: DispatchHero[]): DungeonDispatchResult {
  const seed = `trackS_${cell.tier}_d${cell.difficulty}_${i}`;
  return runDungeonDispatch({
    dispatchId: seed, partyId: 'party_1', party: p, tier: cell.tier, seed,
    profile: cell.profile ?? 'fullExplore', caution: 'standard', difficulty: cell.difficulty, partyLevel: 1,
  });
}

const used = (s: EventStream, skill: Skill) =>
  s.byType('explore.skill_used').filter((e) => e.data.skill === skill);
const won = (e: { data: { roll: { degree: string } } }) => e.data.roll.degree === 'success' || e.data.roll.degree === 'critSuccess';
/**
 * First blow of each attacker>target pair. `tick` and `d20` are kept because two
 * runs only stay comparable while they are in lock-step: once a fight diverges,
 * the same pair can swing at a different moment against a different situation.
 */
const firstAttackBy = (events: readonly SimEvent[]) => {
  const out = new Map<string, { modifier: number; dc: number; tick: number; d20: number }>();
  for (const e of events) {
    if (e.type !== 'combat.attack_resolved') continue;
    const key = `${e.data.attackerId}>${e.data.targetId}`;
    if (!out.has(key)) out.set(key, { modifier: e.data.roll.modifier, dc: e.data.roll.dc, tick: e.tick, d20: e.data.roll.d20 });
  }
  return out;
};
const inStep = (a: { tick: number; d20: number }, b: { tick: number; d20: number }) => a.tick === b.tick && a.d20 === b.d20;
/** Events from `combat.started` for room `roomId` to the next `combat.ended`. */
function fightIn(s: EventStream, roomId: string): SimEvent[] {
  const all = s.all();
  const start = all.findIndex((e) => e.type === 'combat.started' && e.data.roomId === roomId);
  if (start < 0) return [];
  const end = all.findIndex((e, i) => i > start && e.type === 'combat.ended');
  return all.slice(start, end < 0 ? undefined : end + 1);
}

describe('ARCANA — rune-sealed doors and traps', () => {
  it('breaks the runes on a door nobody else could open, in a real dungeon', () => {
    // A level-1 party in a deep dungeon: the hazard DCs are high enough that
    // doors really do stay shut, which is where Arcana earns its keep.
    const cell: Cell = { tier: 'medium', difficulty: 7 };
    let found: { i: number; edge: string } | null = null;
    for (let i = 0; i < 400 && !found; i++) {
      const on = run(cell, i, party({ arcana: 12 }));
      const opened = on.stream.byType('explore.lock_opened').find((e) => e.data.method === 'spell');
      if (!opened || used(on.stream, 'arcana').length === 0) continue;
      const off = run(cell, i, party({}));
      if (off.stream.byType('explore.route_blocked').some((b) => b.data.edgeId === opened.data.edgeId)) {
        found = { i, edge: opened.data.edgeId };
      }
    }
    expect(found, 'no seed in 400 where Arcana opened a door the control left shut').not.toBeNull();
    const on = run(cell, found!.i, party({ arcana: 12 }));
    const off = run(cell, found!.i, party({}));
    // The door: opened by Arcana with it, shut without.
    expect(on.stream.byType('explore.route_blocked').some((b) => b.data.edgeId === found!.edge)).toBe(false);
    expect(off.stream.byType('explore.route_blocked').some((b) => b.data.edgeId === found!.edge)).toBe(true);
    // The report fact the player reads.
    expect(used(on.stream, 'arcana').length).toBeGreaterThan(0);
    expect(used(off.stream, 'arcana')).toHaveLength(0);
    // And it bought something real: the party got further.
    expect(on.sealedRoutes).toBeLessThan(off.sealedRoutes);
  });

  it('disarms a runed trap with Arcana; the control walks into it', () => {
    // A level-1 party in a deep dungeon: the hazard DCs are high enough that
    // doors really do stay shut, which is where Arcana earns its keep.
    const cell: Cell = { tier: 'medium', difficulty: 7 };
    let found: { i: number; room: string } | null = null;
    for (let i = 0; i < 400 && !found; i++) {
      const on = run(cell, i, party({ arcana: 12 }));
      const dispelled = used(on.stream, 'arcana').find((e) => on.stream.byType('explore.trap_disarm_attempted').some((a) => a.data.skill === 'arcana' && a.data.heroId === e.data.heroId));
      if (!dispelled) continue;
      const off = run(cell, i, party({}));
      if (off.stream.byType('explore.trap_triggered').some((t) => t.data.trapId === `${dispelled.data.roomId}:trap`)) {
        found = { i, room: dispelled.data.roomId };
      }
    }
    expect(found, 'no seed in 400 where Arcana disarmed a trap the control triggered').not.toBeNull();
    const on = run(cell, found!.i, party({ arcana: 12 }));
    const off = run(cell, found!.i, party({}));
    expect(on.stream.byType('explore.trap_triggered').some((t) => t.data.trapId === `${found!.room}:trap`)).toBe(false);
    expect(off.stream.byType('explore.trap_triggered').some((t) => t.data.trapId === `${found!.room}:trap`)).toBe(true);
  });
});

describe('RELIGION — warding the undead', () => {
  const cell: Cell = { tier: 'small', difficulty: 3 };

  it('undead swing and defend worse in the fight, living foes do not', () => {
    let undead = 0;
    let living = 0;
    for (let i = 0; i < 120; i++) {
      const on = run(cell, i, party({ religion: 12 }));
      const ward = used(on.stream, 'religion').find((e) => e.data.amount > 0);
      if (!ward) continue;
      const off = run(cell, i, party({}));
      // First ward in the run: everything before it is identical in both runs.
      const a = firstAttackBy(fightIn(on.stream, ward.data.roomId));
      const b = firstAttackBy(fightIn(off.stream, ward.data.roomId));
      for (const [key, withWard] of a) {
        const without = b.get(key);
        if (!without || !inStep(withWard, without)) continue;
        // An undead target is easier to hit and an undead attacker hits worse,
        // by exactly the fear; a living creature in the same room is untouched.
        const diff = key.startsWith('hero_') ? without.dc - withWard.dc : without.modifier - withWard.modifier;
        expect([0, ward.data.amount], key).toContain(diff);
        if (diff === 0) living++; else undead++;
      }
    }
    expect(undead).toBeGreaterThan(5); // fear really reached attack and AC rolls
    expect(living).toBeGreaterThan(0); // and spared the living
  });

  it('wards only undead: a dungeon with none is identical with or without Religion', () => {
    let compared = 0;
    for (let i = 0; i < 120 && compared < 10; i++) {
      const on = run(cell, i, party({ religion: 12 }));
      if (used(on.stream, 'religion').length > 0) continue; // had undead — covered above
      const off = run(cell, i, party({}));
      expect(on.stream.hash()).toBe(off.stream.hash());
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('negative control: with no Religion the same fights go badly more often', () => {
    let dmgOn = 0, dmgOff = 0, fights = 0;
    for (let i = 0; i < 120; i++) {
      const on = run(cell, i, party({ religion: 12 }));
      const ward = used(on.stream, 'religion').find((e) => e.data.amount > 0);
      if (!ward) continue;
      const off = run(cell, i, party({}));
      const dmg = (s: EventStream, room: string) => fightIn(s, room).reduce((t, e) => (e.type === 'combat.damage_applied' && e.data.targetId.startsWith('hero_') ? t + e.data.amount : t), 0);
      dmgOn += dmg(on.stream, ward.data.roomId);
      dmgOff += dmg(off.stream, ward.data.roomId);
      fights++;
    }
    expect(fights).toBeGreaterThan(10);
    expect(dmgOn).toBeLessThan(dmgOff);
  });
});

describe('DECEPTION — a feint opens the fight', () => {
  const cell: Cell = { tier: 'small', difficulty: 3 };

  it('enemies are flat-footed (-2 AC) when the fight opens', () => {
    // Only the FIRST blow of a fight is compared: the two runs are identical up to
    // it, and afterwards the foe's own reactions (it raises a guard sooner when it
    // is hit sooner) legitimately move the numbers.
    let checked = 0;
    for (let i = 0; i < 120; i++) {
      const on = run(cell, i, party({ deception: 12 }));
      const feint = used(on.stream, 'deception').find((e) => e.data.amount > 0);
      if (!feint) continue;
      const first = (s: EventStream) => fightIn(s, feint.data.roomId).find((e) => e.type === 'combat.attack_resolved');
      const a = first(on.stream);
      const off = run(cell, i, party({}));
      const b = first(off.stream);
      if (a?.type !== 'combat.attack_resolved' || b?.type !== 'combat.attack_resolved') continue;
      if (!a.data.attackerId.startsWith('hero_') || a.tick !== b.tick || a.data.roll.d20 !== b.data.roll.d20) continue;
      expect(b.data.roll.dc - a.data.roll.dc, `seed ${i}`).toBe(2);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('negative control: with no Deception there is no feint and the rogue sneaks less', () => {
    let sneakOn = 0, sneakOff = 0, feints = 0;
    for (let i = 0; i < 60; i++) {
      const on = run(cell, i, party({ deception: 12 }));
      const off = run(cell, i, party({}));
      feints += used(on.stream, 'deception').filter((e) => e.data.amount > 0).length;
      expect(used(off.stream, 'deception').filter((e) => e.data.amount > 0)).toHaveLength(0);
      for (const e of on.stream.byType('combat.attack_resolved')) sneakOn += e.data.sneakDice ? 1 : 0;
      for (const e of off.stream.byType('combat.attack_resolved')) sneakOff += e.data.sneakDice ? 1 : 0;
    }
    expect(feints).toBeGreaterThan(10);
    expect(sneakOn).toBeGreaterThan(sneakOff);
  });
});

describe('SURVIVAL — foraging on a rest', () => {
  const cell: Cell = { tier: 'small', difficulty: 3 };

  it('a good forager heals the party more on a rest, and the party finishes healthier', () => {
    let wins = 0, healed = 0, hpOn = 0, hpOff = 0;
    for (let i = 0; i < 150; i++) {
      const pOn = party({ survival: 14 });
      const on = run(cell, i, pOn);
      const pOff = party({});
      const off = run(cell, i, pOff);
      const forages = used(on.stream, 'survival').filter(won);
      expect(used(off.stream, 'survival').filter(won)).toHaveLength(0); // sabotaged skill never forages
      if (forages.length === 0) continue; // only runs where the skill was actually called on
      wins += forages.length;
      healed += forages.reduce((t, e) => t + e.data.amount, 0);
      const hp = (p: DispatchHero[]) => p.reduce((t, h) => t + Math.max(h.c.hp, 0) / h.c.maxHp, 0);
      hpOn += hp(pOn);
      hpOff += hp(pOff);
    }
    expect(wins).toBeGreaterThan(5);
    expect(healed).toBeGreaterThan(0);
    expect(hpOn).toBeGreaterThan(hpOff);
  });
});

describe('ASSEMBLY — the four skills come off the hero sheet, never a default', () => {
  const read = (mutate: (h: HeroState) => void) => {
    const kit = starterParty()[0]!;
    mutate(kit.hero);
    return assembleHero(kit).skills;
  };
  const base = read(() => {});

  it('ranks reach DispatchHero.skills one for one', () => {
    const more = read((h) => {
      h.skills['arcana'] = (h.skills['arcana'] ?? 0) + 4;
      h.skills['religion'] = (h.skills['religion'] ?? 0) + 3;
      h.skills['survival'] = (h.skills['survival'] ?? 0) + 2;
      h.skills['deception'] = (h.skills['deception'] ?? 0) + 5;
    });
    expect(more.arcana - base.arcana).toBe(4);
    expect(more.religion - base.religion).toBe(3);
    expect(more.survival - base.survival).toBe(2);
    expect(more.deception - base.deception).toBe(5);
    // and nothing else moved
    expect(more.thievery).toBe(base.thievery);
    expect(more.perception).toBe(base.perception);
  });

  it('each skill keys off its own ability: arcana INT, religion and survival WIS, deception CHA', () => {
    // +4 to a score is +2 to its modifier (scores are even; a +1 would do nothing).
    const delta = (key: 'int' | 'wis' | 'cha') => {
      const s = read((h) => { h.abilities[key] += 4; });
      return {
        arcana: s.arcana - base.arcana, religion: s.religion - base.religion,
        survival: s.survival - base.survival, deception: s.deception - base.deception,
      };
    };
    expect(delta('int')).toEqual({ arcana: 2, religion: 0, survival: 0, deception: 0 });
    expect(delta('wis')).toEqual({ arcana: 0, religion: 2, survival: 2, deception: 0 });
    expect(delta('cha')).toEqual({ arcana: 0, religion: 0, survival: 0, deception: 2 });
  });

  it('a hero who trained a skill really does better on a mission than one who did not', () => {
    // The whole chain, no hand-set modifiers: sheet rank -> assembly -> dungeon.
    const trained = (rank: number): DispatchHero[] => {
      const kits = starterParty();
      for (const k of kits) k.hero.skills['religion'] = rank;
      const p = assembleParty(kits);
      for (const h of p) for (const s of ['arcana', 'survival', 'deception'] as const) h.skills[s] = OFF;
      return p;
    };
    let warded = 0, ward0 = 0;
    for (let i = 0; i < 120; i++) {
      const cell: Cell = { tier: 'small', difficulty: 3 };
      warded += used(run(cell, i, trained(10)).stream, 'religion').filter((e) => e.data.amount > 0).length;
      ward0 += used(run(cell, i, trained(0)).stream, 'religion').filter((e) => e.data.amount > 0).length;
    }
    expect(warded).toBeGreaterThan(ward0 + 5);
  });
});
