# Brief #31 — The 33 approved paths, modelled as abilities

**Status:** ⬅ AWAITING STEVEN'S APPROVAL. Design only; no path is re-opened, re-priced or re-derived.
**Written:** 2026-09-16, against `29-approved-selection.md` (settled 2026-09-15) and
`class-abilities-phase1-findings.md` (measured 2026-09-15, wins on every measured fact).
**Sequence:** list 7 per class → pare to 3–5 → **model the abilities** ⬅ you are here → implement.

**Time units.** `ENCOUNTER.attackIntervalTicks = 20`, so **1 action ≈ 20 ticks ≈ 2s**, 10 ticks/sec.
Every duration below is in ticks. Every active names an `actions:` cost, because without one each
active is strictly better than striking and the loadout choice is fake.

---

## 0. Read this first — what changed, and what did not

| | |
|---|---|
| **Implementation half** | ✅ **UNBLOCKED** — #30 landed at `afd3635`. The worktree is clean and the suite is green. |
| **Design half (this brief)** | ✅ Done — touches no source. |
| **The safe code task** | ✅ **SHIPPED** `b8d41c1`. See §6. |
| **D2, the long-rest tier** | ✅ **APPROVED AND BUILT** `78614f5`. See §1 D2 and §5. |

**The 33 paths are settled and are not re-argued here.** Two measurements below contradict a stated
assumption. Per the working rule each gets one line with a number, and then the brief carries on:

1. ⚠ **Seven paths have almost nothing to revive, not four.** The approved selection flags four
   (threat/taunt ×2, aura ×2). Measured: **Ranger and Bard have 0 authored class feats** (findings
   §5), so all 3 Ranger and all 4 Bard paths are near-pure authoring — they hold **25 of the 29 new
   rows in this brief**. The hooks those paths ride still revive feats, but for *other* classes.
2. ⚠ **Wizard Touch Specialist is already authored end-to-end, twice over.** Steven's own
   touch-damage wizard is `#220 Touch Damage Specialization`, with `#219 Touch Hit Specialization`
   beside it — full tier tables, no design work needed. See §3.6.

---

## 1. FIVE DECISIONS FOR STEVEN — numbered options, measured

Everything else in this brief is authoring. These five are yours.

### D1 — Ranger and Bard have nothing to reuse. Which order?

7 of 33 paths (21%) start from an empty pool. The other 26 average 3.4 reusable authored rows each.

| option | cost | effect |
|---|---|---|
| **1. Author them last** | 0 now | The 26 reuse-backed paths ship first; Ranger/Bard stay unplayable longest. They already are — both have 10 class slots and 0 feats. |
| **2. Author them first** | ~23 rows × 2 classes | Fixes the two *worst* classes, but every row is new design with no engine dividend and no existing numbers to copy. |
| **3. Author a 3-feat spine each, defer the rest** | ~6 rows × 2 | Both classes become *pickable* at the paths' levels; the long tail waits. |

**Measured tradeoff:** Ranger/Bard paths ride `weapon-family spec`, `active verbs` and `exploration`
— hooks worth 30 revived feats, **none of which belong to Ranger or Bard**. So building their hooks
pays Fighter, Monk and Rogue first regardless of which option you pick.

### D2 — Once-per-long-rest ✅ **APPROVED AND BUILT** (commit `78614f5`)

Steven's call, 2026-09-16: **build the system now.** Option 1 taken; the tier exists.

Three limiter tiers, and all three now exist. Cooldown-in-ticks and once-per-combat live on
`Combatant` and die with the encounter; once-per-long-rest lives on `HeroState.longRestUses` and
survives it, with `backfillLongRestUses` registered in the save chain.

⚠ **THE BOUNDARY IS THE DISPATCH, NOT THE DUNGEON ROOM.** `dungeon/dispatch.ts` already had a rest
and it declares itself SHORT (`explore.rested`, `package: 'short'`) — it heals a fraction of max HP
and is rationed by `PROFILES.roomsPerRestCharge`. Refreshing long-rest charges there would collapse
the third tier into the second. The long rest fires in `launchDispatch`, at the same moment the
wounded ratchet clears.

⚠ **Measured: the tier holds 10 authored feats, not the 8 counted by hand here.** Membership is
derived from the content payloads — both authored shapes (`condition: "per_rest"` and `per_rest: N`)
— so `#91 Arcane Bond` and `#103 Linked Focus` join the eight below. A new seed row joins with no
code change. **Absent map means fully rested**, so every existing save loads as a rested party.

