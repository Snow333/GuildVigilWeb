/**
 * COMBAT ABILITIES — the `combat_action` layer (brief #22 M2).
 *
 * `LoadoutEntry` was `strike | cast | toggle`. 51 feats classify as
 * `combat_action` and NONE of them could be expressed in a loadout, so a
 * fighter's whole active kit was unreachable: Torvald swung a longsword
 * identically at level 1 and level 20. This module is the fourth verb.
 *
 * ⚠ THE HOLD ON THIS VERB WAS SCOPE, NOT MEASUREMENT. CLAUDE.md listed it as
 * "HELD by measurement" beside the threat/taunt mechanic. Brief #15 §148 logs
 * the verb as "unmeasured — unlocks 51 feats"; the THREAT MECHANIC is the one
 * with the measured −3.5 completion / +8.5 wipes. They were held in one
 * sentence for scope and the nuance eroded. Threat stays held; this does not.
 *
 * ── THE THREE LIMITERS (brief #22 D2) ──────────────────────────────────────
 *
 * Steven asked for three, and they are DISTINCT SYSTEMS, not three names for
 * one thing. Two are in scope here; the design keeps the third separable so it
 * drops in without reworking these:
 *
 *   1. COOLDOWN (ticks)     — "usable again in N seconds of fight".  ✅ here
 *   2. ONCE PER COMBAT      — one shot per encounter.                ✅ here
 *   3. ONCE PER LONG REST   — one per day, restored by resting.      ❌ later
 *
 * (3) needs the rest/recovery loop and, unlike (1) and (2), its state must
 * SURVIVE the encounter — it belongs on `HeroState`, not on `Combatant`.
 * Everything here is per-encounter and dies with the Combatant, which is why
 * no save migration is needed for M2.
 *
 * ⚠ ACTION COST IS ORTHOGONAL TO ALL THREE. `actions: N` is a TIME cost, not a
 * limiter: a 2-action ability scales the next interval by N, so Power Attack
 * is "one bigger hit instead of two normal ones" rather than a free upgrade.
 * Without it every active would be strictly better than striking and the
 * loadout choice would be fake — the AI would take Power Attack every time and
 * the player's ordering would mean nothing.
 */

import type { Rng } from '@sim/core/rng';
import { featEffectsById, isEffectReady } from '@sim/heroes/featEffects';
import { ENCOUNTER } from '@content/combat';
import { boundToRoom, type RoomBounds } from './ai';
import { applyCondition, CONDITION_IDS, type ConditionId } from './conditions';
import type { Combatant } from './types';

/** The nine wired actives, by their content `effect` verb. */
export type AbilityEffect =
  | 'strike_with_bonus'
  | 'strike_plus_condition'
  | 'strike_plus_shove'
  | 'strike_plus_trip'
  | 'strike_plus_channel'
  | 'remove_condition'
  | 'grant_ally_ac'
  | 'apply_weapon_poison';

export interface AbilityDef {
  featId: number;
  name: string;
  effect: AbilityEffect;
  /** Time cost: scales the next action interval. Content's `actions` field. */
  actions: number;
  /** Limiter 2 — one use per encounter. */
  oncePerCombat: boolean;
  /** Limiter 1 — ticks before reuse. 0 = no cooldown. */
  cooldownTicks: number;
  /** Does this route through the normal strike path (rider applied after)? */
  isStrike: boolean;
  raw: Record<string, unknown>;
}

const STRIKE_EFFECTS: ReadonlySet<string> = new Set([
  'strike_with_bonus', 'strike_plus_condition', 'strike_plus_shove',
  'strike_plus_trip', 'strike_plus_channel',
]);

const KNOWN_EFFECTS: ReadonlySet<string> = new Set([...STRIKE_EFFECTS,
  'remove_condition', 'grant_ally_ac', 'apply_weapon_poison']);

/**
 * ⚠ COOLDOWNS ARE ENGINE POLICY, NOT CONTENT — for now.
 *
 * No feat row carries a cooldown field today; the content expresses limits as
 * `actions` (time cost) and `limit: once_per_combat`. The cooldown MECHANISM
 * is built and tested here because Steven asked for all three tiers, and this
 * map is where a per-feat cooldown is declared until a seed adds a column.
 *
 * ⚠ Adding `cooldown_ticks` to the feats table costs NO tooling change — the
 * converter is `SELECT *` and the count gates count ROWS (CLAUDE.md, Data
 * discipline). When that column lands, read it here and delete this map.
 */
const COOLDOWN_TICKS: Readonly<Record<number, number>> = {
  // Poison Weapon: a re-application every ~6s would make the 1d4 rider
  // permanent uptime. One application per two normal swings.
  71: ENCOUNTER.attackIntervalTicks * 2,
  // Defensive Ward: +2 AC "until the start of your next turn" — re-warding
  // every action is the same as a permanent buff, so it gates to its duration.
  138: ENCOUNTER.attackIntervalTicks * 2,
};

const defCache = new Map<number, AbilityDef | null>();

