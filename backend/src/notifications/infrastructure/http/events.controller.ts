import { Controller, Headers, Inject, MessageEvent, Optional, Sse } from '@nestjs/common';
import { concat, defer, from, interval, map, merge, Observable, of } from 'rxjs';
import { BufferedEvent } from '../../domain/event-replay-buffer';
import { NotificationsHub } from '../events/notifications.hub';

export const DOCUMENT_STATUS_SSE_TYPE = 'document.status';
export const HEARTBEAT_SSE_TYPE = 'heartbeat';
export const HEARTBEAT_INTERVAL_MS = Symbol('HEARTBEAT_INTERVAL_MS');
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * `GET /events`: Server-Sent Events stream of document status changes.
 *
 * - Each status event carries `id` (monotonic sequence) so browsers resend it
 *   as `Last-Event-ID` on reconnect; missed events are replayed first, then the
 *   live stream continues. The stream is built inside `defer`, so the replay
 *   snapshot and the subscription to `live$` happen together at subscription
 *   time (Nest subscribes after the handler returns): nothing published in
 *   between is lost.
 * - A heartbeat event is merged every 15 s so idle connections survive proxies
 *   and load balancers that drop silent sockets. Nest assigns its own
 *   per-connection counter to id-less messages, which would corrupt the
 *   client's `Last-Event-ID`; the heartbeat therefore carries the hub's
 *   current sequence number, i.e. "you are caught up to here", so a reconnect
 *   after a quiet period replays exactly what happened since.
 * - One heartbeat is also sent right after the replay, before any live event.
 *   A fresh `EventSource` has no `Last-Event-ID` until it receives an id, so a
 *   drop inside the first heartbeat interval would reconnect with no cursor and
 *   silently skip whatever happened meanwhile; the baseline closes that window.
 *   It follows the replay (its id equals the last replayed id) so the client's
 *   cursor never jumps past events it has not received yet.
 * - Nest's SSE stream already sets `Content-Type: text/event-stream`,
 *   `Cache-Control: no-cache, no-store, ...` and `X-Accel-Buffering: no`.
 */
@Controller()
export class EventsController {
  private readonly heartbeatIntervalMs: number;

  constructor(
    private readonly hub: NotificationsHub,
    @Optional() @Inject(HEARTBEAT_INTERVAL_MS) heartbeatIntervalMs?: number,
  ) {
    this.heartbeatIntervalMs = heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  }

  @Sse('events')
  stream(@Headers('last-event-id') lastEventIdHeader?: string): Observable<MessageEvent> {
    const lastEventId = parseLastEventId(lastEventIdHeader);

    const statusEvents$ = defer(() => {
      const replayed = lastEventId === null ? [] : this.hub.replay(lastEventId);
      return concat(
        from(replayed).pipe(map(toMessageEvent)),
        of(this.heartbeat()),
        this.hub.live$.pipe(map(toMessageEvent)),
      );
    });
    const heartbeat$ = interval(this.heartbeatIntervalMs).pipe(map(() => this.heartbeat()));

    return merge(statusEvents$, heartbeat$);
  }

  /** "You are caught up to here": the id is the hub's current sequence number. */
  private heartbeat(): MessageEvent {
    return {
      id: String(this.hub.lastId),
      type: HEARTBEAT_SSE_TYPE,
      data: { ts: new Date().toISOString() },
    };
  }
}

function toMessageEvent(entry: BufferedEvent): MessageEvent {
  return { id: String(entry.id), type: DOCUMENT_STATUS_SSE_TYPE, data: entry.event };
}

/** `null` when absent or malformed: the client gets live events only. */
function parseLastEventId(header: string | undefined): number | null {
  if (header === undefined || header.trim() === '') {
    return null;
  }
  const value = Number(header);
  return Number.isInteger(value) && value >= 0 ? value : null;
}
