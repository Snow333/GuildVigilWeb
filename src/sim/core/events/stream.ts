import type { EventPayloads, EventType, SimEvent, StreamHead } from './types';
import { SCHEMA_VERSION } from './types';

/**
 * Append-only, single-writer event stream. Ordering is (tick, seq); seq alone
 * is sufficient because the sim is synchronous — emission order IS resolution order.
 */
export class EventStream {
  readonly head: StreamHead;
  private events: SimEvent[] = [];
  private nextSeq = 0;

  constructor(streamKind: StreamHead['streamKind'], originId: string) {
    this.head = { schemaVersion: SCHEMA_VERSION, streamKind, originId };
  }

  emit<T extends EventType>(tick: number, type: T, data: EventPayloads[T], cause?: number): SimEvent<T> {
    const prev = this.events[this.events.length - 1];
    if (prev && tick < prev.tick) {
      throw new Error(`EventStream: time went backwards (${prev.tick} -> ${tick}) emitting ${type}`);
    }
    // Cast: the distributive conditional in SimEvent<T> stays deferred for a
    // generic T; the shape is exactly the resolved branch.
    const ev = (cause === undefined
      ? { seq: this.nextSeq++, tick, type, data }
      : { seq: this.nextSeq++, tick, type, cause, data }) as SimEvent<T>;
    this.events.push(ev as SimEvent);
    return ev;
  }

  get length(): number {
    return this.events.length;
  }

  all(): readonly SimEvent[] {
    return this.events;
  }

  byType<T extends EventType>(type: T): SimEvent<T>[] {
    return this.events.filter((e): e is SimEvent<T> => e.type === type);
  }

  at(seq: number): SimEvent | undefined {
    return this.events[seq];
  }

  /**
   * Walk the cause chain from an event back to its root.
   * A dangling cause (regeneration mismatch) terminates the walk — never throws.
   */
  chainOf(seq: number): SimEvent[] {
    const chain: SimEvent[] = [];
    let cur = this.at(seq);
    const guard = new Set<number>();
    while (cur && !guard.has(cur.seq)) {
      guard.add(cur.seq);
      chain.unshift(cur);
      cur = cur.cause === undefined ? undefined : this.at(cur.cause);
    }
    return chain;
  }

  /** All events whose direct cause is `seq`. */
  effectsOf(seq: number): SimEvent[] {
    return this.events.filter((e) => e.cause === seq);
  }

  /** Deterministic content hash for replay verification (FNV-1a over JSON). */
  hash(): string {
    let h = 0x811c9dc5;
    const s = JSON.stringify(this.events);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}
