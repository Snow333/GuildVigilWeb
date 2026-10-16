# Brief #24 — Magic items that actually do something, and scrolls anyone can read

**Status:** FOR APPROVAL.
**Date:** 2026-09-12
**Supersedes nothing.** Follows #23 (class itemization).

---

## 1. The short answer to "do we need a broader proposal?"

**Yes — and it is broader than you think.** You asked about weapon riders. While measuring
them I found a *second* dead channel with the same shape.

| Channel | Rows authored | Engine consumers | Status |
|---|---|---|---|
| `item_properties.on_hit_effect` / `on_crit_effect` | 20 of 33 properties | **0** | dead |
| `item_properties.passive_effect` | 13 of 33 properties | **0** | dead |
| `items.stat_bonus` | **19 items** | **0** | dead |

`deriveItem()` computes `onHitEffects` and `statBonuses`, returns them in `DerivedItem`,
and **nothing reads either field.** Verified by grep (zero consumers outside `equipment.ts`)
and by experiment: a Flaming Longsword +1 driven through a real encounter emitted only
`weapon` damage. No fire. Ever.

Concretely, in your current save:

- Torvald's **Magical Wounding Longsword +1** deals no bleed.
- The **Magical Cloak of Resistance +1** in your stash would give +1 to all three saves. It gives nothing.
- **Headband of Intellect +2**, **Belt of Strength +2**, **Boots of Speed** — all inert.

So this is not "wire up riders." It is: **the entire magic-item layer above `+N` potency
is decoration.** 41 magical, 15 enchanted and 7 legendary items differ from their mundane
bases only by potency and price.

---

## 2. Why it broke this way (worth knowing before rebuilding)

Nothing here was badly built — it was built *half*. `deriveItem` is the seam where an
instance becomes stats, and it does its job correctly: it parses the JSON, validates
applicability, and hands back a clean `DerivedItem`. The failure is that **no consumer was
ever written on the other side of that seam**, and because the fields are optional-shaped,
nothing ever errored. The content team kept authoring against a contract the engine never
signed.

⚠ **This is the same failure mode as `class_weapon_proficiency` in #23** — authored content,
a derived value, and no reader. That is now three occurrences. §7 proposes the structural fix.

---

## 3. The effect taxonomy (measured, not invented)

Grouping all 33 properties by the *shape* of what they need, which is what determines how
much engine work each costs:

| Shape | Count | Properties | Needs |
|---|---|---|---|
| `hit: flat damage` + `crit: condition` | 7 | flaming, frost, shock, disrupting, wounding, thundering, holy-ish | **damage rider hook** + condition apply |
| `passive: damage resistance` | 5 | fire/cold/shock/acid/sonic resistant | **incoming-damage hook** |
| `passive: dungeon` | 5 | trapfinding, shadowstep, truesight, lockbreaker, everlight | dungeon check bonuses |
| `hit: flat damage` + `crit: damage` | 2 | holy, unholy | damage rider hook |
| `hit: condition` + `crit: condition` | 2 | dread, binding | condition apply |
| `passive: combat rule` | 6 | keen, ghost_touch, returning, shifting, fortification, slick | one-off rule changes |
| `hit: lifesteal` | 1 | lifedrinker | heal-on-damage |
| other passives | 5 | ethereal, pathfinding, shadow, sorvai_marked, corrosive | mixed |

**The top row is the whole game.** Seven properties share one hook (`on hit, add flat
damage of type X`), and that hook is the single highest-value thing in this brief.
`applyStrikeRider` from #22 already exists and does almost exactly this for Poison Weapon.

---

## 4. Milestones

### M1 — The strike rider hook (unlocks 12 properties)

Extend `Combatant` with `weaponRiders: StrikeRider[]`, populated in `assembly.ts` from
`derived.onHitEffects`. In `encounter.ts`, after a hit lands, emit each rider's damage as
its own `combat.damage_applied` with its own `kind`.

