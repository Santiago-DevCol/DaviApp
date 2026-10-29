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

    expect(deleted).toBe(1);
    expect([...storage.files.keys()].sort()).toEqual([`${FIXTURE_IDS[0]}.md`, `${FIXTURE_IDS[2]}.md`].sort());
  });

  it('returns zero without touching the repository when nothing is old enough', async () => {
    storage.seed(`${FIXTURE_IDS[1]}.md`, Buffer.from('fresh'), minutesAgo(1));

    expect(await useCase.execute(NOW)).toBe(0);
    expect(storage.files.size).toBe(1);
  });
});
