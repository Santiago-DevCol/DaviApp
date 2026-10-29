import { DocumentStatus } from '@techdocs/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MockEventSource } from '@/test/mockEventSource';
import { INDEXED_DOC, OLD_VERSION_DOC, PROCESSING_DOC, setDocument } from '@/test/msw/handlers';
import { renderWithProviders } from '@/test/render';
import { DocumentPage } from './DocumentPage';

const OUTLINED_MARKDOWN = '# Despliegue\n\n## Requisitos\n\nTexto\n\n## Pasos\n\n- Paso uno';

describe('DocumentPage', () => {
  it('gives Markdown section headings an anchor id for the outline', async () => {
    setDocument({ ...INDEXED_DOC, content: OUTLINED_MARKDOWN });
    renderWithProviders(<DocumentPage />, {
      route: `/documents/${INDEXED_DOC.id}`,
      path: '/documents/:id',
    });

    // Wait for the query to resolve first so DocumentBody is mounted before we
    // start the timeout on the lazy MarkdownBody chunk.
    await screen.findByRole('heading', { level: 1, name: INDEXED_DOC.title });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Requisitos' }, { timeout: 5000 }),
    ).toHaveAttribute('id', 'requisitos');
    expect(screen.getByRole('heading', { level: 2, name: 'Pasos' })).toHaveAttribute('id', 'pasos');
  }, 10_000);

  it('shows the metadata values in the aside and offers no download control', async () => {
    renderWithProviders(<DocumentPage />, {
      route: `/documents/${INDEXED_DOC.id}`,
      path: '/documents/:id',
    });

    const aside = await screen.findByRole('complementary', { name: 'Metadatos' });
    expect(within(aside).getByText(INDEXED_DOC.category)).toBeInTheDocument();
    expect(within(aside).getByText(INDEXED_DOC.version)).toBeInTheDocument();
    expect(within(aside).getByText(/k8s-guide\.md/)).toBeInTheDocument();
    expect(within(aside).getByText('kubernetes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Descargar/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Descargar/ })).toBeNull();
  });

  it('renders an indexed Markdown document with its metadata', async () => {
    renderWithProviders(<DocumentPage />, {
      route: `/documents/${INDEXED_DOC.id}`,
      path: '/documents/:id',
    });

    expect(await screen.findByRole('heading', { level: 1, name: INDEXED_DOC.title })).toBeInTheDocument();
    // The Markdown renderer is code-split, so its output arrives asynchronously.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Despliegue' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('kubectl apply')).toBeInTheDocument();
    expect(screen.getByText('Paso uno').closest('ul')).not.toBeNull();
    expect(screen.getByText('Equipo Plataforma')).toBeInTheDocument();
    expect(screen.getAllByText('Indexado').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Volver a resultados/ })).toHaveAttribute('href', '/search');
    // Keep the per-test timeout above the 5 s wait for the lazy chunk; Vitest defaults to 5 s.
  }, 10_000);

  it('shows the processing banner and flips to the content after the SSE event', async () => {
    renderWithProviders(<DocumentPage />, {
      route: `/documents/${PROCESSING_DOC.id}`,
      path: '/documents/:id',
      withEvents: true,
    });

    expect(await screen.findByText('El documento se está procesando')).toBeInTheDocument();
    expect(screen.getAllByText('Procesando').length).toBeGreaterThan(0);

    // The backend finishes indexing: the detail now has content, and the event arrives.
    setDocument({ ...PROCESSING_DOC, status: DocumentStatus.INDEXED, content: 'Texto indexado del documento.' });
    act(() =>
      MockEventSource.latest().emit('document.status', {
        id: PROCESSING_DOC.id,
        status: DocumentStatus.INDEXED,
        occurredAt: '2026-10-02T10:00:09.000Z',
      }),
    );

    expect(await screen.findByText('Texto indexado del documento.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('El documento se está procesando')).toBeNull());
    expect(screen.getAllByText('Indexado').length).toBeGreaterThan(0);
    // The toast viewport is rendered by the shell; here only the cache-driven UI is asserted.
  });

  it('shows the error banner for failed documents', async () => {
    setDocument({ ...PROCESSING_DOC, status: DocumentStatus.ERROR, errorMessage: 'No se pudo extraer texto' });
    renderWithProviders(<DocumentPage />, {
      route: `/documents/${PROCESSING_DOC.id}`,
      path: '/documents/:id',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo extraer texto');
  });

  it('flags an outdated version and links to the latest one', async () => {
    renderWithProviders(<DocumentPage />, {
      route: `/documents/${OLD_VERSION_DOC.id}`,
      path: '/documents/:id',
    });

    await screen.findByRole('heading', { level: 1, name: OLD_VERSION_DOC.title });
    const banner = screen.getByText('Existe una versión más reciente').closest('div');
    expect(banner).not.toBeNull();
    expect(within(banner!).getByRole('link', { name: /v2\.1\.0/ })).toHaveAttribute(
      'href',
      `/documents/${INDEXED_DOC.id}`,
    );
  });

  it('does not show the outdated banner on the latest version', async () => {
    renderWithProviders(<DocumentPage />, {
      route: `/documents/${INDEXED_DOC.id}`,
      path: '/documents/:id',
    });

    await screen.findByRole('heading', { level: 1, name: INDEXED_DOC.title });
    expect(screen.queryByText('Existe una versión más reciente')).toBeNull();
  });

  it('shows a not-found state for unknown ids', async () => {
    renderWithProviders(<DocumentPage />, {
      route: '/documents/99999999-9999-4999-8999-999999999999',
      path: '/documents/:id',
    });
    expect(await screen.findByText('Documento no encontrado')).toBeInTheDocument();
  });

  it('links back to the previous search when provided', async () => {
    renderWithProviders(<DocumentPage />, {
      route: `/documents/${INDEXED_DOC.id}`,
      path: '/documents/:id',
      state: { from: '/search?q=kubernetes&page=2' },
    });
    await screen.findByRole('heading', { level: 1, name: INDEXED_DOC.title });
    expect(screen.getByRole('link', { name: /Volver a resultados/ })).toHaveAttribute(
      'href',
      '/search?q=kubernetes&page=2',
    );
  });
});
