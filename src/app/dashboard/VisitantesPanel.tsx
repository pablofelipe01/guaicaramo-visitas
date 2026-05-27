'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PlacaRecord, PersonaRecord } from '@/lib/airtable';
import { authorizePlaca, unauthorizePlaca, authorizePersona, unauthorizePersona } from '@/app/actions';

interface Props {
  placas: PlacaRecord[];
  personas: PersonaRecord[];
  tipo: string;
}

type Visitante = {
  id: string;
  tipo: 'vehiculo' | 'persona';
  placa?: string;
  nombre?: string;
  conductor?: string;
  cargo?: string;
  cedula?: string;
  autorizado: boolean;
  vence?: string;
  responsable_visita?: string;
  notas?: string;
  acompañanteIds?: string[];
};

/* ── Colores de grupo — 6 tonos suaves que rotan ── */
const GROUP_PALETTE: Array<{ bg: string; border: string }> = [
  { bg: 'rgba(99,102,241,.07)',  border: 'rgba(99,102,241,.4)'  }, // indigo
  { bg: 'rgba(20,184,166,.07)',  border: 'rgba(20,184,166,.4)'  }, // teal
  { bg: 'rgba(249,115,22,.07)',  border: 'rgba(249,115,22,.4)'  }, // naranja
  { bg: 'rgba(236,72,153,.07)',  border: 'rgba(236,72,153,.4)'  }, // rosa
  { bg: 'rgba(234,179,8,.07)',   border: 'rgba(234,179,8,.4)'   }, // ámbar
  { bg: 'rgba(139,92,246,.07)',  border: 'rgba(139,92,246,.4)'  }, // violeta
];

function buildGroups(placas: PlacaRecord[], personas: PersonaRecord[]) {
  const groupMap   = new Map<string, number>(); // id → índice de grupo
  const companionSet = new Set<string>();        // ids de acompañantes (no cabezas)
  let g = 0;

  for (const p of placas) {
    const ids = p.acompañanteIds ?? [];
    if (ids.length > 0) {
      groupMap.set(p.id, g);
      for (const aid of ids) { groupMap.set(aid, g); companionSet.add(aid); }
      g++;
    }
  }
  for (const p of personas) {
    const ids = p.acompañanteIds ?? [];
    if (ids.length > 0 && !groupMap.has(p.id)) {
      groupMap.set(p.id, g);
      for (const aid of ids) { groupMap.set(aid, g); companionSet.add(aid); }
      g++;
    }
  }
  return { groupMap, companionSet };
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
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
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(vence) ? `${vence}T23:59:59` : vence;
  return new Date(normalized) < new Date();
}

type Filter = 'todos' | 'pendientes' | 'autorizados' | 'vencidos';

