import { DocumentStatus } from '@techdocs/shared';
import { DocumentNotFoundError } from '../domain/errors';
import { FIXTURE_IDS, processingDocument } from './__fakes__/document.fixture';
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
    });
  });

  it('throws DocumentNotFoundError for an unknown id', async () => {
    await expect(useCase.execute(FIXTURE_IDS[1])).rejects.toBeInstanceOf(DocumentNotFoundError);
  });
});
