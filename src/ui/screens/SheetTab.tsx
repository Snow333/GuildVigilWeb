/**
 * THE CHARACTER SHEET — Variant G (brief #24).
 *
 * Replaces the old split of `sheet` and `gear` tabs with one surface, because
 * the question "what is my +1 sword doing?" is unanswerable when the sword and
 * the numbers live on different screens. The research finding that drove this:
 * the official PF2E paper sheet prints a stat's COMPONENTS under its total, so
 * legible attribution is period-authentic rather than in tension with the look.
 *
 * ── LAYOUT ────────────────────────────────────────────────────────────────
 *
 *   numbers (ledgers)  |  paperdoll  |  inspector
 *
 * ⚠ THE PAPERDOLL IS NOT DECORATION. Its job is to make EMPTY and
 * UNDERSERVED slots visible at a glance. Three states, each carrying shape AND
 * text so they survive greyscale and colour blindness:
 *   solid   — working
 *   dashed  — empty
 *   hatched — filled, but carrying a dead effect or a proficiency penalty
 *
 * ⚠ COLOUR IS NEVER THE ONLY CARRIER (WCAG 1.4.1). The six channels match the
 * combat record exactly, so red means offence in both places.
 */

import { useState } from 'react';
import { useGame } from '../state/GameProvider';
import { Portrait, hasPortrait } from '../portrait';
import { figures, hasFigure } from '@content/generated/figures';
import type { StatLedger, AttributionSlot } from '@sim/campaign/session';

/** Slot → the doll position, as percentages of the figure box. */
/**
 * ⚠ SLOTS SIT IN THE MARGINS, NOT ON THE BODY. The first layout centred
 * head/accessory/armour/boots down the figure's midline, and the screenshot
 * showed exactly why that fails: the labels landed ON the illustration, so
 * "HEAD" overlapped the hair and "BOOTS" overlapped the shins at barely any
 * contrast. The figure is now a BACKDROP the boxes flank in two columns.
 */
const SLOT_POS: Record<string, { left: string; top: string }> = {
  head: { left: '15%', top: '9%' },
  accessory: { left: '85%', top: '9%' },
  main_hand: { left: '15%', top: '33%' },
  off_hand: { left: '85%', top: '33%' },
  armor: { left: '15%', top: '57%' },
  ring: { left: '85%', top: '57%' },
  boots: { left: '15%', top: '81%' },
};

const SLOT_LABEL: Record<string, string> = {
  head: 'Head', accessory: 'Accessory', main_hand: 'Main hand',
  off_hand: 'Off hand', armor: 'Armour', ring: 'Ring', boots: 'Boots',
};

/**
 * One derived number with its sources printed underneath.
 *
 * ⚠ NEVER HOVER-GATED. PoE and Diablo hide breakdowns behind a hover because
 * their HUDs are space-starved; a paper sheet has room, and hover-only data is
 * invisible on touch, unreachable by keyboard, and forces the reader to hold
 * numbers in working memory to compare them.
 */
function Ledger({ name, ledger, big }: { name: string; ledger: StatLedger; big?: boolean }) {
  return (
    <div className="gv-led">
      <div className="gv-led-top">
        <span className="gv-led-name">{name}</span>
        <span className={big ? 'gv-led-total' : 'gv-led-total gv-led-total--sm'}>
          {ledger.total >= 0 && name !== 'Armour class' && name !== 'Hit points' && name !== 'Speed'
            ? `+${ledger.total}`
            : ledger.total}
        </span>
      </div>
      {ledger.terms.map((t, i) => (
        <div className="gv-led-row" key={i} data-category={t.category}>
          <span className="gv-led-src">{t.label}</span>
          <span className="gv-led-cat">{t.category}</span>
          <span className="gv-led-val">{t.value >= 0 ? `+${t.value}` : t.value}</span>
        </div>
      ))}
    </div>
  );
}

