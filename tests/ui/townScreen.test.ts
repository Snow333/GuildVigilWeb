/**
 * Town & Upgrades screen (M3 track T) — the pure half.
 *
 * Two kinds of test, on purpose:
 *  - SYNTHETIC `BuildingView`s, so each clause of the ranking rule is pinned on
 *    its own (cheapest first, tie-breaks, never blocked, never unwired, never
 *    padded) with a control that proves the filter can actually remove a row.
 *  - the REAL session, so the rule is also shown to hold against the shipped
 *    town and not just against shapes the test invented.
 */
import { describe, expect, it } from 'vitest';
import { CampaignSession } from '@sim/campaign/session';
import { starterParty } from '@sim/campaign/starterParty';
import { effectAt, partySizeAtLevel, type BuildingView, type BlockedReason } from '@sim/campaign/town';
import { RESOURCE_KINDS, emptyStock, type ResourceStock } from '@content/town';
import {
  gapLine, ledgerOrder, needRows, picksTogether, rankPicks, resourceUnits,
  statusCounts, statusOf,
} from '../../src/ui/screens/townPicks';

// ── synthetic views ─────────────────────────────────────────────────────────

interface Spec {
  id: number;
  gold?: number;
  res?: Partial<ResourceStock>;
  /** true/false = wired flag; null = no effect copy at all. */
  wired?: boolean | null;
  blocked?: BlockedReason[];
  maxed?: boolean;
}

function view(spec: Spec): BuildingView {
  const wired = spec.wired === undefined ? true : spec.wired;
  return {
    id: spec.id,
    name: `Building ${spec.id}`,
    level: 1,
    maxLevel: 3,
    current: null,
    next: spec.maxed ? null : {
      level: 2,
      cost: { gold: spec.gold ?? 0, resources: spec.res ?? {} },
      effect: wired === null ? null : { text: `effect ${spec.id}`, wired },
    },
    blocked: spec.maxed ? [] : (spec.blocked ?? []),
  };
}

const GOLD_SHORT: BlockedReason = { kind: 'gold', text: 'Needs 500 gold — the guild has 0.' };
const NEEDS_HALL: BlockedReason = { kind: 'prerequisite', text: 'Needs Guild Hall at level 3 first.' };
const NEEDS_REP: BlockedReason = { kind: 'reputation', text: 'Needs 30 reputation — the guild has 0.' };
const SHORT_WOOD: BlockedReason = { kind: 'resources', text: 'Short 4 more timber.' };

const ids = (town: BuildingView[], limit?: number): number[] =>
  rankPicks(town, limit).map((p) => p.building.id);

