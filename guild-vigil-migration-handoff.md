# Guild Vigil — Stack Migration Planning Brief

**Paste this into the Guild Vigil project to start migration planning.**

---

## Decision (settled — do not re-litigate)

Guild Vigil is moving off Godot 4 / GDScript and onto a web-native stack. This decision is made. Do not produce a comparison, a pros/cons analysis, or a recommendation to reconsider. If you find a genuine blocker during planning, raise it as a specific risk with a mitigation — not as a reason to revisit the stack choice.

**Target stack:**

- TypeScript (strict mode)
- React 19 for UI
- Vite for build, configured for a single-file web artifact
- Tauri 2 for desktop and mobile shells
- Vitest for simulation tests
- Playwright for visual and end-to-end verification

**Rationale, for your context only:** GDScript's small training corpus and the Godot 3/4 API split impose a per-session verification tax on AI-assisted development. The web stack removes it, ships a browser-playable build for free, and handles responsive mobile layout far better. Consoles are the only thing we give up, and they are out of scope.

---

## Scope and targets

**Platforms:** PC (Windows, macOS, Linux) and mobile (iOS, Android). Consoles are explicitly out of scope. Do not design for gamepad-first input or console certification.

**Publishing ladder, in order:**

1. itch.io — browser-playable build plus desktop downloads
2. Steam and GOG — desktop
3. iOS App Store and Google Play

The itch browser build must be the same artifact as the desktop build, differing only in persistence backend. Plan for it from the start; do not treat the web build as an afterthought.

---

## Visual direction

Character animation is cancelled. Static AI-generated character portraits only. The art blocker was animating concept art, not producing it — the portrait pipeline works and is retained.

Visual identity should lean on what the DOM does well: CSS compositing, layered portrait treatments (frames, faction tints, condition overlays, wounded desaturation), procedurally generated SVG for crests, sigils, maps and charts. Assume no sprite sheets, no animation rigs, no asset import pipeline.

This is a simplification of the previous visual goals and is intentional.

---

## Non-negotiable architecture constraints

These carry over from a teardown of a shipped comparable (*Dungeons & Dynasties*, Tauri 2 + React + Vite) and are requirements, not suggestions.

**1. The simulation has zero renderer dependency.**
All sim logic lives under `src/sim/**` as plain TypeScript classes and functions. No React, no Pixi, no DOM, no browser globals. The sim must be constructible and runnable from a Node script with no UI present.

**2. The boundary is enforced at build time, not by convention.**
Add an ESLint `no-restricted-imports` rule that fails the build on any React, DOM, Pixi or browser-global import inside `src/sim/**`. A documented convention is not sufficient — the rule is the deliverable.

**3. The sim runs headless and cheaply.**
The core run loop must expose a `runHeadless()` equivalent that completes a full unit of simulation with no rendering. This single capability serves three consumers: the live game, in-game forecasting or odds displays, and the test harness. Do not build a separate "fast" simulation path.

**4. Simulation emits events; presentation interprets them.**
Combat and other resolution systems emit a flat event stream. Grouping, pacing, round bucketing and narration all happen in the presentation layer. Never generate player-facing log text inside a resolver.

**5. Randomness is string-seeded and namespaced.**
A single `Rng` class seeded from a hashed string, with seeds built from stable entity data — e.g. `` `forecast_${partySize}_${i}` ``, `` `note_${heroId}_${dmgDone}_${dmgTaken}` ``. Derived content should be recomputable from facts rather than stored. Narrative text must be a pure function of simulation outcomes.

**6. Persistence goes through a `SaveStore` abstraction.**
Define the interface before writing any save code. Two implementations: filesystem via Tauri for desktop and mobile, `localStorage` for web. This lets the itch browser build serve as a capped demo while paid builds have unlimited saves.

**7. Rival and world state is derived where possible.**
Prefer computing entity state from `(entityId, elapsedTime, seed)` over persisting it. Adopt this as a design choice for save size and coherence, not only as a storage workaround.

**8. Save migration is an idempotent backfill chain.**
Not version-branched migrations. A composed pipeline of stages that each early-return unchanged when there is nothing to do, and that seed any backfilled value on the entity ID so it is stable across reloads. Build this before first release, not after.

