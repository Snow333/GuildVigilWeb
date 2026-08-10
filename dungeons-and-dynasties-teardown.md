# Dungeons & Dynasties — Architecture Teardown

**Subject:** `Dungeons and Dynasties 1.9.6` (itch.io, Bretticus82)
**Method:** Static analysis of the shipped Linux AppImage + the full public devlog record
**Date:** 8 August 2026

---

## 0. Provenance and confidence

Everything in sections 1–6 is **read directly out of the shipped binary** unless marked otherwise. The extraction path was:

1. AppImage → squashfs payload at offset `944632` → `unsquashfs`
2. Payload contains `usr/bin/app` (12.2 MB Rust binary) + bundled GTK/WebKit libs
3. Frontend is brotli-compressed inside the binary's `.rodata`, keyed `/index.html`, stream starting at file offset `0xdb000`
4. Decompressed to a single **3,091,590-byte `index.html`**

Symbol names are minified, so class/function names below are the minified identifiers (`nb`, `yj`, `De`) with my inferred role in brackets. The *behaviour* is read from code, not guessed.

Where I'm inferring rather than reading, it says so.

---

## 1. Stack — confirmed

| Layer | What it actually is |
|---|---|
| Desktop shell | **Tauri 2.11.5** (`Comment=A Tauri App` in the `.desktop` entry) |
| Runtime deps | `tauri-runtime-wry 2.11.4`, `tauri-utils 2.9.3`, WebKitGTK 4.1 (90 MB, bundled on Linux only) |
| Frontend | **React 19.2.7** — `createRoot`, `useReducer`, `useSyncExternalStore` |
| Delve renderer | **PixiJS** (WebGL) — `app.stage`, `Graphics`, `renderGroup`, `batch` |
| UI/map renderer | **React → inline SVG** |
| Build | Vite, **single-file output** — one asset, zero `/assets/` directory, all JS and CSS inlined |
| Persistence | `localStorage`, key `guild-manager-save` |
| State | Hand-rolled reducers + external store. **No Redux, no Zustand, no MobX.** |
| Immutability | `immer` present but barely used (3 references); the codebase spreads objects manually |

**Notable absences:** no game engine, no ECS, no state-management library, no image files, no server, no network calls.

The 3 MB Windows installer vs 77 MB Linux AppImage asymmetry is entirely explained: Windows uses the OS-provided WebView2; Linux bundles WebKitGTK.

### Bundle composition

- Total: **3.09 MB** of inlined HTML/JS/CSS
- React runtime: roughly the first 0.2 MB
- Remainder: Pixi + game code + data tables
- **4,193 JSX call sites**, **1,377 distinct CSS class names**

---

## 2. Core loop

The dev's own framing: *advance time → face a Trial → develop your heroes between them.* Four nested loops:

**Day** — advance calendar; rest, train, recruit, shop, dispatch bench heroes on quests.
**Trial (fixture)** — pick 4, set gambits, kit them, speak to the party, watch it resolve. No direct control.
**Season** — 6 tiers × 12 guilds = 72. Promotion/relegation, cups, festivals, the Crucible. Year-turn is three screens: season review → oath offers → intake draft.
**Dynasty** — ageing, decline, retirement, permadeath, bloodlines, the Chronicle. Terminates by patron loss or voluntary "lay down the ledger."

The loop's **output is prose**. Everything feeds the Chronicle.

---

## 3. The seven patterns that produce the velocity

This is the transferable content. 22 releases in 54 days by one person with a day job and a newborn is not discipline — it's these seven decisions.

### 3.1 One simulation, three consumers

Two classes carry the entire game:

- **`nb` [DelveRun]** — party state, room index, gold, loot, `storyBeats`, `results`
- **`yj` [Encounter]** — `combatants`, `events[]`, `elapsed`, `round`, `roundStart`, `roundHasBeat`, `maxSeconds: 120`

`nb` exposes `runHeadless()`:

