'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PersonaRecord } from '@/lib/airtable';
import { authorizePersona, unauthorizePersona } from '@/app/actions';

interface Props {
  personas: PersonaRecord[];
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

type Filter = 'todos' | 'pendientes' | 'autorizados' | 'vencidos';

export default function PersonasPanel({ personas, tipo }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('todos');
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
    todos:       personas.length,
    pendientes:  personas.filter(p => !p.autorizado).length,
    autorizados: personas.filter(p => p.autorizado && !isExpired(p.vence)).length,
    vencidos:    personas.filter(p => isExpired(p.vence)).length,
  };

  const filtered = personas.filter(p => {
    if (filter === 'pendientes')  return !p.autorizado;
    if (filter === 'autorizados') return p.autorizado && !isExpired(p.vence);
    if (filter === 'vencidos')    return isExpired(p.vence);
    return true;
  });

  function handleAuthorize(id: string, authorize: boolean) {
    setActionError(null);
    startTransition(async () => {
      const res = authorize ? await authorizePersona(id) : await unauthorizePersona(id);
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
                <th>Nombre</th>
                <th>Cédula</th>
                <th>Cargo</th>
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
                    <td data-label="Nombre" style={{ fontWeight: 600 }}>{p.nombre || '—'}</td>
                    <td data-label="Cédula" style={{ color: 'var(--g-ink-2)', fontSize: 13 }}>{p.cedula || '—'}</td>
                    <td data-label="Cargo" style={{ fontSize: 13, color: 'var(--g-ink-2)' }}>{p.cargo || '—'}</td>
                    <td data-label="Estado">
                      {expired ? (
                        <span className="badge badge-negado">Vencido</span>
                      ) : p.autorizado ? (
                        <span className="badge badge-aprobado">Autorizado</span>
                      ) : (
                        <span className="badge badge-pendiente">Pendiente</span>
                      )}
                    </td>
                    <td data-label="Vence" style={{ fontSize: 13, color: expired ? 'var(--g-coral)' : 'var(--g-ink-2)' }}>
                      {formatDate(p.vence)}
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
