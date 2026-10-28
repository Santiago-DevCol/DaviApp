/**
 * One-off generator for the committed PDF samples under docs/samples:
 *   - sample-guide.pdf : one page with a real text layer (indexes as INDEXED)
 *   - sample-blank.pdf : one page with only vector drawing, no text layer
 *                        (ends as ERROR "No extractable text found")
 *
 *   pnpm --filter backend exec ts-node scripts/generate-sample-pdfs.ts
 */
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import PDFDocument from 'pdfkit';

const OUTPUT_DIR = path.resolve(__dirname, '../../docs/samples');

function write(fileName: string, draw: (doc: PDFKit.PDFDocument) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: fileName } });
    const stream = createWriteStream(path.join(OUTPUT_DIR, fileName));
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    doc.pipe(stream);
    draw(doc);
    doc.end();
  });
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  await write('sample-guide.pdf', (doc) => {
    doc.fontSize(20).text('Deployment Guide: Technical Docs Search API', { align: 'left' });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(
      'This guide describes how to deploy the search API to a Kubernetes cluster. ' +
        'The service is packaged as a Docker image, configured through environment variables ' +
        'and backed by a PostgreSQL 16 database with the unaccent extension enabled.',
    );
    doc.moveDown();
    doc.text('1. Prerequisites', { underline: true });
    doc.text(
      'A namespace with access to the container registry, a PostgreSQL instance reachable from the ' +
        'cluster, and a secret holding DATABASE_URL. The pg-boss schema is created automatically on boot.',
    );
    doc.moveDown();
    doc.text('2. Procedimiento de despliegue', { underline: true });
    doc.text(
      'Aplique el chart de Helm con los valores del entorno. Verifique las sondas de readiness antes de ' +
        'enrutar tráfico. Si la migración falla, el pod termina con error y el despliegue anterior permanece activo.',
    );
    doc.moveDown();
    doc.text('3. Verification', { underline: true });
    doc.text(
      'GET /health must report database "up". Upload a sample document and confirm it reaches the INDEXED ' +
        'state within a few seconds; the search_vector column is populated by PostgreSQL itself.',
    );
  });

  await write('sample-blank.pdf', (doc) => {
    // Vector-only content: a scanned-looking page without any text objects.
    doc.rect(56, 56, 483, 300).lineWidth(2).stroke('#444444');
    doc.rect(80, 80, 200, 20).fill('#bbbbbb');
    doc.circle(300, 250, 60).fill('#dddddd');
  });

  console.log(`Wrote sample-guide.pdf and sample-blank.pdf to ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
