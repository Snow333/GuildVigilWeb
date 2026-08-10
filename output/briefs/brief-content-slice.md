# Implementation Brief #6 — Content Vertical Slice: "The Vanguard's Shadow" (Krath incursion arc)

**Date:** 2026-08-10
**Status:** APPROVED 2026-08-10 (Steven: "Looks good, lets give it a shot")
**Covers:** plan Part III "parallel content workstream — vertical slice first (1 arc, ~10 quests, ~20 enemy bases + undead variants, 2 NPCs)" + the authoring pipeline it proves (risk R4 mitigation) + minimal sim/UI additions the arc stands on
**Authorities:** seeded world lore (Dominion of Krath), `core-loop.md`, escalation brief #2 (villain-beat triggers), decision-ledger Area 6 (never retype content)
**Steven's prior calls:** db moves into GuildVigilWeb · arc = Krath vanguard incursion

---

## Summary

The Dominion of Krath probes Haven's frontier: a linear ten-quest arc that escalates
from goblin raids to a fortified vanguard foothold, authored as seed SQL against a
web-repo-owned `game_data.db` and converted through the existing count gates. The
slice exists to prove the PIPELINE (authoring → validation → conversion → sim →
screen) before batch production; the arc is the proof's cargo. Two NPCs give the
arc a face; villain beats fire off the escalation ledger's tier crossings, binding
world pressure to story for the first time.

## 1. The authoring pipeline (the actual point of the slice)

- **`data/game_data.db` moves into GuildVigilWeb** (committed; ~480 KB; the Godot
  repo stays frozen forever). Converter default path → `data/game_data.db`.
- **Content is authored as seed SQL**, mirroring the Godot pipeline's convention:
  `data/seeds/seed_arc_vanguards_shadow.sql` — idempotent INSERTs, **append-only
  ids with gaps** (quests 100+, enemies 100+, npcs 1+; content IDs are forever).
- New tool: `tools/apply-seed.mjs` (~40 lines) — applies a seed file to the db
  inside a transaction; `pnpm db:apply <seed>` + `pnpm convert` regenerate the
  registries. Count gates in the converter AND `count-gates.test.ts` update in the
  same commit (quests 12→22, enemies 24→~44, npcs 0→2, storylines 0→1, …).
- **New content validators** (`tests/content/validators.test.ts`): every quest's
  `enemy_group`/`reward_items` reference real rows; dungeon quests carry a
  `dungeon_level`; enemy stats sit inside the level bands the encounter math was
  tuned for (vs. exemplar rows); storyline sequences are gapless and reference
  real quests; dialogue triggers reference real quests/NPCs. Validators gate every
  future batch — this file is the gate's first brick.

## 2. The arc — "The Vanguard's Shadow"

Ten quests, three movements, linear (branching stays unused this slice):

| # | Movement | Quests (working titles) | Band | Type |
|---|---|---|---|---|
| 1–3 | **Raids** (unlock: game start) | Burned Granary · Tracks in the Ashes · The Scout's Satchel | 1–2 | combat, combat, dungeon |
| 4–7 | **The Reveal** (each unlocks on its predecessor) | Iron-Shod Ambush · The Supply Cache · What the Graves Gave Up · The Whisper's Man | 3–5 | combat, dungeon, dungeon (undead), dungeon |
| 8–10 | **The Foothold** | Find the Fort · Break the Engines · The Vanguard-Captain | 5–7 | dungeon (mysteryHunt-flavored), dungeon, dungeon (boss) |

- **Villain:** *Vanguard-Captain Ruk Mor-Tal* (hobgoblin, `npcs.category='villain'`,
  with combat stats + a paired legendary-tier enemy base for quest 10). A mid-tier
  officer under Warchief Splitfang — the seeded heads of state stay campaign-scale.