The eight paths this unblocks are unchanged: Cleric Field Medic (`#140`, `#153`), Wizard
Metamagician (`#96`), Sorcerer Bloodline Focus (`#113`) and Crossblooded (`#119`), Warlock Pact of
the Tome (`#162` — note that one is a *short* rest and correctly stays outside the tier).

### D3 — Threat/taunt and aura revive nothing. They carry two of your three examples.

The selection already bought this deliberately. The modelling question is narrower: **threat needs a
number the engine does not have today.** Nothing in the sim models aggro; `runEncounter` picks
targets by proximity.

| option | how a taunt works | cost |
|---|---|---|
| **1. Forced retarget, N ticks** | The taunter becomes the target outright for 60 ticks (3 actions). Simple, readable, no new state beyond a timer. | smallest |
| **2. Threat score** | Each unit accrues threat; targeting sorts by it. Richer, but re-tunes *every* fight in the game. | largest |
| **3. Retarget with a save** | As 1, but Will negates. Fits PF2E, adds a save roll per taunt. | middle |

**Recommendation to react to, not a finished opinion:** option 1 is the only one that cannot move
the dungeon curve, because it changes *who* is hit and never *how often*.

### D4 — Barbarian's stance layer is the single biggest dividend. Confirm it goes first.

12 dead feats, **all 12 Barbarian**, all behind one modifier layer, and Barbarian is 0-of-4 playable.
No other hook turns one class from zero to whole in a single move. The approved selection's
suggested order puts spell-effect (21 feats, 3 classes) first instead.

| option | first hook | revives | classes made playable |
|---|---|---|---|
| **1. stance/rage** | `conditions.ts` | 12 | Barbarian 0→4 paths |
| **2. spell-effect** | `spells.ts` | 21 | Wizard +2, Warlock +2, Sorcerer's cheap add-back |
| **3. both, spell-effect first** | — | 33 | the selection's own §5 order |

### D5 — Two feats work but are flagged unimplemented. Offer them or not?

`#192 Courtly Graces` and `#193 Experienced Smuggler` carry `implemented: false` yet **are** read by
`resolveSkillMods` (findings §3, "the reverse error"). The picker fix I shipped keeps them greyed,
conservatively. Un-greying is a content-truth call: either the flag is wrong, or the rows are.

---

## 2. The reuse dividend, measured per path

Before the tables: **how much of this brief is already written.** Counting authored `feats` rows each
path revives, from the 197 that reach no engine code. ⚠ **These counts are PARSED back out of §3's
own tables, not retyped** — a hand-written first pass had every row wrong.

| class | paths | abilities reusing an authored row | new rows needed |
|---|---|---|---|
| Fighter | 3 | 14 | 1 |
| Barbarian | 4 | 15 | 1 |
| Rogue | 3 | 11 | 1 |
| Monk | 4 | 17 | 0 |
| Cleric | 3 | 13 | 0 |
| Wizard | 3 | 12 | 0 |
| Sorcerer | 3 | 11 | 1 |
| Warlock | 3 | 12 | 0 |
| **Ranger** | 3 | **1** | **11** |
| **Bard** | 4 | **2** | **14** |
| **total** | **33** | **108** (104 distinct feat ids) | **29** |

**108 of 137 abilities (79%) are authored rows with real numbers already in the database.** The
selection's "89 of 197 revived" holds and is conservative: this brief reaches **104 distinct feat
ids**, because several paths pull in general/skill rows (`#182 Titan Wrestler`, `#180 Battle
Medicine`, `#186 Ward Medic`, `#181 Intimidating Glare`) alongside their class feats.

⚠ **Strip Ranger and Bard and the reuse rate is 105 of 112 — 94%.** Those two classes hold 25 of the
29 new rows on their own. That is D1 in one number.

---

## 3. THE 33 PATHS

Legend: **#N** = revive this authored `feats` row, numbers as written. **NEW** = no authored row
exists. Hook names are the audit's.

### 3.1 Fighter — Brawler · Weapon Master · Bulwark

**Brawler** — *you win by moving people, not by out-damaging them.*

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 2 | Brutish Shove | **#9** | push 1 tile; on crit also flat-footed until end of your next turn | 1 | ✅ live |
| 2 | Combat Grab | **#13** | strike + grapple; grabbed blocks movement | 1 | condition application |
| 4 | Knockdown | **#5** | strike + free Athletics trip; trip uses MAP | 2 | ✅ live |
| 8 | Improved Knockdown | **#7** | as above, **no MAP**, auto-trip on crit strike | 2 | ✅ live |
| 1 | Titan Wrestler | **#182** | grapple creatures up to 2 size steps larger | — | condition application |

