import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/molecules';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Página no encontrada"
      description="La ruta solicitada no existe."
      action={
        <Link to="/search" className="text-sm font-medium text-indigo-700 underline">
          Ir a la búsqueda
        </Link>
      }
    />
  );
}
