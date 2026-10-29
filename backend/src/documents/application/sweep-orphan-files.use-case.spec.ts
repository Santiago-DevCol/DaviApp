import { FIXTURE_IDS, processingDocument } from './__fakes__/document.fixture';
import { InMemoryDocumentRepository } from './__fakes__/in-memory-document.repository';
import { InMemoryFileStorage } from './__fakes__/in-memory-file.storage';
import { SweepOrphanFilesUseCase } from './sweep-orphan-files.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

describe('SweepOrphanFilesUseCase', () => {
  let repository: InMemoryDocumentRepository;
  let storage: InMemoryFileStorage;
  let useCase: SweepOrphanFilesUseCase;

  beforeEach(() => {
    repository = new InMemoryDocumentRepository();
    storage = new InMemoryFileStorage();
    useCase = new SweepOrphanFilesUseCase({ repository, storage, orphanAfterMinutes: 60 });
  });

  it('deletes files older than the threshold that no document row references', async () => {
    repository.seed(processingDocument({ id: FIXTURE_IDS[0] }));
    storage.seed(`${FIXTURE_IDS[0]}.md`, Buffer.from('owned'), minutesAgo(120));
    storage.seed(`${FIXTURE_IDS[1]}.md`, Buffer.from('orphan, old'), minutesAgo(61));
    storage.seed(`${FIXTURE_IDS[2]}.md`, Buffer.from('orphan, fresh'), minutesAgo(5));

    const deleted = await useCase.execute(NOW);

    expect(deleted).toEqual({ deleted: 1, failed: 0 });
    expect([...storage.files.keys()].sort()).toEqual([`${FIXTURE_IDS[0]}.md`, `${FIXTURE_IDS[2]}.md`].sort());
  });

  it('returns zero without touching the repository when nothing is old enough', async () => {
    storage.seed(`${FIXTURE_IDS[1]}.md`, Buffer.from('fresh'), minutesAgo(1));

    expect(await useCase.execute(NOW)).toEqual({ deleted: 0, failed: 0 });
    expect(storage.files.size).toBe(1);
  });
});

describe('SweepOrphanFilesUseCase with a failing delete', () => {
  it('keeps deleting the other orphans, logs the failure and reports both counts', async () => {
    const repository = new InMemoryDocumentRepository();
    const storage = new InMemoryFileStorage();
    const logger = { warn: jest.fn() };
    const useCase = new SweepOrphanFilesUseCase({ repository, storage, orphanAfterMinutes: 60, logger });
    storage.seed(`${FIXTURE_IDS[0]}.md`, Buffer.from('orphan a'), minutesAgo(120));
    storage.seed(`${FIXTURE_IDS[1]}.md`, Buffer.from('orphan b, locked'), minutesAgo(120));
    storage.seed(`${FIXTURE_IDS[2]}.md`, Buffer.from('orphan c'), minutesAgo(120));
    storage.failDeleteOfKeyWith(`${FIXTURE_IDS[1]}.md`, new Error('EBUSY: resource busy'));

    const result = await useCase.execute(NOW);

    expect(result).toEqual({ deleted: 2, failed: 1 });
    expect([...storage.files.keys()]).toEqual([`${FIXTURE_IDS[1]}.md`]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toContain(`${FIXTURE_IDS[1]}.md`);
    expect(logger.warn.mock.calls[0][0]).toContain('EBUSY');
  });
});
