# Brief #20 — CREATURE SIZE

**Status: FOR APPROVAL. No gameplay code written.**
Written 2026-08-15 (eighth session) against `main` = `9925bba`, suite **483 unit + 11 e2e**
green, bundle **1,239.30 kB** — all three re-verified in this container before anything below
was drafted.

Steven chose this option 2026-08-15 from the three costed in
`arena-costing.md`, and chose to write it **without waiting on `career-distribution`**.
§11 says exactly what that costs and what this brief may therefore not claim.

---

## 0. What the costing already settled — DO NOT RE-DERIVE

`arena-costing.md` is the measured record. Everything in this block is taken as given:

* **Creature size is FREE on the at-level dungeon curve at n=300**, every cell inside the
  ±8-point bar: **−1.0 / +1.0 / +1.4 / +3.3 / −1.7** at d1–d5 (arm S1).
* **Doubling the footprints does not move it further**: −0.6 / +0.7 / +2.0 / +2.0 / −2.4
  (arm S2). The two effects cancel by construction — a Large body reaches you sooner *and*
  is reachable sooner, and it is easier to flank because more allies fit around it.
* **The arm fires hard, so "free" is not a dead code path.** Runs meeting a Large+ body:
  40 / 43 / 46 / **75 / 72%** at d1–d5; share of all enemy spawns 8.9 / 10 / 11.2 /
  **27.1 / 25.4%**.
* **8 rows of 45 are live.** PF2E puts Small *and* Medium in one 5-ft square, so only Large
  and up move anything.
* The probe reproduced the shipped curve **exactly** (95.3 / 91.3 / 88.3 / 57.0 / 64.7,
  wipes 1.0 / 2.3 / 4.7 / 16.3 / 10.0) before any arm was trusted.

**This is therefore a FEEL change with no measured balance cost.** It is the cheapest thing
on the arena list, it ships without a re-tune, and it does not constrain the re-tune's order.

---

## 1. What this buys

