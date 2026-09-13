# Brief #27 — Enemy taxonomy: families, brackets and roles from L1 to L20

**Status:** FOR APPROVAL
**Author:** session of 2026-09-13
**Depends on:** #26 (the ability vocabulary and the six behavioural channels), #13 (the
level band), #20 (creature size), #23 (the illegal-armour correction that voids older
balance numbers)
**Supersedes:** the "300–500 enemies / 300–400 quests" target carried from the migration
plan into `output/future-work.md` R4

---

## 1. The finding

The content target this project has carried since August is a **row count**: 300–500
enemies against today's 45. Steven's instruction on 2026-09-13 was to stop optimising the
number and specify the **taxonomy** instead.

Measurement supports that instruction, and this brief exists because of one number:

> ⚠ **The last enemy batch this project authored — the 21-row Vanguard's Shadow set, ids
> 100–120 — wrote an EMPTY `abilities` string on 21 of 21 rows.** Three of the twenty-one
> distinguish at all, and all three do so *by accident*, because `enemy_type: 'undead'`
> derives poison/disease immunity for free.

That is what bulk authoring looks like here without a taxonomy. Reaching 300 rows that
way produces 300 statblocks that fight identically — the defect multiplied, not content.

### 1.1 What the player currently experiences

Fingerprinting real `runEncounter` fights over 31 rows × 6 seeds (event-type set plus
damage-kind set) yields **8 distinct behavioural signatures, and 17 of the 31 rows collapse
into a single identical one**: `{weapon damage, no conditions, no dying checks}`.

A Goblin, a Kobold, a Bandit, a Hobgoblin Soldier, a Krathite Conscript, an Orc Raider and
a Goblin Sapper are the same creature wearing different hit points. The only difference a
player can perceive is how long each takes to kill.

---

## 2. The engine has exactly six behavioural channels

This is the binding constraint on the whole taxonomy, and it is why "more rows" is the
wrong axis. A row is **distinguishing** if and only if it moves at least one of:

| # | Channel | Reached by | Authored users today |
|---|---|---|---|
| 1 | **Rider** — typed damage or a condition on hit | `poison`, `disease`, `gore`, `energy_drain`, `dark_bolt_1d6`, `trip` | 8 rows |
| 2 | **Damage modifier** — immune / resist / weak | `enemy_type: 'undead'` (derived), `fire_weakness` | 10 immune, 1 weak, **0 resist** |
| 3 | **Sneak dice** | `sneak_attack_1d6` | 1 row |
| 4 | **Stealth bonus** — feeds the backstab conceal check both ways | `stealth` | 1 row |
| 5 | **AoO reaction** | `aoo_count >= 1` | 5 rows |
| 6 | **Size radius** — positioning and reach geometry | `size` medium/large/huge | 9 non-medium |

Borderline seventh: **`speed`**, which genuinely changes closing behaviour (Wolf 7 vs
Zombie 4) rather than only a total.

Everything else — hp, ac, attack_bonus, damage_dice, the six ability scores — is a number.
**Two rows differing only in numbers fight identically.**

### 2.1 After brief #26 M3

M3 shipped on 2026-09-13 and widened the live vocabulary from 9 words to **14**:
`pack_tactics`, `formation_bonus`, `charge`, `ferocity`, `regeneration_10` joined the
original nine. The distinguishing ratio moved **37.8% → 42.2%** of rows.

⚠ **There are ZERO legal-but-unused vocabulary words.** All 14 live words are already
named by at least one row. The vocabulary was derived *from* the authored content in #26,
so it has no headroom: an author of a new enemy today is choosing among 14 words that are
all already in use.

---

## 3. The proposal: 7 families × 5 brackets × 6 roles

### 3.1 The six roles — deliberately mirroring the player classes

Steven's instruction included "characters that match player character classes (Bandit
Warrior, Bandit Archer, etc)". Each role is defined by the channel it moves, not by its
name, so a role is only real if the engine can express it.

