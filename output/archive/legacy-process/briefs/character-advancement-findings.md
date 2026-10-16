# Brief #22 — findings (character advancement for the founding four)

**Status:** IMPLEMENTATION RECORD. ⚠ Per CLAUDE.md's rule, this file **CORRECTS the
brief** and wins on every measured fact. Implemented 2026-09-09.
**Commits:** `42e5091` (M1+M2) · `f4f8e01` (M1 tests) · `0c219a3` (M3+M4+M5) · `1cccde3` (UI).
**Suite:** 642 unit + 11 e2e green (was 529 + 11). Bundle **1,257.72 kB** (was 1,239.30).

---

## 1. What shipped

| # | Milestone | Status |
|---|---|---|
| M1 | Feat slots read, prereqs, readiness gate, picker | ✅ |
| M2 | The `ability` loadout verb + 9 wired actives + 2 limiter tiers | ✅ |
| M3 | `knownSpells` + backfill + filtered picker | ✅ |
| M4 | 4 × +2 distinct boosts at 5/10/15/20 | ✅ |
| M5 | Autopilot per-class feat/boost priorities | ✅ |
| — | UI: level-up wizard + loadout editor | ✅ |

New modules: `src/sim/heroes/feats.ts`, `src/sim/heroes/knownSpells.ts`,
`src/sim/combat/abilities.ts`, `src/content/autopilot.ts`.

---

## 2. ⚠ Corrections to the brief — read these before trusting §§2–6 above

### 2.1 The readiness meta-test in brief §2 was CIRCULAR, and a sabotage run proved it

Brief §2 specified "a test asserts that for every `effect_type` marked `true`, at least
one feat of that type demonstrably changes a resolver's output." Written literally — "feats
of a ready type pass `isEffectReady`" — **that is a tautology**: `isEffectReady` READS
`EFFECT_HAS_CONSUMER`, so flipping a bit makes its own feats pass by construction.

Measured: flipping `resource_grant: false → true` left the meta-test **green**.

**The shipped form is a WITNESS TABLE** (`tests/heroes/feats.test.ts`). Every type marked
`true` must name a witness that reaches the real consumer and observes it change something,
with **no reference to the map**. Marking a type ready without wiring it now fails
exhaustiveness with a message naming the fix. Re-sabotaged after the change: 2 tests fail,
including the exhaustiveness check.

**Lesson, generalised:** a gate-checking test that calls the gate is worthless. Assert
against the CONSUMER, never through the predicate under test.

### 2.2 Brief §6's `4 × +1` boost design was ARITHMETICALLY BROKEN

Superseded by D3 before implementation, but the reasoning must not be lost. Modifiers are
`floor((score − 10) / 2)` and **every founding hero's ability scores are even**, so four
+1s produce four odd scores and **zero modifier change**. The player would make four
choices and watch nothing happen.

PF2E avoids this because its scores start at 10 and boosts are +2 below 18; the +1 rule
only applies *above* 18, where it is deliberately braking. **Never propose +1 boosts
against an all-even stat line.** Pinned in `tests/heroes/progression.test.ts`.

### 2.3 The `combat_action` hold was SCOPE, not measurement — CLAUDE.md was wrong

CLAUDE.md listed the verb as "HELD by measurement" beside the threat/taunt mechanic. Brief
#15 §148 logs the verb as *"unmeasured — unlocks 51 feats"*; the threat mechanic is the one
with the measured −3.5 completion / +8.5 wipes. They were held in one sentence for scope
and the nuance eroded. **Threat stays held. The verb was never measured and is now shipped.**

### 2.4 Brief §4.3 said 9 wired actives; the Fighter's share is 6, and the WIZARD GETS ZERO

Confirmed, and it shaped M5: the Wizard's autopilot feat list is **one entry** (Spell
Penetration #97) because it is the only wizard class feat that passes the gate. That is a
CONTENT gap, not an oversight — the wizard's power comes from M3 instead.

### 2.5 Two limiter tiers shipped, not one — and the third is deliberately absent

Steven asked for three (D2). Shipped: **cooldown in ticks** and **once per combat**, as
distinct systems with separate tests. **Once per long rest is NOT built**: its state must
survive the encounter, so it belongs on `HeroState` with a backfill, not on `Combatant`.
Keeping them separate is what lets that tier land later without reworking these two.

`actions: N` is orthogonal to all three — a TIME cost that scales the next interval.

---

## 3. Measured: the harness movement, and why NC6's band moved

### 3.1 The at-level curve

| | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| Before | 95.0 | 92.0 | 88.7 | 56.7 | 65.7 |
| After | 95.0 | 93.0 | 89.0 | **59.3** | **72.0** |
| Wipes before | 1.3 | 2.0 | 4.3 | 16.3 | 8.0 |
| Wipes after | 1.3 | 1.0 | 4.0 | **12.0** | **4.0** |

Heroes are stronger. That is the feature, not drift. Per D5 the curve is **not a gate** for
this work — enemy content has not been built yet.

### 3.2 ⚠ NC6's completion control lost its headroom, so the BAND MOVED

The gear-policy control asserted `bracket − starter > 8` at d3. After M4/M5 it measured
**+5.3 — inside the ±8 noise bar**, i.e. a control measuring nothing.

Throwaway probe, n=300/side, all seven cells:

| d1 | d2 | d3 | d4 | d5 | d6 | d7 |
|---|---|---|---|---|---|---|
| −3.0 | +2.7 | +5.3 | **+12.0** | +7.0 | +13.3 | +0.7 |

