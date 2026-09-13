/**
 * ENEMY ABILITIES — turning `enemies.abilities` into engine behaviour (brief #26).
 *
 * ⚠ THIS WAS THE FIFTH OCCURRENCE OF THIS REPO'S RECURRING DEFECT: content
 * authored against a contract with no consumer. 24 of 45 enemy rows name 35
 * distinct abilities and `buildEnemy` read NONE of them — it took hp, ac,
 * attack_bonus, damage_dice, speed, size and aoo_count and nothing else. Every
 * enemy in the game therefore fought identically; a Wolf did not hunt in a
 * pack, a Skeleton resisted nothing, an Orc did not refuse to die.
 *
 * ── SCOPE: M1 + M2 ONLY (Steven, 2026-09-13) ──────────────────────────────
 *
 * M1 — the rider abilities, through the channel brief #24 already built.
 * M2 — resistance / weakness / immunity, the one genuinely new system.
 *
 * M3 (positional: pack_tactics, formation_bonus, charge, ferocity,
 * regeneration_10) and M4 (save-gated control: paralysis, web, slow,
 * trap_expertise) are DEFERRED, not cancelled. ⚠ M4 in particular is the
 * sharpest balance lever available — enemy control effects applied to the
 * party — and the curve is already overshooting.
 *
 * ⚠ THE 16 L7+ ABILITIES ARE DEFERRED TO THE 7+ BAND BRIEF. `levelBand` is 1,
 * so nothing above level 6 can spawn at d1–d5; building them now would be
 * unverifiable — no harness could measure it and no playtest could see it.
 *
 * ── WHY ABILITIES ARE A LOOKUP TABLE AND NOT A COLUMN ─────────────────────
 *
 * The authored strings are a vocabulary, not parameters. `poison` means the
 * same thing on every row that names it. A table keeps one definition per
 * ability, so a fix lands everywhere at once, and an ability nothing defines
 * is caught by a test rather than silently doing nothing — which is the exact
 * failure this brief exists to end.
 */

import type { Combatant } from './types';
import type { DerivedItem } from '@sim/heroes/equipment';

/** The rider shape `resolveWeaponRiders` consumes — same as an item property. */
type OnHitEntry = DerivedItem['onHitEffects'][number];

/**
 * Damage modifiers, keyed by damage type.
 *
 * `immune` wins over `resist`, which wins over `weak` — an enemy that is both
 * immune and weak to a type takes nothing. No authored row does that today;
 * the precedence is stated so a future row cannot make it ambiguous.
 */
export interface DamageModifiers {
  immune: Set<string>;
  /** Flat reduction per instance of damage, after immunity. */
  resist: Map<string, number>;
  /** Multiplier, e.g. 1.5 for "takes +50% from fire". */
  weak: Map<string, number>;
}

export const NO_DAMAGE_MODIFIERS: DamageModifiers = {
  immune: new Set(),
  resist: new Map(),
  weak: new Map(),
};

/**
 * ⚠ UNDEAD IMMUNITY IS DERIVED FROM `enemy_type`, NOT FROM THE ABILITY STRING
 * (Steven's call, brief #26 Q3). Derived cannot drift: a new undead row is
 * immune the day it is authored, with no second field to forget.
 *
 * ⚠ MEASURED CONSEQUENCE, NOT A SIDE EFFECT: 10 rows carry `enemy_type:
 * 'undead'` but only 7 name `undead_immunities`. At playable depths (L≤6) the
 * count of immune enemies goes 4 → 7 — Bone Conscript (L3), Grave-Whisperer
 * (L4) and Barrow Wight (L6) gain immunity they never had. That is a real
 * balance change and it is the intended reading: they are undead.
 *
 * ⚠ ONLY POISON AND DISEASE (Steven's call, Q2). In PF2E `undead_immunities`
 * also covers paralysis, sleep, bleed and mental effects. The engine cannot
 * express those yet, and authoring immunity to a system that does not exist
 * would repeat the very defect this brief fixes. They light up as those
 * systems land.
 */
const UNDEAD_IMMUNITIES = ['poison', 'disease'] as const;

/**
 * The M1 rider vocabulary.
 *
 * Each entry is authored exactly as an item property would be, so it flows
 * through `resolveWeaponRiders` unchanged — the encounter loop reads
 * `u.weaponRiders` for WHOEVER is swinging and was already side-agnostic.
 * Nothing in the strike path needed to change for enemies to have riders.
 */
const RIDER_ABILITIES: Record<string, OnHitEntry> = {
  poison: {
    propertyId: 'poison',
    onHit: { damage_dice: '1d6', damage_type: 'poison', condition: 'sickened', value: 1, duration_rounds: 2 },
    onCrit: null,
  } as OnHitEntry,
  disease: {
    propertyId: 'disease',
    onHit: { condition: 'fatigued', value: 1, duration_rounds: 3 },
    onCrit: null,
  } as OnHitEntry,
  gore: {
    propertyId: 'gore',
    onHit: { damage_dice: '1d6', damage_type: 'piercing' },
    onCrit: null,
  } as OnHitEntry,
  energy_drain: {
    propertyId: 'energy_drain',
    onHit: { damage_dice: '1d4', damage_type: 'negative', condition: 'fatigued', value: 1, duration_rounds: 2 },
    onCrit: null,
  } as OnHitEntry,
  dark_bolt_1d6: {
    propertyId: 'dark_bolt_1d6',
    onHit: { damage_dice: '1d6', damage_type: 'force' },
    onCrit: null,
  } as OnHitEntry,
  /**
   * ⚠ `trip` APPLIES `prone` WITHOUT AN OPPOSED CHECK, deliberately, and this
   * is a divergence from the brief's sketch. The rider channel has no place to
   * hang an athletics contest — `resolveWeaponRiders` takes no rolls. Making it
   * contested is M3-shaped work (it needs the save/contest path), so the honest
   * options were "uncontested now" or "not now". A Wolf that trips on a landed
   * hit is closer to the authored intent than a Wolf that never trips.
   * Revisit with M3/M4, where the contest machinery is already in scope.
   */
  trip: {
    propertyId: 'trip',
    onHit: { condition: 'prone', value: 1, duration_rounds: 1 },
    onCrit: null,
  } as OnHitEntry,
};

