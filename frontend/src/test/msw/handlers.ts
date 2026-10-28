import {
  DocumentStatus,
  type ApiError,
  type DocumentDetail,
  type SearchResponse,
  type UploadAcceptedResponse,
} from '@techdocs/shared';
import { http, HttpResponse } from 'msw';

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
}

export function setDocument(document: DocumentDetail): void {
  documents.set(document.id, document);
}

resetFixtures();

function apiError(statusCode: number, error: string, message: string, path: string): ApiError {
  return { statusCode, error, message, timestamp: new Date().toISOString(), path };
}

export const handlers = [
  http.get('*/api/health', () => HttpResponse.json({ status: 'ok' })),

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
      items: files.map((file, index) => ({
        id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`,
        status: DocumentStatus.PROCESSING,
        fileName: file.name,
      })),
    };
    return HttpResponse.json(response, { status: 202 });
  }),
];