---

## Reference materials

Two documents accompany this brief. Read the teardown before Step 2 — it is where the eight constraints below come from, and it will stop you re-deriving them.

- **`dungeons-and-dynasties-teardown.md`** — a static analysis of a shipped comparable (*Dungeons & Dynasties* 1.9.6: Tauri 2 + React 19 + Vite, single-file build), extracted from its binary. Covers the simulation/presentation split, the headless run loop, string-seeded determinism, derived world state, the idempotent save-backfill chain, and the declarative content registries.
- **This brief.**

Treat the teardown as a reference architecture, not a design target. Its *design* — a league ladder with a single party and no character art — is deliberately not what we are building.

---

## Before you start

Confirm you can actually reach the material, and say so explicitly in your first message:

1. The Godot codebase — state the root path and roughly how many script files you can see.
2. The Guild Vigil design documents.
3. The teardown document above.
4. A writable folder for `core-loop.md` and the decision ledger — name the path you intend to use.

If any of these are missing, stop and tell me which. Do not proceed on partial access or reconstruct from memory.

---

## What I want from you

A **phased migration project plan**, built from decisions I make with you in a guided walkthrough. Not code. Not implementation.

Work through the steps below in order. **Steps 1, 2 and 3 are interactive — stop and wait for my answers at each checkpoint. Do not skip ahead to the plan.**

### Step 1 — Feature inventory and nuance sweep

Read the codebase and design documents and produce a flat inventory of what is actually implemented. Group it into 5–8 system areas (for example: roster and progression, encounter resolution, economy, world and league, save/load, UI screens).

For each feature, one line: what it does and its current state — working, partial, or stubbed.

**Then, for each system area, report design nuances worth preserving.** The project is incomplete, so most of the code is disposable — but implementation surfaces knowledge that never makes it back into design documents, and that knowledge is the actual asset. Look specifically for:

- Tuning constants and magic numbers whose values are non-obvious
- Edge cases explicitly handled — guard clauses, special-cases, anti-softlock provisions
- Content and data tables (names, traits, items, abilities, encounter definitions)
- Algorithms that were clearly non-trivial to get right
- Comments explaining *why* something works a particular way
- `TODO` / `FIXME` / `HACK` markers, which reveal known problems worth not re-inheriting

Cap this at roughly five nuances per area. Report them as a bulleted list.

**Explicitly out of scope for this sweep:** code quality, architecture critique, refactoring opportunities, style compliance, test coverage. I am mining this codebase for design knowledge, not evaluating it. Do not read every file — sample enough to be confident you have the nuances.

Present the inventory and nuances, then stop and ask me to confirm it looks right and to flag anything missing.

### Step 2 — Core loop definition

**Guild Vigil is not a Dungeons & Dynasties clone.** It borrows architecture, not design. This step exists because the loop determines what survives triage, and it must be settled before Step 3.

First, propose a definition of the core loop at each nesting level — the moment-to-moment decision, the dispatch, the chapter or season, the full campaign — drawn from the design documents and the inventory. For each level state: what the player decides, what the unit of time is, what creates tension, and what the terminal condition is.

Then walk me through the intended divergences from the reference architecture, **one at a time**, in this order:

1. **Story/mystery progression via dispatching multiple adventuring teams**, rather than a league ladder with a single party. *Ask this first — it is structural and most other answers depend on it.* Probe specifically: how many teams are active simultaneously, does time advance globally or per-team, is the mystery authored or generated, what does failure cost, and what replaces the league table as the standing measure of progress.
2. **Dungeon maps explored systematically by party AI**, rather than a linear stack of encounters. Probe: what the party AI is deciding, whether the map is known or revealed, and what a "readable" exploration log looks like to the player.
3. **Comprehensive equipment slots.** Probe: slot count, whether items are generated or authored, and how this interacts with the roster size.
4. **Comprehensive per-character ability selection.** Probe: chosen or earned, respec-able or permanent, and how it interacts with the gambit or tactics layer.

For each: give your reading from the design docs first, then ask targeted questions. One divergence per message. Stop and wait.

