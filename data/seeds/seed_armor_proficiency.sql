-- ============================================================================
-- SEED: armour proficiency (brief #23 M2, decision D1)
--
-- ⚠ THIS IS THE ONE HALF OF #23 THAT NEEDED AUTHORING, NOT WIRING.
-- Weapons were already covered: class_weapon_proficiency held 44 rows granting
-- categories ('simple'/'martial') and named weapons, and M1 only had to READ
-- them. Armour had NOTHING — zero armour rows here, and no armour stat in
-- class_proficiency_tiers either. So these rows are new content.
--
-- Reuses the EXISTING table with a third grant_type rather than adding a new
-- one, because a column costs no tooling change but a table costs both count
-- gates plus converter plumbing (CLAUDE.md, Data discipline). New rows DO move
-- both gates: 44 -> 70 (26 new rows), updated in the same commit.
--
--   grant_type 'armor' + grant_value 'light' | 'medium' | 'heavy' | 'shield'
--
-- Bands map from items.item_subtype (see heroes/gearProficiency.ts):
--   unarmored  robes                                    (free to everyone)
--   light      padded, leather, studded
--   medium     chain_shirt, chain_mail, scale_mail
--   heavy      half_plate, full_plate, heavy
--   shield     item_type='shield' (4 rows)
--
-- ⚠ ALL 13 CLASSES GET ROWS, not just the founding four. gearProficiency.ts
-- treats a class with NO armour grants as proficient with everything (absence
-- of data means "no opinion", never "forbidden"), so a half-populated table
-- would leave the other nine silently unrestricted and the feature would look
-- like it worked while doing nothing for most of the roster.
--
-- Design shape: martial classes get heavy; divine/medium classes stop at
-- medium; skirmishers and casters stay light; Monk and the arcane casters take
-- nothing but light (Monk by tradition — unarmoured is the point of the class).
-- Shields follow the shield-wall classes.
--
-- Apply: pnpm db:apply data/seeds/seed_armor_proficiency.sql && pnpm convert
-- ============================================================================

INSERT INTO class_weapon_proficiency (id, class_id, grant_type, grant_value) VALUES
-- Fighter (1) — the full martial kit
(45, 1, 'armor', 'light'),
(46, 1, 'armor', 'medium'),
(47, 1, 'armor', 'heavy'),
(48, 1, 'armor', 'shield'),

-- Wizard (2) — robes and nothing else. Full Plate is a deliberate mistake.
(49, 2, 'armor', 'light'),

-- Cleric (3) — medium and shields; heavy belongs to the war-god fantasy, and
-- withholding it keeps the Fighter's plate distinct.
(50, 3, 'armor', 'light'),
(51, 3, 'armor', 'medium'),
(52, 3, 'armor', 'shield'),

-- Rogue (4) — light only. The rogue's defence is not being hit.
(53, 4, 'armor', 'light'),

-- Ranger (5) — light + medium, no shield (two-weapon / bow hands)
(54, 5, 'armor', 'light'),
(55, 5, 'armor', 'medium'),

-- Barbarian (6) — light + medium + shield; no heavy (rage wants mobility)
(56, 6, 'armor', 'light'),
(57, 6, 'armor', 'medium'),
(58, 6, 'armor', 'shield'),

-- Monk (7) — light only, by tradition: the unarmoured fighter
(59, 7, 'armor', 'light'),

-- Bard (8) — light + shield
(60, 8, 'armor', 'light'),
(61, 8, 'armor', 'shield'),

-- Sorcerer (9) — light only
(62, 9, 'armor', 'light'),

-- Arcane Trickster (10) — light only (prestige, rogue-shaped)
(63, 10, 'armor', 'light'),

-- Eldritch Knight (11) — the armoured caster: full martial kit
(64, 11, 'armor', 'light'),
(65, 11, 'armor', 'medium'),
(66, 11, 'armor', 'heavy'),
(67, 11, 'armor', 'shield'),

-- Mystic Theurge (12) — light only (prestige, caster-shaped)
(68, 12, 'armor', 'light'),

-- Warlock (13) — light + shield
(69, 13, 'armor', 'light'),
(70, 13, 'armor', 'shield');
