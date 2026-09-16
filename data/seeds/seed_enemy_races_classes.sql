-- ============================================================================
-- Brief #30 — ENEMY RACES x CLASSES. The content half.
--
-- A race is what a creature IS; a class is what it DOES.
--
--   enemy_races.intrinsic_abilities MERGES into the row's own `abilities` in
--   buildEnemy (deduped, race first). That is what makes a race mechanical
--   rather than a label: fix the race, and every row of that race is fixed.
--   It is also why the Vanguard batch's 21 empty rows finally do something --
--   they inherit from what they ARE.
--
--   enemy_classes.loadout is read straight into Combatant.loadout, which
--   pickAction has always walked unit-agnostically. Verified before any of
--   this was written: brief #30 section 1, six witnesses with negative controls.
--
-- ⚠ ability_cooldown_ticks IS NOT DECORATION -- IT IS WHAT MAKES A CLASS A
--   BUFF INSTEAD OF A NERF. swingsPerAction is 2, so a normal action is a
--   two-swing burst while an ability strike is ONE swing. An AI takes the top
--   matching loadout entry EVERY action, so without a cadence a classed enemy
--   is strictly WEAKER than an unclassed one -- measured at -35% to -69%
--   damage, with the hero finishing with MORE hp against the classed enemy.
--   200 ticks = a special roughly every fifth action.
--
-- ⚠ TWO ABILITIES WERE DROPPED FROM CLASSES AFTER MEASUREMENT, and the reason
--   generalises: an ability that COSTS AN ACTION BUT ADDS NO SWING is a loss
--   for an AI that cannot pick its moment.
--     - Poison Weapon on Skirmisher: enemy wins 19 -> 1. A whole action for a
--       1d4 rider. Knockdown alone measured 19 -> 20.
--     - Divine Lance on Zealot: a 1d4 cantrip replacing a two-swing weapon
--       burst on a MELEE statblock measured 11 wins -> 0. The same cantrip on
--       a CASTER statblock measured 1 -> 9, which is why Caster keeps one.
--
-- ⚠ classification is DECLARED, never derived. Two honest readings of the same
--   45 rows put fodder at 80.0% and 28.9% -- 51.1 points apart (brief #30
--   section 2). A gate that infers cannot be trusted; this column is the fact.
--
-- Composition after this seed: Fodder 18 (40.0%) / Melee 15 / Ranged 2 / Magic 10
-- Baseline was: Fodder 80.0% / Melee 11.1% / Magic 8.9% / Ranged 0%
--
-- Apply:   pnpm db:apply data/seeds/seed_enemy_races_classes.sql
-- Then:    pnpm convert
-- ============================================================================


-- == The race table =========================================================

CREATE TABLE IF NOT EXISTS enemy_races (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    enemy_type TEXT NOT NULL DEFAULT 'humanoid',
    size TEXT NOT NULL DEFAULT 'medium',
    speed INTEGER NOT NULL DEFAULT 5,
    intrinsic_abilities TEXT NOT NULL DEFAULT '[]',  -- JSON array, LIVE vocabulary only
    description TEXT NOT NULL DEFAULT ''
);

INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (1,'Goblin','humanoid','medium',5,'[]','Small, vicious, and numerous.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (2,'Kobold','humanoid','medium',5,'[]','Cunning trap-layers.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (3,'Human','humanoid','medium',5,'[]','Bandits, cultists, and the Dominion rank-and-file.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (4,'Hobgoblin','humanoid','medium',5,'["formation_bonus"]','Drilled soldiery. They fight in ranks.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (5,'Orc','humanoid','medium',5,'["ferocity"]','They do not stop when they should.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (6,'Bugbear','humanoid','medium',5,'["stealth"]','Far quieter than its size allows.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (7,'Wolf','animal','medium',7,'["pack_tactics"]','Never fights alone.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (8,'Warg','beast','large',7,'["pack_tactics"]','A wolf with malice and a rider.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (9,'Giant Rat','animal','medium',5,'["disease"]','Carries what killed the last village.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (10,'Giant Spider','beast','large',5,'["poison"]','Waits. Then does not.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (11,'Minotaur','beast','large',6,'["charge"]','Covers ground you thought was safe.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (12,'Ogre','giant','large',5,'[]','Enormous, slow, and sufficient.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (13,'Troll','giant','large',5,'["regeneration_10","fire_weakness"]','Knits itself back together. Fire does not let it.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (14,'Hill Giant','giant','large',5,'[]','Throws what it finds.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (15,'Skeleton','undead','medium',5,'[]','Immunity derives from enemy_type; the bones need nothing else.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (16,'Zombie','undead','medium',4,'[]','Slow, and does not care.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (17,'Ghoul','undead','medium',5,'[]','Hungry in a way that spreads.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (18,'Wight','undead','medium',5,'["energy_drain"]','Takes years, not blood.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (19,'Wraith','undead','medium',6,'["energy_drain"]','A grudge with no body left.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (20,'Vampire','undead','medium',6,'["energy_drain"]','Older than the barony it ruined.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (21,'Lich','undead','medium',5,'[]','Chose this.');
INSERT OR REPLACE INTO enemy_races (id,name,enemy_type,size,speed,intrinsic_abilities,description) VALUES (22,'Red Dragon','dragon','large',8,'[]','The apex the brackets build toward.');


-- == The class table ========================================================
--
-- `loadout` is a JSON array of LoadoutEntry exactly as src/sim/combat/loadout.ts
-- defines it. Feat ids are the wired actives (ACTIVE_WIRED); spell ids are real
-- cantrips, which need NO casting resources -- canAfford short-circuits at
-- spell_level 0, measured at 2,796 casts over 20 fights with casting:null.

CREATE TABLE IF NOT EXISTS enemy_classes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    classification TEXT NOT NULL,   -- 'Melee' | 'Ranged' | 'Magic'
    weapon_range INTEGER NOT NULL DEFAULT 1,
    engage_range INTEGER NOT NULL DEFAULT 1,
    loadout TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL DEFAULT '',
    ability_cooldown_ticks INTEGER NOT NULL DEFAULT 0  -- min ticks between ability STRIKES
);

INSERT OR REPLACE INTO enemy_classes (id,name,classification,weapon_range,engage_range,loadout,description,ability_cooldown_ticks) VALUES (1,'Warrior','Melee',1,1,'[{"action":"ability","featId":4,"condition":{"kind":"always"},"target":"scoredEnemy"},{"action":"strike","condition":{"kind":"always"},"target":"scoredEnemy"}]','Holds the line and punishes you for leaving it.',200);
INSERT OR REPLACE INTO enemy_classes (id,name,classification,weapon_range,engage_range,loadout,description,ability_cooldown_ticks) VALUES (2,'Brute','Melee',1,1,'[{"action":"ability","featId":1,"condition":{"kind":"always"},"target":"scoredEnemy"},{"action":"strike","condition":{"kind":"always"},"target":"scoredEnemy"}]','Closes fast and refuses to fall.',200);
INSERT OR REPLACE INTO enemy_classes (id,name,classification,weapon_range,engage_range,loadout,description,ability_cooldown_ticks) VALUES (3,'Skirmisher','Melee',1,1,'[{"action":"ability","featId":5,"condition":{"kind":"always"},"target":"scoredEnemy"},{"action":"strike","condition":{"kind":"always"},"target":"scoredEnemy"}]','Hits from surprise and puts you on the ground.',200);
INSERT OR REPLACE INTO enemy_classes (id,name,classification,weapon_range,engage_range,loadout,description,ability_cooldown_ticks) VALUES (4,'Caster','Magic',1,6,'[{"action":"cast","spellId":1,"condition":{"kind":"always"},"target":"scoredEnemy"},{"action":"strike","condition":{"kind":"always"},"target":"scoredEnemy"}]','Damage that ignores armour, from range.',0);
INSERT OR REPLACE INTO enemy_classes (id,name,classification,weapon_range,engage_range,loadout,description,ability_cooldown_ticks) VALUES (5,'Zealot','Magic',1,6,'[{"action":"ability","featId":138,"condition":{"kind":"allyHpBelow","pct":0.35},"target":"self"},{"action":"strike","condition":{"kind":"always"},"target":"scoredEnemy"}]','Drains you; shields its own when they falter.',200);
INSERT OR REPLACE INTO enemy_classes (id,name,classification,weapon_range,engage_range,loadout,description,ability_cooldown_ticks) VALUES (6,'Archer','Ranged',6,6,'[{"action":"strike","condition":{"kind":"always"},"target":"scoredEnemy"}]','Hurts you before you reach it.',0);


-- == The three columns on enemies ===========================================
--
-- Nullable class_id IS the Fodder signal, but classification is declared
-- anyway: a row must be able to say "I am Fodder" out loud, and the gate
-- cross-checks the two rather than trusting either alone.

ALTER TABLE enemies ADD COLUMN race_id INTEGER REFERENCES enemy_races(id);
ALTER TABLE enemies ADD COLUMN class_id INTEGER REFERENCES enemy_classes(id);
ALTER TABLE enemies ADD COLUMN classification TEXT NOT NULL DEFAULT 'Fodder';

UPDATE enemies SET race_id=1, class_id=NULL, classification='Fodder' WHERE id=1;  -- Goblin
UPDATE enemies SET race_id=15, class_id=NULL, classification='Fodder' WHERE id=2;  -- Skeleton
UPDATE enemies SET race_id=7, class_id=3, classification='Melee' WHERE id=3;  -- Wolf
UPDATE enemies SET race_id=9, class_id=NULL, classification='Fodder' WHERE id=4;  -- Giant Rat
UPDATE enemies SET race_id=2, class_id=NULL, classification='Fodder' WHERE id=5;  -- Kobold
UPDATE enemies SET race_id=3, class_id=NULL, classification='Fodder' WHERE id=6;  -- Bandit
UPDATE enemies SET race_id=16, class_id=NULL, classification='Fodder' WHERE id=7;  -- Zombie
UPDATE enemies SET race_id=10, class_id=3, classification='Melee' WHERE id=8;  -- Giant Spider
UPDATE enemies SET race_id=3, class_id=5, classification='Magic' WHERE id=9;  -- Cultist
UPDATE enemies SET race_id=4, class_id=1, classification='Melee' WHERE id=10;  -- Hobgoblin Soldier
UPDATE enemies SET race_id=5, class_id=2, classification='Melee' WHERE id=11;  -- Orc Warrior
UPDATE enemies SET race_id=17, class_id=2, classification='Melee' WHERE id=12;  -- Ghoul
UPDATE enemies SET race_id=6, class_id=3, classification='Melee' WHERE id=13;  -- Bugbear
UPDATE enemies SET race_id=11, class_id=2, classification='Melee' WHERE id=14;  -- Minotaur
UPDATE enemies SET race_id=18, class_id=5, classification='Magic' WHERE id=15;  -- Wight
UPDATE enemies SET race_id=12, class_id=2, classification='Melee' WHERE id=16;  -- Ogre
UPDATE enemies SET race_id=13, class_id=2, classification='Melee' WHERE id=17;  -- Troll
UPDATE enemies SET race_id=19, class_id=5, classification='Magic' WHERE id=18;  -- Wraith
UPDATE enemies SET race_id=3, class_id=4, classification='Magic' WHERE id=19;  -- Cult Leader
UPDATE enemies SET race_id=22, class_id=4, classification='Magic' WHERE id=20;  -- Dragon Wyrmling
UPDATE enemies SET race_id=20, class_id=5, classification='Magic' WHERE id=21;  -- Vampire Lord
UPDATE enemies SET race_id=14, class_id=6, classification='Ranged' WHERE id=22;  -- Hill Giant Chief
UPDATE enemies SET race_id=21, class_id=4, classification='Magic' WHERE id=23;  -- Lich
UPDATE enemies SET race_id=22, class_id=6, classification='Ranged' WHERE id=24;  -- Adult Red Dragon
UPDATE enemies SET race_id=1, class_id=NULL, classification='Fodder' WHERE id=100;  -- Goblin Sapper
UPDATE enemies SET race_id=1, class_id=NULL, classification='Fodder' WHERE id=101;  -- Goblin Firebrand
UPDATE enemies SET race_id=8, class_id=NULL, classification='Fodder' WHERE id=102;  -- Warg
UPDATE enemies SET race_id=1, class_id=NULL, classification='Fodder' WHERE id=103;  -- Goblin Alarmist
UPDATE enemies SET race_id=3, class_id=NULL, classification='Fodder' WHERE id=104;  -- Krathite Conscript
UPDATE enemies SET race_id=5, class_id=NULL, classification='Fodder' WHERE id=105;  -- Orc Raider
UPDATE enemies SET race_id=15, class_id=NULL, classification='Fodder' WHERE id=106;  -- Bone Conscript
UPDATE enemies SET race_id=4, class_id=NULL, classification='Fodder' WHERE id=107;  -- Hobgoblin Vanguard
UPDATE enemies SET race_id=5, class_id=2, classification='Melee' WHERE id=108;  -- Orc Breaker
UPDATE enemies SET race_id=18, class_id=5, classification='Magic' WHERE id=109;  -- Grave-Whisperer
UPDATE enemies SET race_id=4, class_id=1, classification='Melee' WHERE id=110;  -- Hobgoblin Legionnaire
UPDATE enemies SET race_id=8, class_id=NULL, classification='Fodder' WHERE id=111;  -- Warg Alpha
UPDATE enemies SET race_id=5, class_id=NULL, classification='Fodder' WHERE id=112;  -- Orc Siege-Hand
UPDATE enemies SET race_id=3, class_id=4, classification='Magic' WHERE id=113;  -- Krathite Field Necromancer
UPDATE enemies SET race_id=4, class_id=1, classification='Melee' WHERE id=114;  -- Hobgoblin Tactician
UPDATE enemies SET race_id=18, class_id=5, classification='Magic' WHERE id=115;  -- Barrow Wight
UPDATE enemies SET race_id=3, class_id=NULL, classification='Fodder' WHERE id=116;  -- Siege Engine Crew
UPDATE enemies SET race_id=3, class_id=1, classification='Melee' WHERE id=117;  -- Vanguard Champion
UPDATE enemies SET race_id=3, class_id=3, classification='Melee' WHERE id=118;  -- The Whisper's Blade
UPDATE enemies SET race_id=3, class_id=1, classification='Melee' WHERE id=119;  -- Vanguard-Captain Ruk Mor-Tal
UPDATE enemies SET race_id=3, class_id=NULL, classification='Fodder' WHERE id=120;  -- Krathite Signal-Corp


-- == Guard rails ============================================================
--
-- ⚠ NO SQL ASSERTION HERE: SQLite's RAISE() is only legal inside a trigger
-- program, so the obvious "SELECT RAISE(ROLLBACK,...) WHERE EXISTS(...)" form
-- fails at parse time and rolls the whole seed back. The invariants it wanted
-- to state -- every row has a race_id, every classification is one of the four
-- -- are enforced by tools/check-enemy-taxonomy.mjs, which runs in pnpm check
-- and in CI on every push. That is the right home for them: a gate that runs
-- on every commit beats an assertion that runs once at apply time.

