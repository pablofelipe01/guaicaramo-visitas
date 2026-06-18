'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { RegistroRecord } from '@/lib/airtable';
import { approveRegistro, rejectRegistro } from '@/app/actions';
import { usePagination } from '@/lib/usePagination';
import Pagination from './Pagination';

type View = 'tabla' | 'tarjetas';
type CategoriaFilter = '' | 'VEHICULO' | 'PEATON' | 'FIN_DE_SEMANA';

interface Props {
  registros: RegistroRecord[];
  usuario: string;
  tipo: string;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

/** Returns the best display name for the visitor in a registro. */
function visitorName(r: RegistroRecord): string {
  if (r.conductores?.length) return r.conductores[0] as string;
  if (r.nombres_personas?.length) return r.nombres_personas[0] as string;
  return r.nombre_visitante || '—';
}

/** Returns the best notes string for a registro. */
function visitorNotes(r: RegistroRecord): string {
  if (r.notas_placas?.length) return r.notas_placas[0] as string;
  if (r.notas_personas?.length) return r.notas_personas[0] as string;
  return '';
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDIENTE:          { label: 'Pendiente',   cls: 'badge badge-pendiente' },
  APROBADO:           { label: 'Aprobado',    cls: 'badge badge-aprobado'  },
  NEGADO:             { label: 'Negado',      cls: 'badge badge-negado'    },
  SALIDA_SIN_ENTRADA: { label: 'Sin entrada', cls: 'badge badge-negado'    },
};

const CATEGORIA_META: Record<string, { label: string; icon: string }> = {
  VEHICULO:      { label: 'Vehículo',     icon: '🚗' },
  PEATON:        { label: 'Peatón',       icon: '🚶' },
  FIN_DE_SEMANA: { label: 'Fin de semana', icon: '📅' },
};

function StatusBadge({ status }: { status: RegistroRecord['status'] }) {
  const { label, cls } = STATUS_META[status] ?? { label: status, cls: 'badge' };
  return <span className={cls}>{label}</span>;
}

function CategoriaBadge({ categoria }: { categoria?: string }) {
  if (!categoria) return null;
  const { label, icon } = CATEGORIA_META[categoria] ?? { label: categoria, icon: '' };
  return (
    <span style={{ fontSize: '0.72rem', color: 'var(--g-ink-3)', whiteSpace: 'nowrap' }}>
      {icon} {label}
    </span>
  );
}

function IconTable() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1" y="1" width="14" height="3" rx="1" fill="currentColor" />
      <rect x="1" y="6" width="14" height="3" rx="1" fill="currentColor" opacity=".5" />
      <rect x="1" y="11" width="14" height="3" rx="1" fill="currentColor" opacity=".5" />
    </svg>
  );
}

function IconCards() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
    </svg>
  );
}


