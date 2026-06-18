'use client';

import type { PaginationState } from '@/lib/usePagination';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

/** Genera la lista de páginas a mostrar con elipsis: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(current: number, pageCount: number): (number | '…')[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages: (number | '…')[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(pageCount - 1, current + 1);
  if (left > 2) pages.push('…');
  for (let p = left; p <= right; p++) pages.push(p);
  if (right < pageCount - 1) pages.push('…');
  pages.push(pageCount);
  return pages;
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pagination: PaginationState<any>;
  /** Etiqueta del tipo de ítem para el resumen (ej. "registros"). */
  label?: string;
}

export default function Pagination({ pagination, label = 'registros' }: Props) {
  const { page, pageCount, pageSize, total, from, to, canPrev, canNext, setPage, setPageSize, prev, next } = pagination;

  // Con una sola página y pocos ítems no tiene sentido mostrar controles.
  if (total <= PAGE_SIZE_OPTIONS[0] && pageCount <= 1) return null;

  const pages = pageWindow(page, pageCount);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, padding: '14px 24px',
        borderTop: '1px solid var(--g-line)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--g-ink-3)' }}>
          Mostrando <strong style={{ color: 'var(--g-ink-2)' }}>{from}–{to}</strong> de{' '}
          <strong style={{ color: 'var(--g-ink-2)' }}>{total}</strong> {label}
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--g-ink-3)' }}>
          Por página
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
            className="db-filter-select"
            style={{ padding: '4px 8px', fontSize: 13 }}
          >
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={prev}
          disabled={!canPrev}
          aria-label="Página anterior"
        >
          ‹ Anterior
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} style={{ padding: '0 4px', color: 'var(--g-ink-3)' }}>…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`btn btn-sm${p === page ? ' btn-primary' : ' btn-ghost'}`}
              style={{ minWidth: 34, padding: '4px 8px' }}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={next}
          disabled={!canNext}
          aria-label="Página siguiente"
        >
          Siguiente ›
        </button>
      </div>
    </div>
  );
}
