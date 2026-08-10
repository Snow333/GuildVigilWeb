# Guild Vigil — Migration Decision Ledger

**Step 3 of migration planning.** Every feature judged against the core loop in `core-loop.md`, not against its original purpose.
Verdicts: **Keep** = rebuild fresh in TS from the design · **Change** = concept survives, implementation redesigned (needs its own brief) · **Remove** = not carried forward.

---

## Area 1: Roster, progression & character build — CONFIRMED 2026-08-10

| Feature | Verdict | Note |
|---|---|---|
| Hero creation wizard (7-step) | Keep | Ownership ritual is core to the settled loop. |
| Point-buy (15 pts, scaled cost) | Keep | Tuned + documented; port constants as data. |
| Skill allocation | Keep | Skills gain importance — party AI rolls them in dungeon checks. |
| XP system (flat 1000, party-split) | Keep | Port `test_xp_manager.gd` cases as Vitest fixtures. |
| Level-up wizard (7-step, atomic apply) | Keep | Structure survives; UI rebuilt in React. |
| Multiclassing (advance/add, ability≥13, caps 20/10, max 5) | Keep | Data-driven and sound. |
| Prestige prerequisites | Change | Was stubbed — now actually enforced; mentor/milestone unlocks per bible §12. |
| Ability boosts (5/10/15/20, boost-before-class) | Keep | Preserve ordering nuance; fix INT-boost/skill-points bug, do not re-inherit. |
| Proficiency tiers (keep-highest) | Keep | 112 milestone rows port as data untouched. |
| Weapon proficiency (−4, category/specific grants) | Keep | Feeds equipment identity. |
| Feat system structure (4 categories, chains, auto-grants, sub-choices) | Keep | Architecture is stack-free. |
| Feat effects (23/227 implemented) | Change | Rebuild registry-first with `affects:` wiring metadata + wiring test; add deed-earned category (core-loop D4). |
| Spell economies (spellbook/spontaneous/prepared/pact) | Keep | Class fantasy differentiation; D4 active-loadout layer is new design on top. |
| Multiclass collision handling | Change | Concept survives; fold half-wired checks into one data-driven grant resolver. |

**Verification approach (confirmed):** port XP test fixtures; nuance-sweep prose for the rest; **no differential harness for this area.**

---

## Area 2: Combat resolution — CONFIRMED 2026-08-10 (revised to real-time)

**Structural decision:** combat migrates from turn-based 3-action to a **continuous-time auto-battler** (teardown §3.2). Continuous 2D space with obstacles; **no player intervention once engaged**; soft anti-stall (stalemate detection, no hard cap). PF2E-flavored, not RAW.

| Feature | Verdict | Note |
|---|---|---|
| d20 degree-of-success engine | Keep | Per-attack-event resolution; crit at DC+10, nat 20/1 step. The PF2E identity. |
| Stats / AC / proficiency / save math | Keep | Ports as data + pure functions. |
| 3-action economy | Remove (as structure) | Spirit survives as cooldowns, cast times, wind-ups; 2-action feats = heavier swings. |
| Initiative & turn order | Remove | Initiative stat → engagement speed / first strike; ties-to-players → small hero latency edge. |
| MAP (0/−5/−10, agile −4/−8) | Change | Becomes flurry decay on rapid consecutive swings; agile keeps lighter penalty. |
| 25-condition system | Change (timekeeping) | Mechanics/values/saves keep; rounds → seconds, turn ticks → periodic ticks. |
| Dying/wounded/KO cascade | Keep | Timer-based recovery checks; permadeath engine of the failure model. Healing-sets-HP bug not re-inherited. |
| Flanking + sneak attack | Keep | Dot-product rule ports to continuous space; rogue maneuvering becomes visible AI behavior. |
| Reactions / AoO | Change | Engagement-zone model: free strikes on leaving melee range / casting inside it. |
| Spell slots / pact energy | Keep | Time-model-agnostic. |
| AoE templates | Change | Geometry keeps + cast times + missing basic save added; friendly fire stays. |
| Combat feats / toggles / stances | Keep | Dispatched via Area-1 effects registry. |
| Enemy AI → universal combat AI | Change | One AI for both sides, loadout-driven, continuous-time targeting; teardown gambit vocabulary + threat scorer as reference. |
| Battle setup & formations | Keep, elevated | Starting formation is the player's main positioning lever. |
| Manual player turn control | Remove | Retired with the auto-battler decision. |

