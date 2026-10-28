import { DocumentStatusEvent } from '@techdocs/shared';

export interface EventPublisher {
  publish(event: DocumentStatusEvent): void;
}

export const EVENT_PUBLISHER = Symbol('EventPublisher');
