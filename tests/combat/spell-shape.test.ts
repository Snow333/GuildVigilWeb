/**
 * Brief #21 — SPELL SHAPE. `aoe_shape` is the authority on direct-vs-area, and
 * `target_side` (declared, else derived) decides who an area spell may touch.
 *
 * ⚠ THE HARNESS IS ALMOST BLIND TO THIS, so the evidence lives here. No spell an
 * AUTOPILOT dispatch can cast reaches the area branch — Heal and Magic Missile
 * (the muster's two authored casts) and all ten damage cantrips carry
 * `aoe_size: 0`. The one exception is `encounter-distribution`'s caster scenario,
 * which HAND-AUTHORS Fireball; that snapshot moved on the side policy and its
 * shift is justified in the commit. Everything else must be asserted directly.
 *
 * Negative controls are recorded per assertion and were each observed to fail
 * with the term reverted and to pass with it restored.
 */
import { describe, expect, it } from 'vitest';
import { isAreaSpell, resolveCast } from '@sim/combat/spells';
import { spellsById, spellsByName } from '@sim/registry';
import { Rng } from '@sim/core/rng';
import { combatant } from './conditions.test';

const spell = (name: string) => spellsById.get(spellsByName.get(name)!.id)!;

/** A caster with enough slots to pay for anything in these tests. */
const caster = (id: string, side: 'heroes' | 'enemies' = 'heroes') =>
  combatant({
    id,
    side,
    isHero: side === 'heroes',
    isCaster: true,
    pos: { x: 10, y: 10 },
    casting: { attackBonus: 8, dc: 18, casterLevel: 9, kind: 'slots', slots: [0, 4, 4, 4, 4, 4, 4, 4, 4, 4], pactEnergy: 0 },
  });

describe('isAreaSpell — the discriminator', () => {
  // NC: invert the null check → the two counts swap and this fails.
  it('is true for every shaped row and false for every direct row', () => {
    const rows = [...spellsById.values()];
    const area = rows.filter(isAreaSpell);
    const direct = rows.filter((r) => !isAreaSpell(r));
    expect(area.length).toBe(62);
    expect(direct.length).toBe(156);
    expect(area.length + direct.length).toBe(218);
  });

  it('does not consult save_type — the old, wrong signal', () => {
    // Wall of Fire: a size-8 damage LINE with NO save. The old gate needed a
    // save and therefore resolved it single-target.
    const wall = spell('Wall of Fire');
    expect(wall.save_type).toBeNull();
    expect(isAreaSpell(wall)).toBe(true);

    // Chill Touch: HAS a save, but is direct. The old gate would splash it if
    // it carried a size; the shape column says it must not.
    const chill = spell('Chill Touch');
    expect(chill.save_type).not.toBeNull();
    expect(isAreaSpell(chill)).toBe(false);
  });

  it('every shaped row carries a size and vice versa — the content is consistent', () => {
    for (const r of spellsById.values()) {
      const shaped = (r.aoe_shape as string | null) != null;
      const sized = ((r.aoe_size as number | null) ?? 0) > 0;
      expect(shaped).toBe(sized);
    }
  });
});

describe('the 20 mis-gated spells now resolve as areas (§2)', () => {
  // NC: revert the healing branch to `[primary]` → a mass heal heals one ally.
  it('Heal Mass reaches EVERY ally in range, not just the primary', () => {
    const cleric = caster('h1');
    const a = combatant({ id: 'h2', pos: { x: 10.5, y: 10 }, hp: 5, maxHp: 40 });
    const b = combatant({ id: 'h3', pos: { x: 11, y: 10 }, hp: 5, maxHp: 40 });
    const all = [cleric, a, b];
    const r = resolveCast(cleric, spell('Heal Mass').id, a, all, 0, new Rng('mass_heal'));
    const healed = r.targets.filter((t) => t.healing > 0).map((t) => t.unit.id);
    expect(healed).toContain('h2');
    expect(healed).toContain('h3');
    expect(r.targets.length).toBeGreaterThan(1);
  });

  // NC: revert the damage gate to `saveType && aoe_size` → back to one target.
  it('Wall of Fire (line 8, no save) reaches more than one unit', () => {
    const wiz = caster('h1');
    const e1 = combatant({ id: 'e1', side: 'enemies', pos: { x: 10.5, y: 10 } });
    const e2 = combatant({ id: 'e2', side: 'enemies', pos: { x: 11.5, y: 10 } });
    const r = resolveCast(wiz, spell('Wall of Fire').id, e1, [wiz, e1, e2], 0, new Rng('wall'));
    expect(r.targets.length).toBeGreaterThan(1);
  });

  it('a DIRECT spell with a save still hits exactly one', () => {
    const wiz = caster('h1');
    const e1 = combatant({ id: 'e1', side: 'enemies', pos: { x: 10.2, y: 10 } });
    const e2 = combatant({ id: 'e2', side: 'enemies', pos: { x: 10.4, y: 10 } });
    const r = resolveCast(wiz, spell('Chill Touch').id, e1, [wiz, e1, e2], 0, new Rng('chill'));
    expect(r.targets.length).toBe(1);
    expect(r.targets[0]!.unit.id).toBe('e1');
  });
});

