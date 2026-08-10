# Guild Vigil — Phase 2 Session Handoff

**Written:** 2026-08-10, end of the Phase 1 session · **Your task: milestone 2.0**

You are picking up a TypeScript migration of Guild Vigil (a PF2E-flavored,
guild-management RPG with continuous-time auto-battler combat) at the start of
Phase 2 (unstyled UI). Phase 1 — the complete headless sim core — is done,
committed, and green.

## Read these, in this order, before writing any code

1. **`C:\GuildVigilWeb\CLAUDE.md`** — workspace law: the eight architecture
   constraints, layout, determinism/data discipline, gotchas. Non-negotiable.
2. **Project knowledge `migration/status.md`** — exact current state.
3. **Project knowledge `migration/briefs/phase2-ui.md`** (same file:
   `output\briefs\brief-phase2-ui.md`) — **APPROVED** brief #5. Milestone 2.0 is
   defined there; this handoff does not restate it. The other authorities
   (`core-loop.md`, `decision-ledger.md`, `guild-vigil-migration-plan.md`, briefs
   1–4) live in both `output\` and project knowledge.

## Where Phase 1 ended

- Repo: `C:\GuildVigilWeb` (git; Steven's machine). All milestones 1.0–1.5
  committed. **216 Vitest tests green**, `pnpm check` and `pnpm build` clean.
- The sim plays whole campaigns headlessly: events (FROZEN schema) → heroes →
  continuous-time combat → graph dungeons + profile AI + loot grammar → world
  (terrain/travel/escalation) → campaign loop. Career harness: 20 campaigns ×
  24 weeks, exact snapshot baseline (completion 0.788 / wipes 0.165 / avg final
  level 2.0). **Harness snapshots are locks: any diff is a balance change that
  must justify itself in the commit message.**
- `src/ui/` is a 1.0 placeholder (registry manifest dump). `src/platform/` is
  empty. That is where 2.0 happens.

## Milestone 2.0 (from the approved brief — the summary, not the authority)

Extract `src/sim/campaign/session.ts` (`CampaignSession`: commands + queries +
serialize/deserialize) and rebuild `runCampaign()` as an autopilot driving a
session with the v1 policies. Then: localStorage `SaveStore` impl in
`src/platform/`, `GameProvider` (React 19, no state library), title/save-slots
screen, town hub with a working Advance Week.

**Done when:** the career-harness snapshot is UNCHANGED by the refactor ·
save → reload → identical serialized state · the ugly app boots in the browser
(`pnpm dev`, and `pnpm build` single-file artifact).

## Operational setup (do this first)

The cloud workspace does not persist between sessions. Rebuild the mirror:

1. Stage the repo from the device into the cloud workspace (`device_stage_files`
   → copy to `~/work/guild-vigil-web`). Stage `src/`, `tests/`, `tools/`,
   `output/`, and root config files (`package.json`, `pnpm-lock.yaml`,
   `tsconfig*.json`, `eslint.config.js`, `vite.config.ts`, `vitest.config.ts`,
   `index.html`, `CLAUDE.md`). Skip `node_modules/`, `dist/`, `.git/`.
   **Batch ≤25 files per staging call and sleep ~45 s between batches** — the
   bridge rate-limits (HTTP 429).
2. `pnpm install` (pnpm 10.28.0 via corepack; native builds already allowed via
   `pnpm.onlyBuiltDependencies`). Do NOT run `pnpm convert` — `src/content/
   generated/**` is committed and current; the converter needs the Godot repo's
   `game_data.db` which is not in this repo.
3. Verify the baseline before touching anything: `pnpm check` → 216 tests green.

## Working agreements (how this project runs)

- **Terminals on Steven's machine are click-only for you** — you cannot type
  into them. You build + verify in the cloud workspace, ship files with
  `SendUserFile` + `device_commit_files`, then give Steven ONE PowerShell
  one-liner to run, e.g.:
  `cd C:\GuildVigilWeb; pnpm check; git add -A; git commit -m "Milestone 2.0: ..."`
- `pnpm check` green before every ship. Commit messages name the milestone.
- Bundled batches are welcome — Steven approved bundling milestones to expedite;
  verify between chunks yourself, but don't ask for a commit per chunk.
- New systems get a design brief BEFORE code (`implementation-brief` process).
  Phase 2 is already briefed (brief #5). Anything genuinely new beyond it —
  brief first.
- Keep project knowledge current: update `migration/status.md` when a milestone
  ships (it's how the next session finds its footing).
- Two-machine workflow: offer to push at session end; unpushed commits block the
  other machine.

## Gotchas the last session paid for (beyond CLAUDE.md's list)

- The event schema is FROZEN — additive only; the manifest snapshot test
  enforces it. Beat-feed work consumes events; it never edits them.
- `exactOptionalPropertyTypes` is ON: spread-conditional optional fields
  (`...(x ? { x } : {})`), don't assign `undefined`.
- Career/encounter harness snapshots are exact — a legitimate balance change
  means DELETING the stale snapshot, rerunning, and explaining the diff.
- Vitest runs the harness in ~10 s total; if a change makes it crawl, the change
  is wrong, not the harness.
- `pnpm build` must stay green too — the single-file artifact is the product.

## First message expectations

Steven will say something like "let's start 2.0". Confirm you've read this file
and the brief, rebuild the workspace, verify 216 green, then begin with the
session extraction (it's the risky half; the screens are the easy half).
