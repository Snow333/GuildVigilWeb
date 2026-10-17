import type { ItemInstance } from '@sim/core/events/types';
import type { HeroKit } from '@sim/campaign/assembly';
import { buildAutoLevelUpPlan } from '@sim/campaign/campaign';
import { starterParty } from '@sim/campaign/starterParty';
import { applyLevelUp } from '@sim/heroes/levelUp';
import { characterLevel } from '@sim/heroes/types';
import { progressionFor } from '@sim/registry';
import { bracketProvider } from '../harness/gearBrackets';

const PRIORITIES = ['perception', 'athletics', 'thievery'] as const;

/**
 * A fresh, competently geared four-hero party levelled to `level` through the
 * autopilot's own level-up plan (same path as tests/harness/gearBrackets).
 * Unlike `kitsAt` it is NOT cached, because a CampaignSession mutates its heroes.
 */
export function freshPartyAtLevel(level: number): HeroKit[] {
  const kits = starterParty();
  for (const kit of kits) {
    while (characterLevel(kit.hero) < level) {
      const plan = buildAutoLevelUpPlan(kit.hero, PRIORITIES);
      const primary = kit.hero.classLevels[0];
      if (!plan || !primary) break;
      const prog = progressionFor(plan.classId, primary.level + 1);
      if (!prog) break;
      applyLevelUp(kit.hero, { ...plan, hpPerLevel: prog.hp_per_level as number });
    }
    const primary = kit.hero.classLevels[0];
    const rung = primary ? bracketProvider(primary.classId, characterLevel(kit.hero)) : null;
    if (rung) {
      const inst = (baseId: number): ItemInstance => ({
        baseId: String(baseId), tier: 'mundane', propertyIds: [], seed: `q2_gear_${baseId}`,
      });
      kit.equipped = [...(rung.armor !== null ? [inst(rung.armor)] : []), inst(rung.weapon)];
    }
  }
  return kits;
}