describe('side policy — declared wins, absent derives (§5)', () => {
  // NC: return 'all' from sideRule → the caster's own party lands in the burst.
  it('a damage burst does NOT catch the casters own side', () => {
    const wiz = caster('h1');
    const ally = combatant({ id: 'h2', pos: { x: 10.2, y: 10 } });
    const foe = combatant({ id: 'e1', side: 'enemies', pos: { x: 10.4, y: 10 } });
    const r = resolveCast(wiz, spell('Fireball').id, foe, [wiz, ally, foe], 0, new Rng('ff'));
    const hit = r.targets.map((t) => t.unit.id);
    expect(hit).toContain('e1');
    expect(hit).not.toContain('h2');
    expect(hit).not.toContain('h1'); // nor the caster itself
  });

  it('a healing burst does NOT heal the enemy', () => {
    const cleric = caster('h1');
    const ally = combatant({ id: 'h2', pos: { x: 10.2, y: 10 }, hp: 5, maxHp: 40 });
    const foe = combatant({ id: 'e1', side: 'enemies', pos: { x: 10.3, y: 10 }, hp: 5, maxHp: 40 });
    const r = resolveCast(cleric, spell('Heal Mass').id, ally, [cleric, ally, foe], 0, new Rng('hm'));
    const hit = r.targets.map((t) => t.unit.id);
    expect(hit).toContain('h2');
    expect(hit).not.toContain('e1');
  });

  it('an enemy caster mirrors the rule — its burst spares its own side', () => {
    // Guards against a hero-centric implementation. No enemy in the registry
    // casts today (isCaster is hardcoded false in buildEnemy), so this asserts
    // the RULE rather than current content.
    const evil = caster('e0', 'enemies');
    const minion = combatant({ id: 'e1', side: 'enemies', pos: { x: 10.2, y: 10 } });
    const hero = combatant({ id: 'h1', side: 'heroes', pos: { x: 10.3, y: 10 } });
    const r = resolveCast(evil, spell('Fireball').id, hero, [evil, minion, hero], 0, new Rng('evil'));
    const hit = r.targets.map((t) => t.unit.id);
    expect(hit).toContain('h1');
    expect(hit).not.toContain('e1');
  });

  it('all 218 rows leave target_side NULL — the derivation does the work', () => {
    // If this fails, someone authored an exception. That is legal, but the seed
    // says it must be deliberate, so the count is pinned.
    const declared = [...spellsById.values()].filter((r) => (r.target_side as string | null) != null);
    expect(declared.length).toBe(0);
  });
});

describe('brief #20 interaction — Large bodies eat more AoE', () => {
  // NC: drop `- u.radius` from areaTargets → the Large body escapes the burst.
  it('a Large body is caught by a burst that misses a Medium one', () => {
    const wiz = caster('h1');
    const size = (spell('Sound Burst').aoe_size as number) ?? 1;
    // Just outside the burst for a Medium body; inside for a Large one.
    const at = { x: 10 + size + 0.25, y: 10 };
    const mk = (radius: number) =>
      resolveCast(
        wiz,
        spell('Sound Burst').id,
        combatant({ id: 'e0', side: 'enemies', pos: { x: 10, y: 10 } }),
        [wiz, combatant({ id: 'e1', side: 'enemies', pos: at, radius })],
        0,
        new Rng('aoe_radius'),
      ).targets.map((t) => t.unit.id);

    expect(mk(0)).not.toContain('e1'); // Medium: out of the burst
    expect(mk(0.5)).toContain('e1'); // Large: its edge is inside
  });
});

describe('determinism', () => {
  it('the same cast on the same seed resolves identically, twice', () => {
    const build = () => {
      const wiz = caster('h1');
      const foes = [
        combatant({ id: 'e1', side: 'enemies', pos: { x: 10.2, y: 10 } }),
        combatant({ id: 'e2', side: 'enemies', pos: { x: 10.6, y: 10 } }),
        combatant({ id: 'e3', side: 'enemies', pos: { x: 11.1, y: 10 } }),
      ];
      return resolveCast(wiz, spell('Fireball').id, foes[0]!, [wiz, ...foes], 0, new Rng('det'));
    };
    const a = build();
    const b = build();
    // Order is load-bearing: emission order = resolution order.
    expect(a.targets.map((t) => t.unit.id)).toEqual(b.targets.map((t) => t.unit.id));
    expect(a.targets.map((t) => t.damage)).toEqual(b.targets.map((t) => t.damage));
  });
});
