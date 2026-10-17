/**
 * ITEM CARDS TELL THE TRUTH (M2 itemization pass).
 *
 * ⚠ WHAT STEVEN SAW: "Magical Cloak of Resistance +1 — +1 to every strike".
 * The tier grant landed in `attackBonus` on every item type, the card printed
 * it, and `assembleHero` never read it off anything but the weapon. The card
 * lied and nothing failed.
 *
 * So this file reads the card the way a PLAYER does — parses the words — and
 * checks every number against a hero assembled WITH and WITHOUT the item
 * through the production path (`assembleHero`). Every wearable row in the
 * registry is swept, which covers every paperdoll slot.
 */

import { describe, it, expect } from 'vitest';
import { assembleHero, type HeroKit } from '@sim/campaign/assembly';
import { musterParty } from '@sim/campaign/muster';
import { PAPERDOLL_SLOTS } from '@sim/campaign/session';
import { runEncounter } from '@sim/combat/encounter';
import { buildEnemy } from '@sim/combat/build';
import { ancestryIds } from '@sim/registry';
import { itemContributions, itemSummary, type ItemContribution } from '@sim/heroes/attribution';
import { deriveItem, tierApplies } from '@sim/heroes/equipment';
import { abilityMod, type AbilityKey } from '@sim/heroes/types';
import { items } from '@content/generated/items';
import type { ItemInstance } from '@sim/core/events/types';
import type { Combatant } from '@sim/combat/types';

const FIGHTER = 1, WIZARD = 2, CLERIC = 3, SORCERER = 9;

const inst = (baseId: string | number, tier: ItemInstance['tier'] = 'mundane', propertyIds: string[] = []): ItemInstance =>
  ({ baseId: String(baseId), tier, propertyIds, seed: 'cards' });

const byName = (name: string): string => {
  const row = items.find((i) => String(i.name) === name);
  if (!row) throw new Error(`no item named ${name}`);
  return String(row.id);
};

/** A hero with plain, known, EVEN scores so every modifier is predictable. */
const SCORES: Record<AbilityKey, number> = { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 };

function kitFor(classId: number, scores: Partial<Record<AbilityKey, number>> = {}): HeroKit {
  const kit = musterParty([{ classId, name: 'Card', ancestry: ancestryIds[0]!, gender: 'm' as const }])[0]!;
  kit.hero.abilities = { ...SCORES, ...scores };
  kit.equipped = [];
  return kit;
}

function assemble(kit: HeroKit, equipped: ItemInstance[]): Combatant {
  return assembleHero({ ...kit, equipped }).c;
}

const num = (s: string): number => Number(/([+-]\d+)/.exec(s)![1]);

/** What the card CLAIMS, parsed out of the player-facing words. */
function claims(cs: readonly ItemContribution[]) {
  const out = {
    toHit: 0, ac: 0, fort: 0, ref: 0, will: 0, speed: 0, hp: 0, stealth: 0, penalty: 0,
    abilities: {} as Partial<Record<AbilityKey, number>>,
    dice: null as string | null,
  };
  const WORD: Record<string, AbilityKey> = {
    Strength: 'str', Dexterity: 'dex', Constitution: 'con', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha',
  };
  for (const c of cs) {
    if (!c.live) continue;
    if (c.kind === 'attack') out.toHit += num(c.detail);
    if (c.kind === 'damage') out.dice = c.detail.split(' ')[0]!;
    if (c.kind === 'ac') out.ac += num(c.detail.replace(/\(.*\)/, ''));
    if (c.kind === 'save') {
      const v = num(c.detail);
      if (/all saves/.test(c.detail)) { out.fort += v; out.ref += v; out.will += v; }
      if (/Fortitude/.test(c.detail)) out.fort += v;
      if (/Reflex/.test(c.detail)) out.ref += v;
      if (/Will/.test(c.detail)) out.will += v;
    }
    if (c.kind === 'ability') {
      const word = Object.keys(WORD).find((w) => c.detail.includes(w));
      expect(word, `ability line "${c.detail}" names no ability`).toBeDefined();
      out.abilities[WORD[word!]!] = (out.abilities[WORD[word!]!] ?? 0) + num(c.detail);
    }
    if (c.kind === 'speed') out.speed += num(c.detail);
    if (c.kind === 'hp') out.hp += num(c.detail);
    if (c.kind === 'skill' && /Stealth/.test(c.detail)) out.stealth += num(c.detail);
    if (c.kind === 'penalty' && /to hit/.test(c.detail)) out.penalty += Number(/(-\d+) to hit/.exec(c.detail)![1]);
  }
  return out;
}

