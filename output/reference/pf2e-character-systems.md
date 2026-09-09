# PF2E reference — character progression, abilities, items

**Status:** reference extract, gathered 2026-09-09 from the ORC/OGL PF2E ruleset on
Archives of Nethys. NOT a design decision — this file records what PF2E actually does,
so briefs can cite numbers instead of re-deriving them. Guild Vigil is **PF2E-flavored,
not RAW** (decision-ledger Area 2), so every row here is a candidate, not an obligation.

---

## 1. The core check formula

```
d20 + attribute_mod + proficiency_bonus + item_bonus + circumstance + status
proficiency_bonus = (rank == untrained) ? 0 : character_level + rank_value
```

| Rank | rank_value | L1 | L5 | L10 | L20 |
|---|---|---|---|---|---|
| Untrained | — | +0 | +0 | +0 | +0 |
| Trained | +2 | +3 | +7 | +12 | +22 |
| Expert | +4 | +5 | +9 | +14 | +24 |
| Master | +6 | +7 | +11 | +16 | +26 |
| Legendary | +8 | +9 | +13 | +18 | +28 |

Consequences:

- **Level is added to nearly everything.** Two characters four levels apart are never in
  the same band. This is why PF2E dungeons have hard level walls.
- **Rank gaps are small (2 pts) against level.** Breadth is cheap; depth is a modest edge.
  Untrained is the only cliff — it drops the whole level term.
- DCs scale with level too, so the curve is flat by design: progression buys **options**,
  not success rate.
- Variant **Proficiency Without Level** (GM Core) removes the level term and flattens
  cross-level fights.

Guild Vigil today uses `baseProficiency = level/2 + 1` plus a tier bonus
(`heroes/proficiency.ts`) — a PF1-shaped curve, roughly half PF2E's slope. That divergence
is already shipped and load-bearing for the tuned dungeon curve.

## 2. Level 1–20 advancement cadence

| Benefit | Cadence | Count by L20 |
|---|---|---|
| Class feat | L1 + every **even** level | 10 |
| Skill feat | L2 + every **2** levels | 10 |
| General feat | L3, 7, 11, 15, 19 | 5 |
| Ancestry feat | L1, 5, 9, 13, 17 | 5 |
| Skill increase | L3 + every **odd** level | 9 |
| Attribute boosts (4, distinct) | L5, 10, 15, 20 | 16 |
| XP | flat **1,000/level** | — |

Skill increase = untrained→trained or trained→expert. **Master needs L7+, legendary L15+**,
each requiring the rank below. Rogue is the exception: skill feat every level, skill
increase from L2 every level.

## 3. Attributes

Creation: all at +0; ancestry (2 fixed + 1 free, sometimes a −1 flaw), background (2),
class key attribute (1), plus **4 free boosts to distinct attributes**. Cap **+4 at L1**.

**Partial-boost rule:** a boost to an attribute already at +4 or higher gives a half-step;
a second boost completes it. Practical ceiling +4 → +5 by L10 → +6 by L20.

Derived on change: CON boost retroactively adds 1 HP per level (Guild Vigil already does
this); INT boost grants an extra trained skill.

## 4. Feats — four non-interchangeable budgets

| Type | Pool | Gate |
|---|---|---|
| Ancestry | ancestry list + heritage at L1 | feat level ≤ character level |
| Class | class list, **or an archetype feat** | ≤ level |
| Skill | any *skill*-trait feat | ≤ level **and** trained+ in that skill |
| General | any *general* feat (skill feats are a subset) | ≤ level |

A general slot may take a skill feat; a skill slot may not take a general feat.
Prerequisites gate on level, proficiency rank, a named feat, an attribute, or a class
feature. Chains are shallow and rank-paced:

```
Battle Medicine (1, trained) → Continual Recovery (2, expert) → Ward Medic (2, expert)
                                                              → Legendary Medic (15, legendary)
```

Retraining (downtime) swaps most feats/skill increases/spells for equal-level choices.

## 5. Spellcasting

**Rank access:** a new spell rank every **odd** level (2nd at L3 … 9th at L17; 10th is a
single L19 capstone).

Prepared full caster slots per rank — newest rank opens at **2**, fills to **3** the next
even level. Spontaneous is the same shape at **3 → 4**.