describe('rankPicks — the three-pick rule', () => {
  it('ranks by gold ascending', () => {
    const town = [view({ id: 1, gold: 300 }), view({ id: 2, gold: 100 }), view({ id: 3, gold: 200 })];
    expect(ids(town)).toEqual([2, 3, 1]);
  });

  it('breaks a gold tie by total resource units ascending', () => {
    const town = [
      view({ id: 1, gold: 100, res: { timber: 20, stone: 12 } }), // 32 units
      view({ id: 2, gold: 100, res: { iron: 5 } }),               //  5 units
      view({ id: 3, gold: 100 }),                                 //  0 units
    ];
    expect(ids(town)).toEqual([3, 2, 1]);
  });

  it('breaks a full tie by building id ascending, whatever order the input is in', () => {
    const town = [view({ id: 9, gold: 50 }), view({ id: 4, gold: 50 }), view({ id: 7, gold: 50 })];
    expect(ids(town)).toEqual([4, 7, 9]);
    expect(ids([...town].reverse())).toEqual([4, 7, 9]);
  });

  it('counts every resource kind, not just one, in the units tie-break', () => {
    const many = view({ id: 1, gold: 10, res: { timber: 3, iron: 3, stone: 3, grain: 3 } }); // 12
    const one = view({ id: 2, gold: 10, res: { mithril: 9 } });                              //  9
    expect(resourceUnits(many.next!.cost)).toBe(12);
    expect(ids([many, one])).toEqual([2, 1]);
  });

  it('takes at most 3, numbered 1..3', () => {
    const town = [1, 2, 3, 4, 5].map((id) => view({ id, gold: id * 10 }));
    const picks = rankPicks(town);
    expect(picks.map((p) => p.rank)).toEqual([1, 2, 3]);
    expect(picks.map((p) => p.building.id)).toEqual([1, 2, 3]);
  });

  it('NEVER recommends an unwired effect, even when it is the cheapest by far', () => {
    const town = [
      view({ id: 1, gold: 0, wired: false }),
      view({ id: 2, gold: 0, wired: false }),
      view({ id: 3, gold: 400 }),
      view({ id: 4, gold: 500 }),
      view({ id: 5, gold: 600 }),
      view({ id: 6, gold: 700 }),
    ];
    expect(ids(town)).toEqual([3, 4, 5]);
    // control: the SAME rows with the flag flipped are picked first — so the
    // filter above is doing the removing, not the ordering.
    const flipped = town.map((b) => (b.id <= 2 ? view({ id: b.id, gold: 0, wired: true }) : b));
    expect(ids(flipped)).toEqual([1, 2, 3]);
  });

  it('never recommends an upgrade with no effect copy at all', () => {
    const town = [view({ id: 1, gold: 0, wired: null }), view({ id: 2, gold: 90 })];
    expect(ids(town)).toEqual([2]);
  });

  it('never recommends a blocked row — each blocker kind on its own', () => {
    for (const reason of [GOLD_SHORT, NEEDS_HALL, NEEDS_REP, SHORT_WOOD]) {
      const town = [view({ id: 1, gold: 0, blocked: [reason] }), view({ id: 2, gold: 90 })];
      expect(ids(town), reason.kind).toEqual([2]);
    }
  });

  it('never recommends a fully built building', () => {
    expect(ids([view({ id: 1, maxed: true }), view({ id: 2, gold: 90 })])).toEqual([2]);
  });

  it('returns FEWER than 3 when fewer qualify, and never pads with blocked or unwired rows', () => {
    const town = [
      view({ id: 1, gold: 100 }),
      view({ id: 2, gold: 0, wired: false }),
      view({ id: 3, gold: 0, blocked: [GOLD_SHORT] }),
      view({ id: 4, maxed: true }),
    ];
    expect(ids(town)).toEqual([1]);
    expect(ids([])).toEqual([]);
    expect(ids(town.slice(1))).toEqual([]);
  });

  it('does not mutate its input', () => {
    const town = [view({ id: 3, gold: 30 }), view({ id: 1, gold: 10 }), view({ id: 2, gold: 20 })];
    const snapshot = JSON.stringify(town);
    rankPicks(town);
    expect(JSON.stringify(town)).toBe(snapshot);
  });
});

describe('gapLine — what stands where missing picks would be', () => {
  it('says nothing when the list is full', () => {
    const town = [1, 2, 3].map((id) => view({ id, gold: id }));
    expect(gapLine(town, rankPicks(town))).toBeNull();
  });

  it('says nothing is ready when there are no picks at all', () => {
    const town = [view({ id: 1, gold: 5, blocked: [GOLD_SHORT] })];
    expect(gapLine(town, rankPicks(town))).toBe('Nothing is ready to buy yet.');
  });

  it('says nothing ELSE is ready when there are some picks', () => {
    const town = [view({ id: 1, gold: 5 }), view({ id: 2, gold: 5, blocked: [GOLD_SHORT] })];
    expect(gapLine(town, rankPicks(town))).toBe('Nothing else is ready to buy this week.');
  });

  it('is honest about ready-but-unwired upgrades: counted, not recommended', () => {
    const town = [view({ id: 1, gold: 5 }), view({ id: 2, gold: 0, wired: false }), view({ id: 3, gold: 0, wired: false })];
    expect(gapLine(town, rankPicks(town))).toBe(
      'Nothing else is ready to buy this week. 2 more are ready but do nothing yet.',
    );
    const one = [view({ id: 2, gold: 0, wired: false })];
    expect(gapLine(one, rankPicks(one))).toBe('Nothing is ready to buy yet. 1 more is ready but do nothing yet.');
  });
});