**Weapon Master** — *one weapon, mastered.*

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Power Attack | **#1** | +1 weapon damage die, counts as 2 strikes for MAP | 2 | ✅ live |
| 4 | Lunge | **#14** | reach +1 tile for this strike | 1 | new active verb |
| 7 | Weapon Specialization | **#211** | +2/+4/+6/+8 flat damage by proficiency tier | — | ✅ live |
| 12 | Greater Weapon Spec | **#212** | replaces above: +6/+8/+12 (expert/master/legendary) | — | ✅ live |
| 4 | Swipe | **#15** | one attack roll vs all adjacent enemies, counts as 1 attack | 2 | new active verb |

⚠ **Weapon-family specialisation is a hook this path needs and #211 does not provide.** #211 keys on
*proficiency tier*, not weapon family. "Master of axes specifically" needs `weaponSpecBonus` to read
a family. One line, flagged: that is **1 new matcher**, not a new system.

**Bulwark** — *the damage-attracting tank. Steven's example #1.*

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Shield Block | **#3** | reaction: reduce damage by shield hardness, 1/round | reaction | reaction vocabulary |
| 2 | Aggressive Block | **#12** | after a Shield Block: push 1 tile **or** flat-footed | — | reaction vocabulary |
| 6 | Parry | **#16** | +1 AC until your next action | 1 | conditional AC layer |
| 10 | Vigilant Shield | **#21** | your Shield Block may protect an adjacent ally | reaction | reaction vocabulary |
| 4 | **Taunt** | **NEW** | forced retarget for **60 ticks** (3 actions), 1 use / 120 ticks | 1 | 🔴 **threat/taunt** |

**Taunt is the only genuinely new row Fighter needs, and it is D3.**

### 3.2 Barbarian — Wounded Fury · Totem: Dragon · Come and Get Me · Titan

All four ride `#24 Rage` (live toggle: +2 damage, −1 AC, temp HP = level).

**Wounded Fury** — *the low-HP barbarian. Steven's example #3.*

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Reckless Abandon | **#25** | while raging: +1 attack, −1 AC | — | stance/rage layer |
| 4 | Renewed Vigor | **#28** | temp HP = level + CON mod, once per rage | 1 | stance/rage layer |
| 6 | Wounded Fury | **#40** | while raging **below 50% HP: +2 damage** | — | stance/rage layer |
| 10 | Unrelenting Ferocity | **#44** | survive one lethal blow at 1 HP, 1× per combat | — | stance/rage layer |

**Totem: Dragon**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Spirit Totem | **#34** | totem passive bonus (numbers need one authoring pass) | — | stance/rage layer |
| 6 | Terrifying Howl | **#29** | 6-tile emanation, Will save, fail → frightened 1 | 1 | condition application |
| 8 | Dragon Totem | **#41** | while raging: **+1d4 energy damage** on hits | — | stance/rage layer |
| 12 | Bloodline Ascendance equivalent | **NEW** | upgrade the 1d4 to 1d6 at L12 | — | stance/rage layer |

**Come and Get Me** — *Steven's example #1, barbarian flavour.*

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 2 | Vengeful Strike | **#36** | reaction: adjacent ally is hit → free strike, 1/round | reaction | reaction vocabulary |
| 6 | No Escape | **#32** | reaction: adjacent enemy moves away → stride to follow | reaction | ✅ authored, needs verb |
| 10 | Come and Get Me | **#43** | **stance**, while raging: `taunt_retaliate` | 1 | 🔴 **threat/taunt** |
| 4 | Barreling Charge | **#37** | charge + knockdown | 2 | new active verb |

⚠ **#43 is the one authored `stance` row that does not work** (findings §3) — it is the entire
threat/taunt hook expressed as content already waiting.

**Titan**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 2 | Oversized Sweep | **#35** | while raging: cleave adjacent | — | stance/rage layer |
| 4 | Swipe | **#27** | one roll vs all adjacent, counts as 1 attack | 2 | new active verb |
| 12 | Titanic Rage | **#45** | rage damage increase **and size step up** | — | stance/rage layer |
| 12 | Whirlwind Rage | **#46** | strike all in reach while raging | 3 | new active verb |

### 3.3 Rogue — Debilitator · Poisoner · Scout

Rogue is the closest to playable: **2 of 3 work today.** All ride `#68 Sneak Attack`
(ceil(level/2)d6 vs flat-footed, live).

