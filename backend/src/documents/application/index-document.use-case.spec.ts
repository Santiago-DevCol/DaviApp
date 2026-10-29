import { DocumentStatus } from '@techdocs/shared';
import { DocumentNotFoundError, TextExtractionError } from '../domain/errors';
import { FIXTURE_IDS, processingDocument } from './__fakes__/document.fixture';
import { FakeTextExtractor } from './__fakes__/fake-text.extractor';
import { InMemoryDocumentRepository } from './__fakes__/in-memory-document.repository';
import { InMemoryFileStorage } from './__fakes__/in-memory-file.storage';
import { RecordingEventPublisher } from './__fakes__/recording-event.publisher';
import { IndexDocumentUseCase } from './index-document.use-case';

const GENERIC_PUBLIC_REASON =
  'No se pudo indexar el documento. Verifica que el archivo no esté dañado e intenta nuevamente.';

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
    expect(stored?.errorMessage).toBe('El documento no contiene texto extraíble. Verifica que el archivo tenga contenido de texto.');
    expect(stored?.content).toBeNull();
    expect(publisher.events[0]).toMatchObject({
      id: FIXTURE_IDS[0],
      status: DocumentStatus.ERROR,
      errorMessage: 'El documento no contiene texto extraíble. Verifica que el archivo tenga contenido de texto.',
    });
  });

  it('marks the document as ERROR with a public reason and does not rethrow when extraction fails', async () => {
    extractor.throws(new TextExtractionError('Could not parse PDF: Invalid PDF structure'));

    await expect(useCase.execute(FIXTURE_IDS[0])).resolves.toBeUndefined();

    const stored = repository.get(FIXTURE_IDS[0]);
    expect(stored?.status).toBe(DocumentStatus.ERROR);
    expect(stored?.errorMessage).toBe(GENERIC_PUBLIC_REASON);
    expect(stored?.errorMessage).not.toContain('Invalid PDF structure');
    expect(publisher.events[0]).toMatchObject({
      status: DocumentStatus.ERROR,
      errorMessage: GENERIC_PUBLIC_REASON,
    });
  });

  it('marks the document as ERROR with a public reason when the stored file is missing', async () => {
    storage.files.clear();

    await useCase.execute(FIXTURE_IDS[0]);

    const stored = repository.get(FIXTURE_IDS[0]);
    expect(stored?.status).toBe(DocumentStatus.ERROR);
    expect(stored?.errorMessage).toBe(GENERIC_PUBLIC_REASON);
    expect(stored?.errorMessage).not.toContain('ENOENT');
    expect(publisher.events[0]).toMatchObject({
      status: DocumentStatus.ERROR,
      errorMessage: GENERIC_PUBLIC_REASON,
    });
  });

  it('logs the internal failure detail without storing it', async () => {
    const logger = { warn: jest.fn() };
    useCase = new IndexDocumentUseCase({ repository, storage, extractor, publisher, logger });
    extractor.throws(new TextExtractionError('Could not parse PDF: Invalid PDF structure'));

    await useCase.execute(FIXTURE_IDS[0]);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const logged = logger.warn.mock.calls[0][0] as string;
    expect(logged).toContain(FIXTURE_IDS[0]);
    expect(logged).toContain('Invalid PDF structure');
    expect(repository.get(FIXTURE_IDS[0])?.errorMessage).not.toContain('Invalid PDF structure');
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
