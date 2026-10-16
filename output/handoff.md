# Handoff

**Last session:** 2026-10-16 — **M1 built**, waiting on Steven's playtest. **M2 feedback round in flight.**

## M2 feedback round (in flight, 2026-10-16)

Steven's 8 requests, split by file ownership:

| Track | Who | Where | Status |
|---|---|---|---|
| Spells: Cleric whole list + Spells tab | main session (Opus) | `main` | ✅ `62b64e8` |
| Q: board capacity 10 / 4–6 a week, easy weeks 1–4, Marshal commission | Opus subagent | `C:\GuildVigilWeb-quests` `m2-quests` | running |
| I: itemization pass | Opus subagent | `C:\GuildVigilWeb-items` `m2-items` | running |
| P: Edge scrolling performance | Sonnet subagent | `C:\GuildVigilWeb-perf` `m2-perf` | running |
| Portraits (8 busts) | Steven in ChatGPT | `output/art/bust-prompts-batch2.md` | waiting on Steven |

Briefs: `output/briefs-m2/`. When each track reports: review its diff, check screenshots, merge `--no-ff`,
full gate (use `GV_PORT`), then remove the worktree (delete the node_modules junction first).
`delegation.model` is already back to "" (unset).

## State

- `main` has all of M1, pushed. Playtest note: `output/playtest/2026-10-16-M1.md`.
- Every design call is in `output/decisions.md` (M1 rows).
- The rest of M1 ran as two parallel tracks: Track A (level-up and spells) on Opus in the main
  checkout, and Track B (mission report) on a Sonnet subagent in a worktree, merged after review. The
  Track B brief is kept as an example of a good subagent brief: `output/briefs-m1/trackB.md`.

## Next session

1. **If Steven has played:** run `pnpm notes` (moves Downloads `gv-note-*.json` into `playtest/inbox/`).
   Read the feedback section of the M1 playtest note, triage it into the "Hermes triage" table there,
   and fix anything blocking before M2.
2. **Then M2** (see `roadmap.md`).
3. **Known M2 seeds:**
   - When should abilities like Power Attack fire? Measured: using them every turn loses badly.
   - Placing debuffs automatically needs a "target lacks condition" loadout check.
   - Ranger and Bard have no class feats.
   - The playback heading still says "quest <name>".

## Parallel-work recipe (worked well)

- Split tracks by **file ownership**, not by feature.
- `git worktree add C:/GuildVigilWeb-<track> -b <branch>`, then link `node_modules` with a
  PowerShell `New-Item -ItemType Junction` (cmd `mklink` fails from git-bash).
- Set the subagent model with `hermes config set delegation.model <id>`; unset it afterwards.
- Review the diff, check the new screens yourself in a screenshot, then merge `--no-ff`.
- A subagent's e2e screenshots can land in `shots/` in the main checkout; delete them, never commit them.
