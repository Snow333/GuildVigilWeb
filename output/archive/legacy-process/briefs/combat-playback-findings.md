# Combat playback — measured findings (brief #12 pre-work)

Measured 2026-08-12 against `C:\GuildVigilWeb` @ `0d3fca1d` by running the real sim.
Baseline confirmed before any work: **323 unit + 9 e2e green**, `tsc --noEmit` clean, bundle 1,206.22 kB.

**Status: the wireframe comp (r01) is delivered and awaiting Steven's approval. No brief written, no code written.**

---

## Three corrections to the handoff's diagnosis

The diagnosis in `status.md` / `next-session-prompt.md` is right that both surface fights discard
`fight.stream`, that `QuestRecord.dispatch` is dungeon-shaped, and that `QuestRecord` is not persisted.
Three other claims did not survive contact with the code. **None of them touch the two taken decisions**
(full combat view; `combat.unit_spawned` additive) — they change what the view can be *built out of*.

### 1. The sim does NOT emit continuous 2D positions

`combat.unit_moved` has exactly one call site — `moveTick`, `encounter.ts:365` — and fires only on the
`!arrivedBefore && arrivedAfter` edge: the moment a unit first enters attack range of its current target.

| scenario | avg ticks | avg events | avg `unit_moved` |
|---|---|---|---|
| 4v4 mixed party (40 runs) | 34.2 | 48.7 | **5.97** |
| 1v1 melee (40 runs) | 23.5 | 10.7 | **1.00** |
| ranged-heavy 2v3 (40 runs) | 50.5 | 50.3 | **13.75** |

A whole 4-fight dungeon dispatch emitted **23** `unit_moved` events across 543 ticks; a 2-fight dispatch
emitted **5**. There is no path data. A view must interpolate between waypoints and say so, or the sim
must emit more (a behaviour change, R1 territory).

### 2. `purpose` only ever carries two of its four values

`'flee'` and `'reposition'` appear nowhere in `src/` outside the type union. Measured purposes across
120 runs: `engage` and `standoff` only.

**`combat.unit_fled` is never emitted at all.** `interpret.ts:158` has a case for a line that cannot occur.
R3's "flee-oscillation" is therefore not unrendered — it is **unsimulated**. Kiting does show up, as
ranged standoff churn, and that *is* observable.

Related dead branches found: `stalemate_forced.resolution` can only ever be `'byState'`
(`'attackersWithdraw'` unreachable); `combat.reaction_triggered` fired **once in 40** 4v4 fights, because
units close and swing in the same tick so almost nothing provokes.

### 3. Stalemate is designed-for but has never happened

`ENCOUNTER.stalemateWindowTicks` = 300 ticks (30 s of damage silence). Committed harness snapshots:

| golden scenario | durationP50 | durationP90 | stalemateRate |
|---|---|---|---|
| 2 fighters + rogue vs 3 goblins | 32 | 39 | **0** |
| caster party vs the orcs | 54 | 110 | **0** |
| party vs 3 Orc Warriors | 91 | 143 | **0** |
| level-1 hero vs 4 goblins | 82 | 119 | **0** |

Fights end in 3.2–14.3 s; the window needs 30 s. A bespoke "stalemate forming" visual would be art for
an event that has never fired.

---

## Two measurements that reshape the transport

**Combat is most of the record and none of the picture.** Across three real dispatches, `combat.*` was
**43% / 57% / 82%** of all events and **27% / 46% / 79%** of all ticks. `PlaybackScreen` renders a room
graph for the other side of that split and drops every combat fact into an unlabelled beat line.

**16× is not a viewing speed.** Whole dispatches run 17–54 s at 1× → **1–3 s at 16×**. A median fight at
16× is 0.2 s; at 4×, under a second. The 1×/4×/16× ladder was sized for travel-and-explore.

---

## Confirmed, and unchanged

The stream carries instance ids and nothing else — no `name`, no `maxHp`, no side metadata (verified by
searching a full serialised stream for both). Nothing in it can label a dot or size an HP bar. This is
exactly the hole `combat.unit_spawned` fills, and it is why the beat feed has been printing
`disp_1:camp_e0` all along. **The approved decision stands and is well-founded.**

Also confirmed: `placeFormation` (`encounter.ts:46`) is deterministic and `combat.started` carries
ordered `sideA`/`sideB`, so t=0 positions are derivable today — `unit_spawned` makes them explicit
rather than inferred, which is the better contract.

Production speed is `BASE_SPEED = 5` world units/sec for heroes (`assembly.ts:38`) and `speed: 5` for
registry enemies — they agree. (Several test fixtures and harnesses pass higher values; anything
measuring approach time must use 5 or it will be 5× too fast.)

---

## Decisions put to Steven with comp r01

- **D1 — motion**: interpolate between waypoints and put a filenote on the sheet (recommended, zero sim
  change), vs. emit `unit_moved` on purpose-changes (behaviour change, ~doubles fight-stream size, moves
  every harness snapshot). If D1 goes to interpolate: add `speed` to the `unit_spawned` payload so the
  interpolation is derivable rather than guessed.
- **D2 — skim mode**: freeze the field at 4×/16× and let the record carry the fight, vs. keep animating.
- **D3 — enemy disambiguation**: render same-named enemies as `Goblin ɪ / ɪɪ / ɪɪɪ` from spawn order,
  presentation-only.
- **D4 — scope**: log the three dead branches above as combat-model questions rather than chase them in #12.

## The view, as comped

One component, two mountings — beside the room graph for a dungeon fight (room in play ringed in red
ink, plus a dispatch strip marking each fight segment), in the graph's place for a surface fight.
Plan-view arena ruled at 1 unit = 5 ft with a 25 ft scale bar; heroes solid glyphs, enemies hollow
(side never carried by colour); per-unit name, HP number and bar; dashed targeting lines as the
target-thrash tell; engagement (7.5 ft) and weapon-reach rings on the selected unit only; a silence
gauge against the 300-tick window and a churn gauge over the last 5 s; red-ink diagnosis confined to
the margin. Flat mode strips vellum, grain, tilt, pins and shadow and keeps every datum.
