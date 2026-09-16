/**
 * ENEMY RACES x CLASSES — the exposure tests (brief #30).
 *
 * ⚠ WHY THESE EXIST, AND WHY THEY LOOK LIKE THIS.
 *
 * When brief #22 wired the `ability` verb, all 529 tests stayed green with the
 * whole feature dead — because no unit had an ability in its loadout, so not a
 * line of it executed. "A FREE FEATURE AND A BROKEN FEATURE LOOK IDENTICAL ON
 * THE CURVE" (brief #20). This file's first job is to prove the wiring is
 * REACHED, not that it is balanced.
 *
 * ⚠ EVERY ASSERTION DRIVES A REAL FIGHT AND READS THE EVENT STREAM. None of
 * them assert against the table the builder just populated. That mistake has
 * now shipped three times here — #22's tautological gate, #24's
 * assert-the-aggregator-against-itself, and #26 M2's
 * `expect(skeleton.damageModifiers.immune.has('poison')).toBe(true)`, which
 * stayed green with the damage path gutted. The rule: assert against the
 * CONSUMER, never through the predicate under test.
 */

import { describe, expect, it } from 'vitest';
import { buildEnemy } from '@sim/combat/build';
import { runEncounter } from '@sim/combat/encounter';
import { parseLoadout } from '@sim/combat/loadout';
import { enemyClassesById, enemyRacesById, enemiesById } from '@sim/registry';
import { enemies } from '@content/generated/enemies';
import { enemy_classes } from '@content/generated/enemy_classes';
import { enemy_races } from '@content/generated/enemy_races';
import { isKnownAbility, parseAbilities } from '@sim/combat/enemyAbilities';
import { ACTIVE_WIRED } from '@sim/heroes/featEffects';
import { spellsById } from '@sim/registry';
import type { Combatant } from '@sim/combat/types';

type EventLike = { type: string; data: Record<string, unknown> };
const eventsOf = (s: { all(): readonly unknown[] }): EventLike[] => s.all() as unknown as EventLike[];

/** A durable punching bag so fights last long enough for a loadout to express itself. */
function bag(id: string, hp = 400): Combatant {
  const u = buildEnemy(1, id);
  u.side = 'heroes';
  u.isHero = true;
  u.maxHp = hp;
  u.hp = hp;
  u.ac = 10;
  u.attackBonus = -20;
  u.damageDice = '1d2';
  return u;
}

/**
 * Build an enemy THROUGH THE PRODUCTION PATH, then inflate its durability so
 * fights last long enough for a loadout to express itself.
 *
 * ⚠ THIS MUST NOT SET `loadout` ITSELF. The first draft of this file had a
 * helper that did `u.loadout = parseLoadout(cls.loadout)` — re-implementing the
 * exact line in `build.ts` it was meant to prove. Sabotaging `build.ts` to
 * `loadout: []` left all 19 tests GREEN, because every test was reading the
 * helper's wiring rather than the engine's. That is the fourth instance of this
 * repo's assert-against-yourself family (#22's gate, #24's aggregator, #26's
 * immunity table). The stats below are combat knobs, never wiring.
 */
function durable(enemyId: number, instanceId = 'e1'): Combatant {
  const u = buildEnemy(enemyId, instanceId);
  u.maxHp = 400;
  u.hp = 400;
  u.attackBonus = 30;
  return u;
}

/**
 * The control for a classed row: the SAME statblock with its loadout emptied
 * and its ranges forced to melee. Stripping is safe here — a control that does
 * nothing cannot fake a positive — but the treatment must always come straight
 * from `buildEnemy`.
 */
function stripped(enemyId: number, instanceId = 'e1'): Combatant {
  const u = durable(enemyId, instanceId);
  u.loadout = [];
  u.weaponRange = 1;
  u.engageRange = 1;
  return u;
}

const SEEDS = Array.from({ length: 30 }, (_, i) => `rc-${i}`);

function fightEvents(makeEnemy: () => Combatant, seed: string): EventLike[] {
  const r = runEncounter('rc', 'room', [bag('h1')], [makeEnemy()], seed);
  return eventsOf(r.stream);
}

const count = (evs: EventLike[], type: string, pred: (d: Record<string, unknown>) => boolean): number =>
  evs.filter((e) => e.type === type && pred(e.data)).length;

// ── 1. The content is coherent ─────────────────────────────────────────────

