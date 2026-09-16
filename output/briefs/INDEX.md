# Design briefs — INDEX

> **Read this file, not the directory.** There are 30+ briefs here totalling ~470,000 characters.
> Open a brief only when this index says it governs the thing you are about to change.

## The two rules that matter more than any individual brief

1. ⚠ **A brief with a `-findings.md` companion has been CORRECTED by it.** The brief stays as
   approved; the findings doc is the implementation record and **wins on every measured fact.**
   Read the findings file FIRST, and never trust the brief over it.
2. **"APPROVED" ≠ "shipped", and "shipped" ≠ "still true."** Check the status column below,
   then check the findings companion, then check the code. In that order.

## Status

| # | Brief | Status | What it settled |
|---|---|---|---|
| — | [`brief-event-vocabulary.md`](brief-event-vocabulary.md) | APPROVED · shipped | The event vocabulary. Schema FROZEN 2026-08-10; additive only. |
| — | [`brief-escalation.md`](brief-escalation.md) | APPROVED · shipped | World pressure / escalation ledger — the one sanctioned history-dependent state. |
| — | [`brief-loot-grammar.md`](brief-loot-grammar.md) | APPROVED · shipped | Loot generation grammar: authored bases × tiers × named properties. |
| — | [`brief-profile-ai.md`](brief-profile-ai.md) | APPROVED · shipped | Mission-profile party AI (Full Explore / Boss Rush / Mystery Hunt / Loot). |
| #5 | [`brief-phase2-ui.md`](brief-phase2-ui.md) | APPROVED · shipped | Phase 2 unstyled UI — the screen set before the desk grammar landed. |
| #6 | [`brief-content-slice.md`](brief-content-slice.md) | APPROVED · shipped | Content vertical slice; moved `data/game_data.db` into this repo. |
| #7 | [`brief-tauri-devwrap.md`](brief-tauri-devwrap.md) | **PARKED** | Tauri 2 standalone .exe wrap. Not cancelled — parked by decision. |
| #8 | [`brief-art-direction.md`](brief-art-direction.md) | APPROVED · **NORMATIVE** | The Cartographer's Table. **The contract for ALL UI work** — see the desk grammar in CLAUDE.md. |
| #9 | [`brief-type-program.md`](brief-type-program.md) | APPROVED · shipped | Alegreya + the readable type scale. |
| #10 | [`art-integration.md`](art-integration.md) | APPROVED · shipped | Pastes, portraits, the founding four's art. |
| #11 | [`ux-pass.md`](ux-pass.md) | APPROVED · shipped | The readability pass — hierarchy, labels, the chart. |
| #12 | [`combat-playback.md`](combat-playback.md) | APPROVED · shipped | Combat Playback: The Field. ⚠ corrected by `combat-playback-findings.md`. |
| #13 | [`dungeon-balance.md`](dungeon-balance.md) | APPROVED · shipped | The three dungeon balance questions; `sealedRoutes`/`bossRoomSealed` precedent. |
| #14 | [`dungeon-level-wall.md`](dungeon-level-wall.md) | APPROVED · shipped (halves) | The dungeon_level 5+ wall. Decision record §9. Approved halves shipped with #15. |
| #15 | [`party-ai.md`](party-ai.md) | APPROVED · shipped | Party AI and the Caution Dial. Implementation record §12. Source of the engageRange split. |
| #16 | [`dungeon-harness.md`](dungeon-harness.md) | APPROVED · shipped | The dungeon regression harness. §3 is the origin of the ±8-point precision rule. |
| #17 | [`melee-interdiction.md`](melee-interdiction.md) | ⛔ **CLOSED — not pursued** | Melee interdiction. **No code was ever written** — the commit is docs-only. Its numbers are void (measured 2026-08-12, before the illegal-armour fix). **Its two surviving findings were extracted:** "position confers nothing" → `output/reference/combat.md`; the pin's HELD verdict → `output/future-work.md`. Do not act on its option table. |
| #18 | [`playtest-pass.md`](playtest-pass.md) | APPROVED · shipped (findings 2+4) | The playtest pass. |
| #19 | [`combat-room.md`](combat-room.md) | APPROVED · shipped | The Combat Room — walls, AoO from content, the backstab. ⚠ corrected by its findings file. |
| #20 | [`creature-size.md`](creature-size.md) | APPROVED · IMPLEMENTED | Creature size. ⚠ `creature-size-findings.md` OVERRIDES §9.4 — convention B is measured. |
| #21 | [`spell-shape.md`](spell-shape.md) | APPROVED · IMPLEMENTED | Spell shape: direct vs area. `aoe_shape` is the authority. |
| #22 | [`character-advancement.md`](character-advancement.md) | APPROVED · IMPLEMENTED | Feat slots, the `ability` verb, known spells, 4×+2 boosts, autopilot priorities. ⚠ findings file CORRECTS it in three places. |
| #23 | [`class-itemization.md`](class-itemization.md) | APPROVED · IMPLEMENTED | Weapon/armour proficiency, consumables + quick-slots, scroll `spell_id` repair. Corrected the illegal-armour brackets. |
| #24 | [`magic-items-and-scrolls.md`](magic-items-and-scrolls.md) | APPROVED · IMPLEMENTED | Strike riders, `stat_bonus`, the Arcana/Religion scroll ladder, the Variant G sheet. ⚠ the brief is WRONG about `stat_bonus` — see §6. |
| #25 | *(no brief file)* | shipped | Buff/debuff resolvers — ran as a parallel session off #24's findings. Record = commits `1a96ade`, `755d4a3` + `tests/combat/buffDebuff.test.ts`. |
| #26 | [`enemy-abilities.md`](enemy-abilities.md) | **APPROVED · M1+M2+M3 IMPLEMENTED** | Making the 45 existing statblocks fight differently. 16 of 19 reachable abilities live. ⚠ M4 DEFERRED (the brief flags it as the one to cut), and the 16 L7+ abilities deferred to the 7+ band. Decisions + measured effect in `output/future-work.md` §1. |
| #27 | [`enemy-taxonomy.md`](enemy-taxonomy.md) | ⚠ **APPROVED WITH AMENDMENTS** | Enemy taxonomy: 7 families × 5 brackets, L1–20. **Supersedes the 300–500 row-count target.** §9 holds Steven's answers: Brackets IV/V gate on a **playtested L10** (not quest difficulty); the six roles are **superseded by four classifications** (Fodder 40–50% / Melee / Ranged / Magic); ranged split to #28; enemy races+classes and the feat audit split to their own sessions. |
| #29 | [`29-approved-selection.md`](29-approved-selection.md) | ✅ **APPROVED — 33 paths** | **The current plan for class specialization.** Steven pared #29's 79 paths to 33 across 10 classes (prestige dropped to post-launch). Its hooks would revive **89 of the 197 dead feats**. §3 flags the cost outliers, §4 records the 23 near-free paths left on the table, §5 suggests a build order. ⚠ Mystic Theurge's zero-slot bug is DEFERRED, not fixed. |
| #29 | [`29-class-specialization-paths.md`](29-class-specialization-paths.md) | superseded by its selection | The full 79 paths with per-path engine marks, kept for the reasoning. **Not the current plan** — read the approved selection above. Mined legacy for two designs: the touch-damage wizard is authored twice over and inert, and Pact Boon (Blade/Tome/Chain) is the Warlock spine. |
| #30 | [`enemy-specification.md`](enemy-specification.md) | ✅ **IMPLEMENTED** | Enemy races × classes — 22 races, 6 classes, all 45 rows assigned; Fodder 80.0% → **40.0%**. ✅ Verified first: `pickAction` works for non-heroes, so classes were WIRING. ⚠ **§13 is the load-bearing read:** an ability is a *downgrade* for an AI that cannot choose its moment (hero took **less** damage from classed enemies, 1862 → 694), fixed with a per-unit ability cadence; **an action that adds no swing is a loss**, which is why Poison Weapon and Divine Lance were dropped from classes. Gate: `tools/check-enemy-taxonomy.mjs` in `pnpm check` + CI. |

