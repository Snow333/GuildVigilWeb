/**
 * The band screen (M4) — the pure half. EVERY DECISION THE SCREEN MAKES LIVES HERE.
 *
 * Steven chose variant B (the job-by-band grid) and said C is coming:
 * "we probably need to migrate to C eventually". C is the same decisions in a
 * different arrangement (a panel per band, each with its own ranked job list).
 * So nothing in this file knows what a table is. A C component calls
 * `readBands(session)` and renders what comes back; it never re-derives:
 *
 *   - which job is a band's BEST FIT           (`bestFits`, `rankJobs`)
 *   - how a band reads a job                   (`BandCell.word`, verbatim from `board(i)`)
 *   - whether a band can be sent, and why not  (`BandCell.kind`, `BandCell.canSend`)
 *   - the hall hints "stays 7" / "7 → 6"       (`levelHint`, `HallHero.moves`)
 *   - which roster moves are legal             (`moveOk`, `rosterColumns`)
 *   - how wide each column is                  (`columnWidths`)
 *
 * ⚠ NOTHING HERE RE-DERIVES A SIM RULE. Difficulty words and reasons arrive on
 * `board(i)`; a band's level arrives from `partyLevel(i)`; what a move WOULD do
 * to a level arrives from `partyLevelIf`. This file only reads, ranks, groups
 * and decides what to offer. Reads only — it never calls a mutator (the
 * mutations are in `bandActions.ts`).
 */

import type { BoardEntry, CampaignSession, ForecastResult, RosterEntry } from '@sim/campaign/session';
import type { DifficultyBand } from '@sim/campaign/difficulty';

/**
 * Most bands the Barracks can ever support. The sim derives the live count
 * (`partyCount()`); this is only the ceiling the "locked" teaser is drawn
 * against. Pinned to the sim by tests/ui/bandPicks.test.ts, so it cannot drift.
 */
export const MAX_BANDS = 3;

/** The part of the session this module reads. A fake with these methods is a legal source. */
export type BandSource = Pick<
  CampaignSession,
  | 'partyRosters' | 'unassignedHeroes' | 'partyCount' | 'maxPartySize' | 'heroCapacity'
  | 'partyLevel' | 'partyLevelIf' | 'activeByParty' | 'board'
  | 'roster' | 'heroSheet' | 'questName' | 'regionName' | 'currentWeek' | 'goldAmount'
>;

export const bandName = (index: number): string => `Band ${index + 1}`;

/** First word of a hero's name, for a crowded one-line band summary ("Aldric Vane" → "Aldric"). */
export const shortName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

// ── the shapes ──────────────────────────────────────────────────────────────

export interface HeroLite {
  id: string;
  name: string;
  level: number;
  /** "Fighter", or "Fighter / Wizard" for a multiclass. */
  className: string;
  ancestryName: string;
  portraitKey: string;
  status: RosterEntry['status'];
  /** Wounded count from the sim; 0 = healthy. Always shown as a number. */
  wounded: number;
}

export interface OutJob {
  questId: number;
  questName: string;
  regionName: string;
}

export interface BandView {
  index: number;
  name: string;
  heroes: HeroLite[];
  /** The band's own level; null for an EMPTY band (the sim reads 1, which is not a level anyone has). */
  level: number | null;
  size: number;
  /** How many may march in one band (Guild Hall). */
  capacity: number;
  empty: boolean;
  full: boolean;
  /** The job this band holds, or null. A band with a job is locked: it cannot be reshuffled. */
  out: OutJob | null;
  /** Free slots to draw as empty boxes. */
  freeSlots: number;
}

/**
 * What one band can do with one posting.
 *   send   — a live Send button
 *   out    — this band holds another job
 *   empty  — nobody in the band, so there is nothing to send (the sim refuses)
 *   mine   — this band holds THIS job
 *   taken  — another band holds this job
 */
export type CellKind = 'send' | 'out' | 'empty' | 'mine' | 'taken';

export interface BandCell {
  band: number;
  questId: number;
  kind: CellKind;
  /** For `taken`: the band index that holds the job. */
  takenBy: number | null;
  /** This band's OWN reading, verbatim from `board(band)`. null unless kind === 'send'. */
  word: DifficultyBand | null;
  /** The one job this band should take. At most one per band, never shared between bands. */
  best: boolean;
  /** Beyond us: still sendable, but the screen warns. */
  risky: boolean;
  /** The ONLY test the screen may use to decide whether to draw a Send button. */
  canSend: boolean;
}

