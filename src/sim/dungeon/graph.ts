/**
 * Graph-first dungeon (decision-ledger Area 3): the sim's dungeon is nodes and
 * edges; geometry is presentation's problem. Layout generation is a TOOL
 * (offline, curated pool); this module holds the model, the generator the tool
 * runs, and the invariants that validate every shipped template.
 *
 * Ported graph logic: Kruskal spanning tree over a lattice + ~35% loop edges,
 * boss placed far from the entrance (BFS depth), vaults/lore on deep nodes.
 */

import { DUNGEON_TIERS, type DungeonTier } from '@content/dungeon';
import { Rng } from '@sim/core/rng';

export type PresetRoomType = 'entrance' | 'boss' | 'vault' | 'lore' | 'open';

export interface TemplateNode {
  /** Index within the template; room id = `${templateId}:r${n}`. */
  n: number;
  preset: PresetRoomType;
  /** Neighbor node indices (undirected). */
  adj: number[];
}

export interface DungeonTemplate {
  templateId: string;
  tier: DungeonTier;
  seed: string;
  nodes: TemplateNode[];
  /** Edge list [a, b] with a < b; edge id = `${templateId}:c${i}`. */
  edges: [number, number][];
}

/** Lattice adjacency for `count` nodes arranged in rows of `width`. */
function latticeEdges(count: number, width: number): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    if ((i + 1) % width !== 0 && i + 1 < count) edges.push([i, i + 1]);
    if (i + width < count) edges.push([i, i + width]);
  }
  return edges;
}

class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]!]!;
      x = this.parent[x]!;
    }
    return x;
  }
  union(a: number, b: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    this.parent[ra] = rb;
    return true;
  }
}

/** BFS depths from node 0 over an adjacency list. */
export function bfsDepths(nodes: TemplateNode[]): number[] {
  const depth = new Array<number>(nodes.length).fill(-1);
  depth[0] = 0;
  const queue = [0];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const nb of nodes[cur]!.adj) {
      if (depth[nb] === -1) {
        depth[nb] = depth[cur]! + 1;
        queue.push(nb);
      }
    }
  }
  return depth;
}

/** Generate one layout. Deterministic by (seed, tier) — the pool tool curates outputs. */
export function generateLayout(seed: string, tier: DungeonTier): DungeonTemplate {
  const cfg = DUNGEON_TIERS[tier];
  const rng = new Rng(`layout_${seed}_${tier}`);
  const width = Math.ceil(Math.sqrt(cfg.rooms));
  const candidates = rng.shuffle(latticeEdges(cfg.rooms, width));

  // Kruskal spanning tree; rejected edges are loop candidates (~35% return).
  const uf = new UnionFind(cfg.rooms);
  const chosen: [number, number][] = [];
  const rejected: [number, number][] = [];
  for (const e of candidates) {
    if (uf.union(e[0], e[1])) chosen.push(e);
    else rejected.push(e);
  }
  for (const e of rejected) {
    if (rng.chance(cfg.extraEdgeRatio)) chosen.push(e);
  }

  const nodes: TemplateNode[] = Array.from({ length: cfg.rooms }, (_, n) => ({ n, preset: 'open', adj: [] }));
  for (const [a, b] of chosen) {
    nodes[a]!.adj.push(b);
    nodes[b]!.adj.push(a);
  }
  for (const node of nodes) node.adj.sort((x, y) => x - y);

  // Presets: entrance at 0; boss at max depth; vaults/lore on the deepest remaining nodes.
  nodes[0]!.preset = 'entrance';
  const depths = bfsDepths(nodes);
  const byDepth = nodes
    .map((node) => ({ n: node.n, d: depths[node.n]! }))
    .filter((x) => x.n !== 0)
    .sort((a, b) => b.d - a.d || a.n - b.n);
  nodes[byDepth[0]!.n]!.preset = 'boss';
  let cursor = 1;
  for (let v = 0; v < cfg.vaults && cursor < byDepth.length; v++, cursor++) {
    nodes[byDepth[cursor]!.n]!.preset = 'vault';
  }
  for (let l = 0; l < cfg.loreRooms && cursor < byDepth.length; l++, cursor++) {
    nodes[byDepth[cursor]!.n]!.preset = 'lore';
  }

  const edges = chosen
    .map(([a, b]) => (a < b ? [a, b] : [b, a]) as [number, number])
    .sort((x, y) => x[0] - y[0] || x[1] - y[1]);

  return { templateId: `t_${tier}_${seed}`, tier, seed, nodes, edges };
}

/** The build-time invariants every shipped template must satisfy. */
export function validateTemplate(t: DungeonTemplate): string[] {
  const problems: string[] = [];
  const cfg = DUNGEON_TIERS[t.tier];
  if (t.nodes.length !== cfg.rooms) problems.push(`room count ${t.nodes.length} ≠ ${cfg.rooms}`);
  const depths = bfsDepths(t.nodes);
  if (depths.some((d) => d === -1)) problems.push('disconnected node(s)');
  const count = (p: PresetRoomType) => t.nodes.filter((n) => n.preset === p).length;
  if (count('entrance') !== 1 || t.nodes[0]!.preset !== 'entrance') problems.push('entrance must be node 0, exactly one');
  if (count('boss') !== 1) problems.push('exactly one boss required');
  if (count('vault') !== cfg.vaults) problems.push(`vaults ${count('vault')} ≠ ${cfg.vaults}`);
  if (count('lore') !== cfg.loreRooms) problems.push(`lore ${count('lore')} ≠ ${cfg.loreRooms}`);
  const bossNode = t.nodes.find((n) => n.preset === 'boss')!;
  const maxDepth = Math.max(...depths);
  if (depths[bossNode.n]! < Math.max(2, Math.floor(maxDepth * 0.6))) problems.push('boss too close to entrance');
  return problems;
}
