import { createRoot } from 'react-dom/client';
import { App } from './App';
// Brief #8 (Cartographer's Table) style layer — tokens first, then materials,
// then grammar components. Bundled by vite-plugin-singlefile; no screen uses
// the classes until its rollout step converts it.
import './styles/tokens.css';
import './styles/materials.css';
import './styles/components.css';
import './styles/screens.css';

const el = document.getElementById('root');
if (!el) throw new Error('no #root');
createRoot(el).render(<App />);
