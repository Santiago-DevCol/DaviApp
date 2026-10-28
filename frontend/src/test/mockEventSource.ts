/**
 * Minimal `EventSource` stand-in for jsdom. Tests drive it explicitly with
 * `emitOpen`, `emit` and `emitError`; `instances` exposes every stream opened.
 */
export class MockEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: MockEventSource[] = [];

  static reset(): void {
    MockEventSource.instances = [];
  }

  static latest(): MockEventSource {
    const instance = MockEventSource.instances[MockEventSource.instances.length - 1];
    if (!instance) throw new Error('No EventSource has been opened');
    return instance;
  }

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;
  readonly url: string;
  readonly withCredentials: boolean;
  readyState = MockEventSource.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string | URL, init?: EventSourceInit) {
    super();
    this.url = String(url);
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  emitOpen(): void {
    this.readyState = MockEventSource.OPEN;
    const event = new Event('open');
    this.onopen?.(event);
    this.dispatchEvent(event);
  }

  emit(type: string, data: unknown, lastEventId = ''): void {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.dispatchEvent(new MessageEvent(type, { data: payload, lastEventId }));
  }

  emitError(terminal = false): void {
    this.readyState = terminal ? MockEventSource.CLOSED : MockEventSource.CONNECTING;
    const event = new Event('error');
    this.onerror?.(event);
    this.dispatchEvent(event);
  }
}
