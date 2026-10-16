# Guild Vigil (web)

Guild-management RPG with auto-battler missions. TypeScript · React 19 · Vite (single-file) · Vitest · Playwright.

**Start here:** `output/vision.md` → `output/working-agreement.md` → `output/roadmap.md`. Agent orientation: `CLAUDE.md`.

## Commands

```bash
pnpm install   # once per machine
pnpm check     # typecheck + lint + tests
pnpm dev       # Vite dev server
pnpm build     # single-file artifact in dist/
pnpm e2e       # build + Playwright
pnpm notes     # collect in-game playtest notes from Downloads into output/playtest/inbox/
```

## The one rule

`src/sim/**` is pure TypeScript: no React, no DOM, no browser globals, no `Math.random`, no
`Date.now`. ESLint fails the build on violations.
