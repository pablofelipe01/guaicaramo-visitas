'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PlacaRecord, PersonaRecord, RegistroRecord } from '@/lib/airtable';
import {
  authorizePlaca,
  authorizePersona,
  denyPlaca,
  denyPersona,
  approveRegistro,
  rejectRegistro,
} from '@/app/actions';

interface Props {
  placas: PlacaRecord[];
  personas: PersonaRecord[];
  registros: RegistroRecord[];
  usuario: string;
}

/* ── helpers ── */

function fmt(iso: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return iso; }
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch { return iso; }
}

function isExpired(iso?: string) {
  if (!iso) return false;
  try { return new Date(iso) < new Date(); } catch { return false; }
}

function isSoon(iso?: string) {
  if (!iso) return false;
  try {
    const diff = new Date(iso).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

function visitorName(r: RegistroRecord): string {
  if (r.conductores?.length) return r.conductores[0] as string;
  if (r.nombres_personas?.length) return r.nombres_personas[0] as string;
  return r.nombre_visitante || '—';
}

/* ── sub-components ── */

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--g-ink-3)' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 14 }}>{text}</p>
    </div>
  );
}

function VenceBadge({ vence }: { vence?: string }) {
  if (!vence) return null;
  const exp = isExpired(vence);
  const soon = isSoon(vence);
  if (!exp && !soon) return null;
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.04em',
      textTransform: 'uppercase',
      padding: '2px 7px',
      borderRadius: 20,
      background: exp ? 'var(--g-coral-soft)' : 'var(--g-amber-soft)',
      color: exp ? '#a8200a' : '#8a5c00',
      whiteSpace: 'nowrap',
    }}>
      {exp ? 'Vencido' : 'Vence pronto'}: {fmtDate(vence)}
    </span>
  );
}

type RejectTarget = { id: string; tipo: 'placa' | 'persona' | 'registro' };

/* ── main component ── */

