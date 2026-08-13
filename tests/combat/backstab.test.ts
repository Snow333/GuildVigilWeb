import { describe, expect, it } from 'vitest';
import { assembleParty } from '@sim/campaign/assembly';
import { starterParty } from '@sim/campaign/starterParty';
import { buildEnemy } from '@sim/combat/build';
import { applyCondition } from '@sim/combat/conditions';
import { resolveStrike, rollConceal } from '@sim/combat/strike';
import type { Combatant } from '@sim/combat/types';
import { Rng } from '@sim/core/rng';
import { enemiesById } from '@sim/registry';
import { abilityMod } from '@sim/heroes/types';
import { combatant } from './conditions.test';

/**
 * THE BACKSTAB — the conceal check (brief #19 §§13–14, approved 2026-08-13).
 *
 *     attacker  = d20 + stealthTotal
 *     defender  = d20 + max(stealthTotal, perceptionTotal)   ← Steven's rule
 *     attacker wins ties → off-guard → sneak attack damage
 *
 * ⚠ WHY THESE TESTS ARE SHAPED LIKE THIS. Brief #19 §14.3 names two SILENT
 * failures — a missing `SKILL_ABILITY.stealth` entry (which would key the whole
 * mechanic off WIS) and an untrained rogue (which would leave it doing nothing).
 * Both ship a feature that runs, emits, and accomplishes nothing. So no test
 * here asserts that the code path executes; every one asserts an OUTCOME that
 * differs when the wiring is wrong.
 */

const SHADE = 1; // fighter, rogue, cleric, wizard
const GOBLIN = 1;

const shade = (): Combatant => assembleParty(starterParty())[SHADE]!.c;

/** Pass rate of the real check over many rolls — the only honest way to test dice. */
function passRate(attacker: Combatant, defender: Combatant, n: number, seed: string): number {
  const rng = new Rng(seed);
  let passed = 0;
  for (let i = 0; i < n; i++) {
    const r = rollConceal(attacker, defender, [attacker, defender], rng);
    if (r?.passed) passed++;
  }
  return passed / n;
}

describe('the conceal check — Stealth finally exists in the sim', () => {
  it('STEALTH KEYS OFF DEX, NOT WIS — the silent failure §14.3 names first', () => {
    const rogue = shade();
    const hero = starterParty()[SHADE]!.hero;
    const dexKeyed = (hero.skills['stealth'] ?? 0) + abilityMod(hero.abilities.dex);
    const wisKeyed = (hero.skills['stealth'] ?? 0) + abilityMod(hero.abilities.wis);

    // Leather Armor carries no check penalty, so the totals compare directly.
    expect(rogue.stealth).toBe(dexKeyed);
    // ⚠ The assertion that actually catches a missing SKILL_ABILITY entry:
    // `skill()` falls back to 'wis', and Shade's DEX (16) and WIS (12) differ,
    // so a regression lands on a DIFFERENT NUMBER rather than on an error.
    expect(rogue.stealth).not.toBe(wisKeyed);
    expect(dexKeyed).toBeGreaterThan(wisKeyed);
  });

  it('the founding muster trains Stealth on the ROGUE and nobody else', () => {
    const party = starterParty();
    expect(party[SHADE]!.hero.skills['stealth']).toBe(1);
    for (const i of [0, 2, 3]) expect(party[i]!.hero.skills['stealth']).toBeUndefined();
  });

  it('the armour check penalty is folded in — dead data since brief #16, now live', () => {
    const bare = shade();
    // Chain Shirt (id 22 is Leather; 23 is the Chain Shirt the bracket puts
    // Shade in from L3) carries armor_check_penalty −1.
    const kits = starterParty();
    kits[SHADE]!.equipped = [
      { baseId: '23', tier: 'mundane', propertyIds: [], seed: 'acp_test' },
      { baseId: '9', tier: 'mundane', propertyIds: [], seed: 'acp_test_w' },
    ];
    const armoured = assembleParty(kits)[SHADE]!.c;
    expect(armoured.stealth).toBeLessThan(bare.stealth);
  });
});

