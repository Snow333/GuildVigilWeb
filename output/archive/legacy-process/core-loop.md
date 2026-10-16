# Guild Vigil — Core Loop Definition

**Status:** SETTLED. This is the authoritative statement of the game loop.
**Authority:** All design resolves toward this file. It supersedes the game bible's §1 core loop, and
any brief that contradicts it is wrong until this file is deliberately amended.
**Not settled here:** balance numbers, content, and UI — those live in the briefs and
`output/reference/`. This file says WHAT the game is, never how it is currently tuned.

---

## 0. What of this is actually built

This document describes the WHOLE game. Much of it is not implemented yet. As of briefs #8–#25:

| Level | State |
|---|---|
| **L1 the beat** | **Built.** Continuous-time combat, beat feed, the record. |
| **L2 the dispatch** | **Mostly built.** Quests, mission profiles, dungeons, gear, loadouts, level-up. |
| **L3 the chapter** | **Partial.** Buildings, reputation and escalation exist; the authored story spine does not. |
| **L4 the campaign** | **Not built.** No storyline packs, no authored ending. |
| **Multi-team** | **Not built.** One team today; the 4-team structure below is the target, not the code. |

Do not read a section below as a description of current behaviour. Read it as the contract that
behaviour must eventually satisfy.

---

## 1. The loop at each nesting level

### Level 1 — The beat (moment-to-moment)
- **Player decides:** nothing twitch-level. Combat and exploration are auto-resolved by the sim. The player watches the focused team's live map + beat feed; **between rooms** they may adjust ability priorities or recall the team. **Once a fight is engaged there is no intervention** — preparation is everything; retreat fires from pre-set doctrine thresholds, not a panic button.
- **Unit of time:** one beat — a door forced, a trap sprung, a strike resolved. Combat is continuous-time; beats are emitted facts. Bubble time; the world clock is paused inside dungeons.
- **Tension:** watching prepared plans meet the dice. The dying/wounded ratchet escalating mid-run.
- **Terminal condition:** the room/combat resolves.

### Level 2 — The dispatch (expedition)
- **Player decides:** which quest, which team, the **mission profile** (Full Explore / Boss Rush / Mystery Hunt / Loot & Resources), gear loadout per hero (manual, slot-by-slot — this ritual is the point), consumable quick-slots, ability loadout + priority order.
- **Unit of time:** world-map travel on the global clock + one dungeon in bubble time. The player selects the target on the world map; the party **self-paths** via terrain-weighted A* (hugs roads, avoids hard terrain) — no manual waypointing.
- **Tension:** push-your-luck attrition (slots, HP, wounded ratchet) vs. loot/XP/mystery progress; travel time as cost; ambush risk in transit.
- **Terminal condition:** quest resolved, retreat, or TPK.

### Level 3 — The chapter (guild arc)
- **Player decides:** building order, roster recruitment/investment, which story threads vs. filler quests to spend limited teams and weeks on, when to unlock the next team (Tavern).
- **Unit of time:** in-game weeks on the global clock.
- **Tension:** gold/reputation scarcity vs. escalating world pressure. The reputation ladder (gates at 5/10/15/20/30) is the pacing spine.
- **Terminal condition:** a story chapter resolves; a rep tier / major building unlocks.

### Level 4 — The campaign
- **Player decides:** which authored storyline at start; long-term guild identity (roster composition, building specialization).
- **Unit of time:** the full playthrough.
- **Tension:** guild ascent vs. threat escalation. Failure is absorbed, not terminal: the world degrades and heroes die, but the campaign continues.
- **Terminal condition:** the main storyline resolves (authored ending). No bankruptcy game-over; a fully wiped roster + empty treasury is recoverable through low-tier filler quests (the exact recovery floor is still unset — it belongs to the re-tune).

---

## 2. The four pillars

These are the four systems that make Guild Vigil what it is. Each was settled deliberately; the
parenthetical notes say what was rejected, because the rejection is the decision.

### D1. Multi-team story progression
- **Teams:** up to **4** active, **Tavern-gated**, starting at 1.
- **Time:** single global clock. All tokens move together; dungeon entry pauses the clock for everyone; no per-team time divergence.
- **Mystery:** **authored chapter spine + procedural filler.** Hand-written storyline beats (bible §10 storyline packs, DLC model preserved) advanced by dispatches; seeded procedural quests/dungeons fill the weeks between beats.
- **Failure cost:** **escalation + attrition.** Failed/ignored quests raise world pressure and cost reputation; heroes die permanently via the dying/wounded ratchet; no single-wipe game-over.
- **Standing measure:** a braid of **reputation tiers + visible town growth + story progress**. ⚠ There is deliberately **no single ranked score** — progress is read off three surfaces at once, and nothing collapses them into a number.
- ⚠ *Sequencing rule — DESIGNED, NOT YET BUILT:* the watched team's dungeon plays in the pause bubble; unwatched teams' dungeons headless-resolve at entry and post results to the log, replayable from the event stream. Multi-team play does not exist yet; this is the intended shape, not a description of the code.

