# Implementation Brief #11: The Readability Pass — Hierarchy, Labels & the Charter
**Date**: 2026-08-11
**Status**: **IMPLEMENTED 2026-08-12** — approved 2026-08-11, shipped green (323 unit + 9 e2e). As-built notes at the bottom.
**Process**: Wireframe phase COMPLETE — `output/exploration/ux-pass-r01.html` (desktop artifact `guild-vigil-ux-pass-r01`), before/after on all four surfaces, reviewed 2026-08-11. Register decisions taken at review and recorded below.
**Authorities**: brief #8 (the desk grammar) is normative for every visual decision here; brief #10 for the paste/portrait surfaces this touches; the art-style bible §5 for flat mode.

> **Process note.** The `implementation-brief` skill still speaks Godot — GDScript line targets, autoloads, scenes, signals, `gdscript-audit`. The repo migrated to TS/React three phases ago. This brief keeps the skill's *discipline* (wireframe → approval → brief → code; systematic edge-case interview; testable acceptance criteria) and maps its sections onto the real stack. **The skill itself wants updating** — flagged, not fixed here.

## Summary
A readability and information-hierarchy pass over four surfaces where the interface is currently burying the thing the player needs. The quest board gets a real hierarchy and a named difficulty category; the title screen gets its reading order fixed; dispatch stops showing sim ids to players; the after-action report stops printing every hero twice. One new sim query, one presentation label map, no schema change, no content change.

## Decision record (2026-08-11, from comp review)
1. **Difficulty is a named category on the notice**, derived from `challenge − partyLevel` — the same relation the autopilot already uses to decline work. Wording: **the guild's judgement** register (Routine / Measured / Dangerous / Beyond us), not the plain register.
2. **Profile and caution get display labels in the guild's voice** (Sweep it clean / Cut out the heart / Follow the thread / Strip it and go). **The sim ids do not change** — they are carried in the frozen `dispatch.started` payload. Labels are presentation only.
3. **Regional pressure leaves the quest notice.** It describes the region, not the job, and it already has two homes: the town hub watch report and the chart.
4. **The charter is name-first.** The campaign-name field moves above the slot list, because it is the prerequisite for every button below it.
5. **XP consolidates to one row per hero**, with source as a column and an explicit total.

## The findings that drove this (recorded, because they change what "fix it" means)
- **The green chip on a posting was never difficulty.** `QuestBoard.tsx` renders `session.pressure(b.regionId)` — the escalation tier of the region. "To Quiet" is a fact about The Ashmark. It was the loudest element on the card while answering a question nobody asked there.
- **Real difficulty was already in the data**, rendered as the words "challenge 1" in 12px muted body text: `BoardEntry.challenge`, the dungeon level, which is exactly what the accept decision weighs.
- **`fullExplore` / `bossRush` / `mysteryHunt` / `lootRun` are sim ids that leaked into the interface.** Nothing else on the desk speaks camelCase.
- **The after-action report walks the event stream and prints a row per XP *award*.** A four-hero party that fights and completes produces eight rows and eight portraits.
- **The desk's leather is `baseFrequency 0.055` over a 300px tile.** At full-viewport scale that is not grain, it is cloud — the "visual artifacts" on the title screen.
- **The red-ink stamp already collides with the posting title today** (`GUILD WORK` lands across "Granary"). A larger title makes it worse, so the stamp needs a reserved column either way.

