import { DocumentStatus } from '@techdocs/shared';
import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MockEventSource } from '@/test/mockEventSource';
import { INDEXED_DOC, PROCESSING_DOC, setDocument } from '@/test/msw/handlers';
import { renderWithProviders } from '@/test/render';
import { DocumentPage } from './DocumentPage';

describe('DocumentPage', () => {
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
    expect(screen.getByText('Indexado')).toBeInTheDocument();
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
    expect(screen.getByText('Procesando')).toBeInTheDocument();

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
    expect(screen.getByText('Indexado')).toBeInTheDocument();
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
