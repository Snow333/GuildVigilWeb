/**
 * Spell resolution in combat — the data-driven caster layer over the converted
 * spells registry. Adds what the ledger demanded (Area 2 Change): AoE gets the
 * BASIC SAVE the Godot build never had (crit success none / success half /
 * fail full / crit fail double).
 *
 * ⚠ FRIENDLY FIRE IS NO LONGER THE DEFAULT (brief #21 §5). This header used to
 * say "friendly fire intact" and that is now wrong: an area spell hits the side
 * its content declares, and absent a declaration it derives from `effect_type`.
 * Guild Vigil is a continuous-time auto-battler with no player intervention once
 * engaged, so the player never aims a burst — the AI does. Punishing them for a
 * placement they did not choose is noise, not difficulty. `target_side: 'all'`
 * remains available per row for a deliberate design.
 *
 * Spell attacks never take flurry (ported rule). Scaling maps (cantrip curves)
 * resolve against caster level. Costs: slots by spell level, pact energy via
 * the hand-set warlock curve, cantrips free.
 */

import { ENGAGEMENT_RANGE, TICKS_PER_SECOND } from '@content/combat';
import type { Rng } from '@sim/core/rng';
import type { RollBreakdown } from '@sim/core/events/types';
import { spellsById, warlockCostByLevel } from '@sim/registry';
import { averageDamage } from './ai';
import { determineDegree, rollDice } from './dice';
import { acMod, applyCondition, CONDITION_IDS, saveMod, type ConditionId } from './conditions';
import { dist, type Combatant, type Vec2 } from './types';

type SpellRow = NonNullable<ReturnType<typeof spellsById.get>>;

export interface SpellTargetResult {
  unit: Combatant;
  save?: RollBreakdown;
  attack?: RollBreakdown;
  damage: number;
  healing: number;
  conditionApplied?: { id: ConditionId; value: number; durationTicks: number };
}

export interface CastResult {
  spell: SpellRow;
  resource: 'slot' | 'pact' | 'atWill';
  cost: number;
  targets: SpellTargetResult[];
  /** True when this row's effect isn't executable yet (unknown buff shape). */
  inert: boolean;
}

/** Highest scaling entry ≤ casterLevel overrides base dice (cantrip curves). */
export function scaledDice(spell: SpellRow, casterLevel: number): string {
  const base = (spell.damage_dice as string | null) ?? '';
  const scalingRaw = spell.scaling as string | null;
  if (!scalingRaw || scalingRaw === '{}') return base;
  try {
    const map = JSON.parse(scalingRaw) as Record<string, string>;
    let best = base;
    let bestLevel = 0;
    for (const [lvl, dice] of Object.entries(map)) {
      const n = Number(lvl);
      if (n <= casterLevel && n > bestLevel) {
        best = dice;
        bestLevel = n;
      }
    }
    return best;
  } catch {
    return base;
  }
}

export function spellRange(spell: SpellRow): number {
  const rt = spell.range_type as string | null;
  if (rt === 'touch' || rt === 'self') return ENGAGEMENT_RANGE;
  return (spell.range_value as number | null) ?? ENGAGEMENT_RANGE;
}

/**
 * The default at-will attack for a caster on `spellList` (brief #15 §10–§11).
 *
 * Candidates are DERIVED — every damage cantrip the class's own spell list can
 * reach — so the rule stays self-maintaining as content grows. Among them,
 * content may DESIGNATE a preference via `default_cantrip`; where nothing is
 * marked, the best expected damage wins, ties broken by table order.
 *
 * That hybrid is what settles §11.2: "derived from the class spell list" and
 * "Electric Arc + Divine Lance" could not both be true under any single rule
 * (best-damage picks Telekinetic Projectile; lowest-id picks Electric Arc +
 * Produce Flame). Since §11.1 measured the choice as free — Electric Arc sits
 * within noise of a d6 cantrip everywhere, because a cantrip's value is that it
 * exists at range and never runs out, not its dice — designating on flavour
 * costs nothing and keeps the derivation.
 *
 * `spell_list` is comma-separated on both sides ('arcane,divine'), so this is a
 * set intersection, not a string compare.
 */