export default function RegistrosPanel({ registros, tipo }: Props) {
  const router = useRouter();
  const [view,            setView]            = useState<View>('tabla');
  const [filterCategoria, setFilterCategoria] = useState<CategoriaFilter>('');
  const [isPending, startTransition] = useTransition();

  const [rejectId,      setRejectId]      = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [actionError,   setActionError]   = useState<string | null>(null);

  // Apply categoria filter
  const filtered = filterCategoria === ''
    ? registros
    : registros.filter(r => r.categoria === filterCategoria);

  // Counts per categoria (unfiltered)
  const categoriaCounts: Record<string, number> = {};
  for (const r of registros) {
    if (r.categoria) categoriaCounts[r.categoria] = (categoriaCounts[r.categoria] ?? 0) + 1;
  }

  // Paginación (vuelve a la página 1 al cambiar el filtro)
  const pagination = usePagination(filtered, { pageSize: 25, resetKey: filterCategoria });
  const pageItems = pagination.pageItems;

  function handleApprove(id: string) {
    setActionError(null);
    startTransition(async () => {
      const res = await approveRegistro(id);
      if (!res.ok) setActionError(res.message ?? 'Error al aprobar.');
      else router.refresh();
    });
  }

  function openReject(id: string) {
    setRejectId(id);
    setRejectComment('');
    setActionError(null);
  }

  function closeReject() {
    setRejectId(null);
    setRejectComment('');
    setActionError(null);
  }

  function confirmReject() {
    if (!rejectId) return;
    setActionError(null);
    startTransition(async () => {
      const res = await rejectRegistro(rejectId, rejectComment);
      if (!res.ok) setActionError(res.message ?? 'Error al rechazar.');
      else { closeReject(); router.refresh(); }
    });
  }

  return (
    <>
      <div className="db-card">

        {/* Header */}
        <div className="db-card-head">
          <h2 className="db-card-title">Registros de visitas</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {actionError && !rejectId && (
              <span className="db-modal-error" style={{ margin: 0 }}>{actionError}</span>
            )}
            <div className="db-view-toggle">
              <button
                type="button"
                className={`db-view-btn${view === 'tabla' ? ' active' : ''}`}
                onClick={() => setView('tabla')}
                title="Vista tabla"
              >
                <IconTable /><span>Tabla</span>
              </button>
              <button
                type="button"
                className={`db-view-btn${view === 'tarjetas' ? ' active' : ''}`}
                onClick={() => setView('tarjetas')}
                title="Vista tarjetas"
              >
                <IconCards /><span>Tarjetas</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="db-filter-bar">
          <div className="db-filter-group">
            <span className="db-filter-label">Tipo</span>
            <select
              className={`db-filter-select${filterCategoria !== '' ? ' is-active' : ''}`}
              value={filterCategoria}
              onChange={e => setFilterCategoria(e.target.value as CategoriaFilter)}
            >
              <option value="">Todos ({registros.length})</option>
              <option value="VEHICULO">🚗 Vehículo ({categoriaCounts['VEHICULO'] ?? 0})</option>
              <option value="PEATON">🚶 Peatón ({categoriaCounts['PEATON'] ?? 0})</option>
              <option value="FIN_DE_SEMANA">📅 Fin de semana ({categoriaCounts['FIN_DE_SEMANA'] ?? 0})</option>
            </select>
          </div>
          <span className="db-filter-count">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <p className="db-table-empty">No hay registros en esta categoría.</p>

        ) : view === 'tabla' ? (

          /* ── TABLE VIEW ── */
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Fecha entrada</th>
                  <th>Visitante</th>
                  <th>Cédula</th>
                  <th>Tipo</th>
                  <th>Placa</th>
                  <th>Salida</th>
                  <th>Estado</th>
                  <th>Motivo / Notas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r) => (
                  <tr key={r.id}>
                    <td className="db-td-date">{formatDate(r.entry_time)}</td>
                    <td className="db-td-name">{visitorName(r)}</td>
                    <td>{r.cedula || '—'}</td>
                    <td><CategoriaBadge categoria={r.categoria} /></td>
                    <td>
                      {r.placa
                        ? <span className="db-placa">{r.placa}</span>
                        : <span className="db-td-muted">—</span>}
                    </td>
                    <td className="db-td-date">{r.exit_time ? formatDate(r.exit_time) : <span className="db-td-muted">—</span>}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="db-td-truncate">
                      {r.motivo_visita || visitorNotes(r) || '—'}
                    </td>
                    <td>
                      {r.status === 'PENDIENTE' && tipo === 'Autoriza' ? (
                        <div className="db-actions-cell">
                          <button
                            type="button"
                            className="db-action-btn db-action-approve"
                            onClick={() => handleApprove(r.id)}
                            disabled={isPending}
                          >✓ Aprobar</button>
                          <button
                            type="button"
                            className="db-action-btn db-action-reject"
                            onClick={() => openReject(r.id)}
                            disabled={isPending}
                          >✗ Rechazar</button>
                        </div>
                      ) : (
                        <span className="db-td-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        ) : (

          /* ── CARD VIEW ── */
          <div className="db-records-grid">
            {pageItems.map((r) => (
              <div
                key={r.id}
                className={`db-record-card db-record-card--${r.status.toLowerCase()}`}
              >
                <div className="db-record-card-top">
                  <StatusBadge status={r.status} />
                  <span className="db-record-card-date">{formatDate(r.entry_time)}</span>
                </div>

                <div className="db-record-card-name">
                  {visitorName(r)}
                </div>

                <div className="db-record-card-meta">
                  <div className="db-record-field">
                    <span className="db-record-field-label">Cédula</span>
                    <span className="db-record-field-value">{r.cedula || '—'}</span>
                  </div>
                  <div className="db-record-field">
                    <span className="db-record-field-label">Tipo</span>
                    <CategoriaBadge categoria={r.categoria} />
                  </div>
                  {r.placa && (
                    <div className="db-record-field">
                      <span className="db-record-field-label">Placa</span>
                      <span className="db-placa db-placa--sm">{r.placa}</span>
                    </div>
                  )}
                  {r.exit_time && (
                    <div className="db-record-field">
                      <span className="db-record-field-label">Salida</span>
                      <span className="db-record-field-value">{formatDate(r.exit_time)}</span>
                    </div>
                  )}
                </div>

                {(r.motivo_visita || visitorNotes(r)) && (
                  <div className="db-record-card-section">
                    <span className="db-record-field-label">Motivo / Notas</span>
                    <p className="db-record-card-text">{r.motivo_visita || visitorNotes(r)}</p>
                  </div>
                )}

                {r.acompanantes && (
                  <div className="db-record-card-section">
                    <span className="db-record-field-label">Acompañantes</span>
                    <p className="db-record-card-text">{r.acompanantes}</p>
                  </div>
                )}

                {r.comment && (
                  <div className="db-record-card-section">
                    <span className="db-record-field-label">Comentario</span>
                    <p className="db-record-card-text">{r.comment}</p>
                  </div>
                )}

                {r.status === 'PENDIENTE' && tipo === 'Autoriza' && (
                  <div className="db-record-card-actions">
                    <button
                      type="button"
                      className="db-action-btn db-action-approve"
                      onClick={() => handleApprove(r.id)}
                      disabled={isPending}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >✓ Aprobar</button>
                    <button
                      type="button"
                      className="db-action-btn db-action-reject"
                      onClick={() => openReject(r.id)}
                      disabled={isPending}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >✗ Rechazar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {filtered.length > 0 && <Pagination pagination={pagination} label="registros" />}
      </div>

      {/* ── Reject modal ── */}
      {rejectId && (
        <div className="db-modal-overlay" onClick={closeReject}>
          <div className="db-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="db-modal-title">Rechazar solicitud</h3>
            <div>
              <label className="db-modal-label" htmlFor="reject-comment">
                Motivo del rechazo{' '}
                <span style={{ fontWeight: 400, color: 'var(--g-ink-3)' }}>(opcional)</span>
              </label>
              <textarea
                id="reject-comment"
                className="db-modal-textarea"
                placeholder="Ej. Documentación incompleta, visita no autorizada…"
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                disabled={isPending}
              />
            </div>
            {actionError && <p className="db-modal-error">{actionError}</p>}
            <div className="db-modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeReject}
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--g-coral)', color: '#fff' }}
                onClick={confirmReject}
                disabled={isPending}
              >
                {isPending ? 'Rechazando…' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

