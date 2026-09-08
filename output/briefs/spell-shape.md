# Brief #21 — SPELL SHAPE: direct vs area

**Status: APPROVED 2026-09-02 (§9). No code written. Implement AFTER brief #20.**
Written 2026-09-02 against `main` = `df573ed`, suite **483 unit** green (re-verified before
drafting; `pnpm e2e` and the bundle figure were not re-measured this session).

Split out of brief #20 §4.2 site 11 on Steven's call: the AoE geometry question is
**material** and deserves costing on its own rather than riding a feature measured free
for other reasons. See `creature-size-findings.md` §6.2.

---

## 0. Why this is a brief and not a drive-by

Today "is this spell an area effect?" is **inferred** from two columns that mean other
things, in one line of `resolveCast` (`spells.ts:204`):

```ts
const units = saveType && (spell.aoe_size as number | null) ? aoeTargets(spell, primary, all) : [primary];
```

Three implicit gates: `effect_type === 'damage'`, a non-null `save_type`, and
`aoe_size > 0`. **`save_type` is a saving-throw rule, not a shape**, and using it as a
shape discriminator is why 20 authored area spells silently resolve single-target (§2).

⚠ **The content roadmap makes this hot.** Several hundred spells and thousands of
property-bearing items are planned. This branch goes from "never fires in a harness run"
to one of the most-executed paths in the engine. The geometry decided here is cheap to
take now and expensive to unpick later.

⚠ **Do not read the harness as evidence either way.** No spell an automated dispatch can
cast reaches the burst branch — `Heal` and `Magic Missile` (the muster's two authored
casts) and all ten damage cantrips carry `aoe_size = 0`. `career-distribution` and
`dungeon-curve` will run green through every option below and that will mean **nothing**.
The burst path IS covered by a unit test (`tests/combat/spells-loadout.test.ts:37`,
hand-authored Fireball), which is where the evidence has to come from.

---

## 1. The column already exists and the content is already correct

`spells` has an **`aoe_shape`** column. It is authored, consistent, and **read by
nothing** — the converter emits it into `src/content/generated/spells.ts` and no code
touches it.

| `aoe_shape` | rows | meaning |
|---|---|---|
| `null` | 156 | direct — resolves on the target alone |
| `burst` | 51 | radius around a point |
| `cone` | 4 | directional wedge |
| `line` | 7 | directional line |

**Zero inconsistencies**, verified this session: every row with a shape has a size, and
every row with `aoe_size > 0` has a shape. The content is a clean statement of intent
that the engine ignores.

So the two-type split Steven asked for is **already in the data**. The work is teaching
the engine to read it, not authoring anything.

---

## 2. What the current gate gets wrong — 20 spells, today

`aoe_size > 0` but `save_type IS NULL`, so the burst branch cannot fire and each resolves
on one target:

| spell | shape | size | effect |
|---|---|---|---|
| Heal Mass | burst | 3 | healing |
| Heal Circle | burst | 2 | healing |
| Grumply's Mass Mending | burst | 6 | healing |
| Bless | burst | 3 | buff |
| Court's Favor | burst | 4 | buff |
| Seraphine's Divine Aegis | burst | 3 | buff |
| Magic Circle · Globe of Invulnerability | burst | 2 | buff |
| Wall of Fire | **line** | **8** | **damage** |
| Wall of Stone | line | 8 | utility |
| Solid Fog | burst | 3 | debuff |
| + 9 utility bursts (Darkness, Detect Magic, Antimagic Field, …) | | | |

⚠ **`Wall of Fire` is a size-8 damage line that hits exactly one creature.** A mass heal
heals one ally. These are not edge cases; they are the whole shape vocabulary failing.

Second defect: **`effect_type` gates before shape is ever consulted.** `resolveCast`
handles only `'damage'` and `'healing'` (`spells.ts:196`, `:202`), and the healing branch
returns before any AoE logic. **140 of 218 spells** (buff 52, debuff 44, utility 40,
summon 4) are inert. That is a bigger brief than this one and is **out of scope here** —
but the shape discriminator must not be built in a way that assumes only damage has shape.

---

## 3. The model

**`aoe_shape` becomes the authority.** One predicate, read once, used everywhere:

```ts
/** Direct spells resolve on the target alone and never inspect its surroundings. */
export const isAreaSpell = (spell: SpellRow): boolean =>
  (spell.aoe_shape as string | null) !== null && ((spell.aoe_size as number | null) ?? 0) > 0;
```

