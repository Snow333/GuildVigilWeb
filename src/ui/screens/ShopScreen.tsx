/**
 * Shop v1 (brief #5, folded 1.5 debt): the week's seeded rotation per building,
 * buy at derived prices, sell from the stash at the sell fraction. Stock and
 * prices all derive sim-side; this screen is a till, not an economist.
 *
 * Brief #8 rollout: Market row — each building's stock is a pinned counter
 * ledger (actionable), the stash a pinned sell ledger beside them. Buy/Sell
 * stay plain buttons: the sell-back fraction makes trade reversible commerce,
 * not a wax-seal commitment. Errors surface as red-ink marginalia. Numbers
 * (prices, stock, gold) stay explicit everywhere.
 */

import { useGame } from '../state/GameProvider';

export function ShopScreen() {
  const { session, exec, nav, lastError } = useGame();
  if (!session) return null;
  const offers = session.shopStock();
  const stash = session.stashView();
  const gold = session.goldAmount();

  const byBuilding = new Map<string, typeof offers>();
  for (const o of offers) {
    const list = byBuilding.get(o.buildingName) ?? [];
    list.push(o);
    byBuilding.set(o.buildingName, list);
  }

  return (
    <div className="gv-desk" style={{ minHeight: '100vh', padding: '28px 18px 60px', margin: -24 }}>
      <div className="gv-shop">
        <h1>Market row — week {session.currentWeek()} · {gold}g</h1>
        <p style={{ margin: '0 0 14px' }}>
          <button className="gv-btn" onClick={() => nav({ kind: 'town' })}>◂ Town</button>{' '}
          <span className="gv-marg">stock rotates weekly</span>
        </p>
        {lastError && <p className="gv-marg" style={{ margin: '0 0 14px' }}><b>!</b> {lastError}</p>}

        <div className="gv-counters">
          {[...byBuilding.entries()].map(([buildingName, list]) => (
            <div className="gv-sheet gv-ledger" key={buildingName}>
              <span className="gv-pin" />
              <h3 className="gv-head">{buildingName} <span className="gv-sub">the counter</span></h3>
              <table>
                <thead>
                  <tr><th>Ware</th><th>Fits</th><th>Mark</th><th>Price</th><th>Stock</th><th></th></tr>
                </thead>
                <tbody>
                  {list.map((o) => (
                    <tr key={o.offerIndex}>
                      <td><b>{o.derived.displayName}</b></td>
                      <td>{o.derived.slot ?? o.derived.itemType}</td>
                      <td style={{ color: 'var(--gv-ink-muted)' }}>
                        {o.derived.damageDice ? `dmg ${o.derived.damageDice}` : o.derived.acBonus ? `AC +${o.derived.acBonus}` : '—'}
                      </td>
                      <td>{o.price}g</td>
                      <td>{o.remaining === null ? '∞' : `${o.remaining} left`}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="gv-btn"
                          disabled={gold < o.price || (o.remaining !== null && o.remaining <= 0)}
                          onClick={() => exec((s) => s.buyItem(o.offerIndex))}
                        >
                          Buy
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="gv-sheet gv-sheet--aged gv-ledger">
            <span className="gv-pin" />
            <h3 className="gv-head">Sell from stash <span className="gv-sub">{stash.length} carried</span></h3>
            <table>
              <tbody>
                {stash.map((v) => (
                  <tr key={v.index}>
                    <td><b>{v.derived.displayName}</b></td>
                    <td style={{ color: 'var(--gv-ink-muted)' }}>worth {v.derived.price}g</td>
                    <td>sells for {v.sellPrice}g</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="gv-btn" onClick={() => exec((s) => s.sellItem(v.index))}>Sell</button>
                    </td>
                  </tr>
                ))}
                {stash.length === 0 && <tr><td><em>nothing to sell — go earn something</em></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
