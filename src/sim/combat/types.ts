/**
 * Combatant model — continuous 2D space, continuous time (decision-ledger Area 2).
 * Position is world units (1 unit ≈ one old grid square); time is 100ms ticks.
 */

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
}

export const isAlive = (c: Combatant): boolean => c.hp > 0 || c.conditions.has('dying');
export const isDown = (c: Combatant): boolean => c.conditions.has('dying') || c.conditions.has('unconscious');
