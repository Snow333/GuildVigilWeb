/**
 * Shop v1 (brief #5, folded 1.5 debt): the week's seeded rotation per building,
 * buy at derived prices, sell from the stash at the sell fraction. Stock and
 * prices all derive sim-side; this screen is a till, not an economist.
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
    <div>
      <h1>Market row — week {session.currentWeek()} · {gold}g</h1>
      <p><button onClick={() => nav({ kind: 'town' })}>◂ Town</button> <small>stock rotates weekly</small></p>
      {lastError && <p><b>!</b> {lastError}</p>}

      {[...byBuilding.entries()].map(([buildingName, list]) => (
        <div key={buildingName}>
          <h3>{buildingName}</h3>
          <table border={1} cellPadding={4}>
            <tbody>
              {list.map((o) => (
                <tr key={o.offerIndex}>
                  <td>{o.derived.displayName}</td>
                  <td>{o.derived.slot ?? o.derived.itemType}</td>
                  <td>{o.derived.damageDice ? `dmg ${o.derived.damageDice}` : o.derived.acBonus ? `AC +${o.derived.acBonus}` : '—'}</td>
                  <td>{o.price}g</td>
                  <td>{o.remaining === null ? '∞' : `${o.remaining} left`}</td>
                  <td>
                    <button
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

      <h3>Sell from stash ({stash.length})</h3>
      <table border={1} cellPadding={4}>
        <tbody>
          {stash.map((v) => (
            <tr key={v.index}>
              <td>{v.derived.displayName}</td>
              <td>worth {v.derived.price}g</td>
              <td>sells for {v.sellPrice}g</td>
              <td><button onClick={() => exec((s) => s.sellItem(v.index))}>Sell</button></td>
            </tr>
          ))}
          {stash.length === 0 && <tr><td><em>nothing to sell — go earn something</em></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