describe('the race and class tables are internally sound', () => {
  it('every enemy row declares a race that exists, and a class that exists or none', () => {
    for (const row of enemies) {
      expect(row.race_id, `${row.name} must declare a race`).not.toBeNull();
      expect(enemyRacesById.has(row.race_id as number), `${row.name}: unknown race ${row.race_id}`).toBe(true);
      if (row.class_id !== null) {
        expect(enemyClassesById.has(row.class_id as number), `${row.name}: unknown class ${row.class_id}`).toBe(true);
      }
    }
  });

  it('every race names only LIVE vocabulary — an unknown word is dead content', () => {
    for (const race of enemy_races) {
      for (const ability of JSON.parse(race.intrinsic_abilities) as string[]) {
        expect(isKnownAbility(ability), `race ${race.name}: unknown ability '${ability}'`).toBe(true);
      }
    }
  });

  /**
   * ⚠ THE CHECK THAT WOULD HAVE CAUGHT THIS REPO'S RECURRING DEFECT. A class
   * whose loadout names a feat that is not wired, or a spell that does not
   * exist, would parse fine and then silently never fire.
   */
  it('every class loadout references a WIRED feat or a REAL spell', () => {
    for (const cls of enemy_classes) {
      const entries = parseLoadout(cls.loadout);
      const authored = JSON.parse(cls.loadout) as unknown[];
      expect(entries.length, `class ${cls.name}: ${authored.length - entries.length} malformed entries`).toBe(authored.length);
      for (const entry of entries) {
        if (entry.action === 'ability') {
          expect(ACTIVE_WIRED.has(entry.featId), `class ${cls.name}: feat #${entry.featId} is not wired`).toBe(true);
        }
        if (entry.action === 'cast') {
          const spell = spellsById.get(entry.spellId);
          expect(spell, `class ${cls.name}: spell #${entry.spellId} does not exist`).toBeDefined();
          // A leveled spell would need casting resources buildEnemy does not grant.
          expect((spell!.spell_level as number | null) ?? 0, `class ${cls.name}: spell #${entry.spellId} is not a cantrip`).toBe(0);
        }
      }
    }
  });

  it('every class ends in a plain strike — a unit that cannot fall through is a unit that can stall', () => {
    for (const cls of enemy_classes) {
      const entries = parseLoadout(cls.loadout);
      expect(entries.length, `class ${cls.name} is empty`).toBeGreaterThan(0);
      expect(entries[entries.length - 1]!.action, `class ${cls.name} must end in a strike`).toBe('strike');
    }
  });

  it('every authored race is USED by at least one row — an unused race is inert content', () => {
    const used = new Set(enemies.map((e) => e.race_id));
    for (const race of enemy_races) {
      expect(used.has(race.id), `race ${race.name} is authored but unused`).toBe(true);
    }
  });

  it('every authored class is USED by at least one row', () => {
    const used = new Set(enemies.map((e) => e.class_id).filter((c) => c !== null));
    for (const cls of enemy_classes) {
      expect(used.has(cls.id), `class ${cls.name} is authored but unused`).toBe(true);
    }
  });
});

// ── 2. The wiring is REACHED ───────────────────────────────────────────────

