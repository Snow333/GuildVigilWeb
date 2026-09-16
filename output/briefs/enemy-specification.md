# Brief #30 — Enemy races × classes: the specification

**Status:** ✅ **IMPLEMENTED 2026-09-15** — Steven ratified the row-by-row classification and
answered §9's questions (see §12). Phase 1 verification is in §1; what measurement changed during
implementation is in §13.
**Author:** session of 2026-09-15
**Session file:** `output/briefs/SESSION-enemy-specification.md`
**Depends on:** #27 (the taxonomy and the four classifications), #26 (the ability vocabulary),
#22 (the `ability` loadout verb), #13 (the level band)
**Owns:** `src/sim/combat/**` (incl. `build.ts`), `src/content/generated/enemies.ts`, `data/seeds/**`,
`tools/check-enemy-taxonomy.mjs`

---

## 1. Phase 1 — the load-bearing claim is TRUE

The session file said to verify §3.1 before designing anything, because the whole races × classes
proposal costs an order of magnitude more if it is false.

> ✅ **`pickAction` genuinely works for a non-hero `Combatant` with a populated loadout.**
> Enemy classes are a **wiring** problem, not a new system.

Verified with a throwaway probe that built **real** enemies via `buildEnemy`, ran **real**
`runEncounter` fights, and read the event stream for witnesses only a loadout entry can produce.
Every positive has a negative control differing *only* in the loadout. No assertion calls the code
under test to check itself.

| # | Witness | Armed | Control | What it proves |
|---|---|---|---|---|
| W1 | `frightened` applied (Intimidating Strike) | **3,300** | **0** | The `ability` branch runs for `isHero: false` |
| W2 | `prone` applied (Knockdown) | **505** | **0** | It reads the enemy's own derived `athletics` |
| W3 | `defending` applied enemy→enemy (Defensive Ward) | **457** | **0** | Non-strike abilities + ally resolution work enemy-side |
| W4 | Enemy idle fights with a skipped ability | — | **0 idle / 10** | The fall-through to a plain strike holds |
| W5 | Enemy swings: Power Attack vs plain | **2,199** | **3,338** | The action economy changes correctly (1 swing at 2× time) |
| W6 | Two Goblins share `baseId`, share no ability state | — | — | §3.2's legacy collision is designed out |

*(40 seeds per row except W4/W6.)*

### 1.1 §3.2 — the legacy `source_id` collision was designed out

`C:\GuildVigil\.claude\memory\arch_enemy_classes.md` warned that `class_resource` keyed by
`source_id` collides — hero 5 and enemy 5 are different creatures. **The web rewrite does not
inherit it.** `abilityUses` and `abilityReadyAt` are per-`Combatant` `Map`s, not a shared dictionary,
so two instances of the same content row hold independent ability state (W6). **No refactor needed.**

### 1.2 §3.3 — the DLC model is storyline-shaped, confirmed

Game bible §10: DLC = separate SQLite files attached at runtime, each holding quest chains, POI
placements, story heroes, enemies, items, dialogue, region unlocks. Confirmed by reading it. The
decision this forces is recorded in **§6**.

---

## 2. Today's composition — one line, then we move on

**Fodder 80.0% · Melee 11.1% · Magic 8.9% · Ranged 0%** (45 rows), reproducing the session file's
stated baseline exactly.

⚠ **But a second finding changes the gate's design, and it is not a re-litigation of the target:**

> **Classification cannot be INFERRED from the `abilities` string.** Two honest readings of the same
> 45 rows put fodder at **80.0%** and at **28.9%** — **51.1 points apart**. The first counts only
> role-bearing words; the second counts any of the six behavioural channels (including `undead`
> immunity, `aoo_count`, and non-Medium size).

Neither reading is wrong. That is the problem. **The M1 gate must read a DECLARED column, never a
derived one** — otherwise the gate's verdict depends on the classifier's opinion and the number it
reports is not a fact. This is the same lesson as #26's "assert the damage, never the table".

---

## 3. The model — races carry the body, classes carry the behaviour

### 3.1 In player terms first

Today every enemy in the game fights the same way. A Goblin, a Bandit, an Orc Raider and a Krathite
Conscript are one creature wearing four names and four hit-point totals.

After this brief: **a race is what a creature IS; a class is what it DOES.**

- You fight a **Goblin**, and it is small, quick and fragile — that is the *race*.
- You fight a **Goblin Bruiser**, and it charges you and hits harder at the cost of swinging
  slower — that is the *class*, and the same class on an Orc reads as a different threat because the
  body underneath it is bigger.
