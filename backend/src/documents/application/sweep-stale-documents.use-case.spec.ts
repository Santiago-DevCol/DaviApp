import { DocumentStatus } from '@techdocs/shared';
import { FIXTURE_IDS, processingDocument } from './__fakes__/document.fixture';
import { InMemoryDocumentRepository } from './__fakes__/in-memory-document.repository';
import { RecordingEventPublisher } from './__fakes__/recording-event.publisher';
import { FailDocumentUseCase } from './fail-document.use-case';
import { SweepStaleDocumentsUseCase, STALE_INDEXING_REASON } from './sweep-stale-documents.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

describe('SweepStaleDocumentsUseCase', () => {
  let repository: InMemoryDocumentRepository;
  let publisher: RecordingEventPublisher;
  let useCase: SweepStaleDocumentsUseCase;

  beforeEach(() => {
    repository = new InMemoryDocumentRepository();
    publisher = new RecordingEventPublisher();
    useCase = new SweepStaleDocumentsUseCase({
      repository,
      failDocument: new FailDocumentUseCase({ repository, publisher }),
      staleAfterMinutes: 15,
    });
  });

  it('settles PROCESSING documents older than the threshold as ERROR and publishes one event each', async () => {
    repository.seed(processingDocument({ id: FIXTURE_IDS[0], now: minutesAgo(20) }));
    repository.seed(processingDocument({ id: FIXTURE_IDS[1], now: minutesAgo(16) }));

    const swept = await useCase.execute(NOW);

    expect(swept).toBe(2);
    for (const id of [FIXTURE_IDS[0], FIXTURE_IDS[1]]) {
      expect(repository.get(id)).toMatchObject({ status: DocumentStatus.ERROR, errorMessage: STALE_INDEXING_REASON });
    }
    expect(publisher.events.map((event) => event.id)).toEqual([FIXTURE_IDS[0], FIXTURE_IDS[1]]);
  });

  it('leaves fresh PROCESSING documents and settled ones alone', async () => {
    repository.seed(processingDocument({ id: FIXTURE_IDS[0], now: minutesAgo(14) }));
    const indexed = processingDocument({ id: FIXTURE_IDS[1], now: minutesAgo(60) });
    indexed.markIndexed('done');
    repository.seed(indexed);

    const swept = await useCase.execute(NOW);

    expect(swept).toBe(0);
    expect(repository.get(FIXTURE_IDS[0])?.status).toBe(DocumentStatus.PROCESSING);
    expect(repository.get(FIXTURE_IDS[1])?.status).toBe(DocumentStatus.INDEXED);
    expect(publisher.events).toEqual([]);
  });

  it('keeps sweeping the remaining documents when one settlement fails', async () => {
    repository.seed(processingDocument({ id: FIXTURE_IDS[0], now: minutesAgo(20) }));
    repository.seed(processingDocument({ id: FIXTURE_IDS[1], now: minutesAgo(20) }));
    repository.failNextUpdateWith(new Error('connection terminated unexpectedly'));

    const swept = await useCase.execute(NOW);

    expect(swept).toBe(1);
    expect(repository.get(FIXTURE_IDS[1])?.status).toBe(DocumentStatus.ERROR);
  });
});