**Verification approach (confirmed):** no differential harness. Rules-example fixtures for every resolver + early encounter-distribution harness (seeded fights, histograms) with golden scenarios hand-checked against playtest memory.

---

## Area 3: Dungeon generation & exploration — CONFIRMED 2026-08-10 (graph-first re-architecture + pre-generated layout pool)

**Structural decisions:** (1) **Graph-first**: the sim's dungeon is a graph of typed rooms/corridors; geometry is presentation-only; unwatched dungeons resolve on the graph without computing geometry. (2) **Pre-generated layout pool**: the generator becomes an offline content tool producing **20–30 curated layout templates** (graph + baked geometry, build-time validated); runtime picks from the pool and **seeds population per dispatch** (contents, hazard DCs, enemies, loot, clues). Save = (template_id, seed, deltas).

| Feature | Verdict | Note |
|---|---|---|
| Seeded deterministic generation | Keep (as tool) | Moves offline; determinism now serves curation + per-dispatch population. |
| Cell-lattice room placement (boss-far, multi-cell landmarks) | Change | Survives inside the offline layout tool; no longer runtime sim structure. |
| Corridor carving (center-spanning alignment, L-fallback) | Change → mostly Remove | Tile-substrate plumbing dissolved; SVG layout keeps only "plausible corridor between connected rooms." |
| Kruskal + ~35% loop edges | Keep (graph-native) | Loops give the party AI route choices; pure graph algorithm in the tool. |
| Connectivity rescue pass | Keep (build-time invariant) | Shipped layouts validated once; no runtime rescue needed. |
| 3-state fog of war | Keep (per-node/edge) | Same states on graph elements; reveal shapes derived in presentation. |
| Weighted room typing (4/3/2/1/1) | Keep | Runtime population knob, profile-aware later. |
| Hazard seeding (DC formula, chances, guarded-loot rule) | Keep (runtime) | Stays per-dispatch — DCs scale with difficulty/party level. Full tuning table captured. |
| Entry-check phase machine | Change | Phase sequence + DC-retry mechanics keep; becomes the AI's per-doorway decision procedure emitting events. |
| PF2E skill checks (4-degree, retry DC+2) | Keep | Rolled by party AI; anti-softlock escalation keeps. |
| Ambush/perception outcomes | Keep | Surprise tiers map to engagement-timing advantages in real-time combat. |
| Trap effects | Change | Complete the three TODOs (resistances, conditions into combat, KO cascade) in the unified event/condition system. |
| Room rewards | Change | Gold formulas keep; lore rooms become mystery-clue carriers; shrines get real effects. |
| Corridor-aware token pathing | Keep (presentation) | Token animation on the SVG map. |
| Generation test harness | Keep (build-time) | Invariants become graph property tests validating the shipped pool. |
| Legacy DungeonManager autoload | Remove | Superseded prototype. |
| FreezeTrace instrumentation | Remove | Diagnosed a Godot-specific rendering bug; problem class dissolved by the DOM. |

---

## Area 4: World map, town & quests — CONFIRMED 2026-08-10

**Dispatch UX decision:** the player selects the target (dungeon/POI/quest site) on the world map; the party **self-paths** via terrain-weighted A* — hugging roads (0.55×), avoiding expensive terrain, mountains/water impassable per the locked terrain rules. No manual waypointing.

| Feature | Verdict | Note |
|---|---|---|
| Seeded terrain generation (noise fields, burned roads) | Keep | Renders as SVG; road-highway legibility is a feature. |
| A* travel with terrain weights | Keep | Locked terrain/travel design carries over wholesale; powers dispatch self-pathing. |
| Real-time multi-token traversal + ETA/path preview | Keep | Finally gets its 2–4 simultaneous tokens; preserve visual-position re-path anchor. |
| Ambush rolls in transit | Change | Chance becomes f(region danger, world pressure); real encounter definitions. |
| POI placement (budgeted, rejection-sampled) | Keep | Tuning captured. |
| POI interaction panel | Keep | Thin UI over POI state → dispatch actions. |
| Resource-generator POIs | Change | Close the loop: captured generators pay declared weekly income. |
| POI state persistence | Keep | neutral/cleared/captured. |
| Building tech tree (18 buildings, prereq DAG) | Keep | Rep-gated pacing spine; SVG tree render. |
| Building upgrade economy | Keep | Exponential curves + ~170-rep campaign budget port as data. |
| Party roster & slots | Change | PARTY_ID=1 dies; up to 4 parties Tavern-gated (D1), party size Guild-Hall-gated. |
| Quest board | Change | Becomes the dispatch hub: story vs. filler tags, suggested mission profiles, level bands, expiry. |
| Quest lifecycle | Change | Wire complete/fail for the first time; expiry-on-ignore feeds escalation. |
| Game time | Change | Real global clock per locked design (real-time w/ pause, TIME_SCALE, weekly tick drives restock/rotation/POI income, building timers). |
| World lore corpus (~82 entities) | Keep | Raw material for the authored spine; wiring is content work. |
| World pressure / escalation | **New system** | Per-region pressure score fed by an append-only ledger of player-caused facts; drives ambush rates, POI degradation, difficulty drift, villain events. Phase-1 design brief. |

