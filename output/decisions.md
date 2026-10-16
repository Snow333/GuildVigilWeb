# Decisions log

One line per design call Hermes made inside the vision. Steven can reverse any of these in a
playtest note. Newest at the bottom.

| Date | Milestone | Decision | Why |
|---|---|---|---|
| 2026-10-16 | M0 | Old briefs, design law, core loop, ledger and backlog moved to `output/archive/legacy-process/` | Working agreement: vision is the only law |
| 2026-10-16 | M0 | In-game notes download as JSON files to Downloads; `pnpm notes` collects them into `output/playtest/inbox/` | The game runs from `file://` and cannot write to the repo directly |
| 2026-10-16 | M0 | Dev panel opens with the **`** (backtick) key or the "Dev" tab; available in every build | Playtest speed matters more than hiding cheats right now |
