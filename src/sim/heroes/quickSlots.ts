/**
 * CONSUMABLES & QUICK-SLOTS — the pre-expedition pouch (brief #23 M3).
 *
 * Core-loop D3 locked **11 gear + 4 consumable quick-slots + 2 weapon sets**.
 * Before this module the sim had no consumable concept at all: 12 authored
 * consumable rows and 52 scrolls existed and NONE was usable.
 *
 * ⚠ THE CONTENT IS CLEAN — cleaner than `itemization-summary.md` §7 implies.
 * All 12 consumables resolve to purpose-authored spell rows (ids 208–219)
 * carrying real dice, and **6 of the 12 already work through `resolveCast`**
 * (4 healing potions, Elixir of Life, Alchemist Fire, Holy Water, Thunderstone
 * — `healing` and `damage`). The other three are `buff` and stay inert until
 * the buff/debuff brief, greying out exactly as spells do.
 *
 * ── THE PERSISTENCE SPLIT, AND WHY IT MATTERS ──────────────────────────────
 *
 * ⚠ A CONSUMABLE IS THE FIRST THING IN THE GAME THAT MUST BE SPENT
 * PERMANENTLY. Brief #22's ability limiters (`abilityUses`, `abilityReadyAt`)
 * live on `Combatant` and die with the encounter — that is why M2 needed no
 * save migration. A potion cannot work that way: drink it in room 3 and it
 * must still be gone in room 7, and gone next week.
 *
 * The split that makes this work:
 *
 *   HeroKit.quickSlots   the AUTHORITY. Persisted, saved, restocked.
 *   Combatant.quickSlots a per-dispatch MIRROR the sim mutates.
 *
 * `assembleParty` builds Combatants once per dispatch and they survive every
 * room, so consumption naturally persists across a whole dungeon. Afterwards
 * the campaign layer calls `reconcileQuickSlots` to write the spend back to
 * the kits. ⚠ **Forgetting that call gives infinite potions**, which is why it
 * has its own test rather than living only inside `runQuest`.
 *
 * This is the same HeroState-vs-Combatant boundary #22's once-per-long-rest
 * tier is waiting on; doing it here builds that road.
 */

import { itemBasesById } from './equipment';
import { RESOLVABLE_EFFECTS } from './knownSpells';
import { spellsById } from '@sim/registry';
import type { ItemInstance } from '@sim/core/events/types';

/** D3's locked count. Four, not "some" — the pouch is a planning constraint. */
export const QUICK_SLOT_COUNT = 4;

export type QuickSlots = (ItemInstance | null)[];

export function emptyQuickSlots(): QuickSlots {
  return Array.from({ length: QUICK_SLOT_COUNT }, () => null);
}

/**
 * Normalise any stored shape to exactly QUICK_SLOT_COUNT entries.
 *
 * ⚠ Saves predate quick-slots, so this must accept `undefined` and short or
 * over-long arrays without throwing — a malformed save is a migration problem,
 * never a crash. Extra entries are DROPPED rather than kept, because the slot
 * count is a design constraint and silently honouring five would break D3.
 */
export function normalizeQuickSlots(raw: unknown): QuickSlots {
  const out = emptyQuickSlots();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < QUICK_SLOT_COUNT; i++) {
    const entry = raw[i];
    out[i] = entry && typeof entry === 'object' ? (entry as ItemInstance) : null;
  }
  return out;
}

/**
 * D3's rule: quick-slots take `consumable` and `scroll` ONLY.
 *
 * Gear goes in gear slots; the pouch is for things you spend. Enforcing it here
 * (rather than in the UI) means the sim can never be handed a quick-slotted
 * longsword by a future caller.
 */
export function isQuickSlottable(baseId: string): boolean {
  const type = itemBasesById.get(baseId)?.item_type as string | undefined;
  return type === 'consumable' || type === 'scroll';
}

/** The spell a consumable/scroll casts when used, or null if it has none. */
export function spellIdForItem(baseId: string): number | null {
  const spellId = itemBasesById.get(baseId)?.spell_id as number | null | undefined;
  return spellId ?? null;
}

/**
 * Can the ENGINE actually execute this item today?
 *
 * ⚠ Same readiness discipline as feats and spells (#22 §2, #23): the editor
 * must never offer something the AI would silently skip, because a loadout row
 * that never fires is indistinguishable from a bug at the table. `resolveCast`
 * handles `damage` and `healing`; a `buff` potion is authored, valid, and inert.
 */
export function isConsumableUsable(baseId: string): boolean {
  const spellId = spellIdForItem(baseId);
  if (spellId === null) return false;
  const spell = spellsById.get(spellId);
  if (!spell) return false;
  return RESOLVABLE_EFFECTS.has((spell.effect_type as string | null) ?? '');
}

/** A quick-slot as the sim sees it: enough to cast, and to identify afterwards. */
export interface CombatQuickSlot {
  baseId: string;
  spellId: number;
  /** Mirrors the kit index so reconciliation is positional, never by identity. */
  index: number;
}

/**
 * Build the per-encounter mirror from a kit's quick-slots.
 *
 * ⚠ UNUSABLE ITEMS ARE MIRRORED AS `null`, not omitted. The array stays
 * index-aligned with the kit so `reconcileQuickSlots` can compare positions —
 * omitting entries would shift indices and spend the wrong potion.
 */
export function toCombatQuickSlots(slots: QuickSlots): (CombatQuickSlot | null)[] {
  return slots.map((inst, index) => {
    if (!inst) return null;
    const spellId = spellIdForItem(inst.baseId);
    if (spellId === null || !isConsumableUsable(inst.baseId)) return null;
    return { baseId: inst.baseId, spellId, index };
  });
}

/**
 * Write a dispatch's consumption back to the kit — the step that makes a
 * potion actually GONE.
 *
 * Positional: a combat slot that is now `null` where the kit still holds an
 * item means that item was drunk. Returns what was spent, for the caller to
 * report or log.
 *
 * ⚠ Only clears slots the mirror was actually tracking. An item the engine
 * could not use was mirrored as `null` from the start (see above), so a
 * naive "null in combat means spend it" would destroy every inert potion on
 * the first fight. `tracked` distinguishes "never mirrored" from "used".
 */
export function reconcileQuickSlots(
  kitSlots: QuickSlots,
  combatSlots: readonly (CombatQuickSlot | null)[],
  tracked: readonly boolean[],
): ItemInstance[] {
  const spent: ItemInstance[] = [];
  for (let i = 0; i < QUICK_SLOT_COUNT; i++) {
    if (!tracked[i]) continue;
    if (combatSlots[i] === null && kitSlots[i]) {
      spent.push(kitSlots[i]!);
      kitSlots[i] = null;
    }
  }
  return spent;
}

/** Which kit slots the engine was tracking — the mask reconciliation needs. */
export function trackedMask(slots: QuickSlots): boolean[] {
  return toCombatQuickSlots(slots).map((s) => s !== null);
}