export function defaultCantripFor(spellList: string | null): SpellRow | null {
  if (!spellList) return null;
  const wanted = spellList.split(',').map((s) => s.trim()).filter(Boolean);
  if (wanted.length === 0) return null;

  let best: SpellRow | null = null;
  let bestScore = -Infinity;
  for (const spell of spellsById.values()) {
    if (((spell.spell_level as number | null) ?? 0) > 0) continue;
    if ((spell.effect_type as string | null) !== 'damage') continue;
    const dice = (spell.damage_dice as string | null) ?? '';
    if (dice === '' || dice === '0') continue;
    const on = ((spell.spell_list as string | null) ?? '').split(',').map((s) => s.trim());
    if (!wanted.some((w) => on.includes(w))) continue;

    // An authored designation outranks every unmarked candidate outright; the
    // damage term only orders the fallback.
    const designated = (spell.default_cantrip as number | null) === 1 ? 1000 : 0;
    const score = designated + averageDamage(dice);
    if (score > bestScore) {
      best = spell;
      bestScore = score;
    }
  }
  return best;
}

/** Spend the cost; caller must have verified affordability. */
export function spendCost(caster: Combatant, spell: SpellRow): { resource: CastResult['resource']; cost: number } {
  const level = (spell.spell_level as number | null) ?? 0;
  if (level <= 0 || !caster.casting) return { resource: 'atWill', cost: 0 };
  if (caster.casting.kind === 'pact') {
    const cost = warlockCostByLevel.get(level) ?? 0;
    caster.casting.pactEnergy -= cost;
    return { resource: 'pact', cost };
  }
  caster.casting.slots[level] = (caster.casting.slots[level] ?? 0) - 1;
  return { resource: 'slot', cost: 1 };
}

/** PF2E basic save: crit success 0× / success ½ / fail 1× / crit fail 2×. */
function basicSaveMultiplier(degree: RollBreakdown['degree']): number {
  if (degree === 'critSuccess') return 0;
  if (degree === 'success') return 0.5;
  if (degree === 'failure') return 1;
  return 2;
}

/**
 * A saving throw, with condition modifiers folded in.
 *
 * ⚠ `saveMod` IS NEW HERE (brief #25) and it is load-bearing: before it, no
 * condition in the game could move a save, so Protection's `{bonus:1,
 * to:'saves'}` would have applied a `steeled` condition that nothing consumed
 * — a buff that resolves and still does nothing, which is the failure mode
 * this brief exists to end.
 */
function rollSave(target: Combatant, saveType: string, dc: number, rng: Rng): RollBreakdown {
  const base =
    saveType === 'fort' ? target.saves.fort : saveType === 'will' ? target.saves.will : target.saves.ref;
  const bonus = base + saveMod(target);
  const d20 = rng.die(20);
  const { degree, natStep } = determineDegree(d20 + bonus, dc, d20);
  return { d20, modifier: bonus, total: d20 + bonus, dc, degree, natStep };
}

/**
 * IS THIS AN AREA SPELL? Brief #21 §3 — `aoe_shape` is the AUTHORITY.
 *
 * ⚠ THIS USED TO BE INFERRED FROM `save_type && aoe_size`, AND THAT WAS WRONG.
 * `save_type` is a saving-throw rule, not a shape, so 20 authored area spells
 * silently resolved single-target — Heal Mass healing one ally, and Wall of Fire
 * (a size-8 damage LINE) hitting one creature. The content was always right; the
 * engine was reading the wrong columns.
 *
 * `aoe_shape` is authored across all 218 rows with zero inconsistencies: 156
 * null (direct), 51 burst, 4 cone, 7 line. Direct spells resolve on the target
 * alone and NEVER inspect its surroundings, which is also why creature radius
 * (brief #20) touches exactly one branch instead of leaking through a save check.
 *
 * ⚠ `cone` and `line` still resolve AS BURSTS (11 spells). That was true before
 * this brief and is unchanged by it — but the shape is now visible to the code,
 * so real wedge/line geometry is an additive follow-up rather than a rewrite.
 */
