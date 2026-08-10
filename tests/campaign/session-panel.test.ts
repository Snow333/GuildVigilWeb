import { describe, expect, it } from 'vitest';
import { CampaignSession, SHOP } from '@sim/campaign/session';
import { starterParty } from '../fixtures/party-fixture';

/**
 * 2.1/2.2 session-surface locks:
 *  - hero sheet derives (UI never computes a modifier) and tracks regear live
 *  - the 2.1 done criterion: hand-played level-up + regear round-trips through
 *    serialize and matches sim-computed sheets
 *  - shop v1: seeded weekly rotation, derived pricing, finite stock
 *  - forecast honesty (R5): forked seeds, no campaign-RNG consumption
 */

const newSession = (id = 'panel_0'): CampaignSession =>
  CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });

describe('heroSheet — assembly on a plate', () => {
  it('derives the level-1 fighter exactly as assembly does', () => {
    const s = newSession();
    const sheet = s.heroSheet('hero_1');
    expect(sheet.name).toBe('Torvald');
    expect(sheet.level).toBe(1);
    expect(sheet.maxHp).toBe(20); // ancestry 8 + max(1, 10 + con 2)
    expect(sheet.abilities.str).toEqual({ score: 16, mod: 3 });
    expect(sheet.classes).toEqual([{ classId: 1, name: 'Fighter', level: 1 }]);
    expect(sheet.equipped.map((e) => e.slot).sort()).toEqual(['armor', 'main_hand']);
    expect(sheet.damageDice).toMatch(/\+3$/); // STR to damage
    expect(sheet.canLevelUp).toBe(false);
    expect(sheet.skills.find((sk) => sk.name === 'athletics')?.ranks).toBe(1); // cap-legal L1 wedge
  });

  it('regear moves stats: unequip armor → AC drops, sheet re-derives', () => {
    const s = newSession();
    const before = s.heroSheet('hero_1').ac;
    s.unequip('hero_1', 'armor');
    const after = s.heroSheet('hero_1').ac;
    expect(after).toBeLessThan(before);
    expect(s.stashView()).toHaveLength(1);
    const chainIdx = s.stashView()[0]!.index;
    s.equip('hero_1', chainIdx); // back on
    expect(s.heroSheet('hero_1').ac).toBe(before);
    expect(s.stashView()).toHaveLength(0);
  });

  it('equip swaps an occupied slot back to stash and rejects non-equippables', () => {
    const s = newSession();
    s.unequip('hero_1', 'main_hand'); // longsword → stash
    s.unequip('hero_3', 'main_hand'); // mace → stash
    const mace = s.stashView().find((v) => v.derived.displayName.includes('Mace'))!;
    s.equip('hero_1', mace.index); // hero_1 empty main_hand takes the mace
    expect(s.heroSheet('hero_1').equipped.some((e) => e.derived.displayName.includes('Mace'))).toBe(true);
    const sword = s.stashView().find((v) => v.derived.displayName.includes('Longsword'))!;
    s.equip('hero_1', sword.index); // swap: mace displaced back to stash
    expect(s.stashView().some((v) => v.derived.displayName.includes('Mace'))).toBe(true);
    expect(() => s.equip('hero_1', 99)).toThrow(/no stash item/);
  });
});