| Lvl | C | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 5 | 2 | | | | | | | | |
| 3 | 5 | 3 | 2 | | | | | | | |
| 5 | 5 | 3 | 3 | 2 | | | | | | |
| 7 | 5 | 3 | 3 | 3 | 2 | | | | | |
| 9 | 5 | 3 | 3 | 3 | 3 | 2 | | | | |
| 11 | 5 | 3 | 3 | 3 | 3 | 3 | 2 | | | |
| 13 | 5 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | | |
| 15 | 5 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | |
| 17 | 5 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 19 | 5 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |

- **Prepared vs spontaneous:** prepared picks which spells fill which slots daily;
  spontaneous has a fixed repertoire castable into any slot of its rank.
- **Cantrips**: 5 known, unlimited, **auto-heightened to half level rounded up**. This is
  what removes the "out of resources, I do nothing" failure mode.
- **Focus spells**: from class features/feats, never the spell list. Pool = number known,
  **max 3**. Refocus (10 min exploration) restores 1, repeatable. Auto-heightened like
  cantrips.
- **Signature spells** (spontaneous, from L3): one spell per rank heightens freely.
- Spell attack/DC track: trained L1 → expert 7 → master 15 → legendary 19.

## 6. Class features that are ongoing choices

Subclass at L1 for every class. Examples of scheduled *choice* slots (not flat bonuses):

| Class | L1 choice | Later choice points |
|---|---|---|
| Fighter | — | weapon mastery L5 (pick group → master), weapon legend L13, combat flexibility L9/L15 (daily temp feat) |
| Rogue | **racket** (sets key attribute) | sneak 1d6→4d6 at 1/5/11/17, debilitating strike L9, double L15 |
| Cleric | **doctrine** + deity + **divine font** (heal/harm) | doctrine tiers 1/3/7/11/15/19 |
| Wizard | **arcane school** + thesis + bond | curriculum spells, 2 spellbook spells/level |
| Sorcerer | **bloodline** (sets tradition) | signature spells L3, paragon L19 |
| Monk | — | path to perfection 7/11/15 (pick a save → master) |

## 7. Multiclassing is archetype dedication, not class levels

PF2E has **no** 3.x class-level split. You spend **class feat slots** on archetype feats.

1. **Dedication feat**, usually available L2; multiclass dedications need **+2 in the
   target class's key attribute**; you can't dedicate to your own class.
2. **The 2-feat rule**: after a dedication, no *other* dedication until you take two more
   feats from that archetype. Minimum 3 class feats per archetype.
3. Archetype feats compete directly with your own class feats (same even-level slots).

Spellcasting archetype ladder: Dedication (2, cantrips) → Basic Spellcasting (4: 1st-rank
slot; 6: 2nd; 8: 3rd) → Expert (12: 4th; 14: 5th; 16: 6th) → Master (18: 7th; 20: 8th).
A caster dip peaks at **one slot of ranks 1–8**, never 9th, never legendary.

| | PF2E archetype | 3.x class levels |
|---|---|---|
| Cost | class feat slots | whole character levels |
| Effect on core math | none | dilutes attack, saves, caster level |
| Granularity | 1 feat, 3-feat min commitment | 1 full level |
| Reversible | via retraining | effectively no |

**Free Archetype** variant (GM Core): a *bonus* archetype-only class feat at L2 and every
even level. Decouples concept choices from class power without touching core math.

⚠ Guild Vigil currently implements **3.x-style class-level multiclassing** (ability ≥13,
caps 20/10, max 5 classes) — a deliberate, ledger-confirmed divergence carried from the
game bible §7. PF2E's archetype model is recorded here as an alternative, not a correction.

---

## 8. Items — item level and the treasure curve

**Item level** is the organizing number: it gates crafting, signals power, and an assembled
item takes the **highest** level among base and runes. Price ≈ **×1.4 per level**.

Party treasure per level of play (4 PCs): 2 permanents at (level+1), 2 at (level),
6 consumables at level+1/level/level−1, currency ≈ 25–28% of total value.

| Lvl | Total value | Currency | Lvl | Total value | Currency |
|---|---|---|---|---|---|
| 1 | 175 | 40 | 8 | 4,000 | 1,000 |
| 2 | 300 | 70 | 10 | 8,000 | 2,000 |
| 3 | 500 | 120 | 12 | 16,500 | 4,000 |
| 4 | 850 | 200 | 15 | 54,500 | 13,000 |
| 5 | 1,350 | 320 | 17 | 128,000 | 30,000 |
| 6 | 2,000 | 500 | 20 | 490,000 | 140,000 |

Selling is **50% of price**.

## 9. Fundamental runes — the mandatory ladder

