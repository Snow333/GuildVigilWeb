# Handoff

**Last session:** 2026-10-16 — M1 built; **M2 feedback round merged**. Waiting on Steven's playtest + portraits.

## M2 feedback round: DONE 2026-10-16, waiting on Steven's playtest

All of Steven's 8 requests are merged on `main`. Playtest note: `output/playtest/2026-10-16-M2-feedback.md`.
Spells (main session), quest board and commission (Track Q), itemization (Track I), scroll performance (Track P).
Portraits are waiting on Steven: `output/art/bust-prompts-batch2.md`. When he says "portraits are in",
run `pnpm portraits`, check `output/exploration/portrait-contact-sheet.html`, run the gate, commit.
Content to-dos found: mid-level quest content (the board thins after week 17); Scroll of Raise Dead
casts the wrong spell; odd prices (+2 weapons priced off their base, staff 0g).

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
