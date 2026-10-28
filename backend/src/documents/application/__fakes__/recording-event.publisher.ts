import { DocumentStatusEvent } from '@techdocs/shared';
import { EventPublisher } from '../../domain/ports/event-publisher';

export class RecordingEventPublisher implements EventPublisher {
  readonly events: DocumentStatusEvent[] = [];

  publish(event: DocumentStatusEvent): void {
    this.events.push(event);
  }
}
