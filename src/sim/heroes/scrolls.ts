/**
 * SCROLL LITERACY — who can read what (brief #24 §5, decisions D3/D4/D5).
 *
 * A scroll is a consumable that casts a spell (brief #23 M3 made those work).
 * The question this module answers is WHO may read one, and the answer is a
 * skill check against Arcana or Religion — so a Fighter who invests in Arcana
 * really can throw a Fireball from a scroll, and a Wizard reads arcane scrolls
 * natively.
 *
 * ── THE LADDER (D5) ───────────────────────────────────────────────────────
 *
 *   your own tradition:   skill >= spellLevel + 1
 *   anyone else:          skill >= 2 * spellLevel + 1
 *
 * ⚠ THE DISCOUNT MATTERS MORE THAN THE NUMBERS SUGGEST, because skill ranks
 * are capped at CHARACTER LEVEL (`maxSkillRanks`). So "Arcana 7" is not "spend
 * 7 points" — it is "be at least level 7, with every rank in Arcana". Measured
 * consequence: a Cleric reaches spell-3 divine scrolls at character level 4,
 * where a Fighter needs level 7.
 *
 * ── WHY THE PRIMARY TRADITION (and not "any match") ───────────────────────
 *
 * ⚠ `spell_list` IS MULTI-VALUED — "arcane,occult" is a normal value — and
 * 51 of the 52 authored scrolls include `arcane`. An "any tradition matches"
 * rule would therefore hand the Wizard 98% of all scrolls for free and make
 * the Religion gate govern exactly one item (Scroll of Heal). Keying on the
 * FIRST entry keeps the mapping one-scroll-one-skill, which is both fairer and
 * explicable to a player.
 */

import { spellsById } from '@sim/registry';
import { classesById } from '@sim/registry';
import { itemBasesById } from './equipment';
import { isSpellResolvable } from './knownSpells';
import type { HeroState } from './types';
import type { SpellRow } from './knownSpells';

/** Tradition → the skill that gates reading it. */
const TRADITION_SKILL: Readonly<Record<string, string>> = {
  arcane: 'arcana',
  divine: 'religion',
  occult: 'arcana',
  primal: 'nature',
};

/**
 * ⚠ `occult` MAPS TO ARCANA DELIBERATELY, not to a fourth skill.
 * PF2E would use Occultism; this game's skill table has no such row, and
 * inventing content to satisfy a gate would be backwards. 22 scrolls are
 * occult and all but one are ALSO arcane, so in practice the primary-tradition
 * rule sends them to Arcana anyway. Revisit if Occultism is ever authored.
 */

/** The scroll's gating tradition: the FIRST entry of its spell's list. */
export function primaryTradition(spell: SpellRow): string {
  const raw = (spell.spell_list as string | null) ?? '';
  return raw.split(',')[0]?.trim() ?? '';
}

/** The skill that gates this scroll, or null if the tradition is unknown. */
export function gatingSkill(spell: SpellRow): string | null {
  return TRADITION_SKILL[primaryTradition(spell)] ?? null;
}

/** Is this tradition the hero's own class list? Drives the D5 discount. */
export function isNativeTradition(classId: number, tradition: string): boolean {
  const row = classesById.get(classId);
  const list = (row?.spell_list as string | null) ?? '';
  if (list === '') return false; // Fighter, Rogue — no tradition of their own
  return list.split(',').map((s) => s.trim()).includes(tradition);
}

/** Ranks needed to read a scroll of this level (D5). */
export function ranksRequired(spellLevel: number, native: boolean): number {
  return native ? spellLevel + 1 : 2 * spellLevel + 1;
}

export type ScrollBlockReason =
  | 'not_a_scroll'
  | 'no_spell'
  | 'unknown_tradition'
  | 'insufficient_skill'
  | 'spell_not_implemented';

export interface ScrollReadResult {
  usable: boolean;
  reason?: ScrollBlockReason;
  /** For the UI: what the hero would need. Present whenever a skill gates it. */
  skill?: string;
  required?: number;
  current?: number;
  native?: boolean;
}

/**
 * May this hero read this scroll?
 *
 * ⚠ D4: AN UNQUALIFIED HERO IS SIMPLY BLOCKED — no risky attempt, no wasted
 * scroll. Consistent with every other readiness gate in the game (feats #22,
 * consumables #23), and it keeps the failure legible: the loadout row greys
 * out with a reason rather than silently never firing.
 *
 * ⚠ THE ENGINE-READINESS CHECK IS SEPARATE FROM THE SKILL CHECK, and both are
 * reported distinctly. A scroll the hero is qualified for but whose spell the
 * engine cannot yet cast must say `spell_not_implemented`, NOT "you lack the
 * skill" — telling a player to train Arcana for a spell that would do nothing
 * anyway is a lie that costs them levels.
 */
export function canReadScroll(
  hero: HeroState,
  classId: number,
  baseId: string,
): ScrollReadResult {
  const base = itemBasesById.get(baseId);
  if (!base || base.item_type !== 'scroll') return { usable: false, reason: 'not_a_scroll' };

  const spellId = base.spell_id as number | null;
  const spell = spellId === null ? undefined : spellsById.get(spellId);
  if (!spell) return { usable: false, reason: 'no_spell' };

  const tradition = primaryTradition(spell as SpellRow);
  const skill = gatingSkill(spell as SpellRow);
  if (!skill) return { usable: false, reason: 'unknown_tradition' };

  const native = isNativeTradition(classId, tradition);
  const spellLevel = (spell.spell_level as number | null) ?? 0;
  const required = ranksRequired(spellLevel, native);
  const current = hero.skills[skill] ?? 0;

  if (current < required) {
    return { usable: false, reason: 'insufficient_skill', skill, required, current, native };
  }
  if (!isSpellResolvable(spell as SpellRow)) {
    return { usable: false, reason: 'spell_not_implemented', skill, required, current, native };
  }
  return { usable: true, skill, required, current, native };
}

/** Player-facing explanation for a blocked scroll. */
export function scrollBlockLabel(r: ScrollReadResult): string {
  switch (r.reason) {
    case 'insufficient_skill':
      return `needs ${r.skill} ${r.required} (you have ${r.current})`;
    case 'spell_not_implemented':
      return 'this spell is not in the game yet';
    case 'no_spell':
    case 'unknown_tradition':
      return 'this scroll is malformed';
    case 'not_a_scroll':
      return 'not a scroll';
    default:
      return '';
  }
}