describe('the class actually reaches the fight', () => {
  /**
   * ⚠ THE LOAD-BEARING EXPOSURE TEST. If `build.ts` stopped reading
   * `enemy_classes.loadout`, every other test in this repo would stay green and
   * the entire brief would be dead. This one fails.
   */
  it('EXPOSURE: a classed enemy produces behaviour an unclassed one cannot', () => {
    // Orc Warrior (11) is a Brute: Power Attack. Its rider is an extra weapon
    // die, so the witness is the ACTION ECONOMY — one swing per two actions,
    // instead of two swings per one.
    const classed = () => durable(11);
    const plain = () => stripped(11);

    let classedSwings = 0;
    let plainSwings = 0;
    for (const seed of SEEDS) {
      classedSwings += count(fightEvents(classed, seed), 'combat.attack_resolved', (d) => d['attackerId'] === 'e1');
      plainSwings += count(fightEvents(plain, seed), 'combat.attack_resolved', (d) => d['attackerId'] === 'e1');
    }
    expect(plainSwings).toBeGreaterThan(0);          // the control really fights
    expect(classedSwings).toBeGreaterThan(0);        // so does the treatment
    expect(classedSwings).toBeLessThan(plainSwings); // and they differ, as designed
  });

  it('a Warrior applies frightened; an unclassed row of the same statblock never does', () => {
    let armed = 0;
    let control = 0;
    for (const seed of SEEDS) {
      armed += count(fightEvents(() => durable(10), seed), 'combat.condition_applied', (d) => d['conditionId'] === 'frightened');
      control += count(fightEvents(() => stripped(10), seed), 'combat.condition_applied', (d) => d['conditionId'] === 'frightened');
    }
    expect(control).toBe(0);
    expect(armed).toBeGreaterThan(0);
  });

  it('a Skirmisher trips its target; an unclassed row of the same statblock never does', () => {
    let armed = 0;
    let control = 0;
    for (const seed of SEEDS) {
      // ⚠ THE WITNESS IS KNOCKDOWN'S `prone`, NOT POISON WEAPON'S DAMAGE.
      // Poison Weapon's dice are FOLDED into the weapon total by the encounter
      // loop (`damage += rollDice(...)`) rather than emitted as typed poison,
      // so there is no `damage_applied{kind:'poison'}` to count — the first
      // draft of this test asserted one and failed for that reason, not
      // because the class was dead. `prone` is unforgeable by a plain strike.
      armed += count(fightEvents(() => durable(13), seed), 'combat.condition_applied', (d) => d['conditionId'] === 'prone');
      control += count(fightEvents(() => stripped(13), seed), 'combat.condition_applied', (d) => d['conditionId'] === 'prone');
    }
    expect(control).toBe(0);
    expect(armed).toBeGreaterThan(0);
  });

  /**
   * ⚠ MAGIC WITH NO CASTING RESOURCES. `buildEnemy` still sets
   * `casting: null`; a cantrip is free, so a Caster works anyway. If someone
   * "fixes" canAfford to require a caster profile, this fails loudly.
   */
  it('a Caster casts a real cantrip with casting:null, and emits spell_cast', () => {
    let armed = 0;
    let control = 0;
    for (const seed of SEEDS) {
      armed += count(fightEvents(() => durable(19), seed), 'combat.spell_cast', (d) => d['casterId'] === 'e1');
      control += count(fightEvents(() => stripped(19), seed), 'combat.spell_cast', (d) => d['casterId'] === 'e1');
    }
    expect(control).toBe(0);
    expect(armed).toBeGreaterThan(0);
    // And it really did so without a casting profile.
    expect(buildEnemy(19, 'x').casting).toBeNull();
  });

  /**
   * ⚠ THE POSITIONING HALF. A Caster whose engageRange stayed at 1 would walk
   * into melee to cast a 6-range cantrip — brief #15's wizard bug, enemy-side.
   * The witness is the `standoff` purpose on a move event, which a melee unit
   * can never emit.
   */
  it('a Caster HOLDS ITS RANGE — standoff moves, which a melee enemy never makes', () => {
    let standoff = 0;
    let meleeStandoff = 0;
    for (const seed of SEEDS) {
      standoff += count(fightEvents(() => durable(19), seed), 'combat.unit_moved',
        (d) => d['unitId'] === 'e1' && d['purpose'] === 'standoff');
      meleeStandoff += count(fightEvents(() => durable(11), seed), 'combat.unit_moved',
        (d) => d['unitId'] === 'e1' && d['purpose'] === 'standoff');
    }
    expect(meleeStandoff).toBe(0);
    expect(standoff).toBeGreaterThan(0);
  });
});

// ── 3. The race is mechanical, not a label ─────────────────────────────────

