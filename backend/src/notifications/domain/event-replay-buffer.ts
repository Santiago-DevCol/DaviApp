import { DocumentStatusEvent } from '@techdocs/shared';

/** A status event with the monotonic sequence number used as SSE `id`. */
export interface BufferedEvent {
  id: number;
  event: DocumentStatusEvent;
}

export const DEFAULT_REPLAY_CAPACITY = 200;

/**
 * Fixed-size ring buffer of the most recent status events. SSE clients that
 * reconnect send `Last-Event-ID`; `since()` returns what they missed while
 * offline, bounded by the capacity (a client that falls further behind simply
 * gets the newest events, see `hasEvictedAfter`). Ids never repeat within the
 * process lifetime; they restart at 1 when the process restarts.
 */
export class EventReplayBuffer {
  private readonly slots: Array<BufferedEvent | undefined>;
  private nextId = 1;
  private count = 0;

  constructor(private readonly capacity: number = DEFAULT_REPLAY_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(`capacity must be a positive integer, received ${capacity}`);
    }
    this.slots = new Array<BufferedEvent | undefined>(capacity);
  }

  push(event: DocumentStatusEvent): BufferedEvent {
    const entry: BufferedEvent = { id: this.nextId, event };
    this.slots[(entry.id - 1) % this.capacity] = entry;
    this.nextId += 1;
    this.count = Math.min(this.count + 1, this.capacity);
    return entry;
  }

  /** Events with an id strictly greater than `lastEventId`, oldest first. */
  since(lastEventId: number): BufferedEvent[] {
    const from = Math.max(this.oldestId, lastEventId + 1);
    const result: BufferedEvent[] = [];
    for (let id = from; id <= this.lastId; id += 1) {
      const entry = this.slots[(id - 1) % this.capacity];
      if (entry) {
        result.push(entry);
      }
    }
    return result;
  }

  /** True when events after `lastEventId` exist that the buffer no longer holds. */
  hasEvictedAfter(lastEventId: number): boolean {
    return lastEventId < this.lastId && lastEventId + 1 < this.oldestId;
  }

  get lastId(): number {
    return this.nextId - 1;
  }

  get size(): number {
    return this.count;
  }

  private get oldestId(): number {
    return this.count === 0 ? this.nextId : this.nextId - this.count;
  }
}
