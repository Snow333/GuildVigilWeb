/**
 * NEW LEARNING JOINS THE FIGHT (M1).
 *
 * Before M1 a spell learned at level-up went into `knownSpells` and nothing
 * else: the loadout — the list the combat AI actually plays down — never saw
 * it, so a level-5 wizard still fought with exactly the spells it was founded
 * with. This module decides where a newly learned spell sits in the loadout.
 *
 * Rules, top of the list wins (the AI takes the first entry it can afford):
 *  - HEALING goes on top, gated on an ally below 40% hp — a heal is the most
 *    urgent thing a caster can do, and never wasted at full health.
 *  - BUFFS go next, gated on "not already up" so they are cast once.
 *  - DAMAGE spells go below those, HIGHEST SPELL LEVEL FIRST, so the biggest
 *    slots are spent first and the list falls through to smaller spells and
 *    finally the at-will cantrip as slots run out.
 *  - DEBUFFS are NOT auto-added. A debuff on "always" would replace every
 *    damage cast forever; the loadout has no "target lacks condition" check
 *    yet, so the player places debuffs by hand.
 *
 * ⚠ ABILITIES (feats like Power Attack) are NOT auto-added either. Measured
 * (probe, 150 fights each): Power Attack on "always" took a fighter from
 * 86 → 28 wins against two bandits; Knockdown 86 → 10. A single-swing ability
 * replaces the normal two-swing action, so spamming it is a large loss. Those
 * need a design pass (M2), not a default.
 */

import { spellsById } from '@sim/registry';
import { spellConditionIds } from '@sim/combat/spells';
import type { LoadoutEntry } from '@sim/combat/loadout';

type Slot = 'heal' | 'buff' | 'damage' | 'skip';

function slotFor(spellId: number): Slot {
  const spell = spellsById.get(spellId);
  const effect = (spell?.effect_type as string | null) ?? '';
  if (effect === 'healing') return 'heal';
  if (effect === 'buff') return spell && spellConditionIds(spell).length > 0 ? 'buff' : 'skip';
  if (effect === 'damage') return 'damage';
  return 'skip';
}

const spellLevel = (spellId: number): number => (spellsById.get(spellId)?.spell_level as number | null) ?? 0;

function entryFor(spellId: number): LoadoutEntry | null {
  const slot = slotFor(spellId);
  if (slot === 'heal') {
    return { action: 'cast', spellId, condition: { kind: 'allyHpBelow', pct: 0.4 }, target: 'lowestAlly' };
  }
  if (slot === 'buff') {
    const spell = spellsById.get(spellId)!;
    const marker = spellConditionIds(spell)[0]!;
    return { action: 'cast', spellId, condition: { kind: 'notActive', conditionId: marker }, target: 'self' };
  }
  if (slot === 'damage') {
    return { action: 'cast', spellId, condition: { kind: 'always' }, target: 'scoredEnemy' };
  }
  return null;
}

const rank: Record<Slot, number> = { heal: 0, buff: 1, damage: 2, skip: 3 };

/** Where an existing entry sits in the same ordering (non-cast entries keep their place at the end). */
function entryRank(e: LoadoutEntry): [number, number] {
  if (e.action !== 'cast') return [4, 0];
  return [rank[slotFor(e.spellId)], -spellLevel(e.spellId)];
}

/**
 * The loadout with every NEW spell inserted at its rule position. Spells the
 * loadout already casts are left exactly where the player put them, and the
 * player's own entries keep their relative order.
 */
export function withLearnedSpells(loadout: readonly LoadoutEntry[], learned: readonly number[]): LoadoutEntry[] {
  const out = [...loadout];
  const present = new Set(out.filter((e) => e.action === 'cast').map((e) => (e as { spellId: number }).spellId));
  for (const spellId of learned) {
    if (present.has(spellId)) continue;
    const entry = entryFor(spellId);
    if (!entry) continue;
    const [r, l] = entryRank(entry);
    // Insert before the first existing entry that ranks strictly after the new one.
    let at = out.findIndex((e) => {
      const [er, el] = entryRank(e);
      return er > r || (er === r && el > l);
    });
    if (at < 0) at = out.length;
    out.splice(at, 0, entry);
    present.add(spellId);
  }
  return out;
}
