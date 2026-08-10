/**
 * Screen 7 — Hero panel (brief #5 §3): sheet, level-up wizard, slot-by-slot
 * equipment ritual (ledger: psychological value), loadout reorder. Every number
 * on screen comes from heroSheet()/levelUpOptions() — the UI computes nothing.
 * Elective feat picks join the wizard with the content workstream.
 */

import { useState } from 'react';
import type { AbilityKey } from '@sim/heroes/types';
import type { LoadoutEntry } from '@sim/combat/loadout';
import { useGame } from '../state/GameProvider';

const ABILITIES: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export function HeroPanel({ heroId }: { heroId: string }) {
  const { session, nav } = useGame();
  const [tab, setTab] = useState<'sheet' | 'levelup' | 'gear' | 'loadout'>('sheet');
  if (!session) return null;
  const sheet = session.heroSheet(heroId);

  return (
    <div>
      <h1>{sheet.name} — level {sheet.level} {sheet.classes.map((c) => `${c.name} ${c.level}`).join(' / ')}</h1>
      <p>
        <button onClick={() => nav({ kind: 'town' })}>◂ Town</button>{' '}
        {(['sheet', 'levelup', 'gear', 'loadout'] as const).map((t) => (
          <button key={t} disabled={tab === t} onClick={() => setTab(t)}>
            {t === 'levelup' ? `Level up${sheet.canLevelUp ? ' ●' : ''}` : t}
          </button>
        ))}
        {' '}
        {session.roster().filter((r) => r.id !== heroId).map((r) => (
          <button key={r.id} onClick={() => nav({ kind: 'hero', heroId: r.id })}>→ {r.name}</button>
        ))}
      </p>
      {tab === 'sheet' && <SheetTab heroId={heroId} />}
      {tab === 'levelup' && <LevelUpTab heroId={heroId} />}
      {tab === 'gear' && <GearTab heroId={heroId} />}
      {tab === 'loadout' && <LoadoutTab heroId={heroId} />}
    </div>
  );
}

function SheetTab({ heroId }: { heroId: string }) {
  const { session } = useGame();
  const s = session!.heroSheet(heroId);
  return (
    <div>
      <table border={1} cellPadding={6}>
        <tbody>
          <tr>
            {ABILITIES.map((a) => (
              <td key={a}><b>{a.toUpperCase()}</b> {s.abilities[a].score} ({s.abilities[a].mod >= 0 ? '+' : ''}{s.abilities[a].mod})</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p>
        HP {s.maxHp} · AC {s.ac} · Attack +{s.attackBonus} ({s.damageDice}) · Speed {s.speed} ·
        Init +{s.initiativeBonus} · Fort +{s.saves.fort} / Ref +{s.saves.ref} / Will +{s.saves.will} ·
        Wounded {s.wounded} · XP {s.xp.atCap ? 'CAP' : `${s.xp.progress}/${s.xp.threshold}`}
      </p>
      <h3>Skills</h3>
      <table border={1} cellPadding={4}>
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
      <h3>Feats</h3>
      <p>{s.feats.length > 0 ? s.feats.map((f) => f.name).join(' · ') : <em>none</em>}</p>
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
    return <p><em>Not enough XP yet ({xp.atCap ? 'at the level cap' : `${xp.progress}/${xp.threshold}`}).</em></p>;
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
    <div>
      <h3>Level {options.newCharacterLevel}: choose a class</h3>
      <table border={1} cellPadding={4}>
        <tbody>
          {options.classes.map((c) => (
            <tr key={c.classId}>
              <td>
                <button disabled={!c.met || classId === c.classId} onClick={() => { setClassId(c.classId); setRanks({}); }}>
                  {c.name} → {c.newClassLevel}
                </button>
              </td>
              <td>{c.met ? `${c.hpPerLevel} hp/lvl · key ${c.keyAbility.toUpperCase()}` : <em>{c.reason}</em>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {chosen && options.boostRequired && (
        <>
          <h3>Ability boost (level {options.newCharacterLevel} milestone)</h3>
          <p>
            {ABILITIES.map((a) => (
              <button key={a} disabled={boost === a} onClick={() => { setBoost(a); setRanks({}); }}>+2 {a.toUpperCase()}</button>
            ))}
          </p>
        </>
      )}
      {chosen && boostOk && (
        <>
          <h3>Skill points: {spent}/{points}</h3>
          <table border={1} cellPadding={4}>
            <tbody>
              {options.skillNames.map((name) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{ranks[name] ?? 0}</td>
                  <td>
                    <button disabled={spent >= points} onClick={() => setRanks({ ...ranks, [name]: (ranks[name] ?? 0) + 1 })}>+</button>
                    <button disabled={(ranks[name] ?? 0) <= 0} onClick={() => setRanks({ ...ranks, [name]: (ranks[name] ?? 0) - 1 })}>−</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <button disabled={spent !== points} onClick={commit}>
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
      <h3>Equipped</h3>
      <table border={1} cellPadding={4}>
        <tbody>
          {sheet.equipped.map((e) => (
            <tr key={e.slot}>
              <td>{e.slot}</td>
              <td>{e.derived.displayName}</td>
              <td>{e.derived.damageDice ? `dmg ${e.derived.damageDice}` : e.derived.acBonus ? `AC +${e.derived.acBonus}` : '—'}</td>
              <td><button onClick={() => exec((s) => s.unequip(heroId, e.slot))}>Unequip ▸ stash</button></td>
            </tr>
          ))}
          {sheet.equipped.length === 0 && <tr><td><em>bare hands and courage</em></td></tr>}
        </tbody>
      </table>
      <h3>Stash ({stash.length})</h3>
      <table border={1} cellPadding={4}>
        <tbody>
          {stash.map((v) => (
            <tr key={v.index}>
              <td>{v.derived.displayName}</td>
              <td>{v.derived.slot ?? 'not equippable'}</td>
              <td>
                {v.derived.slot && (
                  <button onClick={() => exec((s) => s.equip(heroId, v.index))}>◂ Equip</button>
                )}
              </td>
            </tr>
          ))}
          {stash.length === 0 && <tr><td><em>the stash is empty</em></td></tr>}
        </tbody>
      </table>
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
    <div>
      <h3>Loadout priorities (top wins; falls back to a plain strike)</h3>
      <table border={1} cellPadding={4}>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{describe(e)}</td>
              <td>
                <button disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                <button disabled={i === entries.length - 1} onClick={() => move(i, 1)}>▼</button>
                <button onClick={() => exec((s) => s.setLoadout(heroId, entries.filter((_, j) => j !== i)))}>✕</button>
              </td>
            </tr>
          ))}
          {entries.length === 0 && <tr><td><em>no entries — defaults to strike the scored enemy</em></td></tr>}
        </tbody>
      </table>
      <p>
        <button onClick={() => exec((s) => s.setLoadout(heroId, [...entries, { action: 'strike', condition: { kind: 'always' }, target: 'nearestEnemy' }]))}>
          + add: strike nearest
        </button>{' '}
        <small>(spell entries join the editor with the known-spells model — content workstream)</small>
      </p>
    </div>
  );
}
