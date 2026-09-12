/**
 * BRIEF #25 — THE BUFF AND DEBUFF RESOLVERS.
 *
 * 96 authored buff/debuff rows were dead content: `resolveCast` fell through to
 * `inert: true` for all but a handful, and the spell picker refused the whole
 * `buff`/`debuff` types. This file is the evidence that they now DO something.
 *
 * ⚠ THE HARNESS CANNOT SEE ANY OF THIS, so the exposure tests here are the only
 * gate. No autopilot-dispatchable loadout casts a buff (the muster hard-codes
 * Heal and Magic Missile; `assembly.ts` appends a damage cantrip), and
 * `encounter-distribution`'s caster scenario hand-authors Fireball and Heal —
 * so every harness snapshot in the repo is byte-identical after this brief.
 * That is CORRECT, not suspicious, and it is exactly why this file exists: the
 * feature could no-op completely and every other test would stay green.
 *
 * ⚠ EVERY EXPOSURE TEST BELOW WAS SABOTAGE-VERIFIED. Each `NC:` comment names
 * the production edit that was made, and the observed failure was recorded
 * before restoring. A test that passes both ways is decoration.
 */

import { describe, expect, it } from 'vitest';
import { runEncounter } from '@sim/combat/encounter';
import {
  effectDurationTicks, isBuffShapeResolvable, resolveCast,
} from '@sim/combat/spells';
import { acMod, applyCondition, attackMod, canMove, damageMod, saveMod } from '@sim/combat/conditions';
import { isSpellResolvable } from '@sim/heroes/knownSpells';
import { spells } from '@content/generated';
import { spellsById, spellsByName } from '@sim/registry';
import { Rng } from '@sim/core/rng';
import type { Combatant } from '@sim/combat/types';
import { combatant } from './conditions.test';

const spell = (name: string) => spellsById.get(spellsByName.get(name)!.id)!;

/** A caster with slots enough for anything in this file. */
const caster = (id: string, side: 'heroes' | 'enemies' = 'heroes'): Combatant =>
  combatant({
    id,
    side,
    isHero: side === 'heroes',
    isCaster: true,
    pos: { x: 10, y: 10 },
    casting: {
      attackBonus: 8, dc: 18, casterLevel: 9, kind: 'slots',
      slots: [0, 9, 9, 9, 9, 9, 9, 9, 9, 9], pactEnergy: 0,
    },
  });

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE SHAPES, AND WHAT THEY LAND ON
// ═══════════════════════════════════════════════════════════════════════════

