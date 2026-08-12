/**
 * Hero → Combatant assembly — where the character sheet finally becomes a
 * fighter. Everything DERIVES here (constraint 7): proficiency from class
 * levels, attack/damage from the equipped weapon instance, AC from armor+dex,
 * saves from proficiency tiers, sneak dice from the Sneak Attack feat,
 * reactions from class features + feats. Nothing on the Combatant is stored
 * hero state except hp/wounded carried across a mission.
 *
 * Ported conventions:
 *  - finesse weapons attack with the better of STR/DEX; damage stays STR
 *  - armor max_dex caps the AC dex contribution
 *  - Weapon Specialization reads its tier_bonus table off the weapon_attack tier
 *  - feat stat_mod vocabulary: save_fort/save_ref/save_will, initiative, speed,
 *    hp_per_level, spell_attack (the registry's spellings, not invented ones)
 */

import type { ItemInstance } from '@sim/core/events/types';
import type { LoadoutEntry } from '@sim/combat/loadout';
import type { Combatant } from '@sim/combat/types';
import type { DispatchHero } from '@sim/dungeon/checks';
import {
  aggregateStatBonuses,
  deriveItem,
  itemBasesById,
  type DerivedItem,
} from '@sim/heroes/equipment';
import { featEffectsById, resolveSkillMods, resolveStatMods } from '@sim/heroes/featEffects';
import { bestTier, totalProficiency } from '@sim/heroes/proficiency';
import { abilityMod, characterLevel, type AbilityKey, type HeroState } from '@sim/heroes/types';
import { classesById, progressionFor, warlockCostByLevel } from '@sim/registry';

export interface HeroKit {
  hero: HeroState;
  equipped: ItemInstance[];
  loadout: LoadoutEntry[];
}

const BASE_SPEED = 5; // world units/sec (medium creature; old grid: 1 unit = 5 ft)

const SKILL_ABILITY: Record<string, AbilityKey> = {
  perception: 'wis',
  thievery: 'dex',
  athletics: 'str',
};