---

## Area 5: Economy, items & equipment — CONFIRMED 2026-08-10

| Feature | Verdict | Note |
|---|---|---|
| Shop panel (3-column, filters) | Keep | UI rebuilds in React; structure sound. |
| Unified buy/sell cart (sells fund buys) | Keep | Fix per-entry validation dupe bugs; do not re-inherit. |
| Sell pricing + Market ladder (50/55/60/65%) | Keep | Tuned, documented. |
| Per-save limited stock | Keep | Ports directly. |
| Weekly restock | Change | Seed restock_rate data; hang on the real weekly tick. |
| Featured rotation / showcase | Change | Wire rotation_group data; seeded save-scum-proof rotation keeps. |
| Buyback ledger | Remove | Written, never read, no UI; revisit post-launch if needed. |
| Combat loot rolling | Change | Honor min/max quantity; roll tiers + properties per D3. |
| Legendary drop protection | Keep | Hand-placed legendaries are an itemization pillar. |
| Take/Leave loot screen | Keep | End-of-dispatch ritual. |
| Five-tier item quality | Change | Wire potency/striking into combat math; tiers stop being cosmetic. |
| Equipment slots (11+4+2) | Keep | Locked in D3. |
| Equip/swap + drag validation | Keep | Manual ritual is core UX; logic ports as pure functions. |
| Global unique-item enforcement | Keep | Simple invariant. |
| Bulk / carrying capacity | Change | Enforce at haul time, not per-item: capacity caps what a team carries home; over-cap = choose what to leave at the loot screen. Transport tiers become meaningful. |
| Loot generation grammar (bases × tiers × properties) | **New system** | Drop-time rolls, tier weights by difficulty, property budgets. Needs design brief. |

**Verification note:** pricing/loot constants as fixtures; add a property test that no random loot table can emit an is_unique item.

---

## Area 6: Save/load & data architecture — CONFIRMED 2026-08-10

**Structural decisions:** (1) **No database engine.** Content = typed in-memory TS registries (flat arrays + derived indexes, `affects:` wiring metadata) bundled at build; saves = JSON envelope via SaveStore. Scale-checked to 2–3k items (~1–1.5MB, trivial); IndexedDB is the designated web-save fallback if localStorage's ~5MB cap ever binds — swappable behind SaveStore without sim changes. (2) **Item instances are tuples** — `(base_id, quality_tier, property_ids[], seed)`; display name/stats/tooltips recompute from registries (constraint 7 shape). (3) **Content is machine-converted, never retyped** — a one-time converter reads the built game_data.db and emits registries, gated by expected-count checks.