| Role | Mirrors | How it feels to fight | Channel | Buildable today |
|---|---|---|---|---|
| **Warrior** | Fighter | Holds the line, punishes you for leaving | AoO reaction, high AC | ✅ |
| **Skirmisher** | Rogue | Hits from surprise, then is gone | sneak dice + stealth | ✅ |
| **Caster** | Wizard / Sorcerer | Damage that ignores armour | typed riders | ✅ |
| **Zealot** | Cleric / Warlock | Drains you; sustains its side | `energy_drain` | ✅ partial |
| **Brute** | Barbarian | Closes fast and refuses to fall | charge, ferocity, regen, size | ✅ (new in M3) |
| **Archer** | Ranger | Hurts you before you reach it | ranged attack | ⛔ **NOT BUILDABLE** |

### 3.2 ⚠ The Archer role cannot be authored today

`src/sim/combat/build.ts` lines 50–52 hardcode every enemy as melee:

```ts
weaponRange: 1,
engageRange: 1, // enemy statblocks are melee until the registry grows ranged rows
weaponAgile: false,
```

**Every enemy in Guild Vigil is a melee enemy.** Authoring "Bandit Archer", "Skeletal
Archer" or "Undead Archer" today produces a melee creature wearing a bow — precisely the
content-with-no-consumer defect this project has now hit seven times.

This is not a small fix. Ranged enemies change every closure time in the game, which is
why #26 listed ranged enemies as an explicit anti-goal. **The Archer role is specified
here but BLOCKED**, and Q3 below asks whether to unblock it.

### 3.3 The five brackets

| Bracket | Levels | Name | What the player is learning |
|---|---|---|---|
| **I** | L1–4 | The Warrens | The verbs. Vermin, raiders, the first undead. |
| **II** | L5–8 | The Marches | Organised enemies — formations, outlaw bands, the first giants. |
| **III** | L9–12 | The Dominion | A faction with doctrine, mirroring your own party. |
| **IV** | L13–16 | The Barrows | The unquiet dead and the powers that raise them. |
| **V** | L17–20 | The Wyrm | Apex singular threats. |

### 3.4 The seven families

Families deliberately **do not** span every bracket. Goblinoids fade after Bracket III —
outgrowing goblins *is* the feeling of getting stronger, and a L18 goblin would undo it.
Only the **Restless Dead** and the **Krathite Dominion** span the full range, because they
scale with the story rather than with the party's level.

| Family | Brackets | Existing rows it absorbs |
|---|---|---|
| **Goblinoid** (Goblin, Kobold, Hobgoblin, Bugbear) | I–III | 9 |
| **Orc & Ogrekin** (Orc, Ogre, Troll, Giants) | I–V | 8 |
| **Outlaw** (Bandits, brigands, the class mirrors) | I–III | 1 |
| **Krathite Dominion** (the plot faction) | I–V | 8 |
| **Cult of the Dark Flame** | I–V | 2 |
| **Restless Dead** (Skeleton → Lich) | I–V | 11 |
| **Dragonkind** | II–V | 2 |

**Total: 39 of the existing 45 rows absorb into the taxonomy unchanged.** The 6 that do
not are the animals (Wolf, Giant Rat, Giant Spider, Warg, Warg Alpha, Minotaur) — see §6.

### 3.5 Steven's brief, corrected against the data

Three of the instructions conflict with what is authored, and the data should win:

1. **"Bandits start showing up around level 5 to level 8."** Your `Bandit` is **L2** today.
   Proposal: plain `Bandit` stays in Bracket I; the *class-mirroring* variants — Bandit
   Warrior, Bandit Archer, Bandit Bruiser, Highway Captain — populate Bracket II. Your
   instinct was right about the named variants, not the base row.
2. **"Faction warriors (Knights, Mages, etc of some plot point enemy faction)."** You
   already have one. The **Dominion of Krath** is an authored nation with 8 enemy rows and
   its own storyline ("The Vanguard's Shadow"). No new faction needs inventing — Krathite
   Knight, Krathite War-Mage and Dominion Inquisitor extend what exists.
3. **"Undead Fighter, Undead Archer."** Undead Fighter is buildable now. **Undead Archer is
   blocked by §3.2** along with every other archer.

---

## 4. ⚠ The finding that reshapes the whole brief: Brackets IV and V are unreachable

**No quest in the game exceeds difficulty 10.** Measured across all 22 quest rows:

