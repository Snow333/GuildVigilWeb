/**
 * Town & Upgrades (M3) — mockup variant B, "Do This Next".
 *
 * Three ranked picks sit on top; the full 18-building ledger (variant A's table)
 * is folded under them as "Show all 18". Stores, the Guild Hall ladder and the
 * Tavern recruit pool ride in the side column.
 *
 * ⚠ THIS SCREEN IS A TILL, NOT AN ECONOMIST. Every cost, blocker and effect
 * line comes from `session.town()`; what to RECOMMEND and how to group lives in
 * `townPicks.ts` (pure, unit-tested). The two non-negotiables:
 *   1. `next.effect.wired === false` → the line is greyed and tagged "Not
 *      working yet". Never read as a promise.
 *   2. Only `effect.text` is printed. A raw effect key never reaches the DOM.
 * Blocked reasons are the sim's own sentences, rendered verbatim.
 */

import { useState, type ReactNode } from 'react';
import { effectAt, upgradeCost, type BuildingView, type UpgradeCost } from '@sim/campaign/town';
import { RESOURCE_KINDS, type ResourceKind, type ResourceStock } from '@content/town';
import { useGame } from '../state/GameProvider';
import {
  STATUS_LABEL, TIER_LABEL, gapLine, ledgerOrder, needRows, partySizeFromText, picksTogether,
  rankPicks, statusCounts, statusOf, type Pick, type TownStatus, type Upgradable,
} from './townPicks';

const GUILD_HALL = 1;

type Filter = 'all' | TownStatus;

const STATUS_CHIP: Record<TownStatus, string> = {
  ready: 'gv-chip gv-chip--s0',
  short: 'gv-chip gv-chip--s1',
  locked: 'gv-chip gv-chip--s2',
  maxed: 'gv-chip gv-tn-chip-done',
};

/** "Not working yet" tag — the screen's one guard against a false promise. */
function NotWorking() {
  return <span className="gv-tn-tag" data-not-working="">Not working yet</span>;
}

/** An effect line. Greyed and tagged when the engine does not keep it. */
function Effect({ effect, empty }: { effect: { text: string; wired: boolean } | null; empty: string }) {
  if (!effect) return <span className="gv-tn-none">{empty}</span>;
  if (!effect.wired) {
    return (
      <span className="gv-tn-unwired" data-effect="unwired">
        {effect.text} <NotWorking />
      </span>
    );
  }
  return <span data-effect="wired">{effect.text}</span>;
}

/** Cost chips: gold plus each material, dashed red where the guild is short. */
function CostChips({ cost, gold, stock }: { cost: UpgradeCost; gold: number; stock: ResourceStock }) {
  const rows = needRows(cost, gold, stock);
  if (rows.length === 0) return <span className="gv-tn-none">Free</span>;
  return (
    <span className="gv-tn-cost">
      {rows.map((r) => (
        <span
          key={r.item}
          className={`${r.item === 'gold' ? 'gv-tn-gold' : 'gv-tn-res'}${r.left < 0 ? ' short' : ''}`}
          data-cost={r.item}
        >
          <b>{r.costs}</b> {r.item}
          {r.left < 0 && <small> (have {r.have})</small>}
        </span>
      ))}
    </span>
  );
}

function levelWords(b: BuildingView & { next: NonNullable<BuildingView['next']> }): string {
  return b.level === 0 ? 'build it → level 1' : `level ${b.level} → ${b.next.level}`;
}

