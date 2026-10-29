import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useConnectionState } from '@/features/notifications/DocumentEventsProvider';
import { ToastViewport } from '@/features/notifications/ToastViewport';
import type { ConnectionState } from '@/features/notifications/useDocumentEvents';
import { TableOfContents } from '@/features/viewer/components/TableOfContents';
import { DocumentOutlineProvider, useOutline } from './DocumentOutlineContext';
import { SearchIcon, UploadIcon } from './NavIcons';
import { ThemeToggle } from './ThemeToggle';

const NAV: { to: string; label: string; icon: () => ReactNode }[] = [
  { to: '/search', label: 'Buscar', icon: SearchIcon },
  { to: '/upload', label: 'Cargar', icon: UploadIcon },
];

const CONNECTION: Record<ConnectionState, { label: string; dot: string }> = {
  connecting: { label: 'Conectando notificaciones', dot: 'bg-busy' },
  open: { label: 'Notificaciones en vivo', dot: 'bg-ok' },
  reconnecting: { label: 'Reconectando notificaciones', dot: 'bg-busy animate-pulse' },
  closed: { label: 'Notificaciones sin conexión', dot: 'bg-bad' },
};

/** Top bar below `md`, sticky left rail from `md`; the outline slot shows from `lg`. */
function Shell() {
  const connection = CONNECTION[useConnectionState()];
  const outline = useOutline();

  return (
    <div className="min-h-screen bg-ground text-ink md:flex">
      <header className="flex h-14 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4 md:sticky md:top-0 md:h-screen md:w-[232px] md:shrink-0 md:flex-col md:items-stretch md:gap-7 md:overflow-y-auto md:border-b-0 md:border-r md:px-4 md:py-6">
        <NavLink to="/search" className="flex min-h-11 items-center gap-3 rounded-lg px-2 focus-ring">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-[13px] font-bold text-ground"
          >
            Dt
          </span>
          <span className="sr-only sm:not-sr-only text-[15px] font-bold leading-tight">Documentación técnica</span>
        </NavLink>

        <nav aria-label="Principal" className="flex items-center gap-1 md:flex-col md:items-stretch">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-[15px] focus-ring ${
                  isActive ? 'bg-raised font-bold text-ink' : 'text-ink-soft hover:bg-raised hover:text-ink'
                }`
              }
            >
              <item.icon />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <TableOfContents headings={outline} className="hidden lg:block" />

        <div className="ml-auto flex items-center gap-1 md:mt-auto md:ml-0 md:flex-col md:items-stretch md:gap-2">
          <ThemeToggle />
          <p
            title="Estado de la conexión de notificaciones en tiempo real"
            className="flex min-h-11 items-center gap-2 px-3 text-[13px] text-ink-label"
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${connection.dot}`} />
            <span className="sr-only md:not-sr-only">{connection.label}</span>
          </p>
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10 lg:px-14">
        <Outlet />
      </main>
      <ToastViewport />
    </div>
  );
}

export function AppShell() {
  return (
    <DocumentOutlineProvider>
      <Shell />
    </DocumentOutlineProvider>
  );
}
