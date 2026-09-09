# Guild Vigil — class progression sheets

**Generated 2026-09-09 from the live registries** in `src/content/generated/` — `classes` (13), `class_progression` (230 rows), `feats` (227), `class_proficiency_tiers` (112), `class_skills` (64), `class_weapon_proficiency` (44), `spells` (218), `bloodlines` (8) + `bloodline_spells` (40), `warlock_spell_costs` (7), `class_prerequisites` (12).

Every number here is **authored content already in the database**, not a proposal. This sheet is a read-out, not a design document — regenerate it rather than hand-editing.

📊 **Visual version:** `output/reference/class-progression-chart.html` — one tabbed chart per class (bar tracks, tier ladders, spell-slot heatmaps). Rebuild it with `pnpm class-chart` after regenerating this file.

> ⚠ **Almost none of this is reachable by the player today.** The level-up wizard commits `feats: []` and nothing in `src/` reads the `feat_slot_*` columns or the `features` column. See `output/briefs/character-workstream.md` for the audit and the proposed unlock sequence.

---

## The shared model

| Concept | Rule as implemented |
|---|---|
| Character level | sum of all class levels; cap **20** |
| Class level cap | **20** base · **10** prestige |
| Max classes | **5** |
| Multiclass gate | key ability **≥ 13** — boost-before-class, so a pending +2 counts the same level |
| Ability boosts | +2 to one ability at character level **5 / 10 / 15 / 20** |
| Skill points | `class base + INT mod`, floor 1, on the **post-boost** INT (the Godot ordering bug is fixed) |
| Skill rank cap | **= character level** (Guild Vigil divergence, playtest finding #4) |
| Proficiency | `floor(level/2) + 1` **+ tier bonus** — a PF1-shaped curve, deliberately *not* PF2E's `level + rank` |
| HP per level | `max(1, hp_per_level + CON mod)`; fresh heroes also get `ANCESTRY_BASE_HP = 8` |
| CON boost | pays **retroactive** HP = modDiff × prior character level |
| Ability mod | **PF-RAW floor** — score 7 → −2 (Godot truncated to −1; the divergence is deliberate) |
| XP | flat, cumulative, never spent; level 20 uses a `-1` sentinel |
| Ancestry | **cosmetic** — identity + portrait only, zero stat effect, enforced by `muster.test.ts` |

### Feat slot cadence — identical for every base class, with one exception

| Slot | Levels granted | Total by L20 |
|---|---|---|
| Class feat | every **even** level (2,4,…,20) | 10 |
| General feat | every **even** level | 10 |
| Ancestry feat | **1, 5, 9, 13, 17** | 5 |
| Skill feat | every **even** level | 10 |

⚠ **The Fighter is the exception and it is deliberate**: it grants **1 class feat at every odd level *and* 2 at every even level** — 30 grants against everyone else's 10. That is the class's whole identity in this data model, and it is also the single largest balance risk in unlocking feat selection.

Prestige classes get **5 class feats, 5 skill feats, 3 ancestry feats, and no general feats** across their 10 levels — except Mystic Theurge, which gets **no class feats at all** (8 total).

### Feat pool sizes

| Pool | Rows | By level requirement |
|---|---|---|
| Fighter class feats | 23 | L1:5 · L2:4 · L4:3 · L6:3 · L8:3 · L10:3 · L12:2 |
| Wizard class feats | 24 | L1:5 · L2:3 · L4:4 · L5:1 · L6:4 · L8:3 · L10:2 · L12:2 |
| Cleric class feats | 23 | L1:4 · L2:4 · L4:4 · L6:3 · L8:3 · L10:3 · L12:2 |
| Rogue class feats | 23 | L1:5 · L2:3 · L4:4 · L6:3 · L8:3 · L10:3 · L12:2 |
| Barbarian class feats | 23 | L1:5 · L2:2 · L4:4 · L6:4 · L8:3 · L10:3 · L12:2 |
| Monk class feats | 21 | L1:4 · L2:3 · L4:4 · L6:3 · L8:3 · L10:2 · L12:2 |
| Sorcerer class feats | 24 | L1:4 · L2:3 · L4:4 · L5:1 · L6:4 · L8:3 · L10:3 · L12:2 |
| Warlock class feats | 23 | L1:3 · L2:4 · L4:5 · L6:3 · L8:3 · L10:3 · L12:2 |
| **General** (any class) | 23 | L1:10 · L2:2 · L4:4 · L6:3 · L7:1 · L8:2 · L12:1 |
| **Skill** (any class) | 20 | L1:8 · L2:4 · L4:4 · L6:3 · L8:1 |

⚠ **Ranger, Bard, and the three prestige classes have ZERO class feats authored.** Their progression tables are complete but their feat pools are empty — Ranger and Bard are post-launch in the bible, and the prestige classes were always stubs.

### The 15 skills

| Category | Skills |
|---|---|
| Physical | Athletics (STR) · Acrobatics (DEX) · Stealth (DEX) · Thievery (DEX) |
| Social | Diplomacy (CHA) · Intimidation (CHA) · Deception (CHA) · Performance (CHA) |
| Knowledge | Arcana (INT) · Religion (WIS) · Nature (WIS) · Medicine (WIS) |
| Practical | Crafting (INT) · Survival (WIS) · Perception (WIS) |

---


## Fighter

*Masters of martial combat.*  
The pure martial. No casting, full BAB, and **the only class in the registry with two class feats on even levels** — 30 class feat grants over 20 levels against everyone else's 10. Weapon training tiers at 5/9/13/17 and armour training at 11/15/19 are the identity.

| | |
|---|---|
| Role | martial |
| Hit die | d10 |
| Key ability | **STR** |
| Skill points/level | **3** + INT mod |
| Casting | — |
| Weapon proficiency | simple weapons, martial weapons |
| Class skills | Athletics, Acrobatics, Intimidation, Crafting, Survival, Perception |

**Proficiency tiers** (added on top of `floor(level/2)+1`):

| Stat | Tier gains by class level |
|---|---|
| Weapon attack | L1 trained · L5 expert · L13 master · L19 legendary |
| Fortitude | L1 trained · L3 expert · L11 master · L17 legendary |
| Reflex | L1 trained |
| Will | L1 trained · L9 expert |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +1 | +10 | 2/0/0 | **1** | · | **1** | · | attack_of_opportunity |
| 2 | +2 | +10 | 3/0/0 | **2** | **1** | · | **1** | — |
| 3 | +3 | +10 | 3/1/1 | **1** | · | · | · | bravery |
| 4 | +4 | +10 | 4/1/1 | **2** | **1** | · | **1** | — |
| 5 | +5 | +10 | 4/1/1 | **1** | · | **1** | · | weapon_training_1 |
| 6 | +6 | +10 | 5/2/2 | **2** | **1** | · | **1** | — |
| 7 | +7 | +10 | 5/2/2 | **1** | · | · | · | — |
| 8 | +8 | +10 | 6/2/2 | **2** | **1** | · | **1** | — |
| 9 | +9 | +10 | 6/3/3 | **1** | · | **1** | · | weapon_training_2 |
| 10 | +10 | +10 | 7/3/3 | **2** | **1** | · | **1** | — |
| 11 | +11 | +10 | 7/3/3 | **1** | · | · | · | armor_training |
| 12 | +12 | +10 | 8/4/4 | **2** | **1** | · | **1** | — |
| 13 | +13 | +10 | 8/4/4 | **1** | · | **1** | · | weapon_training_3 |
| 14 | +14 | +10 | 9/4/4 | **2** | **1** | · | **1** | — |
| 15 | +15 | +10 | 9/5/5 | **1** | · | · | · | armor_mastery |
| 16 | +16 | +10 | 10/5/5 | **2** | **1** | · | **1** | — |
| 17 | +17 | +10 | 10/5/5 | **1** | · | **1** | · | weapon_training_4 |
| 18 | +18 | +10 | 11/6/6 | **2** | **1** | · | **1** | — |
| 19 | +19 | +10 | 11/6/6 | **1** | · | · | · | armor_fortress |
| 20 | +20 | +10 | 12/6/6 | **2** | **1** | · | **1** | weapon_mastery |

### Class feats available, by level requirement

- **L1** (5): Double Slice · Power Attack · Reactive Strike · Shield Block · Sudden Charge
- **L2** (4): Aggressive Block · Brutish Shove · Combat Grab · Intimidating Strike
- **L4** (3): Knockdown · Lunge · Swipe
- **L6** (3): Blind-Fight · Dazing Blow · Parry
- **L8** (3): Disarming Twist · Improved Knockdown · Spring Attack
- **L10** (3): Combat Reflexes · Determination · Vigilant Shield
- **L12** (2): Desperate Finisher · Two-Weapon Flurry


## Barbarian

*Fierce warriors fueled by rage.*  
Rage is a resource ladder: 2 rounds at L1 climbing to 7 at L20, with greater rage at 11, tireless at 17, mighty at 20. Damage reduction at 7/10/13. d12 HP, the highest in the game. ⚠ Rage is one of the four wired toggles.

| | |
|---|---|
| Role | martial |
| Hit die | d12 |
| Key ability | **STR** |
| Skill points/level | **3** + INT mod |
| Casting | — |
| Weapon proficiency | simple weapons, martial weapons |
| Class skills | Athletics, Intimidation, Nature, Survival, Perception |

**Proficiency tiers** (added on top of `floor(level/2)+1`):

| Stat | Tier gains by class level |
|---|---|
| Weapon attack | L1 trained · L5 expert · L13 master · L20 legendary |
| Fortitude | L1 trained · L3 expert · L11 master · L17 legendary |
| Reflex | L1 trained |
| Will | L1 trained · L9 expert |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +1 | +12 | 2/0/0 | · | · | **1** | · | rage_2, fast_movement |
| 2 | +2 | +12 | 3/0/0 | **1** | **1** | · | **1** | rage_2, uncanny_dodge |
| 3 | +3 | +12 | 3/1/1 | · | · | · | · | rage_2, trap_sense |
| 4 | +4 | +12 | 4/1/1 | **1** | **1** | · | **1** | rage_3 |
| 5 | +5 | +12 | 4/1/1 | · | · | **1** | · | rage_3 |
| 6 | +6 | +12 | 5/2/2 | **1** | **1** | · | **1** | rage_3 |
| 7 | +7 | +12 | 5/2/2 | · | · | · | · | rage_3, damage_reduction_1 |
| 8 | +8 | +12 | 6/2/2 | **1** | **1** | · | **1** | rage_4 |
| 9 | +9 | +12 | 6/3/3 | · | · | **1** | · | rage_4 |
| 10 | +10 | +12 | 7/3/3 | **1** | **1** | · | **1** | rage_4, damage_reduction_2 |
| 11 | +11 | +12 | 7/3/3 | · | · | · | · | rage_4, greater_rage |
| 12 | +12 | +12 | 8/4/4 | **1** | **1** | · | **1** | rage_5 |
| 13 | +13 | +12 | 8/4/4 | · | · | **1** | · | rage_5, damage_reduction_3 |
| 14 | +14 | +12 | 9/4/4 | **1** | **1** | · | **1** | rage_5, indomitable_will |
| 15 | +15 | +12 | 9/5/5 | · | · | · | · | rage_5 |
| 16 | +16 | +12 | 10/5/5 | **1** | **1** | · | **1** | rage_6 |
| 17 | +17 | +12 | 10/5/5 | · | · | **1** | · | rage_6, tireless_rage |
| 18 | +18 | +12 | 11/6/6 | **1** | **1** | · | **1** | rage_6 |
| 19 | +19 | +12 | 11/6/6 | · | · | · | · | rage_6 |
| 20 | +20 | +12 | 12/6/6 | **1** | **1** | · | **1** | rage_7, mighty_rage |

### Class feats available, by level requirement

- **L1** (5): Furious Sprint · Rage · Reckless Abandon · Spirit Totem · Sudden Charge
- **L2** (2): Oversized Sweep · Vengeful Strike
- **L4** (4): Barreling Charge · Renewed Vigor · Shake It Off · Swipe
- **L6** (4): Furious Grab · No Escape · Terrifying Howl · Wounded Fury
- **L8** (3): Brutal Critical · Dragon Totem · Mighty Rage
- **L10** (3): Come and Get Me · Contagious Rage · Unrelenting Ferocity
- **L12** (2): Titanic Rage · Whirlwind Rage


## Monk

*Disciplined martial artists.*  
Unarmed damage steps 1d6 → 2d8 across 20 levels and speed climbs +0 → +60. Ki strike at 4, wholeness of body at 7, diamond body/soul at 11/13, quivering palm at 15, perfect self at 20. ⚠ The three Monk stances are wired toggles.

| | |
|---|---|
| Role | martial |
| Hit die | d8 |
| Key ability | **DEX** |
| Skill points/level | **4** + INT mod |
| Casting | — |
| Weapon proficiency | simple weapons; shortsword, unarmed |
| Class skills | Athletics, Acrobatics, Stealth, Religion, Perception |

**Proficiency tiers** (added on top of `floor(level/2)+1`):

| Stat | Tier gains by class level |
|---|---|
| Weapon attack | L1 trained · L5 expert · L13 master |
| Fortitude | L1 trained · L3 expert |
| Reflex | L1 trained · L3 expert · L11 master · L19 legendary |
| Will | L1 trained · L3 expert · L15 master · L19 legendary |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +0 | +8 | 2/2/2 | · | · | **1** | · | unarmed_1d6, flurry_of_blows, speed_+0 |
| 2 | +1 | +8 | 3/3/3 | **1** | **1** | · | **1** | unarmed_1d6, evasion, speed_+0 |
| 3 | +2 | +8 | 3/3/3 | · | · | · | · | unarmed_1d6, still_mind, speed_+10 |
| 4 | +3 | +8 | 4/4/4 | **1** | **1** | · | **1** | unarmed_1d8, ki_strike, speed_+10 |
| 5 | +3 | +8 | 4/4/4 | · | · | **1** | · | unarmed_1d8, purity_of_body, speed_+10 |
| 6 | +4 | +8 | 5/5/5 | **1** | **1** | · | **1** | unarmed_1d8, speed_+20 |
| 7 | +5 | +8 | 5/5/5 | · | · | · | · | unarmed_1d8, wholeness_of_body, speed_+20 |
| 8 | +6 | +8 | 6/6/6 | **1** | **1** | · | **1** | unarmed_1d10, speed_+20 |
| 9 | +6 | +8 | 6/6/6 | · | · | **1** | · | unarmed_1d10, improved_evasion, speed_+30 |
| 10 | +7 | +8 | 7/7/7 | **1** | **1** | · | **1** | unarmed_1d10, speed_+30 |
| 11 | +8 | +8 | 7/7/7 | · | · | · | · | unarmed_1d10, diamond_body, speed_+30 |
| 12 | +9 | +8 | 8/8/8 | **1** | **1** | · | **1** | unarmed_2d6, speed_+40 |
| 13 | +9 | +8 | 8/8/8 | · | · | **1** | · | unarmed_2d6, diamond_soul, speed_+40 |
| 14 | +10 | +8 | 9/9/9 | **1** | **1** | · | **1** | unarmed_2d6, speed_+40 |
| 15 | +11 | +8 | 9/9/9 | · | · | · | · | unarmed_2d6, quivering_palm, speed_+50 |
| 16 | +12 | +8 | 10/10/10 | **1** | **1** | · | **1** | unarmed_2d8, speed_+50 |
| 17 | +12 | +8 | 10/10/10 | · | · | **1** | · | unarmed_2d8, speed_+50 |
| 18 | +13 | +8 | 11/11/11 | **1** | **1** | · | **1** | unarmed_2d8, speed_+60 |
| 19 | +14 | +8 | 11/11/11 | · | · | · | · | unarmed_2d8, empty_body, speed_+60 |
| 20 | +15 | +8 | 12/12/12 | **1** | **1** | · | **1** | unarmed_2d8, perfect_self, speed_+60 |

### Class feats available, by level requirement

- **L1** (4): Flurry of Blows · Ki Strike · Monastic Weaponry · Refocus
- **L2** (3): Dancing Leaf · Deflect Arrow · Stunning Fist
- **L4** (4): Crane Stance · Stand Still · Tiger Stance · Wholeness of Body
- **L6** (3): Abundant Step · Mountain Stance · Wall Run
- **L8** (3): Diamond Soul · Quivering Palm · Timeless Body
- **L10** (2): Empty Body · Tongue of the Sun and Moon
- **L12** (2): Impossible Technique · Meditative Focus


## Rogue

*Skilled combatants who rely on cunning.*  
The skill class: **8 skill points per level**, more than double anyone else. Sneak attack steps every odd level to 10d6 at 19, evasion at 2, uncanny dodge at 4/8, advanced talents at 10, master strike at 20. ⚠ Sneak dice are wired and live in combat today.

| | |
|---|---|
| Role | skill |
| Hit die | d8 |
| Key ability | **DEX** |
| Skill points/level | **8** + INT mod |
| Casting | — |
| Weapon proficiency | simple weapons; rapier, shortsword, shortbow, hand_crossbow |
| Class skills | Acrobatics, Stealth, Thievery, Diplomacy, Deception, Performance, Perception |

**Proficiency tiers** (added on top of `floor(level/2)+1`):

| Stat | Tier gains by class level |
|---|---|
| Weapon attack | L1 trained · L5 expert · L13 master |
| Fortitude | L1 trained |
| Reflex | L1 trained · L3 expert · L11 master · L17 legendary |
| Will | L1 trained · L9 expert |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +0 | +8 | 0/2/0 | · | · | **1** | · | sneak_attack_1d6 |
| 2 | +1 | +8 | 0/3/0 | **1** | **1** | · | **1** | sneak_attack_1d6, evasion |
| 3 | +2 | +8 | 1/3/1 | · | · | · | · | sneak_attack_2d6, trap_sense |
| 4 | +3 | +8 | 1/4/1 | **1** | **1** | · | **1** | sneak_attack_2d6, uncanny_dodge |
| 5 | +3 | +8 | 1/4/1 | · | · | **1** | · | sneak_attack_3d6 |
| 6 | +4 | +8 | 2/5/2 | **1** | **1** | · | **1** | sneak_attack_3d6 |
| 7 | +5 | +8 | 2/5/2 | · | · | · | · | sneak_attack_4d6 |
| 8 | +6 | +8 | 2/6/2 | **1** | **1** | · | **1** | sneak_attack_4d6, improved_uncanny_dodge |
| 9 | +6 | +8 | 3/6/3 | · | · | **1** | · | sneak_attack_5d6 |
| 10 | +7 | +8 | 3/7/3 | **1** | **1** | · | **1** | sneak_attack_5d6, advanced_talents |
| 11 | +8 | +8 | 3/7/3 | · | · | · | · | sneak_attack_6d6 |
| 12 | +9 | +8 | 4/8/4 | **1** | **1** | · | **1** | sneak_attack_6d6 |
| 13 | +9 | +8 | 4/8/4 | · | · | **1** | · | sneak_attack_7d6 |
| 14 | +10 | +8 | 4/9/4 | **1** | **1** | · | **1** | sneak_attack_7d6 |
| 15 | +11 | +8 | 5/9/5 | · | · | · | · | sneak_attack_8d6 |
| 16 | +12 | +8 | 5/10/5 | **1** | **1** | · | **1** | sneak_attack_8d6 |
| 17 | +12 | +8 | 5/10/5 | · | · | **1** | · | sneak_attack_9d6 |
| 18 | +13 | +8 | 6/11/6 | **1** | **1** | · | **1** | sneak_attack_9d6 |
| 19 | +14 | +8 | 6/11/6 | · | · | · | · | sneak_attack_10d6 |
| 20 | +15 | +8 | 6/12/6 | **1** | **1** | · | **1** | sneak_attack_10d6, master_strike |

### Class feats available, by level requirement

- **L1** (5): Nimble Dodge · Quick Draw · Sneak Attack · Trap Finder · Tumble Through
- **L2** (3): Mobility · Poison Weapon · Twin Feint
- **L4** (4): Debilitating Strike · Gang Up · Skirmish Strike · Twist the Knife
- **L6** (3): Evasion · Preparation · Reactive Pursuit
- **L8** (3): Improved Evasion · Opportune Backstab · Sneak Savant
- **L10** (3): Entangle Blade · Hidden Blade · Master Strike
- **L12** (2): Cognitive Loophole · Impossible Sneak


## Ranger

*Wilderness warriors and trackers.*  
⚠ **Post-launch class** — the bible defers Ranger to avoid pet-class complexity at launch, but the progression table is fully authored (20 levels). Favored enemy at 1/5/10/15/20, combat style at 2, hunter's bond at 4, quarry at 11, hide in plain sight at 17.

| | |
|---|---|
| Role | martial |
| Hit die | d10 |
| Key ability | **DEX** |
| Skill points/level | **4** + INT mod |
| Casting | — |
| Weapon proficiency | simple weapons, martial weapons |
| Class skills | Athletics, Acrobatics, Stealth, Nature, Survival, Perception |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +1 | +10 | 2/2/0 | · | · | **1** | · | favored_enemy_1, track |
| 2 | +2 | +10 | 3/3/0 | **1** | **1** | · | **1** | combat_style |
| 3 | +3 | +10 | 3/3/1 | · | · | · | · | endurance |
| 4 | +4 | +10 | 4/4/1 | **1** | **1** | · | **1** | hunters_bond |
| 5 | +5 | +10 | 4/4/1 | · | · | **1** | · | favored_enemy_2 |
| 6 | +6 | +10 | 5/5/2 | **1** | **1** | · | **1** | — |
| 7 | +7 | +10 | 5/5/2 | · | · | · | · | — |
| 8 | +8 | +10 | 6/6/2 | **1** | **1** | · | **1** | swift_tracker |
| 9 | +9 | +10 | 6/6/3 | · | · | **1** | · | evasion |
| 10 | +10 | +10 | 7/7/3 | **1** | **1** | · | **1** | favored_enemy_3 |
| 11 | +11 | +10 | 7/7/3 | · | · | · | · | quarry |
| 12 | +12 | +10 | 8/8/4 | **1** | **1** | · | **1** | — |
| 13 | +13 | +10 | 8/8/4 | · | · | **1** | · | — |
| 14 | +14 | +10 | 9/9/4 | **1** | **1** | · | **1** | — |
| 15 | +15 | +10 | 9/9/5 | · | · | · | · | favored_enemy_4 |
| 16 | +16 | +10 | 10/10/5 | **1** | **1** | · | **1** | — |
| 17 | +17 | +10 | 10/10/5 | · | · | **1** | · | hide_in_plain_sight |
| 18 | +18 | +10 | 11/11/6 | **1** | **1** | · | **1** | — |
| 19 | +19 | +10 | 11/11/6 | · | · | · | · | — |
| 20 | +20 | +10 | 12/12/6 | **1** | **1** | · | **1** | favored_enemy_5, master_hunter |

### Class feats

**None authored.** Post-launch class — the level table is complete but the feat pool is empty.


## Wizard

*Scholarly masters of arcane magic.*  
Prepared arcane, spellbook acquisition. Arcane bond and spellbook at L1, bonus feats at 5/10/15, arcane supremacy at 20. Weakest BAB and d6 HP — this class lives or dies on positioning, which is exactly what `engageRange` was built for.

| | |
|---|---|
| Role | caster |
| Hit die | d6 |
| Key ability | **INT** |
| Skill points/level | **2** + INT mod |
| Casting | prepared · arcane list · **INT** |
| Weapon proficiency | dagger, dart, sling, staff, light_crossbow, crossbow |
| Class skills | Arcana, Religion, Nature, Crafting |

**Proficiency tiers** (added on top of `floor(level/2)+1`):

| Stat | Tier gains by class level |
|---|---|
| Weapon attack | L1 trained · L7 expert · L17 master |
| Spell attack | L1 trained · L7 expert · L15 master · L19 legendary |
| Spell DC | L1 trained · L7 expert · L15 master · L19 legendary |
| Fortitude | L1 trained |
| Reflex | L1 trained |
| Will | L1 trained · L3 expert · L11 master · L17 legendary |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +0 | +6 | 0/0/2 | · | · | **1** | · | arcane_bond, spellbook |
| 2 | +1 | +6 | 0/0/3 | **1** | **1** | · | **1** | — |
| 3 | +1 | +6 | 1/1/3 | · | · | · | · | — |
| 4 | +2 | +6 | 1/1/4 | **1** | **1** | · | **1** | — |
| 5 | +2 | +6 | 1/1/4 | · | · | **1** | · | bonus_feat |
| 6 | +3 | +6 | 2/2/5 | **1** | **1** | · | **1** | — |
| 7 | +3 | +6 | 2/2/5 | · | · | · | · | — |
| 8 | +4 | +6 | 2/2/6 | **1** | **1** | · | **1** | — |
| 9 | +4 | +6 | 3/3/6 | · | · | **1** | · | — |
| 10 | +5 | +6 | 3/3/7 | **1** | **1** | · | **1** | bonus_feat |
| 11 | +5 | +6 | 3/3/7 | · | · | · | · | — |
| 12 | +6 | +6 | 4/4/8 | **1** | **1** | · | **1** | — |
| 13 | +6 | +6 | 4/4/8 | · | · | **1** | · | — |
| 14 | +7 | +6 | 4/4/9 | **1** | **1** | · | **1** | — |
| 15 | +7 | +6 | 5/5/9 | · | · | · | · | bonus_feat |
| 16 | +8 | +6 | 5/5/10 | **1** | **1** | · | **1** | — |
| 17 | +8 | +6 | 5/5/10 | · | · | **1** | · | — |
| 18 | +9 | +6 | 6/6/11 | **1** | **1** | · | **1** | — |
| 19 | +9 | +6 | 6/6/11 | · | · | · | · | — |
| 20 | +10 | +6 | 6/6/12 | **1** | **1** | · | **1** | arcane_supremacy |

### Spell slots *(rows shown only when they change)*

| Lv | Cant | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 5 | 2 | — | — | — | — | — | — | — | — |
| 3 | 5 | 3 | 2 | — | — | — | — | — | — | — |
| 5 | 5 | 4 | 3 | 2 | — | — | — | — | — | — |
| 7 | 5 | 4 | 4 | 3 | 2 | — | — | — | — | — |
| 9 | 5 | 4 | 4 | 4 | 3 | 2 | — | — | — | — |
| 11 | 5 | 4 | 4 | 4 | 4 | 3 | 2 | — | — | — |
| 13 | 5 | 4 | 4 | 4 | 4 | 4 | 3 | 2 | — | — |
| 15 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 2 | — |
| 17 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 2 |
| 19 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 |

**Prepared / spellbook.** Wizard learns 2 free spells per level into a spellbook, plus scroll transcription (52 scroll rows exist in the item registry) — the exploration incentive the bible names explicitly.

### Class feats available, by level requirement

- **L1** (5): Arcane Bond · Counterspell · Eschew Materials · Familiar · Spell Blending
- **L2** (3): Reach Spell · Silent Spell · Spell Shield
- **L4** (4): Linked Focus · Protective Ward · Undisrupted Casting · Widen Spell
- **L5** (1): Touch Hit Specialization
- **L6** (4): Elemental Savant · Quickened Casting · Spell Redirection · Touch Damage Specialization
- **L8** (3): Scroll Savant · Spell Penetration · Superior Bond
- **L10** (2): Effortless Concentration · Overwhelming Energy
- **L12** (2): Metamagic Mastery · Spell Mastery


## Cleric

*Divine servants who channel their deity's power.*  
Prepared divine. Channel energy and a domain at L1, divine grace at 5, divine intervention at 9, divine avatar at 20. The registry's only healer — `Heal` is hard-coded into the founding muster for this reason.

| | |
|---|---|
| Role | caster |
| Hit die | d8 |
| Key ability | **WIS** |
| Skill points/level | **2** + INT mod |
| Casting | prepared · divine list · **WIS** |
| Weapon proficiency | simple weapons; warhammer |
| Class skills | Diplomacy, Intimidation, Religion, Medicine |

**Proficiency tiers** (added on top of `floor(level/2)+1`):

| Stat | Tier gains by class level |
|---|---|
| Weapon attack | L1 trained · L5 expert · L15 master |
| Spell attack | L1 trained · L5 expert · L13 master |
| Spell DC | L1 trained · L5 expert · L13 master |
| Fortitude | L1 trained · L3 expert |
| Reflex | L1 trained |
| Will | L1 trained · L3 expert · L11 master · L17 legendary |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +0 | +8 | 2/0/2 | · | · | **1** | · | channel_energy, domain |
| 2 | +1 | +8 | 3/0/3 | **1** | **1** | · | **1** | — |
| 3 | +2 | +8 | 3/1/3 | · | · | · | · | — |
| 4 | +3 | +8 | 4/1/4 | **1** | **1** | · | **1** | — |
| 5 | +3 | +8 | 4/1/4 | · | · | **1** | · | divine_grace |
| 6 | +4 | +8 | 5/2/5 | **1** | **1** | · | **1** | — |
| 7 | +5 | +8 | 5/2/5 | · | · | · | · | — |
| 8 | +6 | +8 | 6/2/6 | **1** | **1** | · | **1** | — |
| 9 | +6 | +8 | 6/3/6 | · | · | **1** | · | divine_intervention |
| 10 | +7 | +8 | 7/3/7 | **1** | **1** | · | **1** | — |
| 11 | +8 | +8 | 7/3/7 | · | · | · | · | — |
| 12 | +9 | +8 | 8/4/8 | **1** | **1** | · | **1** | — |
| 13 | +9 | +8 | 8/4/8 | · | · | **1** | · | — |
| 14 | +10 | +8 | 9/4/9 | **1** | **1** | · | **1** | — |
| 15 | +11 | +8 | 9/5/9 | · | · | · | · | — |
| 16 | +12 | +8 | 10/5/10 | **1** | **1** | · | **1** | — |
| 17 | +12 | +8 | 10/5/10 | · | · | **1** | · | — |
| 18 | +13 | +8 | 11/6/11 | **1** | **1** | · | **1** | — |
| 19 | +14 | +8 | 11/6/11 | · | · | · | · | — |
| 20 | +15 | +8 | 12/6/12 | **1** | **1** | · | **1** | divine_avatar |

### Spell slots *(rows shown only when they change)*

| Lv | Cant | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 5 | 2 | — | — | — | — | — | — | — | — |
| 3 | 5 | 3 | 2 | — | — | — | — | — | — | — |
| 5 | 5 | 4 | 3 | 2 | — | — | — | — | — | — |
| 7 | 5 | 4 | 4 | 3 | 2 | — | — | — | — | — |
| 9 | 5 | 4 | 4 | 4 | 3 | 2 | — | — | — | — |
| 11 | 5 | 4 | 4 | 4 | 4 | 3 | 2 | — | — | — |
| 13 | 5 | 4 | 4 | 4 | 4 | 4 | 3 | 2 | — | — |
| 15 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 2 | — |
| 17 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 2 |
| 19 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 |

**Prepared / full list.** The Cleric prepares from the entire divine list; no acquisition step.

### Class feats available, by level requirement

- **L1** (4): Domain Initiate · Harming Hands · Healing Hands · Turn Undead
- **L2** (4): Channel Smite · Emblazon Armament · Holy Castigation · Selective Energy
- **L4** (4): Communal Healing · Raise Symbol · Undisrupted Casting · Versatile Font
- **L6** (3): Aura of Faith · Defensive Ward · Directed Channel
- **L8** (3): Advanced Domain · Divine Fortress · Fast Healing
- **L10** (3): Greater Heal · Miraculous Spell · Shield of Grace
- **L12** (2): Divine Intervention · Eternal Blessing


## Sorcerer

*Innate spellcasters with bloodline powers.*  
Spontaneous arcane with **more slots than the prepared casters** (5/5/5… against 4/4/4) but a fixed repertoire. Bloodline chosen at L1 drives everything: powers at 1/7/13/19, granted spells at 3/9/15, apotheosis at 20.

| | |
|---|---|
| Role | caster |
| Hit die | d6 |
| Key ability | **CHA** |
| Skill points/level | **2** + INT mod |
| Casting | spontaneous · arcane list · **CHA** |
| Weapon proficiency | dagger, dart, sling, staff, light_crossbow, crossbow |
| Class skills | Intimidation, Deception, Arcana, Religion |

**Proficiency tiers** (added on top of `floor(level/2)+1`):

| Stat | Tier gains by class level |
|---|---|
| Weapon attack | L1 trained · L7 expert · L17 master |
| Spell attack | L1 trained · L5 expert · L13 master |
| Spell DC | L1 trained · L5 expert · L13 master |
| Fortitude | L1 trained |
| Reflex | L1 trained · L5 expert |
| Will | L1 trained · L3 expert · L11 master · L17 legendary |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +0 | +6 | 0/0/2 | · | · | **1** | · | bloodline, bloodline_power_1 |
| 2 | +1 | +6 | 0/0/3 | **1** | **1** | · | **1** | bloodline |
| 3 | +1 | +6 | 1/1/3 | · | · | · | · | bloodline, bloodline_spell_1 |
| 4 | +2 | +6 | 1/1/4 | **1** | **1** | · | **1** | bloodline |
| 5 | +2 | +6 | 1/1/4 | · | · | **1** | · | bloodline |
| 6 | +3 | +6 | 2/2/5 | **1** | **1** | · | **1** | bloodline |
| 7 | +3 | +6 | 2/2/5 | · | · | · | · | bloodline, bloodline_power_2 |
| 8 | +4 | +6 | 2/2/6 | **1** | **1** | · | **1** | bloodline |
| 9 | +4 | +6 | 3/3/6 | · | · | **1** | · | bloodline, bloodline_spell_2 |
| 10 | +5 | +6 | 3/3/7 | **1** | **1** | · | **1** | bloodline |
| 11 | +5 | +6 | 3/3/7 | · | · | · | · | bloodline |
| 12 | +6 | +6 | 4/4/8 | **1** | **1** | · | **1** | bloodline |
| 13 | +6 | +6 | 4/4/8 | · | · | **1** | · | bloodline, bloodline_power_3 |
| 14 | +7 | +6 | 4/4/9 | **1** | **1** | · | **1** | bloodline |
| 15 | +7 | +6 | 5/5/9 | · | · | · | · | bloodline, bloodline_spell_3 |
| 16 | +8 | +6 | 5/5/10 | **1** | **1** | · | **1** | bloodline |
| 17 | +8 | +6 | 5/5/10 | · | · | **1** | · | bloodline |
| 18 | +9 | +6 | 6/6/11 | **1** | **1** | · | **1** | bloodline |
| 19 | +9 | +6 | 6/6/11 | · | · | · | · | bloodline, bloodline_power_4 |
| 20 | +10 | +6 | 6/6/12 | **1** | **1** | · | **1** | bloodline, bloodline_apotheosis |

### Spell slots *(rows shown only when they change)*

| Lv | Cant | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 5 | 3 | — | — | — | — | — | — | — | — |
| 4 | 5 | 4 | 3 | — | — | — | — | — | — | — |
| 6 | 5 | 5 | 4 | 3 | — | — | — | — | — | — |
| 8 | 5 | 5 | 5 | 4 | 3 | — | — | — | — | — |
| 10 | 5 | 5 | 5 | 5 | 4 | 3 | — | — | — | — |
| 12 | 5 | 5 | 5 | 5 | 5 | 4 | 3 | — | — | — |
| 14 | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 3 | — | — |
| 16 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 3 | — |
| 18 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 3 |
| 20 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 4 |

**Spontaneous / repertoire + bloodline.** Bloodline grants fixed spells at 1/3/5/7/9 on top of the repertoire.

### Class feats available, by level requirement

- **L1** (4): Bloodline Focus · Dangerous Sorcery · Innate Surge · Magical Trickster
- **L2** (3): Blood Sacrifice · Cantrip Expansion · Reach Spell
- **L4** (4): Ancestral Blood Magic · Arcane Evolution · Empowered Evocation · Undisrupted Casting
- **L5** (1): Touch Hit Specialization
- **L6** (4): Blood Component · Crossblooded Evolution · Energetic Resonance · Touch Damage Specialization
- **L8** (3): Bloodline Wellspring · Greater Bloodline · Overwhelming Presence
- **L10** (3): Effortless Concentration · Greater Crossblooded · Metamagic Adept
- **L12** (2): Bloodline Ascendance · Sorcerous Fortitude


## Bard

*Performers who weave magic through art.*  
⚠ **Post-launch class** — deferred in the bible, fully authored here. Spontaneous occult casting plus bardic performance at every single level, with inspire courage/competence/greatness/heroics at 1/3/9/15 and deadly performance at 20.

| | |
|---|---|
| Role | hybrid |
| Hit die | d8 |
| Key ability | **CHA** |
| Skill points/level | **4** + INT mod |
| Casting | spontaneous · occult list · **CHA** |
| Weapon proficiency | simple weapons; longsword, rapier, shortsword, shortbow, whip |
| Class skills | Diplomacy, Deception, Performance, Arcana, Religion, Nature |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +0 | +8 | 0/2/2 | · | · | **1** | · | bardic_performance, inspire_courage |
| 2 | +1 | +8 | 0/3/3 | **1** | **1** | · | **1** | bardic_performance, versatile_performance |
| 3 | +2 | +8 | 1/3/3 | · | · | · | · | bardic_performance, inspire_competence |
| 4 | +3 | +8 | 1/4/4 | **1** | **1** | · | **1** | bardic_performance |
| 5 | +3 | +8 | 1/4/4 | · | · | **1** | · | bardic_performance, lore_master |
| 6 | +4 | +8 | 2/5/5 | **1** | **1** | · | **1** | bardic_performance |
| 7 | +5 | +8 | 2/5/5 | · | · | · | · | bardic_performance |
| 8 | +6 | +8 | 2/6/6 | **1** | **1** | · | **1** | bardic_performance, dirge_of_doom |
| 9 | +6 | +8 | 3/6/6 | · | · | **1** | · | bardic_performance, inspire_greatness |
| 10 | +7 | +8 | 3/7/7 | **1** | **1** | · | **1** | bardic_performance |
| 11 | +8 | +8 | 3/7/7 | · | · | · | · | bardic_performance |
| 12 | +9 | +8 | 4/8/8 | **1** | **1** | · | **1** | bardic_performance |
| 13 | +9 | +8 | 4/8/8 | · | · | **1** | · | bardic_performance |
| 14 | +10 | +8 | 4/9/9 | **1** | **1** | · | **1** | bardic_performance, frightening_tune |
| 15 | +11 | +8 | 5/9/9 | · | · | · | · | bardic_performance, inspire_heroics |
| 16 | +12 | +8 | 5/10/10 | **1** | **1** | · | **1** | bardic_performance |
| 17 | +12 | +8 | 5/10/10 | · | · | **1** | · | bardic_performance |
| 18 | +13 | +8 | 6/11/11 | **1** | **1** | · | **1** | bardic_performance, mass_suggestion |
| 19 | +14 | +8 | 6/11/11 | · | · | · | · | bardic_performance |
| 20 | +15 | +8 | 6/12/12 | **1** | **1** | · | **1** | bardic_performance, deadly_performance |

### Spell slots *(rows shown only when they change)*

| Lv | Cant | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 5 | 2 | — | — | — | — | — | — | — | — |
| 4 | 5 | 3 | 2 | — | — | — | — | — | — | — |
| 6 | 5 | 4 | 3 | 2 | — | — | — | — | — | — |
| 8 | 5 | 4 | 4 | 3 | 2 | — | — | — | — | — |
| 10 | 5 | 4 | 4 | 4 | 3 | 2 | — | — | — | — |
| 12 | 5 | 4 | 4 | 4 | 4 | 3 | 2 | — | — | — |
| 14 | 5 | 4 | 4 | 4 | 4 | 4 | 3 | 2 | — | — |
| 16 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 2 | — |
| 18 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 2 |
| 20 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 |

**Spontaneous / repertoire.** Fixed known set, cast into any slot of that rank.

### Class feats

**None authored.** Post-launch class — the level table is complete but the feat pool is empty.


## Warlock

*Pact casters who draw power from otherworldly patrons.*  
Pact casting — **no spell slots at all**. Pact energy is a pool that grows +2 per level (12 at L1 → 50 at L20) with regeneration climbing 2→6, and spells are bought out of it. Eldritch blast at L1, invocations at 2/5/7/9, pact boon at 3, mystic arcanum at 11/13/15, eldritch master at 17.

| | |
|---|---|
| Role | caster |
| Hit die | d8 |
| Key ability | **CHA** |
| Skill points/level | **3** + INT mod |
| Casting | pact_energy · pact list · **CHA** |
| Weapon proficiency | simple weapons |
| Class skills | Intimidation, Deception, Arcana, Religion |

**Proficiency tiers** (added on top of `floor(level/2)+1`):

| Stat | Tier gains by class level |
|---|---|
| Weapon attack | L1 trained · L5 expert · L15 master |
| Spell attack | L1 trained · L7 expert · L15 master · L19 legendary |
| Spell DC | L1 trained · L7 expert · L15 master · L19 legendary |
| Fortitude | L1 trained |
| Reflex | L1 trained · L5 expert |
| Will | L1 trained · L3 expert · L13 master · L19 legendary |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +0 | +8 | 2/0/2 | · | · | **1** | · | pact_magic, pact_energy_max_12, pact_energy_regen_2, eldritch_blast |
| 2 | +1 | +8 | 3/0/3 | **1** | **1** | · | **1** | pact_magic, pact_energy_max_14, pact_energy_regen_2, eldritch_invocation_1 |
| 3 | +1 | +8 | 3/1/3 | · | · | · | · | pact_magic, pact_energy_max_16, pact_energy_regen_2, pact_boon |
| 4 | +2 | +8 | 4/1/4 | **1** | **1** | · | **1** | pact_magic, pact_energy_max_18, pact_energy_regen_2 |
| 5 | +2 | +8 | 4/1/4 | · | · | **1** | · | pact_magic, pact_energy_max_20, pact_energy_regen_3, eldritch_invocation_2 |
| 6 | +3 | +8 | 5/2/5 | **1** | **1** | · | **1** | pact_magic, pact_energy_max_22, pact_energy_regen_3 |
| 7 | +3 | +8 | 5/2/5 | · | · | · | · | pact_magic, pact_energy_max_24, pact_energy_regen_3, eldritch_invocation_3 |
| 8 | +4 | +8 | 6/2/6 | **1** | **1** | · | **1** | pact_magic, pact_energy_max_26, pact_energy_regen_3 |
| 9 | +4 | +8 | 6/3/6 | · | · | **1** | · | pact_magic, pact_energy_max_28, pact_energy_regen_3, eldritch_invocation_4 |
| 10 | +5 | +8 | 7/3/7 | **1** | **1** | · | **1** | pact_magic, pact_energy_max_30, pact_energy_regen_4 |
| 11 | +5 | +8 | 7/3/7 | · | · | · | · | pact_magic, pact_energy_max_32, pact_energy_regen_4, mystic_arcanum_7 |
| 12 | +6 | +8 | 8/4/8 | **1** | **1** | · | **1** | pact_magic, pact_energy_max_34, pact_energy_regen_4 |
| 13 | +6 | +8 | 8/4/8 | · | · | **1** | · | pact_magic, pact_energy_max_36, pact_energy_regen_4, mystic_arcanum_8 |
| 14 | +7 | +8 | 9/4/9 | **1** | **1** | · | **1** | pact_magic, pact_energy_max_38, pact_energy_regen_4 |
| 15 | +7 | +8 | 9/5/9 | · | · | · | · | pact_magic, pact_energy_max_40, pact_energy_regen_5, mystic_arcanum_9 |
| 16 | +8 | +8 | 10/5/10 | **1** | **1** | · | **1** | pact_magic, pact_energy_max_42, pact_energy_regen_5 |
| 17 | +8 | +8 | 10/5/10 | · | · | **1** | · | pact_magic, pact_energy_max_44, pact_energy_regen_5, eldritch_master |
| 18 | +9 | +8 | 11/6/11 | **1** | **1** | · | **1** | pact_magic, pact_energy_max_46, pact_energy_regen_5 |
| 19 | +9 | +8 | 11/6/11 | · | · | · | · | pact_magic, pact_energy_max_48, pact_energy_regen_5 |
| 20 | +10 | +8 | 12/6/12 | **1** | **1** | · | **1** | pact_magic, pact_energy_max_50, pact_energy_regen_6, pact_apotheosis |

**Pact energy.** No slots — a regenerating pool. Costs: L1 6 · L2 10 · L3 15 · L4 21 · L5 28 · L6 36. Pact spells stop at rank 6; ranks 7–9 arrive as mystic arcanum at 11/13/15.

### Class feats available, by level requirement

- **L1** (3): Eldritch Sight · Fiendish Vigor · Pact Boon
- **L2** (4): Agonizing Blast · Armor of Shadows · Grasp of Hadar · Repelling Blast
- **L4** (5): Devil's Sight · Eldritch Invocation · Mire the Mind · Thirsting Blade · Undisrupted Casting
- **L6** (3): Otherworldly Leap · Shadow Step · Sign of Ill Omen
- **L8** (3): Lifedrinker · Relentless Hex · Tomb of Levistus
- **L10** (3): Dark One's Luck · Master of Hexes · Minions of Chaos
- **L12** (2): Chains of Carceri · Witch Sight


## Arcane Trickster *(prestige)*

*Rogues who blend stealth with arcane magic.*  
**Prestige, 10 levels.** Rogue 4 + Acrobatics 4 + Thievery 4 + level-2 arcane casting. Sneak attack +1d6 per two levels stacked on top of the parent class, and spell advancement every level.

| | |
|---|---|
| Role | hybrid |
| Hit die | d6 |
| Key ability | **DEX** |
| Skill points/level | **4** + INT mod |
| Casting | spontaneous · arcane list · **INT** |
| Weapon proficiency | simple weapons; rapier, shortsword, shortbow, hand_crossbow |
| Class skills | Acrobatics, Stealth, Thievery, Deception, Arcana |
| **Prerequisites** | Rogue 4 (class level) · Acrobatics 4 (skill rank) · Thievery 4 (skill rank) · arcane 2 (spell level) |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +0 | +6 | 0/2/0 | · | · | **1** | · | sneak_attack_+1d6, spell_advancement |
| 2 | +1 | +6 | 0/3/0 | **1** | · | · | **1** | sneak_attack_+1d6, spell_advancement |
| 3 | +1 | +6 | 1/3/1 | · | · | · | · | sneak_attack_+2d6, spell_advancement |
| 4 | +2 | +6 | 1/4/1 | **1** | · | · | **1** | sneak_attack_+2d6, spell_advancement |
| 5 | +2 | +6 | 1/4/1 | · | · | **1** | · | sneak_attack_+3d6, spell_advancement |
| 6 | +3 | +6 | 2/5/2 | **1** | · | · | **1** | sneak_attack_+3d6, spell_advancement |
| 7 | +3 | +6 | 2/5/2 | · | · | · | · | sneak_attack_+4d6, spell_advancement |
| 8 | +4 | +6 | 2/6/2 | **1** | · | · | **1** | sneak_attack_+4d6, spell_advancement |
| 9 | +4 | +6 | 3/6/3 | · | · | **1** | · | sneak_attack_+5d6, spell_advancement |
| 10 | +5 | +6 | 3/7/3 | **1** | · | · | **1** | sneak_attack_+5d6, spell_advancement |

### Class feats

**None authored.** Prestige stub — advancement comes from features, not feats.


## Eldritch Knight *(prestige)*

*Fighters who wield sword and spell.*  
**Prestige, 10 levels.** Fighter 5 + Arcana 3 + level-2 arcane casting. Spell advancement on nine of ten levels, spell critical at 3, a bonus fighter feat at 5, spell mastery at 10.

| | |
|---|---|
| Role | hybrid |
| Hit die | d10 |
| Key ability | **STR** |
| Skill points/level | **2** + INT mod |
| Casting | prepared · arcane list · **INT** |
| Weapon proficiency | simple weapons, martial weapons |
| Class skills | Athletics, Intimidation, Arcana, Crafting |
| **Prerequisites** | Fighter 5 (class level) · Arcana 3 (skill rank) · arcane 1 (spell level) |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +1 | +10 | 2/0/0 | · | · | **1** | · | spell_advancement |
| 2 | +2 | +10 | 3/0/0 | **1** | · | · | **1** | spell_advancement |
| 3 | +3 | +10 | 3/1/1 | · | · | · | · | spell_critical |
| 4 | +4 | +10 | 4/1/1 | **1** | · | · | **1** | spell_advancement |
| 5 | +5 | +10 | 4/1/1 | · | · | **1** | · | spell_advancement, fighter_feat |
| 6 | +6 | +10 | 5/2/2 | **1** | · | · | **1** | spell_advancement |
| 7 | +7 | +10 | 5/2/2 | · | · | · | · | spell_advancement |
| 8 | +8 | +10 | 6/2/2 | **1** | · | · | **1** | spell_advancement |
| 9 | +9 | +10 | 6/3/3 | · | · | **1** | · | spell_advancement |
| 10 | +10 | +10 | 7/3/3 | **1** | · | · | **1** | spell_mastery |

### Class feats

**None authored.** Prestige stub — advancement comes from features, not feats.


## Mystic Theurge *(prestige)*

*Masters of both arcane and divine magic.*  
**Prestige, 10 levels.** Requires both arcane and divine casting. Dual spell advancement on every level, spell synthesis at 10 — advances *two* casting classes at once.

| | |
|---|---|
| Role | caster |
| Hit die | d6 |
| Key ability | **WIS** |
| Skill points/level | **2** + INT mod |
| Casting | prepared · divine list · **WIS** |
| Weapon proficiency | simple weapons; warhammer |
| Class skills | Arcana, Religion, Nature, Medicine |
| **Prerequisites** | arcane 2 (spell level) · divine 2 (spell level) |

### Level table

| Lv | BAB | HP | Fort/Ref/Will | Class feat | Gen | Anc | Skill | Class features |
|---|---|---|---|---|---|---|---|---|
| 1 | +0 | +6 | 0/0/2 | · | · | **1** | · | dual_spell_advancement |
| 2 | +1 | +6 | 0/0/3 | · | · | · | **1** | dual_spell_advancement |
| 3 | +1 | +6 | 1/1/3 | · | · | · | · | dual_spell_advancement |
| 4 | +2 | +6 | 1/1/4 | · | · | · | **1** | dual_spell_advancement |
| 5 | +2 | +6 | 1/1/4 | · | · | **1** | · | dual_spell_advancement |
| 6 | +3 | +6 | 2/2/5 | · | · | · | **1** | dual_spell_advancement |
| 7 | +3 | +6 | 2/2/5 | · | · | · | · | dual_spell_advancement |
| 8 | +4 | +6 | 2/2/6 | · | · | · | **1** | dual_spell_advancement |
| 9 | +4 | +6 | 3/3/6 | · | · | **1** | · | dual_spell_advancement |
| 10 | +5 | +6 | 3/3/7 | · | · | · | **1** | dual_spell_advancement, spell_synthesis |

### Class feats

**None authored.** Prestige stub — advancement comes from features, not feats.

---

## Appendix A — General feats (any class, 23)

- **L1** (10): Adopted Ancestry · Armor Proficiency · Fleet · Great Fortitude · Iron Will · Lightning Reflexes · Shield Proficiency · Toughness · Weapon Finesse · Weapon Proficiency
- **L2** (2): Combat Medic · Skill Focus
- **L4** (4): Ancestral Paragon · Diehard · Improved Initiative · Untrained Improvisation
- **L6** (3): Canny Acumen · Expeditious Search · Fast Recovery
- **L7** (1): Weapon Specialization
- **L8** (2): Incredible Initiative · Incredible Investiture
- **L12** (1): Greater Weapon Specialization

## Appendix B — Skill feats (any class, 20)

- **L1** (8): Assurance (Arcana) · Assurance (Athletics) · Assurance (Medicine) · Assurance (Stealth) · Battle Medicine · Courtly Graces · Intimidating Glare · Titan Wrestler
- **L2** (4): Cat Fall · Experienced Smuggler · Quick Coercion · Steady Balance
- **L4** (4): Continual Recovery · Powerful Leap · Quiet Allies · Ward Medic
- **L6** (3): Cloud Jump · Terrified Retreat · Wall Jump
- **L8** (1): Unified Theory

## Appendix C — The spell library (218 rows)

Spells are tagged with a **comma-joined tradition list**, so one row can serve several classes.

| Tradition | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| arcane | 11 | 22 | 16 | 23 | 21 | 14 | 11 | 6 | 8 | 4 | **136** |
| divine | 8 | 11 | 12 | 12 | 8 | 9 | 5 | 7 | 2 | 2 | **76** |
| occult | 7 | 13 | 10 | 10 | 8 | 3 | 2 | 2 | 2 | 1 | **58** |
| pact | — | 6 | 4 | 4 | 3 | 3 | 3 | — | — | — | **23** |
| alchemical | 12 | — | — | — | — | — | — | — | — | — | **12** |

*(Counts overlap — an `arcane,occult` spell is counted in both rows. Alchemical rank-0 rows are the 12 consumable spells.)*

**By effect type:** damage 58 · buff 52 · debuff 44 · utility 40 · healing 20 · summon 4

⚠ **`resolveCast` handles only `damage` and `healing` — 140 of 218 spells are inert** (buff 52, debuff 44, utility 40, summon 4). Flagged by brief #21 as its own workstream.

**Found spells:** 12 rows are flagged `is_found_spell` — exploration-only acquisition, each with an authored rationale. Cloudkill · Dispel Magic · False Life · Feather Fall · Globe of Invulnerability · Grease · Nondetection · See Invisibility · Stoneskin · Telekinesis · Ventriloquism · Web

**Cantrips:** 27 rank-0 rows; 2 are flagged `default_cantrip` (one per tradition — this is what `assembleHero` auto-appends to every caster's loadout): Electric Arc (arcane) · Divine Lance (divine)

Cantrip scaling is authored per-spell in a `scaling` JSON column keyed by character level — e.g. Electric Arc: `{3: 2d4, 5: 1d6+2d4, 7: 3d4+1d6, 9: 4d4+1d6}`. This is Guild Vigil's answer to PF2E's auto-heightening, and it is **already read by the sim**.

## Appendix D — Sorcerer bloodlines (8)

Chosen at level 1. Each grants a fixed spell at character levels **1, 3, 5, 7, 9** on top of the repertoire, plus bloodline powers at 1/7/13/19 and apotheosis at 20.

| Bloodline | Type | Element | Granted spells (L1 · L3 · L5 · L7 · L9) |
|---|---|---|---|
| Black Dragon | draconic | acid | Draconic Ray · Draconic Resistance · Draconic Breath · Dragon Form · Draconic Storm |
| Silver/White Dragon | draconic | cold | Draconic Ray · Draconic Resistance · Draconic Breath · Dragon Form · Draconic Storm |
| Gold/Red Dragon | draconic | fire | Draconic Ray · Draconic Resistance · Draconic Breath · Dragon Form · Draconic Storm |
| Blue/Bronze Dragon | draconic | electricity | Draconic Ray · Draconic Resistance · Draconic Breath · Dragon Form · Draconic Storm |
| Green Dragon | draconic | poison | Draconic Ray · Draconic Resistance · Draconic Breath · Dragon Form · Draconic Storm |
| Summer Court | fae | fire | Fae Glamour · Enthralling Presence · Fae Step · Court's Favor · Sovereign's Command |
| Twilight Court | fae | — | Fae Glamour · Enthralling Presence · Fae Step · Court's Favor · Sovereign's Command |
| Winter Court | fae | cold | Fae Glamour · Enthralling Presence · Fae Step · Court's Favor · Sovereign's Command |

The five draconic bloodlines share the same **spell shells** (Draconic Ray → Resistance → Breath → Dragon Form → Storm) with the damage type swapped; the three fae courts share Fae Glamour → Enthralling Presence → Fae Step → Court's Favor → Sovereign's Command. That is a deliberate content-efficiency pattern worth preserving: **8 bloodlines from 10 authored spells.**

## Appendix E — The Warlock's pact economy

The Warlock is the only class with **no spell slots at all**. It carries a regenerating pool.

| Class level | Pact energy max | Regen | Feature |
|---|---|---|---|
| 1 | 12 | 2 | eldritch_blast |
| 2 | 14 | 2 | eldritch_invocation_1 |
| 3 | 16 | 2 | pact_boon |
| 4 | 18 | 2 | — |
| 5 | 20 | 3 | eldritch_invocation_2 |
| 6 | 22 | 3 | — |
| 7 | 24 | 3 | eldritch_invocation_3 |
| 8 | 26 | 3 | — |
| 9 | 28 | 3 | eldritch_invocation_4 |
| 10 | 30 | 4 | — |
| 11 | 32 | 4 | mystic_arcanum_7 |
| 12 | 34 | 4 | — |
| 13 | 36 | 4 | mystic_arcanum_8 |
| 14 | 38 | 4 | — |
| 15 | 40 | 5 | mystic_arcanum_9 |
| 16 | 42 | 5 | — |
| 17 | 44 | 5 | eldritch_master |
| 18 | 46 | 5 | — |
| 19 | 48 | 5 | — |
| 20 | 50 | 6 | pact_apotheosis |

**Spell costs out of the pool:** rank 1 = **6** · rank 2 = **10** · rank 3 = **15** · rank 4 = **21** · rank 5 = **28** · rank 6 = **36**.

So a level-1 Warlock (12 energy) gets **two** rank-1 casts; a level-20 Warlock (50) gets one rank-6 cast plus a rank-1, or eight rank-1s. The pact list stops at rank 6 — ranks 7/8/9 arrive as **mystic arcanum** at levels 11/13/15. `canAfford` in `combat/loadout.ts` already implements the pact branch, and `assembleHero` converts the (empty) slot table into energy via this cost curve.

## Appendix F — Prestige prerequisites

| Class | Requirements |
|---|---|
| Arcane Trickster | **Rogue 4** (class level) · **Acrobatics 4** (skill rank) · **Thievery 4** (skill rank) · **arcane 2** (spell level) |
| Eldritch Knight | **Fighter 5** (class level) · **Arcana 3** (skill rank) · **arcane 1** (spell level) |
| Mystic Theurge | **arcane 2** (spell level) · **divine 2** (spell level) |

⚠ Prestige prerequisites are marked **Change** in the decision ledger — they were *stubbed* in Godot and are only partially enforced today (`checkClassEligibility` enforces the key-ability ≥13 gate and the caps, but **does not read `class_prerequisites` at all**). Twelve prerequisite rows exist and nothing reads them.

---

## Appendix G — design intent recovered from the frozen Godot repo

Mined 2026-09-09 from `C:\GuildVigil` (frozen, superseded). These are **design decisions and
rationale** that never made it into the TS repo's docs. Where the Godot spec and this codebase
disagree, this codebase wins — but the *reasoning* below is still the best record of why the
numbers are what they are.

### G1. The level-up wizard was a 7-step flow

`spec_multiclass_levelup_v3.md` (APPROVED 2026-04-12) defines steps 0-6:

| Step | Name | Condition |
|---|---|---|
| 0 | **Ability boost** | only at character level 5/10/15/20 |
| 1 | Class picker | always |
| 2 | HP | always — roll the hit die, or take average (d6->4, d8->5, d10->6, d12->7) |
| 3 | Skills | always |
| 4 | Feats | always |
| 5 | Spells | only if the leveling class has a `casting_stat` |
| 6 | Summary | always |

**Boost at step 0 is the whole point of the ordering** — it lets a CHA-12 hero boost to 14 and
qualify for Sorcerer in the *same* level-up, and it makes an INT boost raise that level's skill
points. Both nuances are preserved in our `applyLevelUp`.

The class picker had three sections: **Your Classes** (sorted by `order_taken`, showing "Lv X -> X+1")
/ **Available** (meets prereqs, showing "(N slots remaining)") / **Locked** (greyed at opacity 0.45,
red text "Requires [STAT] 13 (current: N)"). Double-click selects and continues. When the 5-class cap
is hit, Available is replaced by "Class Limit Reached". That is a good spec for our level-up tab.

### G2. Character level vs class level — the governing principle

| Character level drives | Class level drives |
|---|---|
| Ancestry feats (1/5/9/13/17) | Class feats |
| Ability boosts (5/10/15/20) | Class features |
| Skill feats, general feats, skill increases | **All proficiency tier advancement** |
| Content access gates | Spell slots |
| `base_proficiency = level/2 + 1` | Weapon Spec (CL7) / Greater (CL12) |
| **The skill rank cap** | Anything scaling "per class level" |

The skill-rank-cap rule was an explicit fix: it caps on **character** level, so a Fighter 2 /
Barbarian 1 may put 3 ranks in a skill. We implement this.

### G3. Multiclass rules as specced

- `MAX_CLASSES = 5`, prestige included. Rationale: allow creative builds while "preventing
  degenerate 'dip every class for L1 features' strategies."
- **No minimum character level to multiclass** — v3 explicitly removed v1's "character level 2+"
  requirement. A level-2 hero may immediately take a second class.
- Ability prereq is **13+ in the new class's key ability**, and there is **no "out" gate** — you
  never need 13 in the class you are leaving.
- Adding a class grants the full level-1 package: all its L1 skill proficiencies, all its
  `features` auto-grants, and any L1 bonus feat. A multiclassed caster gets **fresh L1 slots and
  cantrips as a separate pool**.
- Multiclass weapon access resolves to the **single most-permissive class** (category = 100,
  specific weapon = 1). Wizard 10 / Fighter 2 gets Fighter's full martial access.
- Duplicate class features: v1 wanted "upgrade if possible" (Evasion -> Improved Evasion);
  **v3 replaced this with silently discard + log**, upgrades deferred past level 20.
- Sneak Attack is specced as **additive across SA-granting classes**, but was coded Rogue-only
  because Arcane Trickster is the only other source and it was never built.

### G4. The proficiency tier system and its class identities

`class_proficiency_tiers` (112 rows = 8 launch classes x 6 stats) is the *authoritative* stat
system; the `bab`/`fort_save`/`ref_save`/`will_save` columns on `class_progression` were declared
**dead data for heroes**, kept only because enemies still read flat values.

Tier bonuses: **Trained +0 / Expert +2 / Master +4 / Legendary +6**, on top of
`base_proficiency = character_level / 2 + 1`, keeping the **highest** tier per stat across classes.

**Weapon attack, stated as identity:** martials reach Master at 13, half-casters at 15, full
casters at 17 — and **only Fighter (19) and Barbarian (20) reach Legendary**, the Barbarian late
because "full commitment required."

**Legendary save identity:** Fortitude = Fighter/Barbarian · Reflex = Rogue/Monk · Will =
Wizard/Sorcerer/Cleric/Monk, with **Warlock at 19 — "borrowed power, earned late."**

The spec's own worked example, which is the clearest statement of the multiclass trade:
a **Fighter 10 / Rogue 10** at character 20 gets Fort 13 / Ref 13 / Will 13 (Rogue 10 misses its
Master-at-11 Reflex), against a **pure Fighter 20**'s Fort 17 / Ref 11 / Will 13. *"The multiclass
trades peak Fort for broad coverage."*

### G5. Combat numbers the spec fixed

- **Melee engagement bonus +2** to all melee attacks including touch spells; ranged gets nothing.
- **Non-proficient weapon use: -4 attack and no Weapon Specialization damage.**
- Fighter MAP is **-5/-10**; **Monk MAP is -4/-8** (agile unarmed).
- Weapon Specialization (CL7) = +2/+4/+6/+8 flat damage by tier; Greater (CL12) doubles it to
  +6/+8/+12. Only Fighter and Barbarian ever reach the Legendary row.
- Rogue Sneak Attack is **+1d6 per 2 class levels, max 10d6 at CL19** — expected ~38+ damage in a
  round where it fires against ~6 where it does not. That spread is the class.
- Barbarian Rage: +4 melee damage, temp HP, **-1 AC**, 2 uses per long rest, with the Rager feat
  adding +1 use at CL4/8/12/16/20 -> 7 total.
- **Focus points hard-capped at 3 globally**, excess silently discarded.
- Touch AC strips armour only: `10 + dex + base_proficiency + shield`. Touch spells get +1 damage
  die, +1 condition duration, +1 condition value.

### G6. Spell acquisition per casting type — the numbers

| Casting type | Classes | First entry (new class L1) | Per level after |
|---|---|---|---|
| prepared / spellbook | Wizard, Eldritch Knight | **5 picks** | **2** spells into the spellbook |
| prepared / divine | Cleric, Mystic Theurge | 0 | **0** — the whole divine list is preparable |
| spontaneous | Sorcerer, Bard, Arcane Trickster | **3 picks** | **1** known spell |
| pact energy | Warlock | **2 picks** | **1** pact spell |

Spell DC = `10 + casting_stat_mod + base_proficiency + tier_bonus + equipment`; spell attack is the
same without the 10. **Spell attack and spell DC deliberately share one tier table** — "Wizard is
the best at making spells land" is true for both.

Each casting class keeps a **separate pool**; there is no merging. Schema carried `class_id` into
`hero_spell_slots`, `hero_known_spells` and `hero_prepared_spells` for exactly this. Mystic
Theurge's pool-merging was specced as a class reward and **explicitly deferred**.

Cantrip scaling in the Godot build was a flat global ladder — **+1d4 at L3, +1d6 at L5, +2d4 at L7,
+3d4 at L9** — which our per-spell `scaling` JSON column supersedes.

### G7. The Warlock's pact economy — full rationale

The Godot doc calls this **"the single largest divergence from PF2E RAW"** and defends it at length.

- Hit die **d8**, not PF2E's d6: "fragile for a class that may use Eldritch Weapon in melee. d8
  aligns with D&D 5e Warlock."
- Spell list renamed from Occult to **`pact`** "to reinforce the patron-bond fantasy and keep the
  spell pool distinct from Sorcerer."
- Formulas: `max_energy = 10 + (class_level * 2) + CHA_mod`, `regen = 2 + floor(class_level / 5)`.
  ⚠ **The CHA term is in the spec but NOT in our data** — our `pact_energy_max_N` feature strings
  are flat (12 at L1 -> 50 at L20). If pact energy is ever wired, that is a decision to make
  consciously.
- Cost curve: `cost = spell_level * (spell_level + 5)`, "slightly superlinear so higher-level
  spells are proportionally more expensive, discouraging always-max-level casting."
- **Energy resets to full at combat start** and regenerates per turn.
- The output math, from the doc: at L1 with 12 max and +2 regen over a 6-round fight, that is
  `12 + 12 = 24` energy ~ **4 rank-1 casts** against PF2E's 2 slots. At L5 with 20 max and +3 regen
  over 8 rounds, `20 + 24 = 44` ~ two rank-3 + two rank-1 + cantrips — "roughly comparable total
  output, but flexible allocation."

Four stated reasons for the divergence, worth keeping because they are good ones:
**decision density** ("slot casting gives ~5 decisions per combat; energy gives a decision every
turn"), **differentiation from the Sorcerer** (who already owns spontaneous slots), **granular
invocation tuning** (versus PF2E's binary "at least 1 slot remaining" gate), and **the regen
fantasy** ("power flows continuously from the patron, not in discrete packets").

**Pact Boon** is one permanent choice at selection: **Blade** (summon a 1d8 force weapon, CHA to
attack, scales with level) / **Tome** (2 bonus cantrips from any list) / **Chain** (familiar with
`hp = level*2`, `ac = 12 + level/2`, whose help action grants flanking).

**Eldritch Blast is no longer a feat.** A 2026-04-17 migration moved it to `spells.id 220` —
1d10 force, CHA-based, 2 actions, ranged — because Steven finalised the rule **"no feats apply to
cantrips"** and EB's feat interactions (Agonizing/Repelling Blast) made it a carve-out. It lives as
`spell_level 1` with `pact_energy_cost 0`; the convention is **NULL -> use the cost table, 0 ->
at-will, positive -> per-spell override**, and `is_at_will` is true *only* for an explicit 0.

⚠ **Two Warlock data problems inherited into our registries:** the pact list has **no rank-0
spells, so Warlocks have zero cantrips** (PF2E grants 5 + 1 patron); and **Pact Boon says
`level_req 1` while `class_progression` emits the `pact_boon` feature string at level 3** — the
auto-grant would fire at 3 while the feat advertises 1.

### G8. What the Godot build explicitly deferred

Recorded so nobody re-derives these as new ideas:

- **Prestige prerequisite checking and unlock UI** — seed data exists, no runtime gate was ever
  built. (Still true here: 12 `class_prerequisites` rows, read by nothing.)
- **Respec** — "full respec available at cost (gold or rare resource - amount TBD)", resets all
  class levels. Cost never decided. Our core-loop D4 promises it via a building service.
- **Ancestry feats** — the schema column, the `ancestry_id` field and the slot grants all exist;
  **zero ancestry feats were ever authored.** Our data confirms 0 rows.
- **Armour proficiency tiers** (Light/Medium/Heavy per class) — designed, deferred, never built.
- **All "II" feat versions** — every custom feat has a stub with `implemented: false`.
- **Spell metamagic feats** (Silent Spell, Widen Spell, Quickened Casting) — deferred in *all three*
  feat phases and never built.
- **Enemy AC retuning** — current enemy ACs were computed against *unbuffed* characters and were
  known to need a pass once magic weapons, stat belts and enchanted armour were in play. That pass
  never happened, and it is directly relevant to our re-tune.
- Classes Inventor / Druid / Paladin / Summoner — deferred. Ranger and Bard were *also* deferred
  but have full 20-level progressions seeded, which is why they show up complete in our tables with
  no feats and no proficiency-tier rows.

### G9. Content gaps in the feat catalogue, measured

From the Godot seed scripts (227 feats, matching our registry exactly):

- **115 of 227 feats carry `"implemented": false`** — just over half the catalogue was placeholder.
- **No feat exceeds `level_req 12`**, so levels 13-20 have no new feat content at all.
- **Skill feats stop at level 8** while skill slots keep arriving at 10 and 12.
- **Zero ancestry feats** against ancestry slots granted at 1/5/9/13/17.
- **`grants_spell_id` is unused on every row** — the feat-grants-a-spell path was specced twice and
  has no live data.
- Chains are shallow (mostly depth 2) and **hub-shaped**: Rage and Pact Boon are each prerequisites
  for several later feats. Only Reactive Strike -> Knockdown -> Improved Knockdown reaches depth 3.
- Auto-grants work by matching `feats.feature_key` against `class_progression.features`, and there
  are exactly **6**: Reactive Strike (Fighter 1), Rage (Barbarian 1), Sneak Attack (Rogue 1),
  Pact Boon (Warlock), Weapon Specialization (7), Greater Weapon Specialization (12).
- Prerequisite forms that actually appear: `{"feat": "<name>"}` and
  `{"skill_rank": {"<Skill>": N}}` (9 of the 20 skill feats). `spell_level` and `class_level`
  prereq types were planned and never implemented.

### G10. The feat-effect architecture's north star

The Godot brief's success criteria are worth adopting for our brief #25, because they are a good
test of whether the effect registry is actually data-driven:

> Adding a strike-plus-effect feat, a passive spell modifier, or a spell with conditions and
> targeting should each be **"a SQL insert, no code."** Only genuinely novel patterns
> (teleport, grapple, multi-target) should need new code.

`passive_modifier` at **52% of all feats** is why: one generic passive resolver keyed on a
`modifies` field carries half the catalogue. The applicator vocabulary was
`add_stat_mod_per_die` / `bonus_damage` / `extra_damage_die` / `push_on_hit` /
`apply_condition_on_hit` / `heal_on_kill`, and the scaling convention was
`{stat, value, scaling: flat | per_level | per_class_level}` — deliberately **not** an expression
evaluator. Our `featEffects.ts` already implements that scaling shape.
