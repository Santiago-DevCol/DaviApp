import { Module } from '@nestjs/common';
import { DEFAULT_REPLAY_CAPACITY, EventReplayBuffer } from './domain/event-replay-buffer';
import { DocumentStatusListener } from './infrastructure/events/document-status.listener';
import { NotificationsHub } from './infrastructure/events/notifications.hub';
import { EventsController } from './infrastructure/http/events.controller';

/**
 * Composition root of the notifications capability: listens to document
 * status events and streams them to browsers over SSE (`GET /events`).
 * The hub is built with a factory so the replay buffer (a plain domain class)
 * never has to be a Nest provider.
 */
@Module({
  controllers: [EventsController],
  providers: [
    {
      provide: NotificationsHub,
      useFactory: () => new NotificationsHub(new EventReplayBuffer(DEFAULT_REPLAY_CAPACITY)),
    },
    DocumentStatusListener,
  ],
})
export class NotificationsModule {}
