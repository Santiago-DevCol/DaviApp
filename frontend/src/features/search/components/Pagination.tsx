import { Button } from '@/components/atoms';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ page, pageSize, total, onPageChange, disabled = false }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-[13px] text-ink-label">
        Mostrando {first}–{last} de {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => onPageChange(page - 1)} disabled={disabled || page <= 1}>
          Anterior
        </Button>
        <span className="text-[13px] text-ink-label" aria-current="page">
          Página {page} de {pageCount}
        </span>
        <Button variant="secondary" onClick={() => onPageChange(page + 1)} disabled={disabled || page >= pageCount}>
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
