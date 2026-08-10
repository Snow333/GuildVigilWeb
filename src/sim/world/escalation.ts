/**
 * World pressure / escalation — brief #2 (APPROVED) executable.
 * An append-only ledger of player-caused FACTS; score and tier derive purely
 * (weights live in the registry, never on the entry). Relief by player action
 * only — time never heals. Haven's region caps below Overrun. Hysteresis
 * prevents tier flapping. Villain-beat triggers fire once per upward crossing
 * (arc content binds to them in the content workstream).
 */

import { ESCALATION } from '@content/world';

export interface EscalationFact {
  week: number;
  regionId: string;
  kind: keyof typeof ESCALATION.weights | string;
  refId: string;
}

export interface RegionPressure {
  regionId: string;
  score: number;
  tier: number;
  tierName: string;
}

export class EscalationLedger {
  private facts: EscalationFact[] = [];
  /** Last derived tier per region (hysteresis + crossing detection). */
  private lastTier = new Map<string, number>();

  append(fact: EscalationFact): { crossedUpTo: number[] } {
    this.facts.push(fact);
    const before = this.lastTier.get(fact.regionId) ?? 0;
    const after = this.pressureFor(fact.regionId).tier;
    this.lastTier.set(fact.regionId, after);
    const crossings: number[] = [];
    for (let t = before + 1; t <= after; t++) crossings.push(t); // one beat per crossing, in order
    return { crossedUpTo: crossings };
  }

  all(): readonly EscalationFact[] {
    return this.facts;
  }

  /** Pure derivation: same ledger → same tiers, always. */
  pressureFor(regionId: string): RegionPressure {
    let score = 0;
    for (const f of this.facts) {
      if (f.regionId !== regionId) continue;
      score += ESCALATION.weights[f.kind] ?? 0;
    }
    score = Math.max(score, 0);

    let tier = 0;
    for (const t of ESCALATION.tiers) {
      if (score >= t.min) tier = t.tier;
    }
    // Hysteresis: dropping a tier requires falling below (threshold − margin).
    const prev = this.lastTier.get(regionId) ?? 0;
    if (tier < prev) {
      const prevDef = ESCALATION.tiers.find((t) => t.tier === prev)!;
      if (score >= prevDef.min - ESCALATION.hysteresis) tier = prev;
    }
    // Haven's home region cannot reach Overrun (no unwinnable spiral).
    if (regionId === 'region_haven' && tier > ESCALATION.havenRegionCapTier) {
      tier = ESCALATION.havenRegionCapTier;
    }
    return { regionId, score, tier, tierName: ESCALATION.tiers.find((t) => t.tier === tier)!.name };
  }

  effectsFor(regionId: string): (typeof ESCALATION.effects)[number] {
    return ESCALATION.effects[this.pressureFor(regionId).tier]!;
  }

  /** Persistence shape — the one sanctioned history (constraint 7 exception). */
  serialize(): { facts: EscalationFact[]; lastTier: [string, number][] } {
    return { facts: [...this.facts], lastTier: [...this.lastTier.entries()] };
  }

  static deserialize(data: { facts: EscalationFact[]; lastTier: [string, number][] }): EscalationLedger {
    const l = new EscalationLedger();
    l.facts = [...data.facts];
    l.lastTier = new Map(data.lastTier);
    return l;
  }
}
