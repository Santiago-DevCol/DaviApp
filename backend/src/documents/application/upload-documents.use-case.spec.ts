import { DocumentMetadataInput, DocumentStatus } from '@techdocs/shared';
import {
  FileTooLargeError,
  InvalidUploadBatchError,
  UnsupportedDocumentFormatError,
} from '../domain/errors';
import { FIXTURE_IDS } from './__fakes__/document.fixture';
import { FixedIdGenerator } from './__fakes__/fixed-id.generator';
import { InMemoryDocumentRepository } from './__fakes__/in-memory-document.repository';
import { InMemoryFileStorage } from './__fakes__/in-memory-file.storage';
import { RecordingJobQueue } from './__fakes__/recording-job.queue';
import { UploadDocumentsUseCase, UploadFileInput } from './upload-documents.use-case';

const MAX_SIZE = 1024;

function file(fileName: string, text = 'hello', mimeType = 'application/octet-stream'): UploadFileInput {
  const buffer = Buffer.from(text, 'utf8');
  return { fileName, mimeType, sizeBytes: buffer.byteLength, buffer };
}

function metadata(title: string): DocumentMetadataInput {
  return { title, author: 'Ana', category: 'manuals', tags: ['crane'], version: '1.0.0' };
}

describe('UploadDocumentsUseCase', () => {
  let repository: InMemoryDocumentRepository;
  let storage: InMemoryFileStorage;
  let queue: RecordingJobQueue;
  let useCase: UploadDocumentsUseCase;

  beforeEach(() => {
    repository = new InMemoryDocumentRepository();
    storage = new InMemoryFileStorage();
    queue = new RecordingJobQueue();
    useCase = new UploadDocumentsUseCase({
      repository,
      storage,
      queue,
      idGenerator: new FixedIdGenerator(FIXTURE_IDS),
      maxFileSizeBytes: MAX_SIZE,
    });
  });

  it('accepts several files: persists them as PROCESSING, stores the bytes and enqueues one job each', async () => {
    const response = await useCase.execute({
      files: [file('manual.md', '# Manual', 'text/markdown'), file('spec.txt', 'Spec body', 'text/plain')],
      metadata: [metadata('Manual'), metadata('Spec')],
    });

    expect(response).toEqual({
      items: [
        { id: FIXTURE_IDS[0], status: DocumentStatus.PROCESSING, fileName: 'manual.md' },
        { id: FIXTURE_IDS[1], status: DocumentStatus.PROCESSING, fileName: 'spec.txt' },
      ],
    });

    const manual = repository.get(FIXTURE_IDS[0]);
    expect(manual).toMatchObject({
      title: 'Manual',
      format: 'md',
      fileName: 'manual.md',
      storageKey: `${FIXTURE_IDS[0]}.md`,
      status: DocumentStatus.PROCESSING,
      sizeBytes: 8,
    });
    expect(repository.get(FIXTURE_IDS[1])).toMatchObject({ format: 'txt', title: 'Spec' });

    expect(storage.files.get(`${FIXTURE_IDS[0]}.md`)?.toString()).toBe('# Manual');
    expect(storage.files.get(`${FIXTURE_IDS[1]}.txt`)?.toString()).toBe('Spec body');
    expect(queue.enqueued).toEqual([FIXTURE_IDS[0], FIXTURE_IDS[1]]);
  });

  it('rejects the whole batch on an unsupported format before touching storage, repository or queue', async () => {
    await expect(
      useCase.execute({
        files: [file('ok.md'), file('malware.exe')],
        metadata: [metadata('ok'), metadata('bad')],
      }),
    ).rejects.toBeInstanceOf(UnsupportedDocumentFormatError);

    expect(repository.count()).toBe(0);
    expect(storage.files.size).toBe(0);
    expect(queue.enqueued).toEqual([]);
  });

  it('rejects a file above the configured size limit without side effects', async () => {
    const big = file('big.txt', 'x'.repeat(MAX_SIZE + 1));

    await expect(useCase.execute({ files: [big], metadata: [metadata('big')] })).rejects.toBeInstanceOf(
      FileTooLargeError,
    );

    expect(repository.count()).toBe(0);
    expect(storage.files.size).toBe(0);
  });

  it('rejects when files and metadata are not aligned', async () => {
    await expect(
      useCase.execute({ files: [file('a.md'), file('b.md')], metadata: [metadata('only one')] }),
    ).rejects.toBeInstanceOf(InvalidUploadBatchError);
    await expect(useCase.execute({ files: [], metadata: [] })).rejects.toBeInstanceOf(
      InvalidUploadBatchError,
    );

    expect(repository.count()).toBe(0);
  });

  it('marks the document as ERROR and rethrows when the job cannot be enqueued', async () => {
    const failure = new Error('queue unavailable');
    queue.failWith(failure);

    await expect(useCase.execute({ files: [file('a.md')], metadata: [metadata('a')] })).rejects.toBe(
      failure,
    );

    const stored = repository.get(FIXTURE_IDS[0]);
    expect(stored?.status).toBe(DocumentStatus.ERROR);
    expect(stored?.errorMessage).toBe('Failed to enqueue indexing job');
    expect(storage.files.has(`${FIXTURE_IDS[0]}.md`)).toBe(true);
  });
});
