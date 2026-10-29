import type { SearchResponse } from '@techdocs/shared';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation, useNavigationType } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SEARCH_FIXTURE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { SearchPage } from './SearchPage';

/** Exposes the current URL and how it was reached (POP / PUSH / REPLACE). */
function LocationProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();
  return (
    <output data-testid="location">
      {navigationType} {location.pathname}
      {location.search}
    </output>
  );
}

describe('SearchPage', () => {
  it('shows the empty state and performs no request without a query', () => {
    renderWithProviders(<SearchPage />, { route: '/search', path: '/search' });
    expect(screen.getByText('Escribe un término para buscar')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders results from the API with highlights, total and latency', async () => {
    renderWithProviders(<SearchPage />, { route: '/search?q=kubernetes', path: '/search' });

    const link = await screen.findByRole('link', { name: 'Guía de despliegue en Kubernetes' });
    expect(link).toHaveAttribute('href', '/documents/11111111-1111-4111-8111-111111111111');
    expect(screen.getByRole('list', { name: 'Resultados' })).toContainElement(link);
    expect(screen.getByText('1 resultado para «kubernetes»')).toBeInTheDocument();
    expect(screen.getByText('12 ms')).toBeInTheDocument();
    expect(document.querySelectorAll('mark')).toHaveLength(2);
    expect(screen.getByText('Indexado')).toBeInTheDocument();
  });

  it('shows a no-results state', async () => {
    renderWithProviders(<SearchPage />, { route: '/search?q=nada', path: '/search' });
    expect(await screen.findByText('No hay resultados para «nada»')).toBeInTheDocument();
  });

  it('replaces an out-of-range ?page= with the last valid page', async () => {
    // 15 results over pages of 10: page 7 is empty but page 2 is the last valid one.
    server.use(
      http.get('*/api/search', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
        return HttpResponse.json({
          ...SEARCH_FIXTURE,
          items: page === 2 ? SEARCH_FIXTURE.items : [],
          total: 15,
          page,
          pageSize: 10,
        } satisfies SearchResponse);
      }),
    );
    renderWithProviders(
      <>
        <SearchPage />
        <LocationProbe />
      </>,
      { route: '/search?q=kubernetes&page=7', path: '/search' },
    );

    expect(await screen.findByRole('link', { name: 'Guía de despliegue en Kubernetes' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('REPLACE /search?q=kubernetes&page=2');
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
  });

  it('shows the no-results state for an out-of-range page when nothing matches', async () => {
    renderWithProviders(
      <>
        <SearchPage />
        <LocationProbe />
      </>,
      { route: '/search?q=nada&page=3', path: '/search' },
    );
    expect(await screen.findByText('No hay resultados para «nada»')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('POP /search?q=nada&page=3');
  });

  it('shows an error state with retry when the API fails', async () => {
    server.use(
      http.get('*/api/search', () =>
        HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'boom', timestamp: '', path: '/search' },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<SearchPage />, { route: '/search?q=kubernetes', path: '/search' });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'));
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
