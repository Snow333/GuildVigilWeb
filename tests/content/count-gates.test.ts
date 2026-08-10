import { describe, expect, it } from 'vitest';
import { CONTENT_MANIFEST } from '@content/generated';

/**
 * The count gates, mirrored from tools/convert-content.mjs: the registries in
 * the repo must match the converted source exactly. Hand-tuned balance data is
 * the irreplaceable asset (decision-ledger Area 7); a silent row loss here is
 * the failure mode this test exists for.
 */
const GATES: Record<string, number> = {
  spells: 218,
  feats: 227,
  class_progression: 230,
  class_proficiency_tiers: 112,
  items: 183,
  item_properties: 33,
  enemies: 24,
  classes: 13,
  ancestries: 6,
  skills: 15,
  class_skills: 64,
  class_weapon_proficiency: 44,
  loot_tables: 97,
  shop_stock: 105,
  buildings: 18,
  quests: 12,
  warlock_spell_costs: 7,
  bloodlines: 8,
  bloodline_spells: 40,
  legendary_scholars: 28,
  nations: 9,
  nation_leaders: 35,
  eight_pillars: 8,
};

describe('content count gates', () => {
  it('every gated table matches expected row count', () => {
    const manifest = CONTENT_MANIFEST as Record<string, number>;
    for (const [table, expected] of Object.entries(GATES)) {
      expect(manifest[table], `table ${table}`).toBe(expected);
    }
  });
});
