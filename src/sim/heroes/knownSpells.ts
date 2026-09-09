/**
 * KNOWN SPELLS — the pool half of core-loop D4 (brief #22 M3).
 *
 * D4 is "known pool → ordered active loadout". The LOADOUT half shipped with
 * brief #15; the POOL half did not exist at all. Grepping `src/` for
 * `knownSpells`, `spellbook` or `prepared` returned nothing, so a hero's
 * castable set was whatever `muster.ts` hard-coded plus one auto-appended
 * cantrip. The loadout editor said so in its own margin: "spell entries join
 * the editor with the known-spells model."
 *
 * ⚠ THE POOL IS MOSTLY FUTURE CONTENT, AND THE PICKER SAYS SO.
 * `resolveCast` handles `damage` and `healing`; the other 140 of 218 spells
 * are inert (buff 52, debuff 44, utility 40, summon 4 — brief #21 left that
 * as its own brief). Measured for the two founding casters at levels 0–3:
 *
 *   Wizard (arcane): 17 of 72 resolvable  (24%) — L1 is 3 of 22, L2 is 2 of 16
 *   Cleric (divine): 12 of 43 resolvable  (28%)
 *
 * Steven's decision (#22 §5.2): show the rest GREYED with a reason rather than
 * hiding them, exactly as the feat picker does. A player seeing "Mage Armor —
 * not yet available" learns the game is growing; a player seeing a 3-item list
 * learns the game is small. Same fact, and the honest presentation is cheaper
 * than the dishonest one.
 */

import { spells } from '@content/generated';
import { classesById, spellsById } from '@sim/registry';
import { progressionFor } from '@sim/registry';
import type { UnreadyReason } from './featEffects';
import type { HeroState } from './types';

type SpellRow = (typeof spells)[number];

/**
 * The effect types `resolveCast` can actually execute today.
 *
 * ⚠ THIS IS THE SPELL SIDE OF THE READINESS GATE and it is deliberately
 * derived from the ENGINE, not from a content column: spells carry no
 * `implemented` flag at all (0 of 218 rows). When the buff/debuff brief lands,
 * add its types here and the picker widens on its own.
 */
export const RESOLVABLE_EFFECTS: ReadonlySet<string> = new Set(['damage', 'healing']);

export function isSpellResolvable(spell: SpellRow): boolean {
  return RESOLVABLE_EFFECTS.has((spell.effect_type as string | null) ?? '');
}

/** Does this spell appear on the given tradition's list? */
export function onSpellList(spell: SpellRow, tradition: string): boolean {
  const lists = ((spell.spell_list as string | null) ?? '').split(',').map((s) => s.trim());
  return lists.includes(tradition);
}

/**
 * The highest spell level this hero can cast in `classId`, from the authored
 * slot schedule. Cantrips (level 0) are always available to a caster.
 *
 * ⚠ Reads `spell_slots_*` off `class_progression` rather than deriving from
 * level — the schedule is content, and Wizard/Cleric share it today but a
 * future class need not.
 */
export function maxSpellLevel(classId: number, classLevel: number): number {
  const prog = progressionFor(classId, classLevel);
  if (!prog) return -1;
  const slots = [
    prog.spell_slots_0, prog.spell_slots_1, prog.spell_slots_2, prog.spell_slots_3,
    prog.spell_slots_4, prog.spell_slots_5, prog.spell_slots_6, prog.spell_slots_7,
    prog.spell_slots_8, prog.spell_slots_9,
  ] as (number | null)[];
  let best = -1;
  for (let lvl = 0; lvl < slots.length; lvl++) {
    if ((slots[lvl] ?? 0) > 0) best = lvl;
  }
  return best;
}

export interface SpellOffer {
  spellId: number;
  name: string;
  spellLevel: number;
  effectType: string;
  school: string;
  description: string;
  selectable: boolean;
  reason?: UnreadyReason;
  detail?: string;
}

/**
 * Every spell a hero could learn in this class, each marked selectable or not.
 *
 * ⚠ RETURNS UNSELECTABLE ROWS ON PURPOSE — see the module header. Callers that
 * want only the learnable ones filter on `.selectable`; the UI does not.
 */
export function spellOffers(hero: HeroState, classId: number): SpellOffer[] {
  const classRow = classesById.get(classId);
  const tradition = (classRow?.spell_list as string | null) ?? null;
  if (!tradition) return []; // pure martial: Fighter, Rogue

  const classLevel = hero.classLevels.find((c) => c.classId === classId)?.level ?? 0;
  const ceiling = maxSpellLevel(classId, classLevel);
  const known = new Set(hero.knownSpells ?? []);

  const out: SpellOffer[] = [];
  for (const spell of spells) {
    if (!onSpellList(spell, tradition)) continue;
    const spellLevel = (spell.spell_level as number | null) ?? 0;

    const offer: SpellOffer = {
      spellId: spell.id,
      name: spell.name,
      spellLevel,
      effectType: (spell.effect_type as string | null) ?? '',
      school: (spell.school as string | null) ?? '',
      description: (spell.description as string | null) ?? '',
      selectable: true,
    };

    if (known.has(spell.id)) {
      offer.selectable = false;
      offer.reason = 'already_taken';
    } else if (spellLevel > ceiling) {
      offer.selectable = false;
      offer.reason = 'level_unmet';
      offer.detail = spellLevel === 0 ? 'Requires a caster' : `Requires level ${spellLevel} slots`;
    } else if (!isSpellResolvable(spell)) {
      offer.selectable = false;
      offer.reason = 'not_yet_implemented';
    }

    out.push(offer);
  }

  out.sort((a, b) => a.spellLevel - b.spellLevel || a.spellId - b.spellId);
  return out;
}

/** Only the spells this hero may learn right now. */
export function learnableSpells(hero: HeroState, classId: number): SpellOffer[] {
  return spellOffers(hero, classId).filter((o) => o.selectable);
}

/**
 * How many new spells a caster learns on reaching this class level.
 *
 * ⚠ ENGINE POLICY, NOT CONTENT — the db has no spells-known column. Two at
 * level 1 (a caster with one spell has no decisions), one per level after.
 * Deliberately modest: the resolvable pool is 24–28%, so a generous rate would
 * exhaust it and hand the player an all-grey menu.
 */
export function spellsLearnedAtLevel(classId: number, classLevel: number): number {
  const classRow = classesById.get(classId);
  if (!classRow?.spell_list) return 0;
  return classLevel <= 1 ? 2 : 1;
}

/** The hero's known spells that the engine can actually cast, in level order. */
export function castableSpells(hero: HeroState): number[] {
  return (hero.knownSpells ?? [])
    .map((id) => spellsById.get(id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined && isSpellResolvable(s))
    .sort((a, b) => ((a.spell_level as number) ?? 0) - ((b.spell_level as number) ?? 0) || a.id - b.id)
    .map((s) => s.id);
}