- **Mentor:** *Marshal Edrin Vale* (Haven's frontier marshal, `category='mentor'`),
  the arc's quest-giver voice: dialogue beats at the opener, the reveal (quest 4),
  pre-boss (quest 9 complete), and victory.
- **The Whisper thread:** `lore_references` drops (spoiler levels 1→3) on arc items
  and enemy barks hinting that Haven is already infiltrated — the hook for the next arc.
- **~20 enemy bases** across levels 1–7: goblin variants (sapper, firebrand,
  alarmist…), wargs, orc raiders/breakers, hobgoblin legionnaires/tacticians/siege
  crews, undead auxiliaries for quest 6 (bone conscripts, grave-whisperer — the
  plan's "+undead variants"), and the boss. Stats banded against existing exemplar
  rows; the validator enforces the bands.
- **`world_regions` gets populated** for the five region ids — the pressure table
  and board finally show "The Ashmark" instead of `region_ne` (names TBD in seed).

## 3. Sim additions (small, real, and where the rules live)

- **Storyline-gated posting** (~40 lines in `advanceWeek`): a quest belonging to a
  storyline posts only when UNLOCKED — opener at `trigger_type='game_start'`, each
  successor when its predecessor is in the `completed` map. **Progress is DERIVED
  from the completed map (constraint 7) — nothing new is serialized; old saves
  just meet the arc at its start.** Arc quests expire/cooldown/repost like any
  posting and are never lost — gating controls first eligibility only.
- **Villain beats fire** (~10 lines): `EscalationLedger.append` already returns
  tier crossings; the session now emits `world.villain_beat_fired` (existing
  FROZEN vocabulary — no schema change) with the arc's beat id on upward
  crossings in arc regions. After-action's "world's answer" shows it.
- **Dialogue query**: `session.pendingDialogue()` — story_dialogue rows whose
  triggers (quest_complete against the completed map) have fired, in sequence.
  Pure derivation; no state.

## 4. UI additions (plain HTML, Phase 2 style budget)

Town hub gains a **"The Marshal's Table"** section (mini-mock below — flag if you
want a full wireframe pass instead): triggered dialogue renders as speaker-labeled
text blocks; v1 choices render as labeled buttons that acknowledge only (choice
consequences are out of scope this slice). Region names from `world_regions`
replace raw ids on the town hub, board, and map screens.

```
┌─ The Marshal's Table ──────────────────────────────┐
│ Marshal Edrin Vale — "Third granary this month.    │
│ Goblins don't organize like this. Something is     │
│ pushing them south."                               │
│ [ "We'll look into it." ]                          │
└────────────────────────────────────────────────────┘
```

## 5. Edge cases (interviewed against the codebase)

- **Arc quest expires/fails** → normal cooldown, reposts, arc stalls but never dies.
- **Mid-arc save/reload** → progression derives from `completed`; nothing to migrate.
- **Pre-slice saves** → new quests simply begin posting per gating; no backfill needed.
- **Band collisions** → arc quests share the board with the original 12 under
  `maxOpenQuests` 4; gating throttles arc pacing naturally. Original 12 stay ungated.
- **Harness** → pool 12→22 shifts the career distribution (content growth, the
  anticipated kind). Re-baseline with justification; structural bounds must hold;
  e2e trace re-probed. **The cooldown-era economy dip (gold p50 2793) should
  partially recover** — more dungeon quests in band. The new baseline is the tell.
- **Dungeon levels 5–7** reach `medium`/`large` tiers — first real use above `small`
  in campaign play; forecast panel makes the difficulty legible before launch.

## 6. Out of scope (explicit)

Batch production (300–400 quests), branching storyline paths, dialogue-choice
consequences, deed-feats, POI capture/income, faction mechanics, new event types
(vocabulary untouched), any styling (Phase 3), known-spells model.

## 7. Acceptance criteria

- [ ] `pnpm db:apply` + `pnpm convert` green with updated gates; validators green
- [ ] Career harness re-baselined, justified, structural bounds hold; e2e green
- [ ] Hand-check: new campaign → opener posts week 1 → completing it unlocks its successor → quest 6 fields undead → quest 10 reaches the Vanguard-Captain
- [ ] Marshal dialogue appears at the four beats; villain beat fires on a tier crossing
- [ ] Regions display authored names; save/reload mid-arc preserves progression
- [ ] `pnpm check` green before ship (as always)

## 8. Risks / watch points

- **Content quality is now the product** — stats/rewards hand-tuned against
  exemplars, but the harness only checks aggregates; hand-play is the real gate.
- **Board crowding**: 22 quests vs. 4 slots may starve arc postings at some levels;
  if pacing feels bad in hand-play, `maxOpenQuests` becomes a design conversation.
- **The db in git**: binary diffs are opaque — the seed SQL files are the reviewable
  artifact; the db is derived output we also commit (like `src/content/generated`).
