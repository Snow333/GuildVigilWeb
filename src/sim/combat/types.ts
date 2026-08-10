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
  /** Continuous range in world units (≤ ENGAGEMENT_RANGE ⇒ melee). */
  weaponRange: number;
  weaponAgile: boolean;
  /** 0, or NON_PROFICIENCY_PENALTY when wielding unproficiently. */
  weaponPenalty: number;
  weaponSpecBonus: number;
  isWeaponProficient: boolean;
  /** Empty string = no sneak attack. Rogues: ceil(level/2)d6. */
  sneakAttackDice: string;

  speed: number;
  wounded: number;
  /** Heroes: perception + init feats. Enemies: level + 2 folded in at build. */
  initiativeBonus: number;
  /** AI threat flag (+75 target weight). */
  isCaster: boolean;

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
