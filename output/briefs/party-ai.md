# Design Brief #15 — Party AI and the Caution Dial

**Status:** **APPROVED 2026-08-12 · IMPLEMENTED AND SHIPPED 2026-08-13.** Decision record §11; §11.2's open conflict closed and the implementation record in **§12**. Landed as one milestone after brief #16's harness, as required. 444 unit + 10 e2e green.
**Covers:** the two optimisations chosen after brief #14 — party AI (repairs **and** a threat mechanic, per Steven's scope call) and tuning the caution thresholds (between-rooms only; mid-combat withdrawal was explicitly declined).
**Target set by Steven:** *a level-N party of four in a level-N dungeon should win about 80% of the time; punching up a level should measurably lower that.*
**Authorities:** `core-loop.md`, `decision-ledger.md` Area 2 (universal AI), brief #4 (profile AI), brief #14 (the three walls).
**Measured by:** a throwaway probe over patched copies under `probe/variant/` (`aiVariant`, `loadoutVariant`, `encounterVariant`, `dispatchVariant`, `populationVariant`). `src/` untouched and verified byte-identical after every run. Suite green at 420 unit + 10 e2e.

---

## 0. The headline

> ⚠ **SUPERSEDED IN PART BY §10 (2026-08-12).** Steven proposed cantrips after this brief was written. Measured, they beat **P1a decisively** (92.7% vs 69.0% completion at d2) and they repair the failure §4 records. **P1a is withdrawn; read §10 for the current recommendation.** §2 (threat), §3 (the ability gap) and §5 (the caution dial) all stand.

### 0.1 As originally written — the target is reachable, and the last piece is a null column

| tiny · at level · 300 runs | shipped | **+R2+H4+P1a** |
|---|---|---|
| **d1 · party L1** | 69.3% completed / 14.0% wiped | **85.7% / 7.7%** |
| **d2 · party L2** | 53.3% / 23.3% | **75.7% / 16.7%** |
| d3 · party L3 | 28.7% / 44.0% | 49.7% / 38.0% |
| small d4 · party L4 | 6.3% / 51.7% | 14.0% / 64.3% |

**R2 and H4 you already approved in brief #14.** **P1a is new and it is a one-column content change.** Together they clear the 80% target at the entry dungeon and land close at d2.

The at-level curve still slopes (85.7 → 75.7 → 49.7 → 14.0), so "at level" is not yet a constant difficulty. That slope is the remaining work and it is not an AI problem — see §5.

---

## 1. P1a — the wizard is classified as a melee unit by a null

`ai.ts`: `const isMelee = (u) => u.weaponRange <= ENGAGEMENT_RANGE` (1.5). `assembleHero` reads `weaponRange` from the item row, defaulting to **1** when the column is null.

| item | `weapon_range` | AI classification |
|---|---|---|
| Dagger | 2 | ranged-ish |
| Longbow | 18 | ranged |
| Crossbow | 12 | ranged |
| **Staff** (wizard) | **null → 1** | **MELEE** |
| **Mace** (cleric) | **null → 1** | **MELEE** |

So `desiredPosition` marches the wizard into engagement range every fight — AC 12, 15 HP at level 1 — and the cleric with it. Confirmation from the stream: the `standoff` movement purpose fired **0 times in 1,850 moves**. No starting hero carries a ranged weapon, so the entire ranged-positioning branch of the AI is dead code for the default party.

**The consequence, measured over 322 fights at d2/L2:**

| | share of attacks taken | downs | deaths |
|---|---|---|---|
| Fighter | 19.3% | 52 | 21 |
| Rogue | 15.5% | 58 | 34 |
| **Cleric** | **38.9%** | 204 | **216** |
| **Wizard** | **26.2%** | 200 | **223** |

Two of four heroes take **65% of the incoming** and account for **89% of deaths**.

**P1a is the fix: give Staff and Mace a `weapon_range` in content.** Measured alone, 200–300 runs per cell:

| cell | shipped | **P1a** |
|---|---|---|
| d1 L1 | 69.3% / 14.0% wiped | **73.3% / 10.3%** |
| d2 L2 | 53.3% / 23.3% | **56.7% / 17.0%** |
| d3 L3 | 28.7% / 44.0% | **36.7% / 37.0%** |

Backline share of deaths falls 87.9% → 69.5%. It is worth +4 to +8 points of completion on its own, and it is **data, not code** — one column in the seed DB, through `pnpm convert`.

**Caveat worth your call:** giving the staff a range also lets the wizard *poke* at range with it. If you'd rather the wizard never make a ranged weapon attack, the alternative is a code fix in `desiredPosition` keyed on `isCaster` — which I costed as P1b and which **failed** (see §4). P1a is the one that works.

---

## 2. The threat mechanic — it works, and it makes things worse

Per your scope call I built and measured it: a `threat` value on the combatant, added to `scoreTarget`, with the fighter carrying 150.

**Mechanically it does exactly what it should.** At d1/L1: share of attacks landing on the front line **32.0% → 70.1%**; backline share of deaths **87.9% → 40.9%**.

**And the party does worse.**

| d1 · L1 | completed | wiped |
|---|---|---|
| shipped | 69.5% | 14.0% |
| **threat: fighter 150** | **66.0%** | **22.5%** |
| threat + P1a + heal at .6 | 64.0% | 22.5% |

Same shape at every cell tested: d2 51.0% (from 50.5%) at 27.0% wipes; d3 32.0% at **42.5%** wipes; d4 8.0% at **55.5%** wipes.

**Why:** the fighter has AC 16, no damage reduction and no mitigation of any kind. Redirecting the party's incoming damage onto one hero with no way to survive it just kills that hero faster — and the fighter is the party's only real damage dealer, so losing him early loses the fight. Concentrating damage is only good if the target can take it.

**This is the brief's most important negative result: a threat mechanic must ship WITH tank survivability, or it is a net loss.** The content already has the hooks — `Parry` (Fighter, level 6) and `Intimidating Strike` (Fighter, level 2) both exist as `combat_action` feats. But that raises §3.

---

## 3. The ability gap — 51 combat actions the AI cannot reach

Two independent findings, both structural:

**The loadout vocabulary has no verb for them.** `LoadoutEntry` is `strike | cast | toggle`. The feat registry classifies **51 feats as `combat_action`** — Power Attack (Fighter, level 1), Double Slice (1), Sudden Charge (1), Tumble Through (Rogue, 1), Quick Draw (1), Intimidating Strike (2), Knockdown (4), Parry (6)… **None of them can be expressed in a loadout.** There is no way for the AI to use any of them.

**And three of four starter heroes have no feats at all.** `muster.ts`: Fighter `feats: []`, Cleric `feats: []`, Wizard `feats: []`. Only the Rogue has any (Sneak Attack, Nimble Dodge, Trap Finder — all passive or reaction). Auto level-up takes `feats: []` as policy, so the Fighter never acquires Power Attack even though it is available at level 1.

So "the fighter isn't using abilities" is true twice over: it has none, and the loadout couldn't express them if it did.

**This is the prerequisite for the threat mechanic**, since Parry and Intimidating Strike are exactly the survivability and threat-generation the mechanic needs, and both are `combat_action`.

**Healing, for completeness:** 0.29 heal events per fight, ~2.4 HP per fight. The cleric has exactly one loadout entry (Heal below 40%), gated on the few slots a low-level cleric has. Raising the trigger to 60% was measured and moved outcomes very little on its own; healing is thin because slots are thin, not because the threshold is wrong.

---

## 4. What failed, reported rather than buried

**P1b — "casters hold a standoff band regardless of weapon" — is broken and its numbers are not usable.** Implemented in `desiredPosition` keyed on `isCaster`, it produced 12,000–33,000 hero deaths across 200 runs (a 4-hero party) and 36–79 forced stalemates. The mechanism: a caster that refuses to close and has a melee-only weapon cannot finish a fight once its spell slots are gone, so combats churn in the dying/recovery loop instead of ending.

