import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: {
    '@sim': fileURLToPath(new URL('./src/sim', import.meta.url)),
    '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
    '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
  } },
  test: { include: ['probe/**/*.probe.ts'], environment: 'node' },
});
