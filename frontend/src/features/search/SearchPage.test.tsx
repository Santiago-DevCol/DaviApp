import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { SearchPage } from './SearchPage';

describe('SearchPage', () => {
  it('shows the empty state and performs no request without a query', () => {
    renderWithProviders(<SearchPage />, { route: '/search', path: '/search' });
    expect(screen.getByText('Escribe un término para buscar')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders results from the API with highlights, total and latency', async () => {
    renderWithProviders(<SearchPage />, { route: '/search?q=kubernetes', path: '/search' });

    expect(await screen.findByRole('link', { name: 'Guía de despliegue en Kubernetes' })).toHaveAttribute(
      'href',
      '/documents/11111111-1111-4111-8111-111111111111',
    );
    expect(screen.getByText('1 resultado para «kubernetes»')).toBeInTheDocument();
    expect(screen.getByText('12 ms')).toBeInTheDocument();
    expect(document.querySelectorAll('mark')).toHaveLength(2);
    expect(screen.getByText('INDEXADO')).toBeInTheDocument();
  });

  it('shows a no-results state', async () => {
    renderWithProviders(<SearchPage />, { route: '/search?q=nada', path: '/search' });
    expect(await screen.findByText('No hay resultados para «nada»')).toBeInTheDocument();
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
