# Brief #26 — Enemy abilities: making 45 statblocks fight differently

**Status:** FOR APPROVAL
**Author:** session of 2026-09-12
**Depends on:** #19 (AoO from content, the arena), #20 (creature size), #22 (ability
limiters on `Combatant`), #24 (weapon riders, the damage-type channel), #25 (conditions
with values)

---

## 1. The finding

`enemies.abilities` holds 35 distinct ability names across 21 of 45 rows. **`buildEnemy`
reads none of them.** It reads hp, ac, attack_bonus, damage_dice, speed, size and
`aoo_count`, and nothing else.

Every enemy in Guild Vigil therefore fights identically. A Wolf, a Skeleton and an Orc
Warrior differ only in their numbers — the Wolf does not hunt in a pack, the Skeleton is
not resistant to anything, the Orc does not refuse to die. The content has said otherwise
since the registry was authored.

This is the **fifth** occurrence of one defect in this repo: content authored against a
contract with no consumer, caught by nothing, because inert content breaks no test.
`class_weapon_proficiency` (44 rows), `items.onHitEffects` (20 properties),
`items.stat_bonus` (19 items) and the 96 buff/debuff spell rows were the first four.

### 1.1 What the player currently experiences

An auto-battler's whole pleasure is watching a fight resolve *differently* depending on
who is in it. Right now depth changes only the size of the numbers. A d1 fight and a d5
fight have the same texture.

---

## 2. Scope: only 19 of the 35 abilities can be met

`levelBand` is 1, so a dungeon of difficulty *d* draws enemies within one level of *d*.
Measured against the real registry:

| depth | spawnable rows | rows naming abilities |
|---|---|---|
| d1 | 13 | 5 |
| d2 | 20 | 9 |
| d3 | 18 | 7 |
| d4 | 18 | 8 |
| d5 | 15 | 5 |

**19 distinct abilities are reachable at d1–d5** (enemies of level ≤ 6). The remaining
**16 sit on L7+ rows that cannot spawn at playable depths** — `breath_weapon_6d6`,
`breath_weapon_12d6`, `flight`, `frightful_presence`, `tail_sweep`, `throw_rock_2d10`,
`trample`, `charm`, `dominate`, `gaseous_form`, `incorporeal`, `paralyzing_touch`,
`phylactery`, `spellcasting_5`, `spellcasting_9`, `dark_ritual`.

⚠ **Building the L7+ set would be unverifiable work.** Nothing can meet those enemies, so
no harness could measure the result and no playtest could see it. They are deferred to the
same brief that opens the 7+ band (R4, currently HELD).

### 2.1 The 19 reachable abilities, by how many enemies use them

| ability | uses | on |
|---|---|---|
| `undead_immunities` | 4 | Skeleton L1, Zombie L2, Ghoul L4, Wight L5 |
| `pack_tactics` | 1 | Wolf L1 |
| `trip` | 1 | Wolf L1 |
| `disease` | 1 | Giant Rat L1 |
| `trap_expertise` | 1 | Kobold L1 |
| `slow` | 1 | Zombie L2 |
| `poison` | 1 | Giant Spider L3 |
| `web` | 1 | Giant Spider L3 |
| `dark_bolt_1d6` | 1 | Cultist L3 |
| `formation_bonus` | 1 | Hobgoblin Soldier L3 |
| `ferocity` | 1 | Orc Warrior L3 |
| `paralysis` | 1 | Ghoul L4 |
| `sneak_attack_1d6` | 1 | Bugbear L4 |
| `stealth` | 1 | Bugbear L4 |
| `charge` | 1 | Minotaur L5 |
| `gore` | 1 | Minotaur L5 |
| `energy_drain` | 1 | Wight L5 |
| `regeneration_10` | 1 | Troll L6 |
| `fire_weakness` | 1 | Troll L6 |

---

## 3. What the engine already has

The cost of each ability is decided by whether its *referent* exists. Most do:

