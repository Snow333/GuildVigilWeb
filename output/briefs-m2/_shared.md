# Shared rules for every parallel track (read first)

You are one of several agents working on **Guild Vigil** at the same time, each in its own git worktree.
Repo law: read `CLAUDE.md` in your worktree, and `output/vision.md` (protected: never edit it).

## Your sandbox
- Work ONLY in your own worktree (path in your brief). Never touch `C:\GuildVigilWeb` (main checkout).
- `node_modules` is a junction to the main checkout. **Never run `pnpm install`** or change dependencies.
- Edit only the files your brief says you own. If you truly must touch another file, keep the edit
  small and local, and list it in your report.
- Stage files by explicit path, never `git add -A`. Commit on your branch. **Do not push or merge.**
- Do not edit `output/decisions.md`, `output/handoff.md` or `output/roadmap.md`. Report decisions instead.
- Do NOT write screenshots into the repo. Use `C:/Users/sigse/AppData/Local/hermes/cache/scratch/<track>/`.

## Commands (git-bash; native tools need `C:/...` forward-slash paths)
```bash
npx tsc -p tsconfig.json --noEmit
npx eslint src tests tools e2e --max-warnings 0
node node_modules/vitest/vitest.mjs run
node node_modules/vite/bin/vite.js build && GV_PORT=<your port> npx playwright test
```
- `npx vite build` is refused by the terminal tool. Use the line above.
- **Always set `GV_PORT`** to the port in your brief. Other tracks run e2e on other ports at the same time.
- Long commit messages: write to `C:/Users/sigse/AppData/Local/hermes/cache/scratch/<track>-msg.txt`
  and `git commit -F <that path>`.

## How this project wants work done
- **Player-facing value first.** If you can't say what the player gets, don't build it.
- **Never offer something that does nothing.** A UI claim must be backed by a test proving the number
  reaches the combat/sim (the codebase's history is full of features that silently did nothing).
- **Negative control**: for each key test, break the code on purpose, confirm the test fails, restore.
- `src/sim/**` is pure TS: no React/DOM, no `Math.random`, no `Date.now`. Use the session's seeded rng.
- Saves may break between milestones, but do not crash on an old save: backfill new fields.
- Player text is short and plain. The player is dyslexic: short sentences, no jargon.
- Check your UI yourself: take a Playwright screenshot of every screen you changed and LOOK at it
  (the vision tool). Tests have passed before while a screen was 5,700px of greyed rows.
- Prefer fewer features that work over complete lists.

## Done means
All four commands green, committed on your branch. Final report: commit hash, files changed, unit +
e2e counts, negative controls run, screenshot paths you checked, one line per design decision, and
anything unfinished or any finding the parent should know.
