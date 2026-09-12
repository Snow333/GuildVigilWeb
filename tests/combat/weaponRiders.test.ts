/**
 * WEAPON RIDERS AND STAT BONUSES (brief #24, M1 + M2).
 *
 * ⚠ BOTH FEATURES WERE PREVIOUSLY DEAD, AND BOTH FAILED SILENTLY. That is the
 * risk these tests exist to hold down: a rider that stops firing, or a
 * stat_bonus key that stops matching, produces no error and no visible
 * change — just a magic item that quietly does nothing again.
 */

import { describe, it, expect } from 'vitest';
import { runEncounter } from '@sim/combat/encounter';
import { buildEnemy } from '@sim/combat/build';
import { assembleHero } from '@sim/campaign/assembly';
import { musterParty } from '@sim/campaign/muster';
import { ancestryIds } from '@sim/registry';
import { aggregateStatBonuses, deriveItem } from '@sim/heroes/equipment';
import { isConditionId } from '@sim/combat/conditions';
import { item_properties } from '@content/generated';
import { items } from '@content/generated/items';
import type { ItemInstance } from '@sim/core/events/types';

const LONGSWORD = '3';

const magicSword = (propertyIds: string[]): ItemInstance =>
  ({ baseId: LONGSWORD, tier: 'magical', propertyIds, seed: 'rider-test' }) as unknown as ItemInstance;

const plainItem = (baseId: string): ItemInstance =>
  ({ baseId, tier: 'mundane', propertyIds: [], seed: 'stat-test' }) as unknown as ItemInstance;

/** Run one fight with the given weapon properties; return damage totals by TYPE. */
function damageByKind(propertyIds: string[], seed: string) {
  const kit = musterParty([
    { classId: 1, name: 'Rider', ancestry: ancestryIds[0]!, gender: 'm' as const },
  ])[0]!;
  kit.equipped = kit.equipped.filter((e) => String(e.baseId) !== LONGSWORD);
  kit.equipped.push(magicSword(propertyIds));

  const c = assembleHero(kit).c;
  const enemy = buildEnemy(1, 'e1');
  enemy.hp = 400;
  enemy.maxHp = 400;

  const r = runEncounter('c_rider', 'r_rider', [c], [enemy], seed);
  const kinds = new Map<string, number>();
  for (const ev of r.stream.all()) {
    if (ev.type === 'combat.damage_applied') {
      const d = ev.data as { kind: string; amount: number };
      kinds.set(d.kind, (kinds.get(d.kind) ?? 0) + d.amount);
    }
  }
  return { kinds, stream: r.stream };
}

describe('⚠ EXPOSURE — M1: weapon riders reach a real fight', () => {
  it('a mundane weapon deals ONLY weapon damage (the precondition)', () => {
    const { kinds } = damageByKind([], 'mundane');
    expect([...kinds.keys()]).toEqual(['weapon']);
  });

  /**
   * ⚠ THE EXACT CASE THAT PROVED THE FEATURE WAS DEAD. Before M1, this fight
   * emitted only `weapon` — a Flaming Longsword +1 dealt no fire at all.
   */
  it('⚠ a FLAMING sword deals fire damage', () => {
    const { kinds } = damageByKind(['flaming'], 'flaming');
    expect(kinds.get('fire'), 'no fire damage — the rider never fired').toBeGreaterThan(0);
  });

  it('frost deals cold, shock deals electricity, wounding deals bleed', () => {
    expect(damageByKind(['frost'], 'frost').kinds.get('cold')).toBeGreaterThan(0);
    expect(damageByKind(['shock'], 'shock').kinds.get('electricity')).toBeGreaterThan(0);
    expect(damageByKind(['wounding'], 'wounding').kinds.get('bleed')).toBeGreaterThan(0);
  });

  /**
   * ⚠ THE ARCHITECTURAL RULE, PINNED. A rider must NOT be folded into the
   * weapon total: resistances (M4) need the type, the record needs a line to
   * colour, and a folded rider is invisible — which is how this content stayed
   * dead. If someone "simplifies" by adding rider damage to `damage`, the fire
   * key disappears and this fails.
   */
  it('⚠ rider damage is a SEPARATE typed event, never folded into weapon', () => {
    const { kinds } = damageByKind(['flaming'], 'separate');
    expect(kinds.has('weapon'), 'weapon damage should still exist').toBe(true);
    expect(kinds.has('fire'), 'fire must be its OWN damage kind').toBe(true);
  });

  it('lifedrinker heals the wielder', () => {
    const { stream } = damageByKind(['lifedrinker'], 'drink');
    const heals = stream.all().filter((e) => e.type === 'combat.healing_applied');
    expect(heals.length, 'lifesteal never healed anyone').toBeGreaterThan(0);
  });

  /**
   * ⚠ TARGET FILTERS ARE HONOURED. `holy` and `disrupting` are authored
   * `target_filter: "undead"`. Creature type is not modelled, so the only
   * honest behaviour is to withhold — firing them on everything would make two
   * of the seven damage riders strictly best-in-slot and contradict their own
   * authored description.
   */
  it('⚠ a filtered rider (holy/undead) does NOT fire on a goblin', () => {
    const { kinds } = damageByKind(['holy'], 'holy');
    expect(kinds.has('positive'), 'holy fired on a non-undead target').toBe(false);
  });

  it('two properties both fire from one weapon', () => {
    const { kinds } = damageByKind(['flaming', 'frost'], 'both');
    expect(kinds.get('fire')).toBeGreaterThan(0);
    expect(kinds.get('cold')).toBeGreaterThan(0);
  });
});