The room has walls (#19) and the fight spreads across 43–80% of its 400 cells, but every
body in it is the same size. An Ogre, a Troll and a Hill Giant Chief occupy exactly as much
of the floor as a Kobold. At d4/d5 **a quarter of everything the party fights** should be
taking up two squares and does not.

The change is: bodies have extent, and the engine measures **edge to edge** instead of
centre to centre. A Large creature is reachable half a unit sooner, threatens half a unit
further, is easier to surround, and stops half a unit short of the wall.

---

## 2. The model

One new field, one substitution.

```ts
// Combatant
/** Body radius in world units (1 unit = 5 ft = one square). 0 = Medium/Small. */
radius: number;
```

Every distance *test* in the engine changes shape from

```ts
dist(a.pos, b.pos) <= R
```

to

```ts
dist(a.pos, b.pos) - a.radius - b.radius <= R
```

i.e. **the gap between two bodies**, not the gap between two points. One helper, used
everywhere, so the rule cannot drift between call sites:

```ts
/** Surface-to-surface distance; never negative (overlapping bodies read 0). */
export const gap = (a: Combatant, b: Combatant): number =>
  Math.max(0, dist(a.pos, b.pos) - a.radius - b.radius);
```

`dist()` itself stays exactly as it is — it is the Vec2 primitive and several callers
genuinely want centre-to-centre.

---

## 3. ⚠ THE QUESTION THAT DECIDES WHETHER THIS IS A FEEL CHANGE AT ALL

**Does a Medium creature carry a radius?** The costing doc does not say, and the two
answers are not close together.

| convention | Medium | Large | Huge | consequence |
|---|---|---|---|---|
| **A — absolute footprint** | 0.5 | 1.0 | 1.5 | Medium-vs-Medium gap = centre distance **− 1.0**. `ENGAGEMENT_RANGE` 1.5 becomes an effective 2.5 centres-apart for two Mediums. **Every fight in the game changes**, including the 60% of d1 runs with no Large body in them. |
| **B — excess over Medium** *(recommended)* | **0** | **0.5** | **1.0** | Medium-vs-Medium is **bit-identical to today**. Only fights containing a Large+ body move at all. |

**B is almost certainly what was measured**, and the numbers say so: under A every d1 run
would shift, yet d1 measured −1.0 while only 40% of d1 runs meet a Large body at all. B is
also the only reading under which "8 rows of 45 are live" is true — under A all 45 rows are
live. Under S2 ("footprints doubled") B gives Large 1.0 / Huge 2.0.

**Recommendation: B.** It is the convention that makes the measurement transferable and
keeps this a feel change. But it is an assumption about someone else's probe, and it should
be confirmed by re-running arm S1 for one cell before the real implementation lands
(§10.4). **If it turns out A was measured, this brief is a balance change and needs
re-costing, not approval.**

---

## 4. THE CALL-SITE INVENTORY — and where the costing's list is incomplete

Costing §1 names eight sites. There are **thirteen** distance tests in the engine. The five
it does not name are listed below and **three of them are real decisions**, not mechanical
conversions.

### 4.1 Named by the costing, mechanical, convert them

| # | site | test |
|---|---|---|
| 1 | `ai.ts:75` `inAttackRange` | `<= max(engageRange, ENGAGEMENT_RANGE*0.99)` |
| 2 | `ai.ts:82–92` `desiredPosition` | the melee deadband (0.95 / 0.9) and the ranged standoff band |
| 3 | `conditions.ts:113` `withinEngagement` | **serves two rules** — flanking adjacency *and* prone-vs-adjacent-attacker |
| 4 | `encounter.ts:199` `provokeReactions` | AoO 1 of 3 |
| 5 | `encounter.ts:215` `moveWithReactions` engaged-before | AoO 2 of 3 |
| 6 | `encounter.ts:219` `moveWithReactions` departed-after | AoO 3 of 3 |
| 7 | `encounter.ts:312–313` the reach gate | `> reach` twice, before and after the move |
| 8 | `ai.ts:119` `boundToRoom` | the wall clamp — see §4.3 |

### 4.2 NOT named by the costing

| # | site | what it is | decision? |
|---|---|---|---|
| 9 | `loadout.ts:42` `enemyWithin` | the loadout condition "an enemy is within N" — a **player-facing tactical predicate** | **YES** — recommend convert; a giant standing on you should satisfy "enemy within 1" |
| 10 | `loadout.ts:58–59` `nearestEnemy` | target resolution for the `nearestEnemy` spec | **YES** — recommend convert; "nearest" should mean nearest body |
| 11 | `spells.ts:150` `aoeTargets` | burst radius — `dist(u.pos, center.pos) <= size` | **YES** — recommend convert. PF2E catches a creature if **any** of its squares is in the burst, so edge-to-edge is rules-correct, and it means **Large bodies eat more AoE**. ⚠ This one has a sign: it is a *buff to the party's* fireballs and a nerf to nothing, because no enemy in the registry casts (`arena-costing.md` §4). |
| 12 | `ai.ts:39` `scoreTarget` | the `× 0.01` distance tiebreaker | no — cosmetic, leave centre-to-centre, say so in a comment |
| 13 | `encounter.ts:416` `unit_moved.purpose` | classifies the emitted waypoint `'engage'`/`'standoff'` at `<= 2` | no — a presentation label, leave it, say so |

### 4.3 The wall clamp is NOT a `gap()` conversion

`boundToRoom` clamps a *point* into `[0, width]`. A body with extent must clamp into
`[radius, width − radius]` or half an Ogre hangs outside the room the walls exist to
contain. That is a different edit from the other twelve and it changes the signature:

```ts
export function boundToRoom(p: Vec2, room: RoomBounds, radius = 0): Vec2
```

⚠ **The per-axis clamp stays per-axis.** That is the wall-slide, it was chosen on feel and
confirmed 2026-08-13, and it is not up for revision here.

### 4.4 Explicitly UNAFFECTED — do not "fix" these

* `strike.ts:109` — `attacker.weaponRange <= ENGAGEMENT_RANGE` decides the hero's +2 melee
  bonus. Compares a **weapon stat** to a constant, not two positions. Unchanged.
* `ai.ts:72` — `isMelee` is `u.engageRange <= ENGAGEMENT_RANGE`. Same shape. Unchanged.
* ⚠ **`engageRange` still POSITIONS and `weaponRange` still STRIKES.** Radius is a third,
  independent term. Collapsing any two of them reintroduces brief #15's central bug.

---

## 5. The content half

`enemies` has 24 columns and **no size column**. Adding one is free by the standing rule:
the converter is `SELECT *` and both gates count **ROWS**, so a new column costs no tooling
change and no gate change. Verified in this session by reading
`tools/convert-content.mjs` and `tests/content/count-gates.test.ts` — `enemies: 45` in both,
untouched by this work.

**Route:** `data/seeds/seed_creature_size.sql` → `pnpm db:apply` → `pnpm convert`. Never a
hand-edit of `src/content/generated/**`.

**Column:** `size TEXT NOT NULL DEFAULT 'medium'` — the string, not the radius. The radius
is derived in `buildEnemy` from a small map, so the tuning knob (§3's convention, and S2's
doubling) lives in `src/content/combat.ts` beside `ARENA` where the other translation knobs
live, and the content stays a statement about the creature.

**The 8 rows the costing measured:**

| id | name | level | size |
|---|---|---|---|
| 8 | Giant Spider | 3 | Large |
| 14 | Minotaur | 5 | Large |
| 16 | Ogre | 5 | Large |
| 17 | Troll | 6 | Large |
| 22 | Hill Giant Chief | 8 | Large |
| 24 | Adult Red Dragon | 12 | **Huge** |
| 102 | Warg | 2 | Large |
| 111 | Warg Alpha | 5 | Large |

⚠ **Two content questions inside this table, for Steven not for the implementer:**

1. **Dragon Wyrmling (20, L7) is not on the list.** It is the only `dragon`-type row left
   Medium. A red dragon wyrmling is Large in PF2E. If it should be Large the measurement
   does not strictly cover it — though it sits in the d4/d5 band that already measured free
   with the largest Large+ exposure, so the risk is small.
2. The other 36 rows are Medium or Small by PF2E and share one square either way, so **no
   `small` value is needed** for mechanics. Author it anyway if the string is ever going to
   be shown to a player; leave it out if not. Recommend leaving it out — one less value that
   means nothing.

⚠ **DO NOT WIRE SIZE TO ANCESTRY.** `HeroState.ancestry` is cosmetic — identity and portrait
only, ZERO stat effect, and `tests/campaign/muster.test.ts` enforces it. PF2E's Small
ancestries share the Medium square anyway, so **every hero is radius 0** and the invariant
survives untouched. Making a halfling smaller is a deliberate systems brief, not a
drive-by.

---

## 6. The UI half

⚠ **Unit glyphs today are a FIXED PIXEL SIZE and are not footprints.** `CombatField` draws
`r=8.5` for heroes and `r=8` for foes. At `S = (700−44−44)/20 = 30.6` px per unit that is
**0.52 units across** — roughly half a square. The glyph is a token on a plan, not a body.

So there is a real choice, and it is a brief #8 grammar question:

| option | what it does | cost |
|---|---|---|
| **A — scale the glyph from today's baseline** *(recommended)* | `r = 8 × (1 + 2×radius)`: Medium stays 8, Large 16, Huge 24 | one line; the field reads instantly; nothing else moves |
| B — draw true footprints | Medium becomes r≈15.3, Large r≈30.6 | honest, but nearly doubles every glyph and will crowd a 6v8; label lanes and leaders would need re-checking |
| C — keep the glyph, add a ring or a label | no geometry change | the size stops being visible at a glance, which is the entire point of the feature |

**Recommend A.** It is proportional, it preserves the existing sheet, and the margin's
`1 SQUARE = 5 FT` stays true because the *grid* is unchanged.

**Grammar audit line (brief #8, required for every new surface):** size is carried by glyph
diameter, which is a flourish. **Flourish never replaces the number**, so the size must also
appear as a word in the unit's label block or the selected-unit readout — a labelled twin,
exactly as the status colours are label-paired. Flat mode must keep the geometry (it is
data, not ambience) and keep the label.

**Where the view learns a unit's size:** derive it. `combat.unit_spawned` already carries
`baseId`; the enemies registry has the row. That is constraint 5 (never store what you can
derive) and constraint 7 (derive where possible), and it needs **no event-schema change at
all** — which is the right answer under the additive-only rule, better than a new field and
far better than a new type.

⚠ The tradeoff, stated so it is not a surprise: a stream replayed after the content changes
re-derives the *current* size. That is how every other derived fact in this codebase already
behaves.

**`MAX_UNITS_PER_SIDE` / `formationFits`** (`fieldReading.ts`) assume one unit per row —
see §7.

---

## 7. What is NOT in scope, and what it costs to say yes later

The costing's §8 named three gaps. All three are **feel** questions, not balance ones, and
all three are ruled OUT of this brief:

1. **⚠ There is no unit-unit collision in the game, at any size.** Bodies pass through one
   another today and will keep doing so. A Large body that can be walked through is a
   visible half-measure and it is the first thing a playtester will notice. Collision is its
   own brief and it is **not free** — it changes closure times for every unit on the field,
   which is the mechanism the whole dungeon curve rests on.
2. **`placeFormation` spaces musters exactly 1 unit apart**, so two adjacent Large bodies
   overlap **at spawn**, before anyone has moved. This one is cheap to fix inside this brief
   if Steven wants it — space by `prev.radius + next.radius + 1` and let `boundToRoom`
   clamp the overflow — but it changes spawn positions, which **`tests/combat/spawned.test.ts`
   pins exactly** and which the harness snapshots therefore depend on. **Recommend: fix it,
   and take the snapshot churn in the same commit.** Leaving Large bodies interpenetrating
   at spawn undercuts the feature on the first frame the player sees.
3. **Reach weapons stay out of scope** — ruled out by #19 and reopening them is a decision.

Also out: `ARENA` dimensions (unchanged — that is why this option does not move the geometry
a re-tune would tune against), cover, LOS, difficult terrain, ranged enemy statblocks.

---

## 8. Determinism, saves, events

* **No new randomness.** Radius is content-derived; no `Rng` draw, no new seed string, no
  stream-position movement.
* **No save migration.** `Combatant` is runtime-only — built fresh by `buildEnemy` /
  `assembleHero` on every dispatch. Nothing persisted grows a field, so **no backfill stage**.
* **No event-schema change** (§6). The manifest snapshot does not move.
* **No new sim→UI dependency.** The sim never learns about the renderer; the renderer reads
  the content registry it can already reach.

---

## 9. Test plan

Every regression test gets a negative control: revert the term, watch it fail, restore, and
**report the observed failure text** in the commit. A test that passes both ways is
decoration.

### 9.1 Unit tests (new — `tests/combat/size.test.ts`)

⚠ **Every positional assertion reads `Combatant.pos` directly.** `combat.unit_moved` fires at
waypoint granularity only and cannot see a body that closes inside its own engage range.

| # | assertion | negative control |
|---|---|---|
| 1 | `gap()` is surface-to-surface and never negative; two overlapping bodies read 0 | drop the `Math.max(0, …)` → overlapping bodies read negative and satisfy every range test at once |
| 2 | A Large defender is in attack range **0.5 units sooner** than a Medium one at the same centre distance | drop `b.radius` → the two read identical |
| 3 | A Large threatener's AoO departure threshold sits 0.5 further out | revert `encounter.ts:219` → the departing unit escapes at the Medium distance |
| 4 | Flanking adjacency admits allies 0.5 further from a Large target | revert `withinEngagement` → the same two allies stop flanking |
| 5 | **A Large body clamps at `radius`, not at 0** — no part of it leaves the room, over many seeds | revert the `boundToRoom` radius arg → its centre sits on the wall and half the body is outside |
| 6 | A Huge body reads radius 1.0 (or 2.0 under S2) and a Kobold reads 0 | — |

### 9.2 The exposure test — this is the one that stops the feature dying quietly

⚠ Two of the seventh session's probe arms measured "free" **while barely firing**, and both
were caught only by instrumenting. A "free" feature and a broken feature look identical on
the curve.

**Assert that a Large+ body actually reaches the field**: over the dungeon population at d4
and d5, the share of spawns with `radius > 0` must exceed a floor well under the measured
27.1 / 25.4% — propose **≥ 15%**. Negative control: return `'medium'` for every row in the
size map and watch it fail.

### 9.3 Harness — ⚠ SNAPSHOTS WILL MOVE, AND THAT IS THE POINT

* **`dungeon-curve` will re-baseline.** The costing measured S1 at **94.3 / 92.3 / 89.7 /
  60.3 / 63.0** against the shipped 95.3 / 91.3 / 88.3 / 57.0 / 64.7. Snapshots are
  load-bearing and `vitest -u` defeats them: re-baseline **consciously**, and justify each
  moved baseline in the commit message against the costing's table.
* **The contract floors (84 / 78 / 73) stay satisfied** and stay untouched — they are slack
  under both the old and the new curve, and the re-tune owns them.
* **`encounter-distribution` will move** if its hand-authored rosters contain any of the 8
  rows; its `fromRegistry` helper mirrors `buildEnemy` and will need the radius the same way
  it needed `reactions` and the two skill totals in #19.
* ⚠ **`career-distribution` will NOT move and its greenness proves nothing** — see §11.
* ⚠ **NO ASSERTION MAY CLAIM SIZE MOVED THE CURVE.** Every measured delta is inside the ±8
  bar at n=300. The harness cannot show this feature is free; it can only fail to detect a
  difference. Any new named invariant here would be asserting inside its own noise floor,
  which is the one thing the precision rule forbids.

### 9.4 Before implementation: confirm the convention (§3)

Re-run arm S1 for **one cell** (recommend d4, the largest exposure and the largest measured
delta at +3.3) under convention B and check it reproduces **60.3**. If it does not, stop —
the convention is A and this brief needs re-costing rather than approval. Throwaway probe,
scratch config **outside** `tests/`, patch a copy under `probe/`, delete it, verify `src/`
byte-identical afterwards.

### 9.5 e2e

`combat-field.spec.ts` asserts spawn x-positions against `ARENA.sideAx/sideBx`. Those are
unchanged; the **y** positions change only if §7.2 is taken. ⚠ A bare Playwright `.click()`
is not a negative control — assert state at **mount**.

### 9.6 Windows

⚠ This adds one new test file and one new seed. It moves no module wiring and creates no
case-variant stem. **Steven still runs `pnpm dev` and confirms before it is called done** —
green tests on Linux are not proof the app runs on Windows.

---

## 10. Risks

| risk | severity | mitigation |
|---|---|---|
| §3's convention is A, not B | **high** — turns a feel change into an unmeasured balance change | §9.4 confirms it before implementation, at the cost of one probe cell |
| A conversion is missed at one of the 13 sites | medium — silent, and the curve will not catch it (everything is inside ±8) | one `gap()` helper; the inventory in §4 is the checklist; §12 asks whether a lint rule should ban bare `dist()` in range tests |
| Large bodies interpenetrate visibly | medium — feel, on the first frame | §7.2, if taken |
| Glyph scaling crowds a 6v8 | low | option A keeps Medium at today's size; only 8 rows grow |
| Snapshot churn hides a real regression | medium | re-baseline consciously against the costing's own table; every moved cell justified in the commit |

---

## 11. ⚠ WHAT THIS DOES TO THE MUSTER SEPARATION — and what this brief may not claim

Required of any arena brief by the standing rule, and the honest answer is: **nothing, and
nothing could.**

* The separation knob is **spent**. The step moved from between sep 10–12 down to between
  **4–6** when #19's commit 2 landed; everything from 6 up reads **100%** surface
  completion. ⚠ The old **96.0 / 99.8** figures are dead — do not quote them.
* This brief does not touch `ARENA`, so `sideAx 3` / `sideBx 17` and the separation of 14
  are unchanged.
* ⚠ **The surface harness has no headroom to measure this feature, or any other.**
  `career-distribution` reads completionRate 1.0, wipeRate 0, failRate 0, idleWeekRate 0,
  ambushDeaths 0, and every assertion is a one-sided **floor**, so nothing fires. It will run
  green after this change and that will mean **exactly nothing**.

**So this brief verifies on the dungeon curve only, and says so rather than implying
surface coverage it does not have.** That is acceptable *for this feature* — size is a feel
change measured free on the axis that still has signal, and 72–75% of its exposure is at
d4/d5 where the dungeon harness looks. It would **not** be acceptable for cover, for room
features, or for anything with a known sign.

**Restoring `career-distribution` remains a prerequisite for measuring arena work in
general.** It is not a prerequisite for this one, and this brief does not discharge it.

### 11.1 A one-line rider, needing its own approval

The `ARENA` comment in `src/content/combat.ts` still promises the re-tune a *"sharp cheap
knob"* on surface fights and prints the dead 96.0 / 99.8 table. It is stale and it will
mislead whoever reads it next. **Correcting it is a one-line `src/` edit and needs Steven's
approval like anything else** — it is listed here so it does not get done silently, and it
can ride this commit or go alone.

---

## 12. QUESTIONS FOR STEVEN — numbers and options, no finished opinion

1. **§3 — the radius convention.** B (Medium 0, Large 0.5, Huge 1.0), which preserves every
   Medium-vs-Medium interaction bit-for-bit and is what the measurement almost certainly
   assumed? Or A (Medium 0.5, Large 1.0), which is the literal footprint and changes every
   fight in the game? *Recommend B, confirmed by §9.4 before code.*
2. **§4.2 — the three unnamed decision sites.** Convert `enemyWithin`, `nearestEnemy` and
   AoE burst to edge-to-edge? *Recommend yes to all three.* ⚠ Note AoE has a sign: it is a
   one-sided **buff to your casters**, because no enemy in the registry casts. The mirror
   image of cover's one-sided nerf, and worth knowing you are taking it.
3. **§6 — glyph scaling.** Proportional from today's baseline (Medium 8 px, Large 16, Huge
   24), true footprints, or a marker? *Recommend proportional.*
4. **§7.2 — spawn overlap.** Fix `placeFormation` to space by radius in this brief, and take
   the `spawned.test.ts` + snapshot churn? Or ship with Large bodies overlapping at spawn?
   *Recommend fixing it.*
5. **§5 — Dragon Wyrmling (20).** Large, or leave it Medium? It is the only `dragon` row not
   on the measured list.
6. **§10 — the missed-conversion risk.** Worth a lint rule banning bare `dist()` inside
   `src/sim/combat/**` range comparisons, the way the sim/renderer boundary is enforced at
   build time? Or is the `gap()` helper plus the §4 checklist enough? *No recommendation —
   this is a taste call about how much scaffolding a 13-site change deserves.*
7. **§11.1 — the stale `ARENA` comment.** Ride this commit, go alone, or wait?

---

## 13. Implementation order, once approved

1. Probe the convention (§9.4). **Stop here if it fails.**
2. Seed + `db:apply` + `convert` — the `size` column and the 8 rows. Verify
   `src/content/generated/**` round-trips and both count gates still read `enemies: 45`.
3. `Combatant.radius` + `gap()` + `buildEnemy` / `assembleHero` (heroes radius 0).
4. The 11 conversions + the `boundToRoom` signature. One commit, because a half-converted
   engine is incoherent rather than merely wrong.
5. Unit tests + the exposure test, each with its negative control observed and reported.
6. Re-baseline the harness snapshots, justifying each moved cell against the costing table.
7. The UI half + the grammar audit line.
8. `pnpm check` green, then Steven runs `pnpm dev`.
9. Both doc halves — `output/briefs/` and `migration/briefs/` — in the same commit.