### D2. Party AI dungeon exploration
- **Steering model:** player picks a **mission profile per dispatch** — Full Explore / Boss Rush / Mystery Hunt / Loot & Resources. The AI makes every room-level call (route, who attempts which check, press vs. withdraw) in service of the profile.
- **Combat:** **continuous-time auto-battler** (the sim runs on per-combatant timing; "rounds" exist only as presentation bookkeeping over the event stream). **Continuous 2D space with obstacles** — room geometry still creates chokepoints. Player levers: mission profile (party level), **per-character ability/spell priority weighting**, and **pre-fight formation**. **No intervention once engaged** — preparation is everything; retreat triggers are pre-set thresholds. Anti-stall: no hard duration cap; stalemate detection (no meaningful state change in N seconds) forces resolution. Rules stance: **PF2E-flavored, not RAW** — d20 degree-of-success per attack event, stats/conditions/resources intact; the 3-action economy translates to cooldowns and cast times, MAP to flurry decay, initiative to engagement speed. Design goal: heroes visibly leverage their skills in motion (a rogue works toward targets his allies have engaged to land sneak attacks).
- **Map knowledge:** revealed as the team explores; the existing 3-state fog model (hidden / explored-dim / visible) carries over.
- **Exploration log:** **live map + beat feed.** Token moves on the revealing map; narrated beats scroll and expand to show actual rolls; combat compresses to a beat unless focused. Sim emits flat events; ALL grouping/pacing/narration is presentation-side (constraint 4 verbatim).
- **The per-doorway decision sequence is trap detect → disarm → lock → enemy detect**, emitting events rather than opening modals. (Carried from the Godot build, where it was a modal phase machine.)
- **Dungeon architecture:** graph-first. The sim's dungeon is a graph of typed rooms (nodes) and corridors (edges); geometry exists only in presentation. **Layouts come from a curated pool of 20–30 pre-generated templates** (generator runs offline as a content tool; layouts validated at build time); **population is seeded per dispatch** — room contents, hazard DCs, enemies, loot, clue placement. Unwatched dungeons resolve purely on the graph, never computing geometry. Save = (template_id, seed, deltas).

### D3. Comprehensive equipment slots
- **Layout:** keep as designed — **11 gear slots + 4 consumable quick-slots + 2 swappable weapon sets** (15 save columns per hero).
- **Itemization:** **authored bases × generated quality tiers and named properties.** The latent grammar in the data (5 quality tiers, 33 named properties) gets wired into loot generation AND into combat math (potency/striking finally read). Legendary uniques and found-spells stay hand-authored and hand-placed.
- **Equip flow:** **manual slot-by-slot equipping is core UX** — the psychological ownership of tweaking each hero is deliberately preserved at the cost of management overhead. A "best in slot" convenience button is a later addition, not launch scope.

### D4. Comprehensive per-character ability selection
- **Acquisition:** **hybrid — chosen at level-up + earned by deeds.** The built model (feat slots per category, per-class spell economies, multiclassing, boosts at 5/10/15/20) stays player-driven at level-up; a small set of feats is additionally earned from what a hero actually did, detected from the event stream (dragon-slayer, trap-survivor, …). Deed-feats are derivable facts (constraint 5), not stored rolls.
- **Respec:** **costed, via a building service** (Training Grounds/Library tier). Permanent by default; targeted gold-cost respec recovers dead builds and feeds the gold-sink economy the bible lists as a gap.
- **Tactics link:** **known pool → ordered active loadout.** Everything known forms the pool; the player slots a bounded active set per hero and orders it; the combat AI plays down the priority list through its condition checks. This generalizes PF2E prepared casting into the universal ability-bar model for all classes. Level-up builds the deck; the loadout screen plays it.

---

## 3. What this loop demands of the Eight Constraints

The constraints themselves are stated in `CLAUDE.md` and are law. This table records **why** each one
matters under *this* loop, and — where a risk was flagged during planning — how it was resolved.

| # | Constraint | Why this loop needs it | Status |
|---|---|---|---|
| 1 | Sim has zero renderer dependency | The sim IS the game; watched play is event-stream replay. | Load-bearing, enforced |
| 2 | Build-time boundary enforcement | Exploration AI and mission profiles are sim-side logic. | Enforced by `eslint.config.js` |
| 3 | Headless resolution is cheap | Unwatched dispatches resolve headless during normal play, plus forecasting and the harnesses. | Load-bearing |
| 4 | Events out, presentation interprets | The beat feed is the centerpiece. **One** event vocabulary spans exploration *and* combat. | **Settled** — schema FROZEN 2026-08-10, additive only |
| 5 | String-seeded namespaced RNG | **Correctness-critical, not a convenience.** Concurrent teams mean one team's rolls must never perturb another's. | **Settled** — `Rng`/`Seeds`/`Ids` in `src/sim/core/` |
| 6 | SaveStore abstraction | ~24-hero rosters grow saves but nothing structural. | Unchanged |
| 7 | Derived world state | ⚠ **The one real tension.** Escalation depends on player history, so it cannot be a pure function of (id, time, seed). | **Resolved by exception** — a deliberately small fact-ledger (`src/sim/world/escalation.ts`); everything presentational derives from it |
| 8 | Idempotent backfill chain | Every shipped system so far has been retrofitted onto live saves. | Load-bearing, exercised repeatedly |

**The dungeon-save pattern that makes constraint 7 affordable:** a dungeon persists as
`(template_id, seed, deltas)` — never as geometry, never as a room dump.
