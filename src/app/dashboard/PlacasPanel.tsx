'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PlacaRecord } from '@/lib/airtable';
import { authorizePlaca, unauthorizePlaca } from '@/app/actions';

interface Props {
  placas: PlacaRecord[];
  tipo: string;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return iso; }
}

function isExpired(vence?: string) {
  if (!vence) return false;
  return new Date(vence) < new Date();
}

type Filter = 'todos' | 'pendientes' | 'autorizados' | 'vencidos';

export default function PlacasPanel({ placas, tipo }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('todos');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canAuthorize = tipo === 'Autoriza';

  const counts = {
    todos:       placas.length,
    pendientes:  placas.filter(p => !p.autorizado).length,
    autorizados: placas.filter(p => p.autorizado && !isExpired(p.vence)).length,
    vencidos:    placas.filter(p => isExpired(p.vence)).length,
  };

  const filtered = placas.filter(p => {
    if (filter === 'pendientes')  return !p.autorizado;
    if (filter === 'autorizados') return p.autorizado && !isExpired(p.vence);
    if (filter === 'vencidos')    return isExpired(p.vence);
    return true;
  });

  function handleAuthorize(id: string, authorize: boolean) {
    setActionError(null);
    startTransition(async () => {
      const res = authorize ? await authorizePlaca(id) : await unauthorizePlaca(id);
      if (!res.ok) { setActionError(res.message ?? 'Error'); return; }
      router.refresh();
    });
  }

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'todos',       label: 'Todos',       count: counts.todos       },
    { key: 'pendientes',  label: 'Pendientes',  count: counts.pendientes  },
    { key: 'autorizados', label: 'Autorizados', count: counts.autorizados },
    { key: 'vencidos',    label: 'Vencidos',    count: counts.vencidos    },
  ];

  return (
    <div className="db-card">
      {/* Tabs / filters */}
      <div className="db-tabs">
        {FILTERS.map(f => (
          <button key={f.key} type="button"
            className={`db-tab${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}>
            {f.label}
            <span className="db-tab-count">{f.count}</span>
          </button>
        ))}
      </div>

      {actionError && (
        <div style={{ margin: '12px 24px 0', padding: '10px 14px', background: 'rgba(220,53,69,.08)', border: '1px solid rgba(220,53,69,.2)', borderRadius: 10, color: 'var(--g-coral)', fontSize: 13 }}>
          {actionError}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="db-table-empty">No hay registros en esta categoría.</div>
      ) : (
        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Conductor</th>
                <th>Cédula</th>
                <th>Estado</th>
                <th>Vence</th>
                <th>Notas</th>
                {canAuthorize && <th style={{ textAlign: 'right' }}>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const expired = isExpired(p.vence);
                return (
                  <tr key={p.id}>
                    <td>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                        background: 'var(--g-green-soft)', color: 'var(--g-green-dark)',
                        padding: '3px 9px', borderRadius: 8, letterSpacing: '0.05em',
                      }}>
                        {p.placa || '—'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.conductor || '—'}</td>
                    <td style={{ color: 'var(--g-ink-2)', fontSize: 13 }}>{p.cedula || '—'}</td>
                    <td>
                      {expired ? (
                        <span className="badge badge-negado">Vencido</span>
                      ) : p.autorizado ? (
                        <span className="badge badge-aprobado">Autorizado</span>
                      ) : (
                        <span className="badge badge-pendiente">Pendiente</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: expired ? 'var(--g-coral)' : 'var(--g-ink-2)' }}>
                      {formatDate(p.vence)}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--g-ink-3)', maxWidth: 200 }}>
                      <span title={p.notas} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {p.notas || '—'}
                      </span>
                    </td>
                    {canAuthorize && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {p.autorizado ? (
                          <button
                            onClick={() => handleAuthorize(p.id, false)}
                            disabled={isPending}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--g-coral)', borderColor: 'rgba(220,53,69,.3)' }}
                          >
                            Revocar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAuthorize(p.id, true)}
                            disabled={isPending}
                            className="btn btn-primary btn-sm"
                          >
                            Autorizar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
