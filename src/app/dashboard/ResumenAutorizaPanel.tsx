'use client';

import { useState, useMemo, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { PlacaRecord, PersonaRecord, RegistroRecord } from '@/lib/airtable';
import {
  authorizePlaca, authorizePersona, denyPlaca, denyPersona,
  approveRegistro, rejectRegistro,
} from '@/app/actions';

type SubTab = 'overview' | 'solicitudes' | 'registros';
type FiltroSol = 'todas' | 'pendientes' | 'autorizadas' | 'rechazadas';
type FiltroReg = 'todos' | 'pendientes' | 'aprobados' | 'negados';
type DetailView =
  | { kind: 'placa';    data: PlacaRecord }
  | { kind: 'persona';  data: PersonaRecord }
  | { kind: 'registro'; data: RegistroRecord };
type RejectTarget = { id: string; tipo: 'placa' | 'persona' | 'registro' };

interface Props {
  placas: PlacaRecord[];
  personas: PersonaRecord[];
  registros: RegistroRecord[];
  usuario: string;
  highlightId?: string;
}

/* ── helpers ── */

function fmt(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return iso; }
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch { return iso; }
}

function fmtDay(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
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

function visitorName(r: RegistroRecord) {
  if (r.conductores?.length) return r.conductores[0] as string;
  if (r.nombres_personas?.length) return r.nombres_personas[0] as string;
  return r.nombre_visitante || '—';
}

/* ── SVG charts ── */

function BarChart({ data }: { data: { label: string; count: number; aprobados: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 560, H = 90, PX = 4;
  const slot = (W - PX * 2) / data.length;
  const bw = Math.max(slot - 6, 4);

  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.5, 1].map(f => (
        <line key={f} x1={PX} x2={W - PX} y1={H - f * H} y2={H - f * H}
          stroke="#e5e7eb" strokeWidth={1} />
      ))}
      {data.map((d, i) => {
        const bh  = Math.max((d.count / max) * H, d.count > 0 ? 2 : 0);
        const ah  = Math.max((d.aprobados / max) * H, d.aprobados > 0 ? 2 : 0);
        const x   = PX + i * slot + (slot - bw) / 2;
        return (
          <g key={i}>
            <rect x={x} y={H - bh} width={bw} height={bh} fill="#bbf7d0" rx={3} />
            <rect x={x} y={H - ah} width={bw} height={ah} fill="#16a34a" rx={3} />
            {d.count > 0 && bh > 14 && (
              <text x={x + bw / 2} y={H - bh - 3} fontSize={8} textAnchor="middle" fill="#6b7280">{d.count}</text>
            )}
            {(i % 2 === 0 || data.length <= 7) && (
              <text x={x + bw / 2} y={H + 14} fontSize={8} textAnchor="middle" fill="#9ca3af">{d.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ total, segments, size = 96 }: {
  total: number;
  segments: { value: number; color: string }[];
  size?: number;
}) {
  const R = 34, cx = size / 2, cy = size / 2, C = 2 * Math.PI * R;
  if (total === 0) return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e5e7eb" strokeWidth={14} />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={12} fill="#9ca3af">0</text>
    </svg>
  );
  let cum = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const pct  = seg.value / total;
        const dash = pct * C;
        const rot  = (cum / total) * 360 - 90;
        cum += seg.value;
        return (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none"
            stroke={seg.color} strokeWidth={14}
            strokeDasharray={`${dash} ${C - dash}`}
            transform={`rotate(${rot}, ${cx}, ${cy})`} />
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={15} fontWeight={700} fill="#111827">{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={8} fill="#9ca3af">total</text>
    </svg>
  );
}

/* ── badges ── */

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span style={{ color: 'var(--g-ink-3)' }}>—</span>;
  const m: Record<string, { bg: string; fg: string }> = {
    APROBADO:           { bg: '#dcfce7', fg: '#166534' },
    AUTORIZADO:         { bg: '#dcfce7', fg: '#166534' },
    PENDIENTE:          { bg: '#fef9c3', fg: '#854d0e' },
    NEGADO:             { bg: '#fee2e2', fg: '#991b1b' },
    RECHAZADO:          { bg: '#fee2e2', fg: '#991b1b' },
    SALIDA_SIN_ENTRADA: { bg: '#f3e8ff', fg: '#6b21a8' },
  };
  const s = m[status] ?? { bg: '#f1f5f9', fg: '#64748b' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', background: s.bg, color: s.fg }}>
      {status}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo?: string }) {
  if (!tipo) return <span style={{ color: 'var(--g-ink-3)' }}>—</span>;
  const c: Record<string, { icon: string; fg: string; bg: string }> = {
    ENTRADA:            { icon: '↓', fg: '#166534', bg: '#dcfce7' },
    SALIDA:             { icon: '↑', fg: '#991b1b', bg: '#fee2e2' },
    MANUAL:             { icon: '✎', fg: '#6b21a8', bg: '#f3e8ff' },
    SALIDA_SIN_ENTRADA: { icon: '↗', fg: '#854d0e', bg: '#fef9c3' },
  };
  const t = c[tipo] ?? { icon: '·', fg: '#64748b', bg: '#f1f5f9' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: t.bg, color: t.fg }}>
      {t.icon} {tipo}
    </span>
  );
}

function VenceBadge({ vence }: { vence?: string }) {
  const exp = isExpired(vence), soon = isSoon(vence);
  if (!vence || (!exp && !soon)) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: exp ? '#fee2e2' : '#fef9c3', color: exp ? '#991b1b' : '#854d0e' }}>
      {exp ? 'Vencido' : 'Vence pronto'}: {fmtDate(vence)}
    </span>
  );
}

/* ── detail panel helpers ── */

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--g-line)' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--g-ink-3)', paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--g-ink)' }}>{children}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 style={{ margin: '18px 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--g-ink-3)', borderBottom: '2px solid var(--g-line)', paddingBottom: 5 }}>
      {children}
    </h4>
  );
}

