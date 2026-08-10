/**
 * Screen 9 — Settings stub (brief #5 §3): replay speed default + save management.
 */

import { useGame, type ReplaySpeed } from '../state/GameProvider';

export function SettingsScreen() {
  const { nav, defaultSpeed, setDefaultSpeed, saveGame, quitToTitle, slotId } = useGame();
  return (
    <div>
      <h1>Settings</h1>
      <p><button onClick={() => nav({ kind: 'town' })}>◂ Town</button></p>
      <h3>Default replay speed</h3>
      <p>
        {([1, 4, 16] as ReplaySpeed[]).map((s) => (
          <button key={s} disabled={defaultSpeed === s} onClick={() => setDefaultSpeed(s)}>{s}×</button>
        ))}
      </p>
      <h3>Saves</h3>
      <p>
        <button onClick={() => void saveGame()}>Save now{slotId ? ` (${slotId})` : ''}</button>{' '}
        <button onClick={quitToTitle}>Quit to title</button>
      </p>
      <p><small>Slot management lives on the title screen.</small></p>
    </div>
  );
}
