import { describe, expect, it } from 'vitest';
import { initiativeDelay, runEncounter } from '@sim/combat/encounter';
import type { Combatant } from '@sim/combat/types';
import { combatant } from './conditions.test';

const fighter = (id: string): Combatant =>
  combatant({ id, name: id, attackBonus: 7, damageDice: '1d8+3', maxHp: 28, hp: 28, ac: 17 });

const goblin = (id: string): Combatant =>
  combatant({
    id, name: id, side: 'enemies', isHero: false, attackBonus: 4, damageDice: '1d6+1',
    maxHp: 10, hp: 10, ac: 14, initiativeBonus: 3,
  });

describe('the continuous-time encounter loop', () => {
  it('a 2v2 resolves, emits a well-formed stream, and is DETERMINISTIC by seed', () => {
    const run = () => runEncounter('c1', 'r1', [fighter('hero_1'), fighter('hero_2')], [goblin('e1'), goblin('e2')], 'enc_det');
    const a = run();
    const b = run();
    expect(a.stream.hash()).toBe(b.stream.hash());
    expect(a.result).toBe(b.result);

    // Stream contract: started first, ended last, damage has cause chains to attacks.
    const events = a.stream.all();
    expect(events[0]!.type).toBe('combat.started');
    expect(events[events.length - 1]!.type).toBe('combat.ended');
    const dmg = a.stream.byType('combat.damage_applied');
    expect(dmg.length).toBeGreaterThan(0);
    for (const d of dmg) {
      const chain = a.stream.chainOf(d.seq).map((e) => e.type);
      expect(chain).toContain('combat.attack_resolved');
    }
  });

  it('overwhelming heroes win; overwhelming enemies force a defeat with heroes downed, not deleted', () => {
    const stomp = runEncounter('c2', 'r1', [fighter('hero_1'), fighter('hero_2')], [goblin('e1')], 'enc_stomp');
    expect(stomp.result).toBe('victory');
    expect(stomp.hitMaxTicks).toBe(false);

    const doom = runEncounter('c3', 'r1',
      [combatant({ id: 'hero_1', maxHp: 8, hp: 8, ac: 10, attackBonus: 0, damageDice: '1d2' })],
      [goblin('e1'), goblin('e2'), goblin('e3'), goblin('e4')], 'enc_doom');
    expect(doom.result).toBe('defeat');
    // The hero went DOWN (dying), not vaporized — unless recovery checks killed them.
    const downed = doom.stream.byType('combat.unit_downed');
    expect(downed.length).toBeGreaterThanOrEqual(1);
  });

  it('unit_moved fires at waypoint granularity, never per tick', () => {
    const r = runEncounter('c4', 'r1', [fighter('hero_1')], [goblin('e1')], 'enc_move');
    const moves = r.stream.byType('combat.unit_moved');
    // Combatants cross ~8 units of arena in ~0.5-unit steps: per-tick emission
    // would be dozens of events. Waypoint rule keeps it to a handful.
    expect(moves.length).toBeLessThan(6);
  });

  it('SOFT ANTI-STALL: two sides that cannot reach each other stalemate via the silence window', () => {
    // Both permanently grabbed: canMove() false, out of range forever.
    const pacifist = combatant({ id: 'hero_1', weaponRange: 1 });
    const distant = combatant({ id: 'e1', side: 'enemies', isHero: false, weaponRange: 1 });
    pacifist.conditions.set('grabbed', { value: 1, expiresAtTick: null });
    distant.conditions.set('grabbed', { value: 1, expiresAtTick: null });
    const r = runEncounter('c5', 'r1', [pacifist], [distant], 'enc_stall');
    expect(r.result).toBe('stalemate');
    expect(r.stream.byType('combat.stalemate_forced')).toHaveLength(1);
    expect(r.hitMaxTicks).toBe(false); // the window resolved it, not the HANG guard
    expect(r.ticks).toBeLessThan(400); // ~stalemateWindowTicks, not maxTicks
  });

  it('initiative: ties-to-players is structural — equal totals give the hero a strictly earlier start', () => {
    // The mechanism, tested exactly: same roll+bonus → hero delay is smaller.
    for (let total = 1; total <= 30; total++) {
      expect(initiativeDelay(total, true)).toBeLessThanOrEqual(initiativeDelay(total, false));
      if (initiativeDelay(total, false) > 0) {
        expect(initiativeDelay(total, true)).toBeLessThan(initiativeDelay(total, false));
      }
    }
  });

  it('initiative: no systematic first-strike disadvantage for heroes (behavioral sanity band)', () => {
    // The shave is a near-tie edge (~52% expected) — assert absence of bias, not the
    // sliver itself, which would need thousands of samples to resolve.
    let heroFirst = 0;
    const N = 60;
    for (let i = 0; i < N; i++) {
      const r = runEncounter('ci', 'r1', [fighter('hero_1')], [goblin('e1')], `enc_init_${i}`);
      const first = r.stream.byType('combat.attack_resolved')[0];
      if (first && first.data.attackerId === 'hero_1') heroFirst++;
    }
    expect(heroFirst).toBeGreaterThan(N * 0.35);
    expect(heroFirst).toBeLessThan(N * 0.65);
  });
});
