# Design Brief #17 — Melee Interdiction

**Status:** FOR DECISION — nothing implemented. `src/`, `tests/`, `tools/` and `e2e/` verified byte-identical after every measurement below. No gameplay code before Steven approves.
**Covers:** queue item 2 — Steven's proposal, logged in brief #16 §11 and status.md's decision list: *"we should have the melee characters in the party attempt to interdict the melee attacks."*
**Authorities:** `core-loop.md`, `decision-ledger.md` Area 2 (universal AI), brief #14 (the three walls), brief #15 (party AI — §2 threat, §3 the ability gap, §10.2 "neither half works alone"), brief #16 (the harness and the precision rule).
**Measured by:** a throwaway probe under `probe/` (scratch vitest config outside `tests/`, deleted before shipping), driving the real `populate()`, `runDungeonDispatch()`, `assembleParty()` and brief #16's own gear bracket through patched copies of `ai.ts`, `encounter.ts` and `dispatch.ts`. Twelve arms, I0–I12.
**Suite at time of measurement:** 444 unit + 10 e2e green, bundle 1,237.91 kB, HEAD `13ce603` = `origin/main`.

**Probe calibration:** the variant chain with every flag off reproduces the committed `dungeon-curve` snapshot **exactly** — 91.7 / 85.3 / 80.7 completed, 4.7 / 8.3 / 12.3 wiped at d1–d3, n=300, same seed prefixes. The instrument is measuring the shipped game.

---

## 0. The headline

**Your hypothesis is half right, and the half that is wrong is the more useful half.**

You proposed interdiction on the grounds that the threat mechanic's failure (brief #15 §2: completion −3.5, wipes +8.5) *would not automatically transfer*, because threat changes target **selection** while interdiction changes **reachability**. That reasoning is sound and it is worth having tested. What the measurement says is that selection-versus-reachability is not the axis that decides it:

> **Any mechanic that MOVES the party's incoming damage onto the fighter loses. Any mechanic that DELETES the attack wins. Where the damage is aimed is not the variable — whether it lands at all is.**

Three arms make the point, all at n=1000 per cell, at level, under the gear bracket:

| arm | what it does | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|---|
| **I0 shipped** | — | 91.3 | 85.8 | 77.3 | 41.1 | 49.4 |
| **I1 the pin** | enemy engaged by a melee hero cannot walk past him; fights him instead | **86.0** | **77.5** | 74.4 | **33.5** | **42.8** |
| **I3b the deny** | enemy swinging at the back line with a melee hero adjacent is interdicted | 93.9 | 89.1 | 83.0 | 51.1 | 58.7 |
| **I7 deny + screen** | …and melee heroes position to be adjacent to the right enemy | **95.4** | **91.0** | **87.0** | **58.1** | **65.8** |