**Moved to d4** at the **same threshold (>8) and same n**. d4 is the shallowest cell with
real headroom; d5 is still inside the bar and d7 is a floor where nothing completes.

This is CLAUDE.md's law applied for the second time (brief #19 did it first): **when a
negative control loses its headroom, move the band — never lower the threshold.** Lowering
it to fit d3 would let the control assert a difference smaller than the noise floor.

### 3.3 Exposure tests were mandatory, and here is the proof

When M2's code first landed, **all 529 existing tests stayed green** — because no hero had
an ability in their loadout, so not one line of it executed. The entire feature was dead
and every harness passed.

Negative controls run and reported:

| Sabotage | Result |
|---|---|
| `abilityDefinition = null` (rider/interval never apply) | 3 exposure tests fail |
| Stub the loadout `ability` branch | 2 walk tests fail |
| `resource_grant: true` without a consumer | 2 tests fail incl. exhaustiveness |

---

## 4. ⚠ The founding four's statblocks — the enemy workstream's reference

Steven's standing direction (D5): *"we want to start crafting enemies around the stat
blocks from these first four starter classes so we aren't starting from zero/scratch."*

**Measured after this brief**, autopilot-levelled, founding gear, no shop items:

### Level 1
| Hero | HP | AC | Atk | Dmg | Fort/Ref/Will | Perc | Sneak | Reactions | Slots |
|---|---|---|---|---|---|---|---|---|---|
| Torvald (Ftr) | 20 | 16 | +4 | 1d8+3 | 3/2/2 | 2 | — | aoo | — |
| Shade (Rog) | 17 | 15 | +4 | 1d6+1 | 2/4/2 | 3 | 1d6 | nimbleDodge | — |
| Mira (Clr) | 18 | 15 | +2 | 1d6+1 | 3/1/4 | 4 | — | — | L1:2 |
| Elandra (Wiz) | 15 | 12 | +0 | 1d6−1 | 2/3/2 | 2 | — | — | L1:2 |

### Level 3
| Hero | HP | AC | Atk | Dmg | Fort/Ref/Will | Perc | Sneak | Slots |
|---|---|---|---|---|---|---|---|---|
| Torvald | 47 | 16 | +5 | 1d8+3 | 6/3/3 | 4 | — | — |
| Shade | 38 | 15 | +5 | 1d6+1 | 3/7/3 | 5 | 2d6 | — |
| Mira | 41 | 15 | +3 | 1d6+1 | 6/2/7 | 6 | — | L1:3 L2:2 |
| Elandra | 32 | 12 | +1 | 1d6−1 | 3/4/5 | 4 | — | L1:3 L2:2 |

### Level 5 (first boost milestone applied)
| Hero | HP | AC | Atk | Dmg | Fort/Ref/Will | Perc | Sneak | Speed | Slots |
|---|---|---|---|---|---|---|---|---|---|
| Torvald | 78 | 17 | +9 | 1d8+4 | 8/5/5 | 7 | — | 6 | — |
| Shade | 63 | 16 | +9 | 1d6+2 | 5/9/5 | 8 | 3d6 | 6 | — |
| Mira | 68 | 15 | +7 | 1d6+2 | 8/3/9 | 9 | — | 6 | L1:4 L2:3 L3:2 |
| Elandra | 53 | 13 | +2 | 1d6−1 | 5/6/7 | 7 | — | 6 | L1:4 L2:3 L3:2 |

Notes for whoever authors enemies against these:

- **The L5 jump is the M4 milestone landing.** Four +2s at once move HP, AC, attack, saves
  and *speed* together — L3→L5 is a bigger step than L1→L3. Enemy tables should expect a
  discontinuity at 5/10/15/20, not a smooth ramp.
- **Elandra's weapon attack is a decoy.** +2 with 1d6−1 at L5; the wizard is her spell DC
  and slots, and a melee-pressure enemy that reaches her wins. That is on-model, not a bug.
- **Only Torvald has AoO** — the reach/interdiction pressure enemies feel comes from one
  hero, and #17 (melee interdiction) is still FOR DECISION.
- **Sneak dice track `ceil(rogueLevel / 2)`** and are the party's damage spike; enemy
  Stealth scales with level identically, so the backstab pass rate is flat ~50% by design.

---

## 5. Still open after this brief

1. **`buff`/`debuff` spell resolvers (96 rows)** — ⚠ **the highest-value follow-on.** The
   arcane L1 menu is **3 learnable of 22 offered** (pinned by test). M3 delivers the
   spellbook structure on a pool that is 24–28% live; this brief unlocks it.
2. **Class features** — 45 of 47 keys resolve to nothing (D6/§8). Includes the
   **sneak-attack ladder authored twice** finding; that brief must pick one source of truth.
3. **Ancestry feats** — 0 rows against 5 slots/career. The wizard now shows the empty track
   as future content, so the hole is visible rather than silent.
4. **Once-per-long-rest limiter** — needs the rest/recovery loop.
5. **The 42 unwired feats** and the 10 flagged Fighter actives (Parry, Sudden Charge…).
6. **Ability score cap** — deferred by D4 until more classes/enemies/quests exist.
7. **Enemy content** — the workstream this brief's §4 exists to seed.

---

## 6. Windows verification

⚠ **Green tests are not proof the app runs** (CLAUDE.md standing rule). This brief added
four modules and changed module wiring in `HeroPanel.tsx`, `session.ts` and `campaign.ts`.
The e2e suite passes against the built artifact on this box, which is stronger evidence
than unit tests alone — but **Steven should run `pnpm dev`** and walk one level-up before
this is called done.