```js
runHeadless(){ let e=0;
  for(;!this.finished() && e++<100 && this.currentRoom;){
    if(this.currentRoomIsFight()){ const a=this.buildEncounter(); a.run(); this.applyCombat(a) }
    else this.resolveNonCombat();
    if(this.finished()) break;
    if(this.shouldRetreat()){ this.status="retreated"; break }
    this.advance() }}
```

The *same classes* drive the animated delve, the pre-delve odds forecast, and (per devlogs) the test harness. The `e++<100` room cap is a defensive bound against non-termination — worth copying.

### 3.2 Rounds are a view over an event stream, not a sim unit

`yj` carries `elapsed` (continuous seconds, cap 120) **and** `round`/`roundStart`/`roundHasBeat`/`roundClosable` side by side. Combat resolves continuously off per-combatant cooldowns; rounds are bookkeeping applied to the emitted `events[]` array.

This is why v1.9.1 could rebuild how a fight *reads* — from a scrolling stream into discrete rounds with per-round tallies — and truthfully claim *"no balance moved by a hair."* The sim never knew.

**The rule:** the simulation emits facts; the presentation layer decides how facts are grouped, paced and narrated. If your combat log is generated *inside* the combat resolver, you cannot do this.

### 3.3 The odds display *is* the game

```js
const Rg=150;
function R3(t,e,n,a,s,i=1,l={wins:0,downs:0,deaths:0,done:0}){
  for(let h=n; h<a; h++){
    const d = new nb(new De(`fc_${t.length}_${h}`), t, e, s, i);
    d.runHeadless();
    d.status==="cleared" && l.wins++;
    l.downs += [...d.state.values()].filter(f=>f.status==="downed").length;
    l.deaths += d.aftermath(new De(`fa_${h}`)).deaths;
  }}
```

150 full headless delves, run live in the browser, to produce the pre-delve forecast. Note the signature: `(start, end)` indices plus a **mutable accumulator** — the runs are chunked and resumed across frames so the UI never blocks.

Consequence: the odds shown to the player **cannot drift out of sync with the game**, because they are the game. The v1.9.5 devlog describes exactly the failure this fixes — the old 12-sample version had a measured peak error of 14 percentage points and displayed "67%, Promising" on a true coin flip.

### 3.4 String-seeded determinism everywhere

```js
class De{ constructor(e){ this.state=(typeof e==="string"? zy(e) : e)>>>0;
  this.state===0 && (this.state=2654435769) }
  next(){ this.state=this.state+1831565813>>>0; let e=this.state;
    e=Math.imul(e^e>>>15, e|1); e^=e+Math.imul(e^e>>>7, e|61);
    return ((e^e>>>14)>>>0)/4294967296 }
  float(a,b){} int(a,b){} chance(p){} pick(arr){} weightedPick(items,weights){} shuffle(arr){} gaussian(mu,sigma){} }
```

Seeds are **namespaced strings built from stable entity data**. Harvested from the bundle:

```
fc_${partySize}_${i}              forecast run
fa_${i}                           forecast aftermath
note:${heroId}:${dmgDone}:${healDone}:${dmgTaken}:${fell}
grief:${cause}:${heroId}:${n}
oathchart_${heroId}               save backfill
stakes_backfill_${heroId}         save backfill
roster:${guildId}:s${slot}:phase  rival roster
roster:${guildId}:s${slot}:g${n}  rival roster
league:${seed}                    league construction
arc:${name}:${years}:${n}:${a}:${deaths}    chronicle arc
spine:${name}:${years}:${deaths}            chronicle spine
payoff:${name}:${years}:${champs}           chronicle payoff
sub:${name}:${years}:${deaths}              saga subtitle
```

Two consequences worth separating:

- **Reproducibility.** Any derived value can be recomputed from the facts instead of stored.
- **Narrative honesty.** `note:${id}:${dd}:${hd}:${dt}` means a hero's post-fight line is a **pure function of what they actually did**. This is the real mechanism behind *"nothing in the Chronicle is invented."* It isn't a promise, it's a type signature.