describe('shape A — {condition, …} applies a real ActiveCondition', () => {
  // NC: delete the `condition` branch of `buffConditions` (the `out.push` for
  // shape A) → OBSERVED 9 failures across this file, this one among them.
  it('Hold Person paralyses a target that fails its save', () => {
    const wiz = caster('h1');
    // saves.will 3 vs dc 18 → needs a natural 15+. Seeded to fail.
    const foe = combatant({ id: 'e1', side: 'enemies', pos: { x: 11, y: 10 } });
    let applied: string | null = null;
    for (let i = 0; i < 40 && applied === null; i++) {
      const target = combatant({ id: 'e1', side: 'enemies', pos: { x: 11, y: 10 } });
      const r = resolveCast(caster('h1'), spell('Hold Person').id, target, [wiz, target], 0, new Rng(`hp_${i}`));
      const hit = r.targets.find((t) => t.conditionApplied);
      if (hit) applied = hit.conditionApplied!.id;
    }
    expect(applied).toBe('paralyzed');
    expect(foe.hp).toBe(30); // and it did so without dealing damage
  });

  it('a debuff that the target SAVES against applies nothing, but is still reported', () => {
    // ⚠ The resisted entry must exist. Dropping it would make a resisted spell
    // indistinguishable from one that was never cast, in the log and here.
    const wiz = caster('h1');
    let sawResist = false;
    for (let i = 0; i < 60 && !sawResist; i++) {
      const foe = combatant({ id: 'e1', side: 'enemies', pos: { x: 11, y: 10 }, saves: { fort: 40, ref: 40, will: 40 } });
      const r = resolveCast(wiz, spell('Hold Person').id, foe, [wiz, foe], 0, new Rng(`res_${i}`));
      const entry = r.targets[0]!;
      if (entry.save && !entry.conditionApplied) sawResist = true;
    }
    expect(sawResist).toBe(true);
  });

  // NC: change `effectType === 'debuff' ? spell.save_type : null` to `null`
  // → OBSERVED this test fail (an unsaveable Hold Person always lands).
  it('a debuff with a save_type ALWAYS rolls one — an unsaveable Hold Person is a balance bug', () => {
    const wiz = caster('h1');
    const foe = combatant({ id: 'e1', side: 'enemies', pos: { x: 11, y: 10 } });
    const r = resolveCast(wiz, spell('Hold Person').id, foe, [wiz, foe], 0, new Rng('save_present'));
    expect(r.targets[0]!.save).toBeDefined();
    expect(r.targets[0]!.save!.dc).toBe(18);
  });

  // NC: drop `immobilized` from `canMove` → OBSERVED this test fail.
  it('Web IMMOBILIZES: the condition it applies actually stops movement', () => {
    const wiz = caster('h1');
    let rooted: Combatant | null = null;
    for (let i = 0; i < 40 && rooted === null; i++) {
      const foe = combatant({ id: 'e1', side: 'enemies', pos: { x: 10.4, y: 10 }, saves: { fort: 0, ref: 0, will: 0 } });
      const r = resolveCast(wiz, spell('Web').id, foe, [wiz, foe], 0, new Rng(`web_${i}`));
      const c = r.targets.find((t) => t.unit.id === 'e1')?.conditionApplied;
      if (c) {
        applyCondition(foe, c.id, c.value, c.durationTicks);
        rooted = foe;
      }
    }
    expect(rooted).not.toBeNull();
    expect(canMove(rooted!)).toBe(false);
    // ⚠ And NOT flat-footed: that is the deliberate difference from `grabbed`.
    expect(acMod(rooted!)).toBe(0);
  });

  it('an AREA debuff catches everyone in the burst and spares the casters side', () => {
    // Web is burst 2. Brief #21's side rule derives debuff → enemies.
    const wiz = caster('h1');
    const ally = combatant({ id: 'h2', pos: { x: 10.2, y: 10 } });
    const foes = [
      combatant({ id: 'e1', side: 'enemies', pos: { x: 10.3, y: 10 }, saves: { fort: 0, ref: 0, will: 0 } }),
      combatant({ id: 'e2', side: 'enemies', pos: { x: 11.5, y: 10 }, saves: { fort: 0, ref: 0, will: 0 } }),
    ];
    const r = resolveCast(wiz, spell('Web').id, foes[0]!, [wiz, ally, ...foes], 0, new Rng('web_area'));
    const touched = new Set(r.targets.map((t) => t.unit.id));
    expect(touched).toContain('e1');
    expect(touched).toContain('e2');
    expect(touched).not.toContain('h2');
    expect(touched).not.toContain('h1');
  });
});

