# Guild Vigil (web)

TypeScript / React 19 / Vite (single-file) / Tauri 2 · the stack migration of Guild Vigil.

**Authoritative docs:** `output/core-loop.md` · `output/decision-ledger.md` · `output/guild-vigil-migration-plan.md` · `output/briefs/*` (in the parent workspace folder).

## Commands

```bash
pnpm install          # once per machine
pnpm check            # typecheck + lint (boundary rule) + tests
pnpm dev              # Vite dev server
pnpm convert          # regenerate src/content/generated from game_data.db
                      #   (default path: ../GuildVigil/project/data/game_data.db)
pnpm build            # single-file artifact in dist/
```

## The one rule

`src/sim/**` is pure TypeScript: no React, no DOM, no Tauri, no browser globals,
no `Math.random`, no `Date.now`. ESLint fails the build on violations
(`eslint.config.js` — architecture constraint #2). If the sim seems to need a
browser global, the design is wrong.