That is a real design constraint, not just a probe bug: **any "casters stay back" rule needs the caster to retain a way to contribute at range.** P1a satisfies that by giving the staff a range; a pure positioning rule does not. I am reporting P1b's failure because its *completion* numbers looked superficially fine (52–60%) and its wipe rates looked excellent (2.5–3.5%) — both artefacts of fights that never resolved. They should not be cited.

---

## 5. The caution dial — real, weak, and it has a floor

Sweeping `withdrawHpFrac`, tiny d2 L2, 200 runs, shipped AI:

| threshold | completed | retreated | **wiped** |
|---|---|---|---|
| bold .18 (shipped) | 53.5% | 16.0% | 30.5% |
| bold .28 | 50.5% | 21.0% | 28.5% |
| standard .35 (shipped) | 50.5% | 21.0% | 28.5% |
| standard .45 | 46.5% | 26.5% | 27.0% |
| standard .55 | 41.0% | 37.0% | 22.0% |
| cautious .55 (shipped) | 41.0% | 37.0% | 22.0% |
| cautious .65 | 37.5% | 42.5% | 20.0% |
| cautious .75 | 28.5% | 56.5% | **15.0%** |

Three readings.

1. **The dial works and is monotone** — your "does a cautious party actually go home" question is a yes. A dying hero counts 0 in `partyHpFrac`, so two of four down caps the pool at 0.50 and a cautious party turns around.
2. **The bands are purely the threshold** — cautious .55 and standard .55 produce identical numbers. There is nothing else distinguishing them.
3. **The exchange rate is poor and there is a floor.** Going from .35 to .55 costs 9.5 points of completion to buy 6.5 points of wipe reduction. Pushing all the way to .75 still leaves **15% wipes** while cratering completion to 28.5%. **You cannot reach a low wipe rate with this dial** — the wipes happen *inside* fights, and a between-rooms check cannot prevent them.

This is the measured case for the mid-combat withdrawal you declined. I am not re-arguing the decision; I am recording that the between-rooms model has a floor around 15% wipes at this difficulty, so if you want wipes below that, it will have to come from combat itself rather than from the dial.

---

## 6. Options, costed

| id | change | kind | measured effect | risk |
|---|---|---|---|---|
| **P1a** | `weapon_range` on Staff and Mace | **content** (seed DB + `pnpm convert`) | +4 to +8 pts completion, wipes −4 to −7, backline deaths 88% → 70% | wizard gains a ranged weapon poke; content ids untouched |
| **P2** | `AI_WEIGHTS.spellcaster` 75 → 25 | **data** | ~+1 pt, backline deaths unchanged | almost nothing; the weight is not the cause |
| P2b | `AI_WEIGHTS.spellcaster` 75 → 0 | data | −2.5 pts, wipes +3.5 | makes it worse |
| **P3** | threat register + `scoreTarget` term | **new system** | front line attacked 32% → 70%, backline deaths 88% → 41%, **completion −3.5, wipes +8.5** | net negative without §3 |
| **A1** | `combat_action` verb in `LoadoutEntry` | **new system** | unmeasured — unlocks 51 feats | prerequisite for P3 being positive |
| **A2** | give the starter Fighter/Cleric/Wizard level-1 feats | content | unmeasured | changes the founding muster; `career-distribution` will move |
| **C1** | caution thresholds | data | see §5 table | shallow; cannot fix wipes |

---

## 7. What I'd suggest, and what is yours to call

**Take P1a now.** It is a null column, it is the single cleanest win in this document, and combined with brief #14's already-approved R2+H4 it clears your 80% target at the entry dungeon (85.7% / 7.7% wiped).

**Do not take P3 yet.** The threat mechanic is measured to make the game worse in its current form. It needs A1 (a `combat_action` verb) and tank survivability (Parry) first, or it hands the party's damage dealer a death sentence. I would brief A1 → tank abilities → P3 as a sequence, not a bundle.