describe('the 2.1 done criterion — hand-played level-up + regear round-trip', () => {
  it('level-up through the wizard surface, regear, serialize → restore → identical sheet', () => {
    const s = newSession();
    s.heroState('hero_1').xp = 1000; // a quest's worth, hand-granted for the test

    const options = s.levelUpOptions('hero_1');
    expect(options.eligible).toBe(true);
    expect(options.newCharacterLevel).toBe(2);
    expect(options.boostRequired).toBe(false); // boosts at 5/10/15/20
    const fighter = options.classes.find((c) => c.classId === 1)!;
    expect(fighter.met).toBe(true);
    expect(fighter.newClassLevel).toBe(2);

    const points = s.skillPointsFor('hero_1', 1);
    expect(points).toBeGreaterThanOrEqual(1);
    // Allocate cap-aware, as the wizard forces: 1 rank per skill with headroom.
    const skillRanks: Record<string, number> = {};
    let toSpend = points;
    for (const name of options.skillNames) {
      if (toSpend === 0) break;
      const headroom = options.maxRanks - (options.currentRanks[name] ?? 0);
      if (headroom > 0) {
        skillRanks[name] = Math.min(headroom, 1);
        toSpend -= skillRanks[name]!;
      }
    }
    expect(toSpend).toBe(0); // 16 skills × cap 2 has room for any L2 point pool
    const applied = s.applyLevelUp('hero_1', { classId: 1, skillRanks, feats: [], autoGrantedFeatIds: [] });
    expect(applied.newCharacterLevel).toBe(2);

    s.unequip('hero_1', 'armor');
    const sheetBefore = s.heroSheet('hero_1');
    expect(sheetBefore.level).toBe(2);
    expect(sheetBefore.skills.find((sk) => sk.name === 'athletics')?.ranks).toBe(1 + (skillRanks['athletics'] ?? 0));

    const restored = CampaignSession.deserialize(s.serialize());
    expect(restored.heroSheet('hero_1')).toEqual(sheetBefore);
    expect(restored.serialize()).toEqual(s.serialize());
  });

  it('ineligible classes come back met:false with a sim-authored reason', () => {
    const s = newSession();
    s.heroState('hero_1').xp = 1000;
    const options = s.levelUpOptions('hero_1');
    const sorcerer = options.classes.find((c) => c.keyAbility === 'cha' && c.newClassLevel === 1);
    if (sorcerer) {
      expect(sorcerer.met).toBe(false); // Torvald's CHA 8 < 13
      expect(sorcerer.reason).toMatch(/CHA/i);
    }
  });
});

describe('shop v1 — seeded rotation, derived prices, finite stock', () => {
  it('rotation is deterministic per week and changes across weeks', () => {
    const a = newSession('shop_a');
    const b = newSession('shop_a');
    a.advanceWeek();
    b.advanceWeek();
    expect(a.shopStock()).toEqual(b.shopStock()); // same week → same rotation
    const week1 = a.shopStock().map((o) => o.offerIndex).join(',');
    a.advanceWeek();
    const week2 = a.shopStock().map((o) => o.offerIndex).join(',');
    expect(week2).not.toBe(week1); // the world restocks
  });

  it('buy/sell round-trip: gold moves by derived prices, stash updates', () => {
    const s = newSession('shop_b');
    s.advanceWeek();
    const offer = s.shopStock()[0]!;
    expect(() => s.buyItem(offer.offerIndex)).toThrow(/need/); // broke guild
    s.heroState('hero_1'); // (no-op) — grant gold the blunt way:
    (s as unknown as { gold: number }).gold = offer.price + 10;
    s.buyItem(offer.offerIndex);
    expect(s.goldAmount()).toBe(10);
    expect(s.stashView()).toHaveLength(1);
    const sold = s.stashView()[0]!;
    expect(sold.sellPrice).toBe(Math.floor(sold.derived.price * SHOP.sellFraction));
    s.sellItem(0);
    expect(s.goldAmount()).toBe(10 + sold.sellPrice);
    expect(s.stashView()).toHaveLength(0);
  });

  it('finite stock depletes within the week and unknown offers throw', () => {
    const s = newSession('shop_c');
    s.advanceWeek();
    (s as unknown as { gold: number }).gold = 1_000_000;
    const finite = s.shopStock().find((o) => o.remaining !== null);
    if (finite) {
      for (let i = 0; i < finite.remaining!; i++) s.buyItem(finite.offerIndex);
      expect(() => s.buyItem(finite.offerIndex)).toThrow(/sold out/);
    }
    expect(() => s.buyItem(999999)).toThrow(/no offer/);
  });
});

