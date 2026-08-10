import { CONTENT_MANIFEST } from '@content/generated';
import { EVENT_TYPE_MANIFEST, SCHEMA_VERSION } from '@sim/core/events/types';

/**
 * Phase-2 placeholder shell. Its only current job: prove the registries and the
 * sim boundary wire up inside the single-file build.
 */
export function App() {
  const tables = Object.entries(CONTENT_MANIFEST).filter(([, n]) => n > 0);
  return (
    <main style={{ fontFamily: 'monospace', padding: 24 }}>
      <h1>Guild Vigil — sim scaffold</h1>
      <p>
        Event schema v{SCHEMA_VERSION} · {EVENT_TYPE_MANIFEST.length} event types ·{' '}
        {tables.length} populated content tables
      </p>
      <ul>
        {tables.map(([name, count]) => (
          <li key={name}>
            {name}: {count}
          </li>
        ))}
      </ul>
    </main>
  );
}
