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
import type { FeatSlotKind } from '@sim/heroes/feats';
import type { UnreadyReason } from '@sim/heroes/featEffects';
import type { LoadoutEntry } from '@sim/combat/loadout';
import { useGame } from '../state/GameProvider';
import { SheetTab } from './SheetTab';

const ABILITIES: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export function HeroPanel({ heroId }: { heroId: string }) {
  const { session, nav } = useGame();
  const [tab, setTab] = useState<'sheet' | 'levelup' | 'loadout'>('sheet');
  if (!session) return null;
  const sheet = session.heroSheet(heroId);

  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-hero">
        <h1>{sheet.name} — level {sheet.level} {sheet.classes.map((c) => `${c.name} ${c.level}`).join(' / ')}</h1>
        <div className="gv-tabs">
          <button className="gv-btn" onClick={() => nav({ kind: 'town' })}>◂ Town</button>
          {(['sheet', 'levelup', 'loadout'] as const).map((t) => (
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
        {tab === 'loadout' && <LoadoutTab heroId={heroId} />}
      </div>
    </div>
  );
}

const REASON_LABEL: Record<UnreadyReason, string> = {
  not_yet_implemented: 'Not yet available',
  prereq_unmet: 'Locked',
  already_taken: 'Already taken',
  level_unmet: 'Too low',
};

/** One pickable/greyed row, shared by the feat and spell pickers. */
function OfferRow({
  name, detail, note, selectable, chosen, onPick,
}: {
  name: string;
  detail: string;
  note: string;
  selectable: boolean;
  chosen: boolean;
  onPick: () => void;
}) {
  return (
    <tr style={{ opacity: selectable ? 1 : 0.55 }}>
      <td style={{ paddingRight: 10 }}>
        {/* data-feat-offer is the e2e handle: feat NAMES are content and change
            with the registry, so a spec must not match on them. */}
        <button className="gv-btn" data-feat-offer disabled={!selectable || chosen} onClick={onPick}>
          {chosen ? '✓ ' : ''}{name}
        </button>
      </td>
      <td style={{ paddingRight: 12, fontSize: 12.5 }}>{detail}</td>
      <td style={{ fontSize: 12.5 }}>
        {selectable ? <span className="gv-sub">{note}</span> : <em className="gv-marg">{note}</em>}
      </td>
    </tr>
  );
}

const EMPTY_PICKS: Record<FeatSlotKind, number[]> = { class: [], general: [], ancestry: [], skill: [] };

function LevelUpTab({ heroId }: { heroId: string }) {
  const { session, exec } = useGame();
  const [classId, setClassId] = useState<number | null>(null);
  const [boosts, setBoosts] = useState<AbilityKey[]>([]);
  const [ranks, setRanks] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<Record<FeatSlotKind, number[]>>(EMPTY_PICKS);
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
  const points = chosen ? session!.skillPointsFor(heroId, chosen.classId, boosts) : 0;
  const spent = Object.values(ranks).reduce((a, b) => a + b, 0);
  // Reads options.boostCount -- never a hardcoded 4. The count is a design knob
  // (BOOSTS_PER_MILESTONE) and duplicating it here would silently desync.
  const boostOk = !options.boostRequired || boosts.length === options.boostCount;
  const slots = chosen ? session!.featSlotsFor(heroId, chosen.classId) : [];
  const autoGrants = chosen ? session!.autoGrantsFor(heroId, chosen.classId) : [];
  const wantFor = (slot: { kind: FeatSlotKind; count: number; offers: { selectable: boolean }[] }): number =>
    Math.min(slot.count, slot.offers.filter((o) => o.selectable).length);
  const featsOk = slots.every((slot) => picked[slot.kind].length === wantFor(slot));

  const toggleBoost = (a: AbilityKey): void => {
    setBoosts((prev) => {
      if (prev.includes(a)) return prev.filter((x) => x !== a);
      if (prev.length >= options.boostCount) return prev; // distinct, and capped
      return [...prev, a];
    });
    setRanks({});
  };

  const pickFeat = (kind: FeatSlotKind, featId: number, max: number): void => {
    setPicked((prev) => {
      const cur = prev[kind];
      if (cur.includes(featId)) return { ...prev, [kind]: cur.filter((x) => x !== featId) };
      if (cur.length >= max) return prev;
      return { ...prev, [kind]: [...cur, featId] };
    });
  };

  const commit = (): void => {
    if (!chosen) return;
    const skillRanks = Object.fromEntries(Object.entries(ranks).filter(([, n]) => n > 0));
    const feats = Object.values(picked).flat().map((featId) => ({ featId }));
    const applied = exec((s) =>
      s.applyLevelUp(heroId, {
        classId: chosen.classId,
        ...(boosts.length > 0 ? { boost: boosts } : {}),
        skillRanks,
        feats,
        autoGrantedFeatIds: [],
      }),
    );
    if (applied) {
      setClassId(null);
      setBoosts([]);
      setRanks({});
      setPicked(EMPTY_PICKS);
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
                  onClick={() => { setClassId(c.classId); setRanks({}); setPicked(EMPTY_PICKS); }}
                >
                  {c.name} → {c.newClassLevel}
                </button>
              </td>
              <td>{c.met ? `${c.hpPerLevel} hp/lvl · key ${c.keyAbility.toUpperCase()}` : <em className="gv-marg">{c.reason}</em>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {chosen && autoGrants.length > 0 && (
        <>
          <h3 className="gv-head" style={{ marginTop: 14 }}>
            Class features <span className="gv-sub">granted, not chosen</span>
          </h3>
          <p style={{ margin: 0, fontSize: 13.5 }}>{autoGrants.map((id) => session!.featName(id)).join(' · ')}</p>
        </>
      )}

      {chosen && options.boostRequired && (
        <>
          <h3 className="gv-head" style={{ marginTop: 14 }}>
            Ability boosts: {boosts.length}/{options.boostCount}{' '}
            <span className="gv-sub">level {options.newCharacterLevel} milestone · four different abilities</span>
          </h3>
          <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ABILITIES.map((a) => {
              const on = boosts.includes(a);
              const full = boosts.length >= options.boostCount;
              return (
                <button
                  className="gv-btn"
                  key={a}
                  disabled={!on && full}
                  style={on ? { fontWeight: 700 } : undefined}
                  onClick={() => toggleBoost(a)}
                >
                  {on ? '✓ ' : ''}+2 {a.toUpperCase()}
                </button>
              );
            })}
          </p>
        </>
      )}

      {chosen && boostOk && slots.map((slot) => {
        const want = wantFor(slot);
        return (
          <div key={slot.kind}>
            <h3 className="gv-head" style={{ marginTop: 14 }}>
              {slot.kind[0]!.toUpperCase() + slot.kind.slice(1)} feats: {picked[slot.kind].length}/{want}{' '}
              <span className="gv-sub">
                {slot.count} slot{slot.count === 1 ? '' : 's'}
                {want < slot.count ? ` · only ${want} available` : ''}
              </span>
            </h3>
            {slot.offers.length === 0 ? (
              // D1: the ancestry track grants 5 slots per career against ZERO
              // authored ancestry feats. Shown as future content, not hidden --
              // the hole stays legible instead of silently absent.
              <p style={{ margin: 0, fontSize: 13 }}>
                <em className="gv-marg">No {slot.kind} feats exist yet — this slot is reserved for future content.</em>
              </p>
            ) : (
              <table style={{ borderCollapse: 'collapse', fontSize: 13.5, lineHeight: 1.9 }}>
                <tbody>
                  {slot.offers.map((o) => (
                    <OfferRow
                      key={o.featId}
                      name={o.name}
                      detail={`L${o.levelReq}`}
                      note={o.selectable ? o.description.slice(0, 68) : (o.detail ?? REASON_LABEL[o.reason!])}
                      selectable={o.selectable && (picked[slot.kind].length < want || picked[slot.kind].includes(o.featId))}
                      chosen={picked[slot.kind].includes(o.featId)}
                      onPick={() => pickFeat(slot.kind, o.featId, want)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {chosen && boostOk && featsOk && (
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

function LoadoutTab({ heroId }: { heroId: string }) {
  const { session, exec } = useGame();
  const sheet = session!.heroSheet(heroId);
  const entries = sheet.loadout;

  // Names, not ids. A loadout that reads "cast spell 41" is a debug dump; the
  // player is meant to recognise their own plan at a glance.
  const choices = session!.loadoutChoices(heroId);

  const describe = (e: LoadoutEntry): string => {
    const cond = e.condition.kind === 'always' ? 'always'
      : e.condition.kind === 'selfHpBelow' ? `self < ${e.condition.pct * 100}% hp`
      : e.condition.kind === 'allyHpBelow' ? `ally < ${e.condition.pct * 100}% hp`
      : e.condition.kind === 'enemyWithin' ? `enemy within ${e.condition.range}`
      : `not ${e.condition.conditionId}`;
    if (e.action === 'cast') {
      const spell = choices.spells.find((c) => c.spellId === e.spellId);
      return `cast ${spell?.name ?? `spell ${e.spellId}`} → ${e.target} (${cond})`;
    }
    if (e.action === 'ability') return `${session!.featName(e.featId)} → ${e.target} (${cond})`;
    if (e.action === 'toggle') return `toggle ${session!.featName(e.featId)} (${cond})`;
    return `strike → ${e.target} (${cond})`;
  };

  const add = (entry: LoadoutEntry): void => {
    exec((s) => s.setLoadout(heroId, [...entries, entry]));
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
      <p style={{ marginBottom: 6 }}>
        <button
          className="gv-btn"
          onClick={() => add({ action: 'strike', condition: { kind: 'always' }, target: 'nearestEnemy' })}
        >
          + add: strike nearest
        </button>
      </p>

      {choices.abilities.length > 0 && (
        <p style={{ margin: '0 0 6px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span className="gv-sub">abilities:</span>
          {choices.abilities.map((a) => (
            <button
              key={a.featId}
              className="gv-btn"
              onClick={() => add({ action: 'ability', featId: a.featId, condition: { kind: 'always' }, target: 'scoredEnemy' })}
            >
              + {a.name}
            </button>
          ))}
        </p>
      )}

      {choices.spells.length > 0 && (
        <p style={{ margin: '0 0 6px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span className="gv-sub">spells:</span>
          {choices.spells.map((c) => (
            <button
              key={c.spellId}
              className="gv-btn"
              onClick={() => add(
                c.effectType === 'healing'
                  // A heal fires on the trigger that makes it worth casting; an
                  // always-on heal burns the slot at full HP on turn one.
                  ? { action: 'cast', spellId: c.spellId, condition: { kind: 'allyHpBelow', pct: 0.4 }, target: 'lowestAlly' }
                  : { action: 'cast', spellId: c.spellId, condition: { kind: 'always' }, target: 'scoredEnemy' },
              )}
            >
              + {c.name}
            </button>
          ))}
        </p>
      )}

      {choices.abilities.length === 0 && choices.spells.length === 0 && (
        <p style={{ marginBottom: 0 }}>
          <span className="gv-marg">no abilities or spells learned yet — take a class feat at level-up</span>
        </p>
      )}
    </div>
  );
}
