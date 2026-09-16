# Brief #29 — Class specialization paths

**Status:** ✅ **SUPERSEDED BY ITS SELECTION** — Steven pared this to 33 paths on 2026-09-15.
**Read `29-approved-selection.md` for what was chosen and what it commits to.** This file is kept
for the full 79 and the per-path engine reasoning; it is NOT the current plan.
**Created:** 2026-09-15, from `SESSION-class-abilities.md` Phase 2.
**Depends on:** `class-abilities-phase1-findings.md` (the audit). Every ✅/🔸/🔴 below traces to it.

---

## 1. What you asked for

> *"We want abilities to be a series of choices that augment flavors of a class as the player's
> characters level up… Can you list the classes and propose 7 flavorful progression types for each
> class? Then we will pare that down to 3 to 5 options per class."*

**79 paths follow** — seven for each of the ten full classes, three for each prestige class (they
cap at level 10 and grant 5 class slots, so seven would be offering choices the career cannot
spend). **Your job is to strike four to six per class**, not to read the engine notes — those are
mine to worry about, and they are there only so a path you love does not turn out to cost six
months.

## 2. How to read the engine marks

The audit found 30 of 227 feats reach the engine, and only **18 express a class identity**. So a
path's cost is mostly "which hook does it need", and hooks are shared — one hook lights up many
paths at once.

| mark | meaning |
|---|---|
| ✅ | **Buildable now.** Uses feats that already work. Content authoring only. |
| 🔸 | **One existing hook.** A consumer already exists and must learn another verb. |
| 🔴 | **New system.** The engine has no model for the noun at all. |

⚠ **🔴 is not a veto.** Some of the best paths here are 🔴, and three 🔴 systems each unlock a dozen
feats already sitting in the database. It is a *sequencing* signal, not a rejection.

## 3. Two things the legacy repo already settled

Mining `C:\GuildVigil` as you suggested turned up two designs worth lifting wholesale:

