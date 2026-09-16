/**
 * Production combatant builders from registry rows (the harness builds its own
 * fixtures; dispatch needs the real thing). Saves derive from level until the
 * enemy statblocks grow explicit save columns (enemy-grammar content work).
 */

import { abilityMod } from '@sim/heroes/types';
import { SIZE_RADIUS } from '@content/combat';
import { enemiesById, enemyClassesById, enemyRacesById } from '@sim/registry';
import { parseAbilities, resolveEnemyAbilities } from './enemyAbilities';
import { parseLoadout } from './loadout';
import type { Combatant } from './types';

/**
 * Enemy skill totals. Statblocks carry full ability scores but no skill ranks
 * and no proficiency column, so ranks derive from level — the same shape brief
 * #19 §13.4 used for the Perception DC (`10 + level + WIS`, which is this
 * total plus a d20's average).
 */
const enemySkill = (level: number, score: number): number => level + abilityMod(score);

export function buildEnemy(enemyId: number, instanceId: string): Combatant {
  const row = enemiesById.get(enemyId);
  if (!row) throw new Error(`buildEnemy: unknown enemy ${enemyId}`);
  const level = row.base_level as number;
  /**
   * BRIEF #30 — the race and the class.
   *
   * ⚠ BOTH ARE OPTIONAL AND BOTH DEFAULT TO TODAY'S BEHAVIOUR. A row with no
   * race_id and no class_id builds byte-identically to pre-#30: empty loadout,
   * melee ranges, abilities from its own column alone. That is what lets the
   * 45 rows migrate row-by-row instead of in one jump, and it is what keeps
   * every existing test meaningful.
   */
  const race = row.race_id === null ? undefined : enemyRacesById.get(row.race_id as number);
  const cls = row.class_id === null ? undefined : enemyClassesById.get(row.class_id as number);
  /**
   * ⚠ THE RACE'S ABILITIES MERGE WITH THE ROW'S, RACE FIRST, DEDUPED. This is
   * the whole point of a race being mechanical rather than a label: the
   * Vanguard batch's 21 rows authored an EMPTY abilities string (brief #27 §1),
   * and they now inherit from what they ARE — a Hobgoblin Vanguard fights in
   * formation because Hobgoblins do, without anyone re-authoring 21 rows.
   *
   * Row-authored wins on ORDER but duplicates collapse, so a row naming an
   * ability its race already grants is a no-op rather than a double-application.
   */
  const raceAbilities = parseAbilities(race?.intrinsic_abilities);
  const abilities = resolveEnemyAbilities(
    [...new Set([...raceAbilities, ...parseAbilities(row.abilities)])],
    (row.enemy_type as string | null) ?? null,
  );
  return {
    id: instanceId,
    name: row.name,
    baseId: String(enemyId),
    side: 'enemies',
    isHero: false,
    pos: { x: 0, y: 0 },
    // Brief #20: the CONTENT says 'large'; the radius derives here so the knob
    // stays in one place (SIZE_RADIUS, beside ARENA). Unknown/absent → Medium.
    // ⚠ Brief #30: the ROW still wins over its race. A race states the default
    // body for its kind; a row that authored its own size did so on purpose,
    // and silently overriding hand-tuned content from a template is how a
    // generated system starts lying about what the player fights.
    radius: SIZE_RADIUS[(row.size as string | null) ?? (race?.size as string | undefined) ?? 'medium'] ?? 0,
    maxHp: row.hp,
    hp: row.hp,
    ac: row.ac,
    attackBonus: row.attack_bonus,
    damageDice: row.damage_dice,
    /**
     * ⚠ RANGES COME FROM THE CLASS NOW (brief #30). These two lines used to read
     * `weaponRange: 1, engageRange: 1` with the comment "enemy statblocks are
     * melee until the registry grows ranged rows". The registry has grown them.
     *
     * ⚠ `engageRange` MUST track the class, not stay at 1. Measured before this
     * changed: an enemy with a 6-range attack and `engageRange: 1` produced 0
     * standoff moves and 20 engage moves over 20 seeds — it walks into melee to
     * use a ranged attack. That is brief #15's wizard bug, enemy-side, and it is
     * why these are two independent terms rather than one.
     */
    weaponRange: (cls?.weapon_range as number | undefined) ?? 1,
    engageRange: (cls?.engage_range as number | undefined) ?? 1,
    weaponAgile: false,
    weaponPenalty: 0,
    weaponSpecBonus: 0,
    isWeaponProficient: true,
    // Brief #26: `sneak_attack_1d6` on the Bugbear. The field and strike.ts's
    // reader already existed — this was pure wiring, as the brief predicted.
    sneakAttackDice: abilities.sneakAttackDice,
    speed: row.speed as number,
    wounded: 0,
    level,
    initiativeBonus: level + 2, // ported enemy initiative: d20 + level + 2
    // Brief #26: an authored `stealth` ability adds to the derived total. This
    // feeds the backstab conceal check in BOTH directions — the defender uses
    // the higher of Stealth or Perception (design-law §4).
    stealth: enemySkill(level, row.dex as number) + abilities.stealthBonus,
    perception: enemySkill(level, row.wis as number),
    // Brief #22: enemies resist trips on the same level + mod curve heroes
    // attack them on — an enemy with no athletics term would be tripped by
    // every Knockdown regardless of what it is.
    athletics: enemySkill(level, row.str as number),
    abilityUses: new Map(),
    abilityReadyAt: new Map(),
    /**
     * ⚠ THE CADENCE COMES FROM THE CLASS (brief #30). Without it a classed
     * enemy is strictly WEAKER than an unclassed one — measured at -41% to
     * -69% damage, because the AI spends a 2-action ability every action while
     * a plain action is a two-swing burst. See `Combatant.abilityCadenceTicks`.
     * Unclassed rows get 0 and behave exactly as they did before this brief.
     */
    abilityCadenceTicks: (cls?.ability_cooldown_ticks as number | undefined) ?? 0,
    lastAbilityTick: -Infinity,
    pendingPoisonDice: null,
    /**
     * ⚠ THIS LINE USED TO READ `weaponRiders: []` with the comment "enemies
     * wield no magic weapons yet" — true about ITEMS, and it quietly hid the
     * fact that `enemies.abilities` had no consumer at all. Enemy riders do
     * not come from equipment; they come from the statblock (brief #26 M1).
     */
    weaponRiders: abilities.riders,
    damageModifiers: abilities.damage,
    // Brief #26 M3: positional traits, and the per-encounter state they need.
    traits: abilities.traits,
    ferocityUsed: false,
    lastRegenTick: 0,
    chargeStartDistance: -1,
    // Enemies carry no pouch — consumables are a player-planning verb.
    quickSlots: [],
    isCaster: false,
    saves: { fort: 2 + level, ref: 2 + level, will: 1 + level },
    tempHp: 0,
    casting: null,
    /**
     * ⚠ THE LINE THAT OPTED EVERY ENEMY OUT OF THE GAME'S TACTICAL LAYER
     * (brief #30). This read `loadout: []` for every enemy in the registry,
     * while `pickAction` walked `u.loadout` for heroes and enemies alike — so
     * the machinery to make enemies fight differently existed and was reachable
     * by nobody. Verified before changing it: §1's six witnesses, each with a
     * negative control returning zero.
     *
     * ⚠ `isCaster`/`casting` STAY as they are, and that is not an oversight.
     * A cantrip needs no casting resources — `canAfford` short-circuits at
     * `spell_level <= 0` — so the Caster and Zealot classes work with
     * `casting: null` (measured: 2,796 casts over 20 fights). Enemy spell SLOTS
     * are a resource-economy question this brief deliberately leaves shut.
     */
    loadout: parseLoadout(cls?.loadout),
    /**
     * ⚠ AoO NOW COMES FROM CONTENT (brief #19 §10.2). This line used to read
     * `reactions: []` with the comment "enemies have intrinsic AoO in the
     * encounter loop" — and the loop's `hasAoo` was `!u.isHero ||
     * u.reactions.includes('aoo')`, so EVERY enemy in the game got an attack
     * of opportunity while `enemies.aoo_count` was read by nothing. 40 of the
     * 45 rows say 0; only five say ≥ 1 (Hobgoblin Legionnaire, Hobgoblin
     * Tactician, Vanguard Champion, The Whisper's Blade at 1, Vanguard-Captain
     * Ruk Mor-Tal at 2).
     *
     * Content is authoritative here and PF2E agrees with it: AoO is a Fighter
     * class feature and a property of specific monsters, not something a goblin
     * has. That is the rule that decides code-vs-content disputes — the side
     * that matches the ruleset wins — and it is the mirror image of brief #14's
     * bug B, where the code was the one that matched.
     *
     * ⚠ COUNTS ABOVE 1 ARE NOT MODELLED. Ruk Mor-Tal's `aoo_count: 2` grants
     * one AoO per `attackIntervalTicks` like everyone else; PF2E's reaction
     * budget has no home in continuous time yet, and §10.2 measured the
     * boolean. Logged, not silently rounded away.
     */
    reactions: ((row.aoo_count as number | null) ?? 0) >= 1 ? ['aoo'] : [],
    lastReactionTick: -1000,
    conditions: new Map(),
    flurrySwings: 0,
    lastSwingTick: 0,
    nextActionTick: 0,
  };
}
