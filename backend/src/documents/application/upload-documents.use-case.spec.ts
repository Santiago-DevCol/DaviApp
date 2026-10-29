import { DocumentMetadataInput, DocumentStatus } from '@techdocs/shared';
import { createHash } from 'node:crypto';
import { Document } from '../domain/document';
import {
  FileTooLargeError,
  InvalidUploadBatchError,
  UnsupportedDocumentFormatError,
} from '../domain/errors';
import { FIXTURE_IDS } from './__fakes__/document.fixture';
import { FakeUnitOfWork } from './__fakes__/fake-unit-of-work';
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

function metadata(title: string, overrides: Partial<DocumentMetadataInput> = {}): DocumentMetadataInput {
  return { title, author: 'Ana', category: 'manuals', tags: ['crane'], version: '1.0.0', ...overrides };
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

describe('UploadDocumentsUseCase', () => {
  let repository: InMemoryDocumentRepository;
  let storage: InMemoryFileStorage;
  let queue: RecordingJobQueue;
  let uow: FakeUnitOfWork;
  let useCase: UploadDocumentsUseCase;

  beforeEach(() => {
    repository = new InMemoryDocumentRepository();
    storage = new InMemoryFileStorage();
    queue = new RecordingJobQueue();
    uow = new FakeUnitOfWork(repository, queue);
    useCase = new UploadDocumentsUseCase({
      repository,
      unitOfWork: uow,
      storage,
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
        { id: FIXTURE_IDS[0], status: DocumentStatus.PROCESSING, fileName: 'manual.md', version: '1.0.0' },
        { id: FIXTURE_IDS[1], status: DocumentStatus.PROCESSING, fileName: 'spec.txt', version: '1.0.0' },
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
      documentKey: 'manual|ana',
      contentHash: sha256('# Manual'),
      isLatest: true,
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

  it('persists nothing, deletes the stored file and rethrows when the job cannot be enqueued', async () => {
    const failure = new Error('queue unavailable');
    queue.failWith(failure);

    await expect(useCase.execute({ files: [file('a.md')], metadata: [metadata('a')] })).rejects.toBe(
      failure,
    );

    expect(repository.count()).toBe(0);
    expect(queue.enqueued).toEqual([]);
    expect(storage.files.size).toBe(0);
    expect(storage.deleted).toEqual([`${FIXTURE_IDS[0]}.md`]);
  });

  it('persists nothing and deletes the stored file when the transaction fails to commit', async () => {
    const failure = new Error('could not serialize access');
    uow.failCommitWith(failure);

    await expect(useCase.execute({ files: [file('a.md')], metadata: [metadata('a')] })).rejects.toBe(
      failure,
    );

    expect(repository.count()).toBe(0);
    expect(queue.enqueued).toEqual([]);
    expect(storage.files.size).toBe(0);
  });

  it('still rethrows the original error when deleting the stored file fails as well', async () => {
    const failure = new Error('queue unavailable');
    queue.failWith(failure);
    storage.failDeleteWith(new Error('EACCES'));

    await expect(useCase.execute({ files: [file('a.md')], metadata: [metadata('a')] })).rejects.toBe(
      failure,
    );

    expect(repository.count()).toBe(0);
  });

  it('serializes the write on the document key inside the transaction', async () => {
    await useCase.execute({ files: [file('a.md')], metadata: [metadata('Manual')] });

    expect(uow.lockedKeys).toEqual(['manual|ana']);
  });
  describe('versioning by document key', () => {
    const upload = (fileName: string, text: string, meta: DocumentMetadataInput) =>
      useCase.execute({ files: [file(fileName, text, 'text/plain')], metadata: [meta] });

    it('reports an exact duplicate (same key, same bytes) without creating a row, a file or a job', async () => {
      await upload('v1.txt', 'same bytes', metadata('Manual'));
      storage.files.clear();
      queue.enqueued.length = 0;

      const response = await upload('retry.txt', 'same bytes', metadata('Manual', { version: '2.0.0' }));

      expect(response.items).toEqual([
        {
          id: FIXTURE_IDS[0],
          status: DocumentStatus.PROCESSING,
          fileName: 'retry.txt',
          version: '1.0.0',
          duplicateOf: { id: FIXTURE_IDS[0], version: '1.0.0' },
        },
      ]);
      expect(repository.count()).toBe(1);
      expect(storage.files.size).toBe(0);
      expect(queue.enqueued).toEqual([]);
    });

    it('still reports a duplicate when title or author only differ in case, accents or spacing', async () => {
      await upload('v1.txt', 'same bytes', metadata('Guía Técnica', { author: 'José Pérez' }));

      const response = await upload('v1.txt', 'same bytes', metadata('  guia   tecnica ', { author: 'jose perez' }));

      expect(response.items[0].duplicateOf).toEqual({ id: FIXTURE_IDS[0], version: '1.0.0' });
      expect(repository.count()).toBe(1);
    });

    it('creates a new version with an automatic patch bump when the sent version is not greater', async () => {
      await upload('v1.txt', 'first draft', metadata('Manual', { version: '1.2.3' }));

      const response = await upload('v2.txt', 'second draft', metadata('Manual', { version: '1.0.0' }));

      expect(response.items).toEqual([
        { id: FIXTURE_IDS[1], status: DocumentStatus.PROCESSING, fileName: 'v2.txt', version: '1.2.4' },
      ]);
      const created = repository.get(FIXTURE_IDS[1]);
      expect(created).toMatchObject({ version: '1.2.4', isLatest: true, contentHash: sha256('second draft') });
      expect(repository.get(FIXTURE_IDS[0])).toMatchObject({ version: '1.2.3', isLatest: false });
      expect(queue.enqueued).toEqual([FIXTURE_IDS[0], FIXTURE_IDS[1]]);
      expect(storage.files.get(`${FIXTURE_IDS[1]}.txt`)?.toString()).toBe('second draft');
    });

    it('bumps the patch too when the sent version equals the latest one', async () => {
      await upload('v1.txt', 'first draft', metadata('Manual', { version: '1.0.0' }));

      const response = await upload('v2.txt', 'second draft', metadata('Manual', { version: '1.0.0' }));

      expect(response.items[0].version).toBe('1.0.1');
    });

    it('keeps a sent version that is greater than the latest one', async () => {
      await upload('v1.txt', 'first draft', metadata('Manual', { version: '1.0.0' }));

      const response = await upload('v2.txt', 'second draft', metadata('Manual', { version: '2.0.0' }));

      expect(response.items[0]).toMatchObject({ id: FIXTURE_IDS[1], version: '2.0.0' });
      expect(repository.get(FIXTURE_IDS[1])?.isLatest).toBe(true);
      expect(repository.get(FIXTURE_IDS[0])?.isLatest).toBe(false);
    });

    describe('effective version is monotonic: max(sent, patch bump of the latest)', () => {
      it.each([
        ['1.0.0', 'v2.0.0', 'v2.0.0'],
        ['v1.2.3', '1.0.0', '1.2.4'],
        ['1.0.0-beta', 'draft', '1.0.0'],
        ['draft', 'draft', '0.0.1'],
      ])('latest %s + sent %s -> %s', async (latest, sent, expected) => {
        await upload('v1.txt', 'one', metadata('Manual', { version: latest }));

        const response = await upload('v2.txt', 'two', metadata('Manual', { version: sent }));

        expect(response.items[0].version).toBe(expected);
        expect(repository.get(FIXTURE_IDS[1])?.version).toBe(expected);
      });
    });

    it('supersedes only the previous latest version, leaving older ones untouched', async () => {
      await upload('v1.txt', 'one', metadata('Manual', { version: '1.0.0' }));
      await upload('v2.txt', 'two', metadata('Manual', { version: '1.1.0' }));

      await upload('v3.txt', 'three', metadata('Manual', { version: '1.2.0' }));

      expect(repository.get(FIXTURE_IDS[0])?.isLatest).toBe(false);
      expect(repository.get(FIXTURE_IDS[1])?.isLatest).toBe(false);
      expect(repository.get(FIXTURE_IDS[2])?.isLatest).toBe(true);
    });

    it('treats a different identity with the same bytes as a brand-new document', async () => {
      await upload('a.txt', 'shared bytes', metadata('Manual A'));

      const response = await upload('b.txt', 'shared bytes', metadata('Manual B'));

      expect(response.items[0]).toEqual({
        id: FIXTURE_IDS[1],
        status: DocumentStatus.PROCESSING,
        fileName: 'b.txt',
        version: '1.0.0',
      });
      expect(repository.count()).toBe(2);
      expect(repository.get(FIXTURE_IDS[0])?.isLatest).toBe(true);
    });

    it('treats a typo in the title (same author, different bytes) as another identity, not a new version', async () => {
      await upload('a.txt', 'one', metadata('Crane manual'));

      const response = await upload('b.txt', 'two', metadata('Crane manuel'));

      expect(response.items[0].version).toBe('1.0.0');
      expect(repository.get(FIXTURE_IDS[0])?.isLatest).toBe(true);
      expect(repository.get(FIXTURE_IDS[1])?.isLatest).toBe(true);
    });

    it('reports a duplicate when the latest version is INDEXED with the same bytes', async () => {
      await upload('v1.txt', 'same bytes', metadata('Manual'));
      const indexed = repository.get(FIXTURE_IDS[0])!;
      indexed.markIndexed('same bytes');
      await repository.update(indexed);

      const response = await upload('retry.txt', 'same bytes', metadata('Manual'));

      expect(response.items[0]).toMatchObject({
        status: DocumentStatus.INDEXED,
        duplicateOf: { id: FIXTURE_IDS[0], version: '1.0.0' },
      });
      expect(repository.count()).toBe(1);
    });

    it('creates a new version when the latest one is ERROR, even with the same bytes (retry after failure)', async () => {
      await upload('v1.txt', 'same bytes', metadata('Manual'));
      const failed = repository.get(FIXTURE_IDS[0])!;
      failed.markFailed('extraction failed');
      await repository.update(failed);
      storage.files.clear();
      queue.enqueued.length = 0;

      const response = await upload('retry.txt', 'same bytes', metadata('Manual'));

      expect(response.items).toEqual([
        { id: FIXTURE_IDS[1], status: DocumentStatus.PROCESSING, fileName: 'retry.txt', version: '1.0.1' },
      ]);
      expect(repository.get(FIXTURE_IDS[1])).toMatchObject({ isLatest: true, contentHash: sha256('same bytes') });
      expect(repository.get(FIXTURE_IDS[0])).toMatchObject({ status: DocumentStatus.ERROR, isLatest: false });
      expect(storage.files.get(`${FIXTURE_IDS[1]}.txt`)?.toString()).toBe('same bytes');
      expect(queue.enqueued).toEqual([FIXTURE_IDS[1]]);
    });

    it('treats the bytes of an older superseded version as a rollback: new version, not a duplicate', async () => {
      await upload('v1.txt', 'original', metadata('Manual', { version: '1.0.0' }));
      await upload('v2.txt', 'changed', metadata('Manual', { version: '1.1.0' }));

      const response = await upload('rollback.txt', 'original', metadata('Manual', { version: '1.0.0' }));

      expect(response.items).toEqual([
        { id: FIXTURE_IDS[2], status: DocumentStatus.PROCESSING, fileName: 'rollback.txt', version: '1.1.1' },
      ]);
      expect(repository.count()).toBe(3);
      expect(repository.get(FIXTURE_IDS[2])).toMatchObject({ isLatest: true, contentHash: sha256('original') });
      expect(repository.get(FIXTURE_IDS[1])?.isLatest).toBe(false);
      expect(repository.get(FIXTURE_IDS[0])?.isLatest).toBe(false);
    });

    it('leaves the previous version untouched and persists nothing when it cannot be superseded', async () => {
      await upload('v1.txt', 'one', metadata('Manual'));
      const failure = new Error('database unavailable');
      repository.failNextUpdateWith(failure);

      await expect(upload('v2.txt', 'two', metadata('Manual'))).rejects.toBe(failure);

      expect(repository.count()).toBe(1);
      expect(repository.get(FIXTURE_IDS[0])?.isLatest).toBe(true);
      expect(queue.enqueued).toEqual([FIXTURE_IDS[0]]);
      expect(storage.files.has(`${FIXTURE_IDS[1]}.txt`)).toBe(false);
    });

    it('rolls back the supersede as well when enqueue fails, so the key keeps exactly one latest version', async () => {
      await upload('v1.txt', 'one', metadata('Manual'));
      const failure = new Error('queue unavailable');
      queue.failWith(failure);

      await expect(upload('v2.txt', 'two', metadata('Manual'))).rejects.toBe(failure);

      expect(repository.count()).toBe(1);
      expect(repository.get(FIXTURE_IDS[0])?.isLatest).toBe(true);
      expect(storage.files.has(`${FIXTURE_IDS[1]}.txt`)).toBe(false);
    });

    it('re-reads the latest version under the lock: a duplicate that appeared meanwhile creates nothing', async () => {
      // Simulate a concurrent upload that committed between the pre-check and the lock.
      const racingRepository = repository;
      let injected = false;
      const original = uow.run.bind(uow);
      uow.run = async (fn) =>
        original(async (ctx) => {
          if (!injected) {
            injected = true;
            await racingRepository.save(
              Document.create({
                id: FIXTURE_IDS[2],
                fileName: 'race.txt',
                metadata: metadata('Manual'),
                format: 'txt',
                sizeBytes: 3,
                contentHash: sha256('one'),
              }),
            );
          }
          return fn(ctx);
        });

      const response = await upload('v1.txt', 'one', metadata('Manual'));

      expect(response.items[0].duplicateOf).toEqual({ id: FIXTURE_IDS[2], version: '1.0.0' });
      expect(repository.count()).toBe(1);
      expect(storage.files.size).toBe(0);
      expect(queue.enqueued).toEqual([]);
    });
  });
});
