/**
 * Screen 0 — The founding muster (brief #10, decision 2). A new campaign now
 * opens with the player creating the four founding heroes: name, ancestry,
 * gender, class. Stats, gear, and everything downstream still roll from the
 * sim exactly as before — this screen authors identity, nothing else.
 *
 * Desk grammar: the muster sheet is PINNED (actionable now — this is the one
 * thing the desk wants from you); the roll is the standing record it writes
 * into; "Sign the charter" is the WAX SEAL, because a founding party, once
 * signed, is the campaign. Ancestries without art stay fully choosable and
 * muster with the sketch-pending silhouette — the clerk simply hasn't drawn
 * them yet (8 of 12 subjects after batch 1).
 *
 * Flat mode is not optional here: the muster is a REQUIRED flow, so every
 * control is a real button with a text label and a pressed state, never a
 * tilt/texture affordance.
 */

import { useState } from 'react';
import {
  DEFAULT_MUSTER, FOUNDING_CLASSES, FOUNDING_PARTY_SIZE, suggestedName,
  type MusterChoice,
} from '@sim/campaign/muster';
import { GENDERS, portraitKey, type Gender } from '@sim/heroes/ancestry';
import { ancestryIds, ancestryNameById } from '@sim/registry';
import { Portrait, hasPortrait } from '../portrait';
import { useGame } from '../state/GameProvider';

const GENDER_WORD: Record<Gender, string> = { f: 'woman', m: 'man' };

/** Names may ellipsize; numbers never do (brief #8 grammar). */
const NAME_MAX = 28;

export function FoundingMuster({ slotId, campaignName }: { slotId: string; campaignName: string }) {
  const { startNew, nav } = useGame();
  const [choices, setChoices] = useState<MusterChoice[]>(() => DEFAULT_MUSTER.map((c) => ({ ...c })));
  const [focus, setFocus] = useState(0);
  const [busy, setBusy] = useState(false);

  const current = choices[focus] ?? choices[0]!;

  const patch = (i: number, next: Partial<MusterChoice>): void => {
    setChoices((prev) => prev.map((c, j) => (j === i ? { ...c, ...next } : c)));
  };

  /** Resolve blank names to the archetype suggestion, unique across the party. */
  const resolved = (): MusterChoice[] => {
    const taken: string[] = [];
    return choices.map((c) => {
      const name = c.name.trim() === '' ? suggestedName(c.classId, taken) : c.name.trim();
      taken.push(name);
      return { ...c, name };
    });
  };

  const sign = (): void => {
    setBusy(true);
    void startNew(slotId, campaignName, resolved()).finally(() => setBusy(false));
  };

  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-muster">
        <div className="gv-muster-full">
          <h1>The founding muster — {campaignName}</h1>
          <p style={{ margin: '0 0 18px' }}>
            <button className="gv-btn" onClick={() => nav({ kind: 'title' })}>◂ Back to the charter</button>{' '}
            <span className="gv-marg">four sign on; the guild is what they make of it</span>
          </p>
        </div>

        {/* the roll: who has signed so far — a standing record, taped */}
        <div className="gv-sheet gv-sheet--aged" style={{ ['--gv-tilt' as never]: '0.3deg' }}>
          <span className="gv-tape" />
          <h3 className="gv-head">The roll <span className="gv-sub">{FOUNDING_PARTY_SIZE} founding members</span></h3>
          <div className="gv-roll">
            {choices.map((c, i) => {
              const key = portraitKey(c.ancestry, c.gender);
              const className = FOUNDING_CLASSES.find((f) => f.classId === c.classId)?.name ?? '—';
              const display = c.name.trim() === '' ? suggestedName(c.classId, []) : c.name.trim();
              return (
                <button
                  key={i}
                  type="button"
                  className="gv-rollmember"
                  aria-pressed={i === focus}
                  onClick={() => setFocus(i)}
                >
                  <Portrait portraitKey={key} alt="" size="chip" />
                  <span className="gv-rollname">{display}</span>
                  <span className="gv-rollcls">
                    {ancestryNameById.get(c.ancestry) ?? '—'} {GENDER_WORD[c.gender]} · {className}
                  </span>
                </button>
              );
            })}
          </div>
          {/* an instruction, not the world talking back — muted, never red ink */}
          <p className="gv-filenote gv-italic" style={{ margin: '10px 0 0' }}>
            pick a name from the roll to write their papers
          </p>
        </div>

        {/* the papers: pinned = the desk wants this from you now */}
        <div className="gv-sheet" style={{ ['--gv-tilt' as never]: '-0.3deg' }}>
          <span className="gv-pin" />
          <h3 className="gv-head">
            Recruit {focus + 1} of {FOUNDING_PARTY_SIZE} <span className="gv-sub">name · ancestry · gender · class</span>
          </h3>

          <p style={{ margin: '0 0 12px' }}>
            <label>
              Name:{' '}
              <input
                className="gv-input"
                value={current.name}
                maxLength={NAME_MAX}
                placeholder={suggestedName(current.classId, [])}
                onChange={(e) => patch(focus, { name: e.target.value })}
              />
            </label>{' '}
            <span style={{ fontSize: 12, color: 'var(--gv-ink-muted)' }}>(blank takes the suggestion)</span>
          </p>

          <div className="gv-choice">
            <span className="gv-choice-label">Gender</span>
            {GENDERS.map((g) => (
              <button key={g} className="gv-btn" disabled={current.gender === g} onClick={() => patch(focus, { gender: g })}>
                {GENDER_WORD[g]}
              </button>
            ))}
          </div>

          <div className="gv-choice">
            <span className="gv-choice-label">Class</span>
            {FOUNDING_CLASSES.map((f) => (
              <button
                key={f.classId}
                className="gv-btn"
                disabled={current.classId === f.classId}
                onClick={() => patch(focus, { classId: f.classId })}
              >
                {f.name}
              </button>
            ))}
          </div>

          <h3 className="gv-head" style={{ marginTop: 16 }}>
            Ancestry <span className="gv-sub">identity and likeness — no bearing on the numbers</span>
          </h3>
          <div className="gv-mustergrid">
            {ancestryIds.map((id) => {
              const key = portraitKey(id, current.gender);
              const drawn = hasPortrait(key);
              return (
                <button
                  key={id}
                  type="button"
                  className="gv-mtile"
                  aria-pressed={current.ancestry === id}
                  onClick={() => patch(focus, { ancestry: id })}
                >
                  <Portrait portraitKey={key} alt="" />
                  <span className="gv-mname">{ancestryNameById.get(id)}</span>
                  <span className="gv-mavail">{drawn ? 'sketch on file' : 'awaiting field sketch'}</span>
                </button>
              );
            })}
          </div>

          <p style={{ margin: '16px 0 0' }}>
            <button className="gv-btn gv-btn--seal" disabled={busy} onClick={sign}>
              Sign the charter ▸
            </button>{' '}
            <span className="gv-marg">the founding party cannot be re-cut once the seal is set</span>
          </p>
        </div>
      </div>
    </div>
  );
}
