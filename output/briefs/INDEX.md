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

## Findings companions — these WIN over their briefs

| File | Overrides |
|---|---|
| [`combat-playback-findings.md`](combat-playback-findings.md) | overrides brief #12 |
| [`combat-room-findings.md`](combat-room-findings.md) | overrides brief #19 §§12.1 and 13.4 in three places |
| [`creature-size-findings.md`](creature-size-findings.md) | overrides brief #20 §9.4 — the radius convention is measured, not assumed |
| [`character-advancement-findings.md`](character-advancement-findings.md) | corrects brief #22 in three places; §4 holds the founding four's measured statblocks |

## Session setups — ready to start

⚠ **START HERE: [`SESSION-PROMPTS.md`](SESSION-PROMPTS.md)** holds the copy-paste opening message for
each session. The files below are what those prompts point at.

**Order: #29 → #30 → #28.** #29 and #30 may run concurrently (different directories); #28 runs last.

| Order | File | Becomes | First action |
|---|---|---|---|
| 1 | [`SESSION-class-abilities.md`](SESSION-class-abilities.md) | #29 | ⚠ **Audit the 144 inert feats** (63% of 227; 5 of 13 classes have none). Design nothing first. |
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