and the gate becomes:

```ts
const units = isAreaSpell(spell) ? areaTargets(spell, origin, all) : [primary];
```

| | direct (`aoe_shape IS NULL`) | area (`aoe_shape` set) |
|---|---|---|
| who it hits | the resolved target, full stop | everything within `aoe_size` of the origin |
| surroundings | never inspected | inspected |
| creature radius (#20) | **irrelevant** — never touches it | the one place edge-to-edge applies |
| save | independent of shape | independent of shape |

Four things this buys:

1. **Declared, not inferred.** Content states intent; the engine stops guessing.
2. **Save decouples from shape.** A burst with no save (mass heal) and a direct spell with
   a save (`Chill Touch`) both become expressible. Fixes the 20 rows in §2.
3. **One home for the radius question.** Brief #20's edge-to-edge conversion touches
   exactly one branch instead of leaking through a `save_type` check.
4. **`cone` and `line` stop lying.** They resolve as bursts today (11 spells). They still
   would under this brief — but the shape is now *visible* to the code, so wedge/line
   geometry becomes an additive follow-up rather than a re-architecture.

---

## 4. ⚠ THE ORIGIN MUST WIDEN FROM A CREATURE TO A POINT

`aoeTargets(spell, center: Combatant, all)` centres the burst on a **Combatant**. Steven
asked for "a target **or target location**", and ground-targeting cannot be expressed
against a creature.

```ts
function areaTargets(spell: SpellRow, origin: Vec2, all: readonly Combatant[]): Combatant[]
```

Creature-targeted area spells pass `target.pos`; ground-targeted ones pass a chosen point.
**Do this in the same change.** Retrofitting it later means touching every call site a
second time, and the AI will by then have opinions about where to aim.

⚠ Out of scope here: *how* the AI picks a ground point (a clustering/scoring question, and
its own brief). This brief only makes the origin expressible.

---

## 5. ⚠ SIDE POLICY — DECIDED 2026-09-02: declared column, derived default

`aoeTargets` filters `all` with **no side check** (`spells.ts:148`), so every burst is
friendly-fire today. That is also why the AoE half of brief #20 is **not** one-sided by
geometry: edge-to-edge catches Large allies exactly as readily as Large enemies. It reads
as a party buff only because `isCaster: false` is hardcoded for every enemy
(`build.ts:48`), and that is a content gap, not a rule.

**Steven's decision (2026-09-02): a nullable declared column with a derived default —
option C's schema, option B's behaviour.**

```sql
target_side TEXT NULL   -- 'all' | 'enemies' | 'allies'; NULL = derive
```

```ts
/** Declared wins; absent derives from effect_type. */
const sideRule = (spell: SpellRow): 'all' | 'enemies' | 'allies' =>
  (spell.target_side as 'all' | 'enemies' | 'allies' | null)
  ?? (spell.effect_type === 'healing' || spell.effect_type === 'buff' ? 'allies' : 'enemies');
```

Rationale, recorded so it is not re-litigated:

* **Zero authoring cost today.** All 218 rows leave `target_side` NULL and derive
  correctly — 52 buff and 20 healing rows resolve to `allies`, damage/debuff/utility to
  `enemies`.
* **No re-authoring later.** Adding an exception is one cell, not a migration across
  hundreds of rows. Taking plain B now and needing C later would mean re-authoring the
  rule after the content exists.
* **It obeys constraints 5 and 7** — derive where possible, never store what you can
  derive. The column is the exception channel, not the primary statement.
* **Columns are free** by the standing rule: the converter is `SELECT *` and both gates
  count ROWS, so this costs no tooling change and no gate change.

⚠ **FRIENDLY FIRE IS REJECTED AS A DEFAULT, AND THE REASON IS STRUCTURAL.** Guild Vigil is
a continuous-time auto-battler with **no player intervention once engaged**
(`decision-ledger.md` Area 2). The player does not choose where a burst lands — the AI
does. Friendly fire therefore punishes a decision the player never made and cannot
counterplay, which is noise rather than difficulty. PF2E's friendly fire works at a table
because a human aims the fireball. **`'all'` remains expressible per spell** for a
deliberate design (a chaotic wild-magic effect, a cursed item property), but it is never
the default.

⚠ **This changes today's behaviour for every existing burst**, including Fireball, which
currently splashes the party. `spells-loadout.test.ts:37` asserts on target count and
**will need re-baselining** — consciously, and justified in the commit. That is the one
place this brief is not behaviour-preserving.

---

## 6. Determinism, saves, events

* **No new randomness.** Shape is content-derived; no `Rng` draw, no seed string, no
  stream-position movement.
* **No save migration.** Nothing persisted grows a field.
* **No event-schema change.** `combat.aoe_resolved` already carries per-target results;
  more targets is more entries, not a new type. The manifest snapshot does not move.
* ⚠ **Emission order = resolution order.** `areaTargets` must iterate `all` in the same
  stable order the current filter does, or `EventStream.hash()` replay determinism breaks
  for every existing burst.

---

## 7. Test plan

Every regression test gets a negative control: revert the term, watch it fail, restore,
report the observed failure text.

| # | assertion | negative control |
|---|---|---|
| 1 | `isAreaSpell` is true for all 62 shaped rows and false for all 156 direct rows | invert the null check → counts swap |
| 2 | `Heal Mass` (burst 3, no save) reaches **every** ally in range, not one | revert the gate → one target |
| 3 | `Wall of Fire` (line 8, no save) reaches more than one unit | revert → one target |
| 4 | A direct spell with a save (`Chill Touch`) still hits **exactly one** | make shape default to burst → it splashes |
| 5 | Fireball's existing behaviour is **unchanged** — same targets, same saves | — (this is the no-regression pin; `spells-loadout.test.ts:37` already covers it) |
| 6 | `areaTargets` emission order is stable across two identical runs | shuffle the filter → `EventStream.hash()` diverges |

⚠ **Harness expectations: nothing moves, and that proves nothing.** No autopilot-castable
spell reaches the branch, so `dungeon-curve`, `encounter-distribution` and
`career-distribution` will be byte-identical. Say so in the commit rather than citing
green as evidence.

⚠ **Steven runs `pnpm dev`** before this is called done.

---

## 8. Risks

| risk | severity | mitigation |
|---|---|---|
| Side policy chosen implicitly by taking today's "everyone" | **high** — silently defines every future spell's feel | §5 forces the choice; do not ship without it |
| Shape read but cone/line still resolve as bursts | medium — the code now *claims* a shape it does not honour | comment it at the call site; additive follow-up |
| Emission order changes and breaks replay hashes | medium — silent, caught only by snapshot | test 6 |
| 140 inert spells make this look more finished than it is | medium | §2 states the scope boundary explicitly |
| Ground-targeting origin deferred | low now, high later | §4 takes it in this change |

---

## 9. STEVEN'S DECISIONS — recorded 2026-09-02

All five questions are answered. Brief #21 is **APPROVED to implement**, after #20.

| Q | decision |
|---|---|
| 1 — adopt `aoe_shape` as the discriminator | **YES** — it is authored, consistent across all 218 rows, and read by nothing |
| 2 — side policy | **nullable `target_side` column, defaulting to derivation from `effect_type`** (§5). Friendly fire rejected as a default on structural grounds |
| 3 — widen the origin to `Vec2` | **YES, in this change** — retrofitting means touching every call site again |
| 4 — the 20 mis-gated spells | **fix them here** (§2). They are live bugs and they are the proof the discriminator works |
| 5 — ordering vs #20 | **#20 ships first** with `aoeTargets` untouched, so its "measured free" claim stays clean; #21 follows independently |

⚠ **This brief is therefore NOT behaviour-preserving**, and that is deliberate in exactly
two places: the 20 mis-gated spells begin resolving as areas (Q4), and every existing
burst stops hitting allies (Q2). Both move `spells-loadout.test.ts:37`. Re-baseline
consciously and justify each moved assertion in the commit.

---

## 10. Implementation order, once approved

1. `isAreaSpell` + `areaTargets(spell, origin: Vec2, all)`; keep behaviour identical for
   the currently-reachable set.
2. Swap the `resolveCast` gate to `isAreaSpell`. **Fireball must be byte-identical here.**
3. Side policy per §5's answer.
4. Tests 1–6, each with its negative control observed and reported.
5. Confirm harness snapshots are **unchanged** (they should be; if one moves, stop and
   find out why).
6. `pnpm check` green, then Steven runs `pnpm dev`.
7. Both doc halves — `output/briefs/` and `migration/briefs/` — in the same commit.
