'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { PlacaRecord, PersonaRecord } from '@/lib/airtable';
import { authorizePlaca, unauthorizePlaca, authorizePersona, unauthorizePersona, denyPlaca, denyPersona } from '@/app/actions';

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
  estado?: 'PENDIENTE' | 'AUTORIZADO' | 'RECHAZADO';
  vence?: string;
  responsable_visita?: string;
  autoriza_visita?: string;
  fecha_autorizado?: string;
  creada?: string;
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
  const headCompanionIds = new Map<string, string[]>(); // headId → [companionIds]
  const companionToHead  = new Map<string, string>();   // companionId → headId
  let g = 0;

  for (const p of placas) {
    const ids = p.acompañanteIds ?? [];
    if (ids.length > 0) {
      groupMap.set(p.id, g);
      headCompanionIds.set(p.id, ids);
      for (const aid of ids) { groupMap.set(aid, g); companionSet.add(aid); companionToHead.set(aid, p.id); }
      g++;
    }
  }
  for (const p of personas) {
    const ids = p.acompañanteIds ?? [];
    if (ids.length > 0 && !groupMap.has(p.id)) {
      groupMap.set(p.id, g);
      headCompanionIds.set(p.id, ids);
      for (const aid of ids) { groupMap.set(aid, g); companionSet.add(aid); companionToHead.set(aid, p.id); }
      g++;
    }
  }
  return { groupMap, companionSet, headCompanionIds, companionToHead };
}

/** Reordena la lista para que cada cabeza de grupo quede seguida por sus
 *  acompañantes presentes en la lista (manteniendo los grupos juntos). */
