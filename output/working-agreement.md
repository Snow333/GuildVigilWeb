# Guild Vigil — Working Agreement

**Status:** APPROVED by Steven 2026-10-16. Replaces the old "brief → approval → code" process.
**One-line version:** Steven owns *what the game should feel like*. Hermes owns *how it gets built*.
Steven steers by **playing**, not by approving documents.

---

## 1. What is protected, and what is not

| Protected (only Steven changes it) | Not protected (Hermes may change, delete or rewrite) |
|---|---|
| `output/vision.md` | Every old brief, findings file, and session prompt |
| | `design-law.md`, `core-loop.md`, `decision-ledger.md`, `future-work.md` |
| | `CLAUDE.md` and the `guild-vigil` skill |
| | Every code architecture rule, test, harness and gate |
| | Existing systems, screens and content — if they don't serve the vision |

Old documents are **context, not law.** They move to `output/archive/` and Hermes reads them only
to avoid relearning a lesson the hard way.

## 2. Who decides what

| Kind of decision | Who | How |
|---|---|---|
| Code structure, tests, tooling, refactors | **Hermes** | Just does it |
| Game design inside the vision (numbers, feat choices, enemy stats, UI layout, building effects, balance) | **Hermes** | Does it, then logs it in `output/decisions.md` (one line each) |
| Cutting or replacing an existing system | **Hermes** | Does it, logs it, and calls it out in the next playtest note |
| Anything that **changes the vision** | **Steven** | Hermes asks with 2–3 options and a recommendation, then **keeps building other work** while waiting |
| New milestone plan / re-ordering milestones | **Steven** | Approves the one-page roadmap; nothing finer-grained |

**Steven's veto is retroactive.** Anything in `decisions.md` can be reversed by a playtest note.
That is cheaper than approving it in advance.

## 3. The milestone loop

The roadmap (`output/roadmap.md`) splits the game into milestones. Each one ends in something
Steven can **play**.

| Step | Who | Output |
|---|---|---|
| 1. Build | Hermes | Working feature; `pnpm check` and CI green |
| 2. Ship to the shortcut | Hermes | The **Guild Vigil** desktop shortcut runs the new build |
| 3. Playtest note | Hermes | `output/playtest/<date>-<milestone>.md`: **what's new**, **what to try**, **known rough edges**, **saves broken? yes/no** — 5–10 bullets, no essays |
| 4. Play | Steven | 20–60 minutes |
| 5. Feedback | Steven | Rough notes, screenshots, "felt boring", "never used X" — any format |
| 6. Triage | Hermes | Feedback goes into the same playtest file as a table: *note → fix / later / won't, and why* |
| 7. Next | Hermes | Fixes first, then the next milestone |

**Steven never has to write a brief.** If feedback is vague, Hermes picks an interpretation, builds
it, and says which one it picked.

## 4. Building rules for Hermes

1. **Playable beats complete.** A thin version of every system in the vision beats one perfect
   system. Make it work end to end, then deepen.
2. **Fewer things that work beat many things that don't.** Hide, cut or grey out content that has
   no effect in play. **Never ship a feat, item, ability or enemy trait that does nothing.**
3. **Judge by feel, not by harness.** Balance targets are player-facing ("a fresh party should
   usually clear an easy mission"), checked by quick simulations — not ±8-point studies.
4. **Measure only to choose.** A measurement exists to pick between options. If the answer won't
   change what gets built, skip it.
5. **Ask rarely, and never block.** If a question can wait, park it in `output/questions.md` and
   keep building something else.
6. **Reuse before rewriting.** The engine (combat sim, dungeons, heroes, loot, world map) is
   substantial. Rewrite a system only when it fights the vision.

## 5. Engineering guardrails (kept because they are cheap and stop breakage)

These protect Hermes from itself while working unattended. Hermes may revise them if one starts
costing more than it saves — and logs why.

- **`pnpm check` green before every commit; CI green after every push.**
- **The sim stays separate from the UI** (`src/sim` never imports React or the DOM). This is what
  makes auto-resolved missions, mission summaries and quick balance sims possible.
- **Seeded randomness** in the sim, so a reported bug can be replayed.
- **Every new feat / item / ability / enemy trait gets a test that proves it changes a fight.**
  Inert content was this project's biggest recurring problem.
- **Saves may break between milestones.** The playtest note says so. Save migration code is only
  written once Steven has a campaign worth keeping, or at release.
- **Parallel work uses separate git worktrees/branches**, merged by the main session. Never two
  sessions in one folder.

## 6. Session protocol

**Start of every session**, Hermes reads, in order:
1. `output/vision.md`
2. `output/roadmap.md` — current milestone and status
3. The newest `output/playtest/*.md` — open feedback comes first
4. `output/handoff.md` — what the last session left half-done

**End of every session**, Hermes:
1. Updates `roadmap.md` status and `handoff.md` (5 bullets max)
2. Commits and pushes
3. If a milestone finished: writes the playtest note and updates the desktop build

## 7. Tools that make playtesting fast (built in milestone 0)

- **Dev panel** (hidden behind a key): jump to any level, add gold/resources, level a hero, unlock
  a building, reveal the map, spawn a specific mission.
- **"Note" button in-game:** saves Steven's comment with the current screen and game state to a
  file Hermes reads, so feedback arrives with context.
- **One-click build:** the desktop shortcut always runs the latest `main`.

## 8. Documents after the reset

| File | Purpose | Who edits |
|---|---|---|
| `output/vision.md` | What the game is | **Steven only** |
| `output/working-agreement.md` | This file | Steven approves changes |
| `output/roadmap.md` | Milestones and status | Hermes; Steven approves re-ordering |
| `output/decisions.md` | One line per design call Hermes made | Hermes |
| `output/questions.md` | Parked questions for Steven | Hermes |
| `output/playtest/*.md` | Playtest notes + triaged feedback | Both |
| `output/handoff.md` | Session-to-session handoff | Hermes |
| `output/reference/*.md` | Engine notes (how combat/content works) | Hermes, as needed |
| `output/archive/**` | Everything else, kept for history | Nobody |
| `CLAUDE.md` | Short pointer file (under ~5k chars) | Hermes |