export interface JobRow {
  questId: number;
  name: string;
  regionName: string;
  /** null on a held job: the sim keeps no posting detail once a band takes it. */
  challenge: number | null;
  rewardGold: number | null;
  rewardXp: number | null;
  expiresWeek: number | null;
  commission: boolean;
  /** Index of the band holding this job, or null while it is still on the board. */
  heldBy: number | null;
  cells: BandCell[];
}

export interface Move {
  /** Target band index, or null = the guild hall. */
  to: number | null;
  ok: boolean;
  /** Why not, in plain words, when !ok. (A refusal the sim actually throws is shown verbatim by the screen.) */
  why: string | null;
  /** The target band's level now (null for the hall or an empty band) and after the move (null for the hall). */
  levelNow: number | null;
  levelAfter: number | null;
  /** "stays 7" · "7 → 6" · "starts at 5" · "" for the hall. */
  hint: string;
}

export interface HallHero extends HeroLite {
  moves: Move[];
}

export interface RosterEntryView {
  hero: HeroLite;
  moves: Move[];
}

export interface RosterColumn {
  /** Band index, or null for "At the hall". */
  band: number | null;
  title: string;
  level: number | null;
  /** True when the band is out: its heroes get a "locked" tag and NO move buttons. */
  locked: boolean;
  entries: RosterEntryView[];
}

export interface Plates {
  week: number;
  gold: number;
  heroes: number;
  /** Barracks beds. */
  beds: number;
  bands: number;
  bandsMax: number;
  /** Heroes per band (Guild Hall). */
  march: number;
}

export interface BandsView {
  plates: Plates;
  bands: BandView[];
  jobs: JobRow[];
  /** How many jobs are still on the board (held jobs are rows too, but they are not posted). */
  postedCount: number;
  hall: HallHero[];
  /** The roster editor: one column per band, then the hall. Each hero carries only the moves that are legal. */
  roster: RosterColumn[];
  /** Per band: the questId of its best fit, or null. */
  bestByBand: (number | null)[];
  /** Index of the next band the Barracks has not unlocked yet, or null at the ceiling. */
  nextLocked: number | null;
}

// ── ranking ─────────────────────────────────────────────────────────────────

/** Is a reading one a band should avoid? (`Beyond us`, the sim's tier 3.) */
export const isBeyond = (word: DifficultyBand): boolean => word.tier === 3;

/**
 * Order a band's own reading of the board, best first. THE RULE:
 *   1. jobs that are not "Beyond us", Routine/Measured first, then Dangerous
 *   2. inside a group: most XP, then higher challenge, then lower quest id
 *   3. "Beyond us" jobs last, easiest first
 * Reads the band's own `difficulty.tier`; computes no difficulty. Does not mutate.
 */
export function rankJobs(readings: readonly BoardEntry[]): BoardEntry[] {
  const byXp = (a: BoardEntry, b: BoardEntry): number =>
    b.rewardXp - a.rewardXp || b.challenge - a.challenge || a.questId - b.questId;
  const safe = readings.filter((e) => e.difficulty.tier <= 1).sort(byXp);
  const risky = readings.filter((e) => e.difficulty.tier === 2).sort(byXp);
  const beyond = readings
    .filter((e) => isBeyond(e.difficulty))
    .sort((a, b) => a.challenge - b.challenge || a.questId - b.questId);
  return [...safe, ...risky, ...beyond];
}

/**
 * ONE best fit per band, never the same job for two bands.
 *
 * `perBand[i]` is band i's own reading of the open board, or null when band i
 * cannot take a job (empty, or out). A band with nothing short of "Beyond us"
 * gets null — a best fit that is a funeral is not a best fit. Band 1 chooses
 * first; a later band skips whatever an earlier one already claimed.
 */
export function bestFits(perBand: readonly (readonly BoardEntry[] | null)[]): (number | null)[] {
  const claimed: number[] = [];
  return perBand.map((readings) => {
    if (readings === null) return null;
    const pick = rankJobs(readings).find((e) => !isBeyond(e.difficulty) && !claimed.includes(e.questId));
    if (!pick) return null;
    claimed.push(pick.questId);
    return pick.questId;
  });
}

// ── the hall hints ──────────────────────────────────────────────────────────

