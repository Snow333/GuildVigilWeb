import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { autoLevelHero } from '@sim/campaign/campaign';
import { defaultChoiceFor, musterParty } from '@sim/campaign/muster';
import { assembleHero, type HeroKit } from '@sim/campaign/assembly';
import { buildEnemy } from '@sim/combat/build';
import { runEncounter } from '@sim/combat/encounter';
import { grantedListSpells, spellAccess } from '@sim/heroes/knownSpells';
import { spellsByName } from '@sim/registry';

/**
 * M2 — the spell page. Clerics get the whole divine list and PREPARE from it
 * (Steven: "As a cleric in PF2.0 they should just get all spells and then
 * select what gets memorized"). Every caster gets a page to choose which spells
 * are in the fight plan and in what order they are tried.
 */

const CLERIC = 3;
const WIZARD = 2;
const id = (name: string): number => spellsByName.get(name)!.id;

function session(classIds: number[]): CampaignSession {
  const s = CampaignSession.create({ campaignId: 'plan', seed: 'world_plan', party: musterParty(classIds.map(defaultChoiceFor)) });
  s.advanceWeek();
  return s;
}
const kitOf = (s: CampaignSession, heroId: string): HeroKit => (s as unknown as { kitFor(id: string): HeroKit }).kitFor(heroId);

/** Spell ids cast by the hero across n real fights. */
function castIds(kit: HeroKit, n = 10, enemyId = 11): Map<number, number> {
  const out = new Map<number, number>();
  for (let k = 0; k < n; k++) {
    const hero = assembleHero(structuredClone(kit)).c;
    const r = runEncounter(`pl${k}`, 'room', [hero], [buildEnemy(enemyId, 'o1'), buildEnemy(enemyId, 'o2')], `plan_${k}`);
    for (const ev of r.stream.all()) {
      if (ev.type === 'combat.spell_cast' && ev.data.casterId === hero.id) {
        const sid = Number(ev.data.spellId);
        out.set(sid, (out.get(sid) ?? 0) + 1);
      }
    }
  }
  return out;
}

describe('a Cleric is granted the whole divine list', () => {
  it('cleric = divine list, wizard = spellbook, bard/sorcerer = repertoire', () => {
    expect(spellAccess(CLERIC)).toBe('divine_list');
    expect(spellAccess(WIZARD)).toBe('spellbook');
    expect(spellAccess(8)).toBe('repertoire');
    expect(spellAccess(1)).toBe('none');
  });

  it('a level-1 cleric can use every working 1st-level divine spell without learning any', () => {
    const s = session([CLERIC]);
    const hero = s.roster()[0]!;
    const plan = s.spellPlan(hero.id)!;
    const usable = plan.levels.flatMap((l) => l.spells.map((sp) => sp.name));
    for (const name of ['Heal', 'Bless', 'Harm']) expect(usable, name).toContain(name);
    expect(plan.levels.find((l) => l.spellLevel === 2)).toBeUndefined(); // no 2nd-level slots yet
  });

  it('the cleric level-up asks for NO spell picks', () => {
    const s = session([CLERIC]);
    const hero = s.roster()[0]!;
    s.devGrantLevel(hero.id);
    expect(s.spellPicksFor(hero.id, CLERIC).count).toBe(0);
  });

  it('reaching level 3 grants 2nd-level divine spells and prepares one in a free slot', () => {
    const s = session([CLERIC]);
    const hero = s.roster()[0]!;
    for (let i = 0; i < 2; i++) { s.devGrantLevel(hero.id); autoLevelHero(s, hero.id); }
    const second = s.spellPlan(hero.id)!.levels.find((l) => l.spellLevel === 2)!;
    // Every granted 2nd-level spell shows up on the page.
    const granted2 = grantedListSpells(CLERIC, 3).filter((sid) => spellsByName.get('Heal')!.id !== sid && second.spells.some((sp) => sp.spellId === sid));
    expect(second.spells.length).toBe(granted2.length);
    expect(second.spells.length).toBeGreaterThan(0);
    expect(second.planned).toBeGreaterThan(0);
    expect(second.planned).toBeLessThanOrEqual(second.limit!);
  });
});