**Leave the caution thresholds alone for now.** They are working as designed and the dial cannot reach a low wipe rate. Re-tune them after the AI changes land, because the AI changes move what the thresholds mean.

**The remaining at-level slope (85.7 → 75.7 → 49.7 → 14.0) is not an AI problem.** d4 is where the `small` tier and brief #14's attrition wall take over. That is enemy tuning and the wall work, not positioning.

**Open decisions for you:**

1. P1a — take it? And should the wizard's staff be a real ranged weapon, or should the range be cosmetic-for-AI-only?
2. A1 (`combat_action` in the loadout) — worth its own brief, or fold into #15?
3. A2 — giving the founding heroes level-1 feats changes the muster and will move the `career-distribution` baseline. In scope?
4. P3 sequencing — confirm it waits for A1 and tank survivability.

---

## 8. Risks and watch points

- **Nothing guards dungeon generation or combat distribution against these.** `encounter-distribution` uses hand-authored rosters, so P1a/P2/P3 will move it — that is correct and the commit must say why. The dungeon regression harness (brief #14 §10.4, approved as prerequisite) still applies.
- **P1a moves `encounter-distribution` and every dungeon stream hash**, because positioning changes movement events. Expect the baseline to move; it should be re-baselined deliberately, not silently.
- **A2 would move `career-distribution`** (avg final level, gold, wipe rate), because it changes the founding party.
- **`combat.unit_fled` remains emitted nowhere.** Mid-combat withdrawal was declined, so this stays a dead branch — worth leaving logged rather than removing, since the schema is frozen and additive-only.
- **Negative controls required** on every regression test that comes out of this.
- **Windows check** — none of this adds files, but P1a touches generated content and A1 touches the loadout type used by every combatant. `pnpm dev` after.

---

## 9. Decision record

**Superseded by §11** — this brief was rewritten by §10 before Steven ruled on §§1–8, so the decisions live there. §11.2's one open conflict was closed 2026-08-13; see §12 for what shipped.

---

## 10. Cantrips — Steven's proposal, measured. It supersedes P1a.

**Asked 2026-08-12:** *"Can we turn to cantrips? Low damage spells. That these types default to over melee weapons?"*

**Answer: yes, and it is decisively better than P1a.** It also explains and repairs P1b's failure.

### 10.1 What the registry already has

27 spells at `spell_level: 0`, seven of them `effect_type: damage`, all at-will (`canAfford` returns true for level ≤ 0):

| id | name | list | dice | **scaling** | range |
|---|---|---|---|---|---|
| 12 | **Telekinetic Projectile** | arcane, occult | 1d6 | 2d6 @3 · 3d6 @5 · 4d6 @7 · 5d6 @9 | **6** |
| 1 | Electric Arc | arcane | 1d4 | 2d4 @3 · 1d6+2d4 @5 | 6 |
| 14 | **Divine Lance** | divine | 1d4 | 2d4 @3 · 1d6+2d4 @5 | **6** |
| 3 | Produce Flame | arcane, divine | 1d4 | 2d4 @3 · 1d6+2d4 @5 | 6 |

`scaledDice()` in `spells.ts` already implements the curve — *"highest scaling entry ≤ casterLevel overrides base dice"*. So a cantrip is **a level-scaling, at-will, ranged attack that already works**. Nothing needs authoring.

For comparison, what those two heroes do today: the wizard swings a Staff for **1d6−1** (STR 8 → −1) in melee, average 2.5. Telekinetic Projectile is 3.5 at level 1 and 10.5 at level 5, at range 6, for free. **The wizard's cantrip beats its own weapon from level 1 and never runs out.**

### 10.2 The measurement — and it is the *combination* that matters

`tiny`, at level, 250 runs per cell. "standoff" = `desiredPosition` uses an engagement range derived from the unit's intended action rather than from its weapon.

| variant | d1 L1 completed / wiped | d2 L2 | d3 L3 | hero deaths (d1) | stalemates |
|---|---|---|---|---|---|
| C0 shipped | 72.0% / 12.0% | 49.6% / 26.4% | 30.0% / 41.2% | 686 | 0 |
| C1 **cantrip only**, no repositioning | 69.6% / 12.8% | 50.4% / 23.2% | 27.6% / 42.4% | 582 | 0 |
| C2 **standoff only** (= the failed P1b) | 60.4% / 4.4% | 40.0% / 4.0% | 35.6% / 8.0% | **3,940** | **77** |
| **C3 cantrip + standoff** | **92.0% / 3.6%** | **78.0% / 4.4%** | **60.8% / 9.6%** | **156** | **0** |
| P1a staff/mace range 6 | 74.4% / 11.2% | 58.4% / 22.4% | 38.0% / 32.0% | 428 | 0 |

**Neither half works alone.** The cantrip without repositioning is worth nothing (69.6% vs 72.0%) — they cast it and still walk into the front rank. Repositioning without the cantrip is P1b's catastrophe — 3,940 hero deaths and 77 stalemates, because a caster that won't close and has no ranged attack cannot end a fight.

**Together they are transformative**, and the diagnostic numbers confirm the mechanism is sound rather than broken: hero deaths fall **686 → 156**, stalemates stay at **0**, and casts per fight rise **1.01 → 5.23** — the casters are finally acting every turn instead of trudging forward.

### 10.3 The full stack against the 80% target

300 runs per cell. "CANTRIP" = C3 above.

| at level | shipped | R2+H4 (approved) | R2+H4+**P1a** | **R2+H4+CANTRIP** |
|---|---|---|---|---|
| **tiny d1 · L1** | 71.7% / 12.7% wiped | 79.3% / 17.0% | 85.3% / 10.3% | **95.0% / 2.3%** |
| **tiny d2 · L2** | 54.0% / 23.0% | 69.3% / 25.3% | 69.0% / 21.7% | **92.7% / 3.7%** |
| **tiny d3 · L3** | 28.7% / 44.3% | 42.3% / 49.0% | 42.3% / 46.0% | **79.0% / 11.0%** |
| small d4 · L4 | 5.0% / 48.3% | 10.3% / 67.7% | 13.0% / 68.0% | **36.3% / 38.7%** |
| small d5 · L5 | 6.7% / 36.3% | 20.7% / 57.3% | 18.7% / 61.3% | **44.0% / 28.7%** |

**Difficulties 1–3 now sit at 95% / 92.7% / 79% — at or above the 80% target — with wipe rates of 2.3% / 3.7% / 11.0%.** The at-level curve is also far flatter than before (95 → 92.7 → 79, against shipped 71.7 → 54 → 28.7).

Note what R2+H4 does *alone* to wipes: it raises them (12.7% → 17.0% at d1, 48.3% → 67.7% at d4), the "opened doors, more dying" effect from brief #14 §10.2. **The cantrip fix is what converts that reach into survival.**

### 10.4 The risk gradient Steven asked for is intact and clean

| party | at level | **punching up one** | cost |
|---|---|---|---|
| L1 | 95.0% (d1) | **75.3%** (d2) | −20 pts, wipes 15.3% |
| L2 | 92.7% (d2) | **55.7%** (d3) | −37 pts, wipes 31.3% |
| L3 | 79.0% (d3) | **22.3%** (d4) | −57 pts, wipes 55.3% |

Punching above your weight class is measurably worse and gets sharply worse the deeper you do it. Whether −57 points at L3 is *too* punishing is a tuning conversation, not a systems one.

### 10.5 What this changes in this brief

* **P1a is superseded.** Giving the Staff a `weapon_range` was a workaround for the AI's melee classification; cantrips fix the actual thing — the caster now has a real ranged action, so positioning follows naturally and the staff stays a stick. At d2 the difference is 69.0% vs 92.7%. **Withdraw P1a; take cantrips.**
* **The right code change is smaller and more principled than P1a's:** engagement range should derive from **what the unit intends to do** (its top affordable loadout action), not from the weapon in its hand. `spellRange()` already exists and already returns 6 for these. This wants a distinct field on `Combatant` (e.g. `engageRange`) so `weaponRange` continues to govern weapon strikes — a caster should hold at 6 and cast, not swing a staff at 6.
* **The content change is two loadout entries**, not a data migration: Cleric = `Heal` (below 40%) → `Divine Lance` (always); Wizard = `Magic Missile` (always) → `Telekinetic Projectile` (always). Both cantrips already exist with the right spell lists.
* **§2's threat verdict is unchanged and now clearer.** With the back line no longer standing in the front rank, backline share of deaths falls from ~90% to 62–70% without any threat mechanic at all. A taunt still needs tank survivability before it earns its place.
* **§5's caution floor is comprehensively beaten** — not by the dial, but by the fight itself. Wipes at d1 go 12.7% → **2.3%**, far below the ~15% floor the threshold sweep could reach. That vindicates declining mid-combat withdrawal: the wipes were a positioning problem, not a doctrine problem.

### 10.6 Revised recommendation

One milestone, after the dungeon regression harness: **cantrip loadouts + intent-derived engagement range + R2 + H4 + bugs A/B.** Drop P1a. Hold the threat mechanic and the `combat_action` verb for a later brief.

**Open calls this raises:**

1. Which cantrip for each? I measured Telekinetic Projectile (wizard, 1d6 → 5d6) and Divine Lance (cleric, 1d4 → 1d6+2d4). Produce Flame is on both lists if you'd rather they share.
2. Should cantrips be **granted at the muster** (content: the founding templates gain a known cantrip) or **derived** (any caster defaults to the best at-will damage spell on its list)? Derived is cheaper and self-maintaining as content grows; granted is more legible to the player and fits the paper-doll/loadout screen you described.
3. `engageRange` on `Combatant` — a derived field in `assembleHero`, or computed per-tick from the current loadout pick? Derived is cheaper; per-tick is more correct once loadouts get conditional.

---

## 11. DECISION RECORD — 2026-08-12 (Steven)

**Brief #15 is APPROVED as scoped in §10.** One milestone, landing **after** the dungeon regression harness: cantrip defaults + intent-derived engagement range + R2 + H4 + bugs A/B. The threat mechanic (§2) and the `combat_action` loadout verb (§3) are **held for a later brief**.

| decision | call |
|---|---|
| Scope | **Approved as scoped** — one milestone, harness first |
| Cantrips | **Electric Arc** (wizard) + **Divine Lance** (cleric) |
| Grant model | **Derived from the class spell list**, not authored on the muster templates |
| `engageRange` | **Derived once in `assembleHero`**, not per-tick |

### 11.1 The approved pick, re-measured

The §10 tables used Telekinetic Projectile for the wizard. Re-measured with **Electric Arc**, 300 runs per cell, with R2+H4 applied:

| at level | shipped (no cantrip) | **APPROVED: Electric Arc + Divine Lance** | (TK + Lance, for reference) |
|---|---|---|---|
| tiny d1 · L1 | 80.0% / 15.3% wiped | **92.0% / 2.0%** | 93.0% / 3.0% |
| tiny d2 · L2 | 72.3% / 19.3% | **91.3% / 4.3%** | 91.0% / 1.7% |
| tiny d3 · L3 | 38.3% / 47.7% | **76.0% / 13.0%** | 78.3% / 9.0% |
| small d4 · L4 | 11.7% / 70.3% | **33.3% / 41.0%** | 37.3% / 36.0% |
| small d5 · L5 | 16.7% / 63.3% | **47.0% / 29.0%** | 47.3% / 29.7% |

**Electric Arc is within noise of Telekinetic Projectile** — ≤4 points everywhere, mostly ≤2, despite 1d4 vs 1d6 base dice. The cantrip's value is overwhelmingly that it exists at range and is free, not its damage. **The spell choice is therefore essentially free and should be made on flavour, not numbers.** Stalemates 0 and hero deaths in the low hundreds at both picks — the mechanism is sound.

Difficulties 1–3 land at **92.0 / 91.3 / 76.0** against the 80% target.

### 11.2 ⚠ One conflict the decisions surface — needs a one-line answer

**"Derived from the class spell list" and "Electric Arc" do not agree**, because no simple derivation rule yields the chosen pair:

| derivation rule | arcane picks | divine picks |
|---|---|---|
| best expected damage | Telekinetic Projectile (1d6) | Divine Lance / Produce Flame (1d4, tie) |
| lowest content id | **Electric Arc** (id 1) | Produce Flame (id 3) |
| authored designation | Electric Arc | Divine Lance |

Only an **authored designation** produces exactly Electric Arc + Divine Lance.

**Recommendation:** keep the derivation (candidates come from the class spell list, so it stays self-maintaining as content grows) but let content mark a preferred default — a `default_cantrip` flag or equivalent on the spell row, falling back to best-expected-damage when nothing is marked. That honours both answers, keeps the muster untouched, and costs one nullable column. Since §11.1 shows the numbers barely move, designating for flavour is free.

**If Steven would rather not add a column:** take "best expected damage", accept Telekinetic Projectile for the wizard, and the numbers get marginally *better*.

### 11.3 Implementation notes for the next session

* `engageRange` is a **new field on `Combatant`**, derived in `assembleHero` as `max(weaponRange, bestAtWillOffensiveSpellRange)`. `weaponRange` keeps governing weapon strikes — a caster must hold at 6 and cast, never swing a staff at 6. `spellRange()` already exists in `spells.ts` and already returns 6 for these.
* `desiredPosition` in `ai.ts` reads `engageRange`; `isMelee` becomes `engageRange <= ENGAGEMENT_RANGE`. Keep the existing deadband comment — the 0.95/0.99 gap is a load-bearing harness finding.
* **Both halves must land together.** §10.2: the cantrip alone is worth nothing (69.6% vs 72.0%) and the repositioning alone is catastrophic (3,940 hero deaths, 77 stalemates). Landing either half by itself will read as a regression.
* **Baselines WILL move**, deliberately: `encounter-distribution` (positioning and casting both change) and `career-distribution` (surface fights change too). Re-baseline consciously and justify it in the commit.
* **No schema growth.** `combat.spell_cast` and `combat.unit_moved` already exist and already carry what's needed. `combat.unit_fled` stays a dead branch.
* **Negative controls required** on every regression test that comes out of this.

---

## 12. IMPLEMENTATION RECORD — 2026-08-13

Shipped as one milestone after brief #16's harness (`d6f8527`). **444 unit + 10 e2e** green, bundle 1,232.52 → **1,237.91 kB**.

### 12.1 §11.2's open conflict, closed

**Steven's call: a `default_cantrip` marker in content, with best-expected-damage as the fallback.** Candidates still come from the class spell list, so the rule stays self-maintaining as content grows; content only expresses a preference among them. `defaultCantripFor()` lives in `spells.ts` and is a set intersection on the comma-separated `spell_list` on both sides, not a string compare.

The column cost nothing to add: the converter is `SELECT *` and the count gates count ROWS, not columns, so `ALTER TABLE spells ADD COLUMN default_cantrip` needed no tooling change and no gate change.

### 12.2 The measured result

At level, 300 runs/cell, `fullExplore`/`standard`, under brief #16's gear bracket:

| at level | before the milestone | **after** | §11.1 predicted |
|---|---|---|---|
| tiny d1 · L1 | 72.3% / 9.0% wiped | **91.7% / 4.7%** | 92.0 / 2.0 |
| tiny d2 · L2 | 58.7% / 18.0% | **85.3% / 8.3%** | 91.3 / 4.3 |
| tiny d3 · L3 | 42.3% / 25.7% | **80.7% / 12.3%** | 76.0 / 13.0 |
| small d4 · L4 | 10.7% / 33.0% | **39.7% / 35.0%** | 33.3 / 41.0 |
| small d5 · L5 | 8.3% | **49.3%** | 47.0 |

**All three contract cells clear the 80% target.** Deltas from §11.1's predictions are −0.3 / −6.0 / +4.7, every one inside the ±8-point bar brief #16 §3 established — so this **verifies** §11.1 rather than merely agreeing with it. `dungeon-curve`'s `PHASE` flipped to `'target'` as the milestone required, and its floors were re-anchored to what this measured rather than to the prediction.

### 12.3 What shipped, precisely

* **`engageRange`** — a new required field on `Combatant`, derived once in `assembleHero` as `max(weaponRange, defaultCantripRange)`. `ai.ts` positions on it; `weaponRange` still governs weapon strikes, so a caster holds at 6 and casts rather than closing to 6 and swinging a staff. `inAttackRange` moved to `engageRange` too, otherwise a caster's standoff move emits no `unit_moved` event and the field renders it as never having moved.
* **The cantrip is APPENDED to the loadout, never prepended.** The muster's authored priorities still win while affordable — the Wizard spends Magic Missile, the Cleric heals — and `canAfford` drops through to the cantrip once the slots are gone. §10.5 proposed *replacing* those entries; appending is strictly better and needed no muster change at all.
* **R2** rewrote rest charges from a `Set<number>` of node ids to a count the party carries, plus one per `PROFILES.roomsPerRestCharge` rooms. No RNG draw added or removed, so seeds stay comparable.
* **H4, bug A, bug B** as recorded in brief #14 §9.

### 12.4 Baselines: three moved, not the four §11.3 predicted

* `dungeon-curve`, `dungeon-distribution` — substantially, as intended.
* `career-distribution` — **trivially**: completion 0.910 → 0.913, wipes 0.090 → 0.088, nothing else. The autopilot takes only short surface combat quests, so a cantrip barely registers.
* `encounter-distribution` — **did not move at all.** It builds combatants by hand and never runs `assembleHero`, so it has no cantrip and `engageRange` defaults to 1. §11.3 expected positioning changes to reach it; they cannot. This is brief #16's central finding demonstrated from the other side.

### 12.5 Negative controls — §10.2's central claim, made executable

| revert | observed |
|---|---|
| M1 bug A | 3 failures — the whole BUG A block |
| M2 bug B (doubled dice restored via db round-trip) | 2 — the BUG B block |
| **M3 CANTRIP ONLY** (`engageRange` → `weaponRange`) | **3** — contract floor, the 80% target, baseline |
| **M4 REPOSITIONING ONLY** (no cantrip in the loadout) | **6 — everything** |
| M5 H4 reverted | 3 — contract floor, target, baseline |
| M6 R2's per-4-rooms charge | 1 — baseline only |

**M3 and M4 are §10.2's "neither half works alone" as a running test.** M4 is the more striking: it broke six tests and its runtimes went from ~4 s to **21 s and 17 s** — the P1b stalemate signature showing up as wall-clock, because casters that will not close and cannot shoot produce fights that never resolve. §10.2 measured that as 3,940 hero deaths and 77 forced stalemates; here it is visible in the clock alone.

**M6 is the honest one.** Removing R2's extra charge moved only the snapshot, not the contract — at `tiny` (7 rooms) it is worth a single charge. R2's value is at `medium`/`large`, which the grid does capture: `fullExplore/medium` completion went 1% → 17% and rooms visited 6.5 → 10.4.

### 12.6 New cover, and one thing still open

Bugs A and B got their **first tests ever** (`tests/heroes/equipment.test.ts`, +7). Nothing in the repo had previously derived any of the nine striking rows — the existing test exercised `applyStriking` in isolation only, which is exactly how a weapon reading `2d8` came to fight as `3d8`.

**Still held, unchanged by this milestone:** the threat mechanic (§2) and the `combat_action` loadout verb (§3). §10.5 predicted backline deaths would fall to 62–70% without any threat mechanic, which the positioning fix delivers. Steven has since proposed **melee interdiction** — mechanically distinct from threat, since it changes *reachability* rather than target *selection*, so §2's "the fighter has no mitigation" result does not automatically transfer. That wants its own brief.