Exactly one non-deterministic seed exists in the bundle (`gn-${Math.random()}`), and it's a DOM id generator.

### 3.5 The living world is lazily evaluated, not stored

This is the biggest single win and the one I'd steal first.

**Rival guild rosters are never persisted.** They're generated on demand:

```js
function Dc(guild, tier, elapsed){
  if(guild.isPlayer) return [];                       // only the player has a real roster
  const base = mB[tier-1];                            // [185,162,140,120,105,92]
  return $j.slice(0, pB(guild,tier))                  // fixed role template
           .map((role,slot) => bB(guild.id, slot, role, base, elapsed));
}
```

And `bB` is the clever part — it simulates a **succession of careers** in that roster slot:

```js
function bB(guildId, slot, role, baseAbility, elapsed){
  const phase = new De(`roster:${guildId}:s${slot}:phase`).int(0,12);
  const t = elapsed + phase;
  let acc = 0;
  for(let d=0; d<40; d++){                            // walk successive occupants
    const f = new De(`roster:${guildId}:s${slot}:g${d}`);
    const hero = za(f, {role, potentialAbility: clamp(baseAbility + f.int(-18,28), 20, 200), maturity:"rising"});
    const span = Math.max(4, raceMaxAge(hero) - hero.age);
    if(t < acc + span) return yB(hero, t - acc);      // age this one forward
    acc += span;
  }}
```

A rival guild's roster at *any* point in history is a pure function of `(guildId, tier, elapsedYears)`. No storage, no per-tick simulation of 71 rosters, and it's time-travellable — you can query any past or future season for free.

This is what makes "72 guilds with real rosters" affordable inside a 5 MB `localStorage` budget.

### 3.6 Save migration by idempotent backfill, not version branching

Envelope:

```js
const Id="guild-manager-save", kv=26;
save: { version: kv, guild: <state>, sig: JN(JSON.stringify(state)) }
```

`JN` is a double FNV-1a-style hash. A `sig` mismatch does **not** reject the save — it sets `tampered: true` and lets you keep playing.

The version constant `kv` has been pinned at **26** across twenty-odd releases, because migration isn't version-branched. Loading runs a composed pipeline:

```js
function e2(t){
  t.hall && (t.hall.facilities = Object.assign({infirmary:0,training:0,tavern:0,armoury:0}, t.hall.facilities));
  try { return X1(Y1(V1(q1(yP(t))))) }
  catch { return X1(Y1(V1(q1(t)))) }          // graceful degradation
}
```

Each stage is **idempotent and early-returns unchanged**:

```js
// q1: backfill oath terms
function q1(t){ return !t.roster?.length || t.roster.every(n => n.oathLeft != null) ? t
  : {...t, roster: t.roster.map(n => n.oathLeft != null ? n
      : {...n, oathLeft: 2 + new De(`oathchart_${n.id}`).int(0,2)})} }

// V1: backfill conviction/vow/flaw (the 1.9.5 feature)
function V1(t){ return !t.roster?.length || t.roster.every(n => n.stakes || n.monstrous) ? t
  : {...t, roster: t.roster.map(n => n.stakes || n.monstrous ? n
      : {...n, stakes: lm(new De(`stakes_backfill_${n.id}`), n.homeRegion)})} }
```

Three things to notice:

1. **Backfilled values are seeded on the entity ID**, so they're stable across reloads. Retrofitting a field into a live save doesn't re-roll it every session.
2. **`Y1` is pure data repair** — it strips `jobBoard` entries matching `/\bThe\s+The\b/` or `/\bA\s+A\b/`, cleaning a text-generator bug out of *existing* saves. `X1` prunes `partner` bonds that no longer validate.
3. There's a **key-shortening codec** on the way in and out (`enemies`↔`foes`, and a league equivalent) to keep the JSON under the storage cap.

This is the entire mechanism behind "saves carry over" on every single release. It is not luck and it is not a migration ladder.

### 3.7 Declarative registries with wiring metadata

Flat arrays of plain objects, indexed by a derived map:

