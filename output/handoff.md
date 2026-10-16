# Handoff

**Last session:** 2026-10-16 — M0 (reset + playtest tooling).

- M0 is done: docs reset, dev panel (backtick key), Note button, `pnpm notes` collector.
- Old process docs live in `output/archive/legacy-process/` — history only.
- **Next: M1 — the whole loop, thin.** Start by playing a new campaign headless (e2e `core-loop.spec.ts`
  shows the path) and listing every place the loop stalls or confuses; then: per-hero "Auto level up"
  button (`autoLevelHero` in `src/sim/campaign/campaign.ts` already exists), hide feats that do nothing
  from the picker, readable mission summary, widen the founding muster's class list.
- No open playtest feedback yet.
