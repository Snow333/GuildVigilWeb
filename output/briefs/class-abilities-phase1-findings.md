# Feat audit — findings (SESSION-class-abilities.md Phase 1)

**Measured:** 2026-09-15, against commit `81d1444`.
**Instrument:** throwaway probes driving `isEffectReady`, `offersForSlot`, `assembleHero` and
`runEncounter` directly. Probes deleted; `git status` clean.

> **This document CORRECTS the brief's §3 table.** Per the repo's own rule, a findings companion
> wins on every measured fact. The brief's "83 live / 144 inert" is the readiness *predicate's*
> answer and it is too optimistic. The real number is **30**.

---

## 1. The headline: the gate itself is inaccurate

The brief asked for the 144 inert feats bucketed by blocker. Measuring that turned up something
larger: **`isEffectReady` overstates what works by 2.8×.**

| tier | what it measures | count | of 227 |
|---|---|---|---|
| authored | rows in `feats` | **227** | 100% |
| passes `isEffectReady` | the repo's own readiness gate | **83** | 37% |
| **reaches a consumer** | some code in `src/` actually reads it | **30** | **13%** |
| provably changed 10 real fights | empirical, event-stream diff | **20** | 9% |

**55 feats pass the gate and no consumer reads them.** The gate checks the effect *type* has a
consumer. But every real consumer matches on something narrower — a specific payload shape, and in
two cases the feat's **name**:

| consumer | site | feats it picks up |
|---|---|---|
| `resolveStatMods` | `featEffects.ts:214` | 8 |
| `resolveSkillMods` | `featEffects.ts:229` | 4 |
| `abilityDef` | `abilities.ts:103` | 9 |
| `executeToggle` | `encounter.ts:729` — **by name** | 4 |
| `reactionIds` | `assembly.ts:183` — **by name** | 2 |
| `weaponSpecBonus` | `assembly.ts:198` | 2 |
| `sneakDice` | `assembly.ts:168` — one payload shape | 1 |
| `partyDungeonBonus` | `featEffects.ts:244` | 1 |

`EFFECT_HAS_CONSUMER.passive_modifier = true` covers **119 authored feats and reaches one of
them** (Sneak Attack). That single `true` is where most of the 55 comes from.

This is the liar-in-waiting the module's own comment at `featEffects.ts:66` predicted. It is not
hypothetical any more.

### What that costs the player

`offersForSlot` greys a feat out **only** when `isEffectReady` is false. So the 55 are offered as
fully selectable:

| | count |
|---|---|
| distinct feats the picker will let a player take | **67** |
| …of which nothing in the engine reads them | **42** |
| **chance a player picking at random gets a dead feat** | **63%** |

Per class, share of *selectable* feats that do nothing:

| class | selectable | inert | % |
|---|---|---|---|
| Sorcerer | 22 | 13 | **59%** |
| Wizard | 23 | 13 | **57%** |
| Cleric | 25 | 14 | **56%** |
| Warlock | 20 | 11 | **55%** |
| Rogue | 25 | 12 | 48% |
| Barbarian | 19 | 9 | 47% |
| Monk | 22 | 10 | 45% |
| Ranger / Bard / the 3 hybrids | 16 | 7 | 44% |
| Fighter | 23 | 9 | **39%** |

Fighter is the best-supported class in the game and two of every five feats it offers are a lie.

---

## 2. Brief question 1 — the inert, bucketed by blocker

Using `isEffectReady`'s own evaluation order, of the 144 it rejects:

| primary blocker | count |
|---|---|
| `implemented: false` in the payload | 115 |
| `effect_type` has no engine consumer | 16 |
| `combat_action` not in `ACTIVE_WIRED` | 13 |

Overlaps: 29 are both flagged *and* unwired actives; 6 are flagged *and* consumer-less.

⚠ **This bucketing is the least useful half of the audit**, because it partitions the wrong 144.
The honest population is the **197 that reach nothing**, bucketed by hook in §4.

## 3. Brief question 2 — by `effect_type`