/** Parse a feat into an ability definition. Null when it is not a wired active. */
export function abilityDef(featId: number): AbilityDef | null {
  const cached = defCache.get(featId);
  if (cached !== undefined) return cached;

  const fx = featEffectsById.get(featId);
  let def: AbilityDef | null = null;
  if (fx && fx.effectType === 'combat_action' && isEffectReady(featId)) {
    const effect = fx.raw['effect'] as string | undefined;
    if (effect && KNOWN_EFFECTS.has(effect)) {
      def = {
        featId,
        name: fx.featName,
        effect: effect as AbilityEffect,
        actions: Math.max(1, (fx.raw['actions'] as number | undefined) ?? 1),
        oncePerCombat: fx.raw['limit'] === 'once_per_combat',
        cooldownTicks: COOLDOWN_TICKS[featId] ?? 0,
        isStrike: STRIKE_EFFECTS.has(effect),
        raw: fx.raw,
      };
    }
  }
  defCache.set(featId, def);
  return def;
}

/** Is this ability off cooldown and within its use limit right now? */
export function abilityReady(u: Combatant, featId: number, tick: number): boolean {
  const def = abilityDef(featId);
  if (!def) return false;
  if (def.oncePerCombat && (u.abilityUses.get(featId) ?? 0) >= 1) return false;
  const readyAt = u.abilityReadyAt.get(featId);
  if (readyAt !== undefined && tick < readyAt) return false;
  return true;
}

/** Record a use: bumps the counter and starts the cooldown. */
export function consumeAbility(u: Combatant, featId: number, tick: number): void {
  const def = abilityDef(featId);
  if (!def) return;
  u.abilityUses.set(featId, (u.abilityUses.get(featId) ?? 0) + 1);
  if (def.cooldownTicks > 0) u.abilityReadyAt.set(featId, tick + def.cooldownTicks);
}

/**
 * The interval this ability imposes on the NEXT action — the time cost.
 * `actions: 2` means the swing occupies two actions' worth of the clock.
 */
export function abilityInterval(baseInterval: number, def: AbilityDef): number {
  return baseInterval * def.actions;
}

// ── Riders on a strike ──────────────────────────────────────────────────────

export interface StrikeRiderContext {
  rng: Rng;
  tick: number;
  room: RoomBounds;
  /** True on a critical hit (some riders escalate). */
  critical: boolean;
}

export interface RiderOutcome {
  /** Extra damage the rider added, folded into the strike's total by the caller. */
  bonusDamage: number;
  /** Conditions applied to the TARGET, for the caller to emit. */
  conditions: { id: ConditionId; value: number; durationTicks: number }[];
  /** True when the target was displaced (caller may emit a move). */
  pushed: boolean;
}

const NO_RIDER: RiderOutcome = { bonusDamage: 0, conditions: [], pushed: false };

const isKnownCondition = (id: string): id is ConditionId =>
  (CONDITION_IDS as readonly string[]).includes(id);

/**
 * Apply an ability's on-hit rider. Called ONLY after a hit resolves — a missed
 * ability strike does nothing extra, which is why the rider is separate from
 * the strike itself rather than folded into `resolveStrike`.
 *
 * ⚠ `bonusDamage` is RETURNED, not applied: `resolveStrike` owns damage and
 * the caller folds this in before `applyDamage`, so a rider can never
 * double-apply or bypass the min-1-on-hit floor.
 */
