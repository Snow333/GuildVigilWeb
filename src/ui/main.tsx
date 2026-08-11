import { createRoot } from 'react-dom/client';
import { App } from './App';
// Brief #8 (Cartographer's Table) style layer — fonts (brief #9, generated
// data-URI @font-face) first, then tokens, materials, grammar components.
// Bundled by vite-plugin-singlefile into the one artifact.
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/materials.css';
import './styles/components.css';
import './styles/treatment.css';
import './styles/screens.css';

const el = document.getElementById('root');
if (!el) throw new Error('no #root');
createRoot(el).render(<App />);