export function TownScreen() {
  const { session, exec, nav, lastError, saveGame } = useGame();
  const [filter, setFilter] = useState<Filter>('all');
  const [foldOpen, setFoldOpen] = useState<boolean | null>(null);
  const [heroName, setHeroName] = useState('');
  if (!session) return null;

  const town = session.town();
  const gold = session.goldAmount();
  const rep = session.reputationTotal();
  const stock = session.resourceStock();
  const income = session.weeklyIncome();
  const sites = session.resourceSites();
  const roster = session.rosterSize();
  const maxParty = session.maxPartySize();
  const pool = session.recruitPool();

  const picks = rankPicks(town);
  const pickIds = new Set(picks.map((p) => p.building.id));
  const gap = gapLine(town, picks);
  const together = picksTogether(picks, gold, stock);
  const counts = statusCounts(town);
  const built = town.filter((b) => b.level > 0).length;

  // Fold is open by default only when there are NO picks (otherwise the top of
  // the page would be empty and the answer would be hiding behind a click).
  const open = foldOpen ?? picks.length === 0;
  const ledger = ledgerOrder(town).filter((b) => filter === 'all' || statusOf(b) === filter);

  const upgrade = (id: number): void => {
    exec((s) => s.upgradeBuilding(id));
    void saveGame();
  };
  const hire = (classId: number): void => {
    const hired = exec((s) => s.recruitHero(classId, heroName));
    if (hired) setHeroName('');
    void saveGame();
  };

  const guildHall = town.find((b) => b.id === GUILD_HALL);
  const ladderLevels = guildHall ? Array.from({ length: guildHall.maxLevel }, (_, i) => i + 1) : [];

  // Where each resource is found (a kind can live in more than one region).
  const foundIn = (kind: ResourceKind): string => {
    const names = [...new Set(sites.filter((s) => s.kind === kind).map((s) => s.regionName))];
    return names.join(', ');
  };

  const upgradeButton = (b: Upgradable, big: boolean): ReactNode => {
    const blocked = b.blocked.length > 0;
    const dead = b.next.effect?.wired !== true;
    return (
      <button
        className={`gv-btn${blocked ? '' : ' gv-btn--seal'}${big ? ' gv-tn-bigbtn' : ''}`}
        data-upgrade={b.id}
        disabled={blocked}
        onClick={() => upgrade(b.id)}
      >
        {blocked ? 'Upgrade' : dead ? 'Build anyway ▸' : 'Upgrade ▸'}
      </button>
    );
  };

  const renderPick = (p: Pick, i: number) => {
    const b = p.building;
    const rows = needRows(b.next.cost, gold, stock);
    return (
      <article
        className="gv-sheet gv-tn-pick"
        key={b.id}
        data-pick={b.id}
        data-rank={p.rank}
        style={{ ['--gv-tilt' as never]: ['-0.3deg', '0.25deg', '-0.2deg'][i % 3] }}
      >
        <span className="gv-pin gv-pin--left" />
        <div className="gv-seal gv-tn-rank" aria-label={`Pick ${p.rank}`}>{p.rank}</div>
        <div>
          <h3 className="gv-head">{b.name} <span className="gv-sub">{levelWords(b)}</span></h3>
          <p className="gv-tn-gain"><Effect effect={b.next.effect} empty="No listed effect" /></p>
          <div className="gv-tn-pickgrid">
            <table className="gv-tn-need">
              <thead>
                <tr><th>Item</th><th className="n">Costs</th><th className="n">You have</th><th className="n">Left after</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.item} data-row={r.item}>
                    <td className="it">{r.item}</td>
                    <td className="n">{r.costs}</td>
                    <td className="n">{r.have}</td>
                    <td className="n left"><b>{r.left}</b></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={4}>Costs nothing.</td></tr>}
              </tbody>
            </table>
            <div className="gv-tn-act">
              {upgradeButton(b, true)}
              <small>Spends the gold and resources</small>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-town gv-tn">
        <div className="gv-town-full">
          <h1>Town &amp; Upgrades</h1>
          <p style={{ margin: '0 0 12px' }}>
            <button className="gv-btn" onClick={() => nav({ kind: 'town' })}>◂ Town Hub</button>
          </p>
          <div className="gv-deskbar" data-tn-status="" style={{ marginBottom: 18 }}>
            <span className="gv-plate">WEEK <b>{session.currentWeek()}</b></span>
            <span className="gv-plate">GOLD <b data-tn-gold="">{gold}</b></span>
            <span className="gv-plate">REPUTATION <b>{rep}</b></span>
            <span className="gv-plate">BUILT <b>{built} of {town.length}</b></span>
            <span className="gv-plate">HEROES <b data-tn-roster="">{roster} of {maxParty}</b></span>
          </div>
          {lastError && <p className="gv-marg" data-tn-error="" style={{ margin: '0 0 14px' }}><b>!</b> {lastError}</p>}
        </div>

        <div>
          <p className="gv-tn-pickshead" data-tn-summary="">
            {picks.length === 0 ? (
              <>You have <b>{gold} gold</b>. Nothing is ready to buy.</>
            ) : together.affordable ? (
              <>You have <b>{gold} gold</b>. You can afford all {picks.length === 1 ? '1 pick' : `${picks.length} picks`}.</>
            ) : (
              <>You have <b>{gold} gold</b>. The {picks.length === 1 ? '1 pick costs' : `${picks.length} picks cost`}{' '}
                <b>{together.totalGold} gold</b> together — so start at the top.</>
            )}
          </p>

          {picks.map(renderPick)}

          {gap && (
            <div className="gv-sheet gv-sheet--aged gv-tn-gap" data-tn-gap="">
              <span className="gv-tape" />
              <p style={{ margin: 0 }}>{gap}</p>
            </div>
          )}

          <div className="gv-sheet gv-sheet--aged" data-section="ledger" style={{ ['--gv-tilt' as never]: '0.2deg' }}>
            <span className="gv-tape" />
            <details
              className="gv-tn-fold"
              open={open}
              onToggle={(e) => setFoldOpen((e.currentTarget as HTMLDetailsElement).open)}
              data-fold="all"
            >
              <summary>
                Show all {town.length}
                <small>every building, one line each</small>
              </summary>

              <div className="gv-tn-counts" data-tn-counts="">
                <span><b>{counts.ready}</b> ready</span>
                <span><b>{counts.short}</b> short on stuff</span>
                <span><b>{counts.locked}</b> locked</span>
                <span><b>{counts.maxed}</b> fully built</span>
              </div>
              <div className="gv-tn-filters" role="group" aria-label="Show">
                {([['all', `All ${town.length}`], ['ready', `Ready ${counts.ready}`], ['short', `Short ${counts.short}`],
                  ['locked', `Locked ${counts.locked}`], ['maxed', `Fully built ${counts.maxed}`]] as [Filter, string][]).map(
                  ([key, label]) => (
                    <button
                      key={key}
                      className="gv-btn"
                      data-filter={key}
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>

              <table className="gv-tn-ledger" data-tn-ledger="">
                <thead>
                  <tr>
                    <th style={{ width: '16%' }}>Building</th>
                    <th style={{ width: '20%' }}>You have now</th>
                    <th style={{ width: '22%' }}>Next level gives you</th>
                    <th style={{ width: '17%' }}>Costs</th>
                    <th style={{ width: '17%' }}>Can I do it?</th>
                    <th style={{ width: '8%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((b) => {
                    const status = statusOf(b);
                    return (
                      <tr key={b.id} data-b={b.id} data-status={status} data-level={b.level}>
                        <td className="nm">
                          <b>{b.name}</b>
                          <span>level <span data-level-value="">{b.level}</span> of {b.maxLevel}</span>
                          {pickIds.has(b.id) && <span className="gv-tn-pickmark">Pick {picks.find((p) => p.building.id === b.id)?.rank}</span>}
                        </td>
                        <td><Effect effect={b.current} empty="Not built yet" /></td>
                        <td>
                          {b.next
                            ? <Effect effect={b.next.effect} empty="No listed effect" />
                            : <span className="gv-tn-none">Nothing more to build</span>}
                        </td>
                        <td>
                          {b.next
                            ? <CostChips cost={b.next.cost} gold={gold} stock={stock} />
                            : <span className="gv-tn-none">—</span>}
                        </td>
                        <td>
                          <span className={STATUS_CHIP[status]}><i />{STATUS_LABEL[status]}</span>
                          {b.blocked.length > 0 && (
                            <ul className="gv-tn-why" data-why="">
                              {b.blocked.map((r) => (
                                <li key={r.kind} data-kind={r.kind}>{r.text}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="go">
                          {b.next && upgradeButton(b as Upgradable, false)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          </div>
        </div>

        <div className="gv-tn-side">
          <div className="gv-sheet gv-sheet--aged" data-section="stores" style={{ ['--gv-tilt' as never]: '0.3deg' }}>
            <span className="gv-tape" />
            <h3 className="gv-head">Stores <span className="gv-sub">what the guild holds</span></h3>
            <table className="gv-tn-mini">
              <thead>
                <tr><th>Resource</th><th className="n">Have</th><th className="n">Income</th><th>Found in</th></tr>
              </thead>
              <tbody>
                {RESOURCE_KINDS.map((kind) => (
                  <tr key={kind} data-res={kind}>
                    <td className="rn">{kind}</td>
                    <td className="n"><b data-have="">{stock[kind]}</b></td>
                    <td className="n" data-income="">+{income[kind]}/wk</td>
                    <td className="w">{foundIn(kind)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="gv-sheet" data-section="hall" style={{ ['--gv-tilt' as never]: '-0.3deg' }}>
            <span className="gv-pin" />
            <h3 className="gv-head">Guild Hall <span className="gv-sub">party size</span></h3>
            <table className="gv-tn-mini">
              <thead>
                <tr><th>Level</th><th>Heroes per party</th><th>State</th></tr>
              </thead>
              <tbody>
                {ladderLevels.map((lvl) => {
                  const eff = effectAt(GUILD_HALL, lvl);
                  const size = partySizeFromText(eff?.text);
                  const done = (guildHall?.level ?? 0) >= lvl;
                  const isNext = (guildHall?.level ?? 0) + 1 === lvl;
                  const bill = !done ? upgradeCost(GUILD_HALL, lvl) : null;
                  return (
                    <tr key={lvl} data-ghlevel={lvl} data-state={done ? 'built' : isNext ? 'next' : 'later'}>
                      <td><b>L{lvl}</b></td>
                      <td>
                        <span className="gv-tn-heroes" aria-hidden="true">
                          {Array.from({ length: size ?? 0 }, (_, i) => (
                            <i key={i} className={i >= 4 ? 'new' : ''} />
                          ))}
                        </span>
                        <span className="gv-tn-pt">{size ?? '?'} heroes</span>
                        {eff && !eff.wired && <> <NotWorking /></>}
                        {bill && (
                          <div><CostChips cost={bill} gold={gold} stock={stock} /></div>
                        )}
                      </td>
                      <td>
                        <span className={done ? 'gv-chip gv-tn-chip-done' : isNext ? 'gv-chip gv-chip--s0' : 'gv-chip gv-tn-chip-later'}>
                          <i />{done ? 'Built' : isNext ? 'Next' : 'Later'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pool.length > 0 && (
            <div className="gv-sheet gv-sheet--aged" data-section="tavern" style={{ ['--gv-tilt' as never]: '0.25deg' }}>
              <span className="gv-tape" />
              <h3 className="gv-head">Tavern <span className="gv-sub">hire a hero</span></h3>
              <p className="gv-tn-roster" data-tn-roster-line="">
                Roster <b>{roster} of {maxParty}</b>
                {roster >= maxParty && <> — the guild hall is full. Upgrade it to hire more.</>}
              </p>
              <label className="gv-tn-name">
                Name (optional){' '}
                <input
                  className="gv-input"
                  value={heroName}
                  maxLength={24}
                  onChange={(e) => setHeroName(e.target.value)}
                  data-recruit-name=""
                />
              </label>
              <table className="gv-tn-mini">
                <thead>
                  <tr><th>Class</th><th>Kind</th><th className="n">Fee</th><th></th></tr>
                </thead>
                <tbody>
                  {pool.map((o) => (
                    <tr key={o.classId} data-recruit={o.classId}>
                      <td><b>{o.className}</b></td>
                      <td>{TIER_LABEL[o.tier]}</td>
                      <td className="n">{o.cost}g</td>
                      <td className="n">
                        <button
                          className="gv-btn gv-btn--tiny"
                          data-hire={o.classId}
                          disabled={roster >= maxParty || gold < o.cost}
                          onClick={() => hire(o.classId)}
                        >
                          Hire
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {gold < Math.min(...pool.map((o) => o.cost)) && roster < maxParty && (
                <p className="gv-marg" style={{ margin: '6px 0 0' }}>Not enough gold to hire anyone yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