export const isAreaSpell = (spell: SpellRow): boolean =>
  (spell.aoe_shape as string | null) != null && ((spell.aoe_size as number | null) ?? 0) > 0;

/**
 * WHO an area spell may hit. Brief #21 §5, Steven's decision 2026-09-02.
 *
 * Declared wins; absent DERIVES from `effect_type`. The column is the exception
 * channel, not the primary statement (constraints 5 and 7), so all 218 current
 * rows leave it NULL and still resolve correctly.
 *
 * ⚠ FRIENDLY FIRE IS NOT THE DEFAULT and the reason is structural, not taste:
 * this is an auto-battler with no player intervention once engaged, so the AI
 * chooses where a burst lands. Catching your own front rank punishes a decision
 * the player never made and cannot counterplay. PF2E's friendly fire works at a
 * table because a human aims the fireball. `'all'` stays expressible per row.
 */
const sideRule = (spell: SpellRow): 'all' | 'enemies' | 'allies' => {
  const declared = spell.target_side as 'all' | 'enemies' | 'allies' | null | undefined;
  if (declared === 'all' || declared === 'enemies' || declared === 'allies') return declared;
  const effect = spell.effect_type as string | null;
  return effect === 'healing' || effect === 'buff' ? 'allies' : 'enemies';
};

/**
 * Everything an area spell catches.
 *
 * ⚠ THE ORIGIN IS A POINT, NOT A CREATURE (brief #21 §4). It used to take a
 * `Combatant`, which cannot express a ground-targeted burst. Creature-targeted
 * spells pass `target.pos`; a future ground-targeted one passes a chosen point.
 * Widening it later would have meant touching every call site a second time,
 * after the AI had opinions about aiming.
 *
 * ⚠ Radius is subtracted for the TARGET ONLY — a burst has a centre point, not a
 * body, so this is deliberately NOT `gap()`. PF2E catches a creature if ANY of
 * its squares is in the burst, so edge-to-edge is rules-correct here and it means
 * Large bodies eat more AoE (brief #20 findings §4, §7.2).
 *
 * ⚠ EMISSION ORDER = RESOLUTION ORDER. Iterating `all` in its existing stable
 * order is load-bearing: change it and `EventStream.hash()` replay determinism
 * breaks for every existing burst.
 */
function areaTargets(
  spell: SpellRow,
  origin: Vec2,
  caster: Combatant,
  all: readonly Combatant[],
): Combatant[] {
  const size = (spell.aoe_size as number | null) ?? 0;
  const side = sideRule(spell);
  return all.filter((u) => {
    if (!(u.hp > 0 || u.conditions.has('dying'))) return false;
    if (side === 'enemies' && u.side === caster.side) return false;
    if (side === 'allies' && u.side !== caster.side) return false;
    return Math.max(0, dist(u.pos, origin) - u.radius) <= size;
  });
}

/**
 * `spells.effects` as an object, never a throw. Every shape reader goes through
 * this — one JSON.parse policy for the whole file.
 */
