/**
 * The living component drawer — brief #8 rollout step 1's visible surface.
 * Dev/reference route (#style-drawer), same pattern as #beat-fixture: NOT a game
 * screen, just the desk-grammar vocabulary rendered so humans and e2e can verify
 * the token/material/component layer without converting any real screen.
 *
 * Flat mode here toggles the body class only; the persisted setting arrives with
 * the SettingsScreen conversion (rollout step 7) via SaveStore.
 *
 * Brief #10 added the treatment layer here too: the grades only stay honest if
 * a human can see all of them on one subject at once.
 */

import { Portrait, type PortraitProps } from '../portrait';

/** One accepted batch-1 subject, shown under every grade so drift is visible. */
const DRAWER_SUBJECT = 'hero-halforc-m';

const TREATMENTS: {
  label: string;
  note: string;
  key?: string;
  props: Partial<PortraitProps>;
}[] = [
  { label: 'base', note: 'daguerreotype — every paste', props: {} },
  { label: 'haven', note: 'warm parchment bias', props: { faction: 'haven' } },
  { label: 'krath', note: 'cold iron bias', props: { faction: 'krath' } },
  { label: 'wounded', note: 'paired with the HP number', props: { condition: 'wounded' } },
  { label: 'lost', note: 'paired with the dead label', props: { condition: 'lost' } },
  { label: 'elite', note: 'rank lives in the frame', props: { elite: true } },
  { label: 'sketch-pending', note: 'no art — never a wrong face', key: 'hero-gnome-f', props: {} },
];

const TALLY_DEFS = (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <defs>
      <g id="gv-t5" stroke="#3a2d1c" strokeWidth="1.6" strokeLinecap="round">
        <line x1="1" y1="2" x2="1" y2="18" />
        <line x1="7" y1="2" x2="7" y2="18" />
        <line x1="13" y1="2" x2="13" y2="18" />
        <line x1="19" y1="2" x2="19" y2="18" />
        <line x1="-3" y1="15" x2="24" y2="5" />
      </g>
      <g id="gv-t1" stroke="#3a2d1c" strokeWidth="1.6" strokeLinecap="round">
        <line x1="1" y1="2" x2="1" y2="18" />
      </g>
    </defs>
  </svg>
);

function Tally({ fives, ones }: { fives: number; ones: number }) {
  return (
    <span className="gv-tally">
      {Array.from({ length: fives }, (_, i) => (
        <svg key={`f${i}`} width="26" height="22"><use href="#gv-t5" /></svg>
      ))}
      {Array.from({ length: ones }, (_, i) => (
        <svg key={`o${i}`} width="6" height="22"><use href="#gv-t1" /></svg>
      ))}
    </span>
  );
}