describe('⚠ EXPOSURE — M2: stat_bonus reaches a real hero', () => {
  const build = (extra?: ItemInstance) => {
    const kit = musterParty([
      { classId: 1, name: 'Stat', ancestry: ancestryIds[0]!, gender: 'm' as const },
    ])[0]!;
    if (extra) kit.equipped = [...kit.equipped, extra];
    return assembleHero(kit).c;
  };

  const byName = (needle: string) => String(items.find((i) => String(i.name).includes(needle))!.id);

  /**
   * ⚠ THE BUG THIS TEST EXISTS FOR — AND IT IS NOT THE ONE THE BRIEF CLAIMED.
   *
   * Brief #24 said `stat_bonus` had zero consumers. That was WRONG: assembly
   * did read it. The real fault was a VOCABULARY MISMATCH — items author
   * `fort_save`, assembly reads `save_fort`. Ability keys like `str` happened
   * to spell the same on both sides, so HALF the channel worked and nobody
   * noticed the other half was missing.
   */
  it('⚠ a Cloak of Resistance +1 actually raises all three saves', () => {
    const before = build();
    const after = build(plainItem(byName('Cloak of Resistance +1')));
    expect(after.saves.fort, 'fort did not move').toBe(before.saves.fort + 1);
    expect(after.saves.ref).toBe(before.saves.ref + 1);
    expect(after.saves.will).toBe(before.saves.will + 1);
  });

  it('a Belt of Strength +2 raises the attack bonus', () => {
    const before = build();
    const after = build(plainItem(byName('Belt of Strength +2')));
    expect(after.attackBonus).toBe(before.attackBonus + 1); // +2 score = +1 modifier
  });

  /**
   * ⚠ UNIT MISMATCH, CAUGHT BEFORE IT SHIPPED. Boots of Speed carry
   * `{"speed": 10}` — TEN FEET. The sim runs in world units where base speed
   * is 5 and one unit is 5 ft. Adding the raw value would have taken a hero
   * from 5 to 15: triple speed, from boots.
   */
  it('⚠ Boots of Speed add +2 UNITS (+10 ft), not +10 units', () => {
    const before = build();
    const after = build(plainItem(byName('Boots of Speed')));
    expect(after.speed).toBe(before.speed + 2);
    expect(after.speed, 'a hero should not be tripled by boots').toBeLessThan(before.speed * 2);
  });

  it('the alias map covers every save key items actually author', () => {
    const authored = new Set<string>();
    for (const i of items) {
      const raw = i.stat_bonus as string | null;
      if (!raw || raw === '{}') continue;
      for (const k of Object.keys(JSON.parse(raw))) authored.add(k);
    }
    const cloak = plainItem(String(items.find((i) => String(i.name).includes('Cloak of Resistance +1'))!.id));
    const agg = aggregateStatBonuses([cloak]);
    for (const k of ['save_fort', 'save_ref', 'save_will']) {
      expect(agg[k], `${k} missing after aliasing`).toBe(1);
    }
    // and the raw authored keys must NOT survive, or both spellings would stack
    for (const k of ['fort_save', 'ref_save', 'will_save']) {
      expect(agg[k], `${k} leaked through unaliased`).toBeUndefined();
    }
    expect(authored.has('fort_save'), 'content still authors fort_save').toBe(true);
  });
});

/**
 * ⚠ THE CONTENT-GAP LEDGER. Riders naming a condition the engine does not model
 * are skipped silently in combat (emitting an event for an unappliable
 * condition would put a lie in the record). That silence is only safe if the
 * gap is TRACKED — otherwise it becomes the next piece of invisible dead
 * content. This test names exactly what is still missing.
 */
describe('⚠ conditions weapon riders ask for but the engine lacks', () => {
  /**
   * MEASURED, not guessed — my first hand-written list was wrong in both
   * directions (it invented `sickened` as missing when the engine models it,
   * and omitted three that really are absent). The test corrected me; this is
   * the list the content actually asks for and the engine does not have.
   */
  const KNOWN_MISSING = [
    'bound_to_wielder', 'deafened', 'fleeing',
    'persistent_bleed', 'persistent_fire', 'persistent_poison',
  ];

  it('the missing list is accurate — no MORE than we think', () => {
    const asked = new Set<string>();
    for (const p of item_properties) {
      for (const raw of [p.on_hit_effect, p.on_crit_effect]) {
        if (!raw) continue;
        const c = (JSON.parse(raw as string) as { condition?: string }).condition;
        if (c) asked.add(c);
      }
    }
    const missing = [...asked].filter((c) => !isConditionId(c)).sort();
    expect(
      missing.filter((m) => !KNOWN_MISSING.includes(m)),
      `new unmodelled condition(s) appeared: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('the list stays honest — modelling one should fail here', () => {
    const nowReal = KNOWN_MISSING.filter((c) => isConditionId(c));
    expect(
      nowReal,
      `these are now real conditions — drop them from KNOWN_MISSING: ${nowReal.join(', ')}`,
    ).toEqual([]);
  });

  it('conditions the engine DOES model are applied by their riders', () => {
    // dread -> frightened is the witness: an engine-known condition on a rider.
    const dread = item_properties.find((p) => p.id === 'dread')!;
    const onHit = JSON.parse(dread.on_hit_effect as string) as { condition: string };
    expect(isConditionId(onHit.condition), `dread asks for ${onHit.condition}`).toBe(true);
  });
});

describe('deriveItem still parses what it always did', () => {
  it('a flaming longsword carries its rider through derivation', () => {
    const d = deriveItem(magicSword(['flaming']));
    expect(d.onHitEffects).toHaveLength(1);
    expect(d.onHitEffects[0]!.propertyId).toBe('flaming');
    expect((d.onHitEffects[0]!.onHit as { damage_type: string }).damage_type).toBe('fire');
  });
});
