import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MockEventSource } from '@/test/mockEventSource';
import { createTestQueryClient } from '@/test/render';
import { AppProviders } from '../providers';
import { routes } from '../router';

function renderApp(route = '/search') {
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  return render(
    <AppProviders queryClient={createTestQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe('AppShell', () => {
  it('offers the main navigation in order and marks the current page', async () => {
    renderApp('/search');
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Buscar', 'Cargar']);
    expect(links[0]).toHaveAttribute('href', '/search');
    expect(links[1]).toHaveAttribute('href', '/upload');
    expect(within(nav).getByRole('link', { name: 'Buscar' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Cargar' })).not.toHaveAttribute('aria-current');
  });

  it('links the brand back to the search page', async () => {
    renderApp('/upload');
    expect(await screen.findByRole('link', { name: 'Documentación técnica' })).toHaveAttribute('href', '/search');
  });

  it('shows the notifications connection state and follows the stream', async () => {
    renderApp('/search');
    expect(await screen.findByText('Conectando notificaciones')).toBeInTheDocument();
    act(() => MockEventSource.latest().emitOpen());
    expect(screen.getByText('Notificaciones en vivo')).toBeInTheDocument();
    expect(screen.queryByText('Conectando notificaciones')).toBeNull();
  });

  it('toggles night mode from the rail', async () => {
    const user = userEvent.setup();
    renderApp('/search');
    const toggle = await screen.findByRole('button', { name: 'Modo noche' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Modo día' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('renders the page inside the main landmark without an outline on the search page', async () => {
    renderApp('/search');
    const main = await screen.findByRole('main');
    expect(within(main).getByRole('heading', { level: 1, name: 'Buscar documentación' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'En este documento' })).toBeNull();
  });
});
