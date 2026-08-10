import { describe, expect, it } from 'vitest';
import { runEncounter } from '@sim/combat/encounter';
import { scaledDice } from '@sim/combat/spells';
import type { Combatant } from '@sim/combat/types';
import type { LoadoutEntry } from '@sim/combat/loadout';
import { spellsByName } from '@sim/registry';
import { combatant } from './conditions.test';

const spellId = (name: string): number => {
  const s = spellsByName.get(name);
  if (!s) throw new Error(`spell ${name} missing from registry`);
  return s.id;
};

const goblin = (id: string): Combatant =>
  combatant({ id, name: id, side: 'enemies', isHero: false, attackBonus: 4, damageDice: '1d6+1', maxHp: 10, hp: 10, ac: 14, initiativeBonus: 3 });

const wizard = (id: string, loadout: LoadoutEntry[], slots = [0, 3, 2, 1]): Combatant =>
  combatant({
    id, name: id, attackBonus: 3, damageDice: '1d4', maxHp: 18, hp: 18, ac: 14, isCaster: true,
    casting: { attackBonus: 7, dc: 17, casterLevel: 5, kind: 'slots', slots, pactEnergy: 0 },
    loadout,
  });

describe('spell scaling (the converted cantrip curves)', () => {
  it('Ray of Frost scales by caster level exactly as the data says', () => {
    const ray = spellsByName.get('Ray of Frost')!;
    expect(scaledDice(ray, 1)).toBe('1d4');
    expect(scaledDice(ray, 3)).toBe('2d4');
    expect(scaledDice(ray, 4)).toBe('2d4');
    expect(scaledDice(ray, 5)).toBe('1d6+2d4');
    expect(scaledDice(ray, 9)).toBe('4d4+1d6');
  });
});

describe('casting through the loadout layer', () => {
  it('a wizard fireballs the pack: AoE resolves with per-target basic saves', () => {
    const w = wizard('hero_1', [
      { action: 'cast', spellId: spellId('Fireball'), condition: { kind: 'always' }, target: 'scoredEnemy' },
    ]);
    const r = runEncounter('c1', 'r1', [w], [goblin('e1'), goblin('e2'), goblin('e3')], 'fireball_1');
    const casts = r.stream.byType('combat.spell_cast');
    expect(casts.length).toBeGreaterThan(0);
    expect(casts[0]!.data.resource).toBe('slot');
    const aoe = r.stream.byType('combat.aoe_resolved')[0]!;
    // Goblins are mid-charge by cast time, so the burst catches whoever's clustered.
    expect(aoe.data.targets.length).toBeGreaterThanOrEqual(2);
    for (const t of aoe.data.targets) {
      expect(['critSuccess', 'success', 'failure', 'critFailure']).toContain(t.save.degree);
      expect(t.save.dc).toBe(17);
    }
    // Basic save honored: any crit-success target took zero damage from that cast.
    const dmg = r.stream.byType('combat.damage_applied').filter((d) => d.cause === casts[0]!.seq);
    const critSavers = aoe.data.targets.filter((t) => t.save.degree === 'critSuccess').map((t) => t.unitId);
    for (const saved of critSavers) expect(dmg.some((d) => d.data.targetId === saved)).toBe(false);
  });

  it('slots deplete, then the caster falls back to striking', () => {
    // One level-3 slot: exactly one Fireball, then DEFAULT_STRIKE takes over.
    const w = wizard('hero_1', [
      { action: 'cast', spellId: spellId('Fireball'), condition: { kind: 'always' }, target: 'scoredEnemy' },
    ], [0, 0, 0, 1]);
    const r = runEncounter('c2', 'r1', [w], [goblin('e1'), goblin('e2'), goblin('e3'), goblin('e4')], 'deplete_1');
    expect(r.stream.byType('combat.spell_cast')).toHaveLength(1);
    const meleeSwings = r.stream.byType('combat.attack_resolved').filter((a) => a.data.attackerId === 'hero_1' && a.cause === undefined);
    expect(meleeSwings.length).toBeGreaterThan(0); // post-slot strikes happened
  });

  it('Magic Missile auto-hits: damage with neither attack roll nor save', () => {
    const w = wizard('hero_1', [
      { action: 'cast', spellId: spellId('Magic Missile'), condition: { kind: 'always' }, target: 'scoredEnemy' },
    ]);
    const r = runEncounter('c3', 'r1', [w], [goblin('e1')], 'mm_1');
    const cast = r.stream.byType('combat.spell_cast')[0]!;
    const dmg = r.stream.byType('combat.damage_applied').filter((d) => d.cause === cast.seq);
    expect(dmg.length).toBe(1);
    expect(r.stream.byType('combat.aoe_resolved').filter((e) => e.cause === cast.seq)).toHaveLength(0);
  });

  it('the cleric decides to heal: allyHpBelow gates, lowest ally targeted, slot spent', () => {
    const fighter = combatant({ id: 'hero_1', maxHp: 30, hp: 6 }); // badly hurt
    const cleric = combatant({
      id: 'hero_2', name: 'cleric', attackBonus: 5, damageDice: '1d6', maxHp: 24, hp: 24, ac: 16, isCaster: true,
      casting: { attackBonus: 6, dc: 16, casterLevel: 3, kind: 'slots', slots: [0, 2], pactEnergy: 0 },
      loadout: [
        { action: 'cast', spellId: spellId('Heal'), condition: { kind: 'allyHpBelow', pct: 0.5 }, target: 'lowestAlly' },
      ],
    });
    const r = runEncounter('c4', 'r1', [fighter, cleric], [goblin('e1'), goblin('e2')], 'heal_1');
    const heals = r.stream.byType('combat.healing_applied');
    expect(heals.length).toBeGreaterThan(0);
    expect(heals[0]!.data.targetId).toBe('hero_1');
    expect(heals[0]!.data.hpAfter).toBeGreaterThan(6);
  });

  it('warlock pact energy pays the hand-set curve', () => {
    const warlock = combatant({
      id: 'hero_1', attackBonus: 5, damageDice: '1d6', maxHp: 20, hp: 20, ac: 15, isCaster: true,
      casting: { attackBonus: 7, dc: 16, casterLevel: 5, kind: 'pact', slots: [], pactEnergy: 20 },
      loadout: [
        { action: 'cast', spellId: spellId('Fireball'), condition: { kind: 'always' }, target: 'scoredEnemy' },
      ],
    });
    const r = runEncounter('c5', 'r1', [warlock], [goblin('e1'), goblin('e2')], 'pact_1');
    const cast = r.stream.byType('combat.spell_cast')[0]!;
    expect(cast.data.resource).toBe('pact');
    expect(cast.data.cost).toBe(15); // level 3 on the 0/6/10/15/21/28/36 curve
    expect(r.stream.byType('combat.spell_cast').length).toBeLessThanOrEqual(2); // 20 energy: one cast, 5 left < 15
  });
});

