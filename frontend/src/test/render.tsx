import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DocumentEventsProvider } from '@/features/notifications/DocumentEventsProvider';
import { ToastProvider } from '@/features/notifications/ToastContext';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface RenderAppOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL, e.g. `/search?q=kubernetes`. */
  route?: string;
  /** Route pattern the element is mounted at, e.g. `/documents/:id`. */
  path?: string;
  /** Router state attached to the initial entry (e.g. `{ from }`). */
  state?: unknown;
  queryClient?: QueryClient;
  /** Mounts the SSE provider (uses the mocked `EventSource`). */
  withEvents?: boolean;
}

export function renderWithProviders(ui: ReactElement, options: RenderAppOptions = {}) {
  const {
    route = '/',
    path = '*',
    state,
    queryClient = createTestQueryClient(),
    withEvents = false,
    ...rest
  } = options;
  const [pathname = '/', search = ''] = route.split('?');
  const initialEntry = { pathname, search: search ? `?${search}` : '', state };

  function Wrapper({ children }: { children: ReactNode }) {
    const body = (
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path={path} element={children} />
        </Routes>
      </MemoryRouter>
    );
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{withEvents ? <DocumentEventsProvider>{body}</DocumentEventsProvider> : body}</ToastProvider>
      </QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...rest }) };
}
