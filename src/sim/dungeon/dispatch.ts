/**
 * runDungeonDispatch — the profile-AI brief (APPROVED) executable: one decision
 * engine, four objective functions, doctrine + hard floor + decision budget +
 * rest charges + impossibility handling. Fully headless; every decision is an
 * event; the whole run is a pure function of its inputs (travel joins in 1.5).
 *
 * Predictability over optimality: routing is shortest-path/nearest-target over
 * the template graph — a competent squad, not a solver.
 */

import { LOOT_GRAMMAR, PROFILES, type DungeonTier } from '@content/dungeon';
import { EventStream } from '@sim/core/events/stream';
import type { ItemInstance } from '@sim/core/events/types';
import { Rng } from '@sim/core/rng';
import { buildEnemy } from '@sim/combat/build';
import { hasCondition } from '@sim/combat/conditions';
import { rollDice } from '@sim/combat/dice';
import { healDying } from '@sim/combat/dying';
import { runEncounter } from '@sim/combat/encounter';
import { rollEnemyLoot, rollLootTable, type LootSource } from '@sim/loot/generate';
import { ambushTier, detectTrap, disarmTrap, openLock, type DispatchHero } from './checks';
import { type DungeonTemplate } from './graph';
import { pickTemplate } from './pool';
import { populate, type PopulatedRoom } from './population';

export type MissionProfile = 'fullExplore' | 'bossRush' | 'mysteryHunt' | 'lootRun';
export type Caution = 'cautious' | 'standard' | 'bold';

const TICKS = { edge: 10, passThrough: 2, checks: 5, rest: 50 } as const;

export interface DungeonDispatchOptions {
  dispatchId: string;
  partyId: string;
  party: DispatchHero[];
  tier: DungeonTier;
  seed: string;
  profile: MissionProfile;
  caution: Caution;
  difficulty: number;
  partyLevel: number;
  questId?: string;
  regionId?: string;
  templateId?: string;
  /** Authored boss-room roster (brief #6): the quest pins its climax fight. */
  bossRoster?: readonly number[];
  /** Trap Finder party bonus (wired from feats by the 1.5 assembly). */
  autoDetectTraps?: boolean;
}

export interface DungeonDispatchResult {
  outcome: 'completed' | 'retreated' | 'wiped';
  retreatReason?: string;
  stream: EventStream;
  gold: number;
  items: ItemInstance[];
  decisionsUsed: number;
  ticks: number;
  roomsVisited: number;
  bossDefeated: boolean;
  clueSecured: boolean;
  /** Content IDs of enemies that DIED (not fled) — the campaign's monster-XP manifest. */
  killedEnemyIds: number[];
}

