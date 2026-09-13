/**
 * Combatant model — continuous 2D space, continuous time (decision-ledger Area 2).
 * Position is world units (1 unit ≈ one old grid square); time is 100ms ticks.
 */

import type { CombatQuickSlot } from '@sim/heroes/quickSlots';
import type { DerivedItem } from '@sim/heroes/equipment';
import type { DamageModifiers, EnemyTraits } from './enemyAbilities';

export interface Vec2 {
  x: number;
  y: number;
}

export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export interface ActiveCondition {
  value: number;
  /** null = until removed (dying, stances, toggles). */
  expiresAtTick: number | null;
}

export type Side = 'heroes' | 'enemies';

export interface Combatant {
  id: string;
  name: string;
  /**
   * The content row this instance was made from — the enemy registry id for
   * enemies, the hero's own id for heroes (a hero record IS its own base).
   * Carried so `combat.unit_spawned` can say what a unit is without any
   * consumer parsing instance-id string shape (brief #12).
   */
  baseId: string;
  side: Side;
  isHero: boolean;
  pos: Vec2;
  /**
   * Body radius in world units (1 unit = 5 ft = one square). 0 = Medium/Small.
   *
   * Brief #20. Distance TESTS measure surface-to-surface via `gap()`; `dist()`
   * itself stays centre-to-centre because several callers genuinely want that.
   *
   * ⚠ CONVENTION B, AND IT IS MEASURED, NOT ASSUMED: Medium 0, Large 0.5,
   * Huge 1.0 — the excess over Medium, not the absolute footprint. Under the
   * absolute reading (Medium 0.5) every fight in the game changes, including
   * the 60% of d1 runs with no Large body in them. Medium-only fights hash
   * BIT-IDENTICAL to pre-#20 main under B and differ under A
   * (creature-size-findings.md §2). Do not "fix" Medium to 0.5.
   *
   * ⚠ Radius is a THIRD, independent term beside `weaponRange` (strikes) and
   * `engageRange` (positioning). Collapsing any two reintroduces brief #15's
   * central bug.
   */
  radius: number;

  // Defense & health
  maxHp: number;
  hp: number;
  ac: number;

  // Offense
  attackBonus: number;
  damageDice: string;
  /** Continuous range in world units. Governs WEAPON STRIKES only. */
  weaponRange: number;
  /**
   * The range this unit wants to fight AT — `max(weaponRange, its default
   * at-will spell's range)`, derived once in `assembleHero` (brief #15 §11.3).
   *
   * Positioning reads this; weapon strikes still read `weaponRange`. The split
   * is the whole point: a caster should hold at 6 and cast, never close to 6
   * and swing a staff. Before it existed, `isMelee` was `weaponRange <= 1.5`
   * and Staff/Mace carry `weapon_range: null` (defaulting to 1), so the AI
   * classified the wizard and cleric as MELEE and marched them into the front
   * rank — measured at 65% of all incoming attacks and 89% of hero deaths.
   */
  engageRange: number;
  weaponAgile: boolean;
  /** 0, or NON_PROFICIENCY_PENALTY when wielding unproficiently. */
  weaponPenalty: number;
  weaponSpecBonus: number;
  isWeaponProficient: boolean;
  /** Empty string = no sneak attack. Rogues: ceil(level/2)d6. */
  sneakAttackDice: string;

  speed: number;
  wounded: number;
  /** Character/base level (Rage temp HP, scaling fallbacks). */
  level: number;
  /** Heroes: perception + init feats. Enemies: level + 2 folded in at build. */
  initiativeBonus: number;
  /**
   * THE TWO SKILL TOTALS THE CONCEAL CHECK NEEDS (brief #19 §14.2), derived
   * once — in `assembleHero` for heroes, beside `engageRange`; in `buildEnemy`
   * from the statblock's own ability scores.
   *
   * ⚠ `Combatant` carried NO skills at all before this, which is why the
   * backstab is a chain and not a line: `resolveStrike` is where the check has
   * to live and it had nothing to read. Third instance of the same shape after
   * `weapon_range: null` (brief #15 §1) and `class_weapon_proficiency` (brief
   * #16 §5.1) — the content carries the concept and the sim never reads it.
   *
   *   stealth    = ranks + mods.dex + featSkill + armorCheckPenalty  (+ spell: 0 today)
   *   perception = ranks + mods.wis + featSkill                      (+ spell: 0 today)
   *
   * `mods.<ability>` already folds level-up boosts AND equipment `stat_bonus`
   * (assembly.ts), so Gloves of Dexterity +2 raises every backstab with no
   * further work — brief #19 §14.1.
   */
  stealth: number;
  perception: number;
  /**
   * ⚠ ATHLETICS IS HERE FOR THE SAME REASON STEALTH IS (brief #22 M2).
   * Knockdown and Improved Knockdown resolve a trip check against the target,
   * and `resolveStrike`'s rider had nothing to read — the FOURTH instance of
   * "the content carries the concept and the sim never reads it" after
   * `weapon_range: null`, `class_weapon_proficiency` and the backstab's
   * stealth/perception pair. Derived identically: ranks + ability mod + feat
   * skill mods, so a hand-built enemy and a hand-built hero start level.
   */
  athletics: number;
  /** AI threat flag (+75 target weight). */
  isCaster: boolean;
  saves: { fort: number; ref: number; will: number };
  /** Absorbs damage before hp (Rage). */
  tempHp: number;
  /** null = pure martial. slots[n] = remaining slots of spell level n (index 0 unused). */
  casting: {
    attackBonus: number;
    dc: number;
    casterLevel: number;
    kind: 'slots' | 'pact';
    slots: number[];
    pactEnergy: number;
  } | null;
  /** Ordered ability priorities (core-loop D4); empty = always strike. */
  loadout: import('./loadout').LoadoutEntry[];
  /** Reaction capabilities ('aoo', 'nimbleDodge'); enemies get 'aoo' intrinsically. */
  reactions: string[];
  lastReactionTick: number;

