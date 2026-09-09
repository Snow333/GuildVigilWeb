# Brief #22 — Character advancement for the founding four

**Status:** FOR APPROVAL. Implementation brief.
**Date:** 2026-09-09
**Scope:** Fighter (1) · Wizard (2) · Cleric (3) · Rogue (4) — the founding muster's classes.
**Companions:** `output/reference/four-class-content-audit.md` (every number below is measured
there), `output/briefs/character-workstream.md` (the sequence this brief opens),
`output/reference/pf2e-character-systems.md` (PF2E rates).

Supersedes the character-workstream note's split of #22/#23 into separate briefs: Steven's
2026-09-09 decisions merge feat selection, the `combat_action` verb, known spells and the
boost-rate change into **one player-facing character update**. Class features are pushed to
a later brief (§9, Q5).

---

## 0. The one-line problem

A hero the player levels up today gains **hit points, a save number, skill ranks, and once
every five levels a +2 to one ability**. Nothing else. The four `feat_slot_*` columns are
authored for all 460 progression rows and **nothing in `src/` reads them**; the level-up
wizard sends `feats: []` and `autoGrantedFeatIds: []` on every commit. Torvald swings a
longsword identically at level 1 and level 20.

This brief makes level-up a **choice** for the four founding classes.

---

## 1. What ships

| # | Milestone | Player sees |
|---|---|---|
| M1 | Feat slots read + prereqs + picker | "Choose a class feat" at the right levels |
| M2 | The `combat_action` loadout verb | Special attacks usable in the loadout |
| M3 | Known spells + filtered picker | A spellbook that grows |
| M4 | Boost-rate change to 4 × +1 | Four smaller boosts per milestone |
| M5 | Autopilot feat priority | "Level up for me" still works |

M1–M2 are the fighter/rogue half, M3 the caster half, M4 the shared stat half. They are
separately committable in that order; M4 is the only one that moves the dungeon curve on
its own.

---

## 2. ⚠ The readiness gate — and the correction that must land with it

Steven's decision: **one shared readiness gate for feats and spells, greyed with a reason.**
The obvious implementation is the content's own `"implemented": false` flag (115 of 227
feats carry it). **That flag alone is the wrong gate, and using it as authored would ship a
lie in 42 places.**

Measured:

- **Flag → engine, direction 1 (sound):** zero contradictions. No feat flagged
  `implemented:false` is actually wired. The flag never under-reports.
