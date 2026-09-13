# Guild Vigil — Design Law

**What this file is:** the settled player-facing rules of the game. Every entry here is a rule you
could state to a player without mentioning code.

**Authority:** these are SETTLED. Changing one is a design decision that needs a brief and Steven's
approval — never a drive-by, never an "obvious fix", and never an inference from PF2E.

**What is NOT here:** engine traps (`output/reference/*.md`), balance numbers (the harnesses),
roadmap items (`output/future-work.md`), and the loop itself (`output/core-loop.md`).

⚠ **Several of these rules look like bugs or omissions to someone applying PF2E instincts or general
"helpfulness". That is precisely why they are written down.** If a rule below seems wrong, it was
measured or deliberately chosen — read the rationale before proposing a change.

---

## 1. Identity and the hero fantasy

### Ancestry and gender are COSMETIC — zero stat effect

A dwarf and an elf with the same class and the same rolls fight **identically**. Ancestry and gender
drive identity and portrait only.

- **Rationale:** PF2E ancestry mechanics (boosts, flaws, ancestry feats, darkvision, speed) are a
  whole systems brief, not a drive-by. Adding "just the +2 CON" imports half a system and silently
  rebalances every fight in the game.
- **Enforced by:** `tests/campaign/muster.test.ts`. Heroes are also always combat radius 0.
- ⚠ **This is the single rule most likely to be violated by someone acting on PF2E instinct.**
- **Status:** `feat_slot_ancestry` grants 5 slots per career against **zero** ancestry feats. That
  track is shown to the player as future content **by decision, not by oversight**.

### The founding muster's class list is what the registry can outfit at level 1

There is no starting-gear-by-class table. Widening the class list is **content work**, not a
one-line change.

---

## 2. Advancement

### XP is cumulative and is never spent

XP only accumulates. Nothing consumes it. Level 20 is the ceiling and is represented by a `-1`
sentinel for "no next level" — that is not an error state.

### Ability boosts are 4 × +2 to DISTINCT abilities, at levels 5/10/15/20

⚠ **NEVER propose `+1` ability boosts.** Modifiers are `floor((score − 10) / 2)` and every founding
hero's scores are EVEN, so four +1s produce four odd scores and **zero modifier change** — the player
would choose four times and nothing would happen. PF2E dodges this because its scores start at 10.

Brief #22 briefed `4 × +1` and it was caught before code. **When a design decision rests on
arithmetic, do the arithmetic first.**

### There is NO ability score cap — deliberately (brief #22 D4)

Extreme stat builds are an **intended fantasy** until base growth, feats, gear and buffs can be
weighed together. Do not add a cap "for safety".

### Ability modifiers use PF-RAW floor

A score of 7 gives −2, not −1. The Godot build truncated toward zero; this divergence is deliberate.
A below-average stat costs slightly more here than it did in the old build.

### Manual level-up is the default; the autopilot is a player convenience

"Level up for me" is a real feature for players who want to skip choices, not merely harness
scaffolding. The two share the same code so the harness stays a valid proxy for hand play.

---

## 3. Equipment and the gearing ritual

### Manual, slot-by-slot equipping is CORE UX — the game will never do it for you

The psychological ownership of tweaking each hero is deliberately preserved **at the cost of
management overhead**. This is the paper-doll-on-return pleasure, and the thing you have been eyeing
in the shop finally being affordable.

- ⚠ **The autopilot deliberately NEVER equips.** The harness gear bracket lives in
  `tests/harness/gearBrackets.ts`, **not in `src/`**, and that placement is the decision.
- ⚠ **A gear-scoring helper in `src/` is the first step toward a feature Steven declined.** If the UI
  ever wants a "recommended" marker, it gets its own brief.
- A "best in slot" convenience button is explicitly **not launch scope**.

### Masterwork is craftsmanship, not enchantment

A masterwork weapon's +1 comes from how well it was made, not from magic. It carries **no `+1` name
suffix** — a masterwork longsword is a "Masterwork Longsword", never a "+1 Longsword".

### Item instances are `(base, tier, properties, seed)` — everything else derives

Name, stats and price are always recomputed, never stored. A player's sword is the same sword across
saves because it is re-derived, not remembered.

### Layout: 11 gear slots + 4 consumable quick-slots + 2 swappable weapon sets

Settled in core-loop D3.

---

## 4. Combat

### No player intervention once a fight is engaged

**Preparation is everything.** The player's levers are: mission profile, gear loadout, ability
loadout and priority order, and pre-fight formation. Retreat fires from pre-set doctrine
thresholds — there is no panic button.

### Area spells do NOT hit your own party by default

⚠ **The rejection of friendly-fire-by-default is STRUCTURAL, not taste.** This is an auto-battler
with no player intervention once engaged, so the AI aims every burst. Catching your own front rank
would punish a choice the player never made.

Declared `target_side` wins; absent, it derives (healing/buff → allies, else enemies). `'all'`
remains available for a deliberately authored exception.

⚠ **`output/decision-ledger.md` Area 2 still says "friendly fire stays". That entry is HISTORICAL and
was superseded by brief #21. This file wins.**

### The backstab: the defender uses the HIGHER of Stealth or Perception

⚠ **A deliberate divergence from PF2E**, which uses Stealth vs Perception DC only. Do not "fix" it
back. It is also *why* the rogue's success rate is flat at ~50% across depth rather than falling —
enemy Stealth scales with level exactly as the rogue's does. Bending that curve is a re-tune lever,
not a bug.

### Flanking and concealment disagree — deliberately, and it is logged

Flanking grants **sneak damage but no −2 AC**, while a passed conceal check applies the full
off-guard (−2 AC *and* sneak). Fixing flanking rebalances every fight in the game; it belongs to the
re-tune, not to a drive-by.

### A dungeon retreat is recorded as a FAILED quest

`QuestRecord.outcome` is `'completed' | 'failed' | 'wiped' | 'ambushKilled'`. Pulling a team out
early surfaces as `'failed'` — there is no separate "retreated" outcome.

---

## 5. Failure, death and the world

### Failure is absorbed, never terminal

Heroes die permanently via the dying/wounded ratchet. Failed or ignored quests raise world pressure
and cost reputation. **There is no single-wipe game-over and no bankruptcy game-over** — a fully
wiped roster and an empty treasury is recoverable through low-tier filler quests.

### There is no single ranked score

Standing is read off three surfaces at once — reputation tiers, visible town growth, story progress.
Nothing collapses them into one number, and nothing should.

### Content IDs are append-only forever

Saves reference content by ID. IDs are never renumbered and gaps are left in place. This is what
guarantees a player's save survives every content update.

### Settings are player-wide, not per-save

`UserSettings` (including flat mode) lives beside the save slots, not inside any campaign save. A
player's preferences follow them across every slot and every new campaign.

### Flat mode keeps the whole game

Flat mode strips ambience, tilt and texture — and **keeps the full grid, data, labels and actions**.
Every new surface honours it from its first build. Accessibility is not a reduced version of the game.

---

## 6. Presentation

### Status colour is never the sole carrier of a state

The frozen status set is always label-paired. **Flourish never replaces the number.**

### The sim never speaks to the player

Resolvers emit facts; presentation decides what any of it says. No player-facing text in a resolver,
ever. (This is Constraint 4 and it is also a design rule: it is what lets the same fight be narrated
one way in the beat feed and another in the record.)