function SlotBox({
  slot, selected, onSelect,
}: { slot: AttributionSlot; selected: boolean; onSelect: () => void }) {
  const pos = SLOT_POS[slot.slot] ?? { left: '50%', top: '50%' };
  const contribution = slot.contributions.find((c) => c.kind === 'ac' || c.kind === 'attack');
  return (
    <button
      type="button"
      className="gv-dslot"
      data-state={slot.state}
      data-slot={slot.slot}
      aria-pressed={selected}
      style={{ left: pos.left, top: pos.top }}
      onClick={onSelect}
    >
      <span className="gv-dlabel">{SLOT_LABEL[slot.slot] ?? slot.slot}</span>
      <span className="gv-dbox" data-selected={selected ? 'yes' : 'no'}>
        <span className="gv-dnm">{slot.name ?? 'empty'}</span>
        {contribution && <span className="gv-dco">{contribution.detail}</span>}
      </span>
      {/*
        ⚠ THE BADGE IS THE NON-COLOUR CARRIER. '!' marks a slot that looks
        equipped but is not pulling its weight; '+' marks an empty slot the
        stash can actually fill. An empty slot with nothing to put in it gets
        no badge, because it is not a problem the player can act on.
      */}
      {slot.state === 'underserved' && <span className="gv-dwarn" title="not pulling its weight">!</span>}
      {slot.state === 'empty' && slot.stashOptions > 0 && (
        <span className="gv-dwarn gv-dwarn--gap" title={`${slot.stashOptions} in the stash`}>+</span>
      )}
    </button>
  );
}