describe('statusOf / ledger grouping', () => {
  it('maps the sim blocker kinds onto the four shelves', () => {
    expect(statusOf(view({ id: 1 }))).toBe('ready');
    expect(statusOf(view({ id: 1, blocked: [GOLD_SHORT] }))).toBe('short');
    expect(statusOf(view({ id: 1, blocked: [SHORT_WOOD] }))).toBe('short');
    expect(statusOf(view({ id: 1, blocked: [GOLD_SHORT, SHORT_WOOD] }))).toBe('short');
    expect(statusOf(view({ id: 1, blocked: [NEEDS_HALL] }))).toBe('locked');
    expect(statusOf(view({ id: 1, blocked: [NEEDS_REP] }))).toBe('locked');
    // a missing building beats a missing coin: the player must DO something first
    expect(statusOf(view({ id: 1, blocked: [GOLD_SHORT, NEEDS_HALL] }))).toBe('locked');
    expect(statusOf(view({ id: 1, maxed: true }))).toBe('maxed');
  });

  it('counts all buildings exactly once and orders ready → short → locked → maxed', () => {
    const town = [
      view({ id: 5, maxed: true }),
      view({ id: 4, blocked: [NEEDS_REP] }),
      view({ id: 3, blocked: [GOLD_SHORT] }),
      view({ id: 2 }),
      view({ id: 1 }),
    ];
    expect(statusCounts(town)).toEqual({ ready: 2, short: 1, locked: 1, maxed: 1 });
    expect(ledgerOrder(town).map((b) => b.id)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('needRows / picksTogether', () => {
  const stock = (over: Partial<ResourceStock>): ResourceStock => ({ ...emptyStock(), ...over });

  it('lists only what the upgrade charges for, with the balance left after', () => {
    const rows = needRows({ gold: 150, resources: { timber: 8, grain: 10 } }, 420, stock({ timber: 14, grain: 6 }));
    expect(rows).toEqual([
      { item: 'gold', costs: 150, have: 420, left: 270 },
      { item: 'timber', costs: 8, have: 14, left: 6 },
      { item: 'grain', costs: 10, have: 6, left: -4 },
    ]);
  });

  it('omits the gold row when the upgrade costs no gold', () => {
    expect(needRows({ gold: 0, resources: { timber: 1 } }, 0, stock({ timber: 1 })).map((r) => r.item)).toEqual(['timber']);
  });

  it('judges the picks together: shared materials are summed, not checked one by one', () => {
    const picks = rankPicks([
      view({ id: 1, gold: 100, res: { timber: 8 } }),
      view({ id: 2, gold: 100, res: { timber: 8 } }),
    ]);
    // each pick alone fits 10 timber; together they need 16
    expect(picksTogether(picks, 500, stock({ timber: 10 }))).toEqual({ totalGold: 200, affordable: false });
    expect(picksTogether(picks, 500, stock({ timber: 16 }))).toEqual({ totalGold: 200, affordable: true });
    expect(picksTogether(picks, 150, stock({ timber: 99 }))).toEqual({ totalGold: 200, affordable: false });
  });
});

// ── the real session ────────────────────────────────────────────────────────

function fresh(id = 'townscreen'): CampaignSession {
  return CampaignSession.create({ campaignId: id, seed: `world_${id}`, party: starterParty() });
}

function wealthy(id = 'townscreen'): CampaignSession {
  const s = fresh(id);
  s.devAddGold(200_000);
  s.grantResources(Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 999])));
  s.grantReputation(100);
  return s;
}

describe('rankPicks against the real town', () => {
  it('a fresh campaign has NO pick: no gold, no materials, no reputation', () => {
    const s = fresh();
    expect(s.goldAmount()).toBe(0);
    const town = s.town();
    expect(rankPicks(town)).toEqual([]);
    expect(gapLine(town, [])).toContain('Nothing is ready to buy yet.');
  });

  it('materials alone surface the Guild Hall — the only upgrade that costs no gold', () => {
    const s = fresh();
    s.grantResources({ timber: 20, stone: 12 });
    const picks = rankPicks(s.town());
    expect(picks.map((p) => p.building.name)).toEqual(['Guild Hall']);
    expect(picks[0]!.building.next.effect).toEqual({ text: 'Send 5 heroes on a mission', wired: true });
  });

  it('a rich guild gets exactly 3 picks, all wired, all unblocked, cheapest first', () => {
    const town = wealthy().town();
    const picks = rankPicks(town);
    expect(picks).toHaveLength(3);
    for (const p of picks) {
      expect(p.building.blocked, p.building.name).toEqual([]);
      expect(p.building.next.effect?.wired, p.building.name).toBe(true);
    }
    const golds = picks.map((p) => p.building.next.cost.gold);
    expect(golds).toEqual([...golds].sort((a, b) => a - b));
  });

  it('skips a cheaper unwired building that WOULD win on cost — the control has teeth', () => {
    const town = wealthy().town();
    const picks = rankPicks(town);
    const last = picks[picks.length - 1]!;
    const lastKey = [last.building.next.cost.gold, resourceUnits(last.building.next.cost), last.building.id] as const;
    const beaten = town.filter((b) => {
      if (b.next === null || b.blocked.length > 0 || b.next.effect?.wired !== false) return false;
      const key = [b.next.cost.gold, resourceUnits(b.next.cost), b.id] as const;
      return key[0] < lastKey[0] || (key[0] === lastKey[0] && (key[1] < lastKey[1] || (key[1] === lastKey[1] && key[2] < lastKey[2])));
    });
    // at least one dead-effect upgrade out-ranks the third pick on price alone…
    expect(beaten.length).toBeGreaterThan(0);
    // …and none of them is recommended.
    for (const b of beaten) expect(picks.map((p) => p.building.id)).not.toContain(b.id);
  });

  it('buying a pick moves the list on: the bought upgrade is replaced by the next one', () => {
    const s = wealthy();
    const before = rankPicks(s.town());
    s.upgradeBuilding(before[0]!.building.id);
    const after = rankPicks(s.town());
    expect(after).toHaveLength(3);
    // the first pick's NEXT level is a different row (or gone): never the same offer twice
    const same = after.find((p) => p.building.id === before[0]!.building.id);
    if (same) expect(same.building.next.level).toBe(before[0]!.building.next.level + 1);
  });
});

describe('what the player reads', () => {
  it('no effect line in the whole town carries a raw effect key', () => {
    const s = wealthy();
    const town = s.town();
    const lines: string[] = [];
    for (const b of town) {
      if (b.current) lines.push(b.current.text);
      if (b.next?.effect) lines.push(b.next.effect.text);
      for (let l = 1; l <= b.maxLevel; l++) {
        const e = effectAt(b.id, l);
        if (e) lines.push(e.text);
      }
    }
    expect(lines.length).toBeGreaterThan(40);
    for (const line of lines) expect(line, line).not.toMatch(/[a-z]_[a-z0-9]/);
  });

  it('every blocked reason is a finished sentence from the sim, ready to print verbatim', () => {
    const town = fresh().town();
    const reasons = town.flatMap((b) => b.blocked);
    expect(reasons.length).toBeGreaterThan(10);
    for (const r of reasons) expect(r.text, r.kind).toMatch(/^[A-Z].*\.$/);
  });
});

describe('the Guild Hall ladder', () => {
  it('reads the party size from the effect KEY, and the sim agrees at every level', () => {
    /**
     * ⚠ This used to parse "(\d+) heroes" out of the player-facing copy, which
     * breaks silently the moment anyone rewords it to "a party of five". It
     * now reads the machine key `party_size_N` — the same strings
     * `maxPartySize()` keys on, so the ladder and the engine cannot disagree.
     */
    const s = wealthy();
    for (let level = 1; level <= 3; level++) {
      if (level > 1) s.upgradeBuilding(1);
      expect(s.buildingLevel(1)).toBe(level);
      expect(partySizeAtLevel(1, level), `level ${level}`).toBe(s.maxPartySize());
    }
    expect(s.maxPartySize()).toBe(6);
  });

  it('a level that is not a party-size rung reports nothing', () => {
    expect(partySizeAtLevel(3, 1)).toBeNull();   // Blacksmith L1 is `weapons`
    expect(partySizeAtLevel(1, 9)).toBeNull();   // no such Guild Hall level
  });
});

describe('recruiting through the same session the screen drives', () => {
  it('hiring is refused while the guild hall is full, and works once it is raised', () => {
    const s = wealthy();
    s.upgradeBuilding(6); // Tavern → common recruits
    expect(s.recruitPool().length).toBeGreaterThan(0);
    expect(s.rosterSize()).toBe(s.maxPartySize());
    expect(() => s.recruitHero(s.recruitPool()[0]!.classId, 'Nope')).toThrow(/guild hall holds/);
    s.upgradeBuilding(1);
    const gold = s.goldAmount();
    const offer = s.recruitPool()[0]!;
    s.recruitHero(offer.classId, 'Wren');
    expect(s.rosterSize()).toBe(5);
    expect(s.goldAmount()).toBe(gold - offer.cost);
  });
});