/**
 * Abilities that modify a numeric field on the combatant rather than riding a
 * hit. Applied by `applyEnemyAbilities` after the riders are collected.
 */
const FIELD_ABILITIES = new Set(['sneak_attack_1d6', 'stealth', 'fire_weakness']);

/**
 * Abilities that are deliberately NOT built in M1+M2 — deferred to M3/M4 or to
 * the 7+ band brief. Listed explicitly so that "unhandled" and "deferred" are
 * different states: an ability in neither list is a CONTENT BUG and
 * `tests/combat/enemyAbilities.test.ts` fails on it.
 *
 * ⚠ Do not add to this list to silence a test. An unknown ability string means
 * either a typo in the content or a vocabulary word nobody implemented, and
 * both should be loud.
 */
const DEFERRED_ABILITIES = new Set([
  // M3 — positional and conditional
  'pack_tactics', 'formation_bonus', 'charge', 'ferocity', 'regeneration_10',
  // M4 — save-gated control
  'paralysis', 'web', 'slow', 'trap_expertise',
  // 7+ band: cannot spawn at d1–d5 given levelBand 1
  'breath_weapon_6d6', 'breath_weapon_12d6', 'flight', 'frightful_presence',
  'tail_sweep', 'throw_rock_2d10', 'trample', 'charm', 'dominate',
  'gaseous_form', 'incorporeal', 'paralyzing_touch', 'phylactery',
  'spellcasting_5', 'spellcasting_9', 'dark_ritual',
  // Derived from enemy_type instead of from the string — see UNDEAD_IMMUNITIES.
  'undead_immunities',
]);

/** Every ability string this module knows about, in either state. */
export function isKnownAbility(id: string): boolean {
  return id in RIDER_ABILITIES || FIELD_ABILITIES.has(id) || DEFERRED_ABILITIES.has(id);
}

/** Parse the authored JSON array. Absent, empty or malformed → no abilities. */
export function parseAbilities(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    // ⚠ Malformed JSON is swallowed here and caught by the content test, which
    // names the row. Throwing would make one bad row unspawnable at runtime.
    return [];
  }
}

export interface EnemyAbilityEffects {
  riders: OnHitEntry[];
  damage: DamageModifiers;
  sneakAttackDice: string;
  stealthBonus: number;
}

/**
 * Resolve an enemy's authored abilities into engine effects.
 *
 * `enemyType` drives the derived undead bundle; `abilities` drives everything
 * else. Both are read from the registry row by `buildEnemy`.
 */
export function resolveEnemyAbilities(abilities: string[], enemyType: string | null): EnemyAbilityEffects {
  const riders: OnHitEntry[] = [];
  const immune = new Set<string>();
  const resist = new Map<string, number>();
  const weak = new Map<string, number>();
  let sneakAttackDice = '';
  let stealthBonus = 0;

  // Derived first, so an authored ability could in principle override it.
  if (enemyType === 'undead') for (const t of UNDEAD_IMMUNITIES) immune.add(t);

  for (const id of abilities) {
    const rider = RIDER_ABILITIES[id];
    if (rider) {
      riders.push(rider);
      continue;
    }
    switch (id) {
      case 'sneak_attack_1d6':
        // The field already exists and strike.ts already reads it — this is
        // pure wiring, exactly as the brief predicted.
        sneakAttackDice = '1d6';
        break;
      case 'stealth':
        // Feeds the backstab conceal check in BOTH directions: the defender
        // uses the higher of Stealth or Perception (design-law §4).
        stealthBonus = 2;
        break;
      case 'fire_weakness':
        weak.set('fire', 1.5);
        break;
      default:
        // Deferred or unknown: no effect. The content test is what
        // distinguishes those two cases, not this switch.
        break;
    }
  }

  return { riders, damage: { immune, resist, weak }, sneakAttackDice, stealthBonus };
}

/**
 * Apply a damage modifier table to one instance of typed damage.
 *
 * ⚠ RETURNS THE MODIFIED AMOUNT; the CALLER still emits the event with the
 * real type, so the record shows "0 poison" rather than nothing at all. An
 * immunity that erases the event is indistinguishable from a rider that never
 * fired — the same invisibility that let this content stay dead.
 */
export function applyDamageModifiers(mods: DamageModifiers, amount: number, kind: string): number {
  if (mods.immune.has(kind)) return 0;
  const weakness = mods.weak.get(kind);
  if (weakness !== undefined) return Math.floor(amount * weakness);
  const resistance = mods.resist.get(kind);
  if (resistance !== undefined) return Math.max(0, amount - resistance);
  return amount;
}

/** True when this combatant modifies any damage type — lets the hot path skip. */
export function hasDamageModifiers(u: Combatant): boolean {
  const m = u.damageModifiers;
  return m.immune.size > 0 || m.resist.size > 0 || m.weak.size > 0;
}
