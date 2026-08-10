/**
 * Guild Vigil shell — screen routing is a discriminated union in React state
 * (brief #5 §2): eight screens don't need URLs, and the Tauri wrap prefers no
 * history coupling. Screens join the switch as milestones land.
 */

import { GameProvider, useGame } from './state/GameProvider';
import { TitleScreen } from './screens/TitleScreen';
import { TownHub } from './screens/TownHub';

function Router() {
  const { screen } = useGame();
  switch (screen.kind) {
    case 'title':
      return <TitleScreen />;
    case 'town':
      return <TownHub />;
  }
}

export function App() {
  return (
    <main style={{ fontFamily: 'monospace', padding: 24 }}>
      <GameProvider>
        <Router />
      </GameProvider>
    </main>
  );
}