**Debilitator**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 4 | Debilitating Strike | **#81** | sneak damage dealt → apply a debilitation | — | flat-footed/sneak layer |
| 4 | Twist the Knife | **#73** | sneak hit → **2 persistent bleed** | — | flat-footed/sneak layer |
| 10 | Entangle Blade | **#87** | sneak hit → immobilize target | — | flat-footed/sneak layer |
| 10 | Master Strike | **#88** | **maximised** sneak dice, 1× per combat | 1 | new active verb |

**Poisoner**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 2 | Poison Weapon | **#71** | next hit +1d4 poison; cooldown **40 ticks** | 1 | ✅ live |
| 4 | Twist the Knife | **#73** | +2 persistent bleed on sneak hit | — | flat-footed/sneak layer |
| 6 | **Potent Toxin** | **NEW** | Poison Weapon die 1d4 → **1d6** at L6, **1d8** at L11 | — | flat-footed/sneak layer |
| 8 | Sneak Savant | **#86** | sneak attack works at range up to 6 tiles | — | flat-footed/sneak layer |

⚠ **Poisoner is the thinnest Rogue path** — only #71 is poison-specific, so it needs the one NEW row
above to reach 4 abilities. Flagged, not argued.

**Scout**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Trap Finder | **#70** | thievery +1, perception +1, auto-detect adjacent traps | — | ✅ live |
| 4 | Gang Up | **#72** | target adjacent to you **and any ally** is flat-footed to you | — | flat-footed/sneak layer |
| 6 | Preparation | **#83** | designate a target flat-footed for round 1, 1× per combat | — | flat-footed/sneak layer |
| 10 | Hidden Blade | **#76** | **first strike of every combat** auto-flat-footed | — | flat-footed/sneak layer |

### 3.4 Monk — Mountain · Stunning Fist · Flurry · Ki Channeler

