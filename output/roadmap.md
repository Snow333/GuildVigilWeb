# Guild Vigil — Roadmap

**Status:** APPROVED by Steven 2026-10-16. Approving this was the **only** sign-off needed before work starts.
**Rule:** every milestone ends in a build Steven can play. Order can change after any playtest.

---

## Where the existing code stands against the vision

| Vision item | Today | Gap |
|---|---|---|
| Create characters | Founding muster: 4 heroes, 13 classes in data | Only classes the registry can outfit at L1 are offered |
| Parties | 1 party of 4, fixed | No guild-hall size ladder, no second party |
| World map + missions | World map, quest board, travel, terrain | Map is not "explored"; no fog/reveal on the world map |
| Auto-battler missions | **Strong** — continuous combat, dungeons, playback | — |
| Return + summary | After-action screen | Story reveals are thin |
| Rewards / XP / items | Built (loot tiers, shop, XP) | — |
| Level up, manual + auto | Built (feat slots, spells, boosts, autopilot) | Picker offers many feats that do nothing |
| Rich classes | 33 specialization paths designed; ~30 of 227 feats work | **Biggest gap.** Ranger and Bard have no feats |
| Skills matter | Perception/Thievery/Athletics used in dungeons | Arcana, Religion, Survival, Trickery etc. barely matter |
| Town upgrades with resources | 18 buildings in data; shops only | No resources, no upgrades, no resource sites |
| Outposts | — | Not built |
| Story → lich | Storyline data exists (13 lines, 48 dialogue rows) | No story arc, no lich |
| Exploitable enemies | Enemy abilities, weaknesses, immunities wired (#26, #30) | Not visible to the player; few weaknesses |

---

## Milestones

| Milestone | Status |
|---|---|
| M0 — Reset and playtest tooling | ✅ done 2026-10-16 |
| M1 — The whole loop, thin | ⬅ next |
| M2 – M9 | not started |

### M0 — Reset and playtest tooling *(small)*
- Archive old briefs and process docs; install vision, agreement, roadmap; cut `CLAUDE.md` to a short pointer file.
- Dev panel (jump level, add gold/resources, reveal map, level hero).
- In-game **Note** button that saves feedback with game state.
- Desktop shortcut always builds latest `main`.
- **Playtest:** none — tooling check only.

### M1 — The whole loop, thin
- Character creation for every class that can be made playable now; ancestry choice.
- Missions picked on the world map → auto-battle → return with a **readable summary** → rewards → level up (manual **or** auto).
- **Hide every feat/ability that does nothing** from the level-up picker.
- **Playtest:** "Play 5–10 missions from a new game. Does the loop pull you forward?"

### M2 — Signature classes, round 1
- Make the four flagship styles feel distinct in a fight: **touch-casting wizard/sorcerer, tank fighter, ranged ranger, sneak-attack rogue.**
- Give each a level 1–10 ability path built from the approved #29 specializations.
- Skills start to matter on missions (Arcana, Religion, Survival, Trickery… each with a visible payoff).
- **Playtest:** "Build one of each. Can you tell them apart by watching a fight?"

### M3 — The town grows
- Resource sites on the map (lumber yard, mine, magical node, …) that parties secure.
- Resources upgrade buildings; each upgrade gives a clear benefit.
- **Guild hall ladder:** 1×4 → 1×5 → 1×6 → 6+4 → …
- **Playtest:** "Does upgrading the town feel worth sending parties out for?"

### M4 — Multiple parties, exploration, outposts
- Two or more parties on the map at once.
- World map revealed as you explore.
- Outposts cut travel time to distant regions.
- **Playtest:** "Is running two parties fun, or busywork?"

### M5 — Gear and enemies you can outplay
- Enemy strengths/weaknesses visible before and after a mission.
- Equipment choices that answer them (fire vs trolls, blunt vs skeletons, etc.).
- **Playtest:** "Did you ever re-gear or re-build a party to beat a specific enemy?"

### M6–M8 — The story, in three acts
| Act | Levels | Tone |
|---|---|---|
| M6 — Act I | 1–7 | Typical: bandits, beasts, local trouble — with seeds planted |
| M7 — Act II | 8–14 | Unfolds into something elaborate and diabolical around L12–14 |
| M8 — Act III | 15–20 | The march far across the map; the lich and his undead army |

### M9 — Every class rich, levels 1–20
- Remaining classes (Barbarian, Monk, Bard, Cleric, Warlock, the hybrids) brought to the M2 standard.
- Ability paths extended to level 20.
- *(Class work also happens inside earlier milestones as playtests demand it.)*

### Later (not scheduled)
- **Player-controlled special missions** — take direct control of a party for one mission.
- Standalone desktop app (Tauri).

---

## Legacy rules this reset puts back on the table

These were "settled law" before. Under the new agreement Hermes may change them if play says so,
and will log it. Flagging them so none of it is a surprise:

| Old rule | Why it might change |
|---|---|
| Ancestry has **zero** stat effect | Vision says use the defined ancestries; small ancestry bonuses may add flavour |
| Up to 4 teams, unlocked by the **Tavern** | Vision ties party count and size to the **guild hall** |
| Game **never** auto-equips | Not in the vision; a "suggest gear" button may help auto-level players |
| **No** intervention once a fight starts | Vision adds optional player control later |
| Save migration on every change | Saves may break between milestones until there is a campaign worth keeping |
| Brief → approval → code | Replaced by the working agreement |
