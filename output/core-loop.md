# Guild Vigil — Core Loop Definition

**Status:** Settled 2026-08-09/10 (Steps 1–2 of migration planning, Steven + Claude)
**Role:** Reference for triage (Step 3), phasing (Step 4), and all downstream design. Supersedes the game bible's §1 core loop where they conflict.

Guild Vigil borrows *architecture* from the Dungeons & Dynasties teardown, not *design*. It is a story/mystery-driven multi-team guild management game, not a league game.

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
- **Terminal condition:** the main storyline resolves (authored ending). No bankruptcy game-over; a fully wiped roster + empty treasury is recoverable through low-tier filler quests (floor TBD in Phase 1 balance work).

---

## 2. The four divergences from the reference architecture — settled

### D1. Multi-team story progression (replaces the league ladder)
- **Teams:** up to **4** active, **Tavern-gated**, starting at 1.
- **Time:** single global clock (LOCKED, carried from CLAUDE.md). All tokens move together; dungeon entry pauses the clock for everyone; no per-team time divergence.
- **Mystery:** **authored chapter spine + procedural filler.** Hand-written storyline beats (bible §10 storyline packs, DLC model preserved) advanced by dispatches; seeded procedural quests/dungeons fill the weeks between beats.
- **Failure cost:** **escalation + attrition.** Failed/ignored quests raise world pressure and cost reputation; heroes die permanently via the dying/wounded ratchet; no single-wipe game-over.
- **Standing measure:** a braid of **reputation tiers + visible town growth + story progress**. No league table analog.
- *Provisional sequencing rule (test in Phase 1):* watched team's dungeon plays in the pause bubble; unwatched teams' dungeons headless-resolve at entry and post results to the log, reviewable/replayable from the event stream.

### D2. Party AI dungeon exploration (replaces the linear encounter stack)
- **Steering model:** player picks a **mission profile per dispatch** — Full Explore / Boss Rush / Mystery Hunt / Loot & Resources. The AI makes every room-level call (route, who attempts which check, press vs. withdraw) in service of the profile.
- **Combat:** **continuous-time auto-battler** (teardown §3.2 model: the sim runs on per-combatant timing; "rounds" exist only as presentation bookkeeping over the event stream). **Continuous 2D space with obstacles** — room geometry still creates chokepoints. Player levers: mission profile (party level), **per-character ability/spell priority weighting**, and **pre-fight formation**. **No intervention once engaged** — preparation is everything; retreat triggers are pre-set thresholds. Anti-stall: no hard duration cap; stalemate detection (no meaningful state change in N seconds) forces resolution. Rules stance: **PF2E-flavored, not RAW** — d20 degree-of-success per attack event, stats/conditions/resources intact; the 3-action economy translates to cooldowns and cast times, MAP to flurry decay, initiative to engagement speed. Design goal: heroes visibly leverage their skills in motion (a rogue works toward targets his allies have engaged to land sneak attacks).
- **Map knowledge:** revealed as the team explores; the existing 3-state fog model (hidden / explored-dim / visible) carries over.
- **Exploration log:** **live map + beat feed.** Token moves on the revealing map; narrated beats scroll and expand to show actual rolls; combat compresses to a beat unless focused. Sim emits flat events; ALL grouping/pacing/narration is presentation-side (constraint 4 verbatim).
- The Godot entry-check phase machine (trap detect → disarm → lock → enemy detect) survives as the AI's per-doorway decision sequence, emitting events instead of opening modals.
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

## 3. Constraint weights under this loop

| # | Constraint | Weight | Note |
|---|---|---|---|
| 1 | Sim zero renderer dependency | **Way up** | The sim IS the game; watched play is event-stream replay. |
| 2 | Build-time boundary enforcement | Up | Exploration AI + mission profiles are sim-side logic. |
| 3 | `runHeadless()` cheap | **Way up** | Unwatched dispatches resolve headless during normal play, plus forecasting, plus the career harness. |
| 4 | Events out, presentation interprets | **Way up** | Beat feed is the centerpiece. One event vocabulary spans exploration + combat — bigger schema than the league game needed. |
| 5 | String-seeded namespaced RNG | **Way up — correctness-critical** | Concurrent teams: namespacing per team/dungeon/room prevents one team's rolls perturbing another's. Also: loot rolls, filler-quest gen, deed detection. |
| 6 | SaveStore abstraction | Unchanged | ~24-hero rosters grow saves but nothing structural. |
| 7 | Derived world state | Up, **harder than league case** | ⚠ Escalation depends on player history → cannot be a pure function of (id, time, seed). Persist a compact fact-ledger of player-caused escalation events; derive everything presentational from it. Dungeon seed+delta pattern (already proven in Godot code) covers the rest. |
| 8 | Idempotent backfill chain | Up | Deed-feats and loadouts will be retrofitted onto live playtest saves; Godot code already proved the pattern (class_id=0 sentinel, Eldritch Blast backfill). |

**Flagged as harder than a league-structured game:**
1. **Constraint 7** — world pressure is history-dependent (see above). Mitigation: event-sourced escalation ledger, kept deliberately small.
2. **Constraint 5** — parallel teams make seed discipline a correctness requirement, not a convenience. Mitigation: RNG namespace convention fixed in Phase 1 before any resolver is written.
3. **Constraint 4** — the unified exploration+combat event vocabulary is the largest single design artifact of Phase 1; it must be settled before the beat feed, the after-action report, deed detection, and the forecast can be built, because all four consume it.