function parseFeatures(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/** Class features accumulated across every class level the hero has taken. */
function classFeatures(hero: HeroState): Set<string> {
  const out = new Set<string>();
  for (const cl of hero.classLevels) {
    for (let lvl = 1; lvl <= cl.level; lvl++) {
      const prog = progressionFor(cl.classId, lvl);
      if (prog) for (const f of parseFeatures(prog.features)) out.add(f);
    }
  }
  return out;
}

/** The equipped weapon/armor split, derived once. */
function equippedGear(equipped: readonly ItemInstance[]): {
  weapon: { derived: DerivedItem; instance: ItemInstance } | null;
  acBonus: number;
  maxDex: number | null;
} {
  let weapon: { derived: DerivedItem; instance: ItemInstance } | null = null;
  let acBonus = 0;
  let maxDex: number | null = null;
  for (const inst of equipped) {
    const derived = deriveItem(inst);
    if (derived.itemType === 'weapon' && derived.damageDice && weapon === null) {
      weapon = { derived, instance: inst };
    } else if (derived.itemType === 'armor' || derived.itemType === 'shield') {
      acBonus += derived.acBonus;
      const cap = itemBasesById.get(inst.baseId)?.max_dex as number | null | undefined;
      if (cap !== null && cap !== undefined) maxDex = maxDex === null ? cap : Math.min(maxDex, cap);
    } else {
      acBonus += derived.acBonus; // wondrous AC items (rings, cloaks)
    }
  }
  return { weapon, acBonus, maxDex };
}

/** Sneak Attack: the feat's own scaling payload, keyed to the granting class's level. */
function sneakDice(hero: HeroState): string {
  for (const hf of hero.feats) {
    const fx = featEffectsById.get(hf.featId);
    if (!fx || fx.effectType !== 'passive_modifier') continue;
    if (fx.raw['trigger'] !== 'strike_vs_flat_footed' || fx.raw['effect'] !== 'bonus_damage') continue;
    const level =
      fx.classId === null
        ? characterLevel(hero)
        : Math.max(hero.classLevels.find((c) => c.classId === fx.classId)?.level ?? 0, 1);
    const scaling = fx.raw['damage_scaling'] as { die?: string } | undefined;
    const die = scaling?.die ?? 'd6';
    return `${Math.ceil(level / 2)}${die}`;
  }
  return '';
}

/** Reactions from class features and reaction-type feats (combat-known ids only). */
function reactionIds(hero: HeroState, features: Set<string>): string[] {
  const out = new Set<string>();
  if (features.has('attack_of_opportunity')) out.add('aoo');
  for (const hf of hero.feats) {
    const fx = featEffectsById.get(hf.featId);
    if (!fx || fx.effectType !== 'reaction') continue;
    if (fx.featName === 'Reactive Strike') out.add('aoo');
    if (fx.featName === 'Nimble Dodge') out.add('nimbleDodge');
  }
  return [...out];
}

/** Weapon Specialization: tier_bonus table read off the current weapon_attack tier. */
function weaponSpecBonus(hero: HeroState): number {
  for (const hf of hero.feats) {
    const fx = featEffectsById.get(hf.featId);
    if (!fx || fx.effectType !== 'weapon_spec') continue;
    const table = fx.raw['tier_bonus'] as Record<string, number> | undefined;
    if (!table) continue;
    return table[String(bestTier(hero, 'weapon_attack'))] ?? 0;
  }
  return 0;
}

/** Caster block from the hero's best casting class, or null for pure martials. */
function castingBlock(
  hero: HeroState,
  mods: Record<AbilityKey, number>,
  featStat: Record<string, number>,
): Combatant['casting'] {
  let best: { classId: number; level: number; stat: AbilityKey; name: string } | null = null;
  for (const cl of hero.classLevels) {
    const row = classesById.get(cl.classId);
    const stat = row?.casting_stat as AbilityKey | null | undefined;
    if (!row || !stat) continue;
    if (!best || cl.level > best.level) best = { classId: cl.classId, level: cl.level, stat, name: row.name };
  }
  if (!best) return null;

  const prog = progressionFor(best.classId, best.level);
  if (!prog) return null;
  const slots = [
    0,
    prog.spell_slots_1, prog.spell_slots_2, prog.spell_slots_3, prog.spell_slots_4,
    prog.spell_slots_5, prog.spell_slots_6, prog.spell_slots_7, prog.spell_slots_8,
    prog.spell_slots_9,
  ] as number[];

  const castMod = mods[best.stat];
  const isPact = best.name === 'Warlock';
  // Pact casters convert their listed slots into energy via the hand-set curve —
  // derived from data, not invented (warlock content deepens in Phase 3).
  const pactEnergy = isPact
    ? slots.reduce((sum, n, lvl) => sum + n * (warlockCostByLevel.get(lvl) ?? 0), 0)
    : 0;

  return {
    attackBonus: totalProficiency(hero, 'spell_attack') + castMod + (featStat['spell_attack'] ?? 0),
    dc: 10 + totalProficiency(hero, 'spell_dc') + castMod,
    casterLevel: best.level,
    kind: isPact ? 'pact' : 'slots',
    slots: isPact ? slots.map(() => 0) : slots,
    pactEnergy,
  };
}

/** One hero, fully derived, ready for travel encounters and dungeon dispatch. */
export function assembleHero(kit: HeroKit): DispatchHero {
  const { hero, equipped, loadout } = kit;
  const level = characterLevel(hero);
  const itemStat = aggregateStatBonuses(equipped);
  const featStat = resolveStatMods(hero, hero.feats);
  const featSkill = resolveSkillMods(hero, hero.feats);
  const features = classFeatures(hero);
  const gear = equippedGear(equipped);

  const mods = {} as Record<AbilityKey, number>;
  for (const key of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as AbilityKey[]) {
    mods[key] = abilityMod(hero.abilities[key] + (itemStat[key] ?? 0));
  }

  // ── Weapon math ──
  const weapon = gear.weapon;
  const traits = weapon?.derived.weaponTraits ?? [];
  const finesse = traits.includes('finesse');
  const atkMod = finesse ? Math.max(mods.str, mods.dex) : mods.str;
  const attackBonus =
    totalProficiency(hero, 'weapon_attack') + atkMod + (weapon?.derived.attackBonus ?? 0);
  const dmgBonus = mods.str;
  const baseDice = weapon?.derived.damageDice ?? '1d4'; // unarmed fallback
  const damageDice =
    dmgBonus > 0 ? `${baseDice}+${dmgBonus}` : dmgBonus < 0 ? `${baseDice}${dmgBonus}` : baseDice;
  const weaponRange = weapon
    ? ((itemBasesById.get(weapon.instance.baseId)?.weapon_range as number | null) ?? 1)
    : 1;

  // ── Defense ──
  const dexToAc = gear.maxDex === null ? mods.dex : Math.min(mods.dex, gear.maxDex);
  const ac = 10 + gear.acBonus + dexToAc + (itemStat['ac'] ?? 0);
  const saves = {
    fort: totalProficiency(hero, 'fort_save') + mods.con + (featStat['save_fort'] ?? 0) + (itemStat['save_fort'] ?? 0),
    ref: totalProficiency(hero, 'ref_save') + mods.dex + (featStat['save_ref'] ?? 0) + (itemStat['save_ref'] ?? 0),
    will: totalProficiency(hero, 'will_save') + mods.wis + (featStat['save_will'] ?? 0) + (itemStat['save_will'] ?? 0),
  };
  const maxHp = hero.maxHp + (featStat['hp_per_level'] ?? 0) * level + (itemStat['hp'] ?? 0);

  // ── Skills (rank + governing ability + feat skill mods) ──
  const skill = (name: string): number =>
    (hero.skills[name] ?? 0) + mods[SKILL_ABILITY[name] ?? 'wis'] + (featSkill[name] ?? 0);

  const casting = castingBlock(hero, mods, featStat);

  const c: Combatant = {
    id: hero.id,
    name: hero.name,
    baseId: hero.id,
    side: 'heroes',
    isHero: true,
    pos: { x: 0, y: 0 },
    maxHp,
    hp: maxHp,
    ac,
    attackBonus,
    damageDice,
    weaponRange,
    weaponAgile: traits.includes('agile'),
    weaponPenalty: 0,
    weaponSpecBonus: weaponSpecBonus(hero),
    isWeaponProficient: true,
    sneakAttackDice: sneakDice(hero),
    speed: BASE_SPEED + (featStat['speed'] ?? 0),
    wounded: hero.wounded,
    level,
    initiativeBonus: skill('perception') + (featStat['initiative'] ?? 0),
    isCaster: casting !== null,
    saves,
    tempHp: 0,
    casting,
    loadout,
    reactions: reactionIds(hero, features),
    lastReactionTick: -1000,
    conditions: new Map(),
    flurrySwings: 0,
    lastSwingTick: 0,
    nextActionTick: 0,
  };

  return {
    c,
    skills: {
      perception: skill('perception'),
      thievery: skill('thievery'),
      athletics: skill('athletics'),
    },
  };
}

export function assembleParty(kits: readonly HeroKit[]): DispatchHero[] {
  return kits.map((k) => assembleHero(k));
}