**Mountain** — the stance itself (**#58**) is live today.

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 6 | Mountain Stance | **#58** | unarmed 1d8 bludgeoning, **+2 AC, −1 speed** | 1 | ✅ live |
| 2 | Deflect Arrow | **#51** | reaction: reduce ranged damage by **level + 2** | reaction | reaction vocabulary |
| 8 | Diamond Soul | **#63** | **+2 saves vs magic** | — | conditional save modifier |
| 8 | Timeless Body | **#64** | immune sickened, enfeebled | — | condition application |

**Stunning Fist**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 2 | Stunning Fist | **#50** | crit with unarmed → stunned 1, Fort negates | — | condition application |
| 8 | Quivering Palm | **#54** | mark target, delayed damage | 2 | new active verb |
| 12 | Impossible Technique | **#66** | reroll one attack or save, 1× per combat | 0 | reaction vocabulary |
| 4 | Stand Still | **#52** | reaction: enemy moves adjacent → free unarmed strike, stops movement | reaction | reaction vocabulary |

**Flurry**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Flurry of Blows | **#47** | **2 unarmed strikes**, both at current MAP, MAP increments once | 1 | ✅ live |
| 4 | Tiger Stance | **#56** | unarmed 1d8 slashing, **+2 damage on first hit per turn** | 1 | ✅ live |
| 1 | Monastic Weaponry | **#59** | monk weapons count as unarmed (so Flurry works with them) | — | character-build layer |
| 12 | Two-Weapon Flurry equivalent | **#23** | triple strike (Fighter row; Monk needs its own) | 3 | new active verb |

**Ki Channeler** — the focus-pool path.

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Ki Strike | **#48** | +1d6 unarmed damage, **costs 1 focus** | 1 | 🔴 focus points |
| 1 | Refocus | **#49** | recover **1 focus** | 1 | 🔴 focus points |
| 4 | Wholeness of Body | **#61** | self-heal **level + WIS mod**, costs focus | 1 | 🔴 focus points |
| 10 | Empty Body | **#55** | invisible **20 ticks**, costs **2 focus**, 1× per combat | 2 | 🔴 focus points |
| 12 | Meditative Focus | **#67** | Refocus recovers **2** instead of 1 | — | 🔴 focus points |

### 3.5 Cleric — Life Domain · Undead Hunter · Field Medic

**Life Domain**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Healing Hands | **#133** | Heal die **d8 → d10** | — | healing modifier layer |
| 4 | Communal Healing | **#137** | healing another also heals you **50%** | — | healing modifier layer |
| 8 | Fast Healing | **#139** | all Heals restore **+2 per spell level** | — | healing modifier layer |
| 10 | Greater Heal | **#152** | **maximise the first die** of every Heal | — | healing modifier layer |

**Undead Hunter**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Turn Undead | **#134** | Heal damages undead for the heal amount; crit → fleeing | — | healing modifier layer |
| 1 | Harming Hands | **#143** | Harm die **→ d10** | — | spell-effect layer |
| 2 | Channel Smite | **#135** | melee strike + expend Heal/Harm slot, **+slot-level d6** | 2 | ✅ live |
| 2 | Holy Castigation | **#144** | divine spell cast → **+1 splash damage** | — | spell-effect layer |

**Field Medic** — ⚠ **the long-rest path. This is D2.**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Battle Medicine | **#180** | **2d8** heal, +1d8 per 4 levels, Medicine check | 1 | ✅ live-ish (skill feat) |
| 4 | Ward Medic | **#186** | Battle Medicine / Treat Wounds hits **+1 target** | — | healing modifier layer |
| 10 | Miraculous Spell | **#140** | **1× per long rest**: cast Heal with no slot | — | 🔴 **long-rest persistence** |
| 12 | Eternal Blessing | **#153** | **1× per long rest**: a Heal also removes a condition | — | 🔴 **long-rest persistence** |
| 12 | Divine Intervention | **#154** | reaction, **1× per combat**: ally hits 0 HP → emergency heal | reaction | reaction vocabulary |

### 3.6 Wizard — Touch Specialist · Spell Penetrator · Metamagician

**Touch Specialist** — ⚠ **AUTHORED TWICE OVER. This path needs no design at all.**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 4 | Undisrupted Casting | **#221** | casting provokes no reactions | — | spell-effect layer |
| 5 | Touch Hit Specialization | **#219** | **+2 attack at CL5, +4 at CL10** (tier table authored) | — | spell-effect layer |
| 6 | **Touch Damage Specialization** | **#220** | **+1d4 at CL6, +2d4 at CL11** (tier table authored) | — | spell-effect layer |
| 2 | Silent Spell | **#94** | spells do not trigger Reactive Strike | — | spell-effect layer |

> **THE FEAT ID BEING REVIVED IS `#220 Touch Damage Specialization`** — with `#219 Touch Hit
> Specialization` beside it, and **duplicate copies already authored for Sorcerer as `#222`/`#223`**.
> Steven's own touch-damage wizard exists in the database with complete tier tables. It reaches no
> engine code only because `passive_modifier` has no payload-shape consumer for `modifies:
> touch_spell_damage`. **This is one matcher on the spell-effect layer, not a design.**

**Spell Penetrator**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 8 | Spell Penetration | **#97** | **+2 spell attack, +1 spell DC** | — | ✅ live (`stat_mod`) |
| 10 | Overwhelming Energy | **#98** | ignore **5** energy resistance | — | spell-effect layer |
| 1 | Counterspell | **#93** | reaction: negate a prepared spell, expends the same slot | reaction | reaction vocabulary |
| 6 | Elemental Savant | **#105** | **+2** damage with chosen element | — | spell-effect layer |

**Metamagician** — ⚠ the selection's own flagged thinnest return. Recorded, not re-argued.

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 2 | Reach Spell | **#99** | **+6 tiles** range, costs **1 extra action** | +1 | 🔴 metamagic |
| 4 | Widen Spell | **#95** | AoE **+1** size, costs **1 extra action** | +1 | 🔴 metamagic |
| 6 | Quickened Casting | **#96** | **1× per rest**: spell costs 1 fewer action (min 1) | — | 🔴 metamagic + long-rest |
| 12 | Metamagic Mastery | **#111** | reduce metamagic cost | — | 🔴 metamagic |

⚠ **Quickened Casting (#96) needs long-rest persistence too** — so D2 is worth 8 feats, not 7.

### 3.7 Sorcerer — Bloodline Focus · Crossblooded · Presence

⚠ **The costliest class, and it declined the spell-effect layer being built anyway.** The approved
selection's cost note 3 stands; §4 of that file records where the cheap add-back sits. Not reopened.

**Bloodline Focus**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Bloodline Focus | **#113** | **1× per rest**: regain 1 focus point | — | 🔴 focus + long-rest |
| 8 | Greater Bloodline | **#117** | focus pool **+1** | — | 🔴 focus points |
| 8 | Bloodline Wellspring | **#128** | reduce an enemy to 0 → regain focus, 1× per combat | — | 🔴 focus points |
| 12 | Bloodline Ascendance | **#131** | upgrade bloodline dice | — | 🔴 focus points |

**Crossblooded**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 2 | Cantrip Expansion | **#123** | **+2** cantrips known | — | character-build layer |
| 4 | Arcane Evolution | **#119** | **1× per rest**: swap one known spell | — | character-build + long-rest |
| 6 | Crossblooded Evolution | **#116** | learn one spell from another tradition | — | 🔴 character-build layer |
| 10 | Greater Crossblooded | **#129** | a second cross-tradition spell | — | 🔴 character-build layer |

**Presence**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Magical Trickster | **#120** | **+1** social skills while holding slots | — | conditional stat mod |
| 8 | Overwhelming Presence | **#127** | **aura, 3 tiles: enemies −1 to saves** | — | 🔴 aura + conditional save |
| 12 | Sorcerous Fortitude | **#132** | **+2 saves** while you have spell slots | — | conditional save modifier |
| 6 | **Commanding Aura** | **NEW** | aura 3 tiles: allies **+1 save**, 60-tick uptime | 1 | 🔴 aura system |

### 3.8 Warlock — Pact of the Blade · Pact of the Tome · Blast Shaper

All three ride `#155 Pact Boon` (`special`, authored with blade/tome/chain options).

**Pact of the Blade**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Pact Boon (blade) | **#155** | summon pact weapon, **1d8 force**, 1 action | 1 | 🔴 character-build layer |
| 4 | Thirsting Blade | **#158** | **extra pact-weapon strike** on the Strike action | — | conditional damage layer |
| 8 | Lifedrinker | **#160** | kill with pact weapon → heal **CHA mod + level/2** | — | conditional damage layer |
| 8 | Tomb of Levistus | **#171** | reaction: negate damage, become stunned, 1× per combat | reaction | reaction vocabulary |

**Pact of the Tome**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | Pact Boon (tome) | **#155** | tome option | — | 🔴 character-build layer |
| 4 | Eldritch Invocation | **#162** | regain **1 slot** per short rest / 3 combats | — | 🔴 long-rest persistence |
| 1 | Eldritch Sight | **#164** | passive detect magic, **+1** skill | — | exploration verbs |
| 12 | Witch Sight | **#175** | see invisible, immune to illusions | — | condition application |

**Blast Shaper**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 2 | Agonizing Blast | **#156** | **+CHA mod per damage die** of Eldritch Blast | — | spell-effect layer |
| 2 | Repelling Blast | **#157** | push **1 tile** away on hit | — | spell-effect layer |
| 2 | Grasp of Hadar | **#165** | pull instead of push | — | spell-effect layer |
| 10 | Master of Hexes | **#161** | hex at 6 tiles, Will save, **60 ticks** (3 actions) | 1 | condition application |

### 3.9 Ranger — Archer · Two-Blade · Pathfinder ⚠ ALL NEW

**Zero authored Ranger class feats.** Every row below is new authoring. Numbers are proposals.

**Archer**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | **Hunter's Aim** | NEW | ranged strike, ignore 1 tile of cover penalty | 1 | new active verb |
| 4 | **Bow Specialisation** | NEW | mirror **#211**'s table for bows: +2/+4/+6/+8 | — | weapon-family spec |
| 6 | **Double Shot** | NEW | 2 ranged strikes, second at −2 | 2 | new active verb |
| 10 | **Called Shot** | NEW | +2 attack, on crit target is flat-footed **40 ticks** | 2 | new active verb |

**Two-Blade**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | **Twin Strike** | NEW | mirror **#10 Double Slice**: strike twice, combine damage | 2 | new active verb |
| 4 | **Off-Hand Parry** | NEW | +1 AC while dual-wielding | — | conditional AC layer |
| 8 | **Blade Storm** | NEW | mirror **#23**: triple strike dual-wield | 3 | new active verb |
| 6 | **Hunted Prey** | NEW | mark one enemy: **+2 damage** vs it for the combat | 1 | conditional damage layer |

**Pathfinder**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | **Trailblazer** | NEW | party ignores difficult terrain | — | 🔴 exploration verbs |
| 2 | Trap Finder (general) | **#70** | ⚠ Rogue-scoped today; needs a general copy | — | ✅ live |
| 4 | **Forager** | NEW | expedition supplies bonus | — | 🔴 exploration verbs |
| 6 | **Scout Ahead** | NEW | party gains surprise round on first room | — | 🔴 exploration verbs |

### 3.10 Bard — Inspirer · Dirge · Charmer · Healer's Refrain ⚠ ALL NEW

**Zero authored Bard class feats.** Inspirer and Dirge are the two aura paths from cost note 1.

**Inspirer** — *Steven's example #2 territory: the party buffer.*

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | **Inspire Courage** | NEW | aura 3 tiles: allies **+1 attack, +1 damage**, 60 ticks | 1 | 🔴 aura system |
| 4 | **Sustained Refrain** | NEW | aura persists without re-spending an action | — | 🔴 aura system |
| 8 | **Inspire Heroics** | NEW | aura upgrade: **+2 attack, +2 damage** | 1 | 🔴 aura system |
| 10 | **Rallying Cry** | NEW | allies in aura gain temp HP = **bard level** | 2 | 🔴 aura system |

**Dirge**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | **Dirge of Doom** | NEW | aura 3 tiles: enemies **−1 attack**, 60 ticks | 1 | 🔴 aura system |
| 4 | **Song of Despair** | NEW | enemies in aura **−1 saves** | — | 🔴 aura + conditional save |
| 8 | **Frightening Tune** | NEW | enemies in aura, Will save or frightened 1 | 2 | condition application |
| 12 | **Requiem** | NEW | aura upgrade: enemies **−2 attack** | — | 🔴 aura system |

**Charmer**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | **Charm** | NEW | one enemy, Will save or cannot attack you **40 ticks** | 2 | 🔴 charm/control |
| 4 | **Soothing Words** | NEW | remove frightened from one ally | 1 | condition application |
| 8 | **Suggestion** | NEW | Will save or target attacks its nearest ally, **40 ticks** | 2 | 🔴 charm/control |
| 6 | Intimidating Glare | **#181** | Demoralize without speech | — | condition application |

**Healer's Refrain**

| lvl | ability | row | numbers | actions | hook |
|---|---|---|---|---|---|
| 1 | **Healing Refrain** | NEW | aura 3 tiles: allies regain **1 HP per 20 ticks** | 1 | 🔴 aura + healing layer |
| 2 | Battle Medicine | **#180** | 2d8, +1d8 per 4 levels | 1 | ✅ live-ish |
| 6 | **Soothing Chord** | NEW | heal one ally **2d8 + CHA mod** | 2 | healing modifier layer |
| 10 | **Song of Renewal** | NEW | aura healing doubles to **2 HP per 20 ticks** | — | 🔴 aura + healing layer |

---

## 4. Hooks, ranked by what this brief actually asks of them

| hook | paths served | authored rows this brief revives | kind |
|---|---|---|---|
| spell-effect layer | 6 | 15 | extend |
| stance/rage layer | 4 | 11 | extend |
| new active verbs | 9 | 10 | extend |
| flat-footed/sneak layer | 3 | 9 | extend |
| healing modifier layer | 3 | 8 | extend |
| reaction vocabulary | 7 | 9 | extend |
| condition application | 7 | 6 | extend |
| 🔴 focus points | 2 | 8 | new system |
| 🔴 long-rest persistence | 4 | **8** (7 + #96) | new system |
| 🔴 character-build layer | 3 | 5 | new system |
| 🔴 aura system | 4 | **1** | new system |
| 🔴 threat/taunt | 2 | **1** (#43) | new system |
| 🔴 exploration verbs | 2 | 1 | new system |
| 🔴 metamagic | 1 | 2 | new system |
| 🔴 charm/control | 1 | **0** | new system |
| conditional AC / damage / save | 5 | 6 | extend |
| weapon-family spec | 3 | 2 | extend |

**Two corrections to the selection's dividend table, each one line:**
- **Long-rest persistence is worth 8, not 7** — `#96 Quickened Casting` needs it too.
- **Threat/taunt revives 1, not 0** — `#43 Come and Get Me` is an authored `stance` row waiting on it.

---

## 5. The three limiter tiers, and which paths need which

| tier | built? | lives on | paths using it |
|---|---|---|---|
| cooldown in ticks | ✅ | `Combatant.abilityReadyAt` | Fighter Bulwark (Taunt), Rogue Poisoner (#71) |
| once per combat | ✅ | `Combatant.abilityUses` | Rogue Debilitator (#88), Monk Stunning Fist (#66), Barbarian Wounded Fury (#44), Cleric Field Medic (#154), Warlock Blade (#171), Sorcerer Bloodline (#128) |
| **once per long rest** | ✅ **BUILT** `78614f5` | `HeroState.longRestUses` | **Cleric Field Medic (#140, #153)**, Wizard Metamagician (#96), Sorcerer Bloodline Focus (#113) + Crossblooded (#119) |

⚠ **Five paths across four classes touch the third tier, not one.** The session brief named Field
Medic; measured, it is Field Medic **plus** Metamagician, Bloodline Focus and Crossblooded. Warlock
Pact of the Tome (#162) recovers on a *short* rest — a different rule, correctly outside the tier.

⚠ **Content-derived membership is 10 feats.** `#91 Arcane Bond` and `#103 Linked Focus` also carry
per-rest payloads and joined the tier automatically, because membership reads the payload rather
than a hardcoded list. Two of the ten (`#173`, `#176`) are Warlock rows still flagged
`implemented: false` — they are in the tier and will be rationed correctly the moment their verbs
are wired.

---

## 6. The code task that was safe, and is now done — commit `b8d41c1`

The picker greyed a feat only when `isEffectReady` was false. That gate asks whether the effect
*type* has a consumer; every real consumer matches something narrower, and two match the feat's
**name**. Fixed in `src/sim/heroes/**` only, which #29 owns.

**Player-visible effect at L12, measured across all 13 classes:**

| class | rows shown | selectable BEFORE | selectable AFTER | now greyed |
|---|---|---|---|---|
| Fighter | 66 | 32 | 14 | 56% |
| Wizard | 67 | 32 | 10 | 69% |
| Cleric | 66 | 34 | 11 | 68% |
| Rogue | 66 | 33 | 12 | 64% |
| Ranger | 43 | 25 | 9 | 64% |
| Barbarian | 66 | 28 | 9 | 68% |
| Monk | 64 | 32 | 12 | 63% |
| Bard | 43 | 25 | 9 | 64% |
| Sorcerer | 67 | 31 | 9 | 71% |
| Warlock | 66 | 31 | 9 | 71% |
| *3 prestige* | 43 | 25 | 9 | 64% |
| **total** | **743** | **378** | **131** | **65%** |

⚠ **THE ROW COUNT DID NOT MOVE — 743 before and after.** Standing decision #22 D1 holds: dead content
stays visible and greyed as future content, never filtered out. What shrank is the *selectable*
share. **Steven must confirm this before it ships to a player** — the picker is now visibly two-thirds
grey, which is honest but stark.

What is still selectable, by the consumer that reads it: `resolveStatMods` 79, `weaponSpecBonus` 26,
`resolveSkillMods` 14, `abilityDef` 8, `executeToggle` 3, `reactionIds` 1.

⚠ **12 of the 30 working feats are generic** (Toughness, saves, initiative, Weapon Spec) — which is
why the honest per-class identity count is so low, and why this brief is mostly a reuse exercise.

**Verification.** Test asserts against the REAL CONSUMER, never through the predicate: a witness
table where each entry drives a hero through `assembleHero` / the resolvers and observes a number
change, plus an exposure test that puts every selectable row on a hero and proves it moves a
Combatant surface. **Two negative controls, both caught the sabotage** — gutting `reactionIds`'s
Nimble Dodge branch, and widening a matcher to lie (selectable 48 → 93, exposure test named the dead
rows). tsc clean, eslint clean, 660 hero/campaign/combat tests green.

⚠ **The 3 harness snapshot failures in the suite are brief #30's, not this change.** Verified by
diffing the drift with and without these files reverted: **identical**.

---

## Summary

Every one of the 33 approved paths now has 3–5 level-tagged abilities with real numbers, action
costs and a named hook. **79% of it was already written** — 108 of the 137 abilities are authored
`feats` rows revived as-is, across 104 distinct feat ids, including Steven's own touch-damage wizard,
which turned out to exist with complete tier tables under four different ids.

- **The feat id being revived for the touch wizard is `#220 Touch Damage Specialization`** (with `#219` beside it, duplicated for Sorcerer as `#222`/`#223`) — that path needs no design, just one matcher on the spell-effect layer.
- **Implementation is UNBLOCKED** — #30 landed at `afd3635`. Two code tasks shipped: the picker fix (`b8d41c1`) and the long-rest tier (`78614f5`).
- **Four decisions still open (§1):** Ranger/Bard authoring order, how a taunt works, which hook goes first, and two feats that work despite being flagged dead. **D2 is settled and built.**
- **Two measured corrections, one line each:** seven paths revive almost nothing (Ranger and Bard hold 25 of the 29 new rows), and **five paths need the long-rest tier, not one** — now built, holding 10 authored feats.
- **The picker fix is player-visible and approved:** same 743 rows shown, selectable drops 378 → 131. Greyed, never hidden.