## Findings companions — these WIN over their briefs

| File | Overrides |
|---|---|
| [`combat-playback-findings.md`](combat-playback-findings.md) | overrides brief #12 |
| [`combat-room-findings.md`](combat-room-findings.md) | overrides brief #19 §§12.1 and 13.4 in three places |
| [`creature-size-findings.md`](creature-size-findings.md) | overrides brief #20 §9.4 — the radius convention is measured, not assumed |
| [`character-advancement-findings.md`](character-advancement-findings.md) | corrects brief #22 in three places; §4 holds the founding four's measured statblocks |
| [`class-abilities-phase1-findings.md`](class-abilities-phase1-findings.md) | **overrides `SESSION-class-abilities.md` §3 and `future-work.md` §1b.** The feat system is **87% inert (30 of 227 reach a consumer), not 63%** — `isEffectReady` overstates by 2.8× because it gates on effect TYPE while real consumers match payload shape (twice, the feat's NAME). The picker offers 42 feats that do nothing. Ranger/Bard are an AUTHORING gap only. |

## Session setups — ready to start

⚠ **START HERE: [`SESSION-PROMPTS.md`](SESSION-PROMPTS.md)** holds the copy-paste opening message for
each session. The files below are what those prompts point at.

**Order: #29 → #30 → #28.** #29 and #30 may run concurrently (different directories); #28 runs last.

| Order | File | Becomes | First action |
|---|---|---|---|
| 1 | [`SESSION-ability-modelling.md`](SESSION-ability-modelling.md) | #31 | ⬅ **NEXT.** Model 3–5 abilities for each of #29's 33 approved paths. ⚠ Design half is safe now; implementation needs `src/sim/combat/**` and collides with #30 — the file's §6 says how to check. §7 holds one safe code task (grey the 42 dead feats out of the picker). |
| 1 | [`SESSION-class-abilities.md`](SESSION-class-abilities.md) | #29 | ✅ **DONE.** Audit → `class-abilities-phase1-findings.md` (87% inert, not 63%); design → `29-approved-selection.md` (33 paths). Next: model the abilities. |
| 1 | [`SESSION-enemy-specification.md`](SESSION-enemy-specification.md) | #30 | Verify `pickAction` works for non-heroes — the races×classes plan rests on it being wiring. |
| 2 | [`SESSION-ranged-enemies.md`](SESSION-ranged-enemies.md) | #28 | ⚠ **A BALANCE brief, not a wiring task.** Unblocks Ranged *and* real enemy Magic. |

✅ **No `build.ts` collision** — #30 owns it, and #28 is sequenced after #30 rather than parallel.

⚠ **Every session file opens with a §0 working rule: build, don't theorycraft.** Settled targets
(40–50% fodder) are not to be re-derived, and superseded goals (the 300–500 row count, the ≥60%
ratio) are not to be benchmarked against.


## Pre-brief scoping notes (context, not contract)

| File | What it is |
|---|---|
| [`arena-costing.md`](arena-costing.md) | Costing record for arena options (pre-brief). Feeds any future arena work. |
| [`character-workstream.md`](character-workstream.md) | Scoping note that became briefs #22–#24 (pre-brief). |

## Where the non-brief authority lives

- `output/core-loop.md` — the settled game loop. **Conflicts resolve toward this file.**
- `output/decision-ledger.md` — per-feature Keep/Change/Remove verdicts.
- `output/archive/guild-vigil-migration-plan.md` — phases, scaffolding, risks (Part IV = repo layout).
- `output/reference/*.md` — the domain deep-references split out of CLAUDE.md.