const modDelta = (k: AbilityKey, add: number | undefined, scores = SCORES) =>
  abilityMod(scores[k] + (add ?? 0)) - abilityMod(scores[k]);

const WEARABLE = items.filter((i) => i.slot !== null);

describe('⚠ EXPOSURE — every number on every card reaches the combatant', () => {
  for (const row of WEARABLE) {
    it(`${row.id} ${row.name} (${row.slot})`, () => {
      const kit = kitFor(FIGHTER);
      const item = inst(row.id, row.quality_tier as ItemInstance['tier']);
      const card = itemContributions(kit.hero, item);
      const claim = claims(card);

      // Baseline: the same hero WITHOUT the item. Weapons compare against bare
      // hands (str-keyed, like a non-finesse weapon at these scores).
      const without = assemble(kit, []);
      const withIt = assemble(kit, [item]);

      const str = modDelta('str', claim.abilities.str);
      const dex = modDelta('dex', claim.abilities.dex);
      const con = modDelta('con', claim.abilities.con);
      const wis = modDelta('wis', claim.abilities.wis);

      expect(withIt.attackBonus - without.attackBonus, 'to hit').toBe(claim.toHit + str);
      expect(withIt.weaponPenalty - without.weaponPenalty, 'training penalty').toBe(claim.penalty);
      expect(withIt.ac - without.ac, 'AC').toBe(claim.ac + dex);
      expect(withIt.saves.fort - without.saves.fort, 'Fortitude').toBe(claim.fort + con);
      expect(withIt.saves.ref - without.saves.ref, 'Reflex').toBe(claim.ref + dex);
      expect(withIt.saves.will - without.saves.will, 'Will').toBe(claim.will + wis);
      expect(withIt.speed - without.speed, 'speed').toBe(claim.speed);
      expect(withIt.maxHp - without.maxHp, 'hit points').toBe(claim.hp);
      expect(withIt.stealth - without.stealth, 'Stealth').toBe(claim.stealth + dex);
      if (row.item_type === 'weapon') {
        expect(claim.dice, 'a weapon card must state its dice').not.toBeNull();
        expect(withIt.damageDice, 'damage dice').toBe(`${claim.dice}+${abilityMod(SCORES.str)}`);
      }
    });
  }

  it('the sweep covers one item of every paperdoll slot', () => {
    const covered = new Set(WEARABLE.map((r) => String(r.slot)));
    for (const slot of PAPERDOLL_SLOTS) expect(covered.has(slot), `no item for slot ${slot}`).toBe(true);
  });

  /**
   * ⚠ Int/Wis/Cha reach a fighter's sheet only through saves (Wis) or not at
   * all. So the mental-stat claims are proven on a CASTER whose spell attack
   * keys off that stat — the place a player expects the headband to matter.
   */
  for (const [name, classId, stat] of [
    ['Headband of Intellect +2', WIZARD, 'int'],
    ['Circlet of Wisdom +2', CLERIC, 'wis'],
    ['Mantle of Presence +4', SORCERER, 'cha'],
  ] as const) {
    it(`${name} raises a caster's spell attack by what the card says`, () => {
      const scores = { ...SCORES, [stat]: 16 };
      const kit = kitFor(classId, scores);
      const card = itemContributions(kit.hero, inst(byName(name), 'magical'));
      const claimed = claims(card).abilities[stat];
      expect(claimed, 'the card names the stat').toBeGreaterThan(0);
      const before = assemble(kit, []).casting!.attackBonus;
      const after = assemble(kit, [inst(byName(name), 'magical')]).casting!.attackBonus;
      expect(after - before).toBe(modDelta(stat, claimed, scores));
      expect(after - before, 'the stat must move the spell').toBeGreaterThan(0);
    });
  }
});