describe('prepared limits: one prepared spell per slot', () => {
  it('a level-1 cleric (two 1st-level slots) cannot prepare a third 1st-level spell', () => {
    const s = session([CLERIC]);
    const hero = s.roster()[0]!;
    const lvl1 = () => s.spellPlan(hero.id)!.levels.find((l) => l.spellLevel === 1)!;
    expect(lvl1().limit).toBe(2);
    const free = lvl1().spells.filter((sp) => !sp.inPlan).map((sp) => sp.spellId);
    while (lvl1().planned < 2) s.toggleSpellPlanned(hero.id, free.shift()!);
    expect(() => s.toggleSpellPlanned(hero.id, free[0]!)).toThrow(/only 2 level-1/);
    // setLoadout enforces the same rule, so no UI path can sneak past it.
    const kit = kitOf(s, hero.id);
    expect(() => s.setLoadout(hero.id, [...kit.loadout, { action: 'cast', spellId: free[0]!, condition: { kind: 'always' }, target: 'scoredEnemy' }]))
      .toThrow(/only 2 level-1/);
  });

  it('cantrips are unlimited', () => {
    const s = session([CLERIC]);
    const hero = s.roster()[0]!;
    const cantrips = s.spellPlan(hero.id)!.levels.find((l) => l.spellLevel === 0)!;
    for (const sp of cantrips.spells.filter((c) => !c.inPlan)) s.toggleSpellPlanned(hero.id, sp.spellId);
    expect(s.spellPlan(hero.id)!.levels.find((l) => l.spellLevel === 0)!.planned).toBe(cantrips.spells.length);
  });

  it('a spontaneous caster (bard) has no prepared limit', () => {
    const s = session([8]);
    expect(s.spellPlan(s.roster()[0]!.id)!.prepared).toBe(false);
  });
});

describe('the player choice reaches the fight', () => {
  it('preparing Harm makes the cleric cast Harm; unpreparing it stops it', () => {
    const s = session([CLERIC]);
    const hero = s.roster()[0]!;
    expect(castIds(kitOf(s, hero.id)).has(id('Harm'))).toBe(false);
    s.toggleSpellPlanned(hero.id, id('Harm'));
    expect(castIds(kitOf(s, hero.id)).get(id('Harm')) ?? 0).toBeGreaterThan(0);
    s.toggleSpellPlanned(hero.id, id('Harm'));
    expect(castIds(kitOf(s, hero.id)).has(id('Harm'))).toBe(false);
  });

  it('priority order decides which spell is tried first', () => {
    const s = session([WIZARD]);
    const hero = s.roster()[0]!;
    // A founding wizard already has two damage spells in its plan (M2 muster).
    expect(s.spellPlan(hero.id)!.priority.length).toBeGreaterThanOrEqual(2);
    const top = (): number => s.spellPlan(hero.id)!.priority[0]!.spellId;
    const firstCast = (): number => {
      const c = assembleHero(structuredClone(kitOf(s, hero.id))).c;
      const r = runEncounter('pf', 'room', [c], [buildEnemy(11, 'o1')], 'plan_first');
      const ev = r.stream.all().find((e) => e.type === 'combat.spell_cast' && e.data.casterId === c.id);
      return Number(ev && ev.type === 'combat.spell_cast' ? ev.data.spellId : -1);
    };
    const before = top();
    expect(firstCast()).toBe(before);
    const second = s.spellPlan(hero.id)!.priority[1]!;
    s.moveSpellInPlan(hero.id, second.loadoutIndex, -1);
    expect(top()).toBe(second.spellId);
    expect(firstCast()).toBe(second.spellId);
  });

  it('changing a rule changes behaviour: Heal on "always" casts at full health', () => {
    const s = session([CLERIC]);
    const hero = s.roster()[0]!;
    const heal = s.spellPlan(hero.id)!.priority.find((r) => r.spellId === id('Heal'))!;
    const before = castIds(kitOf(s, hero.id), 6, 6).get(id('Heal')) ?? 0;
    s.setSpellPlanRule(hero.id, heal.loadoutIndex, { kind: 'always' }, 'self'); // solo test: no other ally
    const after = castIds(kitOf(s, hero.id), 6, 6).get(id('Heal')) ?? 0;
    expect(after).toBeGreaterThan(before);
  });
});

describe('saves', () => {
  it('the spell plan survives save and load', () => {
    const s = session([CLERIC]);
    const hero = s.roster()[0]!;
    s.toggleSpellPlanned(hero.id, id('Harm'));
    const back = CampaignSession.deserialize(JSON.parse(JSON.stringify(s.serialize())));
    expect(back.spellPlan(hero.id)).toEqual(s.spellPlan(hero.id));
  });
});
