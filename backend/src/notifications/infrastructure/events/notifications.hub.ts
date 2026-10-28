import { DocumentStatusEvent } from '@techdocs/shared';
import { Observable, Subject } from 'rxjs';
import { BufferedEvent, EventReplayBuffer } from '../../domain/event-replay-buffer';

/**
 * In-process fan-out of document status events: every SSE connection
 * subscribes to `live$`, and the replay buffer serves reconnecting clients.
 * Being process-local, it only sees events produced by this instance; running
 * several API instances requires a shared channel (e.g. Postgres LISTEN/NOTIFY).
 * Registered through a factory in `NotificationsModule` (no Nest decorators).
 */
export class NotificationsHub {
  private readonly subject = new Subject<BufferedEvent>();

  constructor(private readonly buffer: EventReplayBuffer) {}

  publish(event: DocumentStatusEvent): BufferedEvent {
    const entry = this.buffer.push(event);
    this.subject.next(entry);
    return entry;
  }

  /** Events missed by a client whose last seen id is `lastEventId`. */
  replay(lastEventId: number): BufferedEvent[] {
    return this.buffer.since(lastEventId);
  }

  get live$(): Observable<BufferedEvent> {
    return this.subject.asObservable();
  }

  get lastId(): number {
    return this.buffer.lastId;
  }
}
