/**
 * The band screen, variant B (the job-by-band grid) — presentation only.
 *
 * Every row is a posting, every column an UNLOCKED band, every cell that
 * band's own reading of that posting. This file renders what `readBands`
 * returned and OWNS NO RULES: whether a Send button exists is `cell.canSend`,
 * which job is starred is `cell.best`, whether a move button is live is
 * `move.ok`. A variant-C component replaces this file and keeps the rest.
 *
 * It takes plain props (no session, no context) so tests can render it
 * straight from a real `readBands` view.
 */

import type { ReactNode } from 'react';
import { Portrait, conditionFor } from '../portrait';
import {
  bandName, columnWidths, oddsKey, shortName,
  type BandCell, type BandView, type BandsView, type HeroLite, type JobRow, type Move,
} from './bandPicks';

export interface OddsShown { text: string; bad: boolean }

export interface BandBoardProps {
  view: BandsView;
  rosterOpen: boolean;
  /** Forecasts the player asked for, by `oddsKey`. */
  odds: Readonly<Record<string, OddsShown>>;
  /** The sim's own sentence for the last refusal, printed verbatim. */
  error: string | null;
  onBack: () => void;
  onSend: (band: number, questId: number) => void;
  onOdds: (band: number, questId: number) => void;
  onMove: (heroId: string, to: number | null) => void;
  onToggleRoster: () => void;
  onLaunchHeld: (band: number) => void;
  onCallBack: (band: number) => void;
}

function Lock() {
  return (
    <svg className="gv-bd-ico" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="3.4" y="7" width="9.2" height="6.8" rx="1" />
      <path d="M5.4 7 V5 A2.6 2.6 0 0 1 10.6 5 V7" />
    </svg>
  );
}

/** A hero's condition, as words — colour is never the only carrier. */
function Tags({ hero }: { hero: HeroLite }) {
  return (
    <>
      {hero.status === 'dead' && <span className="gv-bd-hurt" data-down="">Down</span>}
      {hero.wounded > 0 && <span className="gv-bd-hurt" data-wounded={hero.wounded}>Wounded {hero.wounded}</span>}
    </>
  );
}

function Face({ hero }: { hero: HeroLite }) {
  return (
    <Portrait
      portraitKey={hero.portraitKey}
      alt={hero.name}
      size="chip"
      faction="haven"
      condition={conditionFor(hero)}
    />
  );
}

function BandHead({ band, p }: { band: BandView; p: BandBoardProps }) {
  const level = band.level === null ? 'EMPTY' : <>LEVEL <b data-level-value="">{band.level}</b></>;
  return (
    <th className={`gv-bd-bh${band.out ? ' is-out' : ''}`} scope="col" data-bandhead={band.index} data-out={band.out ? '' : undefined}>
      <div className="gv-bd-btop">
        <b>{band.name}</b>
        <span className="gv-plate gv-bd-lv" data-level={band.index}>{level}</span>
      </div>
      <div className="gv-bd-faces">
        {band.heroes.map((h) => <Face key={h.id} hero={h} />)}
        {Array.from({ length: band.freeSlots }, (_, i) => <span key={`f${i}`} className="gv-bd-freeslot" aria-hidden="true" />)}
      </div>
      <div className="gv-bd-names" data-names="">
        {band.empty
          ? 'Nobody yet. Add heroes from the hall.'
          : band.heroes.map((h) => `${shortName(h.name)} L${h.level}`).join(' · ')}
      </div>
      {band.out && (
        <div className="gv-bd-outline" data-out-job={band.out.questId}>
          <span className="gv-bd-lockline"><Lock /><span className="gv-stamp gv-bd-stamp">OUT ON A JOB</span></span>
          <div className="gv-bd-outjob">{band.out.questName}</div>
          <div className="gv-bd-outacts">
            <button className="gv-btn gv-bd-tiny" data-launch-held={band.index} onClick={() => p.onLaunchHeld(band.index)}>Launch now ▸</button>
            <button className="gv-btn gv-bd-tiny" data-call-back={band.index} onClick={() => p.onCallBack(band.index)}>Call back</button>
          </div>
        </div>
      )}
    </th>
  );
}