```js
const yc = [ /* ...44 traits... */
  {id:"field-medic", label:"Field Medic", tone:"positive", category:"combat",
   rarity:"rare", affects:["healing","anticipation"],
   blurb:"Drags the fallen clear before anyone else has moved."} ];
const on = Object.fromEntries(yc.map(t => [t.id, t]));
```

The `affects: [...]` array is the load-bearing field. It's **declarative wiring** — the trait states which attributes it touches. That single convention gives you:

- The generated Compendium table, for free
- The "is every trait actually read by something?" check that caught **Charismatic** doing literally nothing after months in the game

**Measured registry contents:**

| Registry | Count | Shape |
|---|---|---|
| Traits | **44** | 26 positive / 12 negative / 6 neutral; 22 combat / 13 personality / 9 social; 27 common / 11 uncommon / 5 rare / 1 legendary |
| Attributes (visible) | **30** | 10 mental / 8 combat / 6 physical / 6 role |
| Attributes (hidden) | **7** | Consistency, Mettle, Pressure, Death-Proneness, Loyalty, Adaptability, Dirtiness |
| Distinct attributes traits wire into | **16** | |
| Classes | **9** | arcanist, blademaster, cleric, druid, guardian, ranger, warden, + 2 |
| Kindreds | **10** | weighted spawn: human 5, elf 3, dwarf 3, halfling 2, half-orc 2, tiefling 1.5, dragonborn 1.5, gnome 1.5, goliath 1.2, aasimar 1 |
| Regions | **7** | each with `kindreds`, `biome`, default `condition`, `sayings` |
| Dungeon conditions | darkness, deepcold, cursed, flooded, infernal, frozen | |
| Rival archetypes | **6** | see 4.3 |

---

## 4. System detail

### 4.1 Gambits — the tactical layer

The whole "you don't click attacks" system is a **first-match-wins ordered rule list**, FF12-style:

```js
evaluateGambits(e){
  for(const n of e.gambits){
    if(!n.enabled) continue;
    const a = this.resolveGambitTarget(e, n.target);
    if(a && this.checkGambitCondition(e, n.condition, a) && /* ability affordability guard */)
      return e.targetId = a.id, {action: n.action, target: a};
  }
  return null }
```

The complete vocabulary — this is the whole thing:

| Conditions (6) | Targets (6) | Actions (5) |
|---|---|---|
| `always` | `self` | `attack` |
| `allyHpBelow(%)` | `lowestAlly` | `heal` |
| `selfHpBelow(%)` | `lowestEnemy` | `ability` |
| `enemyWithin(dist)` | `highestEnemy` | `taunt` |
| `abilityReady` | `nearestEnemy` | `flee` |
| `outnumbered(n)` | `priorityEnemy` | |

`priorityEnemy` uses a threat scorer: enemy healer = 4, summoner = 3, other ability-user = 2, plain = 0.

**Seventeen enum members produce the entire tactical game.** Ordering is the strategy — the in-game Compendium explicitly warns that an `always`-condition rule placed above the ability rule means the ability never fires. And the `discipline` attribute governs whether a hero obeys the list at all: *"the disciplined follow the gambits you set them; the undisciplined improvise."*

Combat space is continuous 2D (`pos:{x,y}`, `Math.hypot`, `moveToward`, `engageRange`). `fleeFrom` blends the away-vector 60/40 with a pull toward the ally centroid — so fleeing heroes run toward the party, not into the dark.

### 4.2 The Chronicle

Markdown assembled from save facts. Structure of `UB` [renderSaga]:

```
# The Saga of ${name}: ${subtitle}
*A true story... Every event below emerged from the simulation itself over ${years} years. Nothing was scripted.*
*Of ${seat}, in ${region}.*

## Before the Charter
*The realm the hall opened its doors into.*
**${homeRegion}**
- **${yearsBefore} years before:** ${text}
**Elsewhere in the realm**
...
```

