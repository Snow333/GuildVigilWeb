# Design Brief #18 — The Playtest Pass

**Status:** FOR DECISION — nothing implemented. `src/` and `tests/` verified byte-identical after every measurement; scratch probe deleted. No code before Steven approves.
**Covers:** four findings from Steven's first real play session on `13ce603` — units leaving the combat sheet, playback speed not persisting, the day's-record playhead, and the after-action gate.
**Authorities:** brief #8 (the desk grammar — *one meaning per affordance* is the operative rule in three of the four), brief #5 §3/§4 (playback), brief #12 (the field and its two mountings), brief #15 (`engageRange`), `CLAUDE.md` (settings live beside the slots, never in the campaign save).
**Measured by:** a throwaway scratch probe over the real `runDungeonDispatch`, plus patched copies under `scratch/variant/` for the four candidate fixes. Deleted before shipping.
**Suite at time of measurement:** 444 unit + 10 e2e green, HEAD `13ce603`.

> **Finding 1 is much larger than it looks on screen and it is the only one that touches the sim.** Findings 2–4 are all presentation, all small, and two of them are the same grammar violation wearing different clothes.

---

## 1. Units leaving the sheet — 51–76% of fights, not a rounding error

### 1.1 What is actually happening

`ARENA` (`14 × 10` units, 70 × 50 ft) is used in exactly two places: `placeFormation` to set starting positions, and `CombatField.tsx` to draw. **Nothing in the sim ever bounds a position.** `stepToward`'s only clamp is `Math.min(amount, d)`, which prevents overshooting *toward* a target and does nothing at all when `amount` is negative.

The negative case is `desiredPosition`'s standoff branch:

```ts
const standoffMin = 2;
if (d < standoffMin) return stepToward(u.pos, target.pos, d - u.engageRange * 0.8); // negative = away
```

A caster with an enemy inside 2 units retreats by `d − 4.8` every time it is asked, with no floor, every tick, for as long as something stays close. Its attacker follows. The party's melee follow the attacker. **The whole fight migrates off the sheet.**

`px`/`py` in `CombatField.tsx` are unclamped linear maps and the unit layer has no clip, so whatever the sim produces is drawn wherever it lands.

### 1.2 Measured — this is what the renderer is actually being handed

Rendered position is `combat.unit_spawned` plus `combat.unit_moved` anchors, interpolated by `positionAt`. The arena is a convex rectangle, so interpolation between two in-bounds anchors stays in bounds — **an out-of-bounds anchor is exactly and only what puts a glyph off the sheet.** 200 dispatches per cell, at level, gear bracket:

| | anchors out of bounds | **fights with ≥1 unit off-sheet** | x range (arena 0–14) | y range (arena 0–10) |
|---|---|---|---|---|
| tiny d1 | 45.6% | **51.4%** | −40.6 … 24.0 | −38.6 … 38.3 |
| tiny d3 | 54.3% | **69.7%** | −49.5 … 34.0 | −32.1 … 59.0 |
| small d4 | 54.8% | **76.2%** | −50.4 … 41.3 | −49.7 … 43.3 |
| small d5 | 47.2% | **70.1%** | −42.6 … 31.9 | −23.1 … 53.6 |

Units are reaching **three to six arena-widths** outside the frame. Roughly half of all drawn motion is off the sheet.

### 1.3 Where it came from — fair to both briefs

