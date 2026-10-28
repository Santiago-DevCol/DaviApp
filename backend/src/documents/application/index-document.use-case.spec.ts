import { DocumentStatus } from '@techdocs/shared';
import { DocumentNotFoundError, TextExtractionError } from '../domain/errors';
import { FIXTURE_IDS, processingDocument } from './__fakes__/document.fixture';
import { FakeTextExtractor } from './__fakes__/fake-text.extractor';
import { InMemoryDocumentRepository } from './__fakes__/in-memory-document.repository';
import { InMemoryFileStorage } from './__fakes__/in-memory-file.storage';
import { RecordingEventPublisher } from './__fakes__/recording-event.publisher';
import { IndexDocumentUseCase } from './index-document.use-case';

describe('IndexDocumentUseCase', () => {
  let repository: InMemoryDocumentRepository;
  let storage: InMemoryFileStorage;
  let extractor: FakeTextExtractor;
  let publisher: RecordingEventPublisher;
  let useCase: IndexDocumentUseCase;

  beforeEach(async () => {
    repository = new InMemoryDocumentRepository();
    storage = new InMemoryFileStorage();
    extractor = new FakeTextExtractor();
    publisher = new RecordingEventPublisher();
    useCase = new IndexDocumentUseCase({ repository, storage, extractor, publisher });

    const document = processingDocument({ id: FIXTURE_IDS[0], format: 'pdf' });
    repository.seed(document);
    await storage.save(document.storageKey, Buffer.from('%PDF-1.4 fake'));
  });

  it('extracts the text, persists the document as INDEXED and publishes the status event', async () => {
    extractor.returns('Crane operating procedures');

    await useCase.execute(FIXTURE_IDS[0]);

    const stored = repository.get(FIXTURE_IDS[0]);
    expect(stored?.status).toBe(DocumentStatus.INDEXED);
    expect(stored?.content).toBe('Crane operating procedures');
    expect(stored?.errorMessage).toBeNull();

    expect(extractor.calls).toHaveLength(1);
    expect(extractor.calls[0].format).toBe('pdf');
    expect(extractor.calls[0].buffer.toString()).toBe('%PDF-1.4 fake');

    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0]).toEqual({
      id: FIXTURE_IDS[0],
      status: DocumentStatus.INDEXED,
      occurredAt: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(publisher.events[0].occurredAt))).toBe(false);
  });

  it('marks the document as ERROR when no text could be extracted', async () => {
    extractor.returns('  \n\t ');

    await useCase.execute(FIXTURE_IDS[0]);

    const stored = repository.get(FIXTURE_IDS[0]);
    expect(stored?.status).toBe(DocumentStatus.ERROR);
    expect(stored?.errorMessage).toBe('No extractable text found');
    expect(stored?.content).toBeNull();
    expect(publisher.events[0]).toMatchObject({
      id: FIXTURE_IDS[0],
      status: DocumentStatus.ERROR,
      errorMessage: 'No extractable text found',
    });
  });

  it('marks the document as ERROR and does not rethrow when extraction fails', async () => {
    extractor.throws(new TextExtractionError('Could not parse PDF: Invalid PDF structure'));

    await expect(useCase.execute(FIXTURE_IDS[0])).resolves.toBeUndefined();

    expect(repository.get(FIXTURE_IDS[0])?.status).toBe(DocumentStatus.ERROR);
    expect(repository.get(FIXTURE_IDS[0])?.errorMessage).toBe(
      'Could not parse PDF: Invalid PDF structure',
    );
    expect(publisher.events[0]).toMatchObject({
      status: DocumentStatus.ERROR,
      errorMessage: 'Could not parse PDF: Invalid PDF structure',
    });
  });

  it('marks the document as ERROR when the stored file is missing', async () => {
    storage.files.clear();

    await useCase.execute(FIXTURE_IDS[0]);

    expect(repository.get(FIXTURE_IDS[0])?.status).toBe(DocumentStatus.ERROR);
    expect(repository.get(FIXTURE_IDS[0])?.errorMessage).toMatch(/ENOENT/);
  });

  it('throws DocumentNotFoundError for an unknown id without publishing anything', async () => {
    await expect(useCase.execute(FIXTURE_IDS[2])).rejects.toBeInstanceOf(DocumentNotFoundError);

    expect(publisher.events).toEqual([]);
    expect(extractor.calls).toEqual([]);
  });

  it('is a no-op when the document already reached a terminal state', async () => {
    extractor.returns('first run');
    await useCase.execute(FIXTURE_IDS[0]);
    extractor.returns('second run');

    await useCase.execute(FIXTURE_IDS[0]);

    expect(repository.get(FIXTURE_IDS[0])?.content).toBe('first run');
    expect(extractor.calls).toHaveLength(1);
    expect(publisher.events).toHaveLength(1);
  });

  it('propagates persistence failures so the job can be retried', async () => {
    extractor.returns('text');
    const outage = new Error('connection terminated unexpectedly');
    repository.failNextUpdateWith(outage);

    await expect(useCase.execute(FIXTURE_IDS[0])).rejects.toBe(outage);

    expect(repository.get(FIXTURE_IDS[0])?.status).toBe(DocumentStatus.PROCESSING);
    expect(publisher.events).toEqual([]);
  });
});
