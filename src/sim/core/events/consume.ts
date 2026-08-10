import type { EventType, SimEvent } from './types';

/**
 * Forward-tolerant stream consumption — the contract every consumer follows
 * (brief-event-vocabulary, decision 4): an unknown event type is skipped and
 * reported, never a crash. Consumers built on this helper survive saves and
 * summaries produced by NEWER builds that added event types.
 */

export type EventHandlers = {
  [T in EventType]?: (ev: SimEvent<T>) => void;
};

export interface ConsumeResult {
  handled: number;
  /** Types present in the stream that this consumer had no handler for. */
  unhandledTypes: string[];
}

export function consumeStream(events: readonly SimEvent[], handlers: EventHandlers): ConsumeResult {
  let handled = 0;
  const unhandled = new Set<string>();
  for (const ev of events) {
    const h = handlers[ev.type as EventType] as ((e: SimEvent) => void) | undefined;
    if (h) {
      h(ev);
      handled++;
    } else {
      unhandled.add(ev.type);
    }
  }
  return { handled, unhandledTypes: [...unhandled].sort() };
}