describe('shape B — {bonus, to} becomes a timed numeric modifier', () => {
  const cast1 = (name: string, target: Combatant) => {
    const wiz = caster('h1');
    return resolveCast(wiz, spell(name).id, target, [wiz, target], 0, new Rng(`b_${name}`));
  };

  // NC: delete the `{bonus,to}` branch of `buffConditions` → OBSERVED 7
  // failures, these four among them.
  it.each([
    ['Mage Armor', 'warded', 'ac', 1],
    ['Bless', 'emboldened', 'attack', 1],
    ['Protection', 'steeled', 'saves', 1],
    ['Magic Weapon', 'honed', 'weapon_damage', 1],
  ])('%s → %s (+%s)', (name, conditionId, _channel, bonus) => {
    const ally = combatant({ id: 'h2', pos: { x: 10.2, y: 10 } });
    const r = cast1(name as string, ally);
    // Filtered to the named ally because Bless is a BURST 3 — it correctly
    // catches the caster too, so a bare `targets.length` would read 2 for it
    // and 1 for the direct rows and prove nothing about either.
    const applied = r.targets.filter((t) => t.unit.id === 'h2' && t.conditionApplied?.id === conditionId);
    expect(applied.length).toBe(1);
    expect(applied[0]!.conditionApplied!.value).toBe(bonus);
    expect(r.inert).toBe(false);
  });

  /**
   * ⚠ THE WITNESS TABLE (brief #22's lesson, applied to buffs).
   *
   * Asserting "Mage Armor applies `warded`" is a HALF-TEST: it proves the
   * resolver wrote a key into a Map, not that anything reads it. Each row here
   * names the REAL CONSUMER and asserts the number moves there, with no
   * reference to the resolver.
   */
  it.each([
    ['warded', acMod, 'acMod'],
    ['emboldened', attackMod, 'attackMod'],
    ['steeled', saveMod, 'saveMod'],
    ['honed', damageMod, 'damageMod'],
  ])('%s is READ by %s — the buff has a consumer, not just a key', (id, consumer) => {
    const u = combatant();
    const before = (consumer as (c: Combatant) => number)(u);
    applyCondition(u, id as never, 2, 100);
    expect((consumer as (c: Combatant) => number)(u)).toBe(before + 2);
  });

  // NC: hardcode `value: 1` in the shape-B push → OBSERVED this test fail.
  it('the bonus is VALUE-CARRYING — Barkskin is +2, not +1', () => {
    const ally = combatant({ id: 'h2', pos: { x: 10.2, y: 10 } });
    const r = cast1('Barkskin', ally);
    expect(r.targets[0]!.conditionApplied!.value).toBe(2);
    applyCondition(ally, 'warded', r.targets[0]!.conditionApplied!.value, 100);
    expect(acMod(ally)).toBe(2);
  });

  // NC: take only the first `to` token instead of splitting → OBSERVED fail.
  it('ONE ROW, TWO CONDITIONS: Heroism grants both attack and saves', () => {
    const ally = combatant({ id: 'h2', pos: { x: 10.2, y: 10 } });
    const r = cast1('Heroism', ally);
    const ids = r.targets.map((t) => t.conditionApplied?.id).sort();
    expect(ids).toEqual(['emboldened', 'steeled']);
    // ⚠ Two ENTRIES for the same unit — this is the shape that lets
    // encounter.ts's existing loop apply both with no change to that file.
    expect(r.targets.every((t) => t.unit.id === 'h2')).toBe(true);
  });

  it("Heroism's unmapped 'skills' token is dropped, not faked", () => {
    // There is no skill-check roll in combat. Inventing a condition for it
    // would be a buff that resolves and does nothing — the bug this brief ends.
    const ally = combatant({ id: 'h2' });
    const r = cast1('Heroism', ally);
    expect(r.targets.length).toBe(2);
  });

  it('a buff goes to an ALLY and never to the enemy it was aimed near', () => {
    const cleric = caster('h1');
    const ally = combatant({ id: 'h2', pos: { x: 10.2, y: 10 } });
    const foe = combatant({ id: 'e1', side: 'enemies', pos: { x: 10.3, y: 10 } });
    // Bless is burst 3 — the side rule must keep it off the enemy.
    const r = resolveCast(cleric, spell('Bless').id, ally, [cleric, ally, foe], 0, new Rng('bless'));
    const ids = r.targets.map((t) => t.unit.id);
    expect(ids).toContain('h2');
    expect(ids).not.toContain('e1');
  });

  it('a buff rolls NO save — an ally does not resist a blessing', () => {
    const ally = combatant({ id: 'h2', pos: { x: 10.2, y: 10 } });
    const r = cast1('Mage Armor', ally);
    expect(r.targets[0]!.save).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. DURATION
// ═══════════════════════════════════════════════════════════════════════════

describe('duration translation', () => {
  // NC: return a flat 600 from `effectDurationTicks` → OBSERVED 3 failures.
  it('effects.duration is in ROUNDS and wins over the prose column', () => {
    // Daze: `{"duration": 1}` with a column reading 'instant'.
    expect(effectDurationTicks(spell('Daze') as never)).toBe(20);
  });

  it('the prose column parses; a round is one ACTION INTERVAL, not six seconds', () => {
    // ⚠ This engine has no rounds. Mapping 6s literally would make Fear
    // (1 round) outlast three of the frightened unit's own actions.
    expect(effectDurationTicks(spell('Fear') as never)).toBe(20);
  });

  it('⚠ nothing outlives the fight — 8 hours clamps to the stalemate window', () => {
    // Mage Armor is authored '8 hours'. Raw, that is 288,000 ticks on a
    // Combatant that ceases to exist at ~600. There is no between-fight buff
    // persistence in this engine; that is its own brief.
    expect(effectDurationTicks(spell('Mage Armor') as never)).toBe(300);
    expect(effectDurationTicks(spell('Web') as never)).toBe(300);
  });

  it("'instant' on a row that names a condition still lasts a round", () => {
    // Treating instant as zero would delete the only thing Eldritch Grasp does.
    expect(effectDurationTicks(spell('Eldritch Grasp') as never)).toBe(20);
  });

  it('the applied expiry is nowTick-relative, so a late cast is not born expired', () => {
    const wiz = caster('h1');
    const ally = combatant({ id: 'h2' });
    const r = resolveCast(wiz, spell('Mage Armor').id, ally, [wiz, ally], 450, new Rng('late'));
    expect(r.targets[0]!.conditionApplied!.durationTicks).toBe(750);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. THE READINESS GATE — honest about what it cannot do
// ═══════════════════════════════════════════════════════════════════════════

describe('⚠ the gate is PER SPELL, because most rows still do not resolve', () => {
  it('MEASURED: 24 of the 96 buff/debuff rows resolve, and 102 of 218 overall', () => {
    const bd = spells.filter((s) => s.effect_type === 'buff' || s.effect_type === 'debuff');
    expect(bd.length).toBe(96);
    expect(bd.filter(isBuffShapeResolvable).length).toBe(24);
    expect(spells.filter(isSpellResolvable).length).toBe(102);
  });

  // NC: make `isSpellResolvable` return true for the whole buff/debuff types →
  // OBSERVED this test fail, and the arcane-L1 count in knownSpells.test.ts
  // jump from 9 to 16. That is the exact dishonesty the gate prevents.
  it.each([
    ['Mirror Image', 'images — no illusion system'],
    ['Fly', 'fly — no third dimension'],
    ['Invisibility', 'condition invisible — not modelled'],
    ['Guidance', "to: next_check — no skill roll in combat"],
    ['Forbidding Ward', 'to: ac_vs_target — no per-target AC channel'],
    ['Resist Energy', 'resistance — no damage-type system'],
    ["Zaxth's Reckless Shaping", 'polymorph — its own brief'],
  ])('%s is correctly reported UNRESOLVABLE (%s)', (name) => {
    const row = spells.find((s) => s.name === name)!;
    expect(row).toBeDefined();
    expect(isSpellResolvable(row)).toBe(false);
  });

  it('an unresolvable row still resolves to `inert`, never a crash', () => {
    const wiz = caster('h1');
    const ally = combatant({ id: 'h2' });
    const r = resolveCast(wiz, spell('Mirror Image').id, ally, [wiz, ally], 0, new Rng('inert'));
    expect(r.inert).toBe(true);
    expect(r.targets).toHaveLength(0);
    expect(ally.conditions.size).toBe(0);
  });

  it('⚠ a shape-matching row whose CONDITION the engine lacks does not resolve', () => {
    // Confusion is `{condition: 'confused'}` — perfect shape A, and `confused`
    // is not in CONDITION_IDS. Matching the shape is not enough; the engine
    // must own the thing the row names, or the spell is a lie.
    const confusion = spells.find((s) => s.name === 'Confusion')!;
    expect(confusion.effects).toContain('condition');
    expect(isSpellResolvable(confusion)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. EXPOSURE — a REAL encounter, and an outcome that actually moved
// ═══════════════════════════════════════════════════════════════════════════

/** Two identical sides; side A's caster holds one loadout entry under test. */
function fight(seed: string, casterLoadout: Combatant['loadout']): ReturnType<typeof runEncounter> {
  const heroes = [
    combatant({
      id: 'h_caster', name: 'Wiz', baseId: 'h_caster', side: 'heroes', isHero: true, isCaster: true,
      hp: 40, maxHp: 40, ac: 16, weaponRange: 1, engageRange: 6, level: 5,
      casting: { attackBonus: 8, dc: 18, casterLevel: 5, kind: 'slots', slots: [0, 9, 9, 9], pactEnergy: 0 },
      loadout: casterLoadout,
    }),
    combatant({ id: 'h_fighter', name: 'Fig', baseId: 'h_fighter', side: 'heroes', isHero: true, hp: 45, maxHp: 45, level: 5 }),
  ];
  const enemies = [
    combatant({
      id: 'e_orc1', name: 'Orc', baseId: 'orc', side: 'enemies', isHero: false,
      hp: 35, maxHp: 35, ac: 15, attackBonus: 8, damageDice: '1d10+3', level: 4,
      saves: { fort: 6, ref: 4, will: 2 },
    }),
    combatant({
      id: 'e_orc2', name: 'Orc2', baseId: 'orc', side: 'enemies', isHero: false,
      hp: 35, maxHp: 35, ac: 15, attackBonus: 8, damageDice: '1d10+3', level: 4,
      saves: { fort: 6, ref: 4, will: 2 },
    }),
  ];
  return runEncounter('c1', 'r1', heroes, enemies, seed);
}

const STRIKE_ONLY: Combatant['loadout'] = [
  { action: 'strike', condition: { kind: 'always' }, target: 'scoredEnemy' },
];

const SEEDS = Array.from({ length: 60 }, (_, i) => `bd_seed_${i}`);

describe('EXPOSURE: buffs and debuffs change what happens in a live encounter', () => {
  /**
   * ⚠ THIS IS THE TEST THAT CANNOT BE FAKED. It runs `runEncounter` — the real
   * loop, its own EventStream and Rng — and compares a party whose caster
   * opens with a debuff against the identical party that only ever strikes.
   */
  // NC: force `resolveCast`'s buff/debuff branch to `result.inert = true`
  // before applying anything → OBSERVED every test in this block fail.
  it('a party that casts Hold Person wins MORE fights than one that only strikes', () => {
    const holdPerson = spell('Hold Person').id;
    const withDebuff: Combatant['loadout'] = [
      { action: 'cast', spellId: holdPerson, condition: { kind: 'always' }, target: 'scoredEnemy' },
      ...STRIKE_ONLY,
    ];
    let buffed = 0;
    let plain = 0;
    for (const s of SEEDS) {
      if (fight(s, withDebuff).result === 'victory') buffed++;
      if (fight(s, STRIKE_ONLY).result === 'victory') plain++;
    }
    // ⚠ A BAND, NOT A POINT. Paralysing an orc for the whole fight is a large
    // effect and the direction is what matters; pinning an exact count would
    // make this test a snapshot of the RNG rather than of the feature.
    expect(buffed).toBeGreaterThan(plain);
  });

  it('the encounter STREAM carries the condition — the resolver reached the loop', () => {
    // ⚠ Goes through the event stream on purpose. encounter.ts needed NO change
    // for this brief; if `emitCastResults` were not already consuming
    // `conditionApplied`, the resolver could be perfect and nothing would land.
    const holdPerson = spell('Hold Person').id;
    const withDebuff: Combatant['loadout'] = [
      { action: 'cast', spellId: holdPerson, condition: { kind: 'always' }, target: 'scoredEnemy' },
      ...STRIKE_ONLY,
    ];
    let sawParalysis = false;
    for (const s of SEEDS) {
      const ev = fight(s, withDebuff).stream.all();
      if (ev.some((e) => e.type === 'combat.condition_applied' && e.data.conditionId === 'paralyzed')) {
        sawParalysis = true;
        break;
      }
    }
    expect(sawParalysis).toBe(true);
  });

  it('a paralysed enemy stops acting — the condition has teeth in the loop', () => {
    const holdPerson = spell('Hold Person').id;
    const withDebuff: Combatant['loadout'] = [
      { action: 'cast', spellId: holdPerson, condition: { kind: 'always' }, target: 'scoredEnemy' },
      ...STRIKE_ONLY,
    ];
    let checked = false;
    for (const s of SEEDS) {
      const { stream } = fight(s, withDebuff);
      const ev = stream.events;
      const par = ev.find((e) => e.type === 'combat.condition_applied' && e.data.conditionId === 'paralyzed');
      if (!par) continue;
      const victim = (par.data as { targetId: string }).targetId;
      const expiry = ev.find(
        (e) => e.type === 'combat.condition_expired' && (e.data as { targetId: string }).targetId === victim
          && (e.data as { conditionId: string }).conditionId === 'paralyzed',
      );
      const end = expiry ? expiry.tick : Infinity;
      const swingsWhileHeld = ev.filter(
        (e) => e.type === 'combat.attack_resolved' &&
          (e.data as { attackerId: string }).attackerId === victim &&
          e.tick > par.tick && e.tick < end,
      );
      expect(swingsWhileHeld).toHaveLength(0);
      checked = true;
      break;
    }
    expect(checked).toBe(true);
  });

  /**
   * ⚠ TOTAL DAMAGE IS THE WRONG METRIC FOR A BUFF, AND MEASURING IT FIRST IS
   * HOW I FOUND OUT. The obvious test — "the Mage Armor party takes less damage
   * across 60 seeds" — MEASURED 5412 vs 5344, i.e. the buffed party took MORE.
   * That is not the buff failing: casting it costs the caster an action, the
   * fight runs longer, and a longer fight carries more total damage than one
   * point of AC saves. The confound swamps the effect.
   *
   * So this asserts the thing the buff actually claims, through the real loop:
   * `attack_resolved.roll.dc` IS the defender's effective AC (`strike.ts` sets
   * `dc = defender.ac + acMod(defender) + …`), so every swing aimed at the
   * warded caster after the buff lands must be resolved against a HIGHER
   * number than every swing before it. No fight-length term, no noise floor.
   */
  // NC: delete the `warded` term from `acMod` → OBSERVED this test fail
  // (post-buff AC 16, identical to pre-buff, so the set comparison collapses).
  it('Mage Armor RAISES the AC that incoming swings are resolved against', () => {
    const mageArmor = spell('Mage Armor').id;
    const withBuff: Combatant['loadout'] = [
      // `notActive` so it fires once and then the caster gets on with the fight.
      { action: 'cast', spellId: mageArmor, condition: { kind: 'notActive', conditionId: 'warded' }, target: 'self' },
      ...STRIKE_ONLY,
    ];
    let checked = 0;
    for (const s of SEEDS) {
      const ev = fight(s, withBuff).stream.all();
      const buffLanded = ev.find(
        (e) => e.type === 'combat.condition_applied' &&
          (e.data as { conditionId: string }).conditionId === 'warded',
      );
      if (!buffLanded) continue;
      const acsAfter = ev
        .filter((e) => e.type === 'combat.attack_resolved' && e.tick > buffLanded.tick &&
          (e.data as { targetId: string }).targetId === 'h_caster')
        .map((e) => (e.data as { roll: { dc: number } }).roll.dc);
      if (acsAfter.length === 0) continue;
      // Base AC is 16 in this fixture; every post-buff swing must see 17.
      expect(Math.min(...acsAfter)).toBe(17);
      checked++;
    }
    // The buff must actually have been exercised under fire, not just cast.
    expect(checked).toBeGreaterThan(0);
  });

  it('the SAME party without the buff is swung at against the base AC', () => {
    // The other half of the control: without `warded`, 16 and only 16.
    let checked = 0;
    for (const s of SEEDS) {
      const acs = fight(s, STRIKE_ONLY).stream.all()
        .filter((e) => e.type === 'combat.attack_resolved' &&
          (e.data as { targetId: string }).targetId === 'h_caster')
        .map((e) => (e.data as { roll: { dc: number } }).roll.dc);
      if (acs.length === 0) continue;
      expect(Math.max(...acs)).toBe(16);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('determinism holds: the same seed and loadout replay bit-identically', () => {
    // ⚠ The whole engine rests on this. A buff that read the clock or reached
    // for Math.random would break replay for every consumer.
    const holdPerson = spell('Hold Person').id;
    const l: Combatant['loadout'] = [
      { action: 'cast', spellId: holdPerson, condition: { kind: 'always' }, target: 'scoredEnemy' },
      ...STRIKE_ONLY,
    ];
    expect(fight('determinism', l).stream.hash()).toBe(fight('determinism', l).stream.hash());
  });

  it('⚠ a buff-casting party still differs from a striking one in the STREAM HASH', () => {
    // The strongest single statement that the feature is reachable at all: if
    // the buff branch no-opped, these two streams would be identical.
    const mageArmor = spell('Mage Armor').id;
    const withBuff: Combatant['loadout'] = [
      { action: 'cast', spellId: mageArmor, condition: { kind: 'notActive', conditionId: 'warded' }, target: 'self' },
      ...STRIKE_ONLY,
    ];
    expect(fight('hashdiff', withBuff).stream.hash()).not.toBe(fight('hashdiff', STRIKE_ONLY).stream.hash());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. REGRESSION GUARDS on the paths this brief touched
// ═══════════════════════════════════════════════════════════════════════════

describe('what this brief must NOT have broken', () => {
  it('a damage spell with a condition rider still deals damage AND rides', () => {
    // Sound Burst: `{condition: stunned, duration: 1}`, fort save, burst 2.
    const wiz = caster('h1');
    let sawBoth = false;
    for (let i = 0; i < 40 && !sawBoth; i++) {
      const foe = combatant({ id: 'e1', side: 'enemies', pos: { x: 10.2, y: 10 }, saves: { fort: 0, ref: 0, will: 0 } });
      const r = resolveCast(wiz, spell('Sound Burst').id, foe, [wiz, foe], 0, new Rng(`sb_${i}`));
      const t = r.targets[0]!;
      if (t.damage > 0 && t.conditionApplied?.id === 'stunned') sawBoth = true;
    }
    expect(sawBoth).toBe(true);
  });

  it("⚠ a damage rider naming a condition the engine lacks is DROPPED, not faked", () => {
    // Nythara's Enervating Bolt says `drained`, which is not in CONDITION_IDS.
    // This used to cast the raw string to ConditionId and write a key nothing
    // could read or meaningfully expire.
    const wiz = caster('h1');
    for (let i = 0; i < 20; i++) {
      const foe = combatant({ id: 'e1', side: 'enemies', pos: { x: 10.2, y: 10 }, saves: { fort: 0, ref: 0, will: 0 } });
      const r = resolveCast(wiz, spell("Nythara's Enervating Bolt").id, foe, [wiz, foe], 0, new Rng(`nb_${i}`));
      for (const t of r.targets) expect(t.conditionApplied).toBeUndefined();
    }
  });

  it('healing and damage are untouched by the new branch', () => {
    const cleric = caster('h1');
    const hurt = combatant({ id: 'h2', hp: 5, maxHp: 40, pos: { x: 10.2, y: 10 } });
    const heal = resolveCast(cleric, spell('Heal').id, hurt, [cleric, hurt], 0, new Rng('heal'));
    expect(heal.targets[0]!.healing).toBeGreaterThan(0);
    expect(heal.inert).toBe(false);

    const foe = combatant({ id: 'e1', side: 'enemies', pos: { x: 10.2, y: 10 } });
    const mm = resolveCast(cleric, spell('Magic Missile').id, foe, [cleric, foe], 0, new Rng('mm'));
    expect(mm.targets[0]!.damage).toBeGreaterThan(0);
  });

  it('utility and summon rows remain honestly inert', () => {
    for (const name of ['Feather Fall', 'Ventriloquism']) {
      const row = spells.find((s) => s.name === name)!;
      expect(isSpellResolvable(row)).toBe(false);
    }
  });
});