describe('⚠ the three cards Steven read', () => {
  /**
   * The loot roller stamps an authored magic item with its own quality as the
   * instance tier, so a chest cloak arrives as tier `magical`. That tier is
   * what used to mint the phantom "+1 to every strike".
   */
  it('a loot Cloak of Resistance +1 says "+1 to all saves" and NOTHING about strikes', () => {
    const kit = kitFor(FIGHTER);
    const cloak = inst(byName('Cloak of Resistance +1'), 'magical');
    const d = deriveItem(cloak);
    expect(d.displayName).toBe('Cloak of Resistance +1');
    expect(d.attackBonus, 'a cloak has no strike bonus').toBe(0);

    const card = itemContributions(kit.hero, cloak);
    expect(card.map((c) => c.detail)).toEqual(['+1 to all saves']);
    expect(card.some((c) => c.kind === 'attack'), 'the phantom strike bonus is back').toBe(false);

    const sword = inst(byName('Longsword'));
    const plain = assemble(kit, [sword]);
    const cloaked = assemble(kit, [sword, cloak]);
    expect(cloaked.attackBonus, 'the cloak changed the attack roll').toBe(plain.attackBonus);
    expect(cloaked.saves.fort - plain.saves.fort).toBe(1);
  });

  it('a rolled enchanted keen unholy shortsword: one "+2", the riders in words, greyed when not built', () => {
    const kit = kitFor(FIGHTER);
    const blade = inst(byName('Shortsword'), 'enchanted', ['keen', 'unholy']);
    expect(deriveItem(blade).displayName).toBe('Keen Unholy Shortsword +2');

    const card = itemContributions(kit.hero, blade);
    expect(itemSummary(card)).toBe('+2 to hit · 1d6 piercing');
    const keen = card.find((c) => c.label === 'Keen')!;
    expect(keen).toMatchObject({ detail: 'crits on 19–20', live: false });
    const unholy = card.filter((c) => c.label === 'Unholy');
    expect(unholy.every((c) => !c.live), 'creature alignment is not modelled — unholy cannot fire').toBe(true);
    expect(unholy[0]!.detail).toMatch(/vs good foes/);
  });

  it('Leather Armor says what the +2 is: "AC +2 (Dex max +4)"', () => {
    const kit = kitFor(FIGHTER);
    const card = itemContributions(kit.hero, inst(byName('Leather Armor')));
    expect(itemSummary(card)).toBe('AC +2 (Dex max +4)');
  });
});

describe('armour: AC, Dex cap and training, proven on the combatant', () => {
  it('⚠ the Dex cap on the card is the cap the engine applies', () => {
    const kit = kitFor(FIGHTER, { dex: 18 }); // +4 Dex
    const mail = inst(byName('Chain Mail +2'));
    const card = itemContributions(kit.hero, mail);
    const ac = card.find((c) => c.kind === 'ac')!;
    expect(ac.detail).toBe('AC +7 (Dex max +2)');
    expect(assemble(kit, [mail]).ac, '10 + 7 + Dex capped at 2').toBe(10 + 7 + 2);
  });

  it('untrained armour: the card says it loses its +N and costs to-hit, and the engine agrees', () => {
    const kit = kitFor(WIZARD);
    const mail = inst(byName('Chain Mail +2'));
    const card = itemContributions(kit.hero, mail);
    expect(card.find((c) => c.kind === 'ac')!.detail).toBe('AC +5 (Dex max +2)');
    expect(card.find((c) => c.kind === 'penalty')!.detail).toBe('loses its +2, -2 to hit');
    const c = assemble(kit, [mail]);
    expect(c.ac - assemble(kit, []).ac).toBe(5);
    expect(c.weaponPenalty).toBe(-2);
  });

  it('a rolled magical shield gets its +1 on AC, not on strikes', () => {
    const kit = kitFor(FIGHTER);
    const shield = inst(byName('Steel Shield'), 'magical');
    const d = deriveItem(shield);
    expect({ name: d.displayName, ac: d.acBonus, hit: d.attackBonus }).toEqual({ name: 'Steel Shield +1', ac: 3, hit: 0 });
    expect(assemble(kit, [shield]).ac - assemble(kit, []).ac).toBe(3);
  });

  /** Authored Masterwork armour is lighter (−1 check penalty), never +1 AC. A rolled one now matches. */
  it('a rolled masterwork armour is the same item as the authored one', () => {
    const rolled = deriveItem(inst(byName('Chain Mail'), 'masterwork'));
    const authored = deriveItem(inst(byName('Masterwork Chain Mail')));
    expect({ ac: rolled.acBonus, acp: rolled.armorCheckPenalty }).toEqual({ ac: authored.acBonus, acp: authored.armorCheckPenalty });
    expect(rolled.displayName).toBe('Masterwork Chain Mail');
  });
});