**Already built, usable unchanged:**
- `Combatant.weaponRiders` + `resolveWeaponRiders` (#24 M1) — on-hit damage and conditions,
  with a real damage TYPE per rider. The hook in `encounter.ts` reads `u.weaponRiders` for
  **whoever is swinging**, so it is already side-agnostic.
- `Combatant.abilityUses` / `abilityReadyAt` (#22 M2) — cooldowns and once-per-combat, and
  they die with the encounter, so **no save migration**.
- `Combatant.saves` — every enemy already carries fort/ref/will.
- `Combatant.sneakAttackDice`, `stealth`, `athletics`, `perception` — all populated.
- `applyCondition` + 14 condition ids including `prone`, `restrained`, `immobilized`,
  `sickened`, `fatigued`, `frightened`.
- `isFlanked` / `isFlatFooted` (#19) — the precedent `pack_tactics` needs.

**Not built:**
- **Damage resistance / weakness / immunity of any kind.** `applyDamage` takes a type
  string and does nothing with it. This is the one genuinely new system, and 3 of the 19
  abilities need it (`undead_immunities`, `fire_weakness`, and the resistance half of
  10 inert spell rows from #25 would light up alongside it).
- Regeneration (per-tick healing on a combatant).
- Any enemy-side ranged attack — `buildEnemy` hard-codes `weaponRange: 1` and
  `engageRange: 1`, with a comment saying the registry has no ranged rows yet.

---

## 4. Proposed milestones

Ordered so that **each milestone is measurable on its own**, and the cheapest,
highest-coverage work lands first.

### M1 — the rider abilities (no new systems)

Wire `enemies.abilities` into `buildEnemy` through the existing `weaponRiders` channel.

| ability | becomes |
|---|---|
| `poison` | on-hit rider, poison damage + `sickened` |
| `disease` | on-hit rider, `fatigued` |
| `trip` | on-hit rider, `prone` (athletics-opposed) |
| `gore` | on-hit rider, extra piercing damage |
| `energy_drain` | on-hit rider, damage + `fatigued` |
| `sneak_attack_1d6` | populates `sneakAttackDice` — the field already exists and strike.ts already reads it |
| `dark_bolt_1d6` | on-hit rider, force damage |
| `stealth` | a bonus to the existing `stealth` total (feeds the backstab check both ways) |

**8 of 19 abilities, zero new engine systems.**

### M2 — resistance, weakness, immunity

The one new system. `applyDamage` gains a per-combatant damage-type table.

- `fire_weakness` → Troll takes +50% from fire
- `undead_immunities` → immune to poison and disease riders (4 enemies)

⚠ This also lights up **10 inert spell rows** from #25 that author resistance, at no extra
cost — worth counting as part of M2's value.

### M3 — the positional and conditional abilities

- `pack_tactics` → attack bonus when an ally is adjacent to the same target (reuses
  `isFlanked`'s geometry)
- `formation_bonus` → AC bonus when beside an ally of the same base
- `charge` → a closing attack with bonus damage when the mover started far away
- `ferocity` → survives one killing blow at 1 hp, once per combat (`abilityUses` exists)
- `regeneration_10` → per-tick healing, cancelled for N ticks by its weakness type

### M4 — the save-gated control abilities

- `paralysis` → fort save or `immobilized`
- `web` → reflex save or `restrained`
- `slow` → the zombie's authored sluggishness as a real action-interval penalty
- `trap_expertise` → Kobold-only; needs the dungeon layer, not combat

⚠ **M4 is the one to cut if scope bites.** Control effects applied *to the party* by
enemies are the sharpest possible balance lever, and the curve is already overshooting.

---

## 5. Balance expectation, stated before measuring

The curve today: **95.0 / 92.7 / 89.3 / 61.3 / 71.0** at d1–d5, against a ~80% target.
It **overshoots at d1–d3** and the contract floors (84/78/73) sit slack beneath it.

Enemy abilities should push completion **down**, which is the direction the curve needs.
Steven's standing call (#22 D5) is that the curve is not a gate right now precisely
because enemy work had not been done — this is that work.

⚠ **A prediction is not a licence to re-baseline.** If a milestone moves the curve more
than the ±8 noise bar, the brief expects it and the snapshot moves with a justification in
the commit. If it moves it *less*, that is a signal the wiring is not reachable — the same
trap #20 and #21 both hit — and the exposure test below is what distinguishes the two.

### 5.1 The mandatory exposure test

Every milestone ships with a test that fails if the abilities are silently inert:

- **M1:** a fight containing a Giant Spider emits a `damage_applied` event with
  `kind: 'poison'`. Sabotage: stop reading `enemies.abilities` → the test fails.
- **M2:** a Troll takes strictly more damage from a fire source than from an equal
  untyped one.
- **M3:** two Wolves against one target roll at a higher effective bonus than one Wolf.
- **M4:** a Ghoul's strike can produce `condition_applied: immobilized`.

⚠ **The exposure tests are the deliverable, not a formality.** Every prior "free feature"
in this repo looked identical to a broken one on the curve.

---

## 6. Questions for Steven

**Q1 — Scope.** M1+M2 (11 of 19 abilities, one new system, lights up 10 spell rows too),
or all four milestones?

**Q2 — `undead_immunities` is currently a single word covering several rules.** In PF2E
it means immune to poison, disease, paralysis, sleep, bleed and mental effects. Model it
as the **full bundle**, or only the parts the engine can express today (poison + disease),
leaving the rest to light up as those systems land?

**Q3 — Resistance authoring.** M2 needs a damage-type table per enemy. Add a
`damage_resistances` column (a reviewable seed, columns are free), or **derive** it from
`enemy_type` (all undead get the undead bundle)? Derived is less content to author and
cannot drift; a column is more expressive per row.

**Q4 — `slow` on the Zombie.** The cleanest model is a longer action interval. That makes
the Zombie strictly weaker than its statblock suggests. Is a slow-but-tough enemy the
intent, or should `slow` instead mean it *ignores* speed penalties?

**Q5 — The 16 L7+ abilities.** Confirm they are deferred to the 7+ band brief rather than
built blind now.

---

## 7. Anti-goals

- **No new enemy rows.** This brief wires up the statblocks that exist; authoring new
  enemies is separate work with its own count-gate cost.
- **No enemy ranged attacks.** `buildEnemy` hard-codes melee. Changing that moves every
  closure time in the game and belongs with the arena/geometry brief.
- **No AI rewrite.** Abilities hang off existing hooks; `ai.ts` targeting is untouched.
- **No re-tune.** This brief will move the curve. Re-tuning *against* the moved curve is
  the next piece of work, not this one.