**The pin is a purer form of your idea than anything else here** — it changes reachability and nothing else, the enemy still *wants* the wizard — and it is the arm that loses. It redistributes damage roughly twice as hard as the threat mechanic did (back-line share of incoming **61.2% → 12.2%**, back-line share of hero deaths **80.9% → 9.4%**, against threat's 88% → 41%) and it costs **−5.3 to −8.3 points** of completion with wipes **up 3.7 to 9.5**. Brief #15 §2's verdict transfers essentially intact, and for the same stated reason: the fighter has no mitigation, and under the pin he is now absorbing 87.8% of everything.

The deny does not transfer because it never redistributes anything. It removes the attack from the game.

And one structural fact that governs the whole design:

> ⚠ **Position confers nothing in this simulation.** `resolveStrike` reads distance and flanking geometry, nothing else; `stepToward` has no collision; there is no facing, no line of sight, no cover. "Standing between" is mechanically inert. **Interdiction therefore cannot be built as positioning — it has to be a rule attached to adjacency.** Measured: the screen *on its own* is worse than nothing (§6).

---

## 1. Is there a problem left? Yes — and brief #15 §10.5 was wrong about it

Nobody has measured where the party dies since the milestone landed. Post-milestone, n=1000/cell, at level, gear bracket:

| at level | completed / wiped | back line's share of **incoming strikes** | back line's share of **hero deaths** |
|---|---|---|---|
| tiny d1 · L1 | 91.3 / 5.3 | 61.2% | **80.9%** |
| tiny d2 · L2 | 85.8 / 7.8 | 56.4% | **81.8%** |
| tiny d3 · L3 | 77.3 / 14.1 | 50.0% | **78.7%** |
| small d4 · L4 | 41.1 / 34.2 | 43.6% | **79.5%** |
| small d5 · L5 | 49.4 / 27.7 | 46.5% | **76.9%** |

("Back line" is the AI's own split — `engageRange > ENGAGEMENT_RANGE`, i.e. exactly the cleric and the wizard. Two of four heroes, so 50% is a fair share.)

**Brief #15 §10.5 predicted that the positioning fix alone would take the back line's share of deaths from ~90% to 62–70% "without any threat mechanic at all."** Measured: it went from 88.9% (§1's pre-milestone table) to **76.9–81.8%**. The prediction was optimistic by 10–18 points and should be corrected in the record, in the same spirit as brief #16 §12.1 correcting its own §5.3. (Caveat: §10.5's figure was taken on an unequipped party and this one is under the gear bracket, so they are not a perfectly clean pair — but the direction and the size of the miss are not in doubt.)

**The real shape of the problem is a conversion rate, not an aiming problem.** At d1 the back line takes 61% of the swings and dies 81% of the time; at d4 it takes only 44% of the swings and *still* dies 80% of the time. The cleric and wizard are not being singled out much — they are simply four times better at turning a hit into a corpse. That is worth holding onto, because it is why "move the attacks somewhere else" keeps failing and "make the attacks not happen" keeps working.

---

## 2. What "reachability" can mean here, given the engine

Three places a reachability rule can attach, and they are genuinely different mechanics:

| id | attaches to | the rule |
|---|---|---|
| **I1 the pin** | **movement** | An enemy inside a living melee hero's engagement radius may not close on a target that is not one of its pinners. If its preferred target is out of reach, it fights the pinner. |
| **I2 the screen** | **position** | A melee hero closes to the side of its target that faces the most-threatened back-line ally, rather than by the shortest path. |
| **I3 the block** | **the attack itself** | An enemy striking a back-line hero while a living melee hero stands inside its engagement radius is reaching *through* that hero: penalty (I3/I3c), outright denial (I3b), or denial-with-redirect (I8). |

⚠ **The pin needs its fallback or it is P1b again.** Without "fights the pinner", a pinned enemy never reaches anything and never acts — brief #15 §10.2 measured that shape at 3,940 hero deaths and 77 forced stalemates. With the fallback, stalemates stayed at **0 in every arm and every cell measured here**. This is not a selection change smuggled in: the enemy's scoring is untouched, it simply cannot get where it wants and hits what is in front of it.

---

## 3. Every arm, measured

n=300/cell unless marked ⁿ (n=1000). Completion % / wiped %.

| arm | tiny d1 | tiny d2 | tiny d3 | small d4 | small d5 |
|---|---|---|---|---|---|
| **I0 shipped** ⁿ | 91.3 / 5.3 | 85.8 / 7.8 | 77.3 / 14.1 | 41.1 / 34.2 | 49.4 / 27.7 |
| I1 pin ⁿ | 86.0 / 10.7 | 77.5 / 16.0 | 74.4 / 17.8 | 33.5 / 42.6 | 42.8 / 37.2 |
| I2 screen alone | 89.0 / 7.7 | 84.0 / 10.3 | 73.7 / 19.3 | 38.3 / 35.3 | 41.3 / 32.7 |
| I3 block, −4 to hit | 92.0 / 4.0 | 87.0 / 7.0 | 82.7 / 10.0 | 42.7 / 32.7 | 51.0 / 23.7 |
| I3c block, −2 to hit | 92.0 / 4.0 | 86.3 / 7.7 | 80.7 / 12.0 | 42.0 / 32.3 | 50.3 / 23.7 |
| **I3b block, deny** ⁿ | 93.9 / 2.8 | 89.1 / 4.8 | 83.0 / 8.8 | 51.1 / 23.2 | 58.7 / 18.0 |
| I8 deny + redirect | 93.7 / 2.7 | 88.7 / 5.7 | 83.3 / 10.0 | 40.7 / 33.3 | 53.0 / 21.0 |
| I10 deny, reaction-gated | 93.7 / 2.7 | 88.0 / 6.0 | 82.3 / 10.3 | 41.7 / 32.7 | 54.0 / 20.3 |
| I9 deny, 50% chance | 94.3 / 2.3 | 87.0 / 7.0 | 81.3 / 11.3 | 45.0 / 28.7 | 51.7 / 23.7 |
| **I7 deny + screen** ⁿ | 95.4 / 1.3 | 91.0 / 2.8 | 87.0 / 5.2 | 58.1 / 15.1 | 65.8 / 9.8 |
| **I12 deny + redirect + screen** ⁿ | 93.9 / 2.9 | 90.1 / 4.0 | 83.4 / 8.8 | 49.0 / 25.0 | 58.0 / 19.0 |
| I4 pin + block | 86.3 / 10.0 | 77.3 / 16.3 | 77.0 / 16.7 | 34.3 / 42.0 | 41.3 / 35.7 |
| I5 pin + screen | 83.3 / 13.0 | 77.3 / 15.0 | 74.3 / 18.3 | 30.3 / 46.3 | 37.7 / 39.3 |
| I6 pin + screen + block | 83.3 / 13.0 | 76.7 / 15.7 | 74.0 / 18.7 | 30.7 / 46.0 | 38.0 / 39.0 |

### 3.1 ⚠ On precision, and what I raised n to

Brief #16 §3 established the standing rule empirically: at n=300 a *difference* between two measurements carries **±8 points**, and the arithmetic (SE 2.87 at n=300, p≈0.55) agreed with the observed 7.0-point block spread. **I raised n to 1,000 for every claim this brief actually makes**, and derived the bar the same way — it ranges from **±2.0 to ±4.4** depending on the cell's base rate, tightest where completion is near 90% and widest where it is near 50%.

**I did not re-measure the empirical block spread at n=1,000.** The bar above is extrapolated from a relationship §3 verified at five values of n; that is a defensible extrapolation and not a measurement, and re-taking it is about 40 seconds of probe time if you want it before deciding.

Nothing in the n=300 rows above is claimed as a finding. They are there to show the shape of the space and to justify which four arms were worth 1,000 runs.

### 3.2 ⚠ An unprompted finding: the committed d3 number sits at the top of its noise band

The `dungeon-curve` snapshot records **80.7%** at d3 (n=300). The same cell, same seed scheme, at n=1,000 reads **77.3%**. That is a 3.4-point move, comfortably inside the noise floor and comfortably above the 73% floor — so **nothing is broken and I am not proposing a change**. But it means "d1–d3 are at 91.7 / 85.3 / 80.7" is the optimistic end of the band, and d3's true position against your 80% sentence is closer to 77 than to 81. Recording it because status.md says not to move that number silently, and because a future session re-deriving the floors should know.

---

## 4. The pin — your hypothesis, tested, and it does not survive

This is the arm that most literally is what you described, and the one I most expected to work.

**Mechanically it is a triumph.** At d1, n=1000:

| | shipped | **pin** | (threat, brief #15 §2) |
|---|---|---|---|
| back line's share of incoming | 61.2% | **12.2%** | 30% (front line 32% → 70%) |
| back line's share of hero deaths | 80.9% | **9.4%** | 41% |
| forced stalemates | 0 | **0** | — |
| **completion** | 91.3% | **86.0%** | −3.5 pts |
| **wiped** | 5.3% | **10.7%** | +8.5 pts |

It solves the stated problem about twice as thoroughly as the threat mechanic did, and it loses by about the same margin — **−5.3 / −8.3 / −2.9 / −7.6 / −6.6** across d1–d5, four of those five outside the bar at n=1,000.

**Why, precisely.** Total hero deaths actually *fall* under the pin at four of five cells (d3: 3,027 → 2,235; d4: 4,899 → 3,678). The party is not dying more. It is dying **in the wrong order**. The fighter is the party's damage, and the pin makes him the first thing to go: front-line deaths at d3 go **646 → 2,022**. Once he is down the fight is unwinnable, so runs that used to end as honest retreats end as wipes — retreats fall and wipes rise in every cell.

This is brief #15 §2's sentence, unchanged and now confirmed from a second direction: **concentrating damage is only good if the target can take it.** The threat mechanic and the pin are the same design wearing different clothes. Both need `Parry` and the `combat_action` verb (brief #15 §3) first, and both should stay held until that lands.

**I4/I5/I6 confirm the pin dominates whatever it is combined with** — every pin-bearing arm lands within a couple of points of I1, and the block fires only 22–68 times inside a pin arm because pinned enemies are no longer swinging at the back line to be blocked. Pin and block are near mutually exclusive; there is no version of "take both".

---

## 5. The deny — the only family that wins, and it wins bigger the harder the fight

I3b, at n=1,000, against the shipped game:

| at level | completed | Δ | bar | wiped | Δ |
|---|---|---|---|---|---|
| tiny d1 · L1 | 93.9 | +2.6 | ±2.3 | 2.8 | −2.5 |
| tiny d2 · L2 | 89.1 | +3.3 | ±2.9 | 4.8 | −3.0 |
| tiny d3 · L3 | 83.0 | +5.7 | ±3.5 | 8.8 | −5.3 |
| small d4 · L4 | 51.1 | **+10.0** | ±4.4 | 23.2 | **−11.0** |
| small d5 · L5 | 58.7 | **+9.3** | ±4.4 | 18.0 | **−9.7** |

The gradient is the interesting part: **the effect roughly quadruples from d1 to d4.** At the entry band the party wins anyway and interdiction is slack; at d4–d5, where the party is currently losing three runs in five, it is decisive. That is the same shape brief #16 §5.3 found for gear — *the lever's value is conditional on the fight being close* — and it points the whole mechanic at the 4–6 band rather than at the contract cells.

**The penalty forms are not findings.** I3 (−4 to hit) and I3c (−2) sit between 0.0 and +3.0 at every cell, inside the ±8 bar at n=300, and I did not promote them to n=1,000 because the ordering was already clear. If you want the *feel* of "attempted" interdiction rather than the certainty of it, note that I9 (deny with 50% chance) also lands inside the noise. **The mechanic appears to need to be reliable to be worth anything.**

---

## 6. Neither half works alone — the second time this codebase has produced that result

| arm | d1 | d2 | d3 | d4 | d5 |
|---|---|---|---|---|---|
| screen alone (n=300) | −2.7 | −1.3 | −7.0 | −1.4 | −8.0 |
| deny alone ⁿ | +2.6 | +3.3 | +5.7 | +10.0 | +9.3 |
| **deny + screen** ⁿ | **+4.1** | **+5.2** | **+9.7** | **+17.0** | **+16.4** |
| *the screen's marginal value* ⁿ | *+1.5 ns* | *+1.9 ns* | ***+4.0*** | ***+7.0*** | ***+7.1*** |

**The screen on its own is worthless to actively harmful** — five of five cells negative, though no single cell clears the ±8 bar at n=300, so I claim the direction and not a magnitude. The mechanism is §0's structural fact: with no collision, facing, or line of sight, moving to stand "between" buys nothing at all and merely costs the melee hero tempo, so fights run longer and the back line takes *more* swings (back-line share of incoming rises 61.3% → 70.1% under the screen alone, both n=300 — the opposite of the intent).

**Give the position a rule and the screen becomes the largest single multiplier in the brief.** Interdictions per 1,000 runs at d1 go **1,966 → 5,498**; at d4, **4,423 → 12,674**. The screen's whole job is to put a melee hero next to the enemy that is about to swing at the back line, and it roughly triples how often that is true. Its marginal value is nil at d1–d2 and **+7.0 / +7.1 points at d4/d5**, outside the bar at n=1,000.

This is structurally identical to brief #15 §10.2 — the cantrip was worth nothing without repositioning, the repositioning was catastrophic without the cantrip, and together they were transformative. **Twice now: a positioning change is worth nothing until the unit has something to do from the new position, and a capability is worth little until positioning delivers it.** Whatever ships here should ship as one milestone for exactly that reason, and any negative control must break both halves separately.

---

## 7. Cost, legibility, and the reaction economy

**Cost is a non-issue,** as it was in brief #16. Per-dispatch wall clock, 200 runs:

| | shipped | I7 |
|---|---|---|
| tiny d1 | 2.18 ms | 2.06 ms |
| small d4 | 2.31 ms | 2.89 ms |
| large d7 | 2.51 ms | 3.54 ms |

Against the ≤50 ms budget, 14–24× of headroom. It costs *more* at depth for brief #16 §2's reason: the party survives further into the dungeon, so there is more dungeon to resolve.

⚠ **Legibility is the real cost, and it is not small.** Under I7 an interdicted enemy loses its entire action — at d1 that is ~2 wasted enemy actions per fight; at d4, ~4.3. In the combat field that reads as *"the goblin walks up and does nothing,"* repeatedly. Brief #8's grammar rule is one meaning per affordance, and "nothing happened" is not a meaning.

**I8/I12 are the fix and they cost about half the effect.** Redirecting the blocked swing onto the interdictor — nobody stands idle, the enemy spends its action on the hero who stopped it — gives **+2.6 / +4.3 / +6.1 / +7.9 / +8.6** against I7's **+4.1 / +5.2 / +9.7 / +17.0 / +16.4**. Most of that gap is at d4–d5, which is precisely the band the mechanic exists for. It also partially reintroduces the pin's problem (front-line deaths at d3 rise 219 → 529 versus I7), though nowhere near enough to flip the sign.

⚠ **The existing reaction economy cannot pay for this.** I10 gates the deny behind `reactionReady` — one per attack interval, the same budget that pays for attacks of opportunity — and that throttles it straight back into the noise floor (+2.0 / +2.7 / +1.6 / +2.0 / +4.7 at n=300 against the n=300 baseline, all inside the bar). The lapse counter says why: 182–413 interdiction opportunities per 300 runs found the reaction already spent, and mostly spent *by interdiction itself*, because the back line is attacked more often than once per two seconds. Confirmed while checking: **the L1 Fighter does carry `attack_of_opportunity`** (class progression, `class_id 1, level 1` — the only progression row that grants it; the `Reactive Strike` feat is the other path) and the Rogue carries Nimble Dodge, so both melee heroes already have a reaction, and both share the single `lastReactionTick` slot. A self-limiting interdiction needs **its own budget**, not the reaction slot.

**No event-schema growth is required.** `combat.reaction_triggered` types `reactionId` as a bare `string`, so an `'interdict'` value is additive within an existing event — the manifest snapshot does not move at all. This is brief #13's `sealedRoutes` precedent: prefer a value in an existing structure to a new type. The Combatant's `reactions: string[]` is likewise the natural home for the capability, which is where this eventually meets the held `combat_action` work.

---

## 8. What it does not reach — the 7+ band is still content

n=300, medium d6 / large d7, at level:

| arm | medium d6 | large d7 |
|---|---|---|
| shipped | 7.7% / 60.0 wiped | **0.0%** / 79.3 wiped |
| pin | 5.0% / 68.0 | **0.0%** / 81.0 |
| deny | 12.3% / 52.3 | **0.0%** / 79.3 |
| deny + screen | 18.7% / 38.3 | **0.3%** / 73.3 |

**d7 is untouched by every arm in this brief.** The best result in the table is one completed run in three hundred. d6 improves materially (7.7 → 18.7, wipes 60 → 38) and is still nowhere near playable.

**This is a decision-relevant negative: interdiction is not an alternative to R4.** Brief #14 §10.3 identified the 7+ band as a *content* problem — 5 enemy rows at level 7, 2 at 8, 1 each at 9/10/12 — and the standing HOLD on R4 with that reasoning is confirmed rather than weakened. Interdiction extends the playable band from ~5 to ~6. It does not open the top.

---

## 9. ⚠ The balance consequence — this moves the contract, and you have to decide whether to pay it back

The at-level target is **met** today. Interdiction does not just help the band that needs help; it also inflates the band that does not.

| | your target | shipped ⁿ | deny | **deny + screen** |
|---|---|---|---|---|
| d1 · L1 | ~80% | 91.3 | 93.9 | **95.4** |
| d2 · L2 | ~80% | 85.8 | 89.1 | **91.0** |
| d3 · L3 | ~80% | 77.3 | 83.0 | **87.0** |
| d4 · L4 | — | 41.1 | 51.1 | **58.1** |
| d5 · L5 | — | 49.4 | 58.7 | **65.8** |

Taking I7 whole makes the entry band substantially easier than your sentence asks for and flattens the at-level curve from a 42-point spread (91.3 → 49.4) to a 30-point one (95.4 → 65.8). The `dungeon-curve` floors and both dungeon baselines all move, deliberately, and `encounter-distribution` again does not — it never runs `assembleHero` and builds its rosters by hand, so it cannot see any of this.

**The honest framing: interdiction is a reach extender, and if you take it you should expect to pay for it at the front of the curve.** The levers are costed and sitting there — brief #14's Wall 3 (the AC proficiency term, NOT TAKEN because the band cleared without it), H4's `difficultyDcScale`, R2's rest-charge rate. That would be a second milestone, not this one, and it should not be bundled.

---

## 10. Options, costed

| id | change | kind | measured | risk |
|---|---|---|---|---|
| **A** | **Deny + screen (I7)** — melee heroes screen; an enemy swinging at the back line with a melee hero adjacent is interdicted outright | code: `ai.ts` `desiredPosition`, `encounter.ts` strike path | **+4.1 / +5.2 / +9.7 / +17.0 / +16.4**; wipes roughly halved everywhere | the strongest arm and the least legible — ~4 wasted enemy actions/fight at d4; moves the contract hardest (§9) |
| **B** | **Deny + redirect + screen (I12)** — same, but the blocked swing lands on the interdictor instead of evaporating | same | +2.6 / +4.3 / +6.1 / +7.9 / +8.6 | ~half of A's effect at d4–d5; legible in playback; mildly reintroduces the pin's front-line attrition |
| **C** | **Deny alone (I3b)** — no positioning change at all | code: `encounter.ts` only | +2.6 / +3.3 / +5.7 / +10.0 / +9.3 | smallest surface; no `ai.ts` change, so brief #15's `engageRange` logic is untouched; forgoes the screen's +7 at d4/d5 |
| **D** | **The pin (I1)** | code: `encounter.ts` action loop | **−5.3 to −8.3**, wipes up everywhere | **do not take.** Recommended for the HELD pile beside threat, for the same stated reason |
| **E** | **Interdiction on its own budget** — A or B, limited to once per hero per N ticks via a new `lastInterdictTick` | code + a tunable | unmeasured; the reaction-slot version (I10) is inside the noise, so N is the whole design | the self-limiting shape you may actually want for feel; needs its own probe pass |
| **F** | **Do nothing here; go to R4 / audio / the shop** | — | §8: interdiction does not open the 7+ band regardless | the at-level target is already met; this is a 4–6 band improvement and a feel change, not a fix for anything broken |

**What I would not do:** take D, take a penalty form (I3/I3c/I9 — all inside the noise floor), or bundle §9's re-anchoring into the same milestone.

---

## 11. Risks and watch points

* ⚠ **Both halves must land together, or not at all.** §6: the screen alone is negative and the deny alone forgoes most of the effect at depth. Negative controls must break each half separately, exactly as brief #15's M3/M4 do.
* ⚠ **This touches `ai.ts` `desiredPosition`, which is where brief #15's central bug lived.** `engageRange` POSITIONS and `weaponRange` STRIKES; the screen must be applied to the melee branch only and must not collapse the two. The 0.95/0.99 deadband is a load-bearing harness finding — the screen station sits at 0.9 × 1.5 = 1.35, inside `inAttackRange`'s 1.485, and that is deliberate. Get it wrong and both fighters park just out of reach forever.
* **Both dungeon baselines and the `dungeon-curve` floors move.** `career-distribution` will move slightly (surface fights change too). `encounter-distribution` will **not** move — hand-authored rosters, no `assembleHero` — and per brief #16 that is not cover for anything.
* **No schema growth** (§7), so the manifest snapshot must NOT move. If it does, something was added that should not have been.
* **`pnpm dev` on Windows after.** This adds no files if it stays inside the three existing modules, but it moves logic in the combat loop that the field renders. Cheap insurance; the case-collision that blanked the page passed everything else.
* **Playback and the combat field will need a line for it.** `combat.reaction_triggered` already renders; an `'interdict'` reactionId needs a name in `ui/beats/names.ts` and a beat in `interpret.ts`, or it will show as an unlabelled reaction.
* **The measurement is `fullExplore` / `standard` only.** The other three profiles and the two other caution bands are unmeasured for every arm here. The grid will pick them up when it re-baselines; if any of them behaves differently that will surface as an unexplained baseline move, so it is worth predicting it now rather than being surprised.
* **The screen assumes a two-and-two party.** With `backLineAllies` empty — an all-melee party, or a back line that is all down — the screen is a no-op and the deny carries alone. Not measured with other compositions, and the founding wedge is the only composition the harness has.

---

## 12. What I need from you

1. **Which option — A, B, C, E or F?** The real trade is A versus B: **A is worth roughly twice B at d4–d5 and looks worse on screen.** If you want to see it before deciding, B is the one I would put in front of a playtest.
2. **§9 — if you take one, do you want the entry band re-anchored?** d1 goes to 95.4% under A. Either your "about 80%" sentence gets a softer reading at the entry band, or Wall 3 / H4 / R2 come back as a second milestone. Not this one.
3. **§4 — do you accept the pin's verdict?** I want it on the record next to threat in the HELD list, with "needs tank mitigation first" as the shared reason, rather than left open as a plausible idea somebody re-proposes in three sessions.
4. **§7 — should interdiction be reliable or attempted?** Every "attempted" form I measured (−2, −4, 50% chance, reaction-gated) lands inside the noise floor. If you want the *feel* of an attempt, option E — its own budget, a real tunable — is the only version with a chance of being both, and it needs another probe pass before it can be costed.

Optional, cheap, say the word: re-measuring the empirical noise floor at n=1,000 (§3.1) is ~40 seconds and would convert that bar from extrapolation to measurement.

Nothing else here needs a decision; §§1–8 and 11 are measurement and structure.