  // Continuous-time state
  conditions: Map<string, ActiveCondition>;
  /** Consecutive-swing counter for flurry decay. */
  flurrySwings: number;
  lastSwingTick: number;
  /** Tick at which this combatant may next act (cooldown gate; Batch B AI drives it). */
  nextActionTick: number;

  /**
   * ABILITY LIMITERS (brief #22 M2). Both are PER-ENCOUNTER and die with the
   * Combatant — which is exactly why M2 needs no save migration.
   *
   * ⚠ The third tier Steven asked for, ONCE PER LONG REST, deliberately does
   * NOT live here: its state must survive the fight, so it belongs on
   * `HeroState` with a backfill. Keeping the tiers separate is what lets that
   * one land later without reworking these two.
   */
  abilityUses: Map<number, number>;
  /** featId -> tick the ability comes off cooldown. */
  abilityReadyAt: Map<number, number>;
  /**
   * THE EQUIPPED WEAPON'S RIDER EFFECTS (brief #24 M1) — flaming, wounding,
   * venom and the rest, as parsed by `deriveItem`.
   *
   * ⚠ NO LONGER EMPTY FOR ENEMIES (brief #26 M1). An enemy's authored
   * `abilities` — poison, disease, gore, energy_drain, dark_bolt, trip — are
   * compiled into this same list by `resolveEnemyAbilities`, because the
   * encounter loop reads `weaponRiders` for WHOEVER is swinging and was
   * already side-agnostic. Mundane-weapon heroes and ability-less enemies
   * still carry an empty list, and `resolveWeaponRiders` short-circuits on it
   * so the hot path pays nothing. Carried on the Combatant rather than
   * re-derived per swing because parsing JSON per strike would be absurd.
   */
  weaponRiders: DerivedItem['onHitEffects'];

  /**
   * DAMAGE RESISTANCE / WEAKNESS / IMMUNITY (brief #26 M2) — the one genuinely
   * new system in that brief.
   *
   * ⚠ APPLIED IN `applyDamage`, WHICH IS THE ONLY PLACE DAMAGE LANDS. Putting
   * it anywhere else would let a path bypass it silently; every damage source
   * in the game — strike, rider, spell, AoO, trap — flows through that one
   * function, which is why riders were built to emit their own TYPED event in
   * the first place (see weaponRiders.ts: "resistances must see the type").
   *
   * Empty for every hero and for most enemies; `hasDamageModifiers` lets the
   * hot path skip the lookup entirely.
   */
  damageModifiers: DamageModifiers;

  /**
   * POSITIONAL AND CONDITIONAL TRAITS (brief #26 M3) — pack tactics, formation
   * bonus, charge, ferocity, regeneration.
   *
   * ⚠ FLAGS, NOT BEHAVIOUR. Each is consulted by the combat loop at one
   * specific moment; the numbers live in `enemyAbilities.ts` so the re-tune
   * edits one file (migration-plan risk R2: translation knobs belong in data).
   * Empty for every hero.
   */
  traits: EnemyTraits;

  /**
   * ⚠ FEROCITY STATE, AND IT IS PER-ENCOUNTER BY DESIGN. The Orc survives one
   * killing blow at 1 hp, once per fight. This lives on the Combatant, which
   * dies with the encounter, so it needs NO save migration — the same tier
   * distinction brief #22 drew for cooldowns and once-per-combat abilities.
   * Once-per-LONG-REST would have to live on `HeroState` with a backfill; do
   * not collapse the tiers.
   */
  ferocityUsed: boolean;

  /** Tick regeneration last fired, so it runs on the attack interval, not per tick. */
  lastRegenTick: number;

  /**
   * Distance to the target at the START of the current approach, for `charge`.
   * −1 = not currently closing. Reset when a swing resolves.
   */
  chargeStartDistance: number;


  /** Poison Weapon's rider, consumed by the next strike. Null = none pending. */
  pendingPoisonDice: string | null;

  /**
   * THE QUICK-SLOT MIRROR (brief #23 M3) — a per-dispatch copy of the kit's
   * pouch, index-aligned with it. The sim nulls an entry when it is drunk;
   * `reconcileQuickSlots` writes that back to the kit afterwards.
   *
   * ⚠ THE MIRROR SURVIVES THE WHOLE DISPATCH, NOT ONE FIGHT. `assembleParty`
   * builds Combatants once per dispatch and every room reuses them, so a
   * potion drunk in room 3 is correctly still gone in room 7. That is the
   * property that makes the "spend it permanently" requirement work at all.
   *
   * ⚠ Entries the ENGINE cannot execute are mirrored as `null` from the
   * start, so "null" alone does not mean "used" — reconciliation needs the
   * tracked mask to tell those apart.
   */
  quickSlots: (CombatQuickSlot | null)[];
}

export const isAlive = (c: Combatant): boolean => c.hp > 0 || c.conditions.has('dying');
export const isDown = (c: Combatant): boolean => c.conditions.has('dying') || c.conditions.has('unconscious');