function MiniCard({ icon, title, sub, badge, onClick }: {
  icon: string; title: React.ReactNode; sub: string; badge: React.ReactNode; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 8, border: '1px solid var(--g-line)', background: 'var(--g-cream)',
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--g-ink-3)', marginTop: 2 }}>{sub}</div>
      </div>
      {badge}
    </button>
  );
}

/* ── toolbar components ── */

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative', maxWidth: 360 }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--g-ink-3)', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Buscar…'} className="db-search-input" style={{ paddingLeft: 28 }} />
      {value && <button type="button" onClick={() => onChange('')} className="db-search-clear">×</button>}
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--g-ink-3)', fontSize: 13 }}>Sin resultados</td></tr>;
}

function Chip({ value, active, count, label, onClick }: { value: string; active: boolean; count?: number; label: string; onClick: (v: string) => void }) {
  return (
    <button type="button" onClick={() => onClick(value)} style={{
      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      border: active ? '1.5px solid var(--g-leaf)' : '1.5px solid var(--g-line)',
      background: active ? 'var(--g-green-soft)' : 'transparent',
      color: active ? 'var(--g-green-dark)' : 'var(--g-ink-2)',
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {label}
      {count !== undefined && (
        <span style={{ background: active ? 'var(--g-leaf)' : 'var(--g-line)', color: active ? '#fff' : 'var(--g-ink-3)', borderRadius: 20, padding: '0 5px', fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */

export default function ResumenAutorizaPanel({ placas, personas, registros, usuario, highlightId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [subTab,    setSubTab]    = useState<SubTab>('overview');
  const [filtroSol, setFiltroSol] = useState<FiltroSol>('todas');
  const [filtroReg, setFiltroReg] = useState<FiltroReg>('todos');
  const [searchSol, setSearchSol] = useState('');
  const [searchReg, setSearchReg] = useState('');
  const [detail,    setDetail]    = useState<DetailView | null>(null);
  const [actionError, setActionError]     = useState<string | null>(null);
  const [rejectTarget, setRejectTarget]   = useState<RejectTarget | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  /* ── derived data ── */

  const allSolicitudes = useMemo(() => [
    ...placas.map(p  => ({ kind: 'placa'   as const, data: p })),
    ...personas.map(p => ({ kind: 'persona' as const, data: p })),
  ].sort((a, b) => new Date(b.data.creada ?? 0).getTime() - new Date(a.data.creada ?? 0).getTime()),
  [placas, personas]);

  const solCounts = useMemo(() => ({
    todas:       allSolicitudes.length,
    pendientes:  allSolicitudes.filter(i => !i.data.autorizado && i.data.estado !== 'RECHAZADO').length,
    autorizadas: allSolicitudes.filter(i => i.data.autorizado).length,
    rechazadas:  allSolicitudes.filter(i => i.data.estado === 'RECHAZADO').length,
  }), [allSolicitudes]);

  const regCounts = useMemo(() => ({
    todos:      registros.length,
    pendientes: registros.filter(r => r.status === 'PENDIENTE').length,
    aprobados:  registros.filter(r => r.status === 'APROBADO').length,
    negados:    registros.filter(r => r.status === 'NEGADO').length,
  }), [registros]);

  const activityData = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i)); d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const dayR = registros.filter(r => { if (!r.entry_time) return false; const t = new Date(r.entry_time).getTime(); return t >= d.getTime() && t < next.getTime(); });
    return { label: fmtDay(d), count: dayR.length, aprobados: dayR.filter(r => r.status === 'APROBADO').length };
  }), [registros]);

  const filteredSolicitudes = useMemo(() => {
    let items = allSolicitudes;
    if (filtroSol === 'pendientes')  items = items.filter(i => !i.data.autorizado && i.data.estado !== 'RECHAZADO');
    if (filtroSol === 'autorizadas') items = items.filter(i => i.data.autorizado);
    if (filtroSol === 'rechazadas')  items = items.filter(i => i.data.estado === 'RECHAZADO');
    if (searchSol) {
      const q = searchSol.toLowerCase();
      items = items.filter(i => {
        const d = i.data;
        if (i.kind === 'placa') { const p = d as PlacaRecord; return [p.placa, p.conductor, p.cedula, p.estado, p.notas, p.responsable_visita, p.autoriza_visita].some(f => f?.toLowerCase().includes(q)); }
        else { const p = d as PersonaRecord; return [p.nombre, p.cedula, p.cargo, p.estado, p.notas, p.responsable_visita, p.autoriza_visita].some(f => f?.toLowerCase().includes(q)); }
      });
    }
    return items;
  }, [allSolicitudes, filtroSol, searchSol]);

  const filteredRegistros = useMemo(() => {
    let items = [...registros].sort((a, b) => new Date(b.entry_time ?? 0).getTime() - new Date(a.entry_time ?? 0).getTime());
    if (filtroReg === 'pendientes') items = items.filter(r => r.status === 'PENDIENTE');
    if (filtroReg === 'aprobados')  items = items.filter(r => r.status === 'APROBADO');
    if (filtroReg === 'negados')    items = items.filter(r => r.status === 'NEGADO');
    if (searchReg) {
      const q = searchReg.toLowerCase();
      items = items.filter(r => [r.placa, r.cedula, r.status, r.tipo, r.motivo_visita, r.approved_by, r.nodo_origen, r.conductores?.[0] as string, ...(r.nombres_personas as string[] ?? [])].some(f => f?.toLowerCase().includes(q)));
    }
    return items;
  }, [registros, filtroReg, searchReg]);

  /* ── auto-open on notification click ── */

  const didAutoOpen = useRef(false);
  useEffect(() => {
    if (didAutoOpen.current || !highlightId) return;
    didAutoOpen.current = true;
    const found = allSolicitudes.find(item => item.data.id === highlightId);
    if (!found) return;
    setSubTab('solicitudes');
    setFiltroSol('pendientes');
    if (found.kind === 'placa') {
      setDetail({ kind: 'placa', data: found.data as PlacaRecord });
    } else {
      setDetail({ kind: 'persona', data: found.data as PersonaRecord });
    }
  }, [highlightId, allSolicitudes]);

  /* ── relationship helpers ── */

  const getRegistrosForPlaca   = (id: string) => registros.filter(r => r.placaIds?.includes(id));
  const getRegistrosForPersona = (id: string) => registros.filter(r => r.personaIds?.includes(id));
  const getPlacaById           = (id: string) => placas.find(p => p.id === id);
  const getPersonaById         = (id: string) => personas.find(p => p.id === id);

  /* ── actions ── */

  function authorize(id: string, kind: 'placa' | 'persona') {
    setActionError(null);
    startTransition(async () => {
      const res = kind === 'placa' ? await authorizePlaca(id) : await authorizePersona(id);
      if (!res.ok) setActionError(res.message ?? 'Error al autorizar.');
      else router.refresh();
    });
  }

  function openDeny(id: string, tipo: 'placa' | 'persona' | 'registro') {
    setRejectTarget({ id, tipo }); setRejectComment(''); setActionError(null);
  }

  function closeModal() { setRejectTarget(null); setRejectComment(''); setActionError(null); }

  function approveReg(id: string) {
    setActionError(null);
    startTransition(async () => {
      const res = await approveRegistro(id);
      if (!res.ok) setActionError(res.message ?? 'Error al aprobar.');
      else router.refresh();
    });
  }

  async function confirmDeny() {
    if (!rejectTarget) return;
    setActionError(null);
    startTransition(async () => {
      let res: { ok: boolean; message?: string };
      if (rejectTarget.tipo === 'placa')        res = await denyPlaca(rejectTarget.id);
      else if (rejectTarget.tipo === 'persona') res = await denyPersona(rejectTarget.id);
      else                                      res = await rejectRegistro(rejectTarget.id, rejectComment);
      if (!res.ok) setActionError(res.message ?? 'Error.');
      else { closeModal(); router.refresh(); }
    });
  }

  /* ── detail panel ── */

  function renderDetail() {
    if (!detail) return null;

    if (detail.kind === 'placa') {
      const p = detail.data;
      const estado = p.autorizado ? 'AUTORIZADO' : (p.estado ?? 'PENDIENTE');
      const isPend = !p.autorizado && p.estado !== 'RECHAZADO';
      const relRegs = getRegistrosForPlaca(p.id);
      const acomps  = (p.acompañanteIds ?? []).map(id => getPersonaById(id)).filter(Boolean) as PersonaRecord[];
      return (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--g-green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🚗</div>
            <div><span className="db-placa" style={{ fontSize: 17 }}>{p.placa}</span><div style={{ fontSize: 12, color: 'var(--g-ink-2)', marginTop: 2 }}>{p.conductor || '—'}</div></div>
            <div style={{ marginLeft: 'auto' }}><StatusBadge status={estado} /></div>
          </div>
          {isPend && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button type="button" className="db-action-btn db-action-approve" disabled={isPending} onClick={() => authorize(p.id, 'placa')}>✓ Autorizar</button>
              <button type="button" className="db-action-btn db-action-reject"  disabled={isPending} onClick={() => openDeny(p.id, 'placa')}>✗ Denegar</button>
            </div>
          )}
          <SectionTitle>Datos del vehículo</SectionTitle>
          <FieldRow label="Placa">{p.placa}</FieldRow>
          <FieldRow label="Conductor">{p.conductor || '—'}</FieldRow>
          <FieldRow label="Cédula">{p.cedula || '—'}</FieldRow>
          <FieldRow label="Estado"><StatusBadge status={estado} /></FieldRow>
          <FieldRow label="Vence">{p.vence ? <span>{fmtDate(p.vence)} <VenceBadge vence={p.vence} /></span> : '—'}</FieldRow>
          <FieldRow label="Notas">{p.notas || <span style={{ color: 'var(--g-ink-3)' }}>—</span>}</FieldRow>
          <SectionTitle>Gestión</SectionTitle>
          <FieldRow label="Registrado por">{p.responsable_visita || '—'}</FieldRow>
          <FieldRow label="Autorizado por">{p.autoriza_visita || '—'}</FieldRow>
          <FieldRow label="F. autorización">{fmt(p.fecha_autorizado)}</FieldRow>
          <FieldRow label="F. creación">{fmt(p.creada)}</FieldRow>
          {acomps.length > 0 && (
            <>
              <SectionTitle>Acompañantes ({acomps.length})</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {acomps.map(a => (
                  <MiniCard key={a.id} icon="🚶" title={a.nombre} sub={`C.C. ${a.cedula}`} badge={<StatusBadge status={a.autorizado ? 'AUTORIZADO' : (a.estado ?? 'PENDIENTE')} />} onClick={() => setDetail({ kind: 'persona', data: a })} />
                ))}
              </div>
            </>
          )}
          <SectionTitle>Historial de accesos ({relRegs.length})</SectionTitle>
          {relRegs.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--g-ink-3)' }}>Sin registros vinculados.</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {relRegs.map(r => (
                  <MiniCard key={r.id} icon={r.categoria === 'VEHICULO' ? '🚗' : '🚶'} title={`${visitorName(r)}${r.placa ? ` · ${r.placa}` : ''}`} sub={fmt(r.entry_time)} badge={<StatusBadge status={r.status} />} onClick={() => setDetail({ kind: 'registro', data: r })} />
                ))}
              </div>
          }
        </>
      );
    }

    if (detail.kind === 'persona') {
      const p = detail.data;
      const estado = p.autorizado ? 'AUTORIZADO' : (p.estado ?? 'PENDIENTE');
      const isPend = !p.autorizado && p.estado !== 'RECHAZADO';
      const relRegs = getRegistrosForPersona(p.id);
      return (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🚶</div>
            <div><div style={{ fontWeight: 700, fontSize: 16 }}>{p.nombre}</div><div style={{ fontSize: 12, color: 'var(--g-ink-2)', marginTop: 2 }}>C.C. {p.cedula}</div></div>
            <div style={{ marginLeft: 'auto' }}><StatusBadge status={estado} /></div>
          </div>
          {isPend && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button type="button" className="db-action-btn db-action-approve" disabled={isPending} onClick={() => authorize(p.id, 'persona')}>✓ Autorizar</button>
              <button type="button" className="db-action-btn db-action-reject"  disabled={isPending} onClick={() => openDeny(p.id, 'persona')}>✗ Denegar</button>
            </div>
          )}
          <SectionTitle>Datos del visitante</SectionTitle>
          <FieldRow label="Nombre">{p.nombre}</FieldRow>
          <FieldRow label="Cédula">{p.cedula || '—'}</FieldRow>
          <FieldRow label="Cargo">{p.cargo || '—'}</FieldRow>
          <FieldRow label="Estado"><StatusBadge status={estado} /></FieldRow>
          <FieldRow label="Vence">{p.vence ? <span>{fmtDate(p.vence)} <VenceBadge vence={p.vence} /></span> : '—'}</FieldRow>
          <FieldRow label="Notas">{p.notas || <span style={{ color: 'var(--g-ink-3)' }}>—</span>}</FieldRow>
          <SectionTitle>Gestión</SectionTitle>
          <FieldRow label="Registrado por">{p.responsable_visita || '—'}</FieldRow>
          <FieldRow label="Autorizado por">{p.autoriza_visita || '—'}</FieldRow>
          <FieldRow label="F. autorización">{fmt(p.fecha_autorizado)}</FieldRow>
          <FieldRow label="F. creación">{fmt(p.creada)}</FieldRow>
          <SectionTitle>Historial de accesos ({relRegs.length})</SectionTitle>
          {relRegs.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--g-ink-3)' }}>Sin registros vinculados.</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {relRegs.map(r => (
                  <MiniCard key={r.id} icon={r.categoria === 'VEHICULO' ? '🚗' : '🚶'} title={`${visitorName(r)}${r.placa ? ` · ${r.placa}` : ''}`} sub={fmt(r.entry_time)} badge={<StatusBadge status={r.status} />} onClick={() => setDetail({ kind: 'registro', data: r })} />
                ))}
              </div>
          }
        </>
      );
    }

    if (detail.kind === 'registro') {
      const r = detail.data;
      const isPend = r.status === 'PENDIENTE';
      const linkedPlacas   = (r.placaIds ?? []).map(id => getPlacaById(id)).filter(Boolean) as PlacaRecord[];
      const linkedPersonas = (r.personaIds ?? []).map(id => getPersonaById(id)).filter(Boolean) as PersonaRecord[];
      return (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {r.categoria === 'VEHICULO' ? '🚗' : r.categoria === 'FIN_DE_SEMANA' ? '📅' : '🚶'}
            </div>
            <div><div style={{ fontWeight: 700, fontSize: 16 }}>{visitorName(r)}</div><div style={{ fontSize: 12, color: 'var(--g-ink-2)', marginTop: 2 }}>{fmt(r.entry_time)}</div></div>
            <div style={{ marginLeft: 'auto' }}><StatusBadge status={r.status} /></div>
          </div>
          {isPend && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button type="button" className="db-action-btn db-action-approve" disabled={isPending} onClick={() => approveReg(r.id)}>✓ Aprobar</button>
              <button type="button" className="db-action-btn db-action-reject"  disabled={isPending} onClick={() => openDeny(r.id, 'registro')}>✗ Rechazar</button>
            </div>
          )}
          <SectionTitle>Datos del registro</SectionTitle>
          <FieldRow label="Placa">{r.placa ? <span className="db-placa" style={{ fontSize: 12 }}>{r.placa}</span> : '—'}</FieldRow>
          <FieldRow label="Cédula">{r.cedula || '—'}</FieldRow>
          <FieldRow label="Visitante">{visitorName(r)}</FieldRow>
          <FieldRow label="Tipo"><TipoBadge tipo={r.tipo} /></FieldRow>
          <FieldRow label="Categoría">{r.categoria || '—'}</FieldRow>
          <FieldRow label="Estado"><StatusBadge status={r.status} /></FieldRow>
          <FieldRow label="Entrada">{fmt(r.entry_time)}</FieldRow>
          <FieldRow label="Salida">{r.exit_time ? fmt(r.exit_time) : '—'}</FieldRow>
          <FieldRow label="Aprobado por">{r.approved_by || '—'}</FieldRow>
          <FieldRow label="Supervisor">{r.supervisor || '—'}</FieldRow>
          <FieldRow label="Motivo">{r.motivo_visita || '—'}</FieldRow>
          <FieldRow label="Nodo origen">{r.nodo_origen || '—'}</FieldRow>
          <FieldRow label="Comentario">{r.comment || <span style={{ color: 'var(--g-ink-3)' }}>—</span>}</FieldRow>
          {r.rejected_time && <FieldRow label="Rechazado en">{fmt(r.rejected_time)}</FieldRow>}
          {(r.conductores?.length || r.notas_placas?.length) && (
            <>
              <SectionTitle>Lookups — Placa</SectionTitle>
              {(r.conductores ?? []).filter(Boolean).map((c, i) => <FieldRow key={i} label={`Conductor ${i + 1}`}>{c as string}</FieldRow>)}
              {(r.notas_placas ?? []).filter(Boolean).map((n, i) => <FieldRow key={i} label={`Nota ${i + 1}`}>{n as string}</FieldRow>)}
            </>
          )}
          {(r.nombres_personas as string[] ?? []).length > 0 && (
            <>
              <SectionTitle>Lookups — Personas</SectionTitle>
              {(r.nombres_personas as string[]).filter(Boolean).map((n, i) => <FieldRow key={i} label={`Persona ${i + 1}`}>{n}</FieldRow>)}
            </>
          )}
          {linkedPlacas.length > 0 && (
            <>
              <SectionTitle>Vehículo vinculado</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {linkedPlacas.map(p => (
                  <MiniCard key={p.id} icon="🚗" title={<span className="db-placa" style={{ fontSize: 12 }}>{p.placa}</span>} sub={p.conductor || '—'} badge={<StatusBadge status={p.autorizado ? 'AUTORIZADO' : (p.estado ?? 'PENDIENTE')} />} onClick={() => setDetail({ kind: 'placa', data: p })} />
                ))}
              </div>
            </>
          )}
          {linkedPersonas.length > 0 && (
            <>
              <SectionTitle>Personas vinculadas ({linkedPersonas.length})</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {linkedPersonas.map(p => (
                  <MiniCard key={p.id} icon="🚶" title={p.nombre} sub={`C.C. ${p.cedula}`} badge={<StatusBadge status={p.autorizado ? 'AUTORIZADO' : (p.estado ?? 'PENDIENTE')} />} onClick={() => setDetail({ kind: 'persona', data: p })} />
                ))}
              </div>
            </>
          )}
        </>
      );
    }
  }

  /* ── render ── */

  const totalV = placas.length + personas.length;

  return (
    <>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, var(--g-green-dark) 0%, var(--g-green) 100%)', borderRadius: 'var(--card-radius)', padding: '20px 28px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, boxShadow: '0 4px 24px rgba(78,91,49,.22)' }}>
        <div>
          <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .75 }}>Panel de monitoreo — {usuario}</p>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600, fontSize: 'clamp(20px,2.5vw,26px)', lineHeight: 1.1 }}>Solicitudes y registros de visita</h2>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[{ l: 'Visitantes', v: totalV }, { l: 'Pend. autorizar', v: solCounts.pendientes, u: solCounts.pendientes > 0 }, { l: 'Registros', v: registros.length }, { l: 'Por aprobar', v: regCounts.pendientes, u: regCounts.pendientes > 0 }].map(k => (
            <div key={k.l} style={{ background: (k as {u?: boolean}).u ? 'rgba(255,200,0,.28)' : 'rgba(255,255,255,.15)', borderRadius: 10, padding: '8px 16px', minWidth: 70, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{k.v}</div>
              <div style={{ fontSize: 11, opacity: .85, marginTop: 2 }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="db-card">
        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '0 24px', borderBottom: '1px solid var(--g-line)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {([['overview', 'Resumen', null, null], ['solicitudes', 'Solicitudes', allSolicitudes.length, solCounts.pendientes], ['registros', 'Registros', registros.length, regCounts.pendientes]] as [SubTab, string, number | null, number | null][]).map(([t, label, total, pend]) => (
            <button key={t} type="button" onClick={() => setSubTab(t)} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap', color: subTab === t ? 'var(--g-green-dark)' : 'var(--g-ink-3)', background: subTab === t ? 'var(--g-green-soft)' : 'transparent', border: 'none', borderBottom: subTab === t ? '2px solid var(--g-leaf)' : '2px solid transparent', cursor: 'pointer', marginBottom: -1, borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              {label}
              {total !== null && <span style={{ background: subTab === t ? 'var(--g-leaf)' : 'var(--g-line)', color: subTab === t ? '#fff' : 'var(--g-ink-3)', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{total}</span>}
              {pend !== null && pend > 0 && <span style={{ background: '#fbbf24', color: '#78350f', borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{pend}</span>}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {subTab === 'overview' && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {[
                { l: 'Total visitantes',    v: totalV,                  c: 'var(--g-green-dark)' },
                { l: 'Pend. autorizar',     v: solCounts.pendientes,    c: solCounts.pendientes > 0 ? '#854d0e' : 'var(--g-ink-2)' },
                { l: 'Autorizados',         v: solCounts.autorizadas,   c: '#166534' },
                { l: 'Rechazados',          v: solCounts.rechazadas,    c: '#991b1b' },
                { l: 'Total registros',     v: registros.length,        c: 'var(--g-green-dark)' },
                { l: 'Aprobados',           v: regCounts.aprobados,     c: '#166534' },
                { l: 'Negados',             v: regCounts.negados,       c: '#991b1b' },
                { l: 'Por aprobar',         v: regCounts.pendientes,    c: regCounts.pendientes > 0 ? '#854d0e' : 'var(--g-ink-2)' },
              ].map(k => (
                <div key={k.l} className="db-stat-card" style={{ padding: '14px 18px' }}>
                  <span className="db-stat-label">{k.l}</span>
                  <span className="db-stat-value" style={{ fontSize: 30, color: k.c }}>{k.v}</span>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px', gap: 20, alignItems: 'start' }}>
              {/* Bar */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--g-ink-3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  Actividad — últimos 14 días
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    <span style={{ width: 10, height: 10, background: '#16a34a', borderRadius: 2, display: 'inline-block' }} />aprobados
                    <span style={{ width: 10, height: 10, background: '#bbf7d0', borderRadius: 2, display: 'inline-block', marginLeft: 6 }} />total
                  </span>
                </div>
                <BarChart data={activityData} />
              </div>

              {/* Donut registros */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--g-ink-3)' }}>Registros</div>
                <DonutChart total={registros.length} segments={[{ value: regCounts.aprobados, color: '#22c55e' }, { value: regCounts.pendientes, color: '#fbbf24' }, { value: regCounts.negados, color: '#ef4444' }]} />
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                  {[{ color: '#22c55e', l: 'Aprobados', v: regCounts.aprobados }, { color: '#fbbf24', l: 'Pendientes', v: regCounts.pendientes }, { color: '#ef4444', l: 'Negados', v: regCounts.negados }].map(s => (
                    <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--g-ink-2)' }}>{s.l}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Donut solicitudes */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--g-ink-3)' }}>Solicitudes</div>
                <DonutChart total={allSolicitudes.length} segments={[{ value: solCounts.autorizadas, color: '#22c55e' }, { value: solCounts.pendientes, color: '#fbbf24' }, { value: solCounts.rechazadas, color: '#ef4444' }]} />
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                  {[{ color: '#22c55e', l: 'Autorizadas', v: solCounts.autorizadas }, { color: '#fbbf24', l: 'Pendientes', v: solCounts.pendientes }, { color: '#ef4444', l: 'Rechazadas', v: solCounts.rechazadas }].map(s => (
                    <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--g-ink-2)' }}>{s.l}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Category breakdown */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--g-ink-3)', marginBottom: 10 }}>Categoría de registros</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                {[
                  { icon: '🚗', l: 'Vehículos',     v: registros.filter(r => r.categoria === 'VEHICULO').length,     bg: 'var(--g-green-soft)' },
                  { icon: '🚶', l: 'Peatones',       v: registros.filter(r => r.categoria === 'PEATON').length,       bg: '#fef9c3' },
                  { icon: '📅', l: 'Fin de semana',  v: registros.filter(r => r.categoria === 'FIN_DE_SEMANA').length, bg: '#f3e8ff' },
                  { icon: '—',  l: 'Sin categoría',  v: registros.filter(r => !r.categoria).length,                   bg: 'var(--g-cream)' },
                ].map(c => (
                  <div key={c.l} style={{ background: c.bg, borderRadius: 12, padding: '14px 16px', textAlign: 'center', border: '1px solid var(--g-line)' }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{c.v}</div>
                    <div style={{ fontSize: 11, color: 'var(--g-ink-2)', marginTop: 4 }}>{c.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--g-ink-3)', marginBottom: 10 }}>Últimos 10 registros — clic para ver detalle</div>
              {registros.length === 0
                ? <p style={{ color: 'var(--g-ink-3)', fontSize: 13 }}>Sin registros aún.</p>
                : (
                  <div className="db-table-wrap" style={{ borderRadius: 10, border: '1px solid var(--g-line)' }}>
                    <table className="db-table">
                      <thead><tr><th>Visitante</th><th>Placa</th><th>Tipo</th><th>Estado</th><th>Entrada</th><th></th></tr></thead>
                      <tbody>
                        {registros.slice(0, 10).map(r => (
                          <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => { setDetail({ kind: 'registro', data: r }); }}>
                            <td style={{ fontWeight: 600, fontSize: 13 }}>{visitorName(r)}</td>
                            <td><span className="db-placa" style={{ fontSize: 11 }}>{r.placa || '—'}</span></td>
                            <td><TipoBadge tipo={r.tipo} /></td>
                            <td><StatusBadge status={r.status} /></td>
                            <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(r.entry_time)}</td>
                            <td style={{ fontSize: 11, color: 'var(--g-green-dark)', fontWeight: 600 }}>Ver →</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* ── Solicitudes ── */}
        {subTab === 'solicitudes' && (
          <>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--g-line)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Chip value="todas"       active={filtroSol === 'todas'}       count={solCounts.todas}       label="Todas"       onClick={v => setFiltroSol(v as FiltroSol)} />
              <Chip value="pendientes"  active={filtroSol === 'pendientes'}  count={solCounts.pendientes}  label="Pendientes"  onClick={v => setFiltroSol(v as FiltroSol)} />
              <Chip value="autorizadas" active={filtroSol === 'autorizadas'} count={solCounts.autorizadas} label="Autorizadas" onClick={v => setFiltroSol(v as FiltroSol)} />
              <Chip value="rechazadas"  active={filtroSol === 'rechazadas'}  count={solCounts.rechazadas}  label="Rechazadas"  onClick={v => setFiltroSol(v as FiltroSol)} />
              <div style={{ marginLeft: 'auto' }}><SearchBar value={searchSol} onChange={setSearchSol} placeholder="Nombre, placa, cédula…" /></div>
            </div>
            {actionError && !rejectTarget && <div style={{ margin: '10px 24px 0', padding: '9px 14px', background: '#fee2e2', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{actionError}</div>}
            <div className="db-table-wrap">
              <table className="db-table">
                <thead><tr><th>Tipo</th><th>Nombre / Placa</th><th>Cédula</th><th>Cargo / Conductor</th><th>Estado</th><th>Vence</th><th>Registrado por</th><th>Autorizado por</th><th>Creado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {filteredSolicitudes.length === 0 ? <EmptyRow cols={10} /> : filteredSolicitudes.map(item => {
                    const isP   = item.kind === 'placa';
                    const d     = item.data;
                    const pend  = !d.autorizado && d.estado !== 'RECHAZADO';
                    const estado = d.autorizado ? 'AUTORIZADO' : (d.estado ?? 'PENDIENTE');
                    const label  = isP ? (d as PlacaRecord).placa : (d as PersonaRecord).nombre;
                    const sub    = isP ? (d as PlacaRecord).conductor : (d as PersonaRecord).cargo;
                    return (
                      <tr key={d.id} style={{ cursor: 'pointer', background: pend ? 'rgba(251,191,36,.05)' : undefined }}
                        onClick={() => item.kind === 'placa' ? setDetail({ kind: 'placa', data: item.data as PlacaRecord }) : setDetail({ kind: 'persona', data: item.data as PersonaRecord })}>
                        <td><span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: isP ? 'var(--g-green-soft)' : '#fef9c3', color: isP ? 'var(--g-green-dark)' : '#854d0e' }}>{isP ? '🚗' : '🚶'}</span></td>
                        <td style={{ fontWeight: 700, fontSize: 13 }}>{isP ? <span className="db-placa" style={{ fontSize: 12 }}>{label}</span> : (label || '—')}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{d.cedula || '—'}</td>
                        <td style={{ fontSize: 12 }}>{sub || '—'}</td>
                        <td><StatusBadge status={estado} /></td>
                        <td style={{ fontSize: 11 }}>{d.vence ? <span>{fmtDate(d.vence)} <VenceBadge vence={d.vence} /></span> : '—'}</td>
                        <td style={{ fontSize: 12 }}>{d.responsable_visita || '—'}</td>
                        <td style={{ fontSize: 12 }}>{d.autoriza_visita || '—'}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(d.creada)}</td>
                        <td onClick={e => e.stopPropagation()}>
                          {pend ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button type="button" className="db-action-btn db-action-approve" disabled={isPending} onClick={() => authorize(d.id, item.kind as 'placa' | 'persona')}>✓</button>
                              <button type="button" className="db-action-btn db-action-reject"  disabled={isPending} onClick={() => openDeny(d.id, item.kind as 'placa' | 'persona')}>✗</button>
                            </div>
                          ) : <span style={{ fontSize: 11, color: 'var(--g-green-dark)' }}>Ver →</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '9px 24px', fontSize: 12, color: 'var(--g-ink-3)', borderTop: '1px solid var(--g-line)' }}>
              {filteredSolicitudes.length} de {allSolicitudes.length} · clic en fila para ver detalle completo y relaciones
            </div>
          </>
        )}

        {/* ── Registros ── */}
        {subTab === 'registros' && (
          <>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--g-line)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Chip value="todos"      active={filtroReg === 'todos'}      count={regCounts.todos}      label="Todos"      onClick={v => setFiltroReg(v as FiltroReg)} />
              <Chip value="pendientes" active={filtroReg === 'pendientes'} count={regCounts.pendientes} label="Pendientes" onClick={v => setFiltroReg(v as FiltroReg)} />
              <Chip value="aprobados"  active={filtroReg === 'aprobados'}  count={regCounts.aprobados}  label="Aprobados"  onClick={v => setFiltroReg(v as FiltroReg)} />
              <Chip value="negados"    active={filtroReg === 'negados'}    count={regCounts.negados}    label="Negados"    onClick={v => setFiltroReg(v as FiltroReg)} />
              <div style={{ marginLeft: 'auto' }}><SearchBar value={searchReg} onChange={setSearchReg} placeholder="Placa, cédula, conductor…" /></div>
            </div>
            {actionError && !rejectTarget && <div style={{ margin: '10px 24px 0', padding: '9px 14px', background: '#fee2e2', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{actionError}</div>}
            <div className="db-table-wrap">
              <table className="db-table">
                <thead><tr><th>Visitante</th><th>Placa</th><th>Cédula</th><th>Tipo</th><th>Categoría</th><th>Estado</th><th>Entrada</th><th>Salida</th><th>Aprobado por</th><th>Motivo</th><th>Acciones</th></tr></thead>
                <tbody>
                  {filteredRegistros.length === 0 ? <EmptyRow cols={11} /> : filteredRegistros.map(r => {
                    const pend = r.status === 'PENDIENTE';
                    return (
                      <tr key={r.id} style={{ cursor: 'pointer', background: pend ? 'rgba(251,191,36,.05)' : undefined }} onClick={() => setDetail({ kind: 'registro', data: r })}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{visitorName(r)}</td>
                        <td><span className="db-placa" style={{ fontSize: 11 }}>{r.placa || '—'}</span></td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{r.cedula || '—'}</td>
                        <td><TipoBadge tipo={r.tipo} /></td>
                        <td style={{ fontSize: 11, color: 'var(--g-ink-3)' }}>{r.categoria || '—'}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(r.entry_time)}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{r.exit_time ? fmt(r.exit_time) : '—'}</td>
                        <td style={{ fontSize: 12 }}>{r.approved_by || '—'}</td>
                        <td style={{ fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.motivo_visita || '—'}</td>
                        <td onClick={e => e.stopPropagation()}>
                          {pend ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button type="button" className="db-action-btn db-action-approve" disabled={isPending} onClick={() => approveReg(r.id)}>✓</button>
                              <button type="button" className="db-action-btn db-action-reject"  disabled={isPending} onClick={() => openDeny(r.id, 'registro')}>✗</button>
                            </div>
                          ) : <span style={{ fontSize: 11, color: 'var(--g-green-dark)' }}>Ver →</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '9px 24px', fontSize: 12, color: 'var(--g-ink-3)', borderTop: '1px solid var(--g-line)' }}>
              {filteredRegistros.length} de {registros.length} · clic en fila para ver detalle completo y relaciones
            </div>
          </>
        )}
      </div>

      {/* ── Detail slide-over ── */}
      {detail && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 900 }} onClick={() => setDetail(null)} />
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(520px, 95vw)', background: '#fff', boxShadow: '-4px 0 40px rgba(0,0,0,.18)', overflowY: 'auto', zIndex: 901, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--g-ink-3)' }}>
                {detail.kind === 'placa' ? 'Vehículo' : detail.kind === 'persona' ? 'Peatón' : 'Registro'} — Detalle completo
              </span>
              <button type="button" onClick={() => setDetail(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--g-line)', background: 'var(--g-cream)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            {renderDetail()}
          </div>
        </>
      )}

      {/* ── Modal ── */}
      {rejectTarget && (
        <div className="db-modal-overlay" onClick={closeModal}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <h3 className="db-modal-title">{rejectTarget.tipo === 'registro' ? 'Rechazar registro' : 'Denegar solicitud'}</h3>
            {rejectTarget.tipo === 'registro' ? (
              <div>
                <label className="db-modal-label" htmlFor="reject-comment">Motivo <span style={{ fontWeight: 400, color: 'var(--g-ink-3)' }}>(opcional)</span></label>
                <textarea id="reject-comment" className="db-modal-textarea" placeholder="Ej. Documentación incompleta…" value={rejectComment} onChange={e => setRejectComment(e.target.value)} disabled={isPending} />
              </div>
            ) : (
              <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--g-ink-2)' }}>La solicitud quedará como rechazada. El visitante no podrá acceder hasta una nueva solicitud.</p>
            )}
            {actionError && <p className="db-modal-error">{actionError}</p>}
            <div className="db-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={isPending}>Cancelar</button>
              <button type="button" className="btn" style={{ background: 'var(--g-coral)', color: '#fff' }} onClick={confirmDeny} disabled={isPending}>
                {isPending ? 'Procesando…' : rejectTarget.tipo === 'registro' ? 'Confirmar rechazo' : 'Confirmar denegación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