/**
 * "stays 7", "7 → 6", or — for a band with nobody in it — "starts at 5".
 * Both numbers come from the sim (`partyLevel`, `partyLevelIf`); this only
 * words them. An empty band has no level of its own, so it is never "1 → 5".
 */
export function levelHint(now: number | null, after: number): string {
  if (now === null) return `starts at ${after}`;
  return now === after ? `stays ${now}` : `${now} → ${after}`;
}

// ── moves ───────────────────────────────────────────────────────────────────

/**
 * May a hero move from `from` into `to`? (`null` is the hall, on either side.)
 *   - a hero in a band that is OUT cannot leave it
 *   - a band that is OUT cannot take anyone
 *   - a band at the Guild Hall's cap cannot take another
 * These mirror what `assignHero` refuses, so the screen never offers a move
 * the sim will throw on. They are the screen's guard, not a second rulebook:
 * if the sim ever refuses something this allows, the sim's own message is
 * shown verbatim.
 */
export function moveOk(
  bands: readonly BandView[],
  from: number | null,
  to: number | null,
): { ok: boolean; why: string | null } {
  if (from !== null && bands[from]?.out) return { ok: false, why: `${bandName(from)} is out on a job` };
  if (to === null) return { ok: true, why: null };
  const target = bands[to];
  if (!target) return { ok: false, why: `${bandName(to)} is not unlocked` };
  if (target.out) return { ok: false, why: `${bandName(to)} is out on a job` };
  if (from !== to && target.full) return { ok: false, why: `${bandName(to)} is full (${target.capacity})` };
  return { ok: true, why: null };
}

function movesFor(
  src: BandSource,
  bands: readonly BandView[],
  heroId: string,
  from: number | null,
): Move[] {
  const moves: Move[] = [];
  const targets: (number | null)[] = bands.map((b) => b.index).filter((i) => i !== from);
  if (from !== null) targets.push(null);
  for (const to of targets) {
    const { ok, why } = moveOk(bands, from, to);
    if (to === null) {
      moves.push({ to, ok, why, levelNow: null, levelAfter: null, hint: '' });
      continue;
    }
    const levelNow = bands[to]!.level;
    const levelAfter = src.partyLevelIf(heroId, to);
    moves.push({ to, ok, why, levelNow, levelAfter, hint: levelHint(levelNow, levelAfter) });
  }
  return moves;
}

// ── the view ────────────────────────────────────────────────────────────────

/**
 * Column widths, as percentages, for the job column, each band column and the
 * "locked" teaser column. They FOLLOW THE BAND COUNT: pinned at 25/31.5/31.5/12
 * a third band inherited the 12% reserved for the teaser and its cells wrapped
 * to three lines. Derived, two bands still come out at 31.5%.
 */
export function columnWidths(bandCount: number): { job: number; band: number; locked: number } {
  const job = 25;
  const locked = bandCount < MAX_BANDS ? 12 : 0;
  return { job, band: (100 - job - locked) / Math.max(bandCount, 1), locked };
}

/** The key a cached forecast is stored under. Changes when the band's heroes change, so a stale forecast never shows. */
export function oddsKey(view: BandsView, bandIndex: number, questId: number): string {
  const ids = view.bands[bandIndex]?.heroes.map((h) => h.id).sort().join(',') ?? '';
  return `${questId}|${bandIndex}|${ids}`;
}

/** "Wins 17 of 20 · no wipes" / "Wins 11 of 20 · wiped 3". `bad` = there were wipes, for red ink. */
export function oddsLine(f: Pick<ForecastResult, 'n' | 'completed' | 'wiped'>): { text: string; bad: boolean } {
  return {
    text: `Wins ${f.completed} of ${f.n} · ${f.wiped > 0 ? `wiped ${f.wiped}` : 'no wipes'}`,
    bad: f.wiped > 0,
  };
}

/**
 * Read the whole screen out of the session in one go. This is the single entry
 * point a variant-C component needs. Calls no mutator.
 */