- A **Kobold** and a **Goblin** with no class are still legitimate, distinct content. They look
  different, they are named differently, and they are the enemies you mow down. That is **Fodder**,
  and it is a choice, not a failure.

### 3.2 In data terms

Two new tables, both reviewable seeds, both append-only.

| Table | What a row is | Carries |
|---|---|---|
| `enemy_races` | An ancestry: Goblin, Orc, Skeleton, Hobgoblin, Kobold… | Size, speed, ability-score profile, `enemy_type`, intrinsic vocabulary words (`undead_immunities`, `ferocity`), art key |
| `enemy_classes` | A role template: Bruiser, Line-Holder, Skirmisher, Adept | The **loadout** (ordered `LoadoutEntry[]`), AoO grant, HP/AC/attack deltas, `classification` |

An `enemies` row then declares **`race_id`**, **`class_id`** (nullable — null *is* Fodder), and
**`classification`**.

⚠ **`classification` is DECLARED on the row, not derived from `class_id`.** Per §2 the gate cannot
infer it, and a row must be able to say "I am Fodder" out loud. The gate cross-checks the two for
consistency (a row with a Melee class may not declare Fodder) — that check is real precisely
*because* the column is independent.

### 3.3 The wiring in `build.ts` — the whole code change

```ts
// TODAY — every enemy, hardcoded:
weaponRange: 1, engageRange: 1, isCaster: false, casting: null, loadout: [],

// AFTER — read the class template:
loadout:     classTemplate?.loadout ?? [],
weaponRange: classTemplate?.weaponRange ?? 1,
engageRange: classTemplate?.engageRange ?? 1,
```

That is it for the Melee classification. The nine `ACTIVE_WIRED` abilities (Power Attack,
Intimidating Strike, Brutish Shove, Knockdown, Improved Knockdown, Determination, Channel Smite,
Defensive Ward, Poison Weapon) become available to enemies the moment a class template names them.

⚠ **`engageRange` must be set from the class, not left at 1.** Measured: an enemy with a 6-range
attack but `engageRange: 1` produced **0 standoff moves and 20 engage moves** — it walks into melee
to use a ranged attack. That is brief #15's wizard bug, enemy-side, and leaving the line hardcoded
reintroduces it the day a ranged class lands.

---

## 4. Hand-crafted versus generated

| Rows | How authored | Why |
|---|---|---|
| **Fodder and rank-and-file** | **Generated** from race × class | A Goblin Bruiser and an Orc Bruiser should differ *only* by the body underneath. Hand-writing both invites them to drift apart for no reason. |
| **Elites** (`tier: elite`) | Generated, then hand-amended | Start from the template so it is consistent; override the one or two things that make it an elite. |
| **Bosses and named characters** (`tier: legendary`, story rows) | **Hand-crafted, always** | The Lich, the Adult Red Dragon, Ruk Mor-Tal, The Whisper's Blade. A boss's whole job is to be unlike anything else; a template would flatten it. |

⚠ **"Generated" means generated INTO A SEED, once, and committed as ordinary rows** — not expanded
at runtime. Brief #27 §10 rejected runtime variant templates and that stands: IDs are append-only
forever, the count gates count rows, and a row you cannot read in a seed file is a row nobody
reviews. The generator emits SQL a human reads before it is applied.

### 4.1 The existing 45 rows

**No new rows are required to hit the settled target.** 45 rows at 80% fodder = 36 fodder rows;
50% of 45 is 22. **Assigning a class to 14 existing rows reaches the target with zero new content.**