The narrative *shape* is itself seeded from aggregate save statistics — `spine:`, `payoff:`, `arc:` and `sub:` seeds all key off `(name, years, deaths, champs)`. So the story arc a dynasty gets is deterministically derived from what the dynasty actually was. Two guilds with identical statistics get identical arcs; that's the trade for the honesty guarantee.

`ci()` is a tiny sentence-terminator normaliser (`/[.!?]['"]?$/` → append a period), which tells you the prose is assembled from fragments that don't know whether they're sentence-final.

### 4.3 The living league

`q3` [buildLeague] constructs 6 tiers × 12 guilds from a single `league:${seed}` RNG: name, crest seed, power, seat (town), archetype. Tier base abilities: `[185, 162, 140, 120, 105, 92]`.

Towns are weighted by size and each hosts a fixed number of guilds — which is what creates forced derbies:

```js
ho = { great:{label:"Great City", weight:1, hosts:8, purse:1.35, depth:1.3},
       city: {label:"City",       weight:3, hosts:4, purse:1.10, depth:1.1},
       town: {label:"Town",       weight:5, hosts:2, purse:0.90, depth:0.9},
       hold: {label:"Hold",       weight:4, hosts:1, purse:0.75, depth:0.75} }
```

The entire "AI evolution layer" that gives the league a cast of characters is **six table rows, ~2,650 characters**:

| Archetype | vol | trend | buy | sell | tactic |
|---|---|---|---|---|---|
| Youth Academy | 1.5 | +1 | 0.5 | 1.4 | balanced |
| Star-Hunters | 1.3 | +1 | 2.2 | 0.5 | aggressive |
| The Old Guard | 0.7 | −1 | 0.8 | 1.2 | defensive |
| The Steady Hand | 0.5 | 0 | 0.7 | 0.7 | defensive |
| The Forged | 0.9 | +1 | 0.9 | 0.8 | defensive |
| The Gamble | 1.9 | 0 | 1.4 | 1.1 | aggressive |

Each row also carries `tip`, `surge[]` and `crisis[]` prose pools. The devlog's claim that *"The Gamble is nearly four times as volatile as The Steady Hand"* is literally 1.9 ÷ 0.5 = 3.8.

### 4.4 Worldgen

Seeded scatter-with-rejection. `bs(rng, regionId, count, obstacles, minRadius)` places features inside a region polygon while avoiding already-placed items. Rivers, lakes, islets, roads and label anchors are then fitted by candidate-and-reject.

Output is a **plain geometry object**, rendered by React into one `<svg className="realm-map">`:

```js
{ peaks, alpine, trees, deadTrees, marsh, mines, scars, fields,
  towers, rivers, lakes, islets, saltFlats, roads, landmarks }
```

Region label placement tries 5 candidate points and rejects any that collide with the coastline, other labels or towns. That's the whole "hand-drawn chart" — a generator that emits coordinates and a renderer that draws them.

Dungeon rooms use the same philosophy in Pixi, with GLSL-style hash noise for organic edges:

```js
const i = p => (Math.sin(p*127.1)*43758.5453 % 1 + 1) % 1 * 3.4 - 1.7;
```

---

## 5. What it costs

Be honest about the trade, because it's real:

- **Visual ceiling.** The dev has publicly said he's *"weighing whether the next step is to keep pushing the current framework or move the project into a proper graphics engine"* — in direct response to a player saying the UI felt flat and out of sync with the storied content.
- **Legibility.** 30 visible attributes + 7 hidden + 44 traits + convictions/vows/flaws is a lot of surface. At least one player found it *"too overwhelming and confusing."* The most active community threads are UI feedback.
- **`localStorage` ceiling.** ~5 MB forces the lazy-world design. That's a constraint that happened to produce a good architecture, but it *is* a constraint — the key-shortening codec exists because of it.
- **Determinism is a design commitment, not just a technique.** Because narration is a pure function of stats, two structurally identical dynasties read identically. Variety has to come from the sim producing varied facts, not from the writing.
- **No asset pipeline also means no artists.** Everything visual is a programming task forever.

