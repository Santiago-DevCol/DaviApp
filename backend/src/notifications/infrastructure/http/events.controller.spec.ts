import { MessageEvent } from '@nestjs/common';
import { DocumentStatusEvent } from '@techdocs/shared';
import { filter, firstValueFrom, skip, take, toArray } from 'rxjs';
import { EventReplayBuffer } from '../../domain/event-replay-buffer';
import { NotificationsHub } from '../events/notifications.hub';
import { DOCUMENT_STATUS_SSE_TYPE, EventsController, HEARTBEAT_SSE_TYPE } from './events.controller';

const isStatus = (message: MessageEvent) => message.type === DOCUMENT_STATUS_SSE_TYPE;

function statusEvent(id: string, status: DocumentStatusEvent['status'] = 'INDEXED'): DocumentStatusEvent {
  return { id, status, occurredAt: '2026-01-01T00:00:00.000Z' };
}

describe('EventsController', () => {
  let hub: NotificationsHub;

  beforeEach(() => {
    hub = new NotificationsHub(new EventReplayBuffer(5));
  });

  it('emits live hub events as document.status messages with a monotonic id', async () => {
    const controller = new EventsController(hub, 60_000);
    const received = firstValueFrom(
      controller.stream(undefined).pipe(filter(isStatus), take(2), toArray()),
    );

    hub.publish(statusEvent('doc-1'));
    hub.publish(statusEvent('doc-2', 'ERROR'));

    const messages = await received;
    expect(messages).toEqual<MessageEvent[]>([
      { id: '1', type: DOCUMENT_STATUS_SSE_TYPE, data: statusEvent('doc-1') },
      { id: '2', type: DOCUMENT_STATUS_SSE_TYPE, data: statusEvent('doc-2', 'ERROR') },
    ]);
  });

  it('sends an immediate heartbeat carrying the current last id on connect', async () => {
    hub.publish(statusEvent('doc-1'));
    hub.publish(statusEvent('doc-2'));
    const controller = new EventsController(hub, 60_000);

    const first = await firstValueFrom(controller.stream(undefined));

    expect(first).toMatchObject({ type: HEARTBEAT_SSE_TYPE, id: '2' });
  });

  it('takes the baseline id at subscription time, not when the stream is built', async () => {
    const controller = new EventsController(hub, 60_000);
    const stream$ = controller.stream(undefined);
    hub.publish(statusEvent('doc-1'));

    const first = await firstValueFrom(stream$);

    expect(first).toMatchObject({ type: HEARTBEAT_SSE_TYPE, id: '1' });
  });

  it('snapshots the replay at subscription time so events published in between are replayed', async () => {
    hub.publish(statusEvent('doc-1'));
    const controller = new EventsController(hub, 60_000);
    const stream$ = controller.stream('1');
    hub.publish(statusEvent('doc-2'));

    const messages = await firstValueFrom(stream$.pipe(take(2), toArray()));

    expect(messages.map((message) => [message.type, message.id])).toEqual([
      [DOCUMENT_STATUS_SSE_TYPE, '2'],
      [HEARTBEAT_SSE_TYPE, '2'],
    ]);
  });

  it('replays the events after Last-Event-ID before the live ones', async () => {
    hub.publish(statusEvent('doc-1'));
    hub.publish(statusEvent('doc-2'));
    hub.publish(statusEvent('doc-3'));
    const controller = new EventsController(hub, 60_000);

    const received = firstValueFrom(controller.stream('1').pipe(take(4), toArray()));
    hub.publish(statusEvent('doc-4'));

    const messages = await received;
    // Replay first, then the baseline heartbeat (cursor = end of replay), then live.
    expect(messages.map((message) => [message.type, message.id])).toEqual([
      [DOCUMENT_STATUS_SSE_TYPE, '2'],
      [DOCUMENT_STATUS_SSE_TYPE, '3'],
      [HEARTBEAT_SSE_TYPE, '3'],
      [DOCUMENT_STATUS_SSE_TYPE, '4'],
    ]);
    expect(
      messages.filter(isStatus).map((message) => (message.data as DocumentStatusEvent).id),
    ).toEqual(['doc-2', 'doc-3', 'doc-4']);
  });

  it('replays everything buffered when Last-Event-ID is 0', async () => {
    hub.publish(statusEvent('doc-1'));
    const controller = new EventsController(hub, 60_000);

    const [message] = await firstValueFrom(controller.stream('0').pipe(take(1), toArray()));

    expect(message).toEqual({ id: '1', type: DOCUMENT_STATUS_SSE_TYPE, data: statusEvent('doc-1') });
  });

  it('ignores a malformed Last-Event-ID and only streams live events', async () => {
    hub.publish(statusEvent('doc-1'));
    const controller = new EventsController(hub, 60_000);

    const received = firstValueFrom(controller.stream('abc').pipe(filter(isStatus), take(1)));
    hub.publish(statusEvent('doc-2'));

    expect((await received).id).toBe('2');
  });

  it('merges a heartbeat at the configured interval carrying the current cursor as id', async () => {
    const controller = new EventsController(hub, 10);

    // skip(1): the first heartbeat is the connect baseline; the second comes from the timer.
    const idle = await firstValueFrom(controller.stream(undefined).pipe(skip(1)));
    expect(idle.type).toBe(HEARTBEAT_SSE_TYPE);
    expect(idle.id).toBe('0');
    expect(typeof (idle.data as { ts: string }).ts).toBe('string');

    hub.publish(statusEvent('doc-1'));
    hub.publish(statusEvent('doc-2'));
    const caughtUp = await firstValueFrom(controller.stream('2').pipe(skip(1)));
    // Nothing to replay and no live event: the heartbeat still tells the client it is at 2.
    expect(caughtUp).toMatchObject({ type: HEARTBEAT_SSE_TYPE, id: '2' });
  });
});