| difficulty | d1 | d2 | d3 | d4 | d5 | d6 | d7 | d8 | d9 | d10 |
|---|---|---|---|---|---|---|---|---|---|---|
| quests | 4 | 2 | 4 | 3 | 3 | 3 | 1 | 1 | 0 | 1 |

`ENCOUNTERS.levelBand` is 1 and the boss band is flat at difficulty+1, so the **highest
enemy level a player can ever meet today is 11**.

That means:

- **Bracket IV (L13–16) and Bracket V (L17–20) cannot be reached by any player.**
- Authoring them now would be **unverifiable work** — no harness could measure it and no
  playtest could see it. This is the same reasoning that deferred #26's 16 L7+ abilities,
  and the same anti-goal.
- The existing L12 Adult Red Dragon is *already* past the reachable ceiling.

⚠ **Therefore this brief proposes authoring Brackets I–III only.** Brackets IV and V are
specified here so the shape is agreed and the ID blocks reserved, but **no row in them may
be authored until quests exist that reach those depths.** Q1 below asks how to sequence
that.

---

## 5. Proposed milestones

### M1 — The distinguishing ratio gate (no new content)

Before any authoring, make inert content fail the build. A row is distinguishing if it
moves ≥1 of the six channels in §2.

- `tools/check-enemy-taxonomy.mjs`, wired into `pnpm check` and CI.
- Asserts: every enemy row declares a family and a role; the **ratio of distinguishing
  rows may never decrease**; no row names a vocabulary word outside the 14 live + 26
  deferred; every authored `family` × `bracket` pair is one this brief sanctions.
- ⚠ Per the repo's gate law, **prove it can fail**: strip `abilities` from a distinguishing
  row and confirm the ratio check trips; restore; confirm `src/` is byte-identical.

**Estimated effort:** half a session. **This is the milestone that makes the rest safe.**

### M2 — Bracket I completion (L1–4)

Fill the early game to a full family × role spread. ~14 new rows: Kobold Trapper, Goblin
Shaman, Hobgoblin Warcaster, Orc Blood-Speaker, Cutpurse, Skeletal Archer *(blocked —
melee variant only)*, Undead Fighter, Crypt Knight, and the Bracket I role gaps.

**Every row must name ≥1 live vocabulary word or derive from `enemy_type`.** The Vanguard
batch is the counter-example: 21 rows, zero abilities.

**Estimated effort:** one session including the seed and the exposure tests.

### M3 — Bracket II completion (L5–8)

~16 new rows. The outlaw class-mirrors (Bandit Warrior, Bandit Bruiser, Highway Captain),
Hobgoblin Warlord, Bugbear Headsman, the Krathite officer tier, Frost Giant, Troll
Hagspawn, the Wight/Barrow-Wight line.

**Estimated effort:** one session.

### M4 — Bracket III completion (L9–12)

~20 new rows. The Dominion's doctrine tier (Krathite Knight, War-Mage, Inquisitor,
Shieldbearer, Vanguard Marshal), Death Knight, Bone Colossus, Outlaw Blademaster, Brigand
Sorcerer, Young White Dragon, Drake Rider.

⚠ **M4 requires quests at d9–d12 to exist first**, or its rows are unreachable on delivery.
Today only one quest reaches d10 and none reach d9, d11 or d12.

**Estimated effort:** one session for the rows, plus quest work that is not in this brief.

### M5 — Brackets IV and V — **DEFERRED, NOT SCHEDULED**

Specified in §3.3 and reserved in the ID plan. **Blocked on §4.** Do not author.

---

## 6. Animals: Steven said stay away, and the data agrees — with one exception

The instruction was "stay away from animals for now". Six existing rows are animals or
beasts: Wolf, Giant Rat, Giant Spider, Warg, Warg Alpha, Minotaur.

Proposal: **leave all six in place, author no more.** Two reasons to keep them rather than
retire them: `id` is append-only forever, and three of the six are among the most
distinguishing rows in the registry (Wolf carries `pack_tactics,trip`; Giant Spider
`poison,web`; Minotaur `charge,gore`).

⚠ **The Minotaur is not an animal** in any trope sense — it is `enemy_type: 'beast'` today,
which is arguably a mis-authoring. Q4 asks whether to re-file it under Orc & Ogrekin.

---

## 7. ID block plan (append-only, gaps left visible)