function orderByGroup(
  items: Visitante[],
  companionToHead: Map<string, string>,
  headCompanionIds: Map<string, string[]>,
): Visitante[] {
  const byId = new Map(items.map(v => [v.id, v]));
  const present = new Set(items.map(v => v.id));
  const ordered: Visitante[] = [];
  const placed = new Set<string>();

  for (const v of items) {
    if (placed.has(v.id)) continue;
    // Si es acompañante y su cabeza está en la lista, se ubicará junto a ella.
    const headId = companionToHead.get(v.id);
    if (headId && present.has(headId)) continue;

    ordered.push(v);
    placed.add(v.id);

    const comps = headCompanionIds.get(v.id);
    if (comps) {
      for (const cid of comps) {
        const comp = byId.get(cid);
        if (comp && !placed.has(cid)) { ordered.push(comp); placed.add(cid); }
      }
    }
  }
  return ordered;
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

type Filter = 'todos' | 'pendientes' | 'autorizados' | 'rechazados' | 'vencidos';

export default function VisitantesPanel({ placas, personas, tipo }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('todos');
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Visitante | null>(null);

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
      estado: p.estado,
      vence: p.vence,
      responsable_visita: p.responsable_visita,
      autoriza_visita: p.autoriza_visita,
      fecha_autorizado: p.fecha_autorizado,
      creada: p.creada,
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
      estado: p.estado,
      vence: p.vence,
      responsable_visita: p.responsable_visita,
      autoriza_visita: p.autoriza_visita,
      fecha_autorizado: p.fecha_autorizado,
      creada: p.creada,
      notas: p.notas,
      acompañanteIds: p.acompañanteIds,
    })),
  ];

  const { groupMap, companionSet, headCompanionIds, companionToHead } = buildGroups(placas, personas);

  // Mapa id → nombre legible (para mostrar acompañantes en el detalle).
  const nameById = new Map<string, string>();
  for (const v of visitantes) {
    nameById.set(v.id, v.tipo === 'vehiculo' ? (v.placa || v.conductor || v.cedula || v.id) : (v.nombre || v.cedula || v.id));
  }

  const counts = {
    todos:       visitantes.length,
    pendientes:  visitantes.filter(v => !v.autorizado && v.estado !== 'RECHAZADO').length,
    autorizados: visitantes.filter(v => v.autorizado && !isExpired(v.vence)).length,
    rechazados:  visitantes.filter(v => v.estado === 'RECHAZADO').length,
    vencidos:    visitantes.filter(v => isExpired(v.vence)).length,
  };

  const byTab = visitantes.filter(v => {
    if (filter === 'pendientes')  return !v.autorizado && v.estado !== 'RECHAZADO';
    if (filter === 'autorizados') return v.autorizado && !isExpired(v.vence);
    if (filter === 'rechazados')  return v.estado === 'RECHAZADO';
    if (filter === 'vencidos')    return isExpired(v.vence);
    return true;
  });

  const term = search.toLowerCase().trim();
  const filtered = term
    ? byTab.filter(v =>
        (v.placa ?? '').toLowerCase().includes(term) ||
        (v.nombre ?? '').toLowerCase().includes(term) ||
        (v.conductor ?? '').toLowerCase().includes(term) ||
        (v.cedula ?? '').toLowerCase().includes(term)
      )
    : byTab;

  // Ordena del más reciente al más antiguo según la fecha de creación.
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.creada ?? 0).getTime() - new Date(a.creada ?? 0).getTime()
  );

  // Mantiene cada vehículo/cabeza junto a sus acompañantes.
  const ordered = orderByGroup(sorted, companionToHead, headCompanionIds);

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

  function handleDeny(id: string, visitType: 'vehiculo' | 'persona') {
    setActionError(null);
    startTransition(async () => {
      const res = visitType === 'vehiculo' ? await denyPlaca(id) : await denyPersona(id);
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
            placeholder="Buscar por placa, nombre, conductor o cédula…"
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
              {ordered.map(v => {
                const expired      = isExpired(v.vence);
                const displayName  = v.tipo === 'vehiculo' ? v.placa    : v.nombre;
                const displaySub   = v.tipo === 'vehiculo' ? v.conductor : v.cargo;
                const groupIdx     = groupMap.get(v.id);
                const palette      = groupIdx !== undefined ? GROUP_PALETTE[groupIdx % GROUP_PALETTE.length] : null;
                const isCompanion  = companionSet.has(v.id);

                return (
                  <tr
                    key={v.id}
                    onClick={() => setDetail(v)}
                    title="Ver detalles de la visita"
                    style={{
                      cursor: 'pointer',
                      ...(palette ? {
                        background: palette.bg,
                        boxShadow: `inset 3px 0 0 ${palette.border}`,
                      } : {}),
                    }}
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
                      ) : v.estado === 'RECHAZADO' ? (
                        <span className="badge badge-negado">Rechazado</span>
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
                        onClick={v.notas ? (e) => { e.stopPropagation(); toggleNote(v.id); } : undefined}
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
                      <td data-label="Acción" style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        {v.autorizado ? (
                          <button
                            onClick={() => handleAuthorize(v.id, v.tipo, false)}
                            disabled={isPending}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--g-coral)', borderColor: 'rgba(220,53,69,.3)' }}
                          >
                            Revocar
                          </button>
                        ) : v.estado === 'RECHAZADO' ? (
                          <button
                            onClick={() => handleAuthorize(v.id, v.tipo, false)}
                            disabled={isPending}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--g-ink-3)', borderColor: 'rgba(0,0,0,.15)' }}
                          >
                            Restaurar
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleAuthorize(v.id, v.tipo, true)}
                              disabled={isPending}
                              className="btn btn-primary btn-sm"
                            >
                              Autorizar
                            </button>
                            <button
                              onClick={() => handleDeny(v.id, v.tipo)}
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

      {detail && (
        <div className="db-modal-overlay" onClick={() => setDetail(null)}>
          <div
            className="db-modal"
            style={{ maxWidth: 520, gap: 0 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
              <h3 className="db-modal-title" style={{ marginBottom: 0 }}>
                Detalles de la visita
              </h3>
              <button
                onClick={() => setDetail(null)}
                aria-label="Cerrar"
                style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: 'var(--g-ink-3)', padding: 4 }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 18px' }}>
              <span className="badge" style={{
                background: detail.tipo === 'vehiculo' ? 'var(--g-blue-soft)' : 'var(--g-purple-soft)',
                color: detail.tipo === 'vehiculo' ? 'var(--g-blue-dark)' : 'var(--g-purple-dark)',
                fontSize: 11,
              }}>
                {detail.tipo === 'vehiculo' ? 'Vehículo' : 'Persona'}
              </span>
              {isExpired(detail.vence) ? (
                <span className="badge badge-negado">Vencido</span>
              ) : detail.estado === 'RECHAZADO' ? (
                <span className="badge badge-negado">Rechazado</span>
              ) : detail.autorizado ? (
                <span className="badge badge-aprobado">Autorizado</span>
              ) : (
                <span className="badge badge-pendiente">Pendiente</span>
              )}
              {companionSet.has(detail.id) && (
                <span className="badge" style={{ background: 'var(--g-cream)', color: 'var(--g-ink-3)', fontSize: 11 }}>
                  Acompañante
                </span>
              )}
            </div>

            <dl style={{ display: 'grid', gridTemplateColumns: '150px 1fr', rowGap: 12, columnGap: 14, margin: 0, fontSize: 14 }}>
              {detail.tipo === 'vehiculo' ? (
                <>
                  <dt style={detailLabel}>Placa</dt>
                  <dd style={detailValue}>{detail.placa || '—'}</dd>
                  <dt style={detailLabel}>Conductor</dt>
                  <dd style={detailValue}>{detail.conductor || '—'}</dd>
                </>
              ) : (
                <>
                  <dt style={detailLabel}>Nombre</dt>
                  <dd style={detailValue}>{detail.nombre || '—'}</dd>
                  <dt style={detailLabel}>Cargo</dt>
                  <dd style={detailValue}>{detail.cargo || '—'}</dd>
                </>
              )}
              <dt style={detailLabel}>Cédula</dt>
              <dd style={detailValue}>{detail.cedula || '—'}</dd>
              <dt style={detailLabel}>Fecha de registro</dt>
              <dd style={detailValue}>{formatDate(detail.creada)}</dd>
              <dt style={detailLabel}>Vence</dt>
              <dd style={detailValue}>{formatDate(detail.vence)}</dd>
              <dt style={detailLabel}>Registrado por</dt>
              <dd style={detailValue}>{detail.responsable_visita || '—'}</dd>
              <dt style={detailLabel}>Autorizado por</dt>
              <dd style={detailValue}>{detail.autoriza_visita || '—'}</dd>
              <dt style={detailLabel}>Fecha autorización</dt>
              <dd style={detailValue}>{formatDate(detail.fecha_autorizado)}</dd>
              {(() => {
                const compIds = headCompanionIds.get(detail.id);
                if (compIds && compIds.length > 0) {
                  return (
                    <>
                      <dt style={detailLabel}>Acompañantes</dt>
                      <dd style={detailValue}>
                        {compIds.map(cid => nameById.get(cid) ?? cid).join(', ')}
                      </dd>
                    </>
                  );
                }
                const headId = companionToHead.get(detail.id);
                if (headId) {
                  return (
                    <>
                      <dt style={detailLabel}>Acompaña a</dt>
                      <dd style={detailValue}>{nameById.get(headId) ?? headId}</dd>
                    </>
                  );
                }
                return null;
              })()}
              <dt style={detailLabel}>Notas</dt>
              <dd style={{ ...detailValue, whiteSpace: 'pre-wrap' }}>{detail.notas || '—'}</dd>
            </dl>

            <div className="db-modal-actions" style={{ marginTop: 22 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const detailLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--g-ink-3)',
  alignSelf: 'start',
};
const detailValue: CSSProperties = {
  margin: 0,
  color: 'var(--g-ink)',
  fontWeight: 500,
  wordBreak: 'break-word',
};
