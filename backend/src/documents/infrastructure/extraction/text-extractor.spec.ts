import PDFDocument from 'pdfkit';
import { TextExtractionError } from '../../domain/errors';
import { FileTextExtractor, normalizeExtractedText } from './text-extractor';

function buildPdf(write: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    write(doc);
    doc.end();
  });
}

describe('normalizeExtractedText', () => {
  it('strips BOM and NUL bytes, unifies line endings and collapses blank runs', () => {
    const input = '﻿line one\u0000\r\n\r\n\r\n\r\nline two   \r\n';

    expect(normalizeExtractedText(input)).toBe('line one\n\nline two');
  });
});

describe('FileTextExtractor', () => {
  const extractor = new FileTextExtractor();

  it('decodes txt and md as UTF-8', async () => {
    await expect(extractor.extract(Buffer.from('# Título\n\ncontenido', 'utf8'), 'md')).resolves.toBe(
      '# Título\n\ncontenido',
    );
    await expect(extractor.extract(Buffer.from('plain'), 'txt')).resolves.toBe('plain');
  });

  it('extracts the text layer of a PDF without page markers', async () => {
    const pdf = await buildPdf((doc) => doc.text('Crane inspection checklist. Revisión semanal.'));

    const text = await extractor.extract(pdf, 'pdf');

    expect(text).toContain('Crane inspection checklist');
    expect(text).toContain('Revisión semanal');
    expect(text).not.toMatch(/-- \d+ of \d+ --/);
  });

  it('returns an empty string for a PDF without a text layer', async () => {
    const pdf = await buildPdf((doc) => doc.rect(50, 50, 200, 100).fill('#999999'));

    await expect(extractor.extract(pdf, 'pdf')).resolves.toBe('');
  });

  it('wraps parser failures in TextExtractionError', async () => {
    await expect(extractor.extract(Buffer.from('definitely not a pdf'), 'pdf')).rejects.toBeInstanceOf(
      TextExtractionError,
    );
  });
});
