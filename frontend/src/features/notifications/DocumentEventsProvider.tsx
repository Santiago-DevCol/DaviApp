import { createContext, useContext, type ReactNode } from 'react';
import { useToasts } from './ToastContext';
import { useDocumentEvents, type ConnectionState } from './useDocumentEvents';

const ConnectionStateContext = createContext<ConnectionState>('connecting');

/** Owns the app-wide SSE subscription and exposes its connection state. */
export function DocumentEventsProvider({ children }: { children: ReactNode }) {
  const { push } = useToasts();
  const state = useDocumentEvents({ notify: push });
  return <ConnectionStateContext.Provider value={state}>{children}</ConnectionStateContext.Provider>;
}

export function useConnectionState(): ConnectionState {
  return useContext(ConnectionStateContext);
}