That is the cheapest possible route to 40–50% and it is available because §1 proved the machinery is
wiring. New rows (brief #27's M2–M4 brackets) then land *on top of* a pool already in range, rather
than being asked to drag it there.

---

## 5. The composition gate — `tools/check-enemy-taxonomy.mjs`

Wired into `pnpm check` and CI, per brief #27 M1.

**It asserts:**

1. Every `enemies` row declares a `classification` ∈ {Fodder, Melee, Ranged, Magic}. Blank fails.
2. Every row declares a `race_id` that exists; `class_id` is null or exists.
3. **Fodder share is within 40–50%** of the pool.
4. `classification` is consistent with `class_id` (a Melee class may not be declared Fodder).
5. No row names a vocabulary word outside the live + deferred sets.
6. Every `family` × `bracket` pair is one brief #27 sanctions.

**⚠ Per the repo's gate law, it ships with proof it can FAIL.** Push the fodder share above 50% and
confirm the gate trips; blank a `classification` and confirm it trips; restore; confirm `git diff` on
`src/` and `data/` is empty. A threshold nobody has watched trip is decoration.

⚠ **Rule 3 cannot be enabled until §4.1's reclassification lands**, or the gate is red on the commit
that adds it. Order: add the gate with rule 3 **warning**, do the reclassification, flip rule 3 to
**failing** in the same commit that brings the pool into range.

---

## 6. DECISION — ancestries as DLC

**Recommendation: NO separate ancestry-DLC model. Races ship in the base game; a storyline DLC may
add race rows the same way it adds enemy rows.**

Reasoning, recorded because §3.3 required this to be a deliberate decision and not a default:

- The DLC model that exists is **storyline-shaped**: a pack is a *story* — quests, POIs, story
  heroes, enemies, items, dialogue, region unlocks — attached via SQLite `ATTACH`. A race is not a
  story; it is a building block stories use.
- An ancestry-shaped DLC would be a **second model beside the first**, with its own load order, its
  own conflict rules, and its own failure mode when a base-game quest references a race the player
  has not bought.
- Under the recommendation, a DLC that wants Gnolls ships `enemy_races` rows in *its* SQLite file
  alongside its enemies and quests. **It is already exactly the mechanism DLC uses.** Nothing new
  is built, and the ancestry ships with the story that needs it.
- ⚠ Hero-side ancestry (`src/sim/heroes/ancestry.ts`) is **deliberately cosmetic today** — it names
  the hero and picks the portrait and does nothing else. Enemy races are mechanical from day one.
  These are two different concepts that share a word, and the brief keeps them separate on purpose.

**Steven's call required.** If you want ancestries sold separately from stories, say so and it
becomes its own brief — it is a real architectural fork, not a flag.

---

## 7. Sequencing — the answer for §5's blocked classifications

Measured this session, and it changes the shape of the recommendation:

| Classification | Status before | **Measured this session** |
|---|---|---|
| **Melee** | ✅ buildable | ✅ Confirmed — 9 abilities, W1–W5 |
| **Ranged** | ⛔ blocked on #28 | ⚠ **The positioning machinery is unit-agnostic.** Setting `engageRange: 6` produced **15 standoff moves vs 0** as built. #28 is a **balance** brief, as its own session file says — not a systems build. |
| **Magic** | ⚠ partial | ✅ **Cantrip magic works TODAY with `casting: null`.** An enemy cast Electric Arc **2,796 times over 20 fights** with `buildEnemy`'s stock `isCaster: false`. **27 cantrips are live** (11 damage, 6 buff, 6 healing, 3 utility, 1 debuff). Leveled spells correctly need slots: **0 casts without, 60 with** — the resource gate is real. |

**Recommended order:**

1. **#30a — the gate** (`check-enemy-taxonomy.mjs`, rules 1–2 and 4–6 failing, rule 3 warning).
   Nothing is authored before it exists; the Vanguard batch is the argument.
2. **#30b — the tables and the `build.ts` wiring**, plus classing the 14 existing rows. Pool reaches
   40–50% fodder. Rule 3 flips to failing.
3. **#30c — Magic via cantrips.** Needs no casting-resource work. This is the largest amount of new
   *player-visible* behaviour available for the least code in the whole plan.
4. **#28 — Ranged**, unchanged in position but **re-scoped**: a balance brief about closure times,
   not a systems build. Its wiring is `weaponRange` + `engageRange` from the class template.

⚠ **Leveled enemy spellcasting (`casting.slots`) is NOT in this brief.** Enemy spell slots are a
resource-economy question and the three rows that name `spellcasting_5` / `spellcasting_9` are all
above the reachable level ceiling. Cantrips deliver the Magic classification without it.

---

## 8. Balance expectation, stated before measuring

Per `output/reference/measurement.md`, the prediction goes in before the numbers.

**Expectation: classing 14 existing rows moves the d1–d5 curve by MORE than the ±8 noise bar, and
that is the intended outcome, not an error.** Unlike brief #27's new-row authoring — which dilutes
the draw pool — this changes what the *existing* spawnable rows do. An enemy that gains Power Attack
or an AoO is straightforwardly more dangerous.

⚠ **Therefore this is the one place in the plan where a re-tune may be needed.** The tripwire is
directional: if completion *rises*, something is mis-wired, because nothing here makes enemies
weaker. The curve is not a gate (#22 D5) — but a move in the wrong direction is a bug signal.

---

## 9. Open questions for Steven

**Q1 — Ancestries as DLC (§6).**
1. ✅ **Recommended:** no separate model; races ship base-game, DLC adds race rows like it adds enemy rows.
2. Separate ancestry-DLC model — its own brief, its own load-order rules.

**Q2 — How many enemy classes at first pass?**
1. ✅ **Recommended: four** — Bruiser, Line-Holder, Skirmisher, Adept. Covers Melee and Magic, maps onto the nine wired abilities, and leaves Ranged to #28.
2. Two (Bruiser, Line-Holder) — smaller, but Magic stays at 8.9%.
3. Six — adds Ranged classes now, which makes this brief depend on #28.

**Q3 — The 14 rows that get classed in §4.1.** Do you want to pick them, or should the brief propose
the set (favouring the rows a d1–d3 player actually meets) for your review?

---

## 10. Anti-goals

- ⛔ **No runtime variant expansion.** Generated rows land in a reviewable seed. (#27 §10.)
- ⛔ **No hand-editing `src/content/generated/enemies.ts`.** Seed → `pnpm db:apply` → `pnpm convert`.
- ⛔ **No new rows before the gate exists.**
- ⛔ **No leveled enemy spellcasting** (§7).
- ⛔ **No Brackets IV/V authoring** — still gated on progression built *and playtested* to L10.
- ⛔ **No re-deriving the 40–50% fodder target.** Settled 2026-09-13.

---

## 11. Evidence

Every figure above was measured this session (2026-09-15) against the live registry with throwaway
probes outside `tests/`, removed afterwards; working tree verified clean.

- §3.1 verified: 6 witnesses, each with a negative control returning 0. 40 seeds per witness.
- Legacy `source_id` collision: absent — `abilityUses` / `abilityReadyAt` are per-instance Maps.
- Composition baseline reproduced exactly: 80.0 / 11.1 / 8.9 / 0 over 45 rows.
- Classification inference spread: 51.1 points between two honest readings.
- Ranged positioning: 15 standoff vs 0 engage at `engageRange: 6`; 0 vs 15 as built.
- Enemy cantrip casting with `casting: null`: 2,796 casts / 20 fights. 27 cantrips live.
- Leveled spell resource gate: 0 casts without slots, 60 with.
- 45 rows, highest id 120. 36 fodder → 22 needed for 50%; **14 rows to reclassify.**
- 9 abilities in `ACTIVE_WIRED`.

---

## 12. Steven's answers (2026-09-15) — RATIFIED

| Q | Answer |
|---|---|
| **Q1 — ancestries as DLC** | ✅ **No separate model.** *"Lets not over think this too much as we will probably bundle new ancestries with the bigger beat storyline points."* Races ship base-game; a DLC adds race rows exactly as it adds enemy rows. §6 stands as written. |
| **Q2 — how many classes** | **Six** — Warrior, Brute, Skirmisher, Caster, Zealot, Archer. Ranged is in scope now, so #28 is a dependency of this work rather than a follow-on. |
| **Q3 — the rows to class** | Steven ratified the full 45-row proposal after reviewing it row by row. |
| **Q4 — sequencing** | *"Lets just do the work needed. We are slowing ourselves down being overly sensitive on order of operations."* The #30a/b/c staging in §7 is **dropped**; it shipped as one body of work. |

---

## 13. ⚠ What measurement changed during implementation

§8 predicted completion would **fall** and said a rise is a bug signal. It rose — d4 **57.7 → 67.3**,
wipes **14 → 3.7**. The tripwire fired, and it was right.

### 13.1 The defect: an ability is a DOWNGRADE for a unit that cannot choose its moment

`ENCOUNTER.swingsPerAction` is **2**, so a normal action is a two-swing burst. An ability strike is
**one** swing, and `abilityInterval` multiplied the next interval by the ability's `actions` cost.
A player absorbs that because they *pick the moment*; `pickAction` takes the top matching entry
**every action**, so for an enemy the same ability became a permanent 2–4× swing-rate cut.

Measured on an Orc Warrior against a plain-strike control:

| Loadout | Damage vs plain |
|---|---|
| Power Attack every action | **−41%** |
| Brutish Shove every action | **−36%** |
| Intimidating Strike every action | **−69%** |
| Knockdown every action | **−68%** |

And the decisive one, in a real fight: **the hero took LESS damage from the classed enemy than the
unclassed one — 1,862 → 694.** Classes made enemies weaker. That is the whole brief inverted.

⚠ **Checked for the brief #25 confound before acting:** fight length was near-constant across arms
(~21–26k ticks), so the damage figures are not a fight-length artifact. Confirmed on metrics with no
run-length term — enemy win rate and hero HP remaining.

### 13.2 The fix, in two parts

1. **`Combatant.abilityCadenceTicks`** — a minimum gap between a unit's ability *strikes*, set from
   `enemy_classes.ability_cooldown_ticks` (200 ticks ≈ every fifth action). It rations the **verb**,
   not the feat, so a two-ability class cannot alternate around it.
2. **`abilityInterval(..., cadenced)`** — a unit with a cadence does **not** also pay the `actions`
   multiplier, because that is charging twice for the same rationing.

⚠ **Heroes keep `abilityCadenceTicks: 0` and the full multiplier.** Hero pacing is balanced around
player choice and belongs to brief #29; imposing a cadence there would re-tune every class in the
game from an enemy-content brief. The type system enforces that both construction sites state it.

### 13.3 Two abilities were dropped from classes, and the reason generalises

> **An ability that costs an action but adds no swing is a loss for an AI.**

- **Poison Weapon** on Skirmisher: enemy wins **19 → 1**. A whole action, forever, for a 1d4 rider.
  Knockdown alone measured **19 → 20**.
- **Divine Lance** on Zealot: a 1d4 cantrip replacing a two-swing weapon burst on a **melee**
  statblock measured **11 wins → 0**. The same cantrip on a **caster** statblock measured **1 → 9** —
  which is why Caster keeps one and Zealot does not.

⚠ **A cantrip is a strong enemy action only where the statblock is bad at melee.** That is the
authoring rule this produced, and it is now the Caster/Zealot split.

### 13.4 Result

| | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| completion Δ | 0 | +1.3 | 0 | **+2.3** | **+4.3** |

All inside the ±8 noise bar, versus **+9.6 at d4** before the fix. Snapshots re-baselined
deliberately; the exposure tests carry the proof, per the repo's standing rule.

---

## 14. What shipped

| File | What |
|---|---|
| `data/seeds/seed_enemy_races_classes.sql` | 22 races, 6 classes, all 45 rows assigned. ⚠ **Verified by replay:** applying it to a pristine `HEAD` db and re-converting reproduces today's content **byte-identically** (md5 match), so it is a real reviewable artifact, not a post-hoc dump. |
| `src/sim/combat/build.ts` | Reads race + class. The three hardcoded lines are gone. |
| `src/sim/combat/loadout.ts` | `parseLoadout` — **validates** authored JSON rather than casting it. |
| `src/sim/combat/abilities.ts` | The cadence limiter and the no-double-charge rule. |
| `src/sim/combat/types.ts` | `abilityCadenceTicks`, `lastAbilityTick`. |
| `tools/check-enemy-taxonomy.mjs` | The composition gate, wired into `pnpm check` and CI. |
| `tests/combat/enemyRacesClasses.test.ts` | 19 tests, exposure-first. |

### 14.1 The gate was proven able to fail

Per repo law, three sabotages, each restored with content verified byte-identical afterwards:

| Sabotage | Result |
|---|---|
| Blank one row's `classification` | ✅ 2 violations named |
| Strip 6 classes → fodder 53.3% | ✅ composition violation |
| A race naming `invented_word` | ✅ vocabulary violation |

### 14.2 The exposure tests were proven able to fail

⚠ **The first draft of the test file passed all 19 with `build.ts` sabotaged to `loadout: []`** —
because its helper re-implemented the wiring it was meant to prove. That is the fourth instance of
this repo's assert-against-yourself family (#22's gate, #24's aggregator, #26's immunity table). The
helper now builds strictly through `buildEnemy`, and the three sabotages fail **4**, **1** and **2**
tests respectively.

### 14.3 Still open

- ⚠ **Ranged is 4.4% and both rows are unreachable** (L8 and L12, above the level ceiling). The gate
  emits an **advisory** saying so on every run. Real ranged enemies need new rank-and-file rows —
  authoring work, not reclassification.
- **Fodder sits at exactly 40.0%**, the bottom edge of the band. Any new specialist needs fodder
  authored alongside it.
- **Leveled enemy spellcasting** remains deliberately shut (§7).
