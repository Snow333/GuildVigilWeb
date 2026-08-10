import { describe, expect, it } from 'vitest';
import { EventStream } from '@sim/core/events/stream';
import { EVENT_TYPE_MANIFEST } from '@sim/core/events/types';
import { interpretEvent, interpretStream } from '../../src/ui/beats/interpret';
import { buildFixtureDispatch } from '../fixtures/dispatch-fixture';

/**
 * THE PHASE 2 EXIT CRITERION (brief #5 §4): text-identical replay. The snapshot
 * below pins interpret's output over the frozen contract fixture — any text
 * change is a deliberate presentation change and must justify the snapshot diff.
 * (The DOM half of the criterion is the 2.4 Playwright assertion.)
 */

describe('beat feed — the presentation contract', () => {
  it('SNAPSHOT: the contract fixture renders text-identically, forever', () => {
    const feed = interpretStream(buildFixtureDispatch());
    expect(feed.skipped).toBe(0); // the fixture speaks only the frozen vocabulary
    expect(feed.lines.map((l) => `${l.tick} [${l.tone}] ${l.text}`)).toMatchSnapshot();
  });

  it('is deterministic: same stream → same lines', () => {
    const a = interpretStream(buildFixtureDispatch());
    const b = interpretStream(buildFixtureDispatch());
    expect(a).toEqual(b);
  });

  it('is total over the FROZEN vocabulary: every manifest type produces a line or a deliberate null', () => {
    for (const type of EVENT_TYPE_MANIFEST) {
      const ev = { seq: 0, tick: 0, type, data: {} };
      // Payloads are empty stubs — a throw here means a case reads fields
      // without existing, which the real stream always provides; what we assert
      // is coverage: NO type may fall through the switch as undefined.
      let line: unknown;
      try {
        line = interpretEvent(ev as never);
      } catch {
        line = null; // a stub-induced field read is fine; fall-through is not
      }
      expect(line, `unhandled event type ${type}`).not.toBeUndefined();
    }
  });

  it('skip-and-counts unknown types (forward tolerance), never crashes', () => {
    const s = new EventStream('dispatch', 'disp_x');
    s.emit(0, 'dispatch.started', { dispatchId: 'disp_x', partyId: 'party_1', profile: 'fullExplore', caution: 'standard' });
    // A future, post-freeze event type arrives from a newer save/stream:
    (s as unknown as { events: unknown[] }).events.push({ seq: 99, tick: 5, type: 'explore.future_thing', data: {} });
    const feed = interpretStream(s);
    expect(feed.lines).toHaveLength(1);
    expect(feed.skipped).toBe(1);
    expect(feed.skippedTypes).toEqual(['explore.future_thing']);
  });

  it('resolves names through the provided resolver', () => {
    const feed = interpretStream(buildFixtureDispatch(), (id) => (id === 'hero_2' ? 'Shade' : id));
    expect(feed.lines.some((l) => l.text.includes('Shade spots a trap'))).toBe(true);
  });
});
