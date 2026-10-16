import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { autoLevelHero } from '@sim/campaign/campaign';
import { DEFAULT_MUSTER, musterParty } from '@sim/campaign/muster';

/** Playtest tooling (output/working-agreement.md §7): the dev panel's commands. */
function fresh(): CampaignSession {
  const s = CampaignSession.create({ campaignId: 'dev_t', seed: 'world_dev_t', party: musterParty(DEFAULT_MUSTER) });
  s.advanceWeek();
  return s;
}

describe('dev panel commands', () => {
  it('devAddGold adds gold and never drops below zero', () => {
    const s = fresh();
    const before = s.goldAmount();
    s.devAddGold(500);
    expect(s.goldAmount()).toBe(before + 500);
    s.devAddGold(-1_000_000);
    expect(s.goldAmount()).toBe(0);
  });

  it('devGrantLevel makes the hero eligible, and autoLevelHero actually levels them', () => {
    const s = fresh();
    const id = s.roster()[0]!.id;
    expect(s.heroSheet(id).canLevelUp).toBe(false);
    s.devGrantLevel(id);
    expect(s.heroSheet(id).canLevelUp).toBe(true);
    expect(s.heroSheet(id).level).toBe(1);
    expect(autoLevelHero(s, id)).toBe(1);
    expect(s.heroSheet(id).level).toBe(2);
    expect(s.heroSheet(id).canLevelUp).toBe(false);
  });

  it('autoLevelHero takes a hero from 1 to 10 through the real level-up path', () => {
    const s = fresh();
    for (const h of s.roster()) {
      for (let i = 0; i < 9; i++) {
        s.devGrantLevel(h.id);
        autoLevelHero(s, h.id);
      }
      const sheet = s.heroSheet(h.id);
      expect(sheet.level).toBe(10);
      // Leveling is real, not a number bump: hit points grew with it.
      expect(sheet.maxHp).toBeGreaterThan(fresh().heroSheet(h.id).maxHp);
    }
  });

  it('devRevealMap marks every board destination discovered, and turns off again', () => {
    const s = fresh();
    expect(s.board().some((b) => !b.discovered)).toBe(true);
    s.devRevealMap(true);
    expect(s.board().every((b) => b.discovered)).toBe(true);
    s.devRevealMap(false);
    expect(s.board().some((b) => !b.discovered)).toBe(true);
  });

  it('devHealAll clears wounds and revives the dead', () => {
    const s = fresh();
    const hero = s.heroState(s.roster()[0]!.id);
    hero.status = 'dead';
    hero.wounded = 2;
    s.devHealAll();
    expect(hero.status).toBe('active');
    expect(hero.wounded).toBe(0);
  });

  it('a session changed by dev commands still saves and loads', () => {
    const s = fresh();
    s.devAddGold(1234);
    s.devGrantLevel(s.roster()[0]!.id);
    autoLevelHero(s, s.roster()[0]!.id);
    const back = CampaignSession.deserialize(JSON.parse(JSON.stringify(s.serialize())));
    expect(back.goldAmount()).toBe(s.goldAmount());
    expect(back.heroSheet(s.roster()[0]!.id).level).toBe(2);
  });
});
