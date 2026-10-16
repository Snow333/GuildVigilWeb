import { useState } from 'react';
import type { LoadoutCondition, LoadoutTargetSpec } from '@sim/combat/loadout';
import type { PlanRule, SpellPlan } from '@sim/heroes/spellPlan';
import { useGame } from '../state/GameProvider';

/**
 * M2 — the caster's spell page. Two parts:
 *  1. "Prepared" — which spells are in the fight plan. Prepared casters
 *     (Cleric, Wizard) see one slot counter per spell level and cannot go over.
 *  2. "Casting order" — the planned spells top to bottom, the order the hero
 *     tries them in a fight, each with a plain WHEN and AT WHOM.
 * Everything here writes the loadout through session methods; the sim
 * enforces the limits, so this screen cannot create an illegal plan.
 */

type WhenKey = 'always' | 'allyHurt' | 'selfHurt' | 'once' | 'close';

const WHEN_LABEL: Record<WhenKey, string> = {
  always: 'every turn it can',
  allyHurt: 'when an ally is below 40% health',
  selfHurt: 'when I am below 40% health',
  once: 'once, if not already up',
  close: 'when an enemy is close',
};

const TARGET_LABEL: Record<LoadoutTargetSpec, string> = {
  scoredEnemy: 'the best enemy',
  nearestEnemy: 'the nearest enemy',
  lowestAlly: 'the most hurt ally',
  self: 'myself',
};

const EFFECT_WORD: Record<string, string> = {
  damage: 'damage', healing: 'heal', buff: 'buff', debuff: 'weaken',
};

function whenOf(c: LoadoutCondition): WhenKey {
  if (c.kind === 'allyHpBelow') return 'allyHurt';
  if (c.kind === 'selfHpBelow') return 'selfHurt';
  if (c.kind === 'notActive') return 'once';
  if (c.kind === 'enemyWithin') return 'close';
  return 'always';
}

function conditionFor(key: WhenKey, current: LoadoutCondition, rule: PlanRule): LoadoutCondition {
  switch (key) {
    case 'allyHurt': return { kind: 'allyHpBelow', pct: 0.4 };
    case 'selfHurt': return { kind: 'selfHpBelow', pct: 0.4 };
    case 'close': return { kind: 'enemyWithin', range: 2 };
    case 'once':
      return current.kind === 'notActive' ? current : { kind: 'notActive', conditionId: `spell_${rule.spellId}` };
    default: return { kind: 'always' };
  }
}

/** Which "when" choices make sense for this spell. "once" needs a condition the spell applies. */
function whenChoices(rule: PlanRule): WhenKey[] {
  const base: WhenKey[] = ['always', 'allyHurt', 'selfHurt', 'close'];
  return rule.condition.kind === 'notActive' ? ['once', ...base] : base;
}

function targetChoices(rule: PlanRule): LoadoutTargetSpec[] {
  return rule.effectType === 'healing' || rule.effectType === 'buff'
    ? ['lowestAlly', 'self']
    : ['scoredEnemy', 'nearestEnemy'];
}

const levelName = (lvl: number): string => (lvl === 0 ? 'Cantrips' : `Level ${lvl}`);

