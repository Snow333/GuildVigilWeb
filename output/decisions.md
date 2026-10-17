# Decisions log

One line per design call Hermes made inside the vision. Steven can reverse any of these in a
playtest note. Newest at the bottom.

| Date | Milestone | Decision | Why |
|---|---|---|---|
| 2026-10-16 | M0 | Old briefs, design law, core loop, ledger and backlog moved to `output/archive/legacy-process/` | Working agreement: vision is the only law |
| 2026-10-16 | M0 | In-game notes download as JSON files to Downloads; `pnpm notes` collects them into `output/playtest/inbox/` | The game runs from `file://` and cannot write to the repo directly |
| 2026-10-16 | M0 | Dev panel opens with the **`** (backtick) key or the "Dev" tab; available in every build | Playtest speed matters more than hiding cheats right now |
| 2026-10-16 | M1 | XP is no longer split: every living hero earns the full quest/monster XP | A split made the first level-up take 20 weeks of real play; PF2E awards full XP per character |
| 2026-10-16 | M1 | Level step grows with level (L1→2 costs 1000, L19→20 costs 19000; 190000 total) | Quest XP rises with level, so a flat 1000 step made mid-game levels arrive every mission. Measured: first level-up week 5, ~L8 by week 60 on autopilot |
| 2026-10-16 | M1 | All 10 base classes can be founded (added Ranger, Barbarian, Monk, Bard, Sorcerer, Warlock). Prestige classes stay multiclass-only | Vision: "create various characters" from the classes already defined |
| 2026-10-16 | M1 | **Ancestry now affects stats**: its two boosts (+2), flaw (−2) and base hp apply at creation; "free" boosts go to the class key ability | Vision: use the defined ancestries. Reverses the old "ancestry is cosmetic" rule (archived design law) |
| 2026-10-16 | M1 | Monk fists use the class unarmed die (1d6 → 2d8) and are finesse + agile | Monks had no weapon and fought with a 1d4 STR fist |
| 2026-10-16 | M1 | Warlock pact energy comes from the `pact_energy_max_N` class feature; a spell's own `pact_energy_cost` wins (Eldritch Blast = 0, at will) | Warlocks had 0 energy and could not cast anything |
| 2026-10-16 | M1 | Bug fix: damage dice with a minus (`1d6-1`) rolled NaN | Every hero with a negative STR mod (wizards, bards) dealt no real melee damage |
| 2026-10-16 | M1 | Harness "punching up costs ≥10 pts" bar lowered to 8 (the measured noise floor) | Stronger L1 parties measured 9.0; the gradient is still real |
| 2026-10-16 | M1 | Level-ups teach spells (2 at class L1, then 1 per level); the picker shows the spells the new level unlocks | `spellsLearnedAtLevel` existed but nothing called it — casters never learned anything after creation |
| 2026-10-16 | M1 | New spells join the fight plan automatically: heals on top (ally < 40% hp), buffs once, damage by highest spell level; debuffs are left for the player | A learned spell sat in the spellbook and was never cast. Measured: autopilot completion 93.8% → 96%, wipes 6.3% → 4% |
| 2026-10-16 | M1 | Abilities like Power Attack are NOT auto-added to the fight plan | Measured: Power Attack on "always" took a fighter from 86 → 28 wins in 150 fights; Knockdown 86 → 10. Needs an M2 design pass |
| 2026-10-16 | M1 | Auto level-up learns spells too: highest level first; healing first for Clerics, damage first for others | Same code as the button, so "auto" heroes are not weaker casters |
| 2026-10-16 | M1 | Warlocks learn pact spells up to what their pact energy can pay for | Warlocks have no spell slots, so the slot-based ceiling gave them nothing to learn |
| 2026-10-16 | M1 | "Healing" spells with no dice (Remove Curse, Remove Disease, Restoration, …) are no longer offered | They healed 0 hp and spent a slot. Live spells 102 → 94 |
| 2026-10-16 | M1 | Level-up picker hides feats/spells that do nothing and empty feat tracks (was: greyed "Not yet available") | Vision + working agreement: never offer something that does nothing |
| 2026-10-16 | M1 | "Auto level up ▸" button at the top of the hero level-up tab | Vision: the player can skip the choices |
| 2026-10-16 | M2 | **Clerics are granted the whole divine list** (every working spell up to their highest slot level) and pick nothing at level-up; they choose what to PREPARE | Steven, PF2E: "they should just get all spells and then select what gets memorized" |
| 2026-10-16 | M2 | Wizards keep a spellbook (learn at level-up); Bard/Sorcerer/Warlock keep a repertoire | PF2E split: prepared-from-book vs spontaneous |
| 2026-10-16 | M2 | "Prepared" = in the fight plan. Prepared casters may plan one distinct spell per slot of that level; cantrips unlimited. Enforced in the sim (`setLoadout` too) | Makes preparing a real choice without a new resting/memorising system |
| 2026-10-16 | M2 | New **Spells tab** on casters: prepare/unprepare by level with slot counters, and a casting order with plain "when" and "at whom" dropdowns | Steven: no way to pick what casters prioritise |
| 2026-10-16 | M2 | Founding Wizard/Bard/Sorcerer/Warlock know their level-1 allotment (2 more spells) | A new wizard had 2 slots and 1 spell. Measured: autopilot completion 96% → 98.5%, wipes 4% → 1% |
| 2026-10-16 | M2 | Quest board holds up to 10; each week a seeded draw sets a size of 4–6 and new jobs fill to it (own rng stream, so ambush rolls don't shift) | Steven: more than 4, 4–6 a week for variance |
| 2026-10-16 | M2 | Weeks 1–4 always carry ≥2 easy jobs. Easy set = Goblin Camp, Wolf Pack + five new small camp fights (900–904, early weeks only). Measured: all win 40/40 with the default L1 party | Steven: early wins for a level-1 team |
| 2026-10-16 | M2 | Board rows lead with a plain word: easy / fair / hard, from the existing level bands | Readable at a glance |
| 2026-10-16 | M2 | Answering a Marshal letter (any choice) hides it, saves, and posts that letter's **commission** (950–953): sealed row at the top, bonus pay, 4-week expiry, outside the weekly 4–6 | Steven: the button did nothing |
| 2026-10-16 | M2 | Item potency means to-hit on weapons and AC on armour/shields only; never a strike bonus on a cloak or ring | Steven: every magic item said "+1 to every strike" |
| 2026-10-16 | M2 | Authored magic items are the same item at any tier roll (a loot cloak was worth 16× a shop cloak); amulet/ring "+N" is AC; masterwork armour = −1 check penalty, not +1 AC | Match the authored rows and player expectation |
| 2026-10-16 | M2 | One item describer for paperdoll, stash, tooltip and shop: "+2 to hit", "AC +3 (Dex max +2)", "+1 to all saves"; effects the engine can't run are greyed "not working yet" | Never claim something that does nothing |
| 2026-10-16 | M2 | Combined board + spells changes: autopilot completion 98.5% → 96.3%, wipes 1% → 3.3%, level-ups 240 → 260 (a bigger board lets autopilot take riskier jobs) | Recorded so later drift is explainable |
| 2026-10-16 | M2 | No frame cap existed (both playheads use uncapped rAF). Scroll lag = paint: fixed desk background → `position:fixed` layer; sheet hover-lift paused while scrolling (`body.gv-scrolling`, 150 ms); sheets on long screens get their own layers. Measured raster work on dispatch ~5.7 s → 0.5 s; p95 at CPU×4 33–66 ms → 16.7 ms | Steven: scrolling laggy in Edge. Paper look kept |
| 2026-10-17 | M2 | Ancestry busts batch 2 generated and shipped; all 12 ancestry × gender portraits are now real art | The silhouette fallback was the common case for 8 of 12 heroes |
| 2026-10-17 | M2 | **An ability rides a normal action and pays a cooldown**, instead of replacing the action's two-swing burst at `actions ×` the interval | Measured: Power Attack was 45–53% of a plain strike — a strict downgrade, not a tradeoff. Now 109–116%. Reverses brief #22's action-cost model |
| 2026-10-17 | M2 | `actions: N` buys a cooldown, floored at 2 intervals; the rider lands once, on the first swing | A 1-interval cooldown is no cooldown (the next action is 1 interval later); a per-swing rider would double Power Attack's die |
| 2026-10-17 | M2 | Abilities are STILL not auto-added to the fight plan | Built it, measured it, reverted it: auto-using Power Attack took the career harness from 95.0% completion / 4.4% wipes to 89.8% / 9.6%. It only pays from ~level 5 up; a career is dominated by the early game |
| 2026-10-17 | M2 | Accepted a difficulty increase: completion 96.3% → 95.0%, wipes 3.3% → 4.4% | Classed enemies were paying the same broken ability tax; fixing it for heroes fixes it for them. Baselines re-taken deliberately |
| 2026-10-17 | M2 | Scroll of Raise Dead repointed to Breath of Life (110) and renamed | Spell 106 Raise Dead is inert (healing row, no dice, `resurrect` flag nothing reads) and there is no permanent death to undo. Pointing at it would move the lie |
| 2026-10-17 | M2 | Weapon price = plain base + flat rune price (potency 100/250/600/1500, striking 120/300/700, masterwork +25) | A +2 dagger cost 16g against a +2 longsword at 120g. The rune is the value, not the stick it is carved into |
| 2026-10-17 | M2 | 41 mid-level quests (ids 1000–1040) covering min_level 6–15 | The generated table had exactly one quest above min_level 7; the board went thin around week 17 |
| 2026-10-17 | M2 | The weekly board draw places TAKEABLE jobs first, and guarantees both a camp fight and a dungeon when it can | A plain shuffle over the whole level band filled mid-level boards with jobs the guild would decline; 18% of weeks (43% at L10) showed only one kind of job, now 0.5% |
