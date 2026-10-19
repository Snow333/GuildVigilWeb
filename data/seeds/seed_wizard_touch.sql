-- M2: make the touch-casting Wizard real.
--
-- The Wizard holds 24 feats and ZERO of them were live actives; exactly one
-- (#97 Spell Penetration) reached any consumer at all. The rest are
-- `passive_modifier` rows carrying bespoke `effect` strings
-- ("ignore_energy_resistance", "redirect_saved_spell", "auto_sustain_one_spell")
-- that nothing in src/ reads, so a wizard levelled up and nothing changed.
--
-- This seed fixes the three rows that can be made live, by rewriting them onto
-- contracts that ALREADY have consumers. It does not touch the other 21 —
-- those need engine work per feat and are honest future work, not a seed.
--
--   #104 Protective Ward   combat_action/create_ward_ac_bonus -> grant_ally_ac
--        `create_ward_ac_bonus` is not in abilities.ts KNOWN_EFFECTS, so the
--        wizard's ONLY combat_action was inert. `grant_ally_ac` is the same
--        idea and is wired (the Cleric's Defensive Ward uses it).
--
--   #219 Touch Hit Specialization   passive_modifier/bonus_attack -> stat_mod
--        `casting.attackBonus` in assembly.ts already sums
--        `featStat['spell_attack']`, which is how #97 Spell Penetration works.
--        As a stat_mod this needs NO engine change at all.
--
--   #220 Touch Damage Specialization   passive_modifier/bonus_dice_d4
--        Keeps its type but gains the payload shape the new consumer in
--        spells.ts reads (`touch_damage_dice`). This is the one row that
--        needed engine wiring.

UPDATE feats SET
  effects = '{"effect_type": "combat_action", "actions": 1, "effect": "grant_ally_ac", "ac_bonus": 2}',
  description = 'You throw up a shield of force around an ally who needs it. That ally defends better for a moment.'
WHERE id = 104;

UPDATE feats SET
  effects = '{"effect_type": "stat_mod", "stat": "spell_attack", "value": 1, "scaling": "flat"}',
  description = 'You have practised landing a spell on something that is trying to stop you. +1 to hit with spells.'
WHERE id = 219;

UPDATE feats SET
  effects = '{"effect_type": "passive_modifier", "trigger": "touch_spell_damage", "effect": "bonus_damage", "touch_damage_dice": "1d4"}',
  description = 'Your hands carry more than the spell does. Touch-range spells you cast deal extra damage.'
WHERE id = 220;