function Cell({ cell, band, p }: { cell: BandCell; band: BandView; p: BandBoardProps }) {
  const common = { 'data-cell': cell.questId, 'data-band': cell.band, 'data-kind': cell.kind };
  switch (cell.kind) {
    case 'mine':
      return <td className="gv-bd-cell is-mine" {...common}><span className="gv-bd-lockline"><Lock /> {band.name} is on this job</span></td>;
    case 'taken':
      return <td className="gv-bd-cell is-off" {...common}><span className="gv-bd-dim">Taken by {bandName(cell.takenBy ?? 0)}</span></td>;
    case 'out':
      return <td className="gv-bd-cell is-off" {...common}><span className="gv-bd-dim">{band.name} is out</span></td>;
    case 'empty':
      return <td className="gv-bd-cell is-off" {...common}><span className="gv-bd-dim">{band.name} has no heroes</span></td>;
    case 'send': {
      const word = cell.word!;
      const shown = p.odds[oddsKey(p.view, cell.band, cell.questId)];
      return (
        <td
          className={`gv-bd-cell${cell.best ? ' is-best' : ''}`}
          {...common}
          data-word={word.id}
          data-best={cell.best ? '' : undefined}
        >
          {cell.best && <span className="gv-bd-star" data-best-fit="">★ Best fit</span>}
          <p className={`gv-difficulty gv-difficulty--s${word.tier} gv-bd-word`}>
            <i />{word.label}<span data-reason="">{word.reason}</span>
          </p>
          <p className="gv-bd-odds">
            {shown
              ? <span data-odds-line="" className={shown.bad ? 'gv-bd-bad' : undefined}>{shown.text}</span>
              : <button className="gv-btn gv-btn--ghost gv-bd-tiny" data-odds={`${cell.band}:${cell.questId}`} onClick={() => p.onOdds(cell.band, cell.questId)}>Check odds</button>}
          </p>
          <button
            className={`gv-btn${cell.best ? ' gv-btn--seal' : ''} gv-bd-tiny`}
            data-send={`${cell.band}:${cell.questId}`}
            title={cell.risky ? 'Beyond them. Expect losses.' : undefined}
            onClick={() => p.onSend(cell.band, cell.questId)}
          >
            Send {band.name} ▸
          </button>
        </td>
      );
    }
  }
}

function JobHead({ job }: { job: JobRow }) {
  return (
    <td className="gv-bd-job">
      <b>{job.name}</b>
      {job.commission && <small className="gv-bd-tag">Marshal&apos;s commission</small>}
      <small>{job.regionName}{job.challenge !== null && <> · challenge {job.challenge}</>}</small>
      {job.heldBy !== null
        ? <small>On the road. Not on the board.</small>
        : <small>{job.rewardGold}g · {job.rewardXp} xp · ends wk {job.expiresWeek}</small>}
    </td>
  );
}

function MoveButton({ hero, move, p, label }: { hero: HeroLite; move: Move; p: BandBoardProps; label: ReactNode }) {
  return (
    <button
      className="gv-btn gv-bd-tiny"
      data-move={`${hero.id}:${move.to ?? 'hall'}`}
      disabled={!move.ok}
      title={move.why ?? undefined}
      onClick={() => p.onMove(hero.id, move.to)}
    >
      {label}
    </button>
  );
}

