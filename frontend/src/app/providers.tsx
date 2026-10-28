import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiClientError } from '@/api/client';
import { DocumentEventsProvider } from '@/features/notifications/DocumentEventsProvider';
import { ToastProvider } from '@/features/notifications/ToastContext';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Client errors (404, 400...) will not heal by retrying.
          if (ApiClientError.is(error) && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

export interface AppProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

/** Server state (TanStack Query), toasts and the single SSE subscription. */
export function AppProviders({ children, queryClient }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <DocumentEventsProvider>{children}</DocumentEventsProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