Re-running with positioning keyed on `weaponRange` (brief #15's own M3 control, i.e. the pre-milestone rule):

| | shipped | pre-milestone rule |
|---|---|---|
| tiny d1 | 45.6% | **0.0%** |
| tiny d3 | 54.3% | **0.0%** |
| small d4 | 54.8% | 6.2% |
| small d5 | 47.2% | 6.3% |

**The defect is in the ranged branch and predates brief #15 — the milestone made it reachable.** Brief #15 §1 recorded that the standoff purpose "fired 0 times in 1,850 moves — the entire ranged-positioning branch of the AI is dead code for the default party." That branch was never bounded; it simply never ran. Turning it on turned this on with it.

(The 6.2/6.3% at d4–d5 under the old rule is the gear bracket handing the wizard a range-2 dagger at L4, which trips the same branch even under `weaponRange`. So the latent defect was already live at depth before the milestone.)

⚠ **No test could have caught this and none does.** Nothing anywhere asserts a position — the harnesses assert outcomes, and being off the map changes no outcome at all. Every one of the 444 stayed green. This is exactly what a playtest is for.

### 1.4 The four candidate fixes, measured

| option | anchors OOB after | completion effect (n=200, matched seeds) | verdict |
|---|---|---|---|
| **A — clamp the desired position to `ARENA` in the sim** | **0.0% at every cell** | −3.0 / −2.5 / +4.0 / −3.5 | **works; inside the noise floor** |
| B — clamp in the renderer (`px`/`py` or a clipPath) | 0.0% drawn | none | ⚠ **killed by §1.2** |
| C — auto-fit the viewport to the fight's bounding box | 0.0% | none | ⚠ killed by brief #8 |
| **D — soften the retreat to `standoffMin` instead of `engageRange × 0.8`** | **46.3 / 54.8 / 53.5 / 47.3%** | −3.0 / +1.0 / +7.5 / −4.0 | ⚠ **MEASURED AND FAILED** |

**D is the honest surprise and it was my preferred fix going in.** Backing off to 2 units instead of 4.8 changes essentially nothing — 46.3% versus 45.6%, with excursions to x = −52.9. The drift is not caused by the *size* of the retreat step; it is caused by the retreat having **no floor and repeating every tick.** Retreating one unit per tick forever goes exactly as far as retreating four; it just takes longer, and fights last hundreds of ticks. Combining D with the clamp adds nothing over the clamp alone (and reads slightly worse at d1: 88.0 vs 91.0). **Reporting it because it is the fix a reasonable person ships without measuring.**

**Why B is not viable, specifically.** A render-side clamp is normally the safe choice — no sim change, no baseline movement, no balance risk. The magnitudes kill it: with half of all anchors out and excursions to −50, clamping to the edge would magnetise most of the cast onto the frame, and the 25 FT scale bar, the engagement ring and every targeting line would then be drawing distances that are not true. That is a visible lie rather than a cosmetic tidy, and brief #8's *"flourish never replaces the number"* is the rule it breaks. **This is the one conclusion in the brief that came only from measuring first — B was the obvious answer until the numbers arrived.**

**Why C is not viable.** At x ∈ [−50, 41] the real arena would occupy about 15% of the sheet with the party as specks, the grid would stop being 5 ft per square, and the scale bar would have to become dynamic. Chart density is LOCKED at round-03 (brief #8, executable as `worldChart.ts` DENSITY).

### 1.5 What A costs, honestly

* **Both dungeon baselines move**, because positions change → `unit_moved` events change → snapshots change. A deliberate, justified re-baseline; `encounter-distribution` will not move (hand-authored rosters, no `assembleHero`).
* ⚠ **The completion figures above are on `gvbounds_` seeds, not the curve's own** — they are comparable to each other and **not** to the committed 91.7 / 85.3 / 80.7. All four deltas sit inside the ±8-point floor at n=200 (the bar is wider than ±8 at that n), so the clamp is **balance-neutral within measurement** — but whether it clears the committed contract floors must be re-run on `gvcurve_` seeds at n=300 before it ships. That is an implementation-time gate, not a design question.
* **It makes `ARENA` a real constraint for the first time.** A caster backed into a corner stops retreating and gets caught. That is a behaviour change, it is legible, and I think it is the correct fiction — but it is a change, and it belongs in the decision.
* **It wants a regression test**, and a cheap one: *every `unit_moved` anchor lies within `ARENA`*. Reverting the clamp fires it immediately at ~50%, which makes it an unusually clean negative control.

---

## 2. Playback speed does not persist — and the mechanism already exists

### 2.1 What is actually wired

Everything you asked for is built. `UserSettings` already carries `defaultSpeed` (default 4), persisted player-wide at `gv_settings`, and `GameProvider` already exposes **`setDefaultSpeed`**. The Settings screen already calls it.

**`PlaybackScreen` reads that value as its initial state and never writes back:**

```ts
const [speed, setSpeed] = useState<ReplaySpeed>(defaultSpeed);   // reads
onClick={() => { setSpeed(s); setPlaying(true); }}               // local only — never setDefaultSpeed
```

So the same three buttons, drawn identically, mean **"set my default"** in Settings and **"just for this replay"** in Playback. ⚠ **That is a brief #8 violation — one meaning per affordance** — and it is the actual reason it feels broken rather than a missing feature.

### 2.2 ⚠ One correction to the ask

You said *"stored in the save/campaign file"* and also *"global"*. Those conflict, and `CLAUDE.md` settles it: *"`UserSettings` lives beside the slots (web key `gv_settings`), NOT inside campaign saves — don't route preferences through the envelope/backfill chain."* Global is what you want and `UserSettings` is where it goes; the campaign save would make it per-campaign, which is the opposite.

### 2.3 Two speeds, not one

| control | where | values | persisted? |
|---|---|---|---|
| `ReplaySpeed` — the dispatch playback | PlaybackScreen top bar | 1× / 4× / 16× | field exists, **write-back missing** |
| `CombatSpeed` — the combat field | inside `CombatViewer` | ¼× / ½× / 1× / 4× / 16× | ⚠ **no field, no Settings control, purely ephemeral** — hardcoded `useState(0.5)` |

Options:

* **A — write-through, both speeds.** Playback's buttons call `setDefaultSpeed`; add `defaultCombatSpeed` to `UserSettings` and have the field's buttons write it too. The load path is `{...DEFAULT_SETTINGS, ...parsed}`, so a new field backfills on old records for free — the `readableType` comment documents exactly this precedent. Adds a second control to the Settings screen for symmetry. **Recommended: it is what you asked for and it removes the grammar violation.**
* B — write-through for `ReplaySpeed` only. Roughly a one-line change; leaves the field speed ephemeral, which is the one you were more likely looking at in a dungeon.
* C — keep Settings as the sole owner and mark the in-playback buttons as a session override in the label. Preserves both meanings honestly but does not give you what you asked for.

---

## 3. The day's record — one strip, two clocks

### 3.1 The diagnosis

There are **two independent clocks** and the strip puts a playhead for one of them on top of blocks belonging to the other.

* The **dispatch clock** (`simTick`) drives the delve sketch, the scribe's record, and the red playhead on the strip.
* The **fight clock** lives inside `CombatViewer` — its own `tick`, its own Play button, its own speed buttons.
* `{fights[openFight] && <CombatViewer .../>}` — the mounted fight is whatever `openFight` points at. `openFight` starts at 0 and **only ever changes on click.** It does not follow the playhead.

So the playhead sweeps across FIGHT 1's block while the field below is showing a different fight at an unrelated tick. Exactly what you saw.

There is a second oddity in the same code: clicking a block runs `setSimTick(at.end)` — **opening a fight to watch it fast-forwards the day's record past that fight** and pauses.

⚠ **The grammar reading:** the playhead carries two meanings ("where the day is" *and*, by proximity, "what is playing"), and each block carries two ("when this happened" *and* "click to mount"). Brief #8's #1 named risk, in the newest surface.

### 3.2 Options

* **A — one clock: the strip drives the fights.** As the dispatch playhead enters a fight's span, mount that fight and drive its tick from the dispatch clock; on exit, return to the sketch. The day plays start to finish, fights included, in order. Costs `CombatViewer` a controlled-tick mode (it currently owns its tick). **Recommended — it makes the strip mean the one thing it looks like it means, and it is the reading you had when you hit the problem.**
* B — keep two clocks, fix the labels. Playhead moves out of the strip; blocks become plainly "FIGHT 1 — watch ▸". Cheapest, honest, but the day still never plays its own fights.
* C — pause at each fight. The dispatch clock runs to a fight's start and stops with "a fight here — watch ▸ / skip ▸". Makes fights the punctuation of the day. More clicks, most legible.
* D — mark blocks as already-resolved (outcome shown on the block) and let the playhead mean only "how much of the record you have read". Reframes the strip as history rather than transport — which is what it actually is.

A and C both fix the intuition; A is continuous and C is deliberate. **The sub-question either way: should clicking a block still jump the record forward?** Under A that behaviour disappears naturally; under B/D it should probably become "rewind to the fight's start", not "skip to its end".

---

## 4. The after-action gate — agreed, with one note

```ts
<button disabled={!done} onClick={() => nav({ kind: 'afterAction' })}>
  After-action ▸{done ? '' : ' (finish or skip first)'}
</button>
```

`done = simTick >= endTick`. So it is two clicks: **Skip**, then **After-action**.

**Your instinct is right and there is a stronger argument for it than convenience: the guard buys nothing.** Skip sits immediately to its left and does exactly the thing the guard is asking you to go and do. It protects no state — the stream is a finished fact and the after-action reads the record, not the playhead. And the app already contradicts itself: the surface-fight branch of this very screen renders an **ungated** "After-action report ▸".

Options:

* **A — one button, always enabled: finish the record, then navigate.** `setSimTick(endTick); setPlaying(false); nav(...)`. Keeps Skip for "finish but stay here and read it". **Recommended.**
* B — as A, and drop Skip entirely, since After-action now subsumes it. Fewer affordances; loses "skim to the end and keep reading".
* C — keep the gate but auto-enable once the last fight resolves rather than at `endTick`. Solves the symptom, keeps the confusion.

---

## 5. What I need from you

1. **Finding 1 — take option A (the sim-side clamp)?** It is the only measured fix that works; D failed and B/C are ruled out above. Confirm you accept that `ARENA` becomes a real wall and that both dungeon baselines re-baseline for it.
2. **Finding 2 — option A (both speeds persisted) or B (dispatch speed only)?** And confirm `UserSettings` rather than the campaign save, per §2.2.
3. **Finding 3 — A, B, C or D?** This is the only one of the four with a genuine design choice in it rather than a defect to repair.
4. **Finding 4 — option A?** I expect this is a yes; it is here for completeness.

**Sequencing note:** 1 is a sim change with a baseline move and wants its own commit and a `pnpm dev` confirmation. 2–4 are presentation-only, touch no sim module, and could land together as a single UX commit. I would not bundle them.