| type | authored | gate-ready | **reaches** | consumer flag |
|---|---|---|---|---|
| `passive_modifier` | 119 | 50 | **1** | `true` ⚠ |
| `combat_action` | 51 | 9 | 9 | `true` |
| `reaction` | 16 | 8 | **2** | `true` ⚠ |
| `resource_grant` | 12 | 0 | 0 | `false` |
| `stat_mod` | 8 | 8 | 8 | `true` |
| `special` | 6 | 0 | 0 | `false` |
| `skill_mod` | 4 | 2 | 4 | `true` |
| `stance` | 4 | 3 | 3 | `true` |
| `spell_modifier` | 3 | 0 | 0 | `false` |
| `weapon_spec` | 2 | 2 | 2 | `true` |
| `toggle` | 1 | 1 | 1 | `true` |
| `conditional_stat_mod` | 1 | 0 | 0 | `false` |

**Whole categories with no consumer at all:** `resource_grant` (12), `special` (6),
`spell_modifier` (3), `conditional_stat_mod` (1) — 22 feats, already correctly greyed.

The brief flagged `stance` and `resource_grant` as the ones to look at hardest. Measured:

- **`stance` is fine** — 3 of 4 work. The mechanism exists (`TOGGLE_CONDITIONS` →
  `conditions.ts`). Only `taunt_retaliate` is missing, and it needs a threat/taunt model.
- **`resource_grant` is confirmed as a system, not wiring** — 12 feats, 0 consumers, and it splits
  into *focus points* (8 more feats depend on it) and *spell-slot manipulation* (6).