export default function ResumenAutorizaPanel({ placas, personas, registros, usuario }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  /* ── Stats ── */
  const pendientesPlacas   = placas.filter(p => !p.autorizado && p.estado !== 'RECHAZADO');
  const pendientesPersonas = personas.filter(p => !p.autorizado && p.estado !== 'RECHAZADO');
  const pendientesTotal    = pendientesPlacas.length + pendientesPersonas.length;
  const autorizadosTotal   = placas.filter(p => p.autorizado).length + personas.filter(p => p.autorizado).length;
  const rechazadosTotal    = placas.filter(p => p.estado === 'RECHAZADO').length + personas.filter(p => p.estado === 'RECHAZADO').length;
  const registrosPendientes = registros.filter(r => r.status === 'PENDIENTE');

  /* ── Pending items merged & sorted (oldest first = most urgent) ── */
  type PendingItem =
    | { kind: 'placa';   data: PlacaRecord }
    | { kind: 'persona'; data: PersonaRecord };

  const pendingItems: PendingItem[] = [
    ...pendientesPlacas.map(p => ({ kind: 'placa' as const, data: p })),
    ...pendientesPersonas.map(p => ({ kind: 'persona' as const, data: p })),
  ].sort((a, b) => {
    const da = new Date(a.data.creada ?? 0).getTime();
    const db = new Date(b.data.creada ?? 0).getTime();
    return da - db;
  }).slice(0, 10);

  /* ── Recent activity (authorized/rejected by this user) ── */
  type RecentItem =
    | { kind: 'placa';   data: PlacaRecord;   ts: number }
    | { kind: 'persona'; data: PersonaRecord; ts: number };

  const recentActivity: RecentItem[] = [
    ...placas
      .filter(p => p.autoriza_visita === usuario && p.fecha_autorizado)
      .map(p => ({ kind: 'placa' as const, data: p, ts: new Date(p.fecha_autorizado!).getTime() })),
    ...personas
      .filter(p => p.autoriza_visita === usuario && p.fecha_autorizado)
      .map(p => ({ kind: 'persona' as const, data: p, ts: new Date(p.fecha_autorizado!).getTime() })),
  ].sort((a, b) => b.ts - a.ts).slice(0, 6);

  /* ── actions ── */

  function handleAuthorize(item: PendingItem) {
    setActionError(null);
    startTransition(async () => {
      const res = item.kind === 'placa'
        ? await authorizePlaca(item.data.id)
        : await authorizePersona(item.data.id);
      if (!res.ok) setActionError(res.message ?? 'Error al autorizar.');
      else router.refresh();
    });
  }

  function openDeny(item: PendingItem) {
    setRejectTarget({ id: item.data.id, tipo: item.kind });
    setRejectComment('');
    setActionError(null);
  }

  function openRejectRegistro(id: string) {
    setRejectTarget({ id, tipo: 'registro' });
    setRejectComment('');
    setActionError(null);
  }

  function closeModal() {
    setRejectTarget(null);
    setRejectComment('');
    setActionError(null);
  }

  function handleApproveRegistro(id: string) {
    setActionError(null);
    startTransition(async () => {
      const res = await approveRegistro(id);
      if (!res.ok) setActionError(res.message ?? 'Error al aprobar.');
      else router.refresh();
    });
  }

  async function confirmAction() {
    if (!rejectTarget) return;
    setActionError(null);
    startTransition(async () => {
      let res: { ok: boolean; message?: string };
      if (rejectTarget.tipo === 'placa') {
        res = await denyPlaca(rejectTarget.id);
      } else if (rejectTarget.tipo === 'persona') {
        res = await denyPersona(rejectTarget.id);
      } else {
        res = await rejectRegistro(rejectTarget.id, rejectComment);
      }
      if (!res.ok) setActionError(res.message ?? 'Error al rechazar.');
      else { closeModal(); router.refresh(); }
    });
  }

  /* ── render ── */

  return (
    <>
      {/* ── Greeting ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--g-green-dark) 0%, var(--g-green) 100%)',
        borderRadius: 'var(--card-radius)',
        padding: '28px 32px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        boxShadow: '0 4px 24px rgba(78,91,49,.22)',
      }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .75 }}>
            Panel de Autorización
          </p>
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: 'clamp(22px, 3vw, 30px)',
            lineHeight: 1.1,
          }}>
            Hola, {usuario}
          </h2>
          {pendientesTotal > 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 14, opacity: .88 }}>
              Tienes <strong>{pendientesTotal}</strong> solicitud{pendientesTotal !== 1 ? 'es' : ''} pendiente{pendientesTotal !== 1 ? 's' : ''} de revisión.
            </p>
          )}
          {pendientesTotal === 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 14, opacity: .88 }}>
              Sin solicitudes pendientes — todo al día.
            </p>
          )}
        </div>
        <div style={{
          background: 'rgba(255,255,255,.15)',
          borderRadius: 12,
          padding: '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minWidth: 150,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .75 }}>
            Resumen del área
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
            {placas.length + personas.length}
          </span>
          <span style={{ fontSize: 12, opacity: .8 }}>visitantes registrados</span>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="db-stats">
        <div className={`db-stat-card${pendientesTotal > 0 ? ' stat-pendiente' : ''}`}>
          <span className="db-stat-label">Pendientes</span>
          <span className="db-stat-value">{pendientesTotal}</span>
          <span style={{ fontSize: 11, color: 'var(--g-ink-3)', marginTop: 2 }}>por autorizar</span>
        </div>
        <div className="db-stat-card stat-aprobado">
          <span className="db-stat-label">Autorizados</span>
          <span className="db-stat-value">{autorizadosTotal}</span>
          <span style={{ fontSize: 11, color: 'var(--g-ink-3)', marginTop: 2 }}>en total</span>
        </div>
        <div className="db-stat-card stat-negado">
          <span className="db-stat-label">Rechazados</span>
          <span className="db-stat-value">{rechazadosTotal}</span>
          <span style={{ fontSize: 11, color: 'var(--g-ink-3)', marginTop: 2 }}>en total</span>
        </div>
        <div className="db-stat-card">
          <span className="db-stat-label">Registros</span>
          <span className="db-stat-value" style={{ color: registrosPendientes.length > 0 ? '#9a6800' : 'var(--g-green-dark)' }}>
            {registrosPendientes.length}
          </span>
          <span style={{ fontSize: 11, color: 'var(--g-ink-3)', marginTop: 2 }}>por aprobar</span>
        </div>
      </div>

      {/* ── Pending authorizations ── */}
      <div className="db-card">
        <div className="db-card-head">
          <h3 className="db-card-title">Solicitudes pendientes</h3>
          {pendientesTotal > 10 && (
            <span style={{ fontSize: 12, color: 'var(--g-ink-3)' }}>
              Mostrando 10 de {pendientesTotal}
            </span>
          )}
        </div>

        {pendingItems.length === 0 ? (
          <EmptyState icon="✅" text="No hay solicitudes pendientes de autorización." />
        ) : (
          <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {actionError && !rejectTarget && (
              <p className="db-modal-error" style={{ margin: '0 0 8px', borderRadius: 8 }}>{actionError}</p>
            )}
            {pendingItems.map(item => {
              const d = item.data;
              const isPlaca = item.kind === 'placa';
              const label = isPlaca ? (d as PlacaRecord).placa : (d as PersonaRecord).nombre;
              const subtitle = isPlaca
                ? `Conductor: ${(d as PlacaRecord).conductor || '—'} · C.C. ${d.cedula || '—'}`
                : `C.C. ${d.cedula || '—'}${(d as PersonaRecord).cargo ? ` · ${(d as PersonaRecord).cargo}` : ''}`;
              const vence = d.vence;
              return (
                <div key={d.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  borderRadius: 12,
                  border: '1px solid var(--g-line)',
                  background: 'var(--g-cream)',
                  flexWrap: 'wrap',
                }}>
                  {/* Icon */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isPlaca ? 'var(--g-green-soft)' : 'var(--g-amber-soft)',
                    fontSize: 18,
                  }}>
                    {isPlaca ? '🚗' : '🚶'}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {isPlaca ? (
                        <span className="db-placa" style={{ fontSize: 13 }}>{label}</span>
                      ) : (
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--g-ink)' }}>{label}</span>
                      )}
                      <VenceBadge vence={vence} />
                      {vence && !isExpired(vence) && !isSoon(vence) && (
                        <span style={{ fontSize: 11, color: 'var(--g-ink-3)' }}>
                          Hasta {fmtDate(vence)}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--g-ink-3)' }}>
                      {subtitle}
                      {d.responsable_visita ? ` · Registrado por ${d.responsable_visita}` : ''}
                    </p>
                    {d.notas && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--g-ink-2)', fontStyle: 'italic' }}>
                        {d.notas}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="db-action-btn db-action-approve"
                      onClick={() => handleAuthorize(item)}
                      disabled={isPending}
                    >
                      ✓ Autorizar
                    </button>
                    <button
                      type="button"
                      className="db-action-btn db-action-reject"
                      onClick={() => openDeny(item)}
                      disabled={isPending}
                    >
                      ✗ Denegar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pending registros ── */}
      {registrosPendientes.length > 0 && (
        <div className="db-card">
          <div className="db-card-head">
            <h3 className="db-card-title">Registros por aprobar</h3>
            {registrosPendientes.length > 5 && (
              <span style={{ fontSize: 12, color: 'var(--g-ink-3)' }}>
                Mostrando 5 de {registrosPendientes.length}
              </span>
            )}
          </div>
          <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {registrosPendientes.slice(0, 5).map(r => (
              <div key={r.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderRadius: 12,
                border: '1px solid var(--g-line)',
                background: 'var(--g-cream)',
                flexWrap: 'wrap',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--g-amber-soft)', fontSize: 18,
                }}>
                  {r.categoria === 'VEHICULO' ? '🚗' : r.categoria === 'FIN_DE_SEMANA' ? '📅' : '🚶'}
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--g-ink)' }}>
                    {visitorName(r)}
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--g-ink-3)' }}>
                    {fmt(r.entry_time)}
                    {r.placa ? ` · ${r.placa}` : ''}
                    {r.cedula ? ` · C.C. ${r.cedula}` : ''}
                  </p>
                  {r.motivo_visita && (
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--g-ink-2)', fontStyle: 'italic' }}>
                      {r.motivo_visita}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="db-action-btn db-action-approve"
                    onClick={() => handleApproveRegistro(r.id)}
                    disabled={isPending}
                  >
                    ✓ Aprobar
                  </button>
                  <button
                    type="button"
                    className="db-action-btn db-action-reject"
                    onClick={() => openRejectRegistro(r.id)}
                    disabled={isPending}
                  >
                    ✗ Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent activity ── */}
      <div className="db-card">
        <div className="db-card-head">
          <h3 className="db-card-title">Mi actividad reciente</h3>
        </div>
        {recentActivity.length === 0 ? (
          <EmptyState icon="📋" text="Aún no has autorizado ni rechazado ninguna solicitud." />
        ) : (
          <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentActivity.map(item => {
              const d = item.data;
              const isPlaca = item.kind === 'placa';
              const label = isPlaca ? (d as PlacaRecord).placa : (d as PersonaRecord).nombre;
              const isAuth = d.autorizado;
              return (
                <div key={d.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--g-line)',
                  background: isAuth ? '#f0fdf4' : 'var(--g-coral-soft)',
                }}>
                  <span style={{ fontSize: 16 }}>{isAuth ? '✅' : '🚫'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--g-ink)' }}>
                      {isPlaca ? `Placa ${label}` : label}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--g-ink-3)' }}>
                      {isAuth ? 'Autorizado' : 'Rechazado'} · {d.fecha_autorizado ? fmt(d.fecha_autorizado) : '—'}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
                    textTransform: 'uppercase', padding: '2px 7px', borderRadius: 20,
                    background: isPlaca ? 'var(--g-green-soft)' : 'var(--g-amber-soft)',
                    color: isPlaca ? 'var(--g-green-dark)' : '#8a5c00',
                    whiteSpace: 'nowrap',
                  }}>
                    {isPlaca ? 'Vehículo' : 'Peatón'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Deny / Reject modal ── */}
      {rejectTarget && (
        <div className="db-modal-overlay" onClick={closeModal}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <h3 className="db-modal-title">
              {rejectTarget.tipo === 'registro' ? 'Rechazar registro' : 'Denegar solicitud'}
            </h3>
            {rejectTarget.tipo === 'registro' && (
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
                  onChange={e => setRejectComment(e.target.value)}
                  disabled={isPending}
                />
              </div>
            )}
            {rejectTarget.tipo !== 'registro' && (
              <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--g-ink-2)' }}>
                Esta acción marcará la solicitud como rechazada. No podrá acceder a la finca
                hasta que se registre una nueva solicitud.
              </p>
            )}
            {actionError && <p className="db-modal-error">{actionError}</p>}
            <div className="db-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={isPending}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--g-coral)', color: '#fff' }}
                onClick={confirmAction}
                disabled={isPending}
              >
                {isPending ? 'Procesando…' : rejectTarget.tipo === 'registro' ? 'Confirmar rechazo' : 'Confirmar denegación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
