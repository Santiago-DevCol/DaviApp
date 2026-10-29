import { FileTooLargeError, UnsupportedDocumentFormatError } from '../../documents/domain/errors';
import { MetadataExtractor } from '../domain/ports/metadata-extractor';
import { InspectFilesUseCase } from './inspect-files.use-case';

const fakeExtractor: MetadataExtractor = {
  inspect: async (buffer, format, fileName) => ({
    source: 'heuristic',
    ...(format === 'pdf' ? { pages: 3 } : {}),
    suggested: { title: `${fileName}:${buffer.length}` },
  }),
};

const file = (fileName: string, body = 'abc', mimeType = 'application/octet-stream') => ({
  fileName,
  mimeType,
  sizeBytes: Buffer.byteLength(body),
  buffer: Buffer.from(body),
});

describe('InspectFilesUseCase', () => {
  const useCase = new InspectFilesUseCase({ extractor: fakeExtractor, maxFileSizeBytes: 100 });

  it('returns one item per file with format, size and the extractor result', async () => {
    const result = await useCase.execute([file('a.md'), file('b.pdf', 'pdfbytes')]);

    expect(result).toEqual({
      items: [
        { fileName: 'a.md', format: 'md', sizeBytes: 3, source: 'heuristic', suggested: { title: 'a.md:3' } },
        {
          fileName: 'b.pdf',
          format: 'pdf',
          sizeBytes: 8,
          pages: 3,
          source: 'heuristic',
          suggested: { title: 'b.pdf:8' },
        },
      ],
    });
  });

  it('rejects unsupported formats before inspecting anything', async () => {
    await expect(useCase.execute([file('a.md'), file('virus.exe')])).rejects.toBeInstanceOf(
      UnsupportedDocumentFormatError,
    );
  });

  it('rejects files over the configured size limit', async () => {
    await expect(useCase.execute([file('big.txt', 'x'.repeat(101))])).rejects.toBeInstanceOf(
      FileTooLargeError,
    );
  });

  it('isolates extractor failures per file instead of failing the batch', async () => {
    const failing: MetadataExtractor = {
      inspect: async (_buffer, _format, fileName) => {
        if (fileName === 'bad.txt') throw new Error('boom');
        return { source: 'none', suggested: { title: 'ok' } };
      },
    };
    const resilient = new InspectFilesUseCase({ extractor: failing });

    const result = await resilient.execute([file('bad.txt'), file('good.txt')]);

    expect(result.items.map((item) => item.source)).toEqual(['none', 'none']);
    expect(result.items[0].suggested).toEqual({ title: 'bad' });
  });
});
