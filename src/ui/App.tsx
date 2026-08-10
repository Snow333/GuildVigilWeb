/**
 * Guild Vigil shell — screen routing is a discriminated union in React state
 * (brief #5 §2): the screens don't need URLs, and the Tauri wrap prefers no
 * history coupling.
 */

import { GameProvider, useGame } from './state/GameProvider';
import { TitleScreen } from './screens/TitleScreen';
import { TownHub } from './screens/TownHub';
import { HeroPanel } from './screens/HeroPanel';
import { QuestBoard } from './screens/QuestBoard';
import { DispatchSetup } from './screens/DispatchSetup';
import { WorldMapScreen } from './screens/WorldMapScreen';
import { ShopScreen } from './screens/ShopScreen';
import { PlaybackScreen } from './screens/PlaybackScreen';
import { AfterActionScreen } from './screens/AfterActionScreen';
import { SettingsScreen } from './screens/SettingsScreen';

function Router() {
  const { screen } = useGame();
  switch (screen.kind) {
    case 'title':
      return <TitleScreen />;
    case 'town':
      return <TownHub />;
    case 'hero':
      return <HeroPanel heroId={screen.heroId} />;
    case 'board':
      return <QuestBoard />;
    case 'dispatch':
      return <DispatchSetup />;
    case 'map':
      return <WorldMapScreen questId={screen.questId} />;
    case 'shop':
      return <ShopScreen />;
    case 'playback':
      return <PlaybackScreen />;
    case 'afterAction':
      return <AfterActionScreen />;
    case 'settings':
      return <SettingsScreen />;
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
