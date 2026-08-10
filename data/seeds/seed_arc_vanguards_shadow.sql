-- ============================================================================
-- SEED: "The Vanguard's Shadow" — content vertical slice (brief #6, APPROVED)
-- The Dominion of Krath probes Haven's frontier. 1 storyline · 10 quests
-- (ids 100–109) · 20 enemy bases (ids 100–119) · 2 NPCs · dialogue · lore ·
-- named world regions. IDs are append-only forever; gaps are deliberate.
-- Stats are banded against the exemplar rows (see seed_enemies_full.sql) and
-- gated by tests/content/validators.test.ts.
-- Apply: pnpm db:apply data/seeds/seed_arc_vanguards_shadow.sql && pnpm convert
-- ============================================================================

-- ── Enemies: the Vanguard's order of battle (levels 1–8) ────────────────────
INSERT INTO enemies (id, name, enemy_type, tier, base_level, hp, ac, str, dex, con, int, wis, cha, speed, attack_bonus, damage_dice, damage_type, weapon_traits, abilities, loot_table_id, xp_reward, description, has_manufactured_armor, aoo_count) VALUES
-- Level 1 — the raids look like ordinary goblin trouble
(100, 'Goblin Sapper',            'humanoid', 'basic',     1,  8, 13,  8, 14, 10,  8, 10,  8, 5,  2, '1d4',  'slashing',    '["agile"]', '', 1,  20, 'Carries more oil than sense. The burned granaries are its work.', 0, 0),
(101, 'Goblin Firebrand',         'humanoid', 'basic',     1,  7, 13,  8, 14, 10, 10, 10, 10, 5,  3, '1d4',  'fire',        '["agile"]', '', 1,  22, 'A torch in each hand and orders in its head — goblins do not usually take orders.', 0, 0),
-- Level 2 — someone is supplying them
(102, 'Warg',                     'beast',    'basic',     2, 16, 14, 14, 15, 12,  4, 12,  6, 7,  5, '1d6',  'piercing',    '', '', NULL, 38, 'Bred for war, not scavenging. Wargs do not wander this far south on their own.', 0, 0),
(103, 'Goblin Alarmist',          'humanoid', 'basic',     2, 14, 14,  8, 15, 10, 10, 12,  8, 5,  4, '1d6',  'piercing',    '["agile"]', '', 1,  35, 'Runs for the horn before it runs for cover. Discipline, of a kind.', 0, 0),
(104, 'Krathite Conscript',       'humanoid', 'basic',     2, 18, 15, 13, 10, 12,  8, 10,  8, 5,  5, '1d8',  'slashing',    '', '', 3,  40, 'A farmer six months ago, by the hands. The Dominion arms whoever it swallows.', 1, 0),
-- Level 3 — iron shoes, legion kit
(105, 'Orc Raider',               'humanoid', 'basic',     3, 28, 15, 16, 12, 14,  7, 10,  8, 5,  6, '1d10', 'slashing',    '', '', 4,  55, 'Vanguard muscle. Takes what the legion will need before the legion arrives.', 0, 0),
(106, 'Bone Conscript',           'undead',   'basic',     3, 24, 15, 14, 10, 10,  2,  6,  2, 5,  5, '1d6',  'slashing',    '', '', 2,  48, 'A dead soldier still in Dominion issue. Somebody filed a requisition for this.', 1, 0),
(107, 'Hobgoblin Vanguard',       'humanoid', 'basic',     3, 24, 16, 14, 12, 12, 10, 11,  9, 5,  6, '1d8',  'piercing',    '', '', 3,  52, 'First in, maps everything, burns nothing. The dangerous kind of scout.', 1, 0),
-- Level 4 — the reveal
(108, 'Orc Breaker',              'humanoid', 'elite',     4, 36, 16, 18, 10, 15,  7,  9,  8, 5,  8, '1d10', 'bludgeoning', '', '', 4,  78, 'Doors, walls, shield lines. The Breaker does not distinguish.', 0, 0),
(109, 'Grave-Whisperer',          'undead',   'elite',     4, 26, 15,  8, 12, 10, 14, 15, 13, 5,  7, '1d6',  'necrotic',    '', '', 4,  72, 'It remembers being a Krathite field-chirurgeon. Its patients still report for duty.', 0, 0),
(110, 'Hobgoblin Legionnaire',    'humanoid', 'elite',     4, 32, 17, 15, 12, 13, 10, 11,  9, 5,  8, '1d8',  'piercing',    '', '', 4,  75, 'Line infantry of the Iron Fist. Fights in formation even when alone.', 1, 1),
-- Level 5 — the vanguard proper
(111, 'Warg Alpha',               'beast',    'elite',     5, 42, 16, 16, 16, 14,  5, 13,  8, 7,  9, '2d6',  'piercing',    '', '', 5,  95, 'The pack answers it; it answers a whistle only two Krathites know.', 0, 0),
(112, 'Orc Siege-Hand',           'humanoid', 'elite',     5, 44, 16, 18, 10, 16,  9,  9,  8, 5,  9, '1d12', 'bludgeoning', '', '', 5,  92, 'Knows Vel''s fortification manuals by rote. Assembly is a kind of violence.', 0, 0),
(113, 'Krathite Field Necromancer','humanoid','elite',     5, 34, 16,  9, 12, 12, 16, 13, 12, 5,  8, '1d8',  'necrotic',    '', '', 5,  98, 'The Silent Office denies the necromantic auxiliary exists. The graves disagree.', 0, 0),
-- Level 6 — the foothold hardens
(114, 'Hobgoblin Tactician',      'humanoid', 'champion',  6, 50, 18, 14, 13, 13, 16, 13, 11, 5, 11, '1d8',  'piercing',    '', '', 6, 125, 'Sees the battle three moves out. Kill it first or fight its plan forever.', 1, 1),
(115, 'Barrow Wight',             'undead',   'champion',  6, 48, 17, 16, 10, 12,  8, 13, 15, 5, 11, '1d8',  'necrotic',    '', '', 6, 128, 'Raised from a frontier barrow the Dominion had no right to open.', 0, 0),
(116, 'Siege Engine Crew',        'humanoid', 'champion',  6, 55, 17, 17, 10, 15, 12, 10,  8, 5, 11, '2d6',  'bludgeoning', '', '', 6, 130, 'Three Krathites and a machine that outranges everything Haven owns.', 1, 0),
-- Level 7–8 — the arc's edge
(117, 'Vanguard Champion',        'humanoid', 'champion',  7, 60, 19, 18, 13, 15, 11, 12, 10, 5, 13, '2d8',  'slashing',    '', '', 6, 155, 'Splitfang''s decorations on Koss''s leash. The vanguard''s hard answer.', 1, 1),
(118, 'The Whisper''s Blade',     'humanoid', 'champion',  7, 52, 19, 12, 18, 12, 13, 14, 12, 7, 13, '1d6',  'piercing',    '["agile","finesse"]', '', 7, 158, 'No insignia, no orders in writing, no face anyone remembers.', 0, 1),
(119, 'Vanguard-Captain Ruk Mor-Tal','humanoid','legendary',8,110, 20, 18, 13, 16, 14, 13, 12, 5, 15, '2d10', 'slashing',   '', '', 8, 300, 'Career officer of the Iron Fist. His foothold was to be a province; Haven is the itemized obstacle.', 1, 2),
-- Reserve for the arc''s next act (append-only convention: leave the gap visible)
(120, 'Krathite Signal-Corp',     'humanoid', 'basic',     2, 15, 14, 10, 14, 10, 12, 12, 10, 5,  4, '1d6',  'piercing',    '', '', 3,  36, 'Mirrors, horns, and coded flags. The Whisper reads every report first.', 0, 0);

-- ── Quests: ten postings, three movements ───────────────────────────────────
INSERT INTO quests (id, name, description, quest_type, min_level, reward_gold, reward_xp, reward_items, reward_reputation, poi_id, dungeon_level, enemy_group, prerequisites) VALUES
-- Movement I: Raids (lv 1–2)
(100, 'The Burned Granary',   'Third granary this month. The sappers left tracks — follow them to the staging camp and end it.', 'combat', 1, 120,  90, '', 5, NULL, NULL, '[{"enemy_id":100,"count":3},{"enemy_id":1,"count":2}]', ''),
(101, 'Tracks in the Ashes',  'War-bred wargs among the raiders. Someone supplied them. Run the pack down before it runs the roads.', 'combat', 1, 140, 100, '', 5, NULL, NULL, '[{"enemy_id":102,"count":2},{"enemy_id":101,"count":2}]', ''),
(102, 'The Scout''s Satchel', 'A goblin alarmist fled into the old warren carrying a satchel of surveyed maps. Maps of OUR roads. Recover it.', 'dungeon', 2, 250, 180, '', 10, 10, 2, '[{"enemy_id":107,"count":1},{"enemy_id":104,"count":1}]', ''),
-- Movement II: The Reveal (lv 3–5)
(103, 'Iron-Shod Ambush',     'Iron shoes on goblin feet and legion steel on human backs. The Marshal wants prisoners; the ambush wants you.', 'combat', 3, 380, 260, '', 10, NULL, NULL, '[{"enemy_id":105,"count":2},{"enemy_id":104,"count":2},{"enemy_id":102,"count":1}]', ''),
(104, 'The Supply Cache',     'The vanguard is provisioning somewhere dry and defensible. Find the cache, take what Haven can use, burn the rest.', 'dungeon', 3, 450, 320, '', 15, 11, 4, '[{"enemy_id":110,"count":1},{"enemy_id":105,"count":1}]', ''),
(105, 'What the Graves Gave Up', 'The barrow field was opened from the outside. What walked out is wearing Dominion issue. Put it back.', 'dungeon', 4, 480, 350, '', 15, 12, 4, '[{"enemy_id":109,"count":1},{"enemy_id":106,"count":2}]', ''),
(106, 'The Whisper''s Man',   'A quartermaster''s ledger names a buyer in Haven itself. The seller holed up in the river caves. Ask him — firmly.', 'dungeon', 4, 550, 420, '', 15, 13, 5, '[{"enemy_id":118,"count":1}]', ''),
-- Movement III: The Foothold (lv 5–7)
(107, 'Find the Fort',        'Everything points at a fortified camp that should not exist. Find it. Map it. Come back alive — that order is explicit.', 'dungeon', 5, 650, 520, '', 20, 14, 6, '[{"enemy_id":114,"count":1},{"enemy_id":110,"count":1}]', ''),
(108, 'Break the Engines',    'Vel''s designs, Krathite hands. If the engines reach the walls, Haven negotiates. Break them in the yard.', 'dungeon', 6, 750, 600, '', 20, 15, 6, '[{"enemy_id":116,"count":1},{"enemy_id":112,"count":1}]', ''),
(109, 'The Vanguard-Captain', 'Ruk Mor-Tal holds the foothold with his best. The Marshal is done trading granaries for time. End the incursion.', 'dungeon', 6, 1200, 900, '', 30, 16, 7, '[{"enemy_id":119,"count":1},{"enemy_id":117,"count":1}]', '');

-- ── The storyline and its spine ─────────────────────────────────────────────
INSERT INTO storylines (id, name, description, is_base_game, trigger_type, trigger_value, quest_count) VALUES
(1, 'The Vanguard''s Shadow', 'The Dominion of Krath probes Haven''s frontier: goblin raids, then legion iron, then a foothold that was to be a province.', 1, 'game_start', '', 10);

INSERT INTO storyline_quests (id, storyline_id, quest_id, sequence, branch_from, branch_condition) VALUES
(1, 1, 100, 1, NULL, ''), (2, 1, 101, 2, NULL, ''), (3, 1, 102, 3, NULL, ''),
(4, 1, 103, 4, NULL, ''), (5, 1, 104, 5, NULL, ''), (6, 1, 105, 6, NULL, ''),
(7, 1, 106, 7, NULL, ''), (8, 1, 107, 8, NULL, ''), (9, 1, 108, 9, NULL, ''),
(10, 1, 109, 10, NULL, '');

-- ── The arc's two faces ─────────────────────────────────────────────────────
INSERT INTO npcs (id, name, category, title, ancestry_id, description, backstory, class_id, level, building_id, town_bonus, loyalty_start, unlock_condition, personal_quest_id) VALUES
(1, 'Marshal Edrin Vale', 'mentor', 'Marshal of the Frontier', 1,
 'Haven''s frontier marshal: grey, unhurried, and never once surprised on the record.',
 'Held the western watch through the last Krathite war as a sergeant. Reads raid patterns the way scholars read verse, and has been writing unanswered letters about the border for a year.',
 NULL, NULL, 1, '', 70, '', NULL),
(2, 'Vanguard-Captain Ruk Mor-Tal', 'villain', 'Captain of the Vanguard Legions', NULL,
 'A hobgoblin career officer of the Iron Fist; the incursion is his ledger and Haven is a line item.',
 'Rose under Warchief Splitfang on merit and stayed under Koss on obedience. His doctrine: never fight for ground you have not already counted. The foothold was counted a year ago.',
 NULL, 8, NULL, '', 0, '', 109);

-- ── Dialogue: the Marshal's Table (trigger_value = completed quest id; '' = arc open) ──
INSERT INTO story_dialogue (id, storyline_id, npc_id, trigger_type, trigger_value, sequence, speaker, text, choices) VALUES
(1, 1, 1, 'quest', '',    1, 'Marshal Edrin Vale', 'Third granary this month. Goblins don''t organize like this — something is pushing them south, and it wears boots. Take the raid work on the board; bring me tracks, not trophies.', '[{"label":"We''ll look into it."}]'),
(2, 1, 1, 'quest', '103', 2, 'Marshal Edrin Vale', 'Iron shoes. Legion steel. I wrote letters about this for a year and got seals and silence back. It''s the Dominion, and it isn''t a raid — it''s a survey. Whatever they''re measuring for, we are in the way of it.', '[{"label":"Then we push back."},{"label":"What do they want here?"}]'),
(3, 1, 1, 'quest', '108', 3, 'Marshal Edrin Vale', 'The engines are scrap and their fort is blind. Mor-Tal will know in a day what that means: finish it now or feed it for a decade. He built one door into that camp, guildmaster. Walk through it before he does.', '[{"label":"We end it."}]'),
(4, 1, 1, 'quest', '109', 4, 'Marshal Edrin Vale', 'The vanguard is broken and the frontier holds — YOUR frontier now, as far as the road-songs care. But Mor-Tal''s ledger named a buyer inside Haven, and the Whisper doesn''t leave loose ends. It leaves invitations. Rest. Then we talk about who opened the gate.', '[{"label":"We''ll be ready."}]');

-- ── Lore drops: The Whisper thread (spoiler_level 1 vague → 3 explicit) ─────
INSERT INTO lore_references (id, source_type, source_id, npc_id, spoiler_level, text, unlock_condition) VALUES
(1, 'enemy_bark', 104, NULL, 1, '"The quartermaster said nobody would even fight for this place."', ''),
(2, 'inscription', NULL, NULL, 1, 'A survey mark in Krathite field-cipher, cut into a milestone a day''s walk from Haven. It is at least a year old.', ''),
(3, 'enemy_bark', 110, NULL, 2, '"The Captain counts everything twice. The Office counts him."', ''),
(4, 'inscription', NULL, NULL, 2, 'Requisition slip, Dominion form: "Auxiliary reanimates, two score, for road labor. Approval: THE SILENT OFFICE." The ink is fresher than the paper.', ''),
(5, 'enemy_bark', 118, NULL, 3, '"You were sold before the first granary burned. Ask your Marshal who signs the gate ledger."', ''),
(6, 'inscription', NULL, 1, 3, 'The Marshal''s unsent letter: "…if the Office has a man inside Haven, he was placed before the raids began. I no longer trust this seal to reach you unread."', '');

-- ── The five regions get their names ────────────────────────────────────────
INSERT INTO world_regions (id, name, description, controlled_by, danger_level, known_resources, mysteries) VALUES
('region_haven', 'The Vigil Lands', 'Haven''s home fields and the roads the guild keeps open. Quiet is a thing that gets made here, daily, by hand.', 'Haven', 1, '["grain","timber"]', '[]'),
('region_ne',    'The Ashmark',     'Burned-over frontier running toward the Dominion border. Named twice: once for the soil, once for this year.', NULL, 4, '["iron","salt"]', '["Krathite survey-marks","the opened barrows"]'),
('region_nw',    'Thornwood Reach', 'Old forest and older footpaths. The wargs came through here, which means something taught them the way.', NULL, 3, '["timber","furs"]', '["war-bred wargs far from any pen"]'),
('region_se',    'The Fallow Coast','Low farmland and river caves the maps undersell. Smugglers have always liked it; lately, so does someone''s buyer.', NULL, 2, '["fish","clay"]', '["the ledger''s unnamed buyer"]'),
('region_sw',    'Gravel Downs',    'Scrub hills, dry barrows, and the only ground flat enough to assemble engines out of sight of the walls.', NULL, 3, '["stone"]', '["fresh cart-ruts leading nowhere on any map"]');
