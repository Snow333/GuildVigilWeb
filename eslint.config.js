// Guild Vigil — ESLint flat config.
// The src/sim boundary rule is architecture constraint #2: enforced at build time, not by convention.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'src/content/generated/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ── THE BOUNDARY ─────────────────────────────────────────────────────────
  // src/sim (and content) are pure TypeScript: no React, no DOM, no Tauri,
  // no browser globals, no ambient randomness or wall-clock time.
  {
    files: ['src/sim/**', 'src/content/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['react', 'react-dom', 'react/*', 'react-dom/*'], message: 'sim must not import React' },
          { group: ['**/ui/**', '**/platform/**'], message: 'sim must not import UI or platform code' },
          { group: ['@tauri-apps/*'], message: 'sim must not touch Tauri' },
          { group: ['*.css', '*.svg', '*.png'], message: 'sim must not import assets' },
        ],
      }],
      'no-restricted-globals': ['error',
        { name: 'window', message: 'no browser globals in sim' },
        { name: 'document', message: 'no browser globals in sim' },
        { name: 'localStorage', message: 'persistence goes through SaveStore' },
        { name: 'fetch', message: 'the sim does not do IO' },
        { name: 'requestAnimationFrame', message: 'the sim has no frames' },
      ],
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'all randomness through Rng (string-seeded)' },
        { object: 'Date', property: 'now', message: 'all time through the sim clock' },
      ],
      'no-restricted-syntax': ['error',
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'no wall-clock time in sim' },
      ],
    },
  },

  // Tests and tools run in Node and may do IO, but still no ambient randomness in sim tests.
  {
    files: ['tools/**', 'tests/**'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
