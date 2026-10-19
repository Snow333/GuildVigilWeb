# Questions for Steven

Parked questions. Hermes keeps building while these wait. Answer any time, in any form.

| # | Question | Hermes's default if unanswered |
|---|---|---|
| — | *(none open)* | |

---

## Open engineering puzzles (not for Steven — Hermes's own to-dos)

**Why does auto-using Power Attack make a PARTY worse?** (M2, 2026-10-17)

One fighter against a sandbag kills measurably faster with Power Attack on
`always` (109–116% of a plain strike, 40 seeds, three weapon sizes). The same
change across the campaign harness goes the other way:

| Fight plan | Completion | Wipes |
|---|---|---|
| no abilities | 95.0% | 4.4% |
| Power Attack auto-added | 89.8% | 9.6% |
| + Intimidating Strike | 92.7% | 6.5% |

Power Attack costs 5.2 points of completion; Intimidating Strike's frightened
recovers about half of it. Trip and shove measured as no change either way.

Leading suspicion is the run-length term the skill warns about: a party that
kills faster pushes deeper into a dungeon before it retreats, and dies there —
so "completion" is being compared across runs of different lengths. If that is
all it is, the model change is fine and the harness question is how to measure
it. If it is not, something about an ability action is costing a party
something the one-on-one probe cannot see.

**SETTLED 2026-10-17 — the cause is the burst, and the answer is level-dependent.**

`encounter.ts`: a normal action is a burst of `swingsPerAction` swings, and the
loop does `if (target.hp <= 0) break;` — **it never retargets**. So a bigger
first swing that kills throws away the rest of the burst, and the extra die
lands on a body that was already falling. Both penalties scale with how
over-sized a hero's swing is compared to enemy hp.

Measured on REAL enemy rows at each `base_level`, with bracket-geared parties
built through the harness's own `partyAt` production path, 40 seeds per cell,
one room of four bodies:

| lvl | median foe hp | swings/action | overkill | hero win % | ticks to clear |
|---|---|---|---|---|---|
| 1 | 8 | 1.26 → 1.20 | 42% → 45% | 100 → 100 | 50 → 50 |
| 2 | 18 | 1.34 → 1.31 | 25% → 29% | 100 → 100 | 69 → **61** |
| 3 | 24 | 1.43 → 1.44 | 29% → 29% | 100 → 100 | 83 → 83 |
| 4 | 32 | 1.48 → 1.45 | 23% → 23% | 100 → 100 | 93 → 92 |
| 5 | 44 | 1.43 → 1.43 | 21% → 23% | 100 → 100 | 79 → **77** |
| 6 | 55 | 1.47 → 1.45 | 20% → 20% | 100 → 100 | 100 → **95** |
| 7 | 55 | 1.47 → 1.45 | 15% → 15% | 100 → 100 | 101 → **95** |
| 8 | 120 | 1.61 → 1.60 | −12% → −7% | 50 → **55** | 131 → 135 |

(left of each arrow = no Power Attack, right = Power Attack on `always`.)

Enemy hp outgrows hero damage-per-swing, so **overkill falls from 42% to 15%**
across the curve and Power Attack stops being a tax: a drag at L1–2, neutral
L3–4, a 5–6% faster clear by L6–7, and at L8 it converts into win rate
(+5 points). ⚠ Win rate is saturated at 100% for L1–7 in a single-room test,
so ticks-to-clear is the usable signal there; the L8 tick figure is confounded
because more runs now survive to the end instead of ending early in a loss.

So the career-harness result (−5.2 points of completion) is not wrong, it is
**dominated by the early game** — a career starts at L1 and spends most of its
runs in exactly the band where Power Attack loses.

**CLOSED 2026-10-17 by Steven.** Power Attack stays as it is, and the burst
will **NOT** be made to retarget globally — carry-through belongs to **Cleave**,
a melee feat still to be added. Making every attack carry through would hand
out for free the thing Cleave is meant to sell. So the 42%-of-damage-on-corpses
figure is not a bug to fix; it is the gap Cleave fills, and it also explains
why Cleave will feel strong when it arrives.

⚠ DO NOT "fix" the `if (target.hp <= 0) break;` in `encounter.ts` as a general
engine improvement. It is load-bearing design space.

Auto-adding abilities was revisited separately and settled: only
`grant_party_condition` (bard songs) is auto-planned. See `decisions.md`.