| Feature | Verdict | Note |
|---|---|---|
| Two-database split | Change | The split is sacred; substrate becomes TS registries + JSON SaveStore. |
| Slot-based saves | Change | Build the designed-but-missing part: slots, metadata, autosave rotation, via SaveStore day one. |
| Idempotent schema migration | Change | Philosophy becomes constraint 8's backfill chain on the JSON envelope, before first release. |
| Key-value game_state w/ read-time defaults | Keep (philosophy) | Default-merging on load; missing key never fatal. |
| Relational hero graph | Change | Typed nested structures; UNIQUE-constraint invariants become types + validators. |
| Resumable dungeon state | Keep | (template_id, seed, deltas) — proven shape. |
| Cross-DB orphan validator | Keep (transformed) | Vitest suite: save refs resolve against registries; absorbs registry wiring test. CI + load-time. |
| Content build pipeline gates | Change | Expected counts, unique IDs, append-only feat/spell ID discipline all survive the stack change. |
| Legacy backfill hooks | Keep (pattern) | Existence proof of the backfill chain; formalize from day one. |
| Dev party snapshot/restore | Keep | Fixture-based dev states, shared with tests. |
| DLC via ATTACH | Change | Modular content packs (bible §10) become registry bundle merge at load. |
| SQLite plumbing (res:// copy, MD5 cache, safe_str guards) | Remove | Problem class dissolved by the stack. |
| SaveStore abstraction | **New system** | Constraint 6: interface first; Tauri FS desktop/mobile, localStorage web (= itch demo cap). |

---

## Area 7: Content & data tables — CONFIRMED 2026-08-10 (with volume amendments)

**Volume targets:** enemies **300–500 authored bases × variant templates (undead = 2×)** → 600–1,000 effective statblocks; quests **300–400 authored**. Both comfortably inside the no-DB registry envelope.

| Content | Verdict | Note |
|---|---|---|
| Spells (205 + 12 consumable) | Keep | Machine-convert; converter maps grid-square ranges/AoE → continuous distance units. |
| Found-spell gate (12 + rationale prose) | Keep | Exploration-loot hook, verbatim. |
| Items (~180) | Keep (rescoped) | Authored base catalog for the grammar; grows toward 300–500 bases. |
| Quality tiers + 33 properties + 7 legendaries | Keep | Promoted to load-bearing grammar vocabulary. |
| Enemies | Change | **Base × variant-template grammar**: authored bases + flavor templates (undead etc.) applying stat/immunity/ability/loot transforms. Each base gets ai_profile + spell list per LOCKED enemy design. |
| Classes (13) + launch roster | Keep | 8 launch LOCKED; Ranger/Bard/prestige post-launch. |
| Class progression (230 rows) | Keep | Machine-converts. |
| Proficiency milestones (112 rows) | Keep | Untouched. |
| Feats (227 + 67 impl notes) | Keep | Data ports; interpreter rework is Area 1; deed-feats authored against event vocabulary. |
| Skills / class-skill maps / weapon grants | Keep | As-is. |
| Loot tables + shop stock | Keep | Plus Area-5 completions. |
| Warlock subsystem | Keep | All data. |
| World lore (~82 entities) | Keep | Spine raw material. |
| Quests (12 → 300–400) | Change | **Authored spine + large authored side-quest pool, procedurally scheduled** (region/level/pressure filters; some quests lightly parameterized templates). Generator becomes a scheduler over authored content. |
| Narrative schema (9 empty tables) | Change | Becomes three registries: **quest pool**, **arc graph** (arcs → quest refs, ordering/branching/gating, villain/NPC bindings), **NPCs/factions** with lore_references folded in as `appears_in:` wiring (validated by the registry wiring test). Dialogue trees deferred post-launch. |

---

## Area 8: UI shell, audio & platform — CONFIRMED 2026-08-10

| Feature | Verdict | Note |
|---|---|---|
| Scene shell + autosave on transition | Keep (policy) | React screen router; autosave policy carries. |
| Combat suspend/resume mechanism | Change | Policy (victory resumes run, defeat ends it) lives in sim; scene-freezing machinery dissolves. |
| Unified Hero Panel (3 modes, 4 tabs) | Keep | Wizard-gating semantics keep; gains the loadout tab (D4); persisted-tab hack dissolves. |
| Tooltip contract (Alt-expand position lock, 350px cap, row grammar) | Keep | Re-spec in DOM verbatim. |
| UITheme tokens (~90 semantic colors, 8-step ramp) | Keep | Becomes CSS custom properties; fold in school/feat-type color maps. Seed of Phase-3 identity. |
| Icon cells + selection cycle | Keep | Shared picker interaction grammar. |
| Audio taxonomy + AudioManager design | Keep (design) | 4-domain event tree, %s_death interpolation, category dB presets; Web Audio + build-time manifest. raw_audio sorting remains a content task. |
| GameLog panel | Change | Merges into the beat-feed system — one event stream, filtered views. |
| Hotkeys (toggle-or-switch, modal-aware) | Keep | Typed routes kill the stale-index bug class; rebinding deferred. |
| Dev menu (F1 cheats, dev snapshots) | Keep | Commands against the sim; how you debug an auto-battler. |
| Options/DisplayScale | Change | Real settings screen (audio/text scale/accessibility); DisplayScale dissolves into responsive CSS. |
| Title screen / save slots | Change | Finally built, on SaveStore. |
| CanvasLayer z-order, resolution scaling, RichTextLabel workarounds | Remove | Problem category dissolved by the DOM. |
| New screens (dispatch hub, live map + beat feed, formation editor, loadout, after-action report, multi-team switcher, pressure display) | **New design** | Phase-2 unstyled HTML, specced against the event vocabulary. |

---

# STEP 3 COMPLETE — all eight areas confirmed.
