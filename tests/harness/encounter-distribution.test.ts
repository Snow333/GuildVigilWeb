import { describe, expect, it } from 'vitest';
import { runEncounter } from '@sim/combat/encounter';
import type { Combatant } from '@sim/combat/types';
import { enemiesById } from '@sim/registry';
import { combatant } from '../combat/conditions.test';

/**
 * THE ENCOUNTER DISTRIBUTION HARNESS (migration-plan Phase 1.3: "stands up
 * here, not later"). Golden scenarios over seeded runs; results are FULLY
 * deterministic, so the snapshots are exact — any balance-affecting change
 * moves these numbers and must justify itself in the diff.
 *
 * Measured as distributions, not averages (teardown §3): win rate, stalemate
 * rate, death rate, duration quartiles.
 */

const N = 300;

/** Build a Combatant from a REAL converted enemy row. */
function fromRegistry(enemyId: number, instanceId: string): Combatant {
  const row = enemiesById.get(enemyId);
  if (!row) throw new Error(`no enemy ${enemyId}`);
  return combatant({
    id: instanceId, name: row.name, side: 'enemies', isHero: false,
    maxHp: row.hp, hp: row.hp, ac: row.ac,
    attackBonus: row.attack_bonus, damageDice: row.damage_dice,
    initiativeBonus: (row.base_level as number) + 2, // GD enemy initiative: d20 + level + 2
    speed: row.speed as number,
  });
}

const partyFighter = (id: string): Combatant =>
  combatant({ id, name: id, attackBonus: 7, damageDice: '1d8+3', maxHp: 28, hp: 28, ac: 17, initiativeBonus: 5 });

const partyRogue = (id: string): Combatant =>
  combatant({
    id, name: id, attackBonus: 7, damageDice: '1d6+2', maxHp: 22, hp: 22, ac: 16,
    weaponAgile: true, sneakAttackDice: '1d6', initiativeBonus: 7,
  });

interface Distribution {
  winRate: number;
  stalemateRate: number;
  heroDeathEvents: number;
  durationP50: number;
  durationP90: number;
  hangGuardHits: number;
}

function measure(scenario: string, mk: () => { heroes: Combatant[]; enemies: Combatant[] }): Distribution {
  let wins = 0, stalemates = 0, deaths = 0, hangs = 0;
  const durations: number[] = [];
  for (let i = 0; i < N; i++) {
    const { heroes, enemies } = mk();
    const r = runEncounter('h', 'r', heroes, enemies, `${scenario}_${i}`);
    if (r.result === 'victory') wins++;
    if (r.result === 'stalemate') stalemates++;
    if (r.hitMaxTicks) hangs++;
    deaths += r.stream.byType('combat.unit_died').filter((e) => e.data.unitId.startsWith('hero_')).length;
    durations.push(r.ticks);
  }
  durations.sort((a, b) => a - b);
  return {
    winRate: wins / N,
    stalemateRate: stalemates / N,
    heroDeathEvents: deaths,
    durationP50: durations[Math.floor(N * 0.5)]!,
    durationP90: durations[Math.floor(N * 0.9)]!,
    hangGuardHits: hangs,
  };
}

describe('encounter distribution harness — golden scenarios', () => {
  it('2 fighters + rogue vs 3 goblins (level-appropriate): heroes strongly favored, zero hangs', () => {
    const d = measure('goblins3', () => ({
      heroes: [partyFighter('hero_1'), partyFighter('hero_2'), partyRogue('hero_3')],
      enemies: [fromRegistry(1, 'e1'), fromRegistry(1, 'e2'), fromRegistry(1, 'e3')],
    }));
    expect(d.hangGuardHits).toBe(0);
    expect(d.stalemateRate).toBeLessThan(0.01);
    expect(d.winRate).toBeGreaterThan(0.9);
    expect(d).toMatchSnapshot(); // exact numbers — deterministic; drift must be justified
  });

  it('level-appropriate pressure: the party vs 3 Orc Warriors — winnable, never free', () => {
    // Orc Warrior (id 11): +7/AC 16/30hp/1d10 — the party's own weight class.
    const d = measure('orcs', () => ({
      heroes: [partyFighter('hero_1'), partyFighter('hero_2'), partyRogue('hero_3')],
      enemies: [fromRegistry(11, 'e1'), fromRegistry(11, 'e2'), fromRegistry(11, 'e3')],
    }));
    expect(d.hangGuardHits).toBe(0);
    expect(d.stalemateRate).toBeLessThan(0.01);
    expect(d.winRate).toBeGreaterThan(0.05); // not a guaranteed wipe...
    expect(d.winRate).toBeLessThan(0.98);    // ...and not free — the bimodal-collapse tripwire
    expect(d).toMatchSnapshot();
  });

  it('outnumbered: a LEVEL-1 hero vs 4 goblins — losses dominate but fights END', () => {
    // Level-appropriate lone hero (+5/AC 15/18hp): the goblins' actual prey band.
    const d = measure('outnumbered', () => ({
      heroes: [combatant({ id: 'hero_1', attackBonus: 5, damageDice: '1d8+2', maxHp: 18, hp: 18, ac: 15, initiativeBonus: 4 })],
      enemies: [fromRegistry(1, 'e1'), fromRegistry(1, 'e2'), fromRegistry(1, 'e3'), fromRegistry(1, 'e4')],
    }));
    expect(d.hangGuardHits).toBe(0);
    expect(d.winRate).toBeLessThan(0.6);
    expect(d.durationP90).toBeLessThan(2000); // fights conclude in ~3 sim-minutes even when grim
    expect(d).toMatchSnapshot();
  });
});