⚠ **Riders must emit SEPARATE damage events, not be folded into the weapon total.** Three
reasons: resistances need to see the type, the record must be able to say "and 4 fire", and
a folded total makes the rider invisible — which is how it became dead content the first time.

### M2 — `stat_bonus` (unlocks 19 items, zero new content)

`statBonuses` is already derived. Route it in `assembly.ts` the same way #23 routed armour
proficiency: saves, abilities and speed are all already computed there.

⚠ **Ability bonuses must apply BEFORE modifiers are derived**, or a Belt of Strength +2
raises the score but not the attack bonus — the exact bug #23 found in armour potency.

### M3 — Passive combat rules (unlocks 6)

`keen` (crit range 19–20), `fortification` (crit downgrade chance), `ghost_touch`,
`returning`, `slick`, `shadow`. Each is a small conditional in an existing resolver.

### M4 — Resistances (unlocks 5)

An incoming-damage hook. Needs care: resistance must apply per damage *type*, which is
exactly why M1 emits riders separately.

### M5 — Dungeon passives (unlocks 5)

`trapfinding`, `lockbreaker` etc. feed the existing dungeon check bonuses — the brief #14
`trapFinderBonus` plumbing already has a place for these.

**Recommended order: M1 → M2 → M3, then reassess.** M1+M2 alone take the magic-item layer
from 0% functional to roughly 60% of authored properties, and M2 needs no new content at all.

---

## 5. Scrolls — the skill gate

### 5.1 Your rule, and what the data says about it

Your illustrative ladder (arcana 3 → L1, 5 → L2, 7 → L3) generalises to
**`skill required = 2 × spellLevel + 1`**. Measured against real stock:

| Spell level | Arcana needed | Earliest character level | Scrolls unlocked |
|---|---|---|---|
| 1 | 3 | 3 | 15 |
| 2 | 5 | 5 | 12 |
| 3 | 7 | 7 | 11 |
| 4 | 9 | 9 | 8 |
| 5 | 11 | 11 | 6 |

⚠ **Scrolls top out at spell level 5, not 7.** All 52 scrolls sit in L1–L5. Your ladder
reaches 11 at the top rather than 15, which is comfortably inside a 20-level career.

### 5.2 ⚠ Three problems with the rule as stated

**Problem 1 — the rank cap makes this a hard gate, not a soft one.**
Skill ranks may never exceed character level (`maxSkillRanks`, playtest finding #4).
So "arcana 3" is not "spend 3 points" — it is **"be at least level 3, and spend every
rank on Arcana."** A Fighter who wants L1 scrolls at level 3 must have put all three
ranks into a skill with no other use for him. That is a real cost, which may be what you
want — but it is much steeper than it sounds.

**Problem 2 — no hero starts with Arcana or Religion at all.**

| Class | Starting skills | Points/level |
|---|---|---|
| Fighter | athletics, perception | 3 |
| Wizard | perception | 2 |
| Cleric | perception, athletics | 2 |
| Rogue | thievery, perception, athletics, stealth | 8 |

Nobody has a rank in either gating skill. **The Rogue is best placed to read scrolls**
(8 points/level), the Wizard worst (2) — which is either a delicious inversion or exactly
backwards, depending on your intent.

**Problem 3 — "native tradition" barely gates anything for the Wizard.**
`spell_list` is multi-valued, and **51 of 52 scrolls include `arcane`**:

| Tradition | Scrolls |
|---|---|
| arcane | **51 / 52** |
| occult | 22 |
| divine | 13 |
| primal | 0 |

So "native class auto-uses it" gives the **Wizard 98% of all scrolls for free**, and the
Cleric 25%. Exactly **one** scroll is divine-but-not-arcane (Scroll of Heal) — so the
Religion gate you asked for governs a single item.

### 5.3 What I recommend instead

Keep your ladder. Change what "native" means:

- **Native = the scroll's tradition is your class's `spell_list` AND you have spell slots.**
  Wizard auto-uses arcane scrolls; Cleric auto-uses divine. Unchanged from your intent.
- **For the gate skill, use the scroll's PRIMARY tradition** — the first entry in
  `spell_list` — rather than "any match". This makes `arcane,occult` an Arcana check, and
  keeps one scroll = one skill.
- **Seed Arcana/Religion into starting skills** for at least the Wizard and Cleric, or the
  ladder is unreachable for the classes it should favour.
- **Consider halving the requirement for a class's own tradition** (`spellLevel + 1` instead
  of `2 × spellLevel + 1`) so a Cleric with Religion can stretch into higher divine scrolls
  than a Fighter can.