describe('accessories: a tier roll does not change them', () => {
  it('an authored wondrous item derives the same at any instance tier (numbers, name, price)', () => {
    for (const name of ['Cloak of Resistance +1', 'Ring of Protection +1', 'Belt of Strength +2', 'Boots of Speed']) {
      const id = byName(name);
      const shop = deriveItem(inst(id, 'mundane'));
      for (const tier of ['masterwork', 'magical', 'enchanted'] as const) {
        const loot = deriveItem(inst(id, tier));
        expect({ name, tier, d: loot }).toEqual({ name, tier, d: shop });
      }
    }
  });

  it('the Amulet of Natural Armor +1 finally gives the +1 AC its name promises', () => {
    const kit = kitFor(FIGHTER);
    const amulet = inst(byName('Amulet of Natural Armor +1'), 'magical');
    expect(itemContributions(kit.hero, amulet).map((c) => c.detail)).toEqual(['AC +1']);
    expect(assemble(kit, [amulet]).ac - assemble(kit, []).ac).toBe(1);
  });
});

describe('authored properties are part of the item', () => {
  /**
   * Dreadblade's `["keen","dread"]` sat in its row and nothing read it. Dread
   * frightens on a hit — a modelled condition — so it must reach a fight.
   */
  it('⚠ Dreadblade frightens what it hits, in a real fight', () => {
    const kit = kitFor(FIGHTER);
    const c = assemble(kit, [inst(byName('Dreadblade'), 'enchanted')]);
    const enemy = buildEnemy(1, 'e1');
    enemy.hp = 400;
    enemy.maxHp = 400;
    const r = runEncounter('c_dread', 'r_dread', [c], [enemy], 'dread');
    const frightened = r.stream.all().filter(
      (e) => e.type === 'combat.condition_applied' && (e.data as { conditionId: string }).conditionId === 'frightened',
    );
    expect(frightened.length, 'dread never frightened anyone').toBeGreaterThan(0);

    // …and the card says so, while keen stays greyed.
    const card = itemContributions(kit.hero, inst(byName('Dreadblade'), 'enchanted'));
    expect(card.find((x) => x.label === 'Dread' && x.live)?.detail).toMatch(/frightened on a hit/);
    expect(card.find((x) => x.label === 'Keen')?.live).toBe(false);
  });

  it('a row that folded its rider into the dice does not deal it twice', () => {
    const d = deriveItem(inst(byName('Flaming Sword'), 'enchanted'));
    expect(d.damageDice).toBe('1d8+1d6');
    expect(d.onHitEffects, 'the 1d6 fire is already in the dice').toHaveLength(0);
    const card = itemContributions(null, inst(byName('Flaming Sword'), 'enchanted'));
    expect(card.find((c) => c.label === 'Flaming')?.detail).toMatch(/in the damage above/);
  });
});

describe('nothing on a card is a false claim', () => {
  it('legendary powers and pouch items with no engine path are greyed, not claimed', () => {
    const pelt = itemContributions(null, inst(byName("Ironmane's Pelt"), 'legendary'));
    expect(pelt.find((c) => c.kind === 'power')?.live).toBe(false);

    const smoke = itemContributions(null, inst(byName('Smokestick')));
    expect(smoke).toEqual([expect.objectContaining({ kind: 'use', live: false })]);
    expect(itemSummary(smoke)).toBe('not working yet');

    const potion = itemContributions(null, inst(byName('Healing Potion (Minor)')));
    expect(potion).toEqual([{ label: 'Use', kind: 'use', detail: 'Heals 1d8+4 once', live: true }]);
  });

  it('the shop card (no hero) carries no training line', () => {
    const card = itemContributions(null, inst(byName('Full Plate')));
    expect(card.some((c) => c.kind === 'penalty')).toBe(false);
  });
});

describe('price sanity', () => {
  it('a rolled tier always costs more than the tier below it, and never less than mundane', () => {
    for (const row of items) {
      if (!tierApplies(row)) continue;
      const prices = (['mundane', 'masterwork', 'magical', 'enchanted'] as const)
        .map((t) => deriveItem(inst(row.id, t)).price);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i], `${row.name} tier ${i}`).toBeGreaterThan(prices[i - 1]!);
      }
    }
  });

  it('every authored magic weapon costs more than its plain base', () => {
    for (const row of items) {
      if (row.item_type !== 'weapon' || row.quality_tier === 'mundane') continue;
      const plain = items.find((i) => i.item_subtype === row.item_subtype && i.quality_tier === 'mundane');
      if (!plain) continue;
      expect(deriveItem(inst(row.id)).price, row.name).toBeGreaterThan(plain.price);
    }
  });
});