## Scope
**In scope**:
- **Difficulty band** — a derived field on `BoardEntry`: band id, label, status tier, and a short plain-language reason. Derivation lives in the sim; the UI renders it and computes nothing.
- **Quest notice rebuild** — title 21px with the id demoted to a tag; difficulty line directly under the title; equal-weight LEVEL / TRAVEL / REWARD stat blocks in priority order; muted footer for region, xp, and expiry; stamp column reserved.
- **Charter rebuild** — name field first; slot *list* replacing the slot table; fixed action column with real vertical rhythm; pin inset onto the sheet; wax retired from "New campaign" (it navigates now — brief #10 moved the commitment to the muster) and kept on Delete.
- **Desk grain retune** — `--gv-tex-leather` to `baseFrequency 0.5` at opacity 0.10.
- **Display labels** — profile and caution, as cards with a one-line consequence; "Caution" renamed **NERVE** so the label and its value stop sharing a word.
- **After-action XP** — one row per hero, source as columns, party total, and an XP-progress column.

**Out of scope** (explicitly excluded):
- Any change to `MissionProfile` / `Caution` **ids**, or to any event payload. The schema stays frozen.
- Any change to difficulty *balance* — the bands describe the existing numbers, they do not retune them.
- The world chart, town hub, hero panel, shop, playback, settings, and the founding muster. Untouched.
- Re-theming, new tokens beyond the grain retune, or any new status colour. The frozen set is the frozen set.
- Sorting or filtering the quest board. Hierarchy only.

## Files to create
- `src/sim/campaign/difficulty.ts` — `DifficultyBand`, `difficultyFor(challenge, partyLevel)`. Pure, ~40 lines. Single responsibility: turn two numbers into a band + label + tier + reason.
- `src/ui/labels.ts` — `PROFILE_LABELS`, `CAUTION_LABELS`: id → `{ label, blurb }`. Presentation only; the sim never imports it.
- `src/ui/screens/afterActionXp.ts` — `groupXpByHero(rows)`, pure, so the consolidation is unit-testable without rendering React.

## Files to modify
- `src/sim/campaign/session.ts` — `BoardEntry` gains `difficulty: DifficultyBand`; `board()` fills it from `this.partyLevel()`. Harden `partyLevel()` against an empty roster (see risks).
- `src/ui/screens/QuestBoard.tsx` — the notice rebuild. **Keeps `data-posting`, `data-quest-id`, `data-challenge`** — the e2e accept policy reads them.
- `src/ui/screens/TitleScreen.tsx` — the charter rebuild.
- `src/ui/screens/DispatchSetup.tsx` — profile/caution cards from the label map.
- `src/ui/screens/AfterActionScreen.tsx` — the consolidated XP table.
- `src/ui/styles/tokens.css` — the leather grain retune (one declaration).
- `src/ui/styles/screens.css` — notice, charter, profile-card, and XP-table layout.
- `src/ui/styles/components.css` — readable-type selector list extended to any new tracked/small-caps site.
- `e2e/boot.spec.ts` — **contract change, see risks.**
- `e2e/newCampaign.ts` — the "New campaign here" button label changes to "New campaign".
- Tests: difficulty bands, label-map totality, XP grouping (see acceptance).

## Signals / data flow
No new events, no new payloads, no schema version bump. The one new fact — the difficulty band — travels the existing `board()` query, the same way `pressureTier` does today.

## Edge cases to handle
- **Empty roster / `partyLevel()` NaN.** `partyLevel()` divides by `this.heroes.length`; an empty roster yields `NaN`, and `Math.max(NaN, 1)` is `NaN`, which would poison every band on the board. Not reachable today (dead heroes stay in the roster), but the difficulty query makes it load-bearing. Guard it at the source and test it.
- **All heroes dead.** Party level still derives from class levels, so bands still resolve — the board keeps working while the guild is a graveyard. Intended.
- **Unreachable quest** (`travelPreview` returns null): the TRAVEL block reads "—" and a red-ink line says so. Red ink is correct here — no road is the world talking back.
- **Missing `dungeon_level`**: already handled upstream (`challenge` falls back to `min_level`, floored at 1). The band must not re-implement that fallback.
- **Unknown profile/caution id** reaching the label map: fall back to the raw id rather than rendering blank — the skip-and-log discipline the event vocabulary already mandates for consumers.
- **Long campaign names / long quest titles**: ellipsize. Names may truncate; numbers never do.
- **Empty campaign name**: "New campaign" stays disabled, now with the field directly above it so the reason is visible.
- **XP rows for a hero absent from the roster** (died and removed by some future rule): render the name from the event, omit the portrait, still count them in the total.
- **A future XP source beyond combat/quest**: build the columns from the sources actually present rather than hardcoding two, so a new source cannot silently vanish from the report.
- **Zero XP earned**: keep the existing "None earned" empty state; do not render an empty table with a zero total.
- **Stamp collision**: a stamped notice reserves the stamp's column so red ink never lands on the title.
- **Flat mode**: every new surface from its first build — stat blocks are borders and text, difficulty stays label-paired, profile cards keep their pressed state without relying on tilt or texture.

## Acceptance criteria
Implementation is complete when:
- [ ] `pnpm check` green; `pnpm e2e` green. Suite grows only by the additions below, each justified in the commit message.
- [ ] **Difficulty bands** unit-tested at every threshold boundary (`≤ −2` / `−1…0` / `+1` / `≥ +2`), including the NaN-roster guard, and asserted to map onto the frozen status set 1:1.
- [ ] **Label maps are total** — a test proves every `MissionProfile` and every `Caution` has a label and a blurb, in the shape of the existing "interpret is total over the frozen vocabulary" test. A new profile id cannot ship label-less.
- [ ] **XP grouping** unit-tested: eight award rows for four heroes produce four rows, correct per-source columns, correct totals, and a correct party footer.
- [ ] Quest notice renders title > difficulty > level/travel/reward > footer, with difficulty always colour **and** word.
- [ ] `data-posting` / `data-quest-id` / `data-challenge` still present and correct (the e2e accept policy depends on them).
- [ ] Zero-image-asset guard and the frozen-status-hex guard both still pass.
- [ ] Flat mode correct on all four surfaces, verified on the **built artifact**, not just in dev.
- [ ] Readable-type mode correct — any new tracked or small-caps text is in the `components.css` selector list.
- [ ] **Grammar audit line per touched surface**: pin / tape / wax / red-ink usage per brief #8. Specifically: wax appears only on Accept and Delete; red ink appears only where the world talks back (unreachable, expiry consequence), never on instructions or clerical notes.
- [ ] Steven's eyes on the charter at full-screen — the grain retune is the one change that must be judged on real hardware at real size.

## Known risks / watch points
- **`boot.spec.ts` contract change — the one harness diff.** It currently asserts "one slot table with three tbody rows, `<em>empty</em>` per bare slot". The charter becomes a list, so `tbody tr` disappears. The *intent* (three slots, empties marked) must survive the rewrite; the assertion changes shape, and the commit message must say so explicitly. This is the only place in this brief where a passing test is deliberately rewritten — treat it as a red flag if any other test needs touching.
- **The grain retune touches every screen.** It is one declaration in `tokens.css`, and it is the highest-blast-radius change here. If it reads wrong anywhere, revert that line alone — nothing else depends on it.
- **Grammar erosion is brief #8's named #1 risk**, and a readability pass is exactly the kind of work that causes it. Two red-ink misuses were already caught by eye during brief #10's screenshot review; the audit line above is mandatory, not ceremonial.
- **Difficulty wording is player-facing judgement.** "Beyond us" tells the player the guild would decline. If that ever stops matching what the sim will actually let them do, the label becomes a lie — the band and the autopilot rule must stay derived from the same relation, not two copies of it.
- **Scope creep toward sorting/filtering.** A better board invites "and let me sort by reward". Out of scope; new brief if wanted.

## Final step
Does this capture it? Anything to change before I start? In particular: the `boot.spec.ts` rewrite is the one thing I would rather you sign off on explicitly, since the working agreement treats a touched test as something that must justify itself.

---

## As built (2026-08-12)

Shipped as written, with three things worth recording:

1. **The blotching had a second source.** `--gv-tex-leather` at `baseFrequency 0.055` was only half of it — `--gv-tex-leather-coarse` at `0.012` is an ~83px feature, and that was the *large* smearing. Both were retuned (fine → 0.5 @ 0.10, coarse → 0.05 @ 0.06). The brief named one; the fix needed both.
2. **`.gv-pin--inset` had to be added to `components.css`.** It existed only in the r01 comp, so the first build put the pin straight back on the sheet's edge. Caught in screenshot review.
3. **`.gv-title` narrowed 680 → 600px.** With the Week column gone the sheet had no wide content left to justify the width, and the slot rows were stranding their action buttons.

**Two small additions beyond the brief**, both fallout from real rendering: the XP-table portrait chip is capped at 38px (the default 52px overflows a 30px ledger row and the faces collided), and the dispatch sheet's sub-heading now reads "team · orders · nerve" to match the renamed fields.

**Harness diff, as flagged:** `boot.spec.ts` line 14 only — `tbody tr` → `[data-slot]`. The contract is restated verbatim in the file header: three slots, each bare one marked `<em>empty</em>`, no console errors. `muster.spec.ts` needed the same selector swap, and three specs took the "New campaign here" → "New campaign" rename. No test was weakened, and no assertion was deleted.

**Verified:** stamp-vs-title collision measured at the glyph level (not the block box) — ~38px clear in both desk and flat mode. Flat mode checked on the built artifact across all four surfaces.