| Rune | Lvl | Price | Effect |
|---|---|---|---|
| Weapon potency +1 / +2 / +3 | 2 / 10 / 16 | 35 / 935 / 8,935 | +N attack; **N property-rune slots** |
| Striking / greater / major | 4 / 12 / 19 | 65 / 1,065 / 31,065 | weapon damage dice → 2 / 3 / 4 |
| Armor potency +1 / +2 / +3 | 5 / 11 / 18 | 160 / 1,060 / 20,560 | +N AC; N slots |
| Resilient / greater / major | 8 / 14 / 20 | 340 / 3,440 / 49,440 | +1 / +2 / +3 all saves |

Expected upgrade path alternates offense and defense: weapon at 2/4/10/12/16/19, armor at
5/8/11/14/18/20 — one bump every 2–3 levels.

## 10. Property runes

**Slot count = potency value** (+1 → 1 rune, +3 → 3). Striking/resilient consume no slots.
Duplicates don't stack. Examples: returning (3/55), ghost touch (4/75), fearsome (5/160),
wounding (7/340), flaming/frost/shock/corrosive (8/500 each, +1d6 + crit rider), grievous
(9/700), holy (11/1,400), keen (13/3,000), greater elemental (15/6,500). Armor: slick
(5/45), shadow (5/55), energy-resistant (8/420), fortification (12/2,000).

**Transfer** is a Craft activity costing **10% of the rune's price**, 1 day. Property runes
stranded without enough potency go **dormant**, not lost.

## 11. Automatic Bonus Progression (GM Core variant) — the treadmill deleted

Grants the item numbers as innate features; all potency/striking/resilient runes are
removed from the world. Property runes and consumables stay.

| Lvl | Grant |
|---|---|
| 2 | Attack potency +1 |
| 3 | Skill potency (one +1) |
| 4 | Devastating attacks (2 dice) |
| 5 | Defense potency +1 |
| 6 | Skill potency (two +1) |
| 7 | Perception potency +1 |
| 8 | Saving throw potency +1 |
| 9 | Skill potency (one +2, one +1) |
| 10 | Attack potency +2 |
| 11 | Defense potency +2 |
| 12 | Devastating attacks (3 dice) |
| 13 | Perception potency +2; skills (two +2, one +1) |
| 14 | Saving throw potency +2 |
| 15 | Skill potency (three +2, one +1) |
| 16 | Attack potency +3 |
| 17 | **Attribute apex**; skills (one +3, two +2, two +1) |
| 18 | Defense potency +3 |
| 19 | Devastating attacks (4 dice); Perception potency +3 |
| 20 | Saving throw potency +3; skills (two +3, two +2, two +1) |

The ABP levels are **exactly** the levels at which each rune was expected — direct proof
that PF2E's item math is a fixed level curve wearing a shopping-trip costume. The rulebook
warns that stripping runes also removes their *damage* (flaming etc.), so encounters get
harder even with the bonuses granted.

## 12. Investiture and the slot model

- **Invested** items work only after the daily Invest activity; **max 10 invested per day**.
  An uninvested item keeps mundane benefits (`+1 resilient` armor still gives its AC item
  bonus, not the save bonus).
- PF2E tracks **held / worn / stowed**, not a rigid slot table. Worn magic items name a
  location in flavor text; the GM prevents three cloaks. There are **no per-slot bonus caps**.
- Real constraints: the 10-invest cap, hands, Bulk, and same-type bonus non-stacking.

3.x limited *what body part is occupied*; PF2E limits *how much magic you can channel* plus
*what your hands are doing*. Scarcity moves from wardrobe geometry to action economy.

## 13. Consumables

| Rank | Scroll (lvl/price) | Wand (lvl/price) |
|---|---|---|
| 1st | 1 / 4 | 3 / 60 |
| 3rd | 5 / 30 | 7 / 360 |
| 5th | 9 / 150 | 11 / 1,400 |
| 7th | 13 / 600 | 15 / 6,500 |
| 9th | 17 / 3,000 | 19 / 40,000 |

Scrolls: one spell, consumed, item level = 2×rank − 1. Wands: permanent, once per day plus
a risky overcharge, level = 2×rank + 1, ≈15× a scroll. **Talismans**: consumables *affixed*
to a weapon/armor for 10 minutes, one per item, activate as a **free action** then burn out
— extremely cheap for their level (L1 ≈ 3 gp), which makes them the canonical *pre-expedition
loadout* purchase. Elixir of Life: minor 1/3/1d6 → true 19/8,000/10d6+27.

What balances consumables is the **action cost** (draw + activate = 2 of 3 actions), not
the gold.

