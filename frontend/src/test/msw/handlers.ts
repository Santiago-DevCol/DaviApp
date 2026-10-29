import {
  DocumentStatus,
  type ApiError,
  type DocumentDetail,
  type InspectResponse,
  type InspectedFile,
  type SearchResponse,
  type UploadAcceptedResponse,
} from '@techdocs/shared';
import { delay, http, HttpResponse } from 'msw';

export const INDEXED_DOC: DocumentDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Guía de despliegue en Kubernetes',
  author: 'Equipo Plataforma',
  category: 'Infraestructura',
  tags: ['kubernetes', 'despliegue'],
  version: '2.1.0',
  format: 'md',
  fileName: 'k8s-guide.md',
  sizeBytes: 2048,
  status: DocumentStatus.INDEXED,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:05.000Z',
  content: '# Despliegue\n\nUsa `kubectl apply` para desplegar.\n\n- Paso uno\n- Paso dos',
  errorMessage: null,
  documentKey: 'guia-de-despliegue-en-kubernetes::equipo-plataforma',
  isLatest: true,
  contentHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  versions: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      version: '2.1.0',
      status: DocumentStatus.INDEXED,
      isLatest: true,
      createdAt: '2026-10-01T10:00:00.000Z',
    },
    {
      id: '11111111-1111-4111-8111-111111111110',
      version: '2.0.0',
      status: DocumentStatus.INDEXED,
      isLatest: false,
      createdAt: '2026-09-01T10:00:00.000Z',
    },
  ],
};

/** Previous version of `INDEXED_DOC` (same document key, superseded). */
export const OLD_VERSION_DOC: DocumentDetail = {
  ...INDEXED_DOC,
  id: '11111111-1111-4111-8111-111111111110',
  version: '2.0.0',
  fileName: 'k8s-guide-v2.md',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:05.000Z',
  content: '# Despliegue (anterior)\n\nVersión previa de la guía.',
  isLatest: false,
  contentHash: '1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014',
};

export const PROCESSING_DOC: DocumentDetail = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Especificación de carga',
  author: 'Ana Ruiz',
  category: 'Especificación',
  tags: ['api'],
  version: '1.0.0',
  format: 'txt',
  fileName: 'sample-spec.txt',
  sizeBytes: 512,
  status: DocumentStatus.PROCESSING,
  createdAt: '2026-10-02T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
  content: null,
  errorMessage: null,
  documentKey: 'especificacion-de-carga::ana-ruiz',
  isLatest: true,
  contentHash: '60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752',
  versions: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      version: '1.0.0',
      status: DocumentStatus.PROCESSING,
      isLatest: true,
      createdAt: '2026-10-02T10:00:00.000Z',
    },
  ],
};

