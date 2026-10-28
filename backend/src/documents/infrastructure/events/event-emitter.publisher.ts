import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DocumentStatusEvent } from '@techdocs/shared';
import { EventPublisher } from '../../domain/ports/event-publisher';

/** Event name consumed by the SSE endpoint (notifications capability). */
export const DOCUMENT_STATUS_EVENT = 'document.status';

@Injectable()
export class EventEmitterPublisher implements EventPublisher {
  constructor(private readonly emitter: EventEmitter2) {}

  publish(event: DocumentStatusEvent): void {
    this.emitter.emit(DOCUMENT_STATUS_EVENT, event);
  }
}
