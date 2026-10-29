import PDFDocument from 'pdfkit';
import { FormatDispatchingMetadataExtractor } from './format-dispatching-metadata.extractor';
import { MarkdownMetadataExtractor } from './markdown-metadata.extractor';
import { PdfMetadataExtractor } from './pdf-metadata.extractor';
import { TextMetadataExtractor } from './text-metadata.extractor';

function buildPdf(
  info: PDFKit.DocumentInfo,
  write: (doc: PDFKit.PDFDocument) => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ info });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    write(doc);
    doc.end();
  });
}

describe('PdfMetadataExtractor', () => {
  const extractor = new PdfMetadataExtractor();

  it('reads Title and Author from the PDF info dictionary and counts pages', async () => {
    const pdf = await buildPdf({ Title: 'Deployment Guide', Author: 'Platform Team' }, (doc) => {
      doc.text('page one');
      doc.addPage().text('page two');
    });

    await expect(extractor.inspect(pdf, 'pdf', 'guide.pdf')).resolves.toEqual({
      source: 'pdf-info',
      pages: 2,
      suggested: { title: 'Deployment Guide', author: 'Platform Team' },
    });
  });

  it('falls back to the file name when the info dictionary has no usable title', async () => {
    const pdf = await buildPdf({}, (doc) => doc.text('body'));

    await expect(extractor.inspect(pdf, 'pdf', 'crane_manual.pdf')).resolves.toEqual({
      source: 'none',
      pages: 1,
      suggested: { title: 'crane manual' },
    });
  });

  it('degrades to the file name (without pages) when the PDF cannot be parsed', async () => {
    await expect(extractor.inspect(Buffer.from('not a pdf'), 'pdf', 'broken.pdf')).resolves.toEqual({
      source: 'none',
      suggested: { title: 'broken' },
    });
  });
});

describe('MarkdownMetadataExtractor', () => {
  const extractor = new MarkdownMetadataExtractor();

  it('maps YAML front matter fields, accepting tags as an array', async () => {
    const md = [
      '---',
      'title: Manual GT-120',
      'author: Equipos Industriales',
      'version: 2.1.0',
      'category: manuals',
      'tags: [crane, safety]',
      '---',
      '# Ignored heading',
    ].join('\n');

    await expect(extractor.inspect(Buffer.from(md, 'utf8'), 'md', 'manual.md')).resolves.toEqual({
      source: 'front-matter',
      suggested: {
        title: 'Manual GT-120',
        author: 'Equipos Industriales',
        version: '2.1.0',
        category: 'manuals',
        tags: ['crane', 'safety'],
      },
    });
  });

  it('accepts tags as a comma-separated string', async () => {
    const md = '---\ntitle: T\ntags: crane, safety\n---\nbody';

    const result = await extractor.inspect(Buffer.from(md), 'md', 'x.md');

    expect(result.suggested.tags).toEqual(['crane', 'safety']);
  });

  it('uses the first H1 as a heuristic title when there is no front matter', async () => {
    const md = '\nSome intro line\n\n# Manual de operación: grúa torre\n\n## Section';

    await expect(extractor.inspect(Buffer.from(md, 'utf8'), 'md', 'manual.md')).resolves.toEqual({
      source: 'heuristic',
      suggested: { title: 'Manual de operación: grúa torre' },
    });
  });

  it('treats front matter without known fields as absent and still tries the H1', async () => {
    const md = '---\ndraft: true\n---\n# From heading';

    await expect(extractor.inspect(Buffer.from(md), 'md', 'notes.md')).resolves.toEqual({
      source: 'heuristic',
      suggested: { title: 'From heading' },
    });
  });

  it('falls back to the file name when neither front matter nor H1 exist', async () => {
    await expect(
      extractor.inspect(Buffer.from('plain paragraph'), 'md', 'release-notes.md'),
    ).resolves.toEqual({ source: 'none', suggested: { title: 'release notes' } });
  });

  it('does not throw on malformed YAML and falls back to the heading', async () => {
    const md = '---\ntitle: [unclosed\n---\n# Safe title';

    await expect(extractor.inspect(Buffer.from(md), 'md', 'bad.md')).resolves.toEqual({
      source: 'heuristic',
      suggested: { title: 'Safe title' },
    });
  });
});

describe('TextMetadataExtractor', () => {
  const extractor = new TextMetadataExtractor();

  it('uses the first non-empty line as a heuristic title when it is 120 chars or less', async () => {
    const txt = '\n\n  TECHNICAL SPECIFICATION: UPLOAD API  \nVersion 1.0.0\n';

    await expect(extractor.inspect(Buffer.from(txt), 'txt', 'spec.txt')).resolves.toEqual({
      source: 'heuristic',
      suggested: { title: 'TECHNICAL SPECIFICATION: UPLOAD API' },
    });
  });

  it('falls back to the file name when the first line is too long to be a title', async () => {
    const txt = 'a'.repeat(121) + '\nsecond';

    await expect(extractor.inspect(Buffer.from(txt), 'txt', 'long_intro.txt')).resolves.toEqual({
      source: 'none',
      suggested: { title: 'long intro' },
    });
  });

  it('falls back to the file name for an empty file', async () => {
    await expect(extractor.inspect(Buffer.alloc(0), 'txt', 'empty.txt')).resolves.toEqual({
      source: 'none',
      suggested: { title: 'empty' },
    });
  });
});

describe('FormatDispatchingMetadataExtractor', () => {
  it('routes each format to its extractor', async () => {
    const extractor = new FormatDispatchingMetadataExtractor(
      new PdfMetadataExtractor(),
      new MarkdownMetadataExtractor(),
      new TextMetadataExtractor(),
    );

    const md = await extractor.inspect(Buffer.from('# Heading'), 'md', 'a.md');
    const txt = await extractor.inspect(Buffer.from('First line'), 'txt', 'b.txt');
    const pdf = await extractor.inspect(
      await buildPdf({ Title: 'P' }, (doc) => doc.text('x')),
      'pdf',
      'c.pdf',
    );

    expect(md).toMatchObject({ source: 'heuristic', suggested: { title: 'Heading' } });
    expect(txt).toMatchObject({ source: 'heuristic', suggested: { title: 'First line' } });
    expect(pdf).toMatchObject({ source: 'pdf-info', pages: 1, suggested: { title: 'P' } });
  });
});
