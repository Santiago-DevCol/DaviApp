import { DocumentStatus } from '@techdocs/shared';
import { Document } from '../domain/document';
import { DocumentNotFoundError } from '../domain/errors';
import { FIXTURE_IDS, processingDocument } from './__fakes__/document.fixture';
import { InMemoryDocumentRepository } from './__fakes__/in-memory-document.repository';
import { RecordingEventPublisher } from './__fakes__/recording-event.publisher';
import { FailDocumentUseCase } from './fail-document.use-case';

const REASON = 'Indexing failed after 4 attempts: connection terminated unexpectedly';

function processingWithContent(id: string, content: string): Document {
  const base = processingDocument({ id });
  return new Document({
    id: base.id,
    fileName: base.fileName,
    title: base.title,
    author: base.author,
    category: base.category,
    tags: [...base.tags],
    version: base.version,
    format: base.format,
    storageKey: base.storageKey,
    sizeBytes: base.sizeBytes,
    status: DocumentStatus.PROCESSING,
    errorMessage: null,
    content,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  });
}

describe('FailDocumentUseCase', () => {
  let repository: InMemoryDocumentRepository;
  let publisher: RecordingEventPublisher;
  let useCase: FailDocumentUseCase;

  beforeEach(() => {
    repository = new InMemoryDocumentRepository();
    publisher = new RecordingEventPublisher();
    useCase = new FailDocumentUseCase({ repository, publisher });
  });

  it('settles a PROCESSING document as ERROR, clears its content and publishes the status event', async () => {
    repository.seed(processingWithContent(FIXTURE_IDS[0], 'text that never reached INDEXED'));

    await useCase.execute(FIXTURE_IDS[0], REASON);

    const stored = repository.get(FIXTURE_IDS[0]);
    expect(stored?.status).toBe(DocumentStatus.ERROR);
    expect(stored?.errorMessage).toBe(REASON);
    expect(stored?.content).toBeNull();
    expect(publisher.events).toEqual([
      {
        id: FIXTURE_IDS[0],
        status: DocumentStatus.ERROR,
        errorMessage: REASON,
        occurredAt: expect.any(String),
      },
    ]);
    expect(Number.isNaN(Date.parse(publisher.events[0].occurredAt))).toBe(false);
  });

  it.each([
    ['INDEXED', (d: Document) => d.markIndexed('done')],
    ['ERROR', (d: Document) => d.markFailed('earlier failure')],
  ])('is a no-op when the document is already %s', async (_state, settle) => {
    const document = processingDocument({ id: FIXTURE_IDS[0] });
    settle(document);
    repository.seed(document);

    await useCase.execute(FIXTURE_IDS[0], REASON);

    const stored = repository.get(FIXTURE_IDS[0]);
    expect(stored?.status).toBe(document.status);
    expect(stored?.errorMessage).toBe(document.errorMessage);
    expect(stored?.content).toBe(document.content);
    expect(publisher.events).toEqual([]);
  });

  it('throws DocumentNotFoundError for an unknown id without publishing anything', async () => {
    await expect(useCase.execute(FIXTURE_IDS[2], REASON)).rejects.toBeInstanceOf(
      DocumentNotFoundError,
    );

    expect(publisher.events).toEqual([]);
  });

  it('propagates repository failures so the caller can log them', async () => {
    repository.seed(processingDocument({ id: FIXTURE_IDS[0] }));
    const outage = new Error('connection terminated unexpectedly');
    repository.failNextUpdateWith(outage);

    await expect(useCase.execute(FIXTURE_IDS[0], REASON)).rejects.toBe(outage);

    expect(repository.get(FIXTURE_IDS[0])?.status).toBe(DocumentStatus.PROCESSING);
    expect(publisher.events).toEqual([]);
  });
});