export function readBands(src: BandSource): BandsView {
  const rosters = src.partyRosters();
  const active = src.activeByParty();
  const capacity = src.maxPartySize();
  const rosterById = new Map(src.roster().map((r) => [r.id, r]));

  const lite = (id: string): HeroLite => {
    const r = rosterById.get(id);
    if (!r) throw new Error(`readBands: roster has no hero ${id}`);
    return {
      id: r.id,
      name: r.name,
      level: r.level,
      className: src.heroSheet(id).classes.map((c) => c.name).join(' / '),
      ancestryName: r.ancestryName,
      portraitKey: r.portraitKey,
      status: r.status,
      wounded: r.wounded,
    };
  };

  const bands: BandView[] = rosters.map((ids, index) => {
    const heroes = ids.map(lite);
    const job = active[index] ?? null;
    return {
      index,
      name: bandName(index),
      heroes,
      level: heroes.length === 0 ? null : src.partyLevel(index),
      size: heroes.length,
      capacity,
      empty: heroes.length === 0,
      full: heroes.length >= capacity,
      out: job ? { questId: job.questId, questName: src.questName(job.questId), regionName: src.regionName(job.regionId) } : null,
      freeSlots: Math.max(capacity - heroes.length, 0),
    };
  });

  // The shared posting detail (name, pay, expiry) is the same for every band; only
  // the difficulty reading differs. The no-argument board is the guild's reach.
  const open = src.board();
  // Each band's OWN reading — only for a band that could take a job. An empty
  // band would read every job against level 1, a number nobody has.
  const readings: (BoardEntry[] | null)[] = bands.map((b) => (b.empty || b.out ? null : src.board(b.index)));
  const bestByBand = bestFits(readings);

  const heldBy = (questId: number): number | null => {
    const i = bands.findIndex((b) => b.out?.questId === questId);
    return i < 0 ? null : i;
  };

  const cellFor = (b: BandView, questId: number): BandCell => {
    const holder = heldBy(questId);
    const base = { band: b.index, questId, takenBy: null, word: null, best: false, risky: false, canSend: false };
    if (holder === b.index) return { ...base, kind: 'mine' };
    if (holder !== null) return { ...base, kind: 'taken', takenBy: holder };
    if (b.out) return { ...base, kind: 'out' };
    if (b.empty) return { ...base, kind: 'empty' };
    const reading = readings[b.index]!.find((e) => e.questId === questId);
    // board(i) is the one shared board read through band i's eyes, so every posting is on every reading.
    if (!reading) throw new Error(`readBands: band ${b.index + 1} has no reading of quest ${questId}`);
    return {
      ...base,
      kind: 'send',
      word: reading.difficulty,
      best: bestByBand[b.index] === questId,
      risky: isBeyond(reading.difficulty),
      canSend: true,
    };
  };

  const posted: JobRow[] = [...open]
    .sort((a, b) => a.challenge - b.challenge || a.questId - b.questId)
    .map((e) => ({
      questId: e.questId,
      name: e.name,
      regionName: src.regionName(e.regionId),
      challenge: e.challenge,
      rewardGold: e.rewardGold,
      rewardXp: e.rewardXp,
      expiresWeek: e.expiresWeek,
      commission: e.commission,
      heldBy: null,
      cells: bands.map((b) => cellFor(b, e.questId)),
    }));

  // A job a band holds has left the board (`acceptQuest` splices it out), so it
  // is added back as its own row — otherwise "Band 2 is out" would not say on what.
  const held: JobRow[] = bands.flatMap((b) =>
    b.out
      ? [{
          questId: b.out.questId,
          name: b.out.questName,
          regionName: b.out.regionName,
          challenge: null,
          rewardGold: null,
          rewardXp: null,
          expiresWeek: null,
          commission: false,
          heldBy: b.index,
          cells: bands.map((c) => cellFor(c, b.out!.questId)),
        }]
      : [],
  );

  const hall: HallHero[] = src.unassignedHeroes().map((id) => ({
    ...lite(id),
    moves: movesFor(src, bands, id, null),
  }));

  const roster: RosterColumn[] = bands.map((b) => ({
    band: b.index,
    title: b.name,
    level: b.level,
    locked: b.out !== null,
    entries: b.heroes.map((hero) => ({ hero, moves: movesFor(src, bands, hero.id, b.index) })),
  }));
  roster.push({
    band: null,
    title: 'At the hall',
    level: null,
    locked: false,
    entries: hall.map((h) => ({ hero: h, moves: h.moves })),
  });

  return {
    plates: {
      week: src.currentWeek(),
      gold: src.goldAmount(),
      heroes: rosterById.size,
      beds: src.heroCapacity(),
      bands: src.partyCount(),
      bandsMax: MAX_BANDS,
      march: capacity,
    },
    bands,
    jobs: [...posted, ...held],
    postedCount: posted.length,
    hall,
    roster,
    bestByBand,
    nextLocked: bands.length < MAX_BANDS ? bands.length : null,
  };
}
