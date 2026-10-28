import { DocumentStatusEvent } from '@techdocs/shared';
import { EventReplayBuffer } from './event-replay-buffer';

function event(n: number): DocumentStatusEvent {
  return { id: `doc-${n}`, status: 'INDEXED', occurredAt: `2026-01-01T00:00:${String(n).padStart(2, '0')}.000Z` };
}

describe('EventReplayBuffer', () => {
  it('assigns monotonic ids starting at 1', () => {
    const buffer = new EventReplayBuffer(3);

    expect(buffer.push(event(1)).id).toBe(1);
    expect(buffer.push(event(2)).id).toBe(2);
    expect(buffer.lastId).toBe(2);
  });

  it('replays every event after the given id, in order', () => {
    const buffer = new EventReplayBuffer(10);
    [1, 2, 3, 4].forEach((n) => buffer.push(event(n)));

    expect(buffer.since(2).map((entry) => entry.id)).toEqual([3, 4]);
    expect(buffer.since(0).map((entry) => entry.event.id)).toEqual(['doc-1', 'doc-2', 'doc-3', 'doc-4']);
    expect(buffer.since(4)).toEqual([]);
    expect(buffer.since(99)).toEqual([]);
  });

  it('keeps only the newest N events once full and keeps ids monotonic', () => {
    const buffer = new EventReplayBuffer(3);
    [1, 2, 3, 4, 5].forEach((n) => buffer.push(event(n)));

    expect(buffer.size).toBe(3);
    expect(buffer.since(0).map((entry) => entry.id)).toEqual([3, 4, 5]);
    expect(buffer.push(event(6)).id).toBe(6);
  });

  it('reports whether a client fell behind the buffer', () => {
    const buffer = new EventReplayBuffer(2);
    [1, 2, 3].forEach((n) => buffer.push(event(n)));

    // Id 1 was evicted: events after it are only partially available.
    expect(buffer.hasEvictedAfter(0)).toBe(true);
    expect(buffer.hasEvictedAfter(1)).toBe(false);
    expect(buffer.hasEvictedAfter(3)).toBe(false);
  });

  it('rejects a non-positive capacity', () => {
    expect(() => new EventReplayBuffer(0)).toThrow(RangeError);
  });
});
