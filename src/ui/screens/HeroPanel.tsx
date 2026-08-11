/**
 * Screen 7 — Hero panel (brief #5 §3): sheet, level-up wizard, slot-by-slot
 * equipment ritual (ledger: psychological value), loadout reorder. Every number
 * on screen comes from heroSheet()/levelUpOptions() — the UI computes nothing.
 * Elective feat picks join the wizard with the content workstream.
 *
 * Brief #8 rollout step 4: the hero is a dossier of sheets — abilities as
 * brass-riveted stat blocks, skills as the ruled ledger, the level-up wizard as
 * a fresh pinned sheet whose Commit is the wax seal (a level, once taken, is
 * taken). Gear/stash and loadout are standing records (taped, aged). All
 * e2e-pinned texts (Level up ●, "{class} → {n}", +/−, Commit level-up) and all
 * behavior are unchanged from Phase 2.
 */

import { useState } from 'react';
import type { AbilityKey } from '@sim/heroes/types';
import type { LoadoutEntry } from '@sim/combat/loadout';
import { Portrait, conditionFor, hasPortrait } from '../portrait';
import { useGame } from '../state/GameProvider';

const ABILITIES: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export function HeroPanel({ heroId }: { heroId: string }) {
  const { session, nav } = useGame();
  const [tab, setTab] = useState<'sheet' | 'levelup' | 'gear' | 'loadout'>('sheet');
  if (!session) return null;
  const sheet = session.heroSheet(heroId);

  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-hero">
        <h1>{sheet.name} — level {sheet.level} {sheet.classes.map((c) => `${c.name} ${c.level}`).join(' / ')}</h1>
        <div className="gv-tabs">
          <button className="gv-btn" onClick={() => nav({ kind: 'town' })}>◂ Town</button>
          {(['sheet', 'levelup', 'gear', 'loadout'] as const).map((t) => (
            <button
              key={t}
              className={t === 'levelup' && sheet.canLevelUp ? 'gv-btn gv-btn--seal' : 'gv-btn'}
              disabled={tab === t}
              onClick={() => setTab(t)}
            >
              {t === 'levelup' ? `Level up${sheet.canLevelUp ? ' ●' : ''}` : t}
            </button>
          ))}
          {session.roster().filter((r) => r.id !== heroId).map((r) => (
            <button className="gv-btn gv-btn--ghost" key={r.id} onClick={() => nav({ kind: 'hero', heroId: r.id })}>
              → {r.name}
            </button>
          ))}
        </div>
        {tab === 'sheet' && <SheetTab heroId={heroId} />}
        {tab === 'levelup' && <LevelUpTab heroId={heroId} />}
        {tab === 'gear' && <GearTab heroId={heroId} />}
        {tab === 'loadout' && <LoadoutTab heroId={heroId} />}
      </div>
    </div>
  );
}

