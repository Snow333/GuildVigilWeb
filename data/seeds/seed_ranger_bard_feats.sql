-- M2: class feats for Ranger (5) and Bard (8).
--
-- Both classes shipped with ZERO feat rows: `feats` held nothing for class_id
-- 5 or 8, and none of their class_progression feature keys (favored_enemy_1,
-- track, inspire_courage, dirge_of_doom, …) matched a feat, so levelling
-- either class granted literally nothing and both had five empty class-feat
-- slots by level 10.
--
-- ⚠ EVERY ROW HERE REACHES A CONSUMER THAT ALREADY EXISTS. The repo's oldest
-- defect is content authored against a contract nothing reads, so each row is
-- written to a verb `abilities.ts` executes, or to `resolveSkillMods` /
-- `sneakDice`. Ids start at 300 (max existing id is 227).
--
--   combat_action + strike_*        -> abilities.ts applyStrikeRider
--   combat_action + grant_party_*   -> abilities.ts applySelfAbility (new in M2)
--   skill_mod                       -> featEffects.ts resolveSkillMods
--   passive_modifier (ff shape)     -> assembly.ts sneakDice
--
-- The new ids must also be added to ACTIVE_WIRED in heroes/featEffects.ts, or
-- `abilityDef` refuses them and the level-up picker greys them out.

DELETE FROM feats WHERE id BETWEEN 300 AND 399;

-- ── RANGER (class 5): hit it from over there, and keep it over there ────────

-- Auto-granted class features.
INSERT INTO feats (id, name, feat_type, class_id, level_req, prerequisites, effects, description, feature_key) VALUES
-- ⚠ PRIMARY IS PERCEPTION ON PURPOSE. `survival` is read by NOTHING in src/
-- today (only perception, athletics, thievery and stealth reach a consumer),
-- so a Survival-only feat would be inert content. Perception makes it live
-- now; the Survival term starts paying the moment a mission checks it.
(300, 'Tracker', 'class', 5, 1, '{}',
 '{"effect_type": "skill_mod", "skill": "perception", "value": 1, "scaling": "flat", "additional_skill_mod": {"skill": "survival", "value": 2}}',
 'You read ground, weather and spoor. +1 Perception and +2 Survival.',
 'track'),

-- ⚠ `damage_scaling.die` IS THE KEY `sneakDice` ACTUALLY READS (assembly.ts);
-- a `dice`/`scaling` payload parses fine and is silently ignored. d4 rather
-- than the rogue's d6 on purpose: sneakDice RETURNS ON THE FIRST MATCHING
-- FEAT, so this must not quietly equal Sneak Attack on a multiclass.
(301, 'Favored Prey', 'class', 5, 1, '{}',
 '{"effect_type": "passive_modifier", "trigger": "strike_vs_flat_footed", "effect": "bonus_damage", "damage_scaling": {"die": "d4"}}',
 'You know where a creature is weakest when it has not set itself. Your strikes against an off-guard enemy deal extra damage.',
 'favored_enemy_1'),

(302, 'Endurance', 'class', 5, 3, '{}',
 '{"effect_type": "skill_mod", "skill": "athletics", "value": 2, "scaling": "flat"}',
 'Long marches and longer nights. +2 Athletics.',
 'endurance'),

-- Selectable class feats, one per class-feat slot (L2, 4, 6, 8, 10).
(310, 'Precise Shot', 'class', 5, 2, '{}',
 '{"effect_type": "combat_action", "actions": 2, "effect": "strike_with_bonus", "damage_bonus": "extra_weapon_die"}',
 'You pick your moment and your target. Your attack deals one extra weapon damage die.',
 NULL),

(311, 'Hobbling Shot', 'class', 5, 4, '{}',
 '{"effect_type": "combat_action", "actions": 2, "effect": "strike_plus_condition", "on_hit": {"apply_condition": "slowed", "value": 1}, "on_crit": {"apply_condition": "slowed", "value": 2}}',
 'A shot to the leg. Your target is slowed, and comes at you more slowly.',
 NULL),

(312, 'Driving Shot', 'class', 5, 6, '{}',
 '{"effect_type": "combat_action", "actions": 1, "effect": "strike_plus_shove"}',
 'A heavy shot that knocks your target back a pace, buying you room to shoot again.',
 NULL),