describe('abandon (finding #1: free return) and expiry cooldown (finding #2)', () => {
  it('abandon returns the quest to the board with its ORIGINAL posting week — no parking', () => {
    const s = newSession('abandon_0');
    s.advanceWeek(); // week 1: postings arrive
    const target = s.board()[0]!;
    s.acceptQuest(target.questId);
    expect(s.board().some((b) => b.questId === target.questId)).toBe(false);
    s.abandonQuest();
    expect(s.activeQuest()).toBeNull();
    const back = s.board().find((b) => b.questId === target.questId);
    expect(back).toBeDefined();
    expect(back!.postedWeek).toBe(target.postedWeek); // the expiry clock never stopped
    expect(() => s.abandonQuest()).toThrow(/no active quest/);
    // Parking is impossible: the abandoned posting still expires on schedule.
    s.advanceWeek();
    s.advanceWeek(); // week 3: week - postedWeek(1) >= 2
    expect(s.board().some((b) => b.questId === target.questId)).toBe(false);
    expect(s.world.byType('world.quest_expired').some((e) => e.data.questId === String(target.questId))).toBe(true);
  });

  it('expired quests sit out the cooldown; the pool rotates fresh trouble in behind them', () => {
    const s = newSession('cooldown_0');
    s.advanceWeek(); // wk 1: board fills
    const week1Ids = s.board().map((b) => b.questId);
    expect(week1Ids.length).toBeGreaterThan(0);
    s.advanceWeek(); // wk 2: still posted (expiry needs 2 full weeks)
    s.advanceWeek(); // wk 3: week-1 postings expire — and STAY DOWN for the cooldown
    for (const id of week1Ids) {
      expect(s.board().some((b) => b.questId === id), `quest ${id} must cool down`).toBe(false);
    }
    s.advanceWeek(); // wk 4: cooldown holds for the wk-3 expiries
    const expiredAtW3 = week1Ids;
    for (const id of expiredAtW3) {
      expect(s.board().some((b) => b.questId === id)).toBe(false);
    }
    s.advanceWeek(); // wk 5: cooldown over — the originals may return
    expect(s.board().some((b) => expiredAtW3.includes(b.questId))).toBe(true);
  });

  it('cooldown state survives serialize/deserialize (reload cannot forgive an expiry)', () => {
    const s = newSession('cooldown_1');
    for (let w = 0; w < 3; w++) s.advanceWeek(); // wk 3: week-1 postings just expired
    const expiredIds = s.world.byType('world.quest_expired').map((e) => Number(e.data.questId));
    expect(expiredIds.length).toBeGreaterThan(0);
    const restored = CampaignSession.deserialize(s.serialize());
    restored.advanceWeek(); // wk 4: cooldown must still hold after reload
    for (const id of expiredIds) {
      expect(restored.board().some((b) => b.questId === id)).toBe(false);
    }
    expect(restored.serialize()).toEqual((() => { s.advanceWeek(); return s.serialize(); })());
  });
});

describe('forecast — honesty by construction (risk R5)', () => {
  it('same inputs → same distribution; campaign state completely untouched', () => {
    const s = newSession('fc_0');
    s.advanceWeek();
    const quest = s.board()[0]!;
    const before = s.serialize();
    const f1 = s.forecast(quest.questId, { profile: 'fullExplore', caution: 'standard' }, 10);
    const f2 = s.forecast(quest.questId, { profile: 'fullExplore', caution: 'standard' }, 10);
    expect(f1).toEqual(f2); // forked seeds are deterministic
    expect(f1.completed + f1.retreated + f1.wiped).toBe(10);
    expect(f1.travelEtaMinutes).not.toBeNull();
    expect(s.serialize()).toEqual(before); // no RNG drain, no hero mutation, no gold drift
  });

  it('forecasting then launching leaves the launch stream identical (no seed sharing)', () => {
    const a = newSession('fc_1');
    const b = newSession('fc_1');
    a.advanceWeek();
    b.advanceWeek();
    const quest = a.board()[0]!;
    a.forecast(quest.questId, { profile: 'fullExplore', caution: 'standard' }, 5);
    a.acceptQuest(quest.questId);
    b.acceptQuest(quest.questId);
    const ra = a.launchDispatch();
    const rb = b.launchDispatch();
    expect(ra.outcome).toBe(rb.outcome);
    expect(ra.dispatch?.stream.hash()).toBe(rb.dispatch?.stream.hash());
    expect(a.world.hash()).toBe(b.world.hash());
  });
});