export const SEARCH_FIXTURE: SearchResponse = {
  items: [
    {
      id: INDEXED_DOC.id,
      title: INDEXED_DOC.title,
      author: INDEXED_DOC.author,
      category: INDEXED_DOC.category,
      tags: INDEXED_DOC.tags,
      version: INDEXED_DOC.version,
      status: DocumentStatus.INDEXED,
      highlight: 'Guía de despliegue en <mark>Kubernetes</mark> … usa kubectl para <mark>kubernetes</mark>',
      rank: 0.42,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
  tookMs: 12,
};

/** Mutable in-memory documents table; `resetFixtures` restores it after each test. */
const documents = new Map<string, DocumentDetail>();

export function resetFixtures(): void {
  documents.clear();
  documents.set(INDEXED_DOC.id, { ...INDEXED_DOC });
  documents.set(PROCESSING_DOC.id, { ...PROCESSING_DOC });
  documents.set(OLD_VERSION_DOC.id, { ...OLD_VERSION_DOC });
}

export function setDocument(document: DocumentDetail): void {
  documents.set(document.id, document);
}

resetFixtures();

function apiError(statusCode: number, error: string, message: string, path: string): ApiError {
  return { statusCode, error, message, timestamp: new Date().toISOString(), path };
}

/**
 * Inspection suggestions keyed by file-name pattern:
 * `fm-*.md` → front matter (title/author/version/tags), `*.pdf` → pdf-info with
 * pages, `heur-*` → heuristic title, otherwise no suggestion. Handler-level:
 * `fail-*` → 400, `slow-*` → answered after a delay.
 */
export function inspectFixture(file: File): InspectedFile {
  const base = { fileName: file.name, sizeBytes: file.size };
  const name = file.name.replace(/^slow-/, '');
  if (name.startsWith('fm-') && name.endsWith('.md')) {
    return {
      ...base,
      format: 'md',
      source: 'front-matter',
      suggested: { title: 'Guía desde front matter', author: 'Autora FM', version: '3.2.0', tags: ['fm'] },
    };
  }
  if (name.endsWith('.pdf')) {
    return {
      ...base,
      format: 'pdf',
      pages: 12,
      source: 'pdf-info',
      suggested: { title: 'Título del PDF', author: 'Autor PDF' },
    };
  }
  if (name.startsWith('heur-')) {
    return { ...base, format: 'txt', source: 'heuristic', suggested: { title: 'Título heurístico' } };
  }
  return { ...base, format: 'txt', source: 'none', suggested: {} };
}

export const handlers = [
  http.get('*/api/health', () => HttpResponse.json({ status: 'ok' })),

  http.post('*/api/documents/inspect', async ({ request }) => {
    const form = await request.formData();
    const files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
    if (files.some((file) => file.name.startsWith('fail-'))) {
      return HttpResponse.json(apiError(400, 'Bad Request', 'Unsupported format', '/documents/inspect'), {
        status: 400,
      });
    }
    if (files.some((file) => file.name.startsWith('slow-'))) await delay(300);
    const response: InspectResponse = { items: files.map(inspectFixture) };
    return HttpResponse.json(response);
  }),

  http.get('*/api/search', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '10');
    if (!q) {
      return HttpResponse.json(apiError(400, 'Bad Request', 'q is required', url.pathname), { status: 400 });
    }
    const matches = q.toLowerCase().includes('kubernetes');
    return HttpResponse.json(
      {
        ...SEARCH_FIXTURE,
        items: matches ? SEARCH_FIXTURE.items : [],
        total: matches ? SEARCH_FIXTURE.total : 0,
        page,
        pageSize,
      } satisfies SearchResponse,
      { headers: { 'X-Response-Time': '12ms' } },
    );
  }),

  http.get('*/api/documents/:id', ({ params, request }) => {
    const document = documents.get(String(params.id));
    if (!document) {
      return HttpResponse.json(
        apiError(404, 'Not Found', `Document ${String(params.id)} not found`, new URL(request.url).pathname),
        { status: 404 },
      );
    }
    return HttpResponse.json(document);
  }),

  http.post('*/api/documents', async ({ request }) => {
    const form = await request.formData();
    const files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
    const metadata = JSON.parse(String(form.get('metadata') ?? '[]')) as unknown[];
    if (files.length === 0 || files.length !== metadata.length) {
      return HttpResponse.json(apiError(400, 'Bad Request', 'files and metadata must be aligned', '/documents'), {
        status: 400,
      });
    }
    const response: UploadAcceptedResponse = {
      items: files.map((file, index) => {
        const sent = metadata[index] as { version?: string } | undefined;
        // Files named `dup-*` simulate a byte-identical re-upload of the indexed fixture.
        if (file.name.startsWith('dup-')) {
          return {
            id: INDEXED_DOC.id,
            status: INDEXED_DOC.status,
            fileName: file.name,
            version: INDEXED_DOC.version,
            duplicateOf: { id: INDEXED_DOC.id, version: INDEXED_DOC.version },
          };
        }
        return {
          id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`,
          status: DocumentStatus.PROCESSING,
          fileName: file.name,
          version: sent?.version ?? '1.0.0',
        };
      }),
    };
    return HttpResponse.json(response, { status: 202 });
  }),
];
