# Creature size — measured findings (brief #20 pre-implementation)

Measured 2026-09-02 against `C:\GuildVigilWeb` @ `df573ed` by running the real sim.
Baseline confirmed before any work: **483 unit green**, `src/` tree hash recorded and
re-verified byte-identical afterwards, working tree pristine.
⚠ `pnpm e2e` and the bundle figure were **not** re-run this session — the brief's
**11 e2e / 1,239.30 kB** are carried forward from `df573ed`, not re-measured here.

**Status: brief #20 is still FOR APPROVAL. No gameplay code written. No `src/` file touched.**

This document exists because **§9.4's gate does not work**. It corrects that section and
records what the probe measured on the way. §§0–8, §10–§13 stand as written.

---

## 1. ⚠ §9.4 CANNOT DISCRIMINATE A FROM B — the gate as written is a false pass

§9.4 says: re-run arm S1 for the d4 cell under convention B and check it reproduces
**60.3**; if it does not, stop, because the convention is A.

That test cannot fail for the reason it is meant to catch. Both conventions reproduce
it, and they land **0.3 points apart**:

| d4, n=300, `bracket` policy, seeds identical to `dungeon-curve.test.ts` | completed | wiped | retreated |
|---|---|---|---|
| A0 — shipped, unmodified `src/` (control) | **57.0** | 16.3 | 26.7 |
| **B — Medium 0, Large 0.5, Huge 1.0** | **59.0** | 14.3 | 26.7 |
| **A — Medium 0.5, Large 1.0, Huge 1.5** | **58.7** | 13.3 | 28.0 |
| costing S1, for reference | 60.3 | 13.3 | — |

**A and B differ by 0.3 points against a ±8-point bar.** Running only B and reading
59.0 as "close to 60.3, proceed" is exactly the false pass the gate was built to
prevent: A passes the same test, on the same cell, at the same n.

