'use client';

import { useState } from 'react';

export interface PaginationState<T> {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  /** Ítems de la página actual. */
  pageItems: T[];
  /** Índice 1-based del primer ítem mostrado (0 si la lista está vacía). */
  from: number;
  /** Índice 1-based del último ítem mostrado. */
  to: number;
  canPrev: boolean;
  canNext: boolean;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  prev: () => void;
  next: () => void;
}

/**
 * Paginación del lado del cliente sobre una lista ya cargada en memoria.
 *
 * - `pageSize`: tamaño de página inicial (por defecto 25).
 * - `resetKey`: cuando cambia (p. ej. al cambiar de filtro o término de búsqueda),
 *   la paginación vuelve a la página 1 para no quedar en una página vacía.
 */
export function usePagination<T>(
  items: T[],
  opts?: { pageSize?: number; resetKey?: unknown },
): PaginationState<T> {
  const [pageSize, setPageSizeState] = useState(opts?.pageSize ?? 25);
  const [page, setPageState] = useState(1);

  // Reset de página al cambiar filtros/búsqueda o tamaño de página, usando el
  // patrón recomendado por React (ajustar estado durante el render comparando
  // contra el valor previo) en lugar de un efecto con setState.
  const resetKey = opts?.resetKey;
  const [prevKey, setPrevKey] = useState(resetKey);
  const [prevPageSize, setPrevPageSize] = useState(pageSize);
  if (resetKey !== prevKey || pageSize !== prevPageSize) {
    setPrevKey(resetKey);
    setPrevPageSize(pageSize);
    setPageState(1);
  }

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // `current` queda siempre dentro de rango aunque `page` haya quedado alto
  // (p. ej. si la lista se encogió): se usa para cortar y derivar todo.
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  const setPage = (p: number) => setPageState(Math.min(Math.max(1, p), pageCount));

  return {
    page: current,
    pageSize,
    pageCount,
    total,
    pageItems,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
    canPrev: current > 1,
    canNext: current < pageCount,
    setPage,
    setPageSize: (n: number) => setPageSizeState(n),
    prev: () => setPage(current - 1),
    next: () => setPage(current + 1),
  };
}