(313, 'Terrifying Volley', 'class', 5, 8, '{}',
 '{"effect_type": "combat_action", "actions": 2, "effect": "strike_plus_condition", "on_hit": {"apply_condition": "frightened", "value": 1}, "on_crit": {"apply_condition": "frightened", "value": 2}}',
 'Arrows land close enough to teach a lesson. Your target is frightened and fights worse.',
 NULL),

(314, 'Crippling Shot', 'class', 5, 10, '{}',
 '{"effect_type": "combat_action", "actions": 2, "effect": "strike_plus_trip", "trip_uses_MAP": false}',
 'You put a shot through a knee. Your target goes down.',
 NULL);

-- ── BARD (class 8): the party fights better because you are there ───────────

-- Auto-granted class features. These are the bard's identity, so they are
-- granted rather than chosen.
--
-- ⚠ `lore_master` (L5) WAS held back because nothing read Arcana or Religion.
-- Track S wired both into dungeon missions (Arcana breaks rune-sealed hazards,
-- Religion wards undead), so the row is live content now and is granted.
-- `inspire_competence` (L3) is STILL left ungranted: its only honest row is a
-- Performance bonus, and Performance is read by nothing — that would be a
-- number on a sheet that never touches a die.
INSERT INTO feats (id, name, feat_type, class_id, level_req, prerequisites, effects, description, feature_key) VALUES
(330, 'Inspire Courage', 'class', 8, 1, '{}',
 '{"effect_type": "combat_action", "actions": 1, "effect": "grant_party_condition", "condition": "emboldened", "value": 1}',
 'You strike up a rousing tune. Everyone in the party attacks better while it lasts.',
 'inspire_courage'),



(332, 'Lore Master', 'class', 8, 5, '{}',
 '{"effect_type": "skill_mod", "skill": "arcana", "value": 2, "scaling": "flat", "additional_skill_mod": {"skill": "religion", "value": 2}}',
 'You have read about this. +2 Arcana and +2 Religion, which both tell on a mission.',
 'lore_master'),

(333, 'Dirge of Doom', 'class', 8, 8, '{}',
 '{"effect_type": "combat_action", "actions": 1, "effect": "grant_party_condition", "target_side": "enemies", "condition": "frightened", "value": 1}',
 'You play something the enemy does not want to hear. They fight and defend worse while it lasts.',
 'dirge_of_doom'),

(334, 'Inspire Greatness', 'class', 8, 9, '{}',
 '{"effect_type": "combat_action", "actions": 1, "effect": "grant_party_condition", "condition": "heroism", "value": 1}',
 'The song swells. The whole party attacks better and defends better while it lasts.',
 'inspire_greatness'),

-- Selectable class feats (L2, 4, 6, 8, 10).
(340, 'Harmonize', 'class', 8, 2, '{}',
 '{"effect_type": "combat_action", "actions": 1, "effect": "grant_ally_ac", "ac_bonus": 2}',
 'You steady whoever is having the worst time of it. That ally defends better for a moment.',
 NULL),

(341, 'Soothing Refrain', 'class', 8, 4, '{}',
 '{"effect_type": "combat_action", "actions": 1, "limit": "once_per_combat", "effect": "remove_condition", "conditions_removable": ["frightened", "sickened", "slowed"]}',
 'A few bars to clear someone''s head. Once a fight, you shake off fear, sickness or sluggishness.',
 NULL),

(342, 'Song of Strife', 'class', 8, 6, '{}',
 '{"effect_type": "combat_action", "actions": 1, "effect": "grant_party_condition", "condition": "blessed", "value": 1}',
 'A second tune you can hold alongside the first. The party attacks better still.',
 NULL),

(343, 'Bardic Sting', 'class', 8, 8, '{}',
 '{"effect_type": "combat_action", "actions": 2, "effect": "strike_plus_condition", "on_hit": {"apply_condition": "sickened", "value": 1}, "on_crit": {"apply_condition": "sickened", "value": 2}}',
 'A barbed verse delivered with a blade. Your target is sickened.',
 NULL),

(344, 'Call to Arms', 'class', 8, 10, '{}',
 '{"effect_type": "combat_action", "actions": 1, "effect": "grant_party_condition", "condition": "hasted", "value": 1, "duration_ticks": 60}',
 'The tempo lifts and the party moves faster for a short while.',
 NULL);