export function SheetTab({ heroId }: { heroId: string }) {
  const { session, exec } = useGame();
  const s = session!.heroSheet(heroId);
  const a = session!.heroAttribution(heroId);
  const [picked, setPicked] = useState<string | null>(null);

  const selected = a.slots.find((x) => x.slot === picked) ?? null;
  const gaps = a.slots.filter((x) => x.state === 'underserved' || (x.state === 'empty' && x.stashOptions > 0));
  const figureKey = s.portraitKey;

  return (
    <div className="gv-sheetg">
      {/* ── identity band ── */}
      <div className="gv-sheet gv-sheet--aged" style={{ ['--gv-tilt' as never]: '0.2deg' }}>
        <span className="gv-tape" />
        <div className="gv-idbar">
          {hasPortrait(s.portraitKey)
            ? <Portrait portraitKey={s.portraitKey} alt="" size="lg" />
            : <div className="gv-avatar-fallback">{s.name.slice(0, 1)}</div>}
          <div className="gv-idtext">
            <h2 className="gv-idname">{s.name}</h2>
            <div className="gv-idsub">
              {s.ancestryName} · {s.classes.map((c) => `${c.name} ${c.level}`).join(' / ')}
            </div>
            <div className="gv-xpwrap">
              <div className="gv-xpbar">
                <i style={{ width: `${Math.round(s.xp.progress * 100)}%` }} />
              </div>
              <div className="gv-xplabel">
                <span>{s.xp.currentXp} / {s.xp.threshold} xp</span>
                {s.canLevelUp && <span className="gv-ready">level up ready</span>}
              </div>
            </div>
          </div>
          <div className="gv-kpis">
            <div className="gv-kpi" data-ch="defence">
              <span className="gv-kpi-k">Armour</span><span className="gv-kpi-v">{a.ac.total}</span>
            </div>
            <div className="gv-kpi" data-ch="resource">
              <span className="gv-kpi-k">Health</span><span className="gv-kpi-v">{a.hp.total}</span>
            </div>
            <div className="gv-kpi" data-ch="harm">
              <span className="gv-kpi-k">Attack</span>
              <span className="gv-kpi-v">{a.attack.total >= 0 ? `+${a.attack.total}` : a.attack.total}</span>
            </div>
            <div className="gv-kpi" data-ch="magic">
              <span className="gv-kpi-k">Speed</span><span className="gv-kpi-v">{a.speed.total}</span>
            </div>
          </div>
        </div>

        {/*
          ⚠ SCORE ON TOP, MODIFIER BENEATH — Steven's call, 2026-09-12.
          The earlier draft inverted this to emphasise the modifier (the value
          that appears in every ledger below). He wants the raw score to lead.
        */}
        <div className="gv-abils">
          {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((k) => (
            <div className="gv-abil" key={k}>
              <span className="gv-abil-k">{k}</span>
              <span className="gv-abil-score">{s.abilities[k].score}</span>
              <span className="gv-abil-mod">
                {s.abilities[k].mod >= 0 ? `+${s.abilities[k].mod}` : s.abilities[k].mod}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── the three columns ── */}
      <div className="gv-gcols">
        {/* numbers */}
        <div className="gv-sheet gv-sheet--aged">
          <h3 className="gv-head">Defence <span className="gv-sub">where each number comes from</span></h3>
          <Ledger name="Armour class" ledger={a.ac} big />
          <Ledger name="Hit points" ledger={a.hp} />
          <Ledger name="Fortitude" ledger={a.fort} />
          <Ledger name="Reflex" ledger={a.ref} />
          <Ledger name="Will" ledger={a.will} />

          <h3 className="gv-head" style={{ marginTop: 16 }}>Offence</h3>
          <Ledger name="Strike attack" ledger={a.attack} big />
          {a.attackPenalties.terms.length > 0 && (
            <Ledger name="Attack penalties" ledger={a.attackPenalties} />
          )}
          <div className="gv-led">
            <div className="gv-led-top">
              <span className="gv-led-name">Strike damage</span>
              <span className="gv-led-total gv-led-total--sm">{s.damageDice}</span>
            </div>
          </div>
          <Ledger name="Speed" ledger={a.speed} />
        </div>

        {/* paperdoll */}
        <div className="gv-sheet gv-sheet--aged">
          <h3 className="gv-head">
            Worn <span className="gv-sub">
              {a.slots.filter((x) => x.state !== 'empty').length} of {a.slots.length} slots
            </span>
          </h3>
          <div className="gv-doll">
            {hasFigure(figureKey)
              ? <img className="gv-doll-figure" src={figures[figureKey]} alt="" />
              : <div className="gv-doll-figure gv-doll-figure--none" />}
            {a.slots.map((slot) => (
              <SlotBox
                key={slot.slot}
                slot={slot}
                selected={picked === slot.slot}
                onSelect={() => setPicked(slot.slot === picked ? null : slot.slot)}
              />
            ))}
          </div>
          <div className="gv-dollkey">
            <span><i className="gv-sw" data-state="filled" /> working</span>
            <span><i className="gv-sw" data-state="empty" /> empty</span>
            <span><i className="gv-sw" data-state="underserved" /> underserved</span>
          </div>

          {/* ── the pouch: the FIRST way to stock a consumable (brief #23 M3) ── */}
          <h3 className="gv-head" style={{ marginTop: 14 }}>
            Pouch <span className="gv-sub">
              {a.quickSlots.filter((q) => q.name).length} of {a.quickSlots.length} · used in combat
            </span>
          </h3>
          <div className="gv-qs">
            {a.quickSlots.map((q) => (
              <div className="gv-qslot" key={q.index} data-filled={q.name ? 'yes' : 'no'}>
                <span className="gv-qidx">{q.index + 1}</span>
                {q.name
                  ? (
                    <>
                      <span className="gv-qnm">{q.name}</span>
                      {!q.usable && <span className="gv-badge gv-badge--dead">inert</span>}
                      <button
                        className="gv-btn gv-btn--tiny"
                        onClick={() => exec((sess) => sess.clearQuickSlot(heroId, q.index))}
                      >
                        clear
                      </button>
                    </>
                  )
                  : <span className="gv-qempty">empty</span>}
              </div>
            ))}
          </div>
          {a.pouchOptions.length > 0 && (
            <div className="gv-pouchpick">
              <span className="gv-choice-label">add to pouch</span>
              {a.pouchOptions.slice(0, 6).map((o) => {
                const free = a.quickSlots.find((q) => !q.name);
                return (
                  <button
                    key={o.stashIndex}
                    className="gv-btn gv-btn--tiny"
                    disabled={!free}
                    title={o.usable ? '' : 'the engine cannot use this yet'}
                    data-pouch-option={o.stashIndex}
                    onClick={() => free && exec((sess) => sess.setQuickSlot(heroId, free.index, o.stashIndex))}
                  >
                    {o.name}{o.usable ? '' : ' (inert)'}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* inspector */}
        <div className="gv-sheet gv-sheet--aged">
          {selected
            ? (
              <>
                <h3 className="gv-head">
                  {SLOT_LABEL[selected.slot] ?? selected.slot} <span className="gv-sub">selected</span>
                </h3>
                <div className="gv-insp-name">{selected.name ?? 'empty'}</div>
                {selected.contributions.length === 0 && (
                  <p className="gv-insp-none">
                    {selected.state === 'empty'
                      ? (selected.stashOptions > 0
                        ? `Nothing worn. ${selected.stashOptions} item(s) in the stash would fit here.`
                        : 'Nothing worn, and nothing in the stash fits this slot yet.')
                      : 'This item contributes nothing the sheet can describe.'}
                  </p>
                )}
                {selected.contributions.map((c, i) => (
                  <div className="gv-effect" key={i} data-live={c.live ? 'yes' : 'no'}>
                    <span className="gv-dot" data-kind={c.kind} />
                    <span className="gv-effect-body">
                      {c.label}
                      <span className={c.live ? 'gv-badge gv-badge--live' : 'gv-badge gv-badge--dead'}>
                        {c.live ? 'active' : 'not built'}
                      </span>
                      <small>{c.detail}</small>
                    </span>
                  </div>
                ))}
                {selected.name && (
                  <button
                    className="gv-btn"
                    style={{ marginTop: 10 }}
                    onClick={() => exec((sess) => sess.unequip(heroId, selected.slot))}
                  >
                    Unequip ▸ stash
                  </button>
                )}
              </>
            )
            : (
              <>
                <h3 className="gv-head">The gear <span className="gv-sub">pick a slot to inspect it</span></h3>
                <p className="gv-insp-none">
                  Every worn item, and what each one is doing to the numbers on the left.
                </p>
              </>
            )}

          {/*
            ⚠ THE GAP LIST IS DERIVED, NEVER AUTHORED. It is simply every slot
            that is empty-and-fillable or carrying something inert, so it cannot
            fall out of date with the rules the way a hand-written hint would.
          */}
          {gaps.length > 0 && (
            <div className="gv-gaps">
              <b>{gaps.length} slot{gaps.length === 1 ? '' : 's'} want attention</b>
              <ul>
                {gaps.map((g) => (
                  <li key={g.slot}>
                    <b>{SLOT_LABEL[g.slot] ?? g.slot}</b>
                    {g.state === 'underserved'
                      ? ' — carries something the game ignores'
                      : ` — empty, ${g.stashOptions} in the stash`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── the stash, below the fold ── */}
      <div className="gv-sheet gv-sheet--aged gv-ledger">
        <h3 className="gv-head">The guild stores <span className="gv-sub">shared by every hero</span></h3>
        <StashRows heroId={heroId} />
      </div>
    </div>
  );
}

/** The stash, with each row's slot so the player can see where it would go. */
function StashRows({ heroId }: { heroId: string }) {
  const { session, exec } = useGame();
  const stash = session!.stashView();
  if (stash.length === 0) return <p className="gv-insp-none">The stores are empty.</p>;
  return (
    <table className="gv-stash">
      <tbody>
        {stash.map((row, i) => (
          <tr key={i}>
            <td className="gv-stash-nm">{row.derived.displayName}</td>
            <td className="gv-stash-slot">{row.derived.slot ?? 'not equippable'}</td>
            <td className="gv-stash-act">
              {row.derived.slot && (
                <button className="gv-btn gv-btn--tiny" onClick={() => exec((s) => s.equip(heroId, i))}>
                  ◂ Equip
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