- **Flag → engine, direction 2 (unsound):** **42 unflagged feats have no consumer in the
  engine at all** — every `combat_action` (the verb doesn't exist yet), every
  `resource_grant`, `special`, `spell_modifier`, `stance`, `toggle`, and
  `conditional_stat_mod`. Power Attack, Rage, Flurry of Blows and the three Monk stances all
  read as "ready" and all do nothing.
- **Spells have no flag at all** — `implemented` appears in 0 of 218 spell rows.

The flag means *"the content spec is complete"*, not *"the engine does this"*. Those are
different questions and only the second one should grey out a picker row.

**The gate is therefore a conjunction, computed in code, not a column read:**

```
selectable(feat)  =  effects.implemented !== false          // content is specified
                  && EFFECT_HAS_CONSUMER[effect_type]        // engine can act on it
                  && (effect_type !== 'combat_action' || ACTIVE_WIRED.has(featId))

selectable(spell) =  RESOLVER_HANDLES.has(spell.effect_type) // 'damage' | 'healing' today
```

`EFFECT_HAS_CONSUMER` is a hand-maintained `Record<FeatEffectType, boolean>` living beside
`EFFECT_DOMAIN` in `heroes/featEffects.ts` — the module that already classifies all 227
feats at load. It is the single place a future brief flips a bit when it wires a domain.

⚠ **This map is a liar-in-waiting** and gets the same treatment brief #20 gave the size
feature: a test asserts that for every `effect_type` marked `true`, at least one feat of
that type demonstrably changes a resolver's output. Without it, marking a domain `true`
prematurely silently un-greys a menu of dead feats and every harness stays green.

### 2.1 Greying is a first-class player-facing state, not a hidden filter

A greyed row shows the feat name, its level, and a short reason from a FROZEN reason set:

| Reason id | Shown as |
|---|---|
| `not_yet_implemented` | "Not yet available" |
| `prereq_unmet` | "Requires <feat name>" / "Requires <skill> rank N" |
| `already_taken` | "Already taken" |
| `level_unmet` | "Requires level N" |

Per brief #8's law, **status colour is never the sole carrier** — every greyed row is
label-paired. Steven's stated intent is that dead content stays *visible as future content*,
so greyed rows are never hidden.

---

## 3. M1 — Feat slots at level-up

### 3.1 Reading the schedule

`class_progression` carries `feat_slot_class / _general / _ancestry / _skill` for all 460
rows. A level-up grants the row's four counts for the class being advanced.

Cumulative supply vs demand is measured in the audit §2. Two facts shape the UI:

- **Fighter's class track is 30 slots against 23 owned feats** — a PF1-style bonus-feat
  cadence (1 at odd levels, 2 at even) on top of the PF2E schedule. It runs **short from
  L16, by 7 at L20.**
- ⚠ **`feat_slot_ancestry` grants 5 per career and there are ZERO ancestry feats**
  (`select count(*) from feats where ancestry_id is not null` = 0). A 100% shortfall at
  every level for every class.

**Decision required (Q1, §9):** an unfillable slot must either be suppressed or shown as an
empty promise. This brief proposes **suppressing a slot kind entirely when its eligible pool
is empty**, and asserting in a test that the ancestry track is suppressed for all four
classes — so the day ancestry feats are authored, the test fails and tells us to un-suppress.
That is deliberately a **failing-on-success** test; it is the cheapest way to stop a dead
column rotting silently, which is exactly how `item_level` and `class_weapon_proficiency`
became CLAUDE.md's "still-dead content" list.

### 3.2 Prerequisites

Two shapes across all 227 rows, and no others:

| Shape | Rows | Check |
|---|---|---|
| none | 200 | — |
| `{"feat": "<name>"}` | 17 | hero holds a feat with that name |
| `{"skill_rank": {...}}` | 10 | hero's rank ≥ N |

⚠ **Feat prereqs are by NAME, not id** — and **"Reach Spell" and "Undisrupted Casting" each
exist twice** (Wizard #99/#219-adjacent, Sorcerer #114; Wizard #221, Cleric #225). A
name-keyed lookup must resolve within the hero's own class first, or a Sorcerer's Reach
Spell will satisfy a Wizard's prereq chain. Resolve name → id **once at load** into a
`Map<string, number[]>` and treat multiple hits as "any of these satisfies."

Prereq checking mirrors `checkClassEligibility`'s shape: a `{ met, reason }` result, so the
picker's grey reason comes from the same call that gates selection. No second code path.

### 3.3 Applying

`applyLevelUp` **already takes `feats` and `autoGrantedFeatIds` and already applies them
atomically.** M1 adds no mutation code — it adds a selector (`eligibleFeats(hero, classId,
level, slotKind)`) and wires the wizard tab. The atomic-commit guarantee is inherited.

---

## 4. M2 — The `combat_action` loadout verb

### 4.1 Why this is not a held decision

CLAUDE.md lists the `combat_action` verb as **"HELD by measurement"**, alongside the
threat/taunt mechanic. ⚠ **That is a drift and this brief corrects it.** Brief #15 §148 logs
the verb as *"unmeasured — unlocks 51 feats"*; the threat mechanic is the one with the
measured −3.5 completion / +8.5 wipes. They were held in the same sentence for *scope* and
the nuance eroded into a single "held by measurement" line.

There is no negative result to overturn. **CLAUDE.md's standing-decisions line must be
amended in the same commit as this brief** — the threat mechanic stays held by measurement;
the verb was held by scope and is now in scope.

### 4.2 What it is, in player terms

`LoadoutEntry` is `strike | cast | toggle`. A fourth member:

```ts
| { action: 'ability'; featId: number; condition: LoadoutCondition; target: LoadoutTargetSpec }
```

`pickAction` gains one branch, symmetric with `cast`: condition holds → target resolves →
**cost is affordable** → it wins. Same walk, same fallback to `DEFAULT_STRIKE`.

### 4.3 Which feats it wires

**Only the 9 unflagged actives across the four classes**, per §2's gate:

| Class | Actives | Feats |
|---|---|---|
| Fighter | 6 | L1 Power Attack · L2 Intimidating Strike · L2 Brutish Shove · L4 Knockdown · L8 Improved Knockdown · L10 Determination |
| Cleric | 2 | L2 Channel Smite · L6 Defensive Ward |
| Rogue | 1 | L2 Poison Weapon |
| **Wizard** | **0** | — |

Their payload verbs are: `strike_with_bonus`, `strike_plus_condition`, `strike_plus_shove`,
`strike_plus_trip` (×2), `remove_condition`, `strike_plus_channel`, `grant_ally_ac`,
`apply_weapon_poison`. Five of the nine are "a strike, plus a rider" — they reuse
`resolveStrike` wholesale and differ only in what fires on hit/crit. That is the cheap half.

⚠ **The Wizard gets nothing from M2** and the Cleric gets two situational actions. **M2 is a
Fighter feature.** This is the correct shape — the Fighter's identity in this content set is
active abilities (16 of 23 class feats), and the casters get their agency from M3 instead.
But it means M2 alone must not be read as "the character update"; M2 and M3 ship together or
the party is lopsided for a release.

### 4.4 Action economy — the sharp edge

⚠ Six of the nine cost **2 actions** (`"actions": 2`). **The combat engine has no
action-economy model.** Combat time is integer 100ms ticks and a unit acts every
`attackIntervalTicks`; there is no 3-action turn to spend from. A 2-action Power Attack has
nothing to cost it.

This is the one genuinely new mechanic in the brief and it must not be smuggled in. Two
options, and this is Q2:

| Option | Rule | Consequence |
|---|---|---|
| **A — interval multiplier** | a 2-action ability sets the next action's interval to `2 × attackIntervalTicks` | Power Attack = one bigger hit instead of two normal ones. Arithmetically near-neutral by design; cheap; no new state. |
| **B — cooldown** | ability sets a per-feat cooldown in ticks | Simple, but invents a number per feat that content doesn't carry. |
| **C — ignore cost** | fire abilities at normal interval | **Strictly better than striking, always.** Power Attack becomes a pure damage upgrade the AI takes every time. Rejected — it makes the loadout choice fake. |

**Recommendation: A.** It reads the `actions` field the content already authors, invents no
new numbers, and makes the choice a real trade (bigger hit vs. more hits) rather than a free
upgrade. It is also the only option whose balance impact is bounded a priori: at 2× interval
and 1 extra weapon die, Power Attack is close to neutral and the harness should confirm that,
which gives us a **calibration target rather than an open question**.

### 4.5 The exposure test is mandatory

Per the #20 precedent and CLAUDE.md's ±8-point precision rule: **a "free" feature and a
broken feature look identical on the curve.** Every one of these actives could silently
never fire and every harness would stay green.

`tests/combat/abilities.test.ts` asserts, on a seeded encounter, that a Fighter with Power
Attack in its loadout **emits an ability action at least once**, and that its
`attack_resolved` damage exceeds the same seed's plain strike. That is the negative control's
positive twin — without it M2 can no-op.

---

## 5. M3 — Known spells

### 5.1 The model

`HeroState` gains `knownSpells: number[]`, appended via a new backfill stage (constraint 8:
idempotent, early-return, seeded on entity id). Existing saves backfill from the muster
templates' hard-coded spells so no hero loses a spell.

Population on level-up: a caster picks **N new spells of a level they can now cast**, drawn
from their class's `spell_list` (`arcane` for Wizard, `divine` for Cleric — both matched with
`LIKE '%arcane%'` since 4 of 8 list values are multi-tradition).

The slot schedule is **already complete and already consumed** — `assembly.ts` reads all ten
`spell_slots_*` columns into `Combatant.casting.slots` and `spells.ts` decrements them. M3
builds the *pool*; the *spending* half needs no work.

### 5.2 ⚠ The filtered pool is small, and that is the honest number

`resolveCast` handles `damage` and `healing` only; 140 of 218 spells are inert.

| Caster | Levels 0–3 authored | Resolvable | Share |
|---|---|---|---|
| Wizard (arcane) | 72 | **17** | 24% |
| Cleric (divine) | 43 | **12** | 28% |

Worst cells: **arcane L1 is 3 of 22** and **arcane L2 is 2 of 16**. Per Steven's decision the
picker shows the rest greyed with `not_yet_implemented`.

⚠ **A choice between 3 options is a thin choice.** M3 delivers a real spellbook *structure*
on a pool that is mostly future content. This is worth stating plainly rather than
discovering at playtest: the wizard's felt agency after M3 is limited until `buff`/`debuff`
resolvers land (96 rows, the character-workstream's #25). **Recommendation: treat that
follow-on as the immediate next brief, not a someday item** — M3's value is unlocked by it.

### 5.3 Loadout editor

The loadout editor gains "add cast" drawing from `knownSpells ∩ resolvable`, and "add
ability" from M2's wired actives. The existing UI margin note — *"spell entries join the
editor with the known-spells model"* — is satisfied here.

---

## 6. M4 — Ability boosts toward the PF2E rate

Today: **4 boosts of +2**, at character levels 5/10/15/20 (`ABILITY_BOOST_LEVELS`), applied
atomically with retroactive CON HP. PF2E: **4 boosts at each of those levels — 16 total**,
to *distinct* attributes, +1 each above 18.

Steven's decision: **move toward PF2E's rate — more boosts, smaller each.**

**Proposal: 4 × +1 to four DISTINCT abilities, at the same four levels.**

| | Today | Proposed | PF2E |
|---|---|---|---|
| Boosts per milestone | 1 | **4** | 4 |
| Size each | +2 | **+1** | +1 (+2 below 18 in PF2E) |
| Raw points per milestone | +2 | **+4** | +4 to +8 |
| Career total | +8 | **+16** | +16 to +32 |

Why +1 rather than PF2E's below-18 +2: **modifier parity is what the curve feels.** Four +1s
spread across distinct abilities yields *at most* +2 modifiers per milestone and often +1,
against today's guaranteed +1. The change is a **widening**, not a doubling — it buys
secondary abilities (the Fighter's CON and DEX) rather than spiking the primary. That keeps
the tuned dungeon curve's headline term — the key ability's contribution to attack — nearly
unchanged, which matters because the curve already overshoots.

⚠ **Three existing behaviours must be re-derived, not inherited:**

1. **Retroactive CON HP** currently computes `modDiff × priorCharacterLevel` for a single
   `+2`. With four boosts it must sum across whichever boosts touched CON, and **modDiff is
   often 0** for a +1 (odd→even scores). The existing test pins the +2 behaviour and will
   need a deliberate re-baseline.
2. **Boost-before-class ordering** (a CHA-12 fighter boosting to 14 to enter Sorcerer in the
   same level-up) is a ledger-preserved nuance. With +1 boosts, **reaching the
   multiclass threshold of 13 from 12 now takes one boost instead of overshooting to 14** —
   the nuance survives but its arithmetic changes; `checkClassEligibility` must project *all
   four* pending boosts, not one.
3. **`skillPointsForLevel` projects the pending INT boost** (the fixed Godot bug). Same fix
   applies, now over a set.

⚠ **No maximum ability score is enforced anywhere in `applyLevelUp` today.** Four boosts per
milestone makes that more visible. **Q3:** adopt a cap, and at what value.

⚠ **This is the only milestone that moves the dungeon curve by itself**, and the curve
already overshoots (d1–d5 at 95.3/91.3/88.3/57.0/64.7 vs ~80% target). Per CLAUDE.md's
standing warning about interacting balance parameters, **M4 must land with a fresh
`dungeon-curve` run and its baselines moved consciously**, each justified in the commit.

---

## 7. M5 — The autopilot

Steven's decision: **fixed per-class predefined priority; manual level-up is the default;
autopilot is an option for players who want to skip the choices.**

That is a **player-facing feature**, not just a harness concern — it makes "Level up for me"
a button, and the same code serves the harness. One implementation, two consumers.

Priority lists are per-class ordered feat-id arrays in `src/content/` (data, not logic),
walked top-down and filtered by the §2 gate + prereqs. First eligible wins; if none is
eligible the slot goes unspent (never a crash).

⚠ **Every harness baseline moves when this lands**, because `buildAutoLevelUpPlan` starts
returning non-empty `feats`. Expected and correct — but per CLAUDE.md, snapshots are
load-bearing and `vitest -u` defeats them. Each moved baseline gets a justification line.

⚠ **`career-distribution` is already degenerate** (completionRate 1.0, every assertion a
one-sided floor, nothing can fire) — **it will not report whether M5 helped or hurt.** Do not
read it as evidence for this brief. The dungeon curve is the instrument.

---

## 8. Explicitly NOT in this brief

- **Class features** — 45 of 47 keys resolve to nothing. Steven's decision: separate brief
  after feats + spells ship. ⚠ Includes the audit's §3.1 finding that **the Rogue's
  sneak-attack ladder is authored twice** (in `class_progression` and in feat #68's scaling
  payload, agreeing only by arithmetic coincidence). That brief must pick one source of truth.
- **Ancestry feats** — 0 rows against 5 slots/career; ancestry is cosmetic by law.
- **The gear ladder** — `item_level` unread, shop sells no armour. Collides with the re-tune.
- **The 10 flagged-unimplemented Fighter actives** (Parry, Sudden Charge, Swipe, Lunge…) and
  the other 105 flagged feats.
- **`buff`/`debuff` spell resolvers** — but see §5.2: this is the natural *next* brief.
- **Widening the founding muster's class list** — content work with a starting-gear table.
- The flanking/concealment disagreement, the proficiency curve, `combat_action` for the
  other 9 classes.

---

## 9. Open questions — answer before implementation

**Q1 — Unfillable slots.** Ancestry grants 5 slots against 0 feats; Fighter's class track is
7 short at L20. Suppress the slot kind when its pool is empty (recommended, with a
failing-on-success test) · show it greyed as future content · author feats to fill it.

**Q2 — Action economy for 2-action abilities.** §4.4: interval multiplier (recommended) ·
per-feat cooldown · ignore cost (rejected — makes the choice fake).

**Q3 — Ability score cap.** None is enforced today. Adopt PF2E's soft +4-at-creation shape ·
a hard cap of 20 · 18-then-+1s · keep it uncapped.

**Q4 — Milestone order and release grouping.** §4.3: M2 alone is a Fighter feature and M3
alone is a caster feature. Ship M1+M2+M3 as one "character update" (recommended) · ship
incrementally and accept a lopsided interim · M4 first to absorb one re-tune.

**Q5 — Does M4 wait for the re-tune?** It is the only curve-moving milestone, and CLAUDE.md's
standing next-step is the re-tune. M4 before the re-tune (one re-tune absorbs it, recommended)
· M4 after (avoids tuning against a moving target) · M4 split into its own brief.

---

## 10. Test plan

| Area | Test | Negative control |
|---|---|---|
| Slot reading | Fighter L2 offers 2 class + 1 general + 1 skill | zero the columns → picker empties |
| Prereq chains | Improved Knockdown gated behind Knockdown | remove prereq → both offered at L8 |
| Name collision | Sorcerer's Reach Spell does not satisfy Wizard's chain | resolve by bare name → test fails |
| Readiness gate | every `EFFECT_HAS_CONSUMER: true` type has a feat that provably moves a resolver | flip a bit → test fails |
| Ancestry suppression | ancestry track suppressed for all four | author one ancestry feat → fails (by design) |
| **Ability exposure** | **Power Attack fires ≥1× and out-damages a plain strike, same seed** | **stub the branch → test fails** |
| Action economy | 2-action ability doubles the next interval | — |
| Known spells | backfill is idempotent; re-running changes nothing | — |
| Spell filter | arcane L1 offers exactly 3; the other 19 are greyed `not_yet_implemented` | — |
| Boosts | 4 distinct abilities, +1 each; CON retro-HP sums correctly across boosts | single-boost path → fails |
| Multiclass | 12 + one +1 = 13 satisfies the Sorcerer threshold | project one boost only → fails |
| Determinism | `EventStream.hash()` stable across runs with abilities in loadouts | — |
| Curve | `dungeon-curve` re-run at M4; baselines moved consciously | — |

Plus a grammar-audit line per brief #8 for both new surfaces (feat picker, spell picker).

---

## 11. Risks

1. **M4 moves the curve while the curve is already overshooting** — the largest risk, and Q5
   exists to place it.
2. **The readiness gate is a hand-maintained map** — §2's meta-test is the only thing keeping
   it honest, and a future brief flipping a bit prematurely un-greys dead content silently.
3. **Action economy is a genuinely new mechanic** in a sim with no turn structure. Option A
   is designed to be near-neutral, but "near-neutral" is a hypothesis the harness must check,
   and the ±8-point precision rule means a small real effect is unmeasurable at the curve's
   resolution. Prefer a **deterministic hash comparison** for "did anything change at all",
   per the #20 §9.4 lesson.
4. **M3's pool is 24–28% live.** Player-visible thinness until the buff/debuff brief.
5. **Every harness baseline moves at M5.** Snapshot discipline applies; `vitest -u` is not a
   substitute for justification.
6. **Windows verification gap.** These milestones add files and move module wiring. Green
   tests are not proof the app runs — Steven runs `pnpm dev` before each is called done.