export default function VisitantesPanel({ placas, personas, tipo }: Props) {
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

  const visitantes: Visitante[] = [
    ...placas.map(p => ({
      id: p.id,
      tipo: 'vehiculo' as const,
      placa: p.placa,
      conductor: p.conductor,
      cedula: p.cedula,
      autorizado: p.autorizado,
      vence: p.vence,
      responsable_visita: p.responsable_visita,
      notas: p.notas,
      acompañanteIds: p.acompañanteIds,
    })),
    ...personas.map(p => ({
      id: p.id,
      tipo: 'persona' as const,
      nombre: p.nombre,
      cargo: p.cargo,
      cedula: p.cedula,
      autorizado: p.autorizado,
      vence: p.vence,
      responsable_visita: p.responsable_visita,
      notas: p.notas,
      acompañanteIds: p.acompañanteIds,
    })),
  ];

  const { groupMap, companionSet } = buildGroups(placas, personas);

  const counts = {
    todos:       visitantes.length,
    pendientes:  visitantes.filter(v => !v.autorizado).length,
    autorizados: visitantes.filter(v => v.autorizado && !isExpired(v.vence)).length,
    vencidos:    visitantes.filter(v => isExpired(v.vence)).length,
  };

  const filtered = visitantes.filter(v => {
    if (filter === 'pendientes')  return !v.autorizado;
    if (filter === 'autorizados') return v.autorizado && !isExpired(v.vence);
    if (filter === 'vencidos')    return isExpired(v.vence);
    return true;
  });

  function handleAuthorize(id: string, visitType: 'vehiculo' | 'persona', authorize: boolean) {
    setActionError(null);
    startTransition(async () => {
      const res = visitType === 'vehiculo'
        ? authorize ? await authorizePlaca(id) : await unauthorizePlaca(id)
        : authorize ? await authorizePersona(id) : await unauthorizePersona(id);
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
                <th>Tipo</th>
                <th>Placa / Nombre</th>
                <th>Conductor / Cargo</th>
                <th>Cédula</th>
                <th>Estado</th>
                <th>Vence</th>
                <th>Registrado por</th>
                <th>Notas</th>
                {canAuthorize && <th style={{ textAlign: 'right' }}>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const expired      = isExpired(v.vence);
                const displayName  = v.tipo === 'vehiculo' ? v.placa    : v.nombre;
                const displaySub   = v.tipo === 'vehiculo' ? v.conductor : v.cargo;
                const groupIdx     = groupMap.get(v.id);
                const palette      = groupIdx !== undefined ? GROUP_PALETTE[groupIdx % GROUP_PALETTE.length] : null;
                const isCompanion  = companionSet.has(v.id);

                return (
                  <tr
                    key={v.id}
                    style={palette ? {
                      background: palette.bg,
                      boxShadow: `inset 3px 0 0 ${palette.border}`,
                    } : undefined}
                  >
                    <td data-label="Tipo">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        <span className="badge" style={{
                          background: v.tipo === 'vehiculo' ? 'var(--g-blue-soft)' : 'var(--g-purple-soft)',
                          color: v.tipo === 'vehiculo' ? 'var(--g-blue-dark)' : 'var(--g-purple-dark)',
                          fontSize: 11,
                        }}>
                          {v.tipo === 'vehiculo' ? 'Vehículo' : 'Persona'}
                        </span>
                        {isCompanion && (
                          <span style={{
                            fontSize: 10, color: 'var(--g-ink-3)',
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}>
                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M2 2v6h8"/>
                            </svg>
                            acompañante
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Placa / Nombre">
                      {v.tipo === 'vehiculo' ? (
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                          background: 'var(--g-green-soft)', color: 'var(--g-green-dark)',
                          padding: '3px 9px', borderRadius: 8, letterSpacing: '0.05em',
                        }}>
                          {displayName || '—'}
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600 }}>{displayName || '—'}</span>
                      )}
                    </td>
                    <td data-label="Conductor / Cargo" style={{ fontWeight: 600 }}>
                      {displaySub || '—'}
                    </td>
                    <td data-label="Cédula" style={{ color: 'var(--g-ink-2)', fontSize: 13 }}>
                      {v.cedula || '—'}
                    </td>
                    <td data-label="Estado">
                      {expired ? (
                        <span className="badge badge-negado">Vencido</span>
                      ) : v.autorizado ? (
                        <span className="badge badge-aprobado">Autorizado</span>
                      ) : (
                        <span className="badge badge-pendiente">Pendiente</span>
                      )}
                    </td>
                    <td data-label="Vence" style={{ fontSize: 13, color: expired ? 'var(--g-coral)' : 'var(--g-ink-2)' }}>
                      {formatDate(v.vence)}
                    </td>
                    <td data-label="Registrado por" style={{ fontSize: 12, color: 'var(--g-ink-3)' }}>
                      {v.responsable_visita || '—'}
                    </td>
                    <td data-label="Notas" style={{ fontSize: 12, color: 'var(--g-ink-3)', maxWidth: expandedNotes.has(v.id) ? undefined : 200 }}>
                      <span
                        title={expandedNotes.has(v.id) ? undefined : v.notas}
                        onClick={v.notas ? () => toggleNote(v.id) : undefined}
                        style={{
                          display: expandedNotes.has(v.id) ? 'block' : '-webkit-box',
                          WebkitLineClamp: expandedNotes.has(v.id) ? undefined : 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: expandedNotes.has(v.id) ? 'visible' : 'hidden',
                          cursor: v.notas ? 'pointer' : 'default',
                          textDecoration: v.notas && !expandedNotes.has(v.id) ? 'underline dotted' : 'none',
                        }}
                      >
                        {v.notas || '—'}
                      </span>
                    </td>
                    {canAuthorize && (
                      <td data-label="Acción" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {v.autorizado ? (
                          <button
                            onClick={() => handleAuthorize(v.id, v.tipo, false)}
                            disabled={isPending}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--g-coral)', borderColor: 'rgba(220,53,69,.3)' }}
                          >
                            Revocar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAuthorize(v.id, v.tipo, true)}
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