describe('toggles and reactions', () => {
  it('Rage: stance_changed, raging condition, temp HP = level absorbing first', () => {
    const barb = combatant({
      id: 'hero_1', level: 5, maxHp: 40, hp: 40, attackBonus: 8, damageDice: '1d12+4',
      loadout: [
        { action: 'toggle', featId: 24, condition: { kind: 'notActive', conditionId: 'raging' } },
        { action: 'strike', condition: { kind: 'always' }, target: 'scoredEnemy' },
      ],
    });
    const r = runEncounter('c6', 'r1', [barb], [goblin('e1'), goblin('e2')], 'rage_1');
    const stance = r.stream.byType('combat.stance_changed')[0]!;
    expect(stance.data).toEqual({ unitId: 'hero_1', stanceId: 'raging' });
    // Toggle fired exactly once (notActive gate holds afterward).
    expect(r.stream.byType('combat.stance_changed')).toHaveLength(1);
    // Temp HP absorbed before real HP: first damage taken shows full amount but hpAfter accounts absorb.
    const hits = r.stream.byType('combat.damage_applied').filter((d) => d.data.targetId === 'hero_1');
    if (hits.length > 0) {
      expect(hits[0]!.data.hpAfter).toBeGreaterThanOrEqual(40 - Math.max(hits[0]!.data.amount - 5, 0));
    }
  });

  it('casting adjacent to an enemy provokes an attack of opportunity', () => {
    // Cleric heals itself while a goblin is in its face → intrinsic enemy AoO.
    const cleric = combatant({
      id: 'hero_1', maxHp: 24, hp: 10, ac: 16, isCaster: true,
      casting: { attackBonus: 6, dc: 16, casterLevel: 3, kind: 'slots', slots: [0, 3], pactEnergy: 0 },
      loadout: [
        { action: 'cast', spellId: spellId('Heal'), condition: { kind: 'selfHpBelow', pct: 0.99 }, target: 'self' },
      ],
    });
    const r = runEncounter('c7', 'r1', [cleric], [goblin('e1')], 'aoo_1');
    const reactions = r.stream.byType('combat.reaction_triggered');
    expect(reactions.some((e) => e.data.reactionId === 'attackOfOpportunity' && e.data.againstId === 'hero_1')).toBe(true);
  });

  it('Nimble Dodge fires once per interval against incoming strikes', () => {
    const rogue = combatant({ id: 'hero_1', ac: 16, reactions: ['nimbleDodge'] });
    const r = runEncounter('c8', 'r1', [rogue], [goblin('e1')], 'nd_1');
    const dodges = r.stream.byType('combat.reaction_triggered').filter((e) => e.data.reactionId === 'nimbleDodge');
    expect(dodges.length).toBeGreaterThan(0);
    // Never twice within one interval:
    for (let i = 1; i < dodges.length; i++) {
      expect(dodges[i]!.tick - dodges[i - 1]!.tick).toBeGreaterThanOrEqual(20);
    }
  });
});
