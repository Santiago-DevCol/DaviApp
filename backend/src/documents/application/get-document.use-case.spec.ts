import { DocumentStatus } from '@techdocs/shared';
import { DocumentNotFoundError } from '../domain/errors';
import { FIXTURE_CONTENT_HASH, FIXTURE_IDS, processingDocument } from './__fakes__/document.fixture';
import { InMemoryDocumentRepository } from './__fakes__/in-memory-document.repository';
import { GetDocumentUseCase } from './get-document.use-case';

describe('GetDocumentUseCase', () => {
  let repository: InMemoryDocumentRepository;
  let useCase: GetDocumentUseCase;

  beforeEach(() => {
    repository = new InMemoryDocumentRepository();
    useCase = new GetDocumentUseCase({ repository });
  });

  it('returns the DocumentDetail contract with ISO timestamps', async () => {
    const document = processingDocument({ id: FIXTURE_IDS[0], format: 'md', fileName: 'manual.md' });
    document.markIndexed('# Manual body', new Date('2026-01-01T00:00:09.000Z'));
    repository.seed(document);

    await expect(useCase.execute(FIXTURE_IDS[0])).resolves.toEqual({
      id: FIXTURE_IDS[0],
      title: 'Crane manual',
      author: 'Ana Torres',
      category: 'manuals',
      tags: ['crane', 'safety'],
      version: '1.0.0',
      format: 'md',
      fileName: 'manual.md',
      sizeBytes: 2048,
      status: DocumentStatus.INDEXED,
      errorMessage: null,
      content: '# Manual body',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:09.000Z',
      documentKey: 'crane manual|ana torres',
      contentHash: FIXTURE_CONTENT_HASH,
      isLatest: true,
      versions: [
        {
          id: FIXTURE_IDS[0],
          version: '1.0.0',
          status: DocumentStatus.INDEXED,
          isLatest: true,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
  });

  it('throws DocumentNotFoundError for an unknown id', async () => {
    await expect(useCase.execute(FIXTURE_IDS[1])).rejects.toBeInstanceOf(DocumentNotFoundError);
  });
  it('lists every version of the same document key newest first, including superseded ones', async () => {
    const v1 = processingDocument({ id: FIXTURE_IDS[0], version: '1.0.0', contentHash: 'a'.repeat(64) });
    v1.markIndexed('v1', new Date('2026-01-01T00:00:01.000Z'));
    v1.supersede(new Date('2026-01-02T00:00:00.000Z'));
    const v2 = processingDocument({
      id: FIXTURE_IDS[1],
      version: '1.0.1',
      contentHash: 'b'.repeat(64),
      now: new Date('2026-01-02T00:00:00.000Z'),
    });
    const other = processingDocument({ id: FIXTURE_IDS[2], title: 'Another work' });
    repository.seed(v1);
    repository.seed(v2);
    repository.seed(other);

    const detail = await useCase.execute(FIXTURE_IDS[0]);

    expect(detail.isLatest).toBe(false);
    expect(detail.versions).toEqual([
      {
        id: FIXTURE_IDS[1],
        version: '1.0.1',
        status: DocumentStatus.PROCESSING,
        isLatest: true,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: FIXTURE_IDS[0],
        version: '1.0.0',
        status: DocumentStatus.INDEXED,
        isLatest: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });
});
