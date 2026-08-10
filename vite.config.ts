import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// Single-file artifact: the itch browser build and the Tauri-wrapped build are
// the SAME artifact, differing only in persistence backend (SaveStore impl).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@sim': fileURLToPath(new URL('./src/sim', import.meta.url)),
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
    },
  },
});
