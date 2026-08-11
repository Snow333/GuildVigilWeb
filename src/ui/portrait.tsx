/**
 * The portrait paste — the one component that puts generated art on the desk
 * (brief #10). Everything visual lives in styles/treatment.css; this file is
 * the markup contract plus the fallback policy.
 *
 * THE FALLBACK IS A FIRST-CLASS PATH, not an afterthought: after batch 1 only
 * Human m/f and Half-Orc m/f have art, so Elf, Dwarf, Halfling, and Gnome
 * heroes render the sketch-pending silhouette in normal play. Two ways to land
 * there and both are handled: no key in the generated module, or a data URI
 * that fails to decode (corrupt payload → onError). The UI never blanks and
 * never shows a WRONG portrait.
 *
 * Grades arrive as props from DATA (allegiance, condition) — a caller that
 * hand-picks a grade per image is a bug against the bible.
 */

import { useState } from 'react';
import { portraits } from '@content/generated/portraits';

/** Faction grade — from allegiance data. 'none' keeps the base grade alone. */
export type FactionGrade = 'none' | 'haven' | 'krath';
/** Condition grade — ALWAYS accompanied by its numeric/label twin on the host surface. */
export type ConditionGrade = 'none' | 'wounded' | 'lost';

export interface PortraitProps {
  /** `hero-halforc-f` — from a session query, never assembled in the UI. */
  portraitKey: string;
  /** Alt text: who this is. Empty string marks it decorative beside a visible name. */
  alt: string;
  size?: 'chip' | 'lg';
  faction?: FactionGrade;
  condition?: ConditionGrade;
  /** Bosses/elites: rank lives in the brass frame, never in the artwork. */
  elite?: boolean;
  /** Tape is physicality only — never the semantic "standing record" tape. */
  taped?: boolean;
  className?: string;
}

const FACTION_CLASS: Record<FactionGrade, string> = {
  none: '',
  haven: 'gv-t-haven',
  krath: 'gv-t-krath',
};

const CONDITION_CLASS: Record<ConditionGrade, string> = {
  none: '',
  wounded: 'gv-c-wounded',
  lost: 'gv-c-lost',
};

/** True when accepted art exists for this subject — the muster labels tiles with it. */
export function hasPortrait(portraitKey: string): boolean {
  return portraitKey in portraits;
}

export function Portrait({
  portraitKey,
  alt,
  size,
  faction = 'none',
  condition = 'none',
  elite = false,
  taped = false,
  className,
}: PortraitProps) {
  // A corrupt data URI is a render-time fact, not a build-time one — latch it
  // and fall through to the same silhouette a missing key gets.
  const [broken, setBroken] = useState(false);
  const uri = portraits[portraitKey];
  const showArt = uri !== undefined && !broken;

  const classes = [
    'gv-paste',
    'gv-t-base',
    FACTION_CLASS[faction],
    CONDITION_CLASS[condition],
    elite ? 'gv-f-elite' : '',
    size ? `gv-paste--${size}` : '',
    className ?? '',
  ].filter((c) => c !== '').join(' ');

  const mat = (
    <span className="gv-paste-mat">
      {showArt ? (
        <img className="gv-art" src={uri} alt={alt} onError={() => setBroken(true)} />
      ) : (
        <span className="gv-sil" role="img" aria-label={alt === '' ? '' : `${alt} — awaiting field sketch`} />
      )}
      <span className="gv-tint" />
      <span className="gv-grain" />
      <span className="gv-vig" />
    </span>
  );

  return (
    <figure className={classes} data-portrait={portraitKey} data-sketch={showArt ? undefined : ''}>
      {taped && <span className="gv-ptape" />}
      {elite ? <span className="gv-frame">{mat}</span> : mat}
    </figure>
  );
}

/**
 * The roster/dispatch condition read, in ONE place so every surface grades a
 * wounded hero identically. Caller still renders the paired label — the grade
 * is the twin of the number, never its replacement.
 */
export function conditionFor(entry: { status: string; wounded: number }): ConditionGrade {
  if (entry.status === 'dead') return 'lost';
  return entry.wounded > 0 ? 'wounded' : 'none';
}
