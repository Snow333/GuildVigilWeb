# Brief #23 — Items that know what class you are

**Status:** FOR APPROVAL. Implementation brief.
**Date:** 2026-09-09
**Scope:** Weapon/armour proficiency, the consumable verb + quick-slots, and the broken
scroll pointers — for Fighter (1) · Wizard (2) · Cleric (3) · Rogue (4).
**Companions:** `output/reference/itemization-summary.md` (the four-system survey),
`output/briefs/character-advancement-findings.md` (#22's record, incl. §4 statblocks).

Follows brief #22, which made *character* progression a choice. This one makes **gear** a
class decision rather than a slot-shaped free-for-all.

---

## 0. The problem in one line

`session.equip()` checks the slot and **nothing else**, and `assembly.ts` hardcodes
`isWeaponProficient: true` for every hero — so **Elandra the wizard can wear Full Plate,
swing a greatsword, and is fully proficient with it.** Gear is completely class-blind.

---

## 1. ⚠ The feature is mostly already built. Three pieces are wired and idle.

This is the cheapest brief in the queue, and the reason is that a previous session built
the mechanism and never populated it:

| Piece | State | Location |
|---|---|---|
| `NON_PROFICIENCY_PENALTY = -4` | **defined, referenced by nothing** | `content/combat.ts:41` |
| `Combatant.weaponPenalty` | **summed into every attack roll**, always `0` | `combat/strike.ts:112` |
| `isWeaponProficient` | gates `weaponSpecBonus`, **hardcoded `true`** | `campaign/assembly.ts:304` |
| `class_weapon_proficiency` | **44 authored rows, read by nothing** | CLAUDE.md's dead-content list |

The type comment on `weaponPenalty` already reads *"0, or NON_PROFICIENCY_PENALTY when
wielding unproficiently."* The design was decided; only the derivation is missing.

⚠ **CLAUDE.md calls `class_weapon_proficiency` "still-dead content" and that undersells
it.** It is not junk data — it is a working grant system in two shapes:

```
grant_type 'category' + grant_value 'simple'|'martial'   → a whole weapon class
grant_type 'weapon'   + grant_value 'rapier'|'staff'|... → one named weapon
```

Measured against the 62 weapon rows:

| Class | Grants | Weapons usable | Best mundane |
|---|---|---|---|
| Fighter | simple + martial | **62 / 62** | Greatsword 1d12 |
| Rogue | simple, +rapier/shortsword/shortbow/hand_crossbow | 26 | Crossbow 1d8 |
| Cleric | simple, +warhammer | 23 | Warhammer 1d8 |
| Wizard | dagger, dart, sling, staff, light_crossbow, crossbow | **7 / 62** | Crossbow 1d8 |

**That table IS the feature.** No authoring needed for weapons; the wizard's seven-weapon
list already makes "staff and crossbow" an identity instead of a suggestion.

---

## 2. M1 — Weapon proficiency, soft-gated

**Decision (Steven): soft. Off-class weapons work, at a penalty.** The player is never
blocked from equipping; they are shown what it costs.

### 2.1 Derivation

A new `heroes/weaponProficiency.ts`:

```
isProficientWith(hero, itemBase) =
  any class the hero has levels in grants
    category:<weapon_category>  OR  weapon:<slug(name)>
```

⚠ **Slug matching is the one fragile join and it needs care.** `grant_value` is
`light_crossbow`; the item is `Light Crossbow`, and the catalogue also holds
`Masterwork Longsword` and `Longsword +1`, which must match the `longsword` grant.
Normalisation: lowercase → strip a leading `Masterwork ` → strip a trailing ` +N` →
spaces to underscores. **A test asserts every `grant_value` in the table matches at least
one real item**, so a typo in either direction fails the build rather than silently
disarming a class.

⚠ **Multiclass keeps the highest**, mirroring `bestTier()`: a Fighter 1 / Wizard 4 is
proficient with martial weapons. Never intersect.

### 2.2 Applying it

Two effects, both through existing channels — no new event types, no new Combatant fields:

- `weaponPenalty = NON_PROFICIENCY_PENALTY` (−4) when unproficient.
- `isWeaponProficient = false`, which already suppresses `weaponSpecBonus`.

⚠ **−4 is the authored constant and this brief does NOT re-tune it.** For scale, a level-5
Torvald attacks at +9 (#22 findings §4); −4 is a ~20% swing on a d20. If that proves too
harsh it is a one-constant change, but changing it now would mean tuning a number before
seeing it fire.

⚠ **Enemies stay `isWeaponProficient: true`.** `buildEnemy` has no class and no
proficiency content; enemies are authored with their attack bonus baked in. Applying a
penalty they were never costed for would silently nerf every enemy in the game.

### 2.3 What the player sees

The gear tab labels off-class items — *"Greatsword — not proficient (−4 attack)"* — and
the paper-doll shows the penalty on the hero's attack line. Per brief #8, the warning is
**label-paired text, never colour alone**.

---

## 3. M2 — Armour proficiency (⚠ this half needs NEW content)

**Decision (Steven): author armour proficiency so heavy armour means something.**

⚠ **Unlike weapons, there is nothing to wire.** Measured: `class_weapon_proficiency` has
zero armour rows, and `class_proficiency_tiers` has six stats
(`fort_save`, `ref_save`, `will_save`, `weapon_attack`, `spell_attack`, `spell_dc`) — **no
armour stat**. This is authoring, not plumbing.

### 3.1 The proposed rows

Armour subtypes in the catalogue: `robes · padded · leather · studded · chain_shirt ·
chain_mail · scale_mail · half_plate · full_plate · heavy`. Grouped into four bands:

| Band | Subtypes | Fighter | Cleric | Rogue | Wizard |
|---|---|---|---|---|---|
| unarmoured | robes | ✔ | ✔ | ✔ | ✔ |
| light | padded, leather, studded | ✔ | ✔ | ✔ | ✔ |
| medium | chain_shirt, chain_mail, scale_mail | ✔ | ✔ | — | — |
| heavy | half_plate, full_plate, heavy | ✔ | — | — | — |
| shields | (item_type `shield`, 4 rows) | ✔ | ✔ | — | — |

Delivered as `data/seeds/seed_armor_proficiency.sql` extending
`class_weapon_proficiency` with `grant_type: 'armor'` + a band value — **reusing the
existing table rather than adding one**. Per CLAUDE.md, adding *rows* costs both count
gates in the same commit; adding a *column* costs nothing. This adds rows only.

⚠ **All 13 classes need rows, not just the four** — a half-populated table would leave the
other nine silently unarmoured. ~40 new rows.

### 3.2 The penalty for wearing armour you don't know

PF2E applies the armour's check penalty to more rolls and denies its AC. Our engine has
one clean lever already: `armor_check_penalty` (read by Stealth today, brief #19). Proposal:

- Unproficient armour applies **`armor_check_penalty` to attack rolls as well**, and
- suppresses the armour's **potency AC bonus** (the enhancement), keeping its base AC.

So a wizard in Full Plate still gets AC from the plate — it is physically armour — but
loses the magic and eats −3 to hit. **Q1 asks whether that is the right shape**, because
the alternative (deny all AC) makes the choice strictly wrong rather than a trade.

---

## 4. M3 — Consumables and quick-slots (the new player verb)

12 consumable rows exist and **none is usable**; there is no consumable concept in the sim
at all. Core-loop D3 locked **11 gear + 4 quick-slots + 2 weapon sets**; this delivers the
4 quick-slots. **Weapon sets stay out of scope** (Q3).

### 4.1 The content is clean — better than the summary claimed

⚠ **Correction to `itemization-summary.md` §7**, which implies consumables are stuck
behind the same rot as scrolls. Measured: **all 12 consumables resolve to real spell rows
(ids 208–219)**, purpose-authored as level-0 entries:

| Consumable | Effect | `resolveCast` handles it? |
|---|---|---|
| Healing Potion ×4 (Minor→Greater) | `healing` 1d8+4 → 5d8+20 | ✅ |
| Elixir of Life (Minor) | `healing` + cure sickened | ✅ |
| Alchemist Fire, Holy Water, Tanglefoot, Thunderstone | `damage` | ✅ |
| Antidote ×2, Smokestick | `buff` | ❌ inert |

**6 of 12 work through the existing resolver on day one.** The other six are `buff`, which
is the buff/debuff brief's problem, and they grey out exactly like spells do.

### 4.2 The model

- `HeroKit.quickSlots: (ItemInstance | null)[]` — length 4, filled from the stash like
  `equip()`, restricted to `item_type` **`consumable`** and **`scroll`** (D3's rule).
- A fifth loadout verb: `{ action: 'consume', slotIndex, condition, target }`.
- Resolution routes through **`resolveCast(spell_id)`** — a potion is a spell with a
  physical cost, and reusing the resolver means healing potions inherit the AoE/save/
  scaling machinery for free.
- **Consumption is destructive**: the instance leaves the quick-slot on use.

⚠ **The limiter question is already answered.** #22 built `abilityUses` and
`abilityReadyAt` on `Combatant`, per-encounter. A consumable is the FIRST thing in the
game that must be consumed **permanently, across encounters** — so its state lives on
`HeroKit`, not `Combatant`. This is the same `HeroState`-vs-`Combatant` split #22's
once-per-long-rest tier is waiting on, and doing it here builds that road.

⚠ **Restocking is a campaign concern and is NOT in this brief.** A consumed potion is
gone; buying more is the shop's job. See §7 — the shop currently cannot sell most of them.

---

## 5. M4 — ⚠ Six scrolls point at the WRONG SPELL

A content bug found while auditing, invisible today because nothing reads scrolls:

| Scroll | `spell_id` resolves to | Should be |
|---|---|---|
| Scroll of Magic Missile | **Chill Touch** | Magic Missile (16) |
| Scroll of Heal | **Message** | Heal (18) |
| Scroll of Fireball | **Harm** | Fireball (63) |
| Scroll of Lightning Bolt | **Ray of Enfeeblement** | Lightning Bolt (64) |
| Scroll of Invisibility | **Mage Armor** | Invisibility (42) |
| Scroll of Raise Dead | **Scorching Ray** | (no Raise Dead spell exists) |

All five real targets exist; the ids were assigned before the spell table settled and
never re-pointed. A seventh row points at a spell id that does not resolve at all.

Fixed by `data/seeds/seed_scroll_spell_ids.sql` — a **column-value update, no new rows**,
so no count-gate change. Raise Dead has no spell to point at and is Q4.

⚠ **A test must pin the invariant, not just the six fixes:** every `Scroll of X` row
resolves to a spell whose name is `X`. Otherwise the next content edit re-breaks it
silently, exactly as this did.

---

## 6. Measurement plan

⚠ **Per #22's lesson, "the harness moved" is not proof a feature works.** Every milestone
gets an exposure test that fails when the feature is stubbed:

| Milestone | Exposure assertion | Negative control |
|---|---|---|
| M1 | a wizard with a greatsword shows `weaponPenalty −4` AND lands measurably fewer hits over a seeded encounter | force `weaponPenalty = 0` → test fails |
| M2 | a wizard in Full Plate loses the potency AC and takes the check penalty to attack | stub the band lookup → fails |
| M3 | a hero with a Healing Potion quick-slotted actually heals mid-fight, and the slot empties | stub the `consume` branch → fails |
| M4 | every `Scroll of X` resolves to spell `X` | revert one id → fails |

Expected harness movement: **M1/M2 should be near-neutral** because `gearBrackets.ts`
equips class-appropriate gear already — the autopilot has never handed a wizard a
greatsword. ⚠ **If the curve moves noticeably, that is a finding, not noise**: it would
mean the bracket was arming heroes off-class and the old numbers were inflated.

---

## 7. Explicitly NOT in this brief

- **The gear ladder (`item_level`, `TIER_GRANTS`, the potency schedule).** Still the
  placeholder; still a first-order balance parameter. Its own brief.
- ⚠ **The shop's 53 skipped rows** — including **11 of 12 consumables and 20 scrolls**.
  So M3 ships a verb whose ammunition is mostly unpurchasable; potions come from loot
  until the shop brief lands. Worth stating plainly rather than discovering at playtest.
- **Weapon sets** (D3's "+2") — needs an in-combat swap cost. Q3.
- **The 12 orphaned properties** and the 97 legacy-object `properties` rows.
- **`striking_tier: 2` (used by zero items)** and the ilvl 13–14 gap.
- **One ring, two ring slots.**
- Scroll *transcription* (learning a spell from a scroll) — that is a known-spells
  follow-on, not an item mechanic.

---

## 8. Decisions — APPROVED 2026-09-09

All five answered by Steven. This section is the decision record; where it disagrees with
the body above, **this section wins**.

**D1 — Unproficient armour: KEEP BASE AC, LOSE POTENCY, TAKE THE CHECK PENALTY ON
ATTACKS.** §3.2's proposal, confirmed. The armour is still physically armour, so its base
AC applies; the *enhancement* is magic the wearer cannot channel, and `armor_check_penalty`
now reaches attack rolls as well as Stealth. ⚠ **This must stay a TRADE, not a trap** — a
wizard in Full Plate is making a bad-but-legible choice, not a nonsensical one. Do not
"simplify" this later into denying all AC.

**D2 — The autopilot USES quick-slots but NEVER STOCKS THEM.** Consumables the *player*
loaded get consumed by the AI on its own initiative; the autopilot never buys, never
fills, never decides what goes in a slot. ⚠ **This keeps harness baselines still**: the
autopilot's quick-slots are always empty in every harness run, so no snapshot moves for M3
— and that is a deliberate design property, not luck. **An exposure test must therefore
drive a HAND-FILLED slot**, because no harness will ever reach the consume branch.

**D3 — Scroll of Raise Dead: LEAVE IT, FLAGGED.** It stays pointing at a valid-but-wrong
spell and is recorded as a known content hole for the content pass. ⚠ **This is a
deliberate exception to M4's invariant test**, so the test needs an explicit allow-list of
one, with this decision cited beside it — otherwise the next session "fixes" the test by
weakening it. The other six scroll pointers are still corrected.

**D4 — Weapon sets: DATA MODEL ONLY, no in-combat swapping.** Two sets are stored and
editable out of combat; the active set is what the sim reads. **No swap action, no swap
cost, no combat verb** — that is a later brief. ⚠ The stored-but-unswappable state must not
become invisible dead weight: a test asserts the second set round-trips through save/load,
so the half-built feature cannot rot silently the way `item_level` did.

**D5 — The founding muster's starting gear MUST be class-proficient, pinned by a test.**
Today's four templates already are. The test exists so a future starting-kit edit cannot
silently hand Elandra a longsword and quietly saddle her with −4.

---

## 9. Milestone order

M4 (scrolls) first — it is a seed and a test, it touches no code path, and it clears a
content bug out of the way. Then M1 (weapon proficiency, all wiring), then M2 (armour
proficiency, the authoring half), then M3 (quick-slots + the consume verb + the weapon-set
data model), then the UI.

Each is separately committable. `pnpm check` green before each commit.
