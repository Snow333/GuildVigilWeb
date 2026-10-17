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
 *  - ABILITIES are still NOT auto-added. The reason changed; see below.
 *
 * ⚠ ABILITIES STAY OUT OF THE AUTO PLAN — BUT NOT FOR M1'S REASON (M2, 2026-10-17).
 *
 * M1 withheld them because the ability MODEL made them a tax: an ability
 * strike was one swing where a normal action is two, so Power Attack measured
 * 45-53% of a plain strike and a fighter went 86 -> 28 wins on `always`. M2
 * fixed the model — an ability now rides a normal action and pays a cooldown,
 * measured at 109-116% of a plain strike against a sandbag. So the original
 * objection is gone, and a hand-placed ability is now worth placing.
 *
 * Auto-adding them was then built and MEASURED ON THE CAMPAIGN HARNESS, and
 * it still loses:
 *
 *   no abilities in the plan      completion 95.0%   wipes 4.4%
 *   Power Attack auto-added       completion 89.8%   wipes 9.6%
 *   + Intimidating Strike too     completion 92.7%   wipes 6.5%
 *
 * ⚠ THE SANDBAG PROBE AND THE CAMPAIGN DISAGREE, AND THE CAMPAIGN WINS. A
 * lone fighter beating a 1,000,000-hp dummy faster does not predict a party's
 * dungeon completion: the party result carries a run-length term (a party
 * that kills faster pushes deeper before it retreats, and dies there), which
 * the one-on-one probe cannot see. Do not re-derive the +15% figure and
 * conclude auto-adding is safe — it was measured, it is not.
 *
 * The cause of Power Attack's -5.2 points is NOT yet understood and is parked
 * in output/questions.md. Until it is, the player places abilities by hand in
 * the loadout editor, where the model fix makes them pay.
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