**Your touch-damage wizard already exists — and it is already broken in the exact way the audit
describes.** `Touch Hit Specialization` and `Touch Damage Specialization` are authored *twice over*
(Wizard #219/#220, Sorcerer #222/#223), carry real `tier_table` scaling, pass the readiness gate,
and reach no consumer. Four feats, fully specified, doing nothing. The legacy repo also locked the
rule that makes the path coherent: **`range_type='touch'` means single-target melee-touch only** —
54 spells audited, zero mistagged. The path is designed; it needs one hook.

**Pact Boon is the shape you are describing, already worked out.** Legacy grants Warlocks a
level-1 choice of **Blade / Tome / Chain**, each with its own follow-on feats (Thirsting Blade and
Lifedrinker hang off Blade). That is a specialization path in everything but name, and two of its
feats are already authored in the web repo. I have used it as the Warlock's spine below.

---

## 4. The paths

### Fighter — STR · martial · 7 working feats (the best-supported class)

| # | Path | What the player gets | Engine |
|---|---|---|---|
| 1 | **Brawler** | Shove, trip and knock foes down; control where the fight happens. | ✅ Brutish Shove + Knockdown + Improved Knockdown all work |
| 2 | **Weapon Master** | Pick a weapon family and become frightening with it specifically. | 🔸 `weapon_spec` exists but has only 2 generic rows; needs per-family |
| 3 | **Bulwark** | Enemies that swing at your allies find you in the way instead. | 🔴 threat/taunt — nothing models it |
| 4 | **Shield Wall** | Your shield covers the man beside you, not just you. | 🔸 conditional AC layer (6 feats waiting) |
| 5 | **Executioner** | You finish hurt things. Critical hits bite far deeper. | 🔸 crit-hit rider (5 feats waiting) |
| 6 | **Vanguard** | Close the gap fast and land the first blow of every fight. | 🔸 new active verb — Sudden Charge, Lunge authored |
| 7 | **Warlord** | Allies near you fight steadier; you shout them back into line. | 🔴 aura system |

### Barbarian — STR · martial · 1 working feat (Rage)

⚠ **Your own example is here, and it is the single most concentrated fix in the game:** *all twelve*
Barbarian feats waiting on the stance/rage modifier layer are one hook. Rage works; nothing that
modifies rage works.

| # | Path | What the player gets | Engine |
|---|---|---|---|
| 1 | **Wounded Fury** | The closer to death you are, the harder you hit. | 🔸 stance/rage layer — **your example**; Wounded Fury authored |
| 2 | **Reckless** | Trade defence for offence while raging; AC drops, damage soars. | 🔸 same hook (`conditional_stat_mod`, 1 feat, no consumer) |
| 3 | **Totem: Dragon** | Your rage carries elemental fire into every swing. | 🔸 same hook — Dragon Totem authored |
| 4 | **Come and Get Me** | Invite the whole room to hit you, and punish each one that does. | 🔴 threat/taunt + retaliation (shares Fighter #3) |
| 5 | **Titan** | Grow in size and reach; sweep several foes at once. | 🔸 same hook — Titanic Rage, Oversized Sweep authored |
| 6 | **Unbreakable** | Refuse to fall — survive the blow that should have killed you. | 🔸 same hook + `survive_lethal_once` |
| 7 | **Terrifying** | Your howl breaks nerve; frightened foes fight worse. | 🔸 condition application — Terrifying Howl authored |

### Rogue — DEX · skirmisher · 4 working feats

⚠ All nine Rogue feats waiting on the flat-footed/sneak layer are one hook.

| # | Path | What the player gets | Engine |
|---|---|---|---|
| 1 | **Assassin** | Enormous opening strike; if they had not noticed you, they are finished. | 🔸 sneak layer — Hidden Blade, Preparation authored |
| 2 | **Debilitator** | Every sneak attack leaves the target slowed, weakened or bleeding. | 🔸 sneak layer — Debilitating Strike authored |
| 3 | **Poisoner** | Coat blades in venom that works long after the cut. | ✅ Poison Weapon works |
| 4 | **Duellist** | Slip attacks, counter, and never be where the blow lands. | ✅/🔸 Nimble Dodge works; Opportune Backstab needs reaction vocabulary |
| 5 | **Gang Fighter** | Deadly when flanking; you and an ally carve foes apart. | 🔸 sneak layer — Gang Up authored |
| 6 | **Scout** | Find the traps, read the room, open the dungeon safely. | ✅ Trap Finder works (only dungeon-layer feat in the game) |
| 7 | **Shadow** | Vanish mid-fight and reappear behind them. | 🔴 stealth-in-combat / exploration verbs |

### Monk — DEX/WIS · martial · 3 working feats (the three stances)

| # | Path | What the player gets | Engine |
|---|---|---|---|
| 1 | **Tiger** | Fast, bleeding claw strikes. | ✅ Tiger Stance works |
| 2 | **Crane** | Defensive flow — harder to hit, counter on the turn. | ✅ Crane Stance works |
| 3 | **Mountain** | Immovable; you trade speed for armour you do not wear. | ✅ Mountain Stance works |
| 4 | **Stunning Fist** | Strikes that rattle the brain and cost foes their turn. | 🔸 condition application — feat authored, reaches nothing |
| 5 | **Flurry** | A blur of strikes rather than one heavy blow. | 🔸 new active verb — Flurry of Blows authored |
| 6 | **Ki Channeler** | Spend inner focus for bursts of the impossible. | 🔴 focus points (8 feats waiting) |
| 7 | **Wind Walker** | Run walls, cross the room, strike and be gone. | 🔴 out-of-combat/movement verbs |

### Cleric — WIS · caster · 2 working feats

| # | Path | What the player gets | Engine |
|---|---|---|---|
| 1 | **Battle Priest** | Channel divine power through your weapon. | ✅ Channel Smite works |
| 2 | **Guardian** | Ward allies with shields of force before the blow lands. | ✅ Defensive Ward works |
| 3 | **Life Domain** | Heals land harder and spill over to everyone nearby. | 🔸 healing modifier layer (11 feats waiting) |
| 4 | **Undead Hunter** | Your healing burns undead; they flee from you. | 🔸 healing layer — Turn Undead, Holy Castigation authored |
| 5 | **Field Medic** | Patch wounds between fights, not just during them. | 🔴 long-rest persistence (7 feats waiting) |
| 6 | **Domain Caster** | Pick a god's domain and gain its signature spells. | 🔴 resource/focus pool — Domain Initiate authored |
| 7 | **Warpriest** | Heavy armour, real weapons, spells as support not centrepiece. | 🔴 character-build layer (proficiency changes) |

### Wizard — INT · prepared caster · 1 working feat

| # | Path | What the player gets | Engine |
|---|---|---|---|
| 1 | **Touch Specialist** | Close to melee and discharge spells by hand, for far more damage. | 🔸 spell-effect layer — **your example; 2 feats fully authored** |
| 2 | **Evoker** | Raw damage; your fire and lightning ignore resistance. | 🔸 spell-effect layer — Overwhelming Energy works-in-waiting |
| 3 | **Battlefield Controller** | Shape the floor — walls, slows, terrain that fights for you. | 🔴 spell geometry |
| 4 | **Spell Penetrator** | Beat resistant foes; your spells punch through wards. | ✅ Spell Penetration works (Wizard's only live feat) |
| 5 | **Safe Caster** | Cast in melee without being punished for it. | 🔸 spell-effect layer — Silent Spell, Undisrupted Casting authored |
| 6 | **Bonded Scholar** | An arcane bond lets you recall a spent spell once a day. | 🔴 spell-slot manipulation |
| 7 | **Metamagician** | Bend spells — wider, further, quicker. | 🔴 metamagic (2 feats) + geometry |

### Sorcerer — CHA · innate caster · **0 working feats**

| # | Path | What the player gets | Engine |
|---|---|---|---|
| 1 | **Touch Specialist** | The same melee-discharge fantasy, on a CHA chassis. | 🔸 spell-effect layer — **2 feats authored** |
| 2 | **Draconic Bloodline** | Your heritage shows: elemental damage and scaled hide. | 🔸 spell-effect layer (legacy named "Dragon Disciple" as prestige) |
| 3 | **Empowered Evoker** | Damage spells roll better; ones become something else. | 🔸 spell-effect layer — Empowered Evocation authored |
| 4 | **Dangerous Sorcery** | Bigger spells hit harder simply for being bigger. | 🔸 spell-effect layer — feat authored, inert |
| 5 | **Bloodline Focus** | A wellspring of innate power you spend and refill. | 🔴 resource/focus pool |
| 6 | **Crossblooded** | Two heritages, blended — off-list spells others cannot reach. | 🔴 character-build layer |
| 7 | **Presence** | Overwhelming force of personality; foes save worse against you. | 🔸 conditional save modifier |

### Warlock — CHA · pact caster · **0 working feats**

Spine lifted from legacy's Pact Boon (Blade / Tome / Chain) — paths 1–3.

| # | Path | What the player gets | Engine |
|---|---|---|---|
| 1 | **Pact of the Blade** | A summoned weapon; you fight in melee and drink life from kills. | 🔸 spell-effect layer — Thirsting Blade, Lifedrinker authored |
| 2 | **Pact of the Tome** | Borrowed cantrips from any tradition; breadth over depth. | 🔴 character-build layer |
| 3 | **Pact of the Chain** | A familiar that flanks for you and fetches trouble. | 🔴 summons/pets |
| 4 | **Blast Shaper** | Eldritch Blast becomes yours — harder, and it shoves. | 🔸 spell-effect layer — Agonizing/Repelling Blast authored |
| 5 | **Hexer** | Curse one enemy and everything you do to them lands worse. | 🔸 condition application — Relentless Hex, Mire the Mind authored |
| 6 | **Shadow Walker** | Step through darkness; see in it, move through it. | 🔴 out-of-combat verbs |
| 7 | **Patron's Favour** | Pact energy regenerates mid-fight; sustained pressure. | 🔴 resource pool (legacy designed this fully) |

### Ranger — DEX/WIS · **0 feats authored, 10 class slots granted**

⚠ Pure authoring gap — the engine is ready. Legacy deferred Ranger "to avoid pet class complexity",
so paths 1–5 deliberately avoid the pet.

| # | Path | What the player gets | Engine |
|---|---|---|---|
| 1 | **Hunter** | Mark one quarry; hit it more often than anything else. | 🔸 conditional damage layer |
| 2 | **Archer** | Ranged specialist — volleys, and no penalty firing into melee. | 🔸 `weapon_spec` per-family (shares Fighter #2) |
| 3 | **Two-Blade** | Twin weapons, fast paired strikes. | 🔸 new active verb (Two-Weapon Flurry authored for Fighter) |
| 4 | **Trapper** | Set snares before the fight; the room works for you. | 🔴 pre-combat placement |
| 5 | **Pathfinder** | Travel faster, spot ambushes, read the wilderness. | 🔴 out-of-combat verbs (dungeon layer exists — Trap Finder proves it) |
| 6 | **Beast Companion** | An animal that fights beside you. | 🔴 summons/pets (shares Warlock #3) |
| 7 | **Skirmisher** | Strike and withdraw before they can answer. | 🔸 new active verb (Skirmish Strike authored for Rogue) |

### Bard — CHA · **0 feats authored, 10 class slots granted**

| # | Path | What the player gets | Engine |
|---|---|---|---|
| 1 | **Inspirer** | Your song makes the whole party hit harder. | 🔴 aura system (shares Fighter #7) |
| 2 | **Dirge** | A song of despair; enemies near you fight worse. | 🔴 aura system (same hook, opposite sign) |
| 3 | **Loremaster** | Know things — better skills, and identify what you are facing. | ✅ skill_mod resolves generically; authoring only |
| 4 | **Battle Chanter** | Fight in the line while keeping the song going. | 🔸 spell-effect layer (sustained-while-acting) |
| 5 | **Charmer** | Talk foes out of fighting; turn one against the rest. | 🔴 charm/control |
| 6 | **Healer's Refrain** | Restorative music that patches the party between rooms. | 🔸 healing modifier layer |
| 7 | **Duellist-Poet** | Rapier and wit; finesse fighting with a CHA flavour. | ✅ Weapon Finesse-shaped; authoring only |

### The three prestige classes — **0 feats, 10 levels, 5 class slots (Mystic Theurge: 0)**

⚠ **These take 3 paths each, not 7.** They cap at level 10 and grant 5 class-feat slots, so a
7-path menu would be offering choices the career has no room to spend.

⚠ **Mystic Theurge is granted ZERO class-feat slots.** Proposing content for it means proposing
content with nowhere to land — it needs a progression decision from you before any path list is
meaningful. Listed below on the assumption you fix the schedule; struck if you do not.

| Class | Paths | Engine |
|---|---|---|
| **Arcane Trickster** | Spell-Thief (steal with magic) · Arcane Ambusher (spells trigger sneak attack) · Trapmaster (magical traps) | 🔸 sneak layer + spell-effect layer — both already needed elsewhere |
| **Eldritch Knight** | Spellblade (weapon carries the spell) · Warded Warrior (armour of force) · Counter-Mage (shut down enemy casters) | 🔸 spell-effect + conditional AC — shared hooks |
| **Mystic Theurge** | Dual Channel (arcane + divine in one turn) · Greater Healer · Anathema (divine magic that breaks arcane) | 🔴 blocked on progression schedule first |

---

## 5. What the hooks buy you

The paths above are not independent. **Six hooks carry 48 of the 79.** If you want a build order
rather than a wish list, this is it:

| hook | paths it unlocks | classes touched | feats revived |
|---|---|---|---|
| spell-effect modifier layer | 14 | Wizard, Sorcerer, Warlock, Bard, 2 prestige | 21 |
| stance/rage modifier layer | 5 | **Barbarian only** | 12 |
| flat-footed/sneak layer | 4 | Rogue, Arcane Trickster | 9 |
| new active verbs | 5 | Fighter, Monk, Rogue, Ranger | 17 |
| healing modifier layer | 3 | Cleric, Bard | 11 |
| threat/taunt (**new**) | 3 | Fighter, Barbarian | 0 authored |

⚠ **Note the last row.** Threat/taunt is the only hook here with *no* authored feats behind it — it
is pure new system, and it is what two of your three examples need. Everything else on this list
pays for itself by reviving content you have already written.

## 6. What I need from you

1. **Strike paths** until each class has 3–5. That is the ask; everything else follows.
2. **Mystic Theurge:** grant it class-feat slots, or cut it from this brief.
3. **Prestige classes at 3 paths each** — confirm, or tell me to give them 7 like the rest.
4. **One sequencing call, if you want to make it now:** the audit's separate finding is that the
   level-up picker currently offers 42 feats that do nothing (63% of what it shows). That is a
   small fix and independent of every path above. It can go first, last, or in parallel.

⚠ **Not deciding anything about ability content here.** Your sequence was list 7 → pare to 3–5 →
*then* model the abilities. This is step one.

---

## Summary

Seventy-nine paths — seven for each full class, three for each prestige class — each with a one-line
player pitch and a note on what the engine would need. Two of your examples turned out to be
already designed: the touch-damage wizard is authored twice over and inert, and legacy's Pact Boon
is the exact "specialization path" shape you described. Your third example, the damage-attracting
tank, is the one thing here with no authored content behind it at all.

- **Pare each class to 3–5 and I will model the abilities** — that is the only decision this brief needs.
- **Six hooks carry 48 of the 79 paths**, so choosing paths effectively chooses a build order.
- **Barbarian is the cheapest big win** — one hook revives 12 feats, all of them Barbarian, including your low-health example.
- **Mystic Theurge needs a progression fix first** — it is granted zero class-feat slots today.
- **Threat/taunt is the only pure-new-system hook** on the list, and two of your three examples need it.