⚠ **Only 12 of 52 scrolls cast a spell the engine can currently resolve** (`damage` or
`healing`). The other 40 need the buff/debuff resolvers. The gate should be built against
all 52, but the editor must grey the 40 — same readiness discipline as #22 and #23.

### 5.4 Failure mode

What happens when an unqualified hero has a scroll quick-slotted? Options:
**(a)** the loadout row greys out and never fires (consistent with every other readiness
gate), or **(b)** they may attempt it with a skill check, failure wasting the scroll.
**(a)** is consistent; **(b)** is more interesting and more PF2E. Needs your call — see Q4.

---

## 6. Decisions — APPROVED 2026-09-12

All five answered by Steven. Where this section disagrees with the body above, **this wins**.

**D1 — Milestones: M1 + M2 first.** Strike riders and `stat_bonus`. Roughly 60% of the
authored magic layer becomes real, and M2 requires no new content at all.

**D2 — Riders stay FLAT for now.** A 1d6 flaming rider is strong at level 3 and trivial at
15, but scaling is a balance decision that belongs with the curve retune, not with the
wiring. Revisit deliberately rather than guessing a formula now.

**D3 — Skill points stay the player's choice.** No seeded Arcana/Religion at muster;
allocating them at creation and level-up is a real decision with a real cost.
⚠ **The AUTOPILOT takes Arcana for the Wizard and Religion for the Cleric**, for role-play
coherence — so an auto-levelled party still grows into its scrolls. This extends
`src/content/autopilot.ts` from brief #22, which already carries per-class priorities.

**D4 — An unqualified hero's scroll greys out.** No risky attempt, no wasted scroll.
Consistent with every other readiness gate in the game (feats #22, consumables #23).

**D5 — Native tradition costs half.** `spellLevel + 1` for a scroll on your own class's
tradition, `2 × spellLevel + 1` for everyone else.

### The resulting ladder

| Spell level | Own tradition | Anyone else | Scrolls unlocked |
|---|---|---|---|
| 1 | 2 | 3 | 15 |
| 2 | 3 | 5 | +12 |
| 3 | 4 | 7 | +11 |
| 4 | 5 | 9 | +8 |
| 5 | 6 | 11 | +6 (all 52) |

⚠ **Ranks are capped at character level**, so the native discount matters more than the
numbers suggest: a Cleric reaches spell-3 divine scrolls at **level 4**, a Fighter at
**level 7**.

⚠ **The gate keys on the scroll's PRIMARY tradition** (first entry in `spell_list`), not
"any match". 51 of 52 scrolls list `arcane`, so an any-match rule would hand the Wizard 98%
of all scrolls for free. One scroll, one skill.

**On content thinness** (Steven, 2026-09-12): *"lets not over think the content we currently
have implemented. We just don't have a lot of spells in the game yet."* So the ladder is
built against all 52 scrolls and the 40 the engine cannot yet cast simply grey out. The
buff/debuff resolver work is running in parallel and will light them up without a gate change.

## 7. ⚠ The structural fix (recommended regardless)

Three times now — `class_weapon_proficiency`, `onHitEffects`, `stat_bonus` — content has
been authored against a contract with no consumer, and nothing detected it.

**Proposal: a content-reachability test.** For each authored effect channel, assert that at
least one engine consumer exists, via the same witness-table technique used for feats in #22:
a test that reaches the real consumer and fails loudly when a channel goes unread.

This is cheap, and it converts "dead content discovered by accident, two briefs later" into
"dead content fails CI the day it is authored."