## 14. Bulk, quality, armour

**Bulk:** carry 5 + Str mod freely; beyond that **encumbered** (clumsy 1, −10 ft); hard cap
10 + Str mod. L = light (10 L = 1 Bulk). 1,000 coins = 1 Bulk.

**Quality:** PF2E collapsed 3.x's masterwork ladder. Only **shoddy** (half price, −2 item
penalty, halved HP/BT) and **standard** exist; the numeric ladder is runes and the material
ladder is precious materials (cold iron, silver, adamantine, mithral, orichalcum).

**Item damage:** Hardness / HP / Broken Threshold. Broken armor keeps its AC item bonus but
adds a status penalty (−1/−2/−3 light/medium/heavy). Cloth 1/4/2, leather 4/16/8, metal 9/36/18.

| Category | Example | AC | Dex cap | Check | Speed | Str | Bulk |
|---|---|---|---|---|---|---|---|
| Unarmored | explorer's clothing | +0 | +5 | — | — | — | L |
| Light | leather | +1 | +4 | −1 | — | 0 | 1 |
| Light | studded leather / chain shirt | +2 | +3 | −1 | — | +1 | 1 |
| Medium | hide / scale mail | +3 | +2 | −2 | −5 | +2 | 2 |
| Medium | chain mail / breastplate | +4 | +1 | −2 | −5 | +3 | 2 |
| Heavy | splint / half plate | +5 | +1 | −3 | −10 | +3 | 3 |
| Heavy | full plate | +6 | +0 | −3 | −10 | +4 | 4 |

`AC = 10 + min(Dex, cap) + proficiency + armor bonus`, so AC bonus and Dex cap trade off —
totals converge and armor choice is really *which other stats you pay with*. **Meeting the
Strength threshold removes the check penalty entirely and reduces the speed penalty by 5 ft.**
Base armor prices are trivial (≤35 gp); armor's cost lives in its runes.

## 15. Weapon traits

Baseline MAP: −5 on the second attack in a turn, −10 on the third+.

| Trait | Effect |
|---|---|
| **Agile** | MAP −4 / −8 instead of −5 / −10 |
| **Finesse** | Dex on the **attack roll**; damage still Str |
| **Reach** | 10 ft instead of adjacent (+5 ft if you already have reach) |
| **Deadly d*X*** | crit: add one extra die of size *X* **after** doubling; 2 dice at greater striking, 3 at major |
| **Fatal d*X*** | crit: **all** damage dice become size *X* **and** add one extra |
| **Forceful** | second Strike this turn gains circumstance damage = number of weapon dice; third+ double that |
| **Sweep** | +1 circumstance to attack if you already attacked a **different** target this turn |
| **Versatile *T*** | choose damage type *T* per attack |

Two points worth copying: crit traits scale with the striking rune, so a L1 trait choice
stays proportional at L19 with no new numbers; and agile/forceful/sweep exist *because* the
3-action economy makes multi-Strike turns a real choice.

---

## Sources

Progression: Proficiency <https://2e.aonprd.com/Rules.aspx?ID=35> · Leveling Up
<https://2e.aonprd.com/Rules.aspx?ID=116> · Attribute boosts
<https://2e.aonprd.com/Rules.aspx?ID=2027> · Improving Skills
<https://2e.aonprd.com/Rules.aspx?ID=2136> · Focus Spells
<https://2e.aonprd.com/Rules.aspx?ID=276> · Dedications
<https://2e.aonprd.com/Rules.aspx?ID=2128> · Spellcasting Archetypes
<https://2e.aonprd.com/Rules.aspx?ID=170> · Variant Rules (Free Archetype)
<https://2e.aonprd.com/Rules.aspx?ID=1327> · class tables under
<https://2e.aonprd.com/Classes.aspx>

Items: Treasure by level <https://2e.aonprd.com/Rules.aspx?ID=581> · Character wealth
<https://2e.aonprd.com/Rules.aspx?ID=2662> · Runes
<https://2e.aonprd.com/Rules.aspx?ID=733> · Automatic Bonus Progression
<https://2e.aonprd.com/Rules.aspx?ID=1357> · Invested
<https://2e.aonprd.com/Rules.aspx?ID=3138> · Bulk
<https://2e.aonprd.com/Rules.aspx?ID=187> · Armor
<https://2e.aonprd.com/Rules.aspx?ID=2160> · <https://2e.aonprd.com/Armor.aspx> ·
Traits <https://2e.aonprd.com/Traits.aspx>
