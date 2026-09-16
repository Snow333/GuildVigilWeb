# Brief #29 — APPROVED SELECTION

**Status:** ✅ SETTLED by Steven, 2026-09-15. This file records the pared list and what it commits
to. The parent brief `29-class-specialization-paths.md` keeps the full 79 for the record.

**Next step:** model the abilities for these 33 paths (Steven's sequence: list 7 → pare → *then*
model). That is a separate session and a separate brief.

---

## 1. The 33 approved paths

Every class landed in the 3–5 band. Ten classes, 33 paths.

| Class | Paths | Playable today | Blocked on |
|---|---|---|---|
| **Fighter** | Brawler · Weapon Master · Bulwark | 1 of 3 | weapon-family spec, threat/taunt |
| **Barbarian** | Wounded Fury · Totem: Dragon · Come and Get Me · Titan | 0 of 4 | stance/rage layer, threat/taunt |
| **Rogue** | Debilitator · Poisoner · Scout | **2 of 3** | flat-footed/sneak layer |
| **Monk** | Mountain · Stunning Fist · Flurry · Ki Channeler | 1 of 4 | condition application, active verbs, focus |
| **Cleric** | Life Domain · Undead Hunter · Field Medic | 0 of 3 | healing layer, long-rest persistence |
| **Wizard** | Touch Specialist · Spell Penetrator · Metamagician | 1 of 3 | spell-effect layer, metamagic |
| **Sorcerer** | Bloodline Focus · Crossblooded · Presence | 0 of 3 | focus pool, character-build, saves |
| **Warlock** | Pact of the Blade · Pact of the Tome · Blast Shaper | 0 of 3 | spell-effect layer, character-build |
| **Ranger** | Archer · Two-Blade · Pathfinder | 0 of 3 | weapon-family spec, active verbs, exploration |
| **Bard** | Inspirer · Dirge · Charmer · Healer's Refrain | 0 of 4 | aura system, charm, healing layer |

**Prestige classes were not selected from.** Arcane Trickster, Eldritch Knight and Mystic Theurge
are dropped from this round — consistent with legacy, which lists all three as post-launch.
The Mystic Theurge zero-slot progression bug is therefore **deferred, not fixed**; it must be
resolved before that class is ever built. Logged to `future-work.md`.

## 2. What this selection commits to

Sixteen distinct hooks, ranked by how many approved paths each unlocks:

| hook | approved paths | authored feats it revives | kind |
|---|---|---|---|
| stance/rage modifier layer | 3 | **12** (all Barbarian) | extend existing |
| healing modifier layer | 3 | **11** | extend existing |
| spell-effect modifier layer | 3 | **21** | extend existing |
| weapon-family specialisation | 2 | — | extend existing |
| **threat/taunt** | 2 | **0** | 🔴 new system |
| new active verbs | 2 | 17 | extend existing |
| focus points | 2 | 8 | 🔴 new system |
| character-build layer | 2 | 6 | 🔴 new system |
| **aura system** | 2 | **0** | 🔴 new system |
| flat-footed/sneak layer | 1 | 9 | extend existing |
| condition application | 1 | 3 | extend existing |
| long-rest persistence | 1 | 7 | 🔴 new system |
| metamagic | 1 | **2** | 🔴 new system |
| conditional save modifier | 1 | 10 | extend existing |
| exploration verbs | 1 | 13 | 🔴 new system |
| charm/control | 1 | 0 | 🔴 new system |

**Total authored feats revived: 89 of the 197 currently dead.** The selection pays for itself
nearly twice over in content that already exists.

## 3. Three cost notes, flagged not argued

Steven's call stands on all three. Recording them so nobody re-derives them later.

1. **Four paths ride systems that revive zero authored feats** — Fighter Bulwark and Barbarian Come
   and Get Me (threat/taunt), Bard Inspirer and Dirge (aura). These are pure new-build with no
   content dividend. They are also two of Steven's three original examples, so the cost is bought
   deliberately.
2. **Wizard Metamagician is the thinnest return in the selection** — a whole new metamagic system
   for one path and two feats. Cheapest path to cut if scope tightens; flagged only for that reason.
3. **Sorcerer is the most expensive class here.** Its three approved paths need focus pool +
   character-build + saves, and *none* of them touch the spell-effect layer — even though Sorcerer
   has **8 dead feats sitting under that exact hook**, which is being built anyway for Wizard and
   Warlock. The four declined Sorcerer paths (Touch Specialist, Draconic Bloodline, Empowered
   Evoker, Dangerous Sorcery) all ride it. ⚠ **If any one path is ever added back, take it from
   there — it is close to free.** Not reopening the decision; noting where the cheap option sits.

## 4. Near-free paths left on the table

23 declined paths ride hooks this selection already buys. Not a proposal — a record, so a future
"can we add one more?" is a lookup instead of a re-analysis.

- **Already work, zero engine cost:** Monk Tiger · Monk Crane · Cleric Battle Priest ·
  Cleric Guardian · Bard Loremaster · Bard Duellist-Poet
- **Ride the spell-effect layer:** all four declined Sorcerer paths · Wizard Evoker ·
  Wizard Safe Caster · Bard Battle Chanter
- **Ride the rage layer:** Barbarian Reckless · Barbarian Unbreakable
- **Ride the sneak layer:** Rogue Assassin · Rogue Gang Fighter
- **Ride hooks otherwise bought:** Fighter Warlord (aura) · Cleric Domain Caster (focus) ·
  Cleric Warpriest (build) · Rogue Shadow, Monk Wind Walker, Warlock Shadow Walker (exploration)

## 5. Suggested build order

Not approved — offered for the modelling session to react to. Ordered by content dividend per hook.

1. **Fix the picker first.** Independent of everything here: 42 feats are currently offered as
   selectable and do nothing (63% of what the picker shows). Small, and it stops the bleeding.
2. **spell-effect layer** — 21 feats, unlocks Wizard + Warlock paths, and Sorcerer's cheap option.
3. **stance/rage layer** — 12 feats, all Barbarian; makes an entire class playable in one move.
4. **healing layer** — 11 feats, Cleric + Bard.
5. Then the new systems, cheapest-first by dividend: exploration (13) → focus (8) → long-rest (7)
   → character-build (6) → threat/taunt (0) → aura (0) → charm (0) → metamagic (2).

⚠ **Threat/taunt and aura sort last by dividend but carry two of Steven's three examples.** Dividend
is not the only axis — player-facing value may well outrank it. That is his call at modelling time.

---

## Summary

Steven pared 79 paths to 33, every class inside the 3–5 band, prestige classes dropped to
post-launch. The selection revives 89 of the 197 dead feats as a side effect, so most of the engine
work pays for itself in content already written.

- **33 paths across 10 classes** — Rogue is closest to playable (2 of 3 work today), Barbarian and Bard need the most new work.
- **89 authored feats come back** from the hooks this selection requires.
- **Four paths revive nothing** (threat/taunt, aura) — bought deliberately, since two are Steven's own examples.
- **Sorcerer is the costliest class** and declined the one hook being built anyway; the cheap add-back is recorded in §4.
- **Mystic Theurge's zero-slot bug is deferred, not fixed** — logged to future-work.
