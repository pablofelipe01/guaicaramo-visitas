'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PlacaRecord } from '@/lib/airtable';
import { authorizePlaca, unauthorizePlaca, denyPlaca } from '@/app/actions';

interface Props {
  placas: PlacaRecord[];
  tipo: string;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    // Always display in Colombia timezone (UTC-5, no DST) regardless of server TZ
    const parts = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d);
    const g = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
    return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`;
  } catch { return iso; }
}

function isExpired(vence?: string) {
  if (!vence) return false;
  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight by JS, causing
  // false positives in negative-UTC-offset timezones. Treat them as end-of-day
  // local time so a record dated "today" is never shown as expired.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(vence) ? `${vence}T23:59:59` : vence;
  return new Date(normalized) < new Date();
}

type Filter = 'todos' | 'pendientes' | 'autorizados' | 'rechazados' | 'vencidos';

export default function PlacasPanel({ placas, tipo }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('todos');
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  function toggleNote(id: string) {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const canAuthorize = tipo === 'Autoriza';

  const counts = {
    todos:       placas.length,
    pendientes:  placas.filter(p => !p.autorizado && p.estado !== 'RECHAZADO').length,
    autorizados: placas.filter(p => p.autorizado && !isExpired(p.vence)).length,
    rechazados:  placas.filter(p => p.estado === 'RECHAZADO').length,
    vencidos:    placas.filter(p => isExpired(p.vence)).length,
  };

  const byTab = placas.filter(p => {
    if (filter === 'pendientes')  return !p.autorizado && p.estado !== 'RECHAZADO';
    if (filter === 'autorizados') return p.autorizado && !isExpired(p.vence);
    if (filter === 'rechazados')  return p.estado === 'RECHAZADO';
    if (filter === 'vencidos')    return isExpired(p.vence);
    return true;
  });

  const term = search.toLowerCase().trim();
  const filtered = term
    ? byTab.filter(p =>
        p.placa.toLowerCase().includes(term) ||
        p.conductor.toLowerCase().includes(term) ||
        p.cedula.toLowerCase().includes(term)
      )
    : byTab;

  function handleAuthorize(id: string, authorize: boolean) {
    setActionError(null);
    startTransition(async () => {
      const res = authorize ? await authorizePlaca(id) : await unauthorizePlaca(id);
      if (!res.ok) { setActionError(res.message ?? 'Error'); return; }
      router.refresh();
    });
  }

  function handleDeny(id: string) {
    setActionError(null);
    startTransition(async () => {
      const res = await denyPlaca(id);
      if (!res.ok) { setActionError(res.message ?? 'Error'); return; }
      router.refresh();
    });
  }

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'todos',       label: 'Todos',       count: counts.todos       },
    { key: 'pendientes',  label: 'Pendientes',  count: counts.pendientes  },
    { key: 'autorizados', label: 'Autorizados', count: counts.autorizados },
    { key: 'rechazados',  label: 'Rechazados',  count: counts.rechazados  },
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

      <div className="db-search-bar">
        <div className="db-search-wrap">
          <span className="db-search-icon">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="9" r="7"/><path d="M16 16l-3.5-3.5"/>
            </svg>
          </span>
          <input
            className="db-search-input"
            type="text"
            placeholder="Buscar por placa, conductor o cédula…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="db-search-clear" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">×</button>
          )}
        </div>
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
                <th>Registrado por</th>
                <th>Notas</th>
                {canAuthorize && <th style={{ textAlign: 'right' }}>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const expired = isExpired(p.vence);
                return (
                  <tr key={p.id}>
                    <td data-label="Placa">
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                        background: 'var(--g-green-soft)', color: 'var(--g-green-dark)',
                        padding: '3px 9px', borderRadius: 8, letterSpacing: '0.05em',
                      }}>
                        {p.placa || '—'}
                      </span>
                    </td>
                    <td data-label="Conductor" style={{ fontWeight: 600 }}>{p.conductor || '—'}</td>
                    <td data-label="Cédula" style={{ color: 'var(--g-ink-2)', fontSize: 13 }}>{p.cedula || '—'}</td>
                    <td data-label="Estado">
                      {expired ? (
                        <span className="badge badge-negado">Vencido</span>
                      ) : p.estado === 'RECHAZADO' ? (
                        <span className="badge badge-negado">Rechazado</span>
                      ) : p.autorizado ? (
                        <span className="badge badge-aprobado">Autorizado</span>
                      ) : (
                        <span className="badge badge-pendiente">Pendiente</span>
                      )}
                    </td>
                    <td data-label="Vence" style={{ fontSize: 13, color: expired ? 'var(--g-coral)' : 'var(--g-ink-2)' }}>
                      {formatDate(p.vence)}
                    </td>
                    <td data-label="Registrado por" style={{ fontSize: 12, color: 'var(--g-ink-3)' }}>
                      {p.responsable_visita || '—'}
                    </td>
                    <td data-label="Notas" style={{ fontSize: 12, color: 'var(--g-ink-3)', maxWidth: expandedNotes.has(p.id) ? undefined : 200 }}>
                      <span
                        title={expandedNotes.has(p.id) ? undefined : p.notas}
                        onClick={p.notas ? () => toggleNote(p.id) : undefined}
                        style={{
                          display: expandedNotes.has(p.id) ? 'block' : '-webkit-box',
                          WebkitLineClamp: expandedNotes.has(p.id) ? undefined : 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: expandedNotes.has(p.id) ? 'visible' : 'hidden',
                          cursor: p.notas ? 'pointer' : 'default',
                          textDecoration: p.notas && !expandedNotes.has(p.id) ? 'underline dotted' : 'none',
                        }}
                      >
                        {p.notas || '—'}
                      </span>
                    </td>
                    {canAuthorize && (
                      <td data-label="Acción" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {p.autorizado ? (
                          <button
                            onClick={() => handleAuthorize(p.id, false)}
                            disabled={isPending}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--g-coral)', borderColor: 'rgba(220,53,69,.3)' }}
                          >
                            Revocar
                          </button>
                        ) : p.estado === 'RECHAZADO' ? (
                          <button
                            onClick={() => handleAuthorize(p.id, false)}
                            disabled={isPending}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--g-ink-3)', borderColor: 'rgba(0,0,0,.15)' }}
                          >
                            Restaurar
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleAuthorize(p.id, true)}
                              disabled={isPending}
                              className="btn btn-primary btn-sm"
                            >
                              Autorizar
                            </button>
                            <button
                              onClick={() => handleDeny(p.id)}
                              disabled={isPending}
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--g-coral)', borderColor: 'rgba(220,53,69,.3)' }}
                            >
                              Denegar
                            </button>
                          </div>
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