describe('the check itself', () => {
  it('the defender uses whichever of Stealth or Perception is HIGHER (a deliberate divergence)', () => {
    const rogue = combatant({ id: 'r', sneakAttackDice: '1d6', stealth: 99 });
    const sneaky = combatant({ id: 'e1', side: 'enemies', isHero: false, stealth: 40, perception: 0 });
    const alert = combatant({ id: 'e2', side: 'enemies', isHero: false, stealth: 0, perception: 40 });
    const rng = new Rng('which');
    expect(rollConceal(rogue, sneaky, [rogue, sneaky], rng)!.defenderUsed).toBe('stealth');
    expect(rollConceal(rogue, alert, [rogue, alert], rng)!.defenderUsed).toBe('perception');
    // PF2E would use Perception alone. Steven, 2026-08-13: "whichever is
    // higher" — a sneaky creature is also hard to sneak up on. Do not fix back.
    expect(rollConceal(rogue, sneaky, [rogue, sneaky], rng)!.defenderTotal).toBeGreaterThan(20);
  });

  it('the attacker wins ties', () => {
    const rogue = combatant({ id: 'r', sneakAttackDice: '1d6', stealth: 0 });
    const foe = combatant({ id: 'e', side: 'enemies', isHero: false, stealth: 0, perception: 0 });
    // Equal modifiers and a fair d20 each way: ties go to the attacker, so the
    // pass rate must sit ABOVE half, not at it.
    expect(passRate(rogue, foe, 4000, 'ties')).toBeGreaterThan(0.51);
  });

  it('NO CHECK AT ALL when the target is already off-guard — flanked means sneak, free', () => {
    const rogue = combatant({ id: 'r', sneakAttackDice: '1d6', stealth: 0 });
    const foe = combatant({ id: 'e', side: 'enemies', isHero: false, stealth: 99, perception: 99 });
    const rng = new Rng('offguard');
    expect(rollConceal(rogue, foe, [rogue, foe], rng)).not.toBeNull();
    applyCondition(foe, 'grabbed'); // off-guard by condition
    expect(rollConceal(rogue, foe, [rogue, foe], rng)).toBeNull();
  });

  it('and no check for anyone without sneak dice — this is Shade-only in practice', () => {
    const fighter = combatant({ id: 'f', sneakAttackDice: '' });
    const foe = combatant({ id: 'e', side: 'enemies', isHero: false });
    expect(rollConceal(fighter, foe, [fighter, foe], new Rng('nodice'))).toBeNull();
  });

  it('a passed check makes the target OFF-GUARD: sneak damage AND −2 AC', () => {
    const rogue = combatant({ id: 'r', sneakAttackDice: '4d6', attackBonus: 50 });
    const foe = combatant({ id: 'e', side: 'enemies', isHero: false, ac: 15 });
    const base = resolveStrike(rogue, foe, { rng: new Rng('ac'), flurryPenalty: 0, all: [rogue, foe] });
    const hidden = resolveStrike(rogue, foe, { rng: new Rng('ac'), flurryPenalty: 0, all: [rogue, foe], concealed: true });
    expect(base.isSneakAttack).toBe(false);
    expect(base.sneakDamage).toBe(0);
    expect(hidden.isSneakAttack).toBe(true);
    expect(hidden.sneakDamage).toBeGreaterThan(0);
    expect(hidden.roll.dc).toBe(base.roll.dc - 2); // off-guard is −2 AC, PF2E
  });
});

/**
 * ⚠ THE NEGATIVE CONTROL BRIEF #19 §14.3 DEMANDS BY NAME: *"a trained rogue
 * must out-roll a goblin measurably more often than an untrained one.
 * Asserting the code path runs is not enough."*
 */
describe('NC — Stealth RANKS are load-bearing, not decoration', () => {
  const goblin = (): Combatant => buildEnemy(GOBLIN, 'nc_goblin');

  it('a trained rogue out-conceals a goblin more often than an untrained one', () => {
    const trained = shade(); // muster-trained: 1 rank
    const untrained = { ...trained, stealth: trained.stealth - 1 };
    const foe = goblin();

    const N = 20000; // SE of the difference ≈ 0.5 points; the gap is ~5
    const tr = passRate(trained, foe, N, 'nc_trained');
    const un = passRate(untrained, foe, N, 'nc_untrained');
    expect({ trained: tr, untrained: un, gap: tr - un, ranksMatter: tr - un > 0.02 })
      .toMatchObject({ ranksMatter: true });
  });

  it('and the gap widens with ranks — the autopilot raising Stealth is worth something', () => {
    const rogue = shade();
    const foe = goblin();
    const N = 20000;
    const l1 = passRate(rogue, foe, N, 'nc_l1');
    // The autopilot's spill takes Shade to 6 ranks by L7 (measured 0/1/2/4/6 at
    // L1/2/3/5/7) — brief #19 §12.1 claims it never trains Stealth at all,
    // which is wrong, and this is the assertion that would catch it regressing.
    const l7 = passRate({ ...rogue, stealth: rogue.stealth + 5 }, foe, N, 'nc_l7');
    expect(l7).toBeGreaterThan(l1 + 0.15);
  });

  it('a goblin defends with its own DEX — enemies are not a static DC', () => {
    const g = buildEnemy(GOBLIN, 'g');
    // Goblin: level 1, DEX 14 (+2), WIS 10 (+0) → stealth 3, perception 1.
    expect({ stealth: g.stealth, perception: g.perception }).toEqual({ stealth: 3, perception: 1 });
    // ⚠ And THIS is why the pass rate does not fall with depth the way §13.4
    // predicted: under `max(stealth, perception)` the defender's number scales
    // with level exactly as the rogue's does. Measured flat, ~50%, L1 to L7.
    expect(g.stealth).toBeGreaterThan(g.perception);
  });
});

describe('AoO comes from content (§10.2)', () => {
  it('a goblin has no attack of opportunity; the hobgoblins that say so, do', () => {
    expect(buildEnemy(GOBLIN, 'g').reactions).toEqual([]);
    // Exactly five rows carry aoo_count ≥ 1: Hobgoblin Legionnaire, Hobgoblin
    // Tactician, Vanguard Champion, The Whisper's Blade (1) and
    // Vanguard-Captain Ruk Mor-Tal (2). Every other row says 0, and until this
    // pass every one of them got an AoO anyway.
    const named = [...enemiesById.keys()]
      .map((id) => buildEnemy(id, `x${id}`))
      .filter((c) => c.reactions.includes('aoo'))
      .map((c) => c.name)
      .sort();
    expect(named).toEqual([
      'Hobgoblin Legionnaire',
      'Hobgoblin Tactician',
      "The Whisper's Blade",
      'Vanguard Champion',
      'Vanguard-Captain Ruk Mor-Tal',
    ]);
    expect([...enemiesById.keys()].length - named.length).toBe(40); // the other 40 threaten nothing
  });
});
