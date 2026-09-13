# Character advancement — feats, boosts, abilities, attribution

> Split out of `CLAUDE.md` because it exceeded the 20,000-char context-injection cap and
> was being silently truncated. **This file is authoritative for its domain** — do not
> copy these facts back into CLAUDE.md, and do not re-derive them.

Read this before touching `src/sim/heroes/**`, the level-up wizard, the autopilot priorities,
or anything that adds a feat/ability/boost. Brief #22–#24 territory.

---

- ⚠ **CHARACTER ADVANCEMENT (#22) — THE READINESS GATE IS A CONJUNCTION, NEVER A COLUMN READ.** Content's `"implemented": false` (115 of 227 feats) is sound in ONE direction only: nothing flagged is wired (0 contradictions), but **42 UNFLAGGED feats have no engine consumer at all** — every `combat_action` pre-#22, plus all `resource_grant`/`special`/`spell_modifier`/`stance`/`toggle`/`conditional_stat_mod`. The flag means "the CONTENT SPEC is complete", not "the ENGINE does this". `isEffectReady()` = flag AND `EFFECT_HAS_CONSUMER[type]` AND (for actives) `ACTIVE_WIRED.has(id)`. Spells carry no flag at all (0 of 218) — their gate is `RESOLVABLE_EFFECTS` = `damage`|`healing`, derived from the engine.
- ⚠ **NEVER PROPOSE `+1` ABILITY BOOSTS — the arithmetic is a trap.** Mods are `floor((score − 10) / 2)` and every founding hero's scores are EVEN, so four +1s = four odd scores = **ZERO modifier change**; the player chooses four times and nothing happens. #22 briefed `4 × +1` and it was caught before code. PF2E dodges this because its scores start at 10 and boosts are +2 below 18. Shipped: **4 × +2 to DISTINCT abilities at 5/10/15/20** (`BOOSTS_PER_MILESTONE`). ⚠ **NO ability cap is enforced, deliberately (D4)** — extreme stat builds are an intended fantasy until base/growth/feats/gear/buffs can be weighed together.
- ⚠ **ABILITY LIMITERS ARE THREE DISTINCT SYSTEMS AND ONLY TWO ARE BUILT.** Cooldown-in-ticks and once-per-combat live on `Combatant` (`abilityUses`, `abilityReadyAt`) and die with the encounter — which is why M2 needed no save migration. **Once-per-long-rest is NOT built**: its state must OUTLIVE the fight, so it belongs on `HeroState` with a backfill. Do not collapse the tiers. `actions: N` is orthogonal to all three — a TIME cost scaling the next interval, and without it every active is strictly better than striking and the loadout choice is fake. **Ability strikes are ONE swing, not a burst** — running one through the burst loop applies its rider per swing.
- ⚠ **`buildAutoLevelUpPlan` IS A PLAYER FEATURE NOW, not just harness scaffolding.** It is "level up for me" (Steven: manual is the default, autopilot is for players who want to skip choices), and the harness rides the same code so it stays a valid proxy for hand play. Priorities are DATA in `src/content/autopilot.ts`. An entry may be listed BEFORE its effect is wired — it is skipped by the readiness gate until the day it lands.
- ⚠ **AC HAS NO PROFICIENCY TERM IN THIS ENGINE, AND `totalProficiency` WILL NOT TELL YOU.** `assembly.ts` computes `10 + gear + dex + itemStat.ac`. `totalProficiency(hero, stat)` returns `baseProficiency(level)` for ANY stat string, including names no content defines tiers for — so `totalProficiency(hero, 'ac')` silently returns **1**, not 0. `heroes/attribution.ts` read +1 high for all four classes until an exposure test compared its ledger to the assembled combatant. **Attack PENALTIES are likewise not in `attackBonus`** — they sum to `Combatant.weaponPenalty`, applied at roll time in `strike.ts`.

## Level-up engine traps (moved out of CLAUDE.md)

- Ability mods use **PF-RAW floor** (score 7 → −2). The Godot code truncated (−1) — that divergence is deliberate and documented in `heroes/levelUp.ts`. Don't "fix" it back.
- The INT-boost/skill-points bug from Godot is FIXED here (`skillPointsForLevel` takes the pending boost). Don't reintroduce the old ordering.
- ⚠ The PF-RAW floor is also stated as **player-facing design law** in `output/design-law.md` §2 —
  it is deliberate, not a rounding bug. Do not "fix" it toward the Godot behaviour.