export function BandBoard(p: BandBoardProps) {
  const { view } = p;
  const w = columnWidths(view.bands.length);
  const pl = view.plates;
  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-bd" data-band-screen="">
        <h1>Bands &amp; jobs</h1>
        <p style={{ margin: '0 0 12px' }}>
          <button className="gv-btn" data-nav-town="" onClick={p.onBack}>◂ Town Hub</button>
        </p>
        <p className="gv-bd-lead">Every job, read by <b>every band</b>. Find the cell you want. <b>One click</b> sends that band.</p>

        <div className="gv-deskbar" data-bd-plates="" style={{ marginBottom: 14 }}>
          <span className="gv-plate">WEEK <b>{pl.week}</b></span>
          <span className="gv-plate">GOLD <b>{pl.gold}</b></span>
          <span className="gv-plate">HEROES <b data-plate-heroes="">{pl.heroes} of {pl.beds}</b> beds</span>
          <span className="gv-plate">BANDS <b data-plate-bands="">{pl.bands} of {pl.bandsMax}</b></span>
          <span className="gv-plate">MARCH <b>{pl.march}</b> per band</span>
        </div>
        {p.error && <p className="gv-marg" data-bd-error="" style={{ margin: '0 0 14px' }}><b>!</b> {p.error}</p>}

        <section className="gv-sheet gv-bd-sheet" data-section="matrix" style={{ ['--gv-tilt' as never]: '0deg' }}>
          <span className="gv-pin" />
          <table className="gv-bd-tab" data-board="matrix">
            <colgroup>
              <col style={{ width: `${w.job}%` }} />
              {view.bands.map((b) => <col key={b.index} style={{ width: `${w.band}%` }} />)}
              {view.nextLocked !== null && <col style={{ width: `${w.locked}%` }} />}
            </colgroup>
            <thead>
              <tr>
                <th className="gv-bd-jobh" scope="col">
                  <b>The board</b>
                  <small>{view.jobs.filter((j) => j.heldBy === null).length} jobs posted · week {pl.week}</small>
                </th>
                {view.bands.map((b) => <BandHead key={b.index} band={b} p={p} />)}
                {view.nextLocked !== null && (
                  <th className="gv-bd-lockedh" scope="col" data-locked-band={view.nextLocked}>
                    <Lock /> <b>{bandName(view.nextLocked)}</b>
                    <small>locked · upgrade the Barracks</small>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {view.jobs.map((job) => (
                <tr key={job.questId} data-q={job.questId} className={job.heldBy !== null ? 'is-taken' : undefined}>
                  <JobHead job={job} />
                  {job.cells.map((cell) => <Cell key={cell.band} cell={cell} band={view.bands[cell.band]!} p={p} />)}
                  {view.nextLocked !== null && <td className="gv-bd-lockedc" />}
                </tr>
              ))}
              {view.jobs.length === 0 && (
                <tr><td className="gv-bd-job" colSpan={view.bands.length + 1 + (view.nextLocked !== null ? 1 : 0)} data-board-empty="">
                  <em>The board is bare. Advance the week. Trouble restocks.</em>
                </td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="gv-sheet gv-sheet--aged gv-bd-hall" data-section="hall" style={{ ['--gv-tilt' as never]: '0.1deg' }}>
          <span className="gv-tape" />
          <h3 className="gv-head">Waiting at the hall <span className="gv-sub">{view.hall.length} in reserve</span></h3>
          {view.hall.length === 0
            ? <p className="gv-bd-dim" data-hall-empty="" style={{ margin: 0 }}>Nobody is waiting.</p>
            : (
              <ul className="gv-bd-hlist">
                {view.hall.map((h) => (
                  <li className="gv-bd-hh" key={h.id} data-hall-hero={h.id}>
                    <Face hero={h} />
                    <span className="gv-bd-hn">
                      <b>{h.name}</b><Tags hero={h} />
                      <small>{h.ancestryName} {h.className} · L{h.level}</small>
                    </span>
                    <span className="gv-bd-hb">
                      {h.moves.map((m) => (
                        <MoveButton
                          key={m.to}
                          hero={h}
                          move={m}
                          p={p}
                          label={<>+ {bandName(m.to!)} <small data-hint="">(level {m.hint})</small></>}
                        />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section className="gv-sheet gv-bd-roster" data-section="roster" style={{ ['--gv-tilt' as never]: '-0.1deg' }}>
          <span className="gv-pin gv-pin--left" />
          <button className="gv-btn" data-roster-toggle="" aria-expanded={p.rosterOpen} onClick={p.onToggleRoster}>
            {p.rosterOpen ? '▾' : '▸'} Change who is in each band
          </button>{' '}
          <span className="gv-bd-dim" data-roster-summary="">
            {view.bands.map((b) => `${b.name}: ${b.size}`).join(' · ')} · Hall: {view.hall.length}
          </span>
          {p.rosterOpen && (
            <div className="gv-bd-cols" data-roster-open="">
              {view.roster.map((col) => (
                <div className="gv-bd-col" key={col.band ?? 'hall'} data-roster-col={col.band ?? 'hall'}>
                  <h4>{col.title}{col.level !== null && <> · level {col.level}</>}</h4>
                  <ul>
                    {col.entries.map(({ hero, moves }) => (
                      <li className="gv-bd-rr" key={hero.id} data-roster-hero={hero.id}>
                        <span className="gv-bd-hn">
                          <b>{hero.name}</b><Tags hero={hero} />
                          <small>{hero.className} L{hero.level}</small>
                        </span>
                        <span className="gv-bd-hb">
                          {col.locked
                            ? <span className="gv-bd-lock" data-locked=""><Lock /> locked</span>
                            : moves.map((m) => (
                              <MoveButton key={m.to ?? 'hall'} hero={hero} move={m} p={p} label={m.to === null ? '↓ Hall' : `→ ${m.to + 1}`} />
                            ))}
                        </span>
                      </li>
                    ))}
                    {col.entries.length === 0 && <li className="gv-bd-dim">Nobody.</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="gv-bd-foot">
          <b>Best fit</b> = most XP among jobs that are not &ldquo;Beyond us&rdquo;, safe ones first.
          Band 1 picks first, and two bands never share a star.
          <b> Send</b> takes the job and marches at once, with the usual orders: explore everything, standard nerve.
          For other orders, use the Quest board.
        </p>
      </div>
    </div>
  );
}