The flip side is the thing that's easy to underrate: **v1.5 re-skinned the entire game** — dashboard, roster, guild, recruitment, training yard, finances, retinue, dungeon crawl, all world screens, legacy halls, season review, every modal — from a dark UI to parchment. In the DOM that's a stylesheet. In a scene tree it's a month.

---

## 6. Translation to Guild Vigil

Guild Vigil is Godot 4 / GDScript with standards already pointing this direction — 50-line script targets, 4-line function medians, single-responsibility, no logic in UI nodes, signal-based decoupling. Six of the seven patterns above are **stack-agnostic**. Only the free re-skin needs the DOM, and that's the one the D&D dev is currently trying to trade away.

Concrete proposals, in rough order of payoff:

**1. Make the sim a pure GDScript layer with zero `Node` dependencies.**
Plain `RefCounted` classes, no `get_node`, no `await get_tree()`, no signals *out* of the resolver. It should be constructible and runnable from a script with no scene tree at all. This is the precondition for everything else. Your existing "no logic in UI nodes" rule is half of it; the other half is "no scene tree in sim logic."

**2. Add `--headless` mass simulation.**
`godot --headless --script res://tools/sim_harness.gd` running hundreds of full careers. The D&D dev's test suite went 105 → 111 → 112 → 162 unit tests in six weeks alongside a chaos sim, a red-team run, a 20-year saga generator and a "dynasty scorecard" playing hundreds of complete 20-year careers. Balance stops being an opinion.

**3. Measure balance as distributions, not averages.**
Called out explicitly as a v1.6 addition. An average win rate hides the shape; a histogram doesn't.

**4. Adopt string-seeded RNG.**
Trivial in GDScript — hash a namespaced string into a seed. Then derived content becomes recomputable rather than storable, and you get the lazy-world trick for free.

**5. Derive the rival world instead of storing it.**
The `roster:${guildId}:s${slot}:g${n}` pattern is the highest-leverage idea in the whole codebase. Ask: what fraction of Guild Vigil's world state genuinely needs to persist, versus what could be a pure function of `(entityId, elapsedTime, seed)`?

**6. Idempotent backfill chain on load.**
Composed, each stage early-returning unchanged, each backfill seeded on entity ID. Ship it before 1.0, not after. This is what lets you push weekly to a live audience without a save-wipe.

**7. Registries with `affects:` metadata, plus a wiring test.**
A `Resource`-per-trait or a single data table, either way carrying an explicit list of what it touches. Then a test that fails if any registry entry is referenced by nothing. This slots naturally into your existing `gdscript-audit` and `test-validation-protocol` skills.

**8. Keep the log out of the resolver.**
Have combat emit an event array; let the presentation layer window it into rounds/beats. This is what buys you the freedom to redesign combat readability without touching balance.

### Open questions worth resolving before adopting any of it

- Does Guild Vigil's design need continuous-time combat, or would a discrete round model be simpler and lose nothing? D&D chose continuous and then had to add round *bookkeeping* for legibility — you could start where they ended up.
- Is the lazy-world trick compatible with Guild Vigil's persistence model, or does your design require rivals to accumulate genuine history that can't be recomputed?
- How much of the 3.09 MB is content that would be `Resource` files in Godot? That's the real portability question — the D&D approach inlines everything, which Godot's import pipeline would fight.

### One correction to the framing

The *architecture* here is light. The *design* is not simpler than Guild Vigil — 44 traits, 30+7 attributes, 108 convictions and flaws, 86,672 names, procedural worldgen, a prose generator, 72 simulated guilds, six league tiers. The lightness is entirely in the substrate. Adopting the architecture will not shrink the design work; it will make the design work cheaper to iterate on, which is a different and better thing.

---

## Appendix: extracted artefacts

Available in the working directory:

- `index.html` — full 3.09 MB decompressed frontend bundle (readable, minified)
- `app/` — unpacked AppImage tree
- Extraction scripts: `entropy.py` (locate compressed region), `scan3.py`/`scan4.py` (brotli stream discovery)