describe('a race grants abilities to every row of that race', () => {
  /**
   * ⚠ THIS IS THE POINT OF THE WHOLE RACE TABLE. The Vanguard batch authored
   * 21 rows with an EMPTY abilities string (brief #27 §1). They now inherit
   * from what they ARE. Hobgoblin Vanguard (107) authored nothing; Hobgoblin
   * grants formation_bonus.
   */
  it('EXPOSURE: a row that authored NO abilities still gets its race\'s', () => {
    const row = enemiesById.get(107)!;
    // ⚠ THE ROW STORES '' (empty string), NOT '[]'. parseAbilities is the
    // engine's real reader and handles both; a bare JSON.parse throws here.
    expect(parseAbilities(row.abilities)).toEqual([]); // authored nothing
    const vanguard = buildEnemy(107, 'v');
    expect(vanguard.traits.formationBonus).toBe(true);
  });

  it('and a row of a race with no intrinsics gets nothing extra', () => {
    // Goblin race grants []. Goblin Sapper (100) authored []. Nothing appears.
    const sapper = buildEnemy(100, 's');
    expect(sapper.traits.formationBonus).toBe(false);
    expect(sapper.traits.ferocity).toBe(false);
    expect(sapper.traits.charge).toBe(false);
  });

  it('a race ability and a row ability do not double-apply', () => {
    // Orc Warrior (11) authored 'ferocity'; the Orc race also grants it.
    const row = enemiesById.get(11)!;
    expect(parseAbilities(row.abilities)).toContain('ferocity');
    const orc = buildEnemy(11, 'o');
    expect(orc.traits.ferocity).toBe(true);
    // Ferocity fires ONCE per fight regardless; the merge must not change that.
    expect(orc.ferocityUsed).toBe(false);
  });

  /**
   * ⚠ ASSERTED THROUGH A REAL FIGHT, not by reading the traits table — the
   * #26 M2 lesson. An Orc Raider (105) authored no abilities; the Orc race
   * grants ferocity, so it must refuse to die exactly once.
   */
  it('EXPOSURE: race-granted ferocity fires in a real fight for a row that authored none', () => {
    const row = enemiesById.get(105)!;
    expect(parseAbilities(row.abilities)).toEqual([]);

    let ferocityEvents = 0;
    let controlEvents = 0;
    for (const seed of SEEDS) {
      const killer = bag('h1', 400);
      killer.attackBonus = 40;
      killer.damageDice = '10d10';
      const raider = buildEnemy(105, 'e1');
      const r = runEncounter('rc', 'room', [killer], [raider], seed);
      ferocityEvents += count(eventsOf(r.stream), 'combat.reaction_triggered', (d) => d['reactionId'] === 'ferocity');

      // CONTROL: a Goblin Sapper, same empty abilities, a race with no ferocity.
      const killer2 = bag('h1', 400);
      killer2.attackBonus = 40;
      killer2.damageDice = '10d10';
      const sapper = buildEnemy(100, 'e1');
      const r2 = runEncounter('rc', 'room', [killer2], [sapper], seed);
      controlEvents += count(eventsOf(r2.stream), 'combat.reaction_triggered', (d) => d['reactionId'] === 'ferocity');
    }
    expect(controlEvents).toBe(0);
    expect(ferocityEvents).toBeGreaterThan(0);
  });
});

// ── 4. Nothing regressed for unclassed rows ────────────────────────────────

describe('an unclassed row behaves exactly as it did before brief #30', () => {
  it('builds with an empty loadout and melee ranges', () => {
    const goblin = buildEnemy(1, 'g'); // Fodder: no class
    expect(enemiesById.get(1)!.class_id).toBeNull();
    expect(goblin.loadout).toEqual([]);
    expect(goblin.weaponRange).toBe(1);
    expect(goblin.engageRange).toBe(1);
  });

  it('still fights — an empty loadout falls through to the default strike', () => {
    let swings = 0;
    for (const seed of SEEDS.slice(0, 10)) {
      swings += count(fightEvents(() => stripped(1), seed), 'combat.attack_resolved', (d) => d['attackerId'] === 'e1');
    }
    expect(swings).toBeGreaterThan(0);
  });

  it('AoO still comes from content, not from the class', () => {
    // Brief #19 §10.2: aoo_count is authoritative. No class grants AoO.
    expect(buildEnemy(1, 'g').reactions).toEqual([]);   // aoo_count 0
    expect(buildEnemy(110, 'l').reactions).toEqual(['aoo']); // aoo_count 1, classed Warrior
    expect(buildEnemy(117, 'c').reactions).toEqual(['aoo']);
  });

  it('a malformed loadout is dropped rather than reaching pickAction', () => {
    expect(parseLoadout('not json')).toEqual([]);
    expect(parseLoadout('{}')).toEqual([]);
    expect(parseLoadout('[{"action":"nonsense","condition":{"kind":"always"},"target":"self"}]')).toEqual([]);
    expect(parseLoadout('[{"action":"ability","condition":{"kind":"always"},"target":"self"}]')).toEqual([]); // no featId
    expect(parseLoadout('[{"action":"strike","condition":{"kind":"bogus"},"target":"scoredEnemy"}]')).toEqual([]);
    // ...and a VALID one survives, so the validator is not just returning [].
    expect(parseLoadout('[{"action":"strike","condition":{"kind":"always"},"target":"scoredEnemy"}]')).toHaveLength(1);
  });
});