export function runDungeonDispatch(opts: DungeonDispatchOptions): DungeonDispatchResult {
  const rng = new Rng(`dispatch_${opts.dispatchId}`);
  const template: DungeonTemplate = opts.templateId
    ? (() => {
        const t = pickTemplate(opts.tier, opts.seed);
        return t.templateId === opts.templateId ? t : t; // explicit ids resolve via pool in 1.5 glue
      })()
    : pickTemplate(opts.tier, opts.seed);
  const pop = populate(template, opts.seed, opts.difficulty, opts.partyLevel, opts.bossRoster);
  const stream = new EventStream('dispatch', opts.dispatchId);
  const regionId = opts.regionId ?? 'region_unknown';

  let tick = 0;
  let decisions = 0;
  let gold = 0;
  const items: ItemInstance[] = [];
  let clueSecured = false;
  let bossDead = false;
  const killedEnemyIds: number[] = [];
  const visited = new Set<number>();
  const blocked = new Set<number>();
  const restAvailable = new Set<number>();
  let current = 0;
  let outcome: DungeonDispatchResult['outcome'] | null = null;
  let retreatReason: string | undefined;

  const active = () => opts.party.filter((h) => h.c.hp > 0 && !h.c.conditions.has('unconscious'));
  const partyHpFrac = () =>
    opts.party.reduce((s, h) => s + (h.c.conditions.has('dying') ? 0 : h.c.hp / h.c.maxHp), 0) / opts.party.length;

  stream.emit(tick, 'dispatch.started', {
    dispatchId: opts.dispatchId, partyId: opts.partyId,
    ...(opts.questId ? { questId: opts.questId } : {}),
    profile: opts.profile, caution: opts.caution,
  });
  const enterEv = stream.emit(tick, 'dispatch.dungeon_entered', {
    dungeonId: `dg_${opts.dispatchId}`, templateId: template.templateId, seed: opts.seed,
  });

  const roomId = (n: number) => `${template.templateId}:r${n}`;
  const edgeId = (a: number, b: number) => `${template.templateId}:c${Math.min(a, b)}_${Math.max(a, b)}`;

  /** BFS shortest path avoiding blocked nodes; null if unreachable. */
  const pathTo = (from: number, to: number): number[] | null => {
    if (from === to) return [];
    const prev = new Map<number, number>();
    const queue = [from];
    const seen = new Set([from]);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const nb of template.nodes[cur]!.adj) {
        if (seen.has(nb) || blocked.has(nb)) continue;
        seen.add(nb);
        prev.set(nb, cur);
        if (nb === to) {
          const path: number[] = [to];
          let p = to;
          while (prev.has(p)) {
            p = prev.get(p)!;
            if (p !== from) path.unshift(p);
          }
          return path;
        }
        queue.push(nb);
      }
    }
    return null;
  };

  const nearestWhere = (pred: (r: PopulatedRoom) => boolean): number | null => {
    let best: { n: number; len: number } | null = null;
    for (const [n, room] of pop.rooms) {
      if (visited.has(n) || blocked.has(n) || !pred(room)) continue;
      const p = pathTo(current, n);
      if (!p) continue;
      if (!best || p.length < best.len || (p.length === best.len && n < best.n)) best = { n, len: p.length };
    }
    return best?.n ?? null;
  };

  const lootValueTarget = PROFILES.lootRunValueTarget(opts.difficulty);
  const valueCollected = () => gold + items.length * 40; // coarse value proxy; derives fully in 1.5 pricing

  const objectiveComplete = (): boolean => {
    switch (opts.profile) {
      case 'bossRush': return bossDead;
      case 'mysteryHunt': return clueSecured;
      case 'lootRun': return valueCollected() >= lootValueTarget;
      case 'fullExplore':
        return [...pop.rooms.keys()].every((n) => visited.has(n) || blocked.has(n));
    }
  };

  const pickTargetNode = (): number | null => {
    switch (opts.profile) {
      case 'bossRush':
        return nearestWhere((r) => r.type === 'boss');
      case 'mysteryHunt':
        return nearestWhere((r) => r.hasClue) ?? nearestWhere(() => true);
      case 'lootRun': {
        const priority = ['vault', 'treasure', 'boss', 'combat'];
        for (const p of priority) {
          const n = nearestWhere((r) => r.type === p);
          if (n !== null) return n;
        }
        return nearestWhere(() => true);
      }
      case 'fullExplore':
        return nearestWhere(() => true);
    }
  };

  /** Resolve one NEW room: checks → contents. Returns false when the run must stop. */
  const enterRoom = (n: number, viaEdge: string): boolean => {
    const room = pop.rooms.get(n)!;
    tick += TICKS.edge;
    stream.emit(tick, 'explore.entry_check_started', { edgeId: viaEdge });

    if (room.lock) {
      tick += TICKS.checks;
      const res = openLock(opts.party, room.lock, viaEdge, stream, tick, rng);
      if (!res.ok) {
        stream.emit(tick, 'explore.route_blocked', { edgeId: viaEdge, reason: 'impossibleDc' });
        blocked.add(n);
        return true; // blocked, not fatal — reroute
      }
    }

    if (room.trap) {
      tick += TICKS.checks;
      const detected = detectTrap(opts.party, room.trap, roomId(n), `${roomId(n)}:trap`, stream, tick, rng, opts.autoDetectTraps ?? false);
      let fires = !detected;
      if (detected) {
        const res = disarmTrap(opts.party, room.trap, `${roomId(n)}:trap`, stream, tick, rng);
        fires = res.triggered;
        if (!res.ok && !res.triggered) fires = false; // impossible to disarm but known: edge past it carefully
      }
      if (fires) {
        const trapEv = stream.emit(tick, 'explore.trap_triggered', { trapId: `${roomId(n)}:trap`, trapKind: 'damage' });
        const victims = active();
        if (victims.length > 0) {
          const victim = rng.pick(victims).c;
          const dmg = Math.max(rollDice(rng, `${Math.max(opts.difficulty, 1)}d6`), 1);
          victim.hp = Math.max(victim.hp - dmg, 0);
          stream.emit(tick, 'combat.damage_applied', { targetId: victim.id, amount: dmg, kind: 'trap', hpAfter: victim.hp }, trapEv.seq);
        }
      }
    }

    visited.add(n);
    stream.emit(tick, 'explore.room_entered', { roomId: roomId(n), roomType: room.type }, enterEv.seq);
    stream.emit(tick, 'explore.area_revealed', {
      roomIds: [roomId(n)],
      corridorIds: template.nodes[n]!.adj.map((nb) => edgeId(n, nb)),
    });

    // Contents.
    if (room.type === 'combat' || room.type === 'boss') {
      const heroes = active().map((h) => h.c);
      const enemies = room.enemyIds.map((id, i) => buildEnemy(id, `${opts.dispatchId}:r${n}e${i}`));
      const detectDc = 12 + opts.difficulty * 2;
      const ambush = ambushTier(opts.party, detectDc, rng);
      stream.emit(tick, 'explore.ambush_resolved', { roomId: roomId(n), tier: ambush });
      const combat = runEncounter(`${opts.dispatchId}:f${n}`, roomId(n), heroes, enemies, `combat_${opts.dispatchId}_r${n}`);
      stream.absorb(combat.stream, tick);
      tick += combat.ticks;
      const died = new Set(combat.stream.byType('combat.unit_died').map((e) => e.data.unitId));
      room.enemyIds.forEach((id, i) => {
        if (died.has(enemies[i]!.id)) killedEnemyIds.push(id);
      });
      if (combat.result === 'defeat') {
        outcome = active().length === 0 && opts.party.every((h) => h.c.hp <= 0 || h.c.conditions.has('dying') || h.c.conditions.has('unconscious'))
          ? 'wiped' : 'retreated';
        if (outcome === 'retreated') retreatReason = 'hardFloor';
        return false;
      }
      if (combat.result === 'stalemate') {
        outcome = 'retreated';
        retreatReason = 'doctrine';
        return false;
      }
      // Victory: stabilize the downed (post-fight aid, wounded still ratchets).
      for (const h of opts.party) if (hasCondition(h.c, 'dying')) healDying(h.c, 1);
      stream.emit(tick, 'explore.room_cleared', { roomId: roomId(n) });
      const src: LootSource = room.type === 'boss' ? 'boss' : 'enemy';
      room.enemyIds.forEach((id, i) => {
        const lootEv = stream.emit(tick, 'loot.rolled', { sourceKind: src, sourceId: `${opts.dispatchId}:r${n}e${i}`, tableId: 'enemy' });
        const drop = rollEnemyLoot(
          { base_level: buildEnemy(id, 'x').level, loot_table_id: lootTableOf(id) },
          src, opts.difficulty, `loot_${opts.dispatchId}_r${n}e${i}`, rng,
        );
        gold += drop.gold;
        for (const item of drop.items) {
          items.push(item);
          stream.emit(tick, 'loot.item_generated', { item }, lootEv.seq);
        }
      });
      if (room.type === 'boss') {
        bossDead = true;
        restAvailable.add(n);
      }
    } else if (room.type === 'treasure' || room.type === 'vault') {
      const src: LootSource = room.type === 'vault' ? 'vault' : 'treasure';
      const g = room.type === 'vault' ? LOOT_GRAMMAR.vaultGold(opts.difficulty) : LOOT_GRAMMAR.treasureGold(opts.difficulty);
      const found = rng.int(g.min, g.max);
      gold += found;
      stream.emit(tick, 'explore.cache_looted', { roomId: roomId(n), gold: found });
      const rolls = room.type === 'vault' ? 2 : 1;
      // Frozen-schema note: treasure rooms report as 'cache' (the schema's union);
      // the grammar's tier table still uses the richer internal source.
      const eventKind = room.type === 'vault' ? 'vault' : 'cache';
      for (let i = 0; i < rolls; i++) {
        const lootEv = stream.emit(tick, 'loot.rolled', { sourceKind: eventKind, sourceId: roomId(n), tableId: 'room' });
        for (const item of rollLootTable(roomLootTable(opts.difficulty), src, opts.difficulty, `loot_${opts.dispatchId}_r${n}_${i}`, rng)) {
          items.push(item);
          stream.emit(tick, 'loot.item_generated', { item }, lootEv.seq);
        }
      }
    } else if (room.type === 'lore') {
      if (room.hasClue) {
        clueSecured = true;
        stream.emit(tick, 'explore.clue_found', { roomId: roomId(n), clueId: `clue_${opts.dispatchId}`, arcId: 'arc_unassigned' });
      }
    } else if (room.type === 'shrine') {
      restAvailable.add(n);
      stream.emit(tick, 'explore.shrine_activated', { roomId: roomId(n) });
    } else if (room.hasClue) {
      clueSecured = true;
      stream.emit(tick, 'explore.clue_found', { roomId: roomId(n), clueId: `clue_${opts.dispatchId}`, arcId: 'arc_unassigned' });
    }
    return true;
  };

  // ── The decision loop ──────────────────────────────────────────────────────
  visited.add(0);
  stream.emit(tick, 'explore.room_entered', { roomId: roomId(0), roomType: 'entrance' }, enterEv.seq);

  while (outcome === null) {
    decisions++;
    if (decisions > PROFILES.decisionBudget) {
      outcome = 'retreated';
      retreatReason = 'decisionBudget';
      break;
    }

    // Doctrine: hard floor → wiped/withdraw; thresholds → rest or retreat.
    const alive = active();
    if (alive.length === 0) {
      outcome = 'wiped';
      break;
    }
    if (opts.party.length > 1 && alive.length === 1) {
      outcome = 'retreated';
      retreatReason = 'hardFloor';
      break;
    }
    const caution = PROFILES.caution[opts.caution]!;
    const frac = partyHpFrac();
    if (frac < caution.withdrawHpFrac) {
      if (restAvailable.has(current)) {
        restAvailable.delete(current);
        tick += TICKS.rest;
        for (const h of opts.party) {
          if (hasCondition(h.c, 'dying')) healDying(h.c, 1);
          h.c.hp = Math.min(h.c.hp + Math.floor(h.c.maxHp * PROFILES.restHealFrac), h.c.maxHp);
        }
        stream.emit(tick, 'explore.rested', { locationId: roomId(current), package: 'short' });
        continue;
      }
      outcome = 'retreated';
      retreatReason = 'doctrine';
      break;
    }

    if (objectiveComplete()) {
      outcome = 'completed';
      break;
    }

    const target = pickTargetNode();
    if (target === null) {
      // Objective unreachable or nothing left to visit.
      outcome = objectiveComplete() ? 'completed' : 'retreated';
      if (outcome === 'retreated') retreatReason = 'objectiveFailed';
      break;
    }

    const path = pathTo(current, target);
    if (!path) {
      blocked.add(target);
      continue;
    }
    let stopped = false;
    for (const step of path) {
      if (visited.has(step)) {
        tick += TICKS.passThrough;
        current = step;
        continue;
      }
      const ok = enterRoom(step, edgeId(current, step));
      if (!blocked.has(step)) current = step;
      if (!ok) {
        stopped = true;
        break;
      }
      if (blocked.has(step)) break; // locked out — pick a new target
    }
    if (stopped) break;
  }

  // ── Exit ───────────────────────────────────────────────────────────────────
  tick += TICKS.edge;
  stream.emit(tick, 'dispatch.dungeon_exited', { dungeonId: `dg_${opts.dispatchId}` });
  stream.emit(tick, 'loot.collected', { items, gold });
  if (outcome === 'completed') {
    stream.emit(tick, 'dispatch.completed', { outcome: 'success' });
  } else if (outcome === 'retreated') {
    stream.emit(tick, 'dispatch.retreated', {
      reason: (retreatReason ?? 'doctrine') as 'doctrine' | 'hardFloor' | 'objectiveFailed' | 'decisionBudget' | 'playerRecall',
    });
  } else {
    stream.emit(tick, 'dispatch.wiped', { regionId });
  }

  return {
    outcome: outcome!,
    ...(retreatReason !== undefined ? { retreatReason } : {}),
    stream,
    gold,
    items,
    decisionsUsed: decisions,
    ticks: tick,
    roomsVisited: visited.size,
    bossDefeated: bossDead,
    clueSecured,
    killedEnemyIds,
  };
}

// ── Registry lookups kept local to avoid widening the module graph ───────────

import { enemiesById } from '@sim/registry';

function lootTableOf(enemyId: number): number | null {
  return (enemiesById.get(enemyId)?.loot_table_id as number | null) ?? null;
}

/** Room loot draws from the tier-appropriate general tables (1–3 by difficulty). */
function roomLootTable(difficulty: number): number {
  return Math.min(Math.max(Math.ceil(difficulty / 2), 1), 3);
}