Two feats are the reverse error — **gate says no, engine says yes**: Courtly Graces (#192) and
Experienced Smuggler (#193) are flagged `implemented: false` but `resolveSkillMods` reads them fine.

## 4. Brief question 3 — revival cost, by engine hook

Cost buckets in the abstract were useless (every passive is "one branch"), so this clusters the
**197 non-reaching feats by the engine hook that would revive them** — because one hook revives a
whole group. This is the build order.

**Existing hooks that must learn more verbs** (cheaper — the consumer exists):

| hook | feats | notes |
|---|---|---|
| `spells.ts` spell damage/effect modifier layer | 21 | unlocks most of Wizard/Sorcerer/Warlock |
| `abilities.ts` new active verb | 17 | Flurry of Blows, Sudden Charge, Lunge, Swipe… |
| `conditions.ts` stance/rage modifier layer | 12 | **all 12 are Barbarian** |
| `spells.ts` healing modifier layer | 11 | most of the Cleric identity |
| saves: conditional save modifier | 10 | Evasion, Diamond Soul |
| `strike.ts` flat-footed/sneak layer | 9 | **all 9 are Rogue** |
| `conditions.ts` conditional AC layer | 6 | Parry, Mobility, Protective Ward |
| `encounter.ts` reaction vocabulary | 6 | Combat Reflexes, Stand Still |
| `strike.ts` conditional damage layer | 5 | |
| `strike.ts` critical-hit rider | 5 | |
| `conditions.ts` condition application | 3 | |

**Genuinely new systems** (expensive):

| system | feats | also unblocks |
|---|---|---|
| out-of-combat / exploration verbs | 13 | |
| resource/focus pool | 12 | |
| focus points | 8 | overlaps the above |
| long-rest persistence on `HeroState` | 7 | #22's known third limiter tier |
| character-build layer (proficiency, pact, tradition) | 6 | |
| spell-slot manipulation | 6 | |
| spell geometry (range/area) | 3 | |
| metamagic | 2 | |
| summons/pets | 1 | |

34 more are miscellaneous one-offs with no shared hook.

**The concentration is the finding:** **42 feats** sit behind just three modifier layers
(spell-effect 21, stance/rage 12, flat-footed/sneak 9), and each maps to exactly one class's core
fantasy.

## 5. Brief question 4 — the five empty classes: authoring or engine?

**Pure authoring gap. The engine is ready and waiting.**

⚠ An earlier pass of this probe read the progression columns as `class_feat` and reported zero
slots for everyone. That was a probe bug — the real columns are `feat_slot_class` / `_general` /
`_ancestry` / `_skill`. Re-measured through the engine's own `slotsForLevel`:

| class | max lvl | class slots | general | ancestry | skill | **class feats authored** |
|---|---|---|---|---|---|---|
| Ranger | 20 | 10 | 10 | 5 | 10 | **0** |
| Bard | 20 | 10 | 10 | 5 | 10 | **0** |
| Arcane Trickster | 10 | 5 | 0 | 3 | 5 | **0** |
| Eldritch Knight | 10 | 5 | 0 | 3 | 5 | **0** |
| Mystic Theurge | 10 | 0 | 0 | 3 | 5 | **0** |
| *(Fighter, for contrast)* | 20 | 30 | 10 | 5 | 10 | 23 |

Ranger and Bard each get **10 class-feat slots across a career and are offered 0 feats**. The
picker runs, the slots are granted, the pool is empty. Authoring 23 rows each fixes them with no
engine work — *for feats whose verbs the engine already reads.*

Two side-findings:

- **The three hybrids inherit nothing.** Prestige classes get `class=0` offers; they see only the
  class-agnostic general (23) and skill (20) pools. Mystic Theurge is granted **zero class slots at
  all**, so it needs a progression decision before it needs content.
- **Ancestry feats: 5 slots per career against a pool of 0 rows** — no feat carries an
  `ancestry_id`. Already documented at `feats.ts:97`; re-confirmed, and it affects all 13 classes.

## 6. Method and controls

Every number came from driving real code, and each claim has a negative control. Three harness
bugs were caught **by those controls**, not by inspection:

1. A scalar-only Combatant filter silently dropped the `saves` object and `reactions` array —
   Iron Will and Nimble Dodge read as inert when they are not. Caught by the Lightning Reflexes
   control.
2. `ev.payload` does not exist; the field is `ev.data`. The fight harness hashed the string
   `"undefined"` for every event, so **every feat looked inert**. Caught by the Toughness control.
3. The fight harness handed a toggle/ability loadout row to *both* arms. `abilityDef` keys on
   featId and never checks ownership, so the ability fired in both and cancelled out. Caught by
   the Rage control.

The final fight harness passes 7 of 8 controls across every delivery path (assembly stat_mod,
payload-shape passive, wired active, toggle, stance, reaction, weapon_spec).

**The 8th is a known scenario limit, not a pass:** Determination (#8) clears a condition, and
nothing in a two-goblin fight ever applies one, so it cannot diverge. It is confirmed live by
`abilityDef` and by `tests/combat/abilities.test.ts`. This is why §1 reports **30 (reaches a
consumer)** as the honest figure rather than 20 — the fight number is a floor, bounded by what one
scenario can exercise, and 10 of the 30 are passives/actives this arena cannot express.

---

## 7. What this means for Phase 2

The brief's plan was 7 paths × 13 classes, each annotated with engine support. That is still the
right shape, but the annotation now has to be honest about a smaller base:

1. **12 of 30 working feats are generic** (Toughness, the save feats, initiative, Weapon Spec).
   Only **18 feats in the entire game express a class identity** — Fighter 7, Rogue 4, Monk 3,
   Cleric 2, Barbarian 1, Wizard 1, and **zero for Sorcerer, Warlock, Ranger and Bard**.
2. **Steven's own three examples land on the three biggest holes.** The damage-attracting tank
   needs a threat/taunt model (the one missing `stance`, and nothing else in the engine models
   threat). The weapon-type specialist needs `weapon_spec` beyond its 2 rows. The low-HP Barbarian
   is hook #3 — 12 feats, all Barbarian, all waiting on the stance/rage modifier layer.
3. **A specialization path is 3–5 feats.** At 17 identity feats total, the honest count of paths
   the engine can express *today* is roughly **three** — and two of those are Fighter.

So the paring question Steven wanted to ask ("7 → 3–5 per class") is premature in one specific
way: there is no point pricing 91 paths against an engine that can express three. The useful
version is to **pick the hooks first** — each of the top three revives 9–12 feats aimed at one
class's fantasy — and let the path list follow the hooks that get built.

That is a decision for Steven, framed as options in brief #29, not a call to make here.

---

## Summary

The feat audit found the system is worse off than the brief stated, and the reason matters: the
repo's own readiness gate is itself inaccurate, so the level-up picker currently offers players 42
feats that do nothing. The empty-class problem, by contrast, is smaller than feared — pure
authoring, no engine work.

- **30 of 227 feats reach the engine, not 83.** The gate checks effect *type*; real consumers match
  payload shape, and twice they match the feat's **name**.
- **A player picking a feat at random gets a dead one 63% of the time** — the picker greys on the
  inaccurate gate. This is the bug to fix first, and it is small.
- **Ranger and Bard are an authoring gap only** — 10 class slots each, 0 feats authored, engine
  fully working.
- **~42 dead feats sit behind just 3 modifier layers**, each mapping to one class's core fantasy
  (Barbarian rage, Rogue sneak, caster spell-effects).
- **Only 18 feats in the game express any class identity**, so Phase 2's "3–5 paths per class"
  should follow a hook decision rather than precede it.