| Block | Family | Notes |
|---|---|---|
| 121–140 | Goblinoid | Bracket I–III |
| 141–160 | Orc & Ogrekin | |
| 161–180 | Outlaw | |
| 181–210 | Krathite Dominion | widest block — the plot faction |
| 211–225 | Cult of the Dark Flame | |
| 226–260 | Restless Dead | widest content family |
| 261–280 | Dragonkind | |
| 281–320 | **RESERVED — Brackets IV/V** | ⚠ do not author until §4 clears |

---

## 8. Balance expectation, stated before measuring

Per `output/reference/measurement.md`, the prediction goes in the brief before the numbers
are taken.

**Expectation: Brackets I–III authoring moves the d1–d5 curve by less than the ±8 noise
bar**, because the level band means new rows dilute the draw pool rather than replace it.
The exception is Bracket I, where 14 new rows against 13 currently-spawnable at d1 roughly
doubles the pool — **if d1 completion moves more than 8 points, the new rows are
mis-costed, not the game re-tuned.**

⚠ **The curve is not a gate right now** (Steven's standing call, #22 D5). This prediction
is a tripwire for authoring errors, not a balance target.

---

## 9. Questions for Steven

| # | Question | Option A | Option B | Notes |
|---|---|---|---|---|
| **Q1** | **Brackets IV/V are unreachable (§4).** How do we sequence? | **Author I–III only**; revisit IV/V when quests reach d13+ | Author IV/V now so the content exists when quests arrive | A is the repo's established anti-goal position (#26 deferred 16 abilities for exactly this reason). B risks 30+ rows nobody can verify. |
| **Q2** | **Zero unused vocabulary (§2.1).** 14 live words, all in use. Do new rows get new abilities? | **Yes — each bracket adds ~4 words**, budgeted per milestone | No — recombine the existing 14 | A is more work per milestone but is the only way "fights differently" keeps meaning something at 89 rows. B hits a ceiling fast. |
| **Q3** | **The Archer role is blocked (§3.2).** | **Leave blocked**; author archers as melee-with-a-bow later | Unblock ranged enemies as its own brief before M2 | ⚠ Ranged changes every closure time in the game. B is a real balance brief, not a wiring task. |
| **Q4** | The Minotaur is `enemy_type: 'beast'` (§6). | **Re-file under Orc & Ogrekin** | Leave as beast | Cosmetic today — `enemy_type` only derives undead immunity — but it decides which family owns it. |
| **Q5** | What distinguishing ratio must new batches hit? | **≥60%** for every new seed | Match today's 42.2% | The M1 gate needs a number. 60% is a real authoring cost per row; the Vanguard batch scored 14%. |

---

## 10. Anti-goals

- ⛔ **No row count target.** This brief deliberately does not say "300 enemies". It says
  7 families × 5 brackets × 6 roles, of which **I–III are authorable = ~89 rows total**.
- ⛔ **No variant templates.** The migration plan proposed 600–1000 statblocks from 300
  bases via transforms. A transform can only permute what the engine reads, so it would
  produce 1000 statblocks and still ~8 ways to fight; its flagship example (an undead
  variant applying immunity) is something `enemy_type` already derives for free. It also
  breaks append-only IDs and blinds the count gates.
- ⛔ **No animals beyond the existing six** (§6).
- ⛔ **No authoring before the M1 gate exists.** The Vanguard batch is the argument.
- ⛔ **No hand-editing `src/content/generated/enemies.ts`.** Rows arrive by reviewable seed
  under `data/seeds/`, then `pnpm db:apply` + `pnpm convert`.

---

## 11. Evidence for the numbers in this brief

Every figure above was measured on 2026-09-13 against the live registry, not carried from
an earlier document:

- 45 enemy rows, 22 quest rows.
- Vanguard batch ids 100–120: 21 of 21 empty `abilities`, 3 undead.
- 8 behavioural signatures over 31 rows × 6 seeds; 17 rows share one signature.
- 14 live vocabulary words after #26 M3; 0 legal-but-unused.
- Distinguishing ratio 42.2% (19 of 45).
- Quest difficulty ceiling 10 → max reachable enemy level 11.
- `build.ts:50–52` hardcodes `weaponRange: 1`, `engageRange: 1`.