Finish this step by stating **which of the eight architecture constraints change weight** under the agreed loop, and flag any that are harder to satisfy than they would be for a league-structured game. Write the result to a `core-loop.md` document — it becomes the reference for everything downstream.

### Step 3 — Guided keep / change / remove walkthrough

Once I confirm the inventory and we have settled the core loop, walk me through the inventory **one system area at a time**, judging every feature against the loop defined in Step 2 — not against what the feature was originally for.

For each area:

1. List its features.
2. For each feature, give **your recommendation** — Keep, Change, or Remove — with a one-sentence reason. Do not ask open-ended questions. Give me a default I can accept or override.
3. Ask me to confirm or correct, then stop and wait.

Recommendation criteria:

- **Keep** — design is sound and stack-independent; rebuild fresh in TypeScript from the design
- **Change** — the concept survives but the implementation was shaped by Godot, by the animated-visuals assumption, or by the old loop structure
- **Remove** — no longer applicable under the agreed loop, the new stack, or the simplified visual direction, or it never earned its complexity

Rules for this walkthrough:

- **One area per message.** Never batch multiple areas into a single question set.
- Keep each area to a manageable number of decisions. If an area has more than about ten features, split it.
- Where a feature's fate depends on another decision I haven't made yet, say so and sequence the question later rather than guessing.
- If I say "your call" on any item, take the call and move on.
- Flag any feature where the existing GDScript encodes balance-critical behaviour that was tuned by feel and is not captured in the design docs. For those, note that a differential test harness (identical seeded PRNG in both languages, same fixtures, diff the outputs) is available as an option, and ask whether I want it.

After each area, append the decisions to a running **decision ledger** — a markdown table of Feature | Verdict | Note. Maintain it as a file so it survives the session.

### Step 4 — Phased build order

Once the walkthrough is complete and the decision ledger is settled, build the plan from it. Everything below flows from the ledger — do not reintroduce features I marked Remove, and treat Change items as redesigns needing their own brief later.

Structure the plan in this order and justify any deviation:

1. **Headless sim core.** Pure TypeScript, no UI whatsoever. Vitest coverage plus a career-harness script that runs hundreds of full campaigns and reports outcome distributions rather than averages.
2. **Unstyled UI.** Plain HTML over the sim. The full game loop playable end to end before anything is styled.
3. **Visual identity.** CSS theming, portrait compositing, SVG generation.
4. **Tauri wrap, platform packaging, mobile layout.**

For each phase specify: entry criteria, exit criteria, the deliverable, and what would signal the phase is in trouble.

### Step 5 — Project scaffolding plan

- Repository and directory structure, with the `src/sim` boundary explicit
- The ESLint boundary rule as a concrete config snippet
- Vitest and Playwright setup, and what each is responsible for verifying
- Which existing skills transfer unchanged (`implementation-brief`, `work`, `context-file-validator`), which need revision (`test-validation-protocol` — add a Playwright step), and which are retired (`gdscript-audit`, replaced by ESLint plus TypeScript)
- A proposed replacement `CLAUDE.md` outline for the new workspace

### Step 6 — Risk register

Top five risks with mitigations. Be specific and technical. Generic risks are not useful.

---

## Constraints on the plan itself

- Assume solo development with AI assistance doing the large majority of implementation.
- Optimise the plan for **verifiable increments** — every phase should end in something runnable that a test can assert on.
- Do not plan more than one phase ahead in fine detail. Phase 1 detailed, later phases outlined.
- Prefer decisions that keep the simulation portable. Consoles are out of scope now, but a renderer-agnostic sim keeps that door reopenable later at renderer-rewrite cost rather than game-rewrite cost.

## Output format

**Steps 1–3 happen in chat**, not in a document. Short messages, one system area at a time, always ending in a question and a stop. The only files you maintain during this phase are `core-loop.md` and the decision ledger.

**Steps 4–6 produce a single planning document** in markdown, opening with the core loop definition and the finalised decision ledger.

**When you finish, list every file you created with its full path**, and flag which ones I should add to project knowledge myself — you cannot write to the project's contents, so anything meant to persist across sessions has to be handed back to me explicitly.

No preamble restating this brief back to me. Start with the access check, then Step 1.