export function StyleDrawer() {
  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '40px 18px 80px', margin: -24 }}>
      <div className="gv-desk-area" style={{ maxWidth: 900, margin: '0 auto', padding: '34px 30px 44px' }}>
        <div className="gv-sheet gv-sheet--aged gv-sheet--stained" style={{ marginBottom: 26 }} data-drawer-intro="">
          <span className="gv-pin" />
          <h3 className="gv-head">The component drawer <span className="gv-sub">tokens · materials · grammar</span></h3>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--gv-ink-soft)' }}>
            Brief #8 rollout step 1: the vocabulary, live. No game screen uses these classes yet.
          </p>
          <p>
            <button
              className="gv-btn gv-btn--ghost"
              data-flat-toggle=""
              onClick={() => document.body.classList.toggle('gv-flat')}
            >
              Toggle flat mode
            </button>
          </p>
        </div>

        <div className="gv-sheet" style={{ marginBottom: 26, ['--gv-tilt' as never]: '-0.3deg' }}>
          <span className="gv-pin gv-pin--left" />
          <span className="gv-pin gv-pin--right" />
          <h3 className="gv-head">Vellum ages <span className="gv-sub">fresh · aged · old</span></h3>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div className="gv-sheet" style={{ width: 190, fontSize: 12, ['--gv-tilt' as never]: '-0.6deg' }}>
              <span className="gv-pin" /><b>Fresh</b> — current, pinned, actionable.
            </div>
            <div className="gv-sheet gv-sheet--aged" style={{ width: 190, fontSize: 12, ['--gv-tilt' as never]: '0.5deg' }}>
              <span className="gv-tape" /><b>Aged</b> — standing record, taped.
            </div>
            <div className="gv-sheet gv-sheet--old gv-sheet--stained gv-sheet--deckle" style={{ width: 190, fontSize: 12, ['--gv-tilt' as never]: '-0.4deg' }}>
              <span className="gv-pin" /><b>Old</b> — history, stained, deckled.
            </div>
          </div>
        </div>

        <div className="gv-sheet" style={{ marginBottom: 26, ['--gv-tilt' as never]: '0.35deg' }}>
          <span className="gv-pin" />
          <span className="gv-stamp">URGENT</span>
          <h3 className="gv-head">Actions + red ink <span className="gv-sub">wax = commitment</span></h3>
          <p style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="gv-btn gv-btn--seal">Accept</button>
            <button className="gv-btn">Map</button>
            <button className="gv-btn gv-btn--ghost">Dismiss</button>
            <span className="gv-seal">V</span>
          </p>
          <p className="gv-marg">a note in red ink — the world talking back, margins only</p>
        </div>

        <div className="gv-sheet gv-sheet--aged gv-ledger" style={{ marginBottom: 26, ['--gv-tilt' as never]: '0.4deg' }}>
          <span className="gv-tape" />
          <h3 className="gv-head">Status set <span className="gv-sub">frozen · always label-paired</span></h3>
          <p style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }} data-status-chips="">
            <span className="gv-chip gv-chip--s0"><i />ready</span>
            <span className="gv-chip gv-chip--s1"><i />resting</span>
            <span className="gv-chip gv-chip--s2"><i />wounded 1</span>
            <span className="gv-chip gv-chip--s3"><i />critical</span>
          </p>
          <div className="gv-meter">
            <span>The Ashmark</span>
            <span className="gv-chip gv-chip--s2"><i />T2 Threatened</span>
            <div className="gv-bar gv-bar--s2"><i style={{ width: '56%' }} /></div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 13 }}>xp</span>
            <div className="gv-xp" style={{ width: 120 }}><i style={{ width: '62%' }} /></div>
            <span style={{ color: 'var(--gv-ink-muted)', fontSize: 11.5 }}>624/1000</span>
          </div>
        </div>

        {/* Brief #10: the treatment layer joins the drawer, because a grade
            you cannot see side by side is a grade that drifts. Every paste
            below shows the SAME subject — only the grade changes. */}
        <div className="gv-sheet gv-sheet--aged" style={{ marginBottom: 26, ['--gv-tilt' as never]: '-0.4deg' }}>
          <span className="gv-tape" />
          <h3 className="gv-head">The treatment layer <span className="gv-sub">one image · every grade · bible §5</span></h3>
          <div className="gv-gradegrid" data-treatment-grid="">
            {TREATMENTS.map((t) => (
              <figure className="gv-gradecell" key={t.label}>
                <Portrait portraitKey={t.key ?? DRAWER_SUBJECT} alt="" {...t.props} />
                <figcaption>
                  <b>{t.label}</b>
                  <span>{t.note}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="gv-filenote gv-italic" style={{ marginBottom: 0 }}>
            wounded/lost desaturation is the TWIN of a number on screen, never its replacement —
            flat mode keeps it for exactly that reason, and drops everything else.
          </p>
        </div>

        <div className="gv-sheet" style={{ ['--gv-tilt' as never]: '-0.25deg' }}>
          <span className="gv-pin gv-pin--right" />
          <h3 className="gv-head">Deskbar + tally <span className="gv-sub">explicit numbers, flourish beside them</span></h3>
          <div className="gv-deskbar" style={{ marginBottom: 14 }}>
            <span className="gv-plaque">GUILD VIGIL</span>
            <span className="gv-plate">WEEK <b>13</b></span>
            <span className="gv-plate">GOLD <b>2,820</b></span>
          </div>
          {TALLY_DEFS}
          <div className="gv-tallyrow">
            <span>complete</span>
            <Tally fives={2} ones={1} />
            <span className="gv-tno">11/20</span>
          </div>
          <div className="gv-tallyrow">
            <span>wipe</span>
            <Tally fives={0} ones={4} />
            <span className="gv-tno" style={{ color: 'var(--gv-red-ink)' }}>4/20</span>
          </div>
        </div>
      </div>
    </div>
  );
}