export function SpellsTab({ heroId }: { heroId: string }) {
  const { session, exec } = useGame();
  const [error, setError] = useState<string | null>(null);
  const plan: SpellPlan | null = session!.spellPlan(heroId);
  if (!plan) {
    return (
      <div className="gv-sheet gv-sheet--aged gv-ledger">
        <span className="gv-tape" />
        <p style={{ margin: 0 }}><span className="gv-marg">This hero does not cast spells.</span></p>
      </div>
    );
  }

  const run = (fn: () => void): void => {
    try { fn(); setError(null); } catch (e) { setError(e instanceof Error ? e.message.replace(/^\w+: /, '') : String(e)); }
  };
  const toggle = (spellId: number): void => run(() => exec((s) => s.toggleSpellPlanned(heroId, spellId)));
  const move = (rule: PlanRule, dir: -1 | 1): void => run(() => exec((s) => s.moveSpellInPlan(heroId, rule.loadoutIndex, dir)));
  const setRule = (rule: PlanRule, condition: LoadoutCondition, target: LoadoutTargetSpec): void =>
    run(() => exec((s) => s.setSpellPlanRule(heroId, rule.loadoutIndex, condition, target)));

  const how = plan.access === 'divine_list'
    ? `Your god grants every ${plan.className} spell you can cast. Choose which to prepare: one per slot.`
    : plan.access === 'spellbook'
      ? 'Your spellbook grows when you level up. Choose which spells to prepare: one per slot.'
      : 'You can cast any spell you know. Choose which ones to use in a fight.';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.15fr)', gap: 22, alignItems: 'start' }}>
      <div className="gv-sheet gv-sheet--aged gv-ledger" data-spell-prepare="" style={{ ['--gv-tilt' as never]: '-0.3deg' }}>
        <span className="gv-tape" />
        <h3 className="gv-head">Prepared spells <span className="gv-sub">{plan.className}</span></h3>
        <p style={{ margin: '0 0 12px', fontSize: 14 }}>{how}</p>
        {plan.levels.map((lvl) => {
          const full = lvl.limit !== null && lvl.spellLevel > 0 && lvl.planned >= lvl.limit;
          return (
            <div key={lvl.spellLevel} data-spell-level={lvl.spellLevel} style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '6px 0 4px', fontSize: 14 }}>
                {levelName(lvl.spellLevel)}
                <span style={{ fontWeight: 400 }}>
                  {' — '}
                  {lvl.spellLevel === 0 || lvl.limit === null
                    ? `${lvl.planned} in use`
                    : `${lvl.planned} of ${lvl.limit} slots prepared`}
                </span>
                {lvl.limit !== null && lvl.spellLevel > 0 && lvl.planned < lvl.limit && (
                  <span className="gv-marg" style={{ fontWeight: 400, fontSize: 12.5 }}> · {lvl.limit - lvl.planned} empty</span>
                )}
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {lvl.spells.map((sp) => (
                  <button
                    key={sp.spellId}
                    className={sp.inPlan ? 'gv-btn gv-btn--seal' : 'gv-btn'}
                    data-spell-toggle={sp.spellId}
                    aria-pressed={sp.inPlan}
                    disabled={!sp.inPlan && full}
                    title={sp.description}
                    onClick={() => toggle(sp.spellId)}
                  >
                    {sp.inPlan ? '✓ ' : ''}{sp.name}
                    <span style={{ fontSize: 11.5, opacity: 0.8 }}> · {EFFECT_WORD[sp.effectType] ?? sp.effectType}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {error && <p className="gv-marg" role="alert" style={{ margin: '6px 0 0' }}>{error}</p>}
      </div>

      <div className="gv-sheet gv-ledger" data-spell-order="" style={{ ['--gv-tilt' as never]: '0.25deg' }}>
        <span className="gv-tape" />
        <h3 className="gv-head">Casting order <span className="gv-sub">tries the top spell first</span></h3>
        {plan.priority.length === 0 && <p><span className="gv-marg">No spells prepared. The hero will only use weapons.</span></p>}
        <ol style={{ margin: 0, paddingLeft: 22 }}>
          {plan.priority.map((rule, i) => (
            <li key={rule.loadoutIndex} data-spell-rule={rule.spellId} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <b style={{ minWidth: 130 }}>{rule.name}</b>
                <span className="gv-sub">{levelName(rule.spellLevel).toLowerCase()} · {EFFECT_WORD[rule.effectType] ?? rule.effectType}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <button className="gv-btn" aria-label={`Move ${rule.name} up`} disabled={i === 0} onClick={() => move(rule, -1)}>▲</button>
                  <button className="gv-btn" aria-label={`Move ${rule.name} down`} disabled={i === plan.priority.length - 1} onClick={() => move(rule, 1)}>▼</button>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13.5, marginTop: 4 }}>
                <label>
                  Cast{' '}
                  <select
                    className="gv-select"
                    data-spell-when={rule.spellId}
                    value={whenOf(rule.condition)}
                    onChange={(e) => setRule(rule, conditionFor(e.target.value as WhenKey, rule.condition, rule), rule.target)}
                  >
                    {whenChoices(rule).map((k) => <option key={k} value={k}>{WHEN_LABEL[k]}</option>)}
                  </select>
                </label>
                <label>
                  at{' '}
                  <select
                    className="gv-select"
                    data-spell-target={rule.spellId}
                    value={rule.target}
                    onChange={(e) => setRule(rule, rule.condition, e.target.value as LoadoutTargetSpec)}
                  >
                    {targetChoices(rule).map((t) => <option key={t} value={t}>{TARGET_LABEL[t]}</option>)}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ol>
        <p className="gv-sub" style={{ margin: '8px 0 0' }}>
          If no spell fits, or the slots run out, the hero falls back to the next line, then to a weapon.
        </p>
      </div>
    </div>
  );
}