function SheetTab({ heroId }: { heroId: string }) {
  const { session } = useGame();
  const s = session!.heroSheet(heroId);
  return (
    <div>
      <div className="gv-sheet gv-sheet--aged" style={{ ['--gv-tilt' as never]: '0.3deg' }}>
        <span className="gv-tape" />
        <h3 className="gv-head">The measure of them <span className="gv-sub">derived — the desk computes nothing</span></h3>
        <div className="gv-herohead">
          {/* the dossier photograph. Its condition grade is the twin of the
              Wounded number in the statline directly beside it. */}
          <Portrait
            portraitKey={s.portraitKey}
            alt={s.name}
            size="lg"
            faction="haven"
            condition={conditionFor(s)}
            taped
          />
          <div className="gv-heroident">
            <p className="gv-statline" style={{ margin: 0 }}>
              <b>{s.ancestryName}</b> · {s.classes.map((c) => `${c.name} ${c.level}`).join(' / ')}
            </p>
            {/* a clerk's note on the file, NOT red ink — the world isn't
                talking back, the archive just hasn't been drawn yet */}
            <p className="gv-filenote gv-italic" style={{ margin: '2px 0 0' }}>
              {hasPortrait(s.portraitKey) ? 'likeness on file' : 'awaiting field sketch'}
            </p>
          </div>
        </div>
        <div className="gv-abilities">
          {ABILITIES.map((a) => (
            <span className="gv-ab" key={a}>
              <b>{a.toUpperCase()}</b>
              {s.abilities[a].score} ({s.abilities[a].mod >= 0 ? '+' : ''}{s.abilities[a].mod})
            </span>
          ))}
        </div>
        <p className="gv-statline">
          HP {s.maxHp} · AC {s.ac} · Attack +{s.attackBonus} ({s.damageDice}) · Speed {s.speed} ·
          Init +{s.initiativeBonus} · Fort +{s.saves.fort} / Ref +{s.saves.ref} / Will +{s.saves.will} ·
          Wounded {s.wounded > 0 ? <span className="gv-marg">{s.wounded}</span> : s.wounded} ·
          XP {s.xp.atCap ? 'CAP' : `${s.xp.progress}/${s.xp.threshold}`}
        </p>
      </div>

      <div className="gv-sheet gv-sheet--aged gv-ledger" style={{ ['--gv-tilt' as never]: '-0.35deg' }}>
        <span className="gv-tape" />
        <h3 className="gv-head">Skills <span className="gv-sub">ranks · check</span></h3>
        <table>
          <tbody>
            {s.skills.filter((sk) => sk.ranks > 0 || sk.total !== null).map((sk) => (
              <tr key={sk.name}>
                <td>{sk.name}</td>
                <td>{sk.ranks} ranks</td>
                <td>{sk.total !== null ? `check +${sk.total}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="gv-sheet gv-sheet--old" style={{ ['--gv-tilt' as never]: '0.25deg' }}>
        <span className="gv-pin gv-pin--left" />
        <h3 className="gv-head">Feats <span className="gv-sub">the record</span></h3>
        <p style={{ margin: 0, fontSize: 13.5 }}>
          {s.feats.length > 0 ? s.feats.map((f) => f.name).join(' · ') : <em>none</em>}
        </p>
      </div>
    </div>
  );
}

function LevelUpTab({ heroId }: { heroId: string }) {
  const { session, exec } = useGame();
  const [classId, setClassId] = useState<number | null>(null);
  const [boost, setBoost] = useState<AbilityKey | null>(null);
  const [ranks, setRanks] = useState<Record<string, number>>({});
  const options = session!.levelUpOptions(heroId);

  if (!options.eligible) {
    const xp = session!.heroSheet(heroId).xp;
    return (
      <div className="gv-sheet gv-sheet--old gv-sheet--stained" style={{ maxWidth: 460 }}>
        <p style={{ margin: 0 }}><em>Not enough XP yet ({xp.atCap ? 'at the level cap' : `${xp.progress}/${xp.threshold}`}).</em></p>
      </div>
    );
  }

  const chosen = options.classes.find((c) => c.classId === classId) ?? null;
  const points = chosen ? session!.skillPointsFor(heroId, chosen.classId, boost ?? undefined) : 0;
  const spent = Object.values(ranks).reduce((a, b) => a + b, 0);
  const boostOk = !options.boostRequired || boost !== null;

  const commit = (): void => {
    if (!chosen) return;
    const skillRanks = Object.fromEntries(Object.entries(ranks).filter(([, n]) => n > 0));
    const applied = exec((s) =>
      s.applyLevelUp(heroId, {
        classId: chosen.classId,
        ...(boost ? { boost } : {}),
        skillRanks,
        feats: [],
        autoGrantedFeatIds: [],
      }),
    );
    if (applied) {
      setClassId(null);
      setBoost(null);
      setRanks({});
    }
  };

  return (
    <div className="gv-sheet" style={{ ['--gv-tilt' as never]: '-0.3deg' }}>
      <span className="gv-pin" />
      <h3 className="gv-head">Level {options.newCharacterLevel}: choose a class <span className="gv-sub">the commitment ritual</span></h3>
      <table style={{ borderCollapse: 'collapse', fontSize: 13.5, lineHeight: 2 }}>
        <tbody>
          {options.classes.map((c) => (
            <tr key={c.classId}>
              <td style={{ paddingRight: 10 }}>
                <button
                  className="gv-btn"
                  disabled={!c.met || classId === c.classId}
                  onClick={() => { setClassId(c.classId); setRanks({}); }}
                >
                  {c.name} → {c.newClassLevel}
                </button>
              </td>
              <td>{c.met ? `${c.hpPerLevel} hp/lvl · key ${c.keyAbility.toUpperCase()}` : <em className="gv-marg">{c.reason}</em>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {chosen && options.boostRequired && (
        <>
          <h3 className="gv-head" style={{ marginTop: 14 }}>Ability boost <span className="gv-sub">level {options.newCharacterLevel} milestone</span></h3>
          <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ABILITIES.map((a) => (
              <button className="gv-btn" key={a} disabled={boost === a} onClick={() => { setBoost(a); setRanks({}); }}>
                +2 {a.toUpperCase()}
              </button>
            ))}
          </p>
        </>
      )}
      {chosen && boostOk && (
        <>
          <h3 className="gv-head" style={{ marginTop: 14 }}>
            Skill points: {spent}/{points} <span className="gv-sub">rank cap {options.maxRanks} = character level</span>
          </h3>
          <table style={{ borderCollapse: 'collapse', fontSize: 13.5, lineHeight: 2 }}>
            <tbody>
              {options.skillNames.map((name) => {
                const held = options.currentRanks[name] ?? 0;
                const adding = ranks[name] ?? 0;
                const atCap = held + adding >= options.maxRanks;
                return (
                  <tr key={name}>
                    <td style={{ paddingRight: 12 }}>{name}</td>
                    <td style={{ paddingRight: 12 }}>{held + adding}{adding > 0 ? ` (+${adding})` : ''}{atCap ? ' MAX' : ''}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="gv-btn" disabled={spent >= points || atCap} onClick={() => setRanks({ ...ranks, [name]: adding + 1 })}>+</button>
                      <button className="gv-btn" disabled={adding <= 0} onClick={() => setRanks({ ...ranks, [name]: adding - 1 })}>−</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p>
            <button className="gv-btn gv-btn--seal" disabled={spent !== points} onClick={commit}>
              Commit level-up {spent !== points ? `(allocate all ${points} points)` : ''}
            </button>
          </p>
        </>
      )}
    </div>
  );
}

function GearTab({ heroId }: { heroId: string }) {
  const { session, exec } = useGame();
  const sheet = session!.heroSheet(heroId);
  const stash = session!.stashView();
  return (
    <div>
      <div className="gv-sheet gv-sheet--aged gv-ledger" style={{ ['--gv-tilt' as never]: '0.3deg' }}>
        <span className="gv-tape" />
        <h3 className="gv-head">Equipped <span className="gv-sub">slot by slot</span></h3>
        <table>
          <tbody>
            {sheet.equipped.map((e) => (
              <tr key={e.slot}>
                <td>{e.slot}</td>
                <td><b>{e.derived.displayName}</b></td>
                <td>{e.derived.damageDice ? `dmg ${e.derived.damageDice}` : e.derived.acBonus ? `AC +${e.derived.acBonus}` : '—'}</td>
                <td><button className="gv-btn" onClick={() => exec((s) => s.unequip(heroId, e.slot))}>Unequip ▸ stash</button></td>
              </tr>
            ))}
            {sheet.equipped.length === 0 && <tr><td><em>bare hands and courage</em></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="gv-sheet gv-sheet--aged gv-ledger" style={{ ['--gv-tilt' as never]: '-0.3deg' }}>
        <span className="gv-tape" />
        <h3 className="gv-head">Stash ({stash.length}) <span className="gv-sub">the guild stores</span></h3>
        <table>
          <tbody>
            {stash.map((v) => (
              <tr key={v.index}>
                <td><b>{v.derived.displayName}</b></td>
                <td>{v.derived.slot ?? 'not equippable'}</td>
                <td>
                  {v.derived.slot && (
                    <button className="gv-btn" onClick={() => exec((s) => s.equip(heroId, v.index))}>◂ Equip</button>
                  )}
                </td>
              </tr>
            ))}
            {stash.length === 0 && <tr><td><em>the stash is empty</em></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoadoutTab({ heroId }: { heroId: string }) {
  const { session, exec } = useGame();
  const sheet = session!.heroSheet(heroId);
  const entries = sheet.loadout;

  const describe = (e: LoadoutEntry): string => {
    const cond = e.condition.kind === 'always' ? 'always'
      : e.condition.kind === 'selfHpBelow' ? `self < ${e.condition.pct * 100}% hp`
      : e.condition.kind === 'allyHpBelow' ? `ally < ${e.condition.pct * 100}% hp`
      : e.condition.kind === 'enemyWithin' ? `enemy within ${e.condition.range}`
      : `not ${e.condition.conditionId}`;
    if (e.action === 'cast') return `cast spell ${e.spellId} → ${e.target} (${cond})`;
    if (e.action === 'toggle') return `toggle feat ${e.featId} (${cond})`;
    return `strike → ${e.target} (${cond})`;
  };

  const move = (i: number, dir: -1 | 1): void => {
    const next = [...entries];
    const [item] = next.splice(i, 1);
    next.splice(i + dir, 0, item!);
    exec((s) => s.setLoadout(heroId, next));
  };

  return (
    <div className="gv-sheet gv-sheet--aged gv-ledger" style={{ ['--gv-tilt' as never]: '0.35deg' }}>
      <span className="gv-tape" />
      <h3 className="gv-head">Loadout priorities <span className="gv-sub">top wins; falls back to a plain strike</span></h3>
      <table>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{describe(e)}</td>
              <td style={{ display: 'flex', gap: 6 }}>
                <button className="gv-btn" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                <button className="gv-btn" disabled={i === entries.length - 1} onClick={() => move(i, 1)}>▼</button>
                <button className="gv-btn" onClick={() => exec((s) => s.setLoadout(heroId, entries.filter((_, j) => j !== i)))}>✕</button>
              </td>
            </tr>
          ))}
          {entries.length === 0 && <tr><td><em>no entries — defaults to strike the scored enemy</em></td></tr>}
        </tbody>
      </table>
      <p style={{ marginBottom: 0 }}>
        <button
          className="gv-btn"
          onClick={() => exec((s) => s.setLoadout(heroId, [...entries, { action: 'strike', condition: { kind: 'always' }, target: 'nearestEnemy' }]))}
        >
          + add: strike nearest
        </button>{' '}
        <span className="gv-marg">spell entries join the editor with the known-spells model — content workstream</span>
      </p>
    </div>
  );
}
