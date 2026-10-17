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

**How to settle it:** condition the comparison on runs that reach the same
room depth, and diff two seeded `runEncounter` streams (one party fight, not a
duel) with and without the ability entry, event by event. Until then abilities
stay out of the auto fight plan and the player places them by hand.
