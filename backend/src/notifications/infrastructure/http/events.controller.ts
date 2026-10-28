import { Controller, Headers, Inject, MessageEvent, Optional, Sse } from '@nestjs/common';
import { concat, from, interval, map, merge, Observable } from 'rxjs';
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
 *   live stream continues. The two are concatenated synchronously, so nothing
 *   published in between is lost.
 * - A heartbeat event is merged every 15 s so idle connections survive proxies
 *   and load balancers that drop silent sockets. Nest assigns its own
 *   per-connection counter to id-less messages, which would corrupt the
 *   client's `Last-Event-ID`; the heartbeat therefore carries the hub's
 *   current sequence number, i.e. "you are caught up to here", so a reconnect
 *   after a quiet period replays exactly what happened since.
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
    const replayed = lastEventId === null ? [] : this.hub.replay(lastEventId);

    const statusEvents$ = concat(from(replayed), this.hub.live$).pipe(map(toMessageEvent));
    const heartbeat$ = interval(this.heartbeatIntervalMs).pipe(
      map(
        (): MessageEvent => ({
          id: String(this.hub.lastId),
          type: HEARTBEAT_SSE_TYPE,
          data: { ts: new Date().toISOString() },
        }),
      ),
    );

    return merge(statusEvents$, heartbeat$);
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