export function applyStrikeRider(
  def: AbilityDef,
  attacker: Combatant,
  target: Combatant,
  ctx: StrikeRiderContext,
): RiderOutcome {
  switch (def.effect) {
    case 'strike_with_bonus': {
      // Power Attack: one extra weapon damage die. The die comes from the
      // attacker's own weapon, so a greatsword gains more than a dagger —
      // that is the intended shape, not a scaling bug.
      const dice = attacker.damageDice;
      const match = /d(\d+)/.exec(dice);
      const faces = match?.[1] ? Number(match[1]) : 6;
      return { ...NO_RIDER, bonusDamage: ctx.rng.die(faces) };
    }

    case 'strike_plus_condition': {
      const payload = (ctx.critical ? def.raw['on_crit'] : def.raw['on_hit']) as
        | { apply_condition?: string; value?: number }
        | undefined;
      const id = payload?.apply_condition;
      if (!id || !isKnownCondition(id)) return NO_RIDER;
      const value = payload.value ?? 1;
      // Frightened decays in PF2E; ticks are the local currency, so it runs
      // for one normal action interval per point.
      const durationTicks = ENCOUNTER.attackIntervalTicks * value;
      applyCondition(target, id, value, ctx.tick + durationTicks);
      return { ...NO_RIDER, conditions: [{ id, value, durationTicks }] };
    }

    case 'strike_plus_shove': {
      // Push the target one tile directly away from the attacker, clamped to
      // the room — brief #19's walls apply to forced movement too, so a shove
      // into a wall stops at the wall instead of leaving the field.
      const dx = target.pos.x - attacker.pos.x;
      const dy = target.pos.y - attacker.pos.y;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        const to = boundToRoom(
          { x: target.pos.x + dx / len, y: target.pos.y + dy / len },
          ctx.room,
          target.radius,
        );
        target.pos.x = to.x;
        target.pos.y = to.y;
      }
      const out: RiderOutcome = { bonusDamage: 0, conditions: [], pushed: len > 0 };
      if (ctx.critical) {
        const durationTicks = ENCOUNTER.attackIntervalTicks;
        applyCondition(target, 'flat_footed', 1, ctx.tick + durationTicks);
        out.conditions.push({ id: 'flat_footed', value: 1, durationTicks });
      }
      return out;
    }

    case 'strike_plus_trip': {
      // Athletics vs the target's Fortitude-ish resistance. Improved Knockdown
      // skips the multiple-attack penalty and auto-trips on a critical strike.
      if (ctx.critical && def.raw['trip_auto_success_on_crit_strike'] === true) {
        const durationTicks = ENCOUNTER.attackIntervalTicks;
        applyCondition(target, 'prone', 1, ctx.tick + durationTicks);
        return { ...NO_RIDER, conditions: [{ id: 'prone', value: 1, durationTicks }] };
      }
      const mapPenalty = def.raw['trip_uses_MAP'] === true ? -5 : 0;
      const roll = ctx.rng.die(20) + attacker.athletics + mapPenalty;
      const dc = 10 + target.saves.fort;
      if (roll >= dc) {
        const durationTicks = ENCOUNTER.attackIntervalTicks;
        applyCondition(target, 'prone', 1, ctx.tick + durationTicks);
        return { ...NO_RIDER, conditions: [{ id: 'prone', value: 1, durationTicks }] };
      }
      return NO_RIDER;
    }

    case 'strike_plus_channel': {
      // Channel Smite spends a divine slot for slot-level d6 extra damage.
      // ⚠ Spends the HIGHEST available slot, and does nothing without one —
      // the cost is real, so the AI cannot use this as a free damage bump.
      const casting = attacker.casting;
      if (!casting || casting.kind !== 'slots') return NO_RIDER;
      let best = 0;
      for (let lvl = casting.slots.length - 1; lvl >= 1; lvl--) {
        if ((casting.slots[lvl] ?? 0) > 0) { best = lvl; break; }
      }
      if (best === 0) return NO_RIDER;
      casting.slots[best] = (casting.slots[best] ?? 0) - 1;
      let total = 0;
      for (let i = 0; i < best; i++) total += ctx.rng.die(6);
      return { ...NO_RIDER, bonusDamage: total };
    }

    default:
      return NO_RIDER;
  }
}

// ── Non-strike abilities ────────────────────────────────────────────────────

export interface SelfAbilityOutcome {
  /** Condition ids cleared from the user (Determination). */
  removed: ConditionId[];
  /** An ally buffed, if any (Defensive Ward). */
  buffedAllyId?: string;
  /** True when the ability did something; false means it should not have fired. */
  applied: boolean;
}

/**
 * Abilities that do not swing: Determination, Defensive Ward, Poison Weapon.
 * Returns what happened so the caller can emit; mutation happens here.
 */
export function applySelfAbility(
  def: AbilityDef,
  u: Combatant,
  all: readonly Combatant[],
  tick: number,
): SelfAbilityOutcome {
  switch (def.effect) {
    case 'remove_condition': {
      // ⚠ Two of the five listed conditions DO NOT EXIST in this engine
      // ('enfeebled', 'clumsy' are not in CONDITION_IDS). Filtering rather
      // than throwing is deliberate: the content names a PF2E condition the
      // sim has not modelled yet, which is authored content awaiting an
      // implementation, not corrupt data.
      const removable = (def.raw['conditions_removable'] as string[] | undefined) ?? [];
      const removed: ConditionId[] = [];
      for (const id of removable) {
        if (!isKnownCondition(id)) continue;
        if (u.conditions.delete(id)) removed.push(id);
      }
      return { removed, applied: removed.length > 0 };
    }

    case 'grant_ally_ac': {
      const bonus = (def.raw['ac_bonus'] as number | undefined) ?? 2;
      // Lowest-HP living ally, mirroring the loadout's `lowestAlly` intent:
      // the ward goes where it matters, not to whoever is nearest by index.
      let best: Combatant | null = null;
      for (const a of all) {
        if (a.side !== u.side || a.id === u.id || a.hp <= 0) continue;
        if (!best || a.hp / a.maxHp < best.hp / best.maxHp) best = a;
      }
      if (!best) return { removed: [], applied: false };
      applyCondition(best, 'defending', bonus, tick + ENCOUNTER.attackIntervalTicks * 2);
      return { removed: [], buffedAllyId: best.id, applied: true };
    }

    case 'apply_weapon_poison': {
      // The poison rides the NEXT strike; `pendingPoison` is consumed there.
      const scaling = def.raw['scaling'] as { per_6_levels?: string } | undefined;
      const stacks = scaling?.per_6_levels ? 1 + Math.floor(u.level / 6) : 1;
      u.pendingPoisonDice = `${stacks}d4`;
      return { removed: [], applied: true };
    }

    default:
      return { removed: [], applied: false };
  }
}
