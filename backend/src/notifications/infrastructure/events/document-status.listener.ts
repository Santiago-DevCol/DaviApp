import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DocumentStatusEvent } from '@techdocs/shared';
import { DOCUMENT_STATUS_EVENT } from '../../../documents/infrastructure/events/event-emitter.publisher';
import { NotificationsHub } from './notifications.hub';

/**
 * Bridges the documents capability (which emits through EventEmitter2) into
 * the notifications hub. The only coupling between the two capabilities is the
 * event name and the shared `DocumentStatusEvent` contract.
 */
@Injectable()
export class DocumentStatusListener {
  constructor(private readonly hub: NotificationsHub) {}

  @OnEvent(DOCUMENT_STATUS_EVENT)
  handle(event: DocumentStatusEvent): void {
    this.hub.publish(event);
  }
}