const parseEffects = (spell: SpellRow): Record<string, unknown> => {
  try {
    const fx = JSON.parse((spell.effects as string | null) ?? '{}') as unknown;
    return fx !== null && typeof fx === 'object' ? (fx as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const isKnownCondition = (id: string): id is ConditionId =>
  (CONDITION_IDS as readonly string[]).includes(id);

/**
 * The condition rider on a DAMAGE row (Sound Burst's stun, Tanglefoot Bag's
 * root). Distinct from `buffConditions` because a damage rider is applied only
 * on a failed save / a hit, and only ever one of them is authored.
 *
 * ⚠ THE ID IS NOW VALIDATED. This used to cast any string straight to
 * `ConditionId`, so `Nythara's Enervating Bolt` wrote a `'drained'` key into
 * the conditions Map that NOTHING reads and nothing can ever expire-with-
 * meaning — a fake status on the unit and in the field read-out. Unknown ids
 * are authored content awaiting an implementation (same rule `applySelfAbility`
 * already follows for Determination's 'clumsy'), so they are dropped, not
 * thrown on.
 */
function parseCondition(spell: SpellRow): { id: ConditionId; value: number } | null {
  const fx = parseEffects(spell);
  const id = fx['condition'];
  if (typeof id === 'string' && isKnownCondition(id)) {
    return { id, value: typeof fx['value'] === 'number' ? fx['value'] : 1 };
  }
  return null;
}

function isAutoHit(spell: SpellRow): boolean {
  return Boolean(parseEffects(spell)['auto_hit']);
}

// ═══════════════════════════════════════════════════════════════════════════
// BUFF / DEBUFF RESOLUTION (brief #25)
//
// MEASURED SHAPE DISTRIBUTION over all 96 buff+debuff rows (probe, not guess).
// Grouped by the SET OF KEYS in `effects`, the head of the distribution is:
//
//     29  rows carry `condition`   (spread over 13 different key-sets)
//     13  rows carry `bonus` + `to`
//     10  rows carry `resistance`  (no damage-type system exists yet)
//     ~54 rows are long-tail one-offs: polymorph, dominate, banish, fly,
//         true_sight, split_damage, mirror images, spell_resistance, …
//
// ⚠ HANDLING BOTH HEAD SHAPES CONVERTS 24 OF 96 ROWS, NOT 42 — MEASURED.
// The gap is the point and it is not a shortfall: a row matching a shape still
// only resolves if the engine HAS the thing it names. 5 of the 29 `condition`
// rows name conditions this game does not model (`friendly`, `sanctuary`,
// `invisible`, `confused`, `dazzled`, `enfeebled`, `drained`, `petrified`,
// `stupefied`, `fascinated`, `charmed`, `hostile_reactions`), and 4 of the 13
// `{bonus,to}` rows point at channels that do not exist (`next_check`,
// `skills`, `ac_vs_target`, `hex_target`).
//
// ⚠ THE TAIL IS NOT A TODO LIST — it is 40+ DISTINCT SYSTEMS, most of which
// (flight, polymorph, damage-type resistance, mind control that flips a unit's
// side) change the shape of the engine rather than adding a modifier. Leaving
// them HONESTLY unresolvable is the whole point: an offered spell that
// silently does nothing is the exact bug this project keeps fighting.
//
// NET EFFECT, MEASURED: engine-resolvable spells 78 → 102 of 218, and the
// wizard's arcane L1 menu — the number brief #22 flagged — 3 → 9 of 22.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `to` token → the engine condition that carries that bonus.
 *
 * ⚠ THIS MAP IS THE RESOLVABILITY GATE FOR `{bonus, to}`, so an unmapped token
 * must mean "this spell does NOT resolve", never "apply nothing and pretend".
 * `next_check`, `skills`, `ac_vs_target` and `hex_target` are all deliberately
 * absent: there is no skill-check roll inside combat, no per-target AC channel
 * and no hex system, so mapping them would be a lie the picker then repeats.
 */
const BONUS_TO_CONDITION: Readonly<Record<string, ConditionId>> = {
  ac: 'warded',
  attack: 'emboldened',
  saves: 'steeled',
  weapon_damage: 'honed',
};

/**
 * HOW LONG A BUFF/DEBUFF LASTS, IN TICKS.
 *
 * Precedence, and the order matters:
 *   1. `effects.duration` — authored in ROUNDS (Daze 1, Color Spray 2). Only
 *      2 rows use it, but where present it is the most specific statement.
 *   2. the `duration` COLUMN — prose ('1 minute', '10 minutes', '1 round').
 *   3. fallback: one round.
 *
 * ⚠ A "ROUND" IS `attackIntervalTicks`, NOT SIX SECONDS. This engine has no
 * rounds — it has a continuous clock and a 2s action cadence — so a PF2E round
 * translates to one action interval or the durations land meaninglessly long.
 * Mapping 6s literally would make Daze (1 round) outlast three of the dazed
 * unit's own actions, which inverts what the content says it does.
 *
 * ⚠ LONG DURATIONS ARE CLAMPED TO THE FIGHT, and that is deliberate rather
 * than lazy. 8 hours of Mage Armor is an out-of-combat statement; inside a
 * ~60-second encounter every duration past the stalemate window is the same
 * duration, and letting a raw 288,000-tick expiry sit on a Combatant would
 * make `expiresAtTick` arithmetic meaningless for anything reading it. There
 * is no between-fight buff persistence in this engine — that is its own brief
 * (buffs would need to live on HeroState with a backfill, exactly like
 * once-per-long-rest ability uses).
 */
const ROUND_TICKS = 20; // ENCOUNTER.attackIntervalTicks — one action cadence.
/** Ceiling for any timed spell effect: the stalemate window. Nothing outlives the fight. */
const MAX_EFFECT_TICKS = 300;

export function effectDurationTicks(spell: SpellRow): number {
  const fx = parseEffects(spell);
  const rounds = fx['duration'];
  if (typeof rounds === 'number' && rounds > 0) {
    return Math.min(rounds * ROUND_TICKS, MAX_EFFECT_TICKS);
  }
  const prose = ((spell.duration as string | null) ?? '').trim().toLowerCase();
  const m = /^(\d+)\s+(round|second|minute|hour)s?$/.exec(prose);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2];
    const ticks =
      unit === 'round' ? n * ROUND_TICKS
        : unit === 'second' ? n * TICKS_PER_SECOND
          : unit === 'minute' ? n * 60 * TICKS_PER_SECOND
            : n * 3600 * TICKS_PER_SECOND;
    return Math.min(ticks, MAX_EFFECT_TICKS);
  }
  // 'instant' and anything unparseable: one round. ⚠ 'instant' on a row that
  // ALSO names a condition means "the spell is over, the condition is not"
  // (Daze, Color Spray, Sound Burst) — treating it as zero would delete the
  // only thing those rows do.
  return ROUND_TICKS;
}

/** Every condition a buff/debuff row applies, or [] if the shape isn't handled. */
function buffConditions(spell: SpellRow): { id: ConditionId; value: number }[] {
  const fx = parseEffects(spell);
  const out: { id: ConditionId; value: number }[] = [];

  // SHAPE A — {condition[, value][, duration][, terrain]…}
  const condition = fx['condition'];
  if (typeof condition === 'string' && isKnownCondition(condition)) {
    const value = typeof fx['value'] === 'number' ? fx['value'] : 1;
    out.push({ id: condition, value });
  }

  // SHAPE B — {bonus, to}. `to` is COMMA-SEPARATED on 3 rows (Heroism's
  // 'attack,saves,skills'), so this is a token list, not a single key.
  const bonus = fx['bonus'];
  const to = fx['to'];
  if (typeof bonus === 'number' && typeof to === 'string') {
    for (const token of to.split(',').map((s) => s.trim())) {
      const id = BONUS_TO_CONDITION[token];
      // ⚠ An unmapped token is SKIPPED, not fatal — Heroism's 'skills' has no
      // combat consumer, but its 'attack' and 'saves' halves are real. A row
      // resolves if ANY token maps; `isBuffShapeResolvable` decides whether
      // the picker may offer it at all.
      if (id) out.push({ id, value: bonus });
    }
  }
  return out;
}

/**
 * CAN `resolveCast` EXECUTE THIS ROW? — the per-SPELL readiness gate.
 *
 * ⚠ THIS IS A PER-SPELL QUESTION AND IT MUST STAY ONE. `effect_type` is far
 * too coarse: of 96 buff/debuff rows only 24 land on a handled shape whose
 * conditions the engine actually models, so marking the whole `buff` type
 * resolvable would offer a player Mirror Image, Fly and Dominate and have all
 * three do exactly nothing when cast. The picker's honesty is the feature
 * (brief #22 §5.2).
 *
 * Damage and healing stay type-level because every row of those types
 * resolves; buff/debuff are shape-level because most rows do not.
 */
export function isBuffShapeResolvable(spell: SpellRow): boolean {
  return buffConditions(spell).length > 0;
}

/**
 * Resolve a cast against a primary target. Costs are spent here; the caller
 * (encounter loop) applies damage/healing and emits events from the result.
 */
export function resolveCast(
  caster: Combatant,
  spellId: number,
  primary: Combatant,
  all: readonly Combatant[],
  nowTick: number,
  rng: Rng,
): CastResult {
  const spell = spellsById.get(spellId);
  if (!spell) throw new Error(`resolveCast: unknown spell ${spellId}`);
  const { resource, cost } = spendCost(caster, spell);
  const casterLevel = caster.casting?.casterLevel ?? caster.level;
  const dc = caster.casting?.dc ?? 12;
  const dice = scaledDice(spell, casterLevel);
  const effectType = spell.effect_type as string | null;
  const condition = parseCondition(spell);
  const result: CastResult = { spell, resource, cost, targets: [], inert: false };

  if (effectType === 'healing') {
    const amount = rollDice(rng, dice);
    // ⚠ Brief #21 §2/§4 Q4: this branch used to return the PRIMARY ONLY, before
    // any area logic ran — which is why Heal Mass (burst 3), Heal Circle (burst
    // 2) and Grumply's Mass Mending (burst 6) each healed exactly one ally. The
    // content was always authored correctly; the engine never asked about shape.
    // `sideRule` sends healing to allies by derivation, so the caster's own side
    // is what a mass heal touches.
    const units = isAreaSpell(spell) ? areaTargets(spell, primary.pos, caster, all) : [primary];
    for (const unit of units) result.targets.push({ unit, damage: 0, healing: amount });
    return result;
  }

  if (effectType === 'damage') {
    const saveType = spell.save_type as string | null;
    // Brief #21 §3: shape is DECLARED, not inferred from save_type.
    const units = isAreaSpell(spell) ? areaTargets(spell, primary.pos, caster, all) : [primary];
    /**
     * ⚠ THE RIDER'S DURATION IS NOW THE CONTENT'S, not a hardcoded 100 ticks.
     * Brief #25 built `effectDurationTicks` for the buff branch and a damage
     * rider is the same question, so the flat 10-second constant became a
     * second, disagreeing answer to it. Sound Burst's stun now lasts one
     * action interval as its `{"duration": 1}` says, rather than five.
     */
    const riderTicks = nowTick + effectDurationTicks(spell);

    for (const unit of units) {
      const entry: SpellTargetResult = { unit, damage: 0, healing: 0 };
      if (isAutoHit(spell)) {
        entry.damage = rollDice(rng, dice); // Magic Missile: no roll, no save
      } else if (saveType) {
        const save = rollSave(unit, saveType, dc, rng);
        entry.save = save;
        entry.damage = Math.floor(rollDice(rng, dice) * basicSaveMultiplier(save.degree));
        if (condition && (save.degree === 'failure' || save.degree === 'critFailure')) {
          entry.conditionApplied = { ...condition, durationTicks: riderTicks };
        }
      } else {
        // Spell attack roll vs AC — never takes flurry (ported rule).
        const d20 = rng.die(20);
        const attackBonus = caster.casting?.attackBonus ?? 4;
        const effectiveAc = unit.ac + acMod(unit);
        const { degree, natStep } = determineDegree(d20 + attackBonus, effectiveAc, d20);
        entry.attack = { d20, modifier: attackBonus, total: d20 + attackBonus, dc: effectiveAc, degree, natStep };
        if (degree === 'success' || degree === 'critSuccess') {
          entry.damage = Math.max(rollDice(rng, dice) * (degree === 'critSuccess' ? 2 : 1), 1);
          if (condition) entry.conditionApplied = { ...condition, durationTicks: riderTicks };
        }
      }
      result.targets.push(entry);
    }
    return result;
  }

  /**
   * BUFF / DEBUFF (brief #25). Everything above this line is unchanged.
   *
   * ⚠ ONE TARGET ENTRY PER (unit, condition) PAIR — this is the design decision
   * that makes the whole brief need ZERO change to encounter.ts. `emitCastResults`
   * already loops `cast.targets` and applies+emits `conditionApplied` for each
   * entry, so a row that grants two conditions (Heroism: attack AND saves)
   * simply produces two entries for the same unit and the existing loop does
   * the right thing. The alternative — an array field on the entry — would have
   * required editing a file this brief may not touch.
   *
   * ⚠ A DEBUFF THAT ALLOWS A SAVE ROLLS IT, AND A SUCCESS MEANS NOTHING LANDS.
   * 43 of 44 debuff rows author `save_type`; without this branch Hold Person
   * would paralyse anything it touched with no roll, which is a far bigger
   * balance change than "buffs now work". Buffs skip the save entirely (51 of
   * 52 leave `save_type` NULL, and the one that doesn't — Sanctuary — targets
   * an ALLY, who would not resist a blessing).
   */
  const buffs = buffConditions(spell);
  if (buffs.length > 0 && (effectType === 'buff' || effectType === 'debuff')) {
    const durationTicks = nowTick + effectDurationTicks(spell);
    // Shape and side come from the SAME rules damage and healing use — an area
    // debuff (Web, Color Spray, Stinking Cloud) catches everyone in the burst,
    // and `sideRule` derives buff→allies / debuff→enemies (brief #21 §5).
    const units = isAreaSpell(spell) ? areaTargets(spell, primary.pos, caster, all) : [primary];
    const saveType = effectType === 'debuff' ? (spell.save_type as string | null) : null;

    for (const unit of units) {
      let save: RollBreakdown | undefined;
      if (saveType) {
        save = rollSave(unit, saveType, dc, rng);
        // PF2E: a successful save against a non-damaging effect negates it.
        // Degrees beyond pass/fail (critFailure → longer) are NOT modelled —
        // the content authors no crit-fail escalation for these rows except
        // three one-offs whose other keys we do not handle anyway.
        if (save.degree === 'success' || save.degree === 'critSuccess') {
          // ⚠ The resisted target STILL gets an entry, carrying the save and no
          // condition. Dropping it would make a resisted Hold Person
          // indistinguishable from one that was never cast, in the log and in
          // the tests.
          result.targets.push({ unit, damage: 0, healing: 0, save });
          continue;
        }
      }
      for (const c of buffs) {
        const entry: SpellTargetResult = {
          unit, damage: 0, healing: 0,
          conditionApplied: { id: c.id, value: c.value, durationTicks },
        };
        // The save appears on the FIRST entry only — one roll happened, and
        // repeating it per condition would tell the reader it happened twice.
        if (save) entry.save = save;
        save = undefined;
        result.targets.push(entry);
      }
    }
    return result;
  }

  // Rows whose shape has no resolver yet (utility, summon, and the 54
  // long-tail buff/debuff shapes). Recorded as inert, never a crash — and
  // `isBuffShapeResolvable` keeps the picker from offering them at all.
  result.inert = true;
  return result;
}

export function applyConditionFromCast(target: Combatant, c: NonNullable<SpellTargetResult['conditionApplied']>): void {
  applyCondition(target, c.id, c.value, c.durationTicks);
}
