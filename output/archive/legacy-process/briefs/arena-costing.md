# Arena options — COSTING RECORD (pre-brief, seventh session)

Measured 2026-08-13 against `C:\GuildVigilWeb` @ `65ecfba` (brief #19 both commits, pushed).
Baseline confirmed before any probe: **483 unit + 11 e2e green**, `pnpm check` clean, bundle **1,239.30 kB**.

**Status: NUMBERS AND OPTIONS. No brief written, no gameplay code written, nothing decided.**
Every arm below was measured in a throwaway probe against a COPY of `src/` under `probe/`, deleted
before shipping; `src/` verified byte-identical afterwards.

---

## 0. The probe's own control

The probe replays the curve's own cells, seeds and n. Unpatched, it must reproduce the shipped curve
or nothing under it means anything.

| | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| shipped (`dungeon-curve` snapshot) | 95.3 | 91.3 | 88.3 | 57.0 | 64.7 |
| **ARM A0 (probe, unpatched)** | **95.3** | **91.3** | **88.3** | **57.0** | **64.7** |

Wipes reproduce too: 1.0 / 2.3 / 4.7 / 16.3 / 10.0. Exact.

⚠ It did **not** reproduce on the first attempt — the first build hoisted `partyAt()` out of the run
loop, so damage carried between runs and it read 1 / 2.3 / 0 / 2.3 / 2.3. The real harness rebuilds the
party every run. Recorded because it is the failure mode any future probe of this shape will hit.

**The precision bar is unchanged: ±8 points at n=300.** Every delta below is inside it unless said
otherwise. n was not raised, because no arm came close to needing it.

---

## 1. CREATURE SIZE — measured FREE, and free is the finding

`enemies` has no `size` column. The probe hardcoded PF2E's own bestiary sizes: **Large** for Giant
Spider, Minotaur, Ogre, Troll, Hill Giant Chief, Warg, Warg Alpha; **Huge** for Adult Red Dragon.
⚠ PF2E puts Small **and** Medium in one 5-ft square, so a goblin and a bugbear occupy identical space —
only Large and up move anything, which leaves **8 rows of 45** live.

The model is one substitution: a `radius` on `Combatant`, and every range comparison in the engine goes
from centre-to-centre to **edge-to-edge** (`inAttackRange`, `desiredPosition`, flanking adjacency, the
three AoO checks, the reach gate, spell range, and the wall clamp).

| | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| A0 | 95.3 | 91.3 | 88.3 | 57.0 | 64.7 |
| **S1 — PF2E-faithful sizes** | 94.3 | 92.3 | 89.7 | 60.3 | 63.0 |
| delta | −1.0 | +1.0 | +1.4 | **+3.3** | −1.7 |
| **S2 — the same 8, footprints DOUBLED** | 94.7 | 92.0 | 90.3 | 59.0 | 62.3 |
| delta | −0.6 | +0.7 | +2.0 | +2.0 | −2.4 |

Wipes: S1 2.3 / 1.0 / 3.3 / 13.3 / 11.7 · S2 2.0 / 1.3 / 2.7 / 13.7 / 11.0.

**Every cell inside ±8, and doubling the footprint does not move it further.** The two effects cancel by
construction: a Large body reaches you sooner *and* is reachable sooner, and it is easier to flank
(more allies fit around it) — which is what PF2E intends.

### ⚠ The arm fires hard, so "free" is not a dead code path

| | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| runs meeting a Large+ body | 40% | 43% | 46% | **75%** | **72%** |
| share of all enemy spawns | 8.9% | 10% | 11.2% | **27.1%** | **25.4%** |

At d4/d5 a quarter of everything the party fights is Large+. The lever is exercised and still measures
nothing.

**So creature size is a FEEL change with no balance cost** — which is what makes it the cheapest thing
on the list, not the most expensive. It can ship without re-tuning, and it does not constrain the order
of the re-tune.

**What the probe did NOT model, and would have to be decided:** units still pass through one another
(there is no unit-unit collision today, at any size), `placeFormation` still spaces musters 1 unit apart
so Large bodies overlap at spawn, and reach weapons stay out of scope. None of these are balance
questions; all are feel questions.

---

## 2. LINE OF SIGHT ALONE — a measured no-op, not an argued one

**ARM L ran the full LOS + cover implementation with zero geometry in the room.**

| | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| A0 | 95.3 | 91.3 | 88.3 | 57.0 | 64.7 |
| **ARM L** | **95.3** | **91.3** | **88.3** | **57.0** | **64.7** |

Bit-for-bit identical, wipes included. A 20 × 20 rectangle is convex: every point sees every other
point, so there is nothing for line-of-sight to decide.

**LOS is not the honest first half of cover. It is the second half of ROOM FEATURES.** Sequenced alone
it delivers a fog-of-war overlay drawn over information nothing is hiding.

---

## 3. ROOM FEATURES — two opposing levers that cancel

Four round pillars, then two, on the lane the fight is actually fought on. Pillars block movement
(pushed out radially — the pillar's own wall-slide) and grade the sight line: clipped → PF2E standard
cover +2, through the core → greater cover +4.

| | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| A0 | 95.3 | 91.3 | 88.3 | 57.0 | 64.7 |
| **P-light — 2 pillars, r 1** | 96.0 | 92.3 | 89.3 | 57.0 | 66.7 |
| delta | +0.7 | +1.0 | +1.0 | 0.0 | +2.0 |
| **P-heavy — 4 pillars, r 1.2** | 95.7 | 92.0 | 89.7 | 57.7 | 63.7 |
| delta | +0.4 | +0.7 | +1.4 | +0.7 | −1.0 |

Wipes: P-light 0.3 / 1.7 / 3.7 / 16.3 / 7.7 · P-heavy 0.7 / 2.0 / 3.3 / 14.3 / 9.7.

Exposure under P-light: **20.6% of spell attacks took cover at d3, 15.5% at d5**, 4.6% / 3.7% fully
blocked, and bodies were shoved out of a pillar **1,587 / 1,780 times** across 60 dispatches. It fires.

**Why it cancels, and this is the interesting part.** Cover can only ever hurt the party — see §4.
Obstacles only ever hurt the enemy, because they delay closure and hand the party's casters another free
volley. The two are the same magnitude here, so the net is zero. **Pillars are not one lever with an
uncertain sign; they are two known levers pointed at opposite sides, and the ratio between them is
tunable** (pillar count and radius move the movement half; cover grade moves the other).

---

## 4. ⚠ THE STRUCTURAL FINDING: THERE IS NO RANGED WEAPON ATTACK IN THE GAME

The first cover arm measured a flat zero — **0 sight lines checked across 60 dispatches**. Cover had
been wired into `resolveStrike`, which is where a ranged attack would obviously go, and nothing ever
reached it.

* Every gear-bracket weapon is melee: Longsword, Staff, Dagger, Mace, Rapier.
* `buildEnemy` hardcodes `engageRange: 1` — *"enemy statblocks are melee until the registry grows ranged rows"*.
* So the only ranged attack roll in the game is the **spell** attack in `spells.ts`.

Consequences, all of which outlive whichever arena option is chosen:

1. **Cover has exactly one place to live** (`spells.ts`), and it is a **one-sided nerf on the party**,
   because no enemy in the registry casts or shoots. Any cover proposal is a party nerf wearing a
   symmetry costume. Brief #19 §5 calling cover "the largest balance risk in the brief" is right, and
   this is *why* — not the magnitude, the asymmetry.
2. A ranged **enemy** would change this more than any geometry would, and it is content, not code.
3. This is the fourth instance of the shape already named three times in `CLAUDE.md` — content carries
   the concept, the sim never reads it (`weapon_range: null`, `class_weapon_proficiency`, `aoo_count`,
   now ranged statblocks).

⚠ **Not isolated:** that zero reading had two causes at once — cover on the wrong code path, and the
first pillar layout sitting off the fight lane. Both were fixed together and the arm then fired. I did
not separate them, and the write-up should not claim placement alone.

---

## 5. ⚠ THE MUSTER SEPARATION IS NO LONGER A LEVER — the recorded reason is stale

Brief #19's findings §2.3 measured sep 10 → 96.0% and sep 12/14 → 99.8%, and you chose 14 knowing it.
That measurement was taken during **commit 1**. **Commit 2 (AoO from content + the backstab) landed on
top of it and flattened the knob.**

Measured now, at `65ecfba`, on `career-distribution`'s own 20 campaigns × 24 weeks (480 missions):

| separation | 2 | 4 | **6** | 8 | 10 | 12 | **14 (shipped)** |
|---|---|---|---|---|---|---|---|
| surface completion | 95.8% | 95.8% | **100%** | 100% | 100% | 100% | **100%** |
| wiped | 4.2% | 4.2% | 0% | 0% | 0% | 0% | 0% |

**The step has moved from between 10–12 down to between 4–6.** Everything from 6 upward is saturated.
The mechanism you identified is unchanged and still correct — it is the point where the enemy's walk
outlasts one 20-tick action interval — but the party now needs so little head start that the realistic
range is entirely above it.

Crossed with geometry, to answer "what does an arena change do to that number":

| | sep 10 | sep 12 | sep 14 |
|---|---|---|---|
| no pillars | 100% | 100% | 100% |
| 4 pillars, r 1.2 | 100% | 100% | 99.8% |

**Nothing moves it, because there is nothing left to move.** The `ARENA` comment currently tells the
next reader that separation is a cheap sharp knob on surface fights. At 14 it is neither cheap nor
sharp — it is inert, and the comment should say so rather than hand the re-tune a lever that no longer
exists.

⚠ **Negative control for this probe:** sep 2 and sep 4 read **95.8% / 4.2% wiped**. The probe can move
the number; the shipped range simply sits past saturation.

### And the consequence that matters more than the knob

**The surface harness has no headroom to measure ANY arena option.** 100% completion and 0 wipes at
every separation ≥ 6, under both pillar layouts. Findings §3 called `career-distribution` degenerate;
this puts a number on what that costs going forward: **no arena change can be evaluated on the surface
game at all until its signal is restored.** That moves "restore `career-distribution`" from a re-tune
line item to a **prerequisite for measuring arena work**.

---

## 6. What the room actually looks like in play

Sampled from `Combatant.pos` every tick — the event stream cannot see this, `combat.unit_moved` being
waypoint-granular.

| | d1 | d3 | d5 |
|---|---|---|---|
| distinct 1×1 cells ever occupied (of 400) | 174 (43.5%) | 287 (71.8%) | 321 (80.3%) |

Units reach every wall (x and y both hit 0.0 and 20.0), so the wall-slide is load-bearing in normal
play, not an edge case. But **spawn positions occupy only y 8.5 … 11.5** — a 3-unit band in a 20-unit
room. The fight *starts* in a narrow lane and *spreads* across most of the box.

That is why pillar placement decides whether a feature is scenery or a mechanic: geometry off the
opening lane is decoration, geometry on it changes 15–21% of spell attacks.

---

## 7. The options, with their costs — not a recommendation

| option | curve cost | what it actually buys | prerequisite |
|---|---|---|---|
| **Creature size** | **free** (±3.3, inside noise, at 2× footprint too) | the room reads as occupied; Large bodies in the 25% of d4/d5 spawns that deserve them | a `size` column (seed → `db:apply` → `convert`; no gate change) |
| **LOS + fog overlay, alone** | **exactly zero** (bit-identical) | nothing, in a convex empty box | room features must exist first |
| **Room features (pillars)** | **free as configured** (+2.0 max) — but two opposing levers, tunable | somewhere to hide; the geometry the backstab had to do without | cover must go in `spells.ts`; decide whether "blocked" means untargetable (costs target re-selection) |
| **Cover, as its own thing** | not measured alone | — | ⚠ a **one-sided party nerf** until a ranged enemy exists (§4) |
| **Muster separation** | **inert at 10–14** | nothing | — the knob is spent |

**The ordering question your prompt raised — arena first or re-tune first — now has a measured answer
on one axis at least:** every arena option costed here is free on the dungeon curve, so **arena work
does not move the geometry the re-tune would be tuning against.** The interaction you were guarding
against (#19 §0's corridor at 11–13 points) does not appear for any of these three, because none of
them changes the room's *size* — they change what is in it.

**What is NOT free and would need its own costing:** changing the room's dimensions again, reach,
difficult terrain, and a ranged enemy statblock.

## 8. What this costing did not do

* No fog-of-war overlay was built — that is a UI cost, and none of the above measures it.
* "Fully blocked" is graded as greater cover (+4) rather than untargetable, because untargetable means
  writing target re-selection, which is part of what a features brief would have to cost.
* Unit-unit collision was not modelled at any size (there is none today).
* Reach and difficult terrain were not touched; they remain ruled out by #19 and reopening them is a
  decision.
* No arm was run at raised n, because none came near the ±8 bar.