This is the precision rule (`CLAUDE.md`, brief #16 §3) applied to the brief's own gate —
**no assertion may claim a completion difference smaller than ~8 points**, and §9.4
asks a 300-run cell to resolve 0.3.

⚠ **The control matters and it passed.** The probe rig was first pointed at *unmodified*
`src/` and reproduced **57.0 / 16.3** exactly. The rig is faithful; the instrument is
the problem, not the harness.

### 1.1 Aggregates hide it even when runs move

Under A, d1 completion reads **95.3%** — identical to the shipped 95.3% — while the
per-run outcome fingerprint differs (`040c2be7` vs `60999ed4`). Same headline number,
different fights. Any convention check that compares percentages is reading a number
that can stay still while everything under it moves.

---

## 2. THE REPLACEMENT GATE — deterministic, zero noise

Convention B makes a claim that needs no statistics:

> *"Medium-vs-Medium is bit-identical to today. Only fights containing a Large+ body
> move at all."* (§3)

So test that directly. Build encounters containing **no Large+ row** and hash the whole
event stream:

| 48 Medium-only fights (enemy rows 1–6, 3× each, L4 bracket party, 8 seeds) | stream hash |
|---|---|
| Unmodified `src/` | `6f5526c6` |
| **Convention B** | **`6f5526c6`** — bit-identical ✅ |
| Convention A | `2734dcc9` — differs ❌ |

**B is confirmed.** A changes fights with no big creature in them, which is precisely
what makes it a balance change rather than a feel change.

### 2.1 §9.4 should read

> **Before implementation: confirm the convention.** Build encounters containing no
> Large+ enemy row and assert the event-stream hash is unchanged from `main`.
> Convention B passes bit-identically; convention A does not. **Do not use a
> `dungeon-curve` cell for this** — A and B land 0.3 points apart at n=300, inside the
> ±8 bar, so the curve cannot discriminate and will report a false pass.
> Throwaway probe, scratch config outside `tests/`, patch a copy under `probe/`,
> delete it, verify `src/` byte-identical afterwards.

The §10 risk table's mitigation for *"§3's convention is A, not B"* should point here
rather than at the curve. The risk itself is now **discharged**: the answer is B.

---

## 3. §4's call-site inventory is COMPLETE — verified by compiler, not by reading

The full change was applied to a `probe/` copy of `src/` — `Combatant.radius`, the
`gap()` helper, and all 11 conversions plus the `boundToRoom` signature — and
`tsc --noEmit` came back **clean**. Two things fall out of that:

* **There is no fourteenth site.** The costing named 8, the brief found 13, and the
  compiler found no more.
* ⚠ **There are exactly TWO Combatant construction sites**, `buildEnemy`
  (`combat/build.ts`) and `assembleHero` (`campaign/assembly.ts`). A required `radius`
  field fails to compile anywhere else, which is the cheapest possible proof that step 3
  of §13 is complete when those two are done.

`ai.ts:127` is correctly excluded: it is `stepToward`, a movement primitive, not a range
test.

---

## 4. ⚠ TWO SITES CANNOT TAKE `gap()` AS SPECIFIED — they do not receive Combatants

§2 says "one helper, used everywhere, so the rule cannot drift between call sites." Two
of the thirteen take raw `Vec2` and have no unit to read a radius from. Both need a
**signature change**, not a substitution:

| site | today | what it needs |
|---|---|---|
| `conditions.ts:112` `withinEngagement` | `(a: Vec2, b: Vec2)` | radii as parameters, threaded from both call sites (flanking at `:125`, prone at `:146`) |
| `spells.ts:150` `aoeTargets` | `dist(u.pos, center.pos) <= size` | subtract the **target's** radius only — a burst has a centre point, not a body |

⚠ The AoE case is not symmetric and should not be written as if it were: `gap()` would
subtract a radius for the burst centre that does not exist. The correct term is
`max(0, dist(u.pos, center.pos) - u.radius)`.

Neither is hard. Both are places where "one helper everywhere" would quietly produce the
wrong arithmetic if applied mechanically, so the §4 checklist should carry the
distinction.

---

## 5. Confirmed, and unchanged

Everything below was checked against the code this session and matches the brief:

* `enemies` has **no `size` column**; the count gate reads `enemies: 45` in both
  `tools/convert-content.mjs` and `tests/content/count-gates.test.ts`.
* `boundToRoom` (`ai.ts:119`) takes **no radius** today and clamps to `[0, width]`.
* `placeFormation` (`encounter.ts:52`) spaces musters **exactly 1 unit apart** — two
  adjacent Large bodies do overlap at spawn, as §7.2 says.
* `spawned.test.ts:51` pins formation position **exactly**
  (`x: ARENA.sideAx, y: ARENA.height / 2`), so §7.2's fix does carry the snapshot churn
  the brief predicts.
* Hero glyph is a fixed `r={8.5}` (`CombatField.tsx:189`); the field is a token plan,
  not a footprint map.
* `ENGAGEMENT_RANGE = 1.5`, `ARENA = 20 × 20, sideAx 3, sideBx 17` — untouched by this
  work, which is why this option does not move the geometry a re-tune would tune against.

**The costing's "free" finding is not disturbed by anything here.** B moved d4 by +2.0
against a ±8 bar. This document changes how the convention is *verified*, not what was
measured.

---

## 6. ⚠ THE MEASUREMENT COVERS SIX ROWS, NOT EIGHT — and Huge was never exercised

`ENCOUNTERS.levelBand` is **1**, so a combat room at difficulty `d` draws from
`[d−1, d+1]` and a boss room from `[d+1, d+1]` (`population.ts:87–88`, `:148`). Against
the costing's eight rows that gives:

| row | level | reachable at d1–d5? |
|---|---|---|
| Warg | 2 | ✅ d1–d3 |
| Giant Spider | 3 | ✅ d2–d4 |
| Minotaur | 5 | ✅ d4–d5 |
| Ogre | 5 | ✅ d4–d5 |
| Warg Alpha | 5 | ✅ d4–d5 |
| Troll | 6 | ✅ d5 only |
| **Hill Giant Chief** | 8 | ❌ **never** — needs d7+ |
| **Adult Red Dragon** | 12 | ❌ **never** — needs d11+ |

⚠ **The "free" finding rests on six Large rows.** The costing's exposure figures
(40/43/46/75/72% of runs, 27.1/25.4% of d4/d5 spawns) are produced entirely by those six;
the other two are inert at every depth the harness looks at.

⚠ **HUGE IS COMPLETELY UNMEASURED.** The only Huge row is the Adult Red Dragon at L12,
which cannot spawn in d1–d5. Whatever radius Huge gets (1.0 under B, 2.0 under S2) has
**never been exercised by any probe**, including the costing's own. Nothing in this brief
is evidence about Huge.

**Consequence for §5's Dragon Wyrmling question:** the Wyrmling is L7 and also cannot
spawn at d1–d5, so making it Large carries **zero measured risk today**. But it is the
row that will make Huge/Large exposure real first, because d6+ content brings the
Wyrmling (L7), the Hill Giant Chief (L8) and eventually the Dragon (L12) live at roughly
the same time. **The first d6+ balance pass must re-measure size, not inherit this
finding.**

---

## 7. §4.2's three unnamed sites: two are unreachable, one is a real design decision

### 7.1 `enemyWithin` and `nearestEnemy` have no producer

Searched the whole repo. Both appear only in the type union (`loadout.ts:16`, `:19`),
the switch that implements them (`:41`, `:54`), and **one UI button** in
`HeroPanel.tsx:335` ("+ add: strike nearest"). No content row, no test, no autopilot path
produces either. The founding muster authors `[]` for the Fighter and Rogue, `Heal →
lowestAlly` for the Cleric, `Magic Missile → scoredEnemy` for the Wizard, plus an
appended cantrip → `scoredEnemy` (`muster.ts:92, :115, :128, :143`; `assembly.ts:257`).

Converting them is therefore free of harness consequence — and equally, **a green
harness is no evidence they were converted correctly.**

### 7.2 ⚠ `aoeTargets` IS material, and "unreachable today" is not a reason to defer it

The burst branch needs `effect_type === 'damage'` **and** a non-null `save_type` **and**
`aoe_size > 0` (`spells.ts:204`). Every spell an automated dispatch can cast — `Heal`,
`Magic Missile`, and the damage cantrips (all ten of which carry `aoe_size = 0`) — fails
that gate, so **`aoeTargets` never fires in a harness run.**

⚠ **It is NOT dead code.** `tests/combat/spells-loadout.test.ts:37` hand-authors a wizard
with Fireball and exercises the burst directly, per-target saves and all.

**Do not read "the harness cannot move" as "the change is free."** The content roadmap is
hundreds of spells and thousands of property-bearing items; this path becomes one of the
hottest in the engine. Baking edge-to-edge geometry in now, while it is invisible, is a
decision taken without measurement — the same shape of mistake as trusting a green
`career-distribution`.

Two further facts the brief does not carry:

* ⚠ **`aoeTargets` is FRIENDLY-FIRE.** It filters `all` with no side check
  (`spells.ts:148`), so edge-to-edge catches Large **allies** more easily too. The AoE
  conversion is one-sided only for as long as no enemy casts (`isCaster: false` is
  hardcoded in `buildEnemy`) — it is not one-sided by geometry.
* On a **size-1 burst** (4 spells at spell level ≤ 3), a 0.5 radius is a **50% increase
  in effective reach**. The smallest bursts move most.

**Recommendation: take `aoeTargets` out of brief #20 and into the spell-shape brief**
(`output/briefs/spell-shape.md`), where the burst geometry, the `aoe_shape` discriminator
and the side policy can be decided together. Sites 9 and 10 can convert here; they cannot
move anything.

---

## 8. Reproduction

The probe was a full copy of `src/` under `probe/`, driven by a scratch vitest config
outside `tests/`, with a switchable convention (`GV_PROBE_CONV=A|B`). Seeds, gear
provider, policy name and n were copied verbatim from
`tests/harness/dungeon-curve.test.ts` so the 57.0 / 60.3 comparison is legitimate.

All probe artefacts were deleted. Verified afterwards:

* `find src -type f | sort | xargs sha256sum | sha256sum` → `96af3835…`, **identical**
  to the pre-probe baseline
* `git status --porcelain` → empty
* full suite → **483 passed**

---

## 9. STEVEN'S DECISIONS — recorded 2026-09-02

All seven §12 questions are answered. Brief #20 is **APPROVED to implement** on these
terms.

| §12 Q | decision | note |
|---|---|---|
| 1 — radius convention | **B** (Medium 0, Large 0.5, Huge 1.0) | measured, §2 above |
| 2 — the three unnamed sites | **convert `enemyWithin` + `nearestEnemy` here; `aoeTargets` moves to brief #21** | see §7.2; keeps #20's "measured free" claim clean |
| 3 — glyph scaling | **proportional** — `r = 8 × (1 + 2×radius)`: Medium 8, Large 16, Huge 24 | plus the grammar-audit twin: size must ALSO appear as a **word**, flourish never replaces the number |
| 4 — spawn overlap | **fix `placeFormation`**, take the `spawned.test.ts` + snapshot churn in the same commit | interpenetrating Large bodies on frame one undercut the feature before anyone moves |
| 5 — Dragon Wyrmling | **Large** | zero measured risk: L7 cannot spawn at d1–d5 (§6). No `small` value is authored — one less value that means nothing |
| 6 — `dist()` lint rule | **NO** | two of the thirteen sites legitimately cannot take `gap()` (§4); a rule with standing exceptions teaches suppressions. The compiler-enforced `radius` field is the completeness check that actually worked (§3) |
| 7 — stale `ARENA` comment | **rides this commit** | must be named explicitly in the commit body so it is not a silent `src/` edit |

⚠ **Q2's split is the one that changes scope.** `aoeTargets` is deferred to brief #21
(`spell-shape.md`), where the burst geometry, the `aoe_shape` discriminator and the side
policy are decided together. **Brief #20 must leave `spells.ts:150` untouched.**

⚠ **Ordering, decided:** #20 ships first with `aoeTargets` untouched; #21 follows
independently.

---

## 10. What this does NOT settle

⚠ **All seven §12 questions are now answered** (§9). What remains unsettled is not a
decision but a measurement gap:

⚠ **HUGE IS UNMEASURED** (§6). Its only row cannot spawn at d1–d5, so no probe — including
the costing's — has ever exercised a Huge radius. The first d6+ balance pass must
re-measure size rather than inherit the "free" finding.

⚠ **Nothing here re-sections the brief.** §§0–8 and §10–§13 stand; only §9.4 is replaced
(§2 above), §5's Wyrmling question gains the spawn-band fact (§6 above), and §4.2 site 11
is deferred to brief #21 (§7.2).

⚠ **`career-distribution` is untouched and still degenerate** (§11). Nothing here
discharges it.

⚠ **This is a Linux-free measurement — it ran on Steven's Windows box.** Green here is
not the usual asymmetry, but §9.6 still applies in reverse: whatever ships gets a
`pnpm dev` confirmation before it is called done.

