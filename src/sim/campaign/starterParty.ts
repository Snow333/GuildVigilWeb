/**
 * The v1 starting roster — four level-1 heroes built from REAL registry rows
 * (classes 1/4/3/2, real item ids, real feat ids). Lifted verbatim from the
 * Phase 1 career-harness fixture so live play and the harness share one wedge;
 * tests/fixtures/party-fixture re-exports from here. Every consumer calls
 * starterParty() fresh: HeroState is mutable and campaigns level it up.
 *
 * Brief #10: the templates and the builder moved to ./muster, because the
 * FOUNDING MUSTER now creates this party from player choices. starterParty()
 * is the same four heroes it always was — the muster's default choices run
 * through the same code path, so harnesses and live play cannot drift.
 */

export { mkHero } from './muster';

import type { HeroKit } from './assembly';
import { DEFAULT_MUSTER, musterParty } from './muster';

/** Fighter / Rogue / Cleric / Wizard — the classic wedge, level 1. */
export function starterParty(): HeroKit[] {
  return musterParty(DEFAULT_MUSTER);
}
