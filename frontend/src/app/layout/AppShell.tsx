import { NavLink, Outlet } from 'react-router-dom';
import { useConnectionState } from '@/features/notifications/DocumentEventsProvider';
import { ToastViewport } from '@/features/notifications/ToastViewport';
import type { ConnectionState } from '@/features/notifications/useDocumentEvents';

const NAV = [
  { to: '/upload', label: 'Cargar' },
  { to: '/search', label: 'Buscar' },
];

const CONNECTION: Record<ConnectionState, { label: string; dot: string }> = {
  connecting: { label: 'Conectando', dot: 'bg-amber-400' },
  open: { label: 'En vivo', dot: 'bg-emerald-500' },
  reconnecting: { label: 'Reconectando', dot: 'bg-amber-400 animate-pulse' },
  closed: { label: 'Sin conexión', dot: 'bg-red-500' },
};

export function AppShell() {
  const connection = useConnectionState();
  const indicator = CONNECTION[connection];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <NavLink to="/search" className="text-base font-semibold tracking-tight text-slate-900">
            Documentación técnica
          </NavLink>
          <nav aria-label="Principal" className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div
            className="ml-auto flex items-center gap-2 text-xs text-slate-500"
            title="Estado de la conexión de notificaciones en tiempo real"
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${indicator.dot}`} />
            <span>
              <span className="sr-only">Notificaciones: </span>
              {indicator.label}
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <ToastViewport />
    </div>
  );
}
