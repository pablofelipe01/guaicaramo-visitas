'use client';

import { useState, useMemo } from 'react';
import type {
  RegistroRecord, PlacaRecord, PersonaRecord, ItemRecord,
  FinDeSemanaRecord, AdminFullRecord,
} from '@/lib/airtable';

type SubTab = 'resumen' | 'registros' | 'vehiculos' | 'peatones' | 'items' | 'finde' | 'admins';

interface Props {
  registros: RegistroRecord[];
  placas: PlacaRecord[];
  personas: PersonaRecord[];
  items: ItemRecord[];
  finDeSemana: FinDeSemanaRecord[];
  admins: AdminFullRecord[];
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

/* ── micro-components ── */

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span style={{ color: 'var(--g-ink-3)' }}>—</span>;
  const map: Record<string, { bg: string; color: string }> = {
    APROBADO:           { bg: '#dcfce7',                color: '#166534' },
    AUTORIZADO:         { bg: '#dcfce7',                color: '#166534' },
    PENDIENTE:            { bg: 'var(--g-amber-soft)',    color: '#8a5c00' },
    'PENDIENTE REGISTRO': { bg: '#e0f2fe',               color: '#0369a1' },
    NEGADO:               { bg: 'var(--g-coral-soft)',    color: '#a8200a' },
    RECHAZADO:          { bg: 'var(--g-coral-soft)',    color: '#a8200a' },
    SALIDA_SIN_ENTRADA: { bg: '#f3e8ff',                color: '#6b21a8' },
  };
  const s = map[status] ?? { bg: '#f1f5f9', color: '#64748b' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px',
      borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
      textTransform: 'uppercase', whiteSpace: 'nowrap',
      background: s.bg, color: s.color,
    }}>
      {status}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo?: string }) {
  if (!tipo) return <span style={{ color: 'var(--g-ink-3)' }}>—</span>;
  const cfg: Record<string, { icon: string; color: string; bg: string }> = {
    ENTRADA:            { icon: '↓', color: '#166534', bg: '#dcfce7' },
    SALIDA:             { icon: '↑', color: '#a8200a', bg: 'var(--g-coral-soft)' },
    MANUAL:             { icon: '✎', color: '#6b21a8', bg: '#f3e8ff' },
    SALIDA_SIN_ENTRADA: { icon: '↗', color: '#8a5c00', bg: 'var(--g-amber-soft)' },
  };
  const c = cfg[tipo] ?? { icon: '·', color: 'var(--g-ink-3)', bg: 'var(--g-line)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 9px',
      borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color,
    }}>
      {c.icon} {tipo}
    </span>
  );
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--g-line)' }}>
      <div style={{ position: 'relative', maxWidth: 440 }}>
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--g-ink-3)', fontSize: 14, pointerEvents: 'none' }}>
          🔍
        </span>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? 'Buscar…'}
          className="db-search-input"
          style={{ paddingLeft: 32 }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="db-search-clear"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function FooterCount({ shown, total, label }: { shown: number; total: number; label: string }) {
  return (
    <div style={{ padding: '10px 24px', fontSize: 12, color: 'var(--g-ink-3)', borderTop: '1px solid var(--g-line)' }}>
      {shown} de {total} {label}
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--g-ink-3)', fontSize: 14 }}>
        Sin resultados
      </td>
    </tr>
  );
}

function KpiChip({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '10px 18px', minWidth: 80, textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: .82, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="db-stat-card" style={{ padding: '16px 20px' }}>
      <span className="db-stat-label">{label}</span>
      <span className="db-stat-value" style={{ fontSize: 32, ...(color ? { color } : {}) }}>{value}</span>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h4 style={{
      margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '.08em',
      textTransform: 'uppercase', color: 'var(--g-ink-3)',
      borderBottom: '1px solid var(--g-line)', paddingBottom: 8,
    }}>
      {children}
    </h4>
  );
}

function InnerStat({ label, value, color, bg }: { label: string; value: number; color?: string; bg?: string }) {
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10,
      background: bg ?? 'var(--g-cream)', border: '1px solid var(--g-line)',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--g-ink-3)' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, fontWeight: 700, lineHeight: 1, color: color ?? 'var(--g-green-dark)' }}>
        {value}
      </span>
    </div>
  );
}

/* ── main component ── */

export default function PanelDeControlPanel({ registros, placas, personas, items, finDeSemana, admins }: Props) {
  const [tab, setTab] = useState<SubTab>('resumen');
  const [search, setSearch] = useState('');

  function changeTab(t: SubTab) { setTab(t); setSearch(''); }

  /* ── aggregated stats ── */
  const stats = useMemo(() => ({
    registros: {
      total:     registros.length,
      aprobados: registros.filter(r => r.status === 'APROBADO').length,
      negados:   registros.filter(r => r.status === 'NEGADO').length,
      pendientes: registros.filter(r => r.status === 'PENDIENTE').length,
      vehiculos: registros.filter(r => r.categoria === 'VEHICULO').length,
      peatones:  registros.filter(r => r.categoria === 'PEATON').length,
      finde:     registros.filter(r => r.categoria === 'FIN_DE_SEMANA').length,
    },
    placas: {
      total:      placas.length,
      autorizadas: placas.filter(p => p.autorizado).length,
      pendientes: placas.filter(p => !p.autorizado && p.estado !== 'RECHAZADO').length,
      rechazadas: placas.filter(p => p.estado === 'RECHAZADO').length,
    },
    personas: {
      total:      personas.length,
      autorizadas: personas.filter(p => p.autorizado).length,
      pendientes: personas.filter(p => !p.autorizado && p.estado !== 'RECHAZADO').length,
      rechazadas: personas.filter(p => p.estado === 'RECHAZADO').length,
    },
    items: {
      total:      items.length,
      autorizados: items.filter(i => i.autorizado).length,
      usados:     items.filter(i => i.usado).length,
      pendientes: items.filter(i => !i.autorizado).length,
    },
    finde: { total: finDeSemana.length },
    admins: {
      total:       admins.length,
      superadmins: admins.filter(a => a.tipo === 'Superadmin').length,
      autorizan:   admins.filter(a => a.tipo === 'Autoriza').length,
      invitan:     admins.filter(a => a.tipo === 'Invita').length,
      porteria:    admins.filter(a => a.tipo === 'Porteria').length,
    },
  }), [registros, placas, personas, items, finDeSemana, admins]);

  const totalRecords = registros.length + placas.length + personas.length + items.length + finDeSemana.length;

  /* ── filtered data ── */
  const filteredRegistros = useMemo(() => {
    if (!search) return registros;
    const q = search.toLowerCase();
    return registros.filter(r =>
      r.placa?.toLowerCase().includes(q) ||
      r.cedula?.toLowerCase().includes(q) ||
      (r.conductores?.[0] as string | undefined)?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q) ||
      r.tipo?.toLowerCase().includes(q) ||
      r.motivo_visita?.toLowerCase().includes(q) ||
      (r.notas_placas?.[0] as string | undefined)?.toLowerCase().includes(q) ||
      (r.nombres_personas as string[] | undefined)?.join(' ').toLowerCase().includes(q),
    );
  }, [registros, search]);

  const filteredPlacas = useMemo(() => {
    if (!search) return placas;
    const q = search.toLowerCase();
    return placas.filter(p =>
      p.placa?.toLowerCase().includes(q) ||
      p.conductor?.toLowerCase().includes(q) ||
      p.cedula?.toLowerCase().includes(q) ||
      p.estado?.toLowerCase().includes(q) ||
      p.notas?.toLowerCase().includes(q) ||
      p.responsable_visita?.toLowerCase().includes(q) ||
      p.autoriza_visita?.toLowerCase().includes(q),
    );
  }, [placas, search]);

  const filteredPersonas = useMemo(() => {
    if (!search) return personas;
    const q = search.toLowerCase();
    return personas.filter(p =>
      p.nombre?.toLowerCase().includes(q) ||
      p.cedula?.toLowerCase().includes(q) ||
      p.cargo?.toLowerCase().includes(q) ||
      p.estado?.toLowerCase().includes(q) ||
      p.notas?.toLowerCase().includes(q) ||
      p.responsable_visita?.toLowerCase().includes(q) ||
      p.autoriza_visita?.toLowerCase().includes(q),
    );
  }, [personas, search]);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      i.nombre?.toLowerCase().includes(q) ||
      i.cedula?.toLowerCase().includes(q) ||
      i.concepto?.toLowerCase().includes(q) ||
      i.destino?.toLowerCase().includes(q) ||
      i.area?.toLowerCase().includes(q) ||
      i.numero?.toLowerCase().includes(q) ||
      i.autorizado_por?.toLowerCase().includes(q),
    );
  }, [items, search]);

  const filteredFinde = useMemo(() => {
    if (!search) return finDeSemana;
    const q = search.toLowerCase();
    return finDeSemana.filter(f =>
      f.nombre?.toLowerCase().includes(q) ||
      f.cedula?.toLowerCase().includes(q) ||
      f.area?.toLowerCase().includes(q) ||
      f.estado?.toLowerCase().includes(q) ||
      f.motivo_visita?.toLowerCase().includes(q),
    );
  }, [finDeSemana, search]);

  const filteredAdmins = useMemo(() => {
    if (!search) return admins;
    const q = search.toLowerCase();
    return admins.filter(a =>
      a.nombre?.toLowerCase().includes(q) ||
      a.cedula?.toLowerCase().includes(q) ||
      a.tipo?.toLowerCase().includes(q) ||
      a.areas?.join(' ').toLowerCase().includes(q),
    );
  }, [admins, search]);

  const subTabs: [SubTab, string, number][] = [
    ['resumen',   'Resumen',          totalRecords],
    ['registros', 'Registros',        stats.registros.total],
    ['vehiculos', 'Vehículos',        stats.placas.total],
    ['peatones',  'Peatones',         stats.personas.total],
    ['items',     'Ítems',            stats.items.total],
    ['finde',     'Fin de semana',    stats.finde.total],
    ['admins',    'Administradores',  stats.admins.total],
  ];

  return (
    <>
      {/* ── Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--g-green-dark) 0%, var(--g-green) 100%)',
        borderRadius: 'var(--card-radius)', padding: '28px 32px', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 20, boxShadow: '0 4px 24px rgba(78,91,49,.22)',
      }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .75 }}>
            Panel de Control — Superadmin
          </p>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600, fontSize: 'clamp(22px,3vw,30px)', lineHeight: 1.1 }}>
            Visión completa del sistema
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 14, opacity: .88 }}>
            {totalRecords.toLocaleString()} registros en todas las tablas
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiChip label="Registros"  value={stats.registros.total} />
          <KpiChip label="Vehículos"  value={stats.placas.total} />
          <KpiChip label="Peatones"   value={stats.personas.total} />
          <KpiChip label="Ítems"      value={stats.items.total} />
        </div>
      </div>

      {/* ── Global KPI grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 14 }}>
        <MiniStat label="Total registros"       value={stats.registros.total} />
        <MiniStat label="Aprobados"             value={stats.registros.aprobados}  color="#166534" />
        <MiniStat label="Negados"               value={stats.registros.negados}    color="var(--g-coral)" />
        <MiniStat label="Pendientes de aprobar" value={stats.registros.pendientes} color="#9a6800" />
        <MiniStat label="Vehículos autorizados" value={stats.placas.autorizadas}   color="#166534" />
        <MiniStat label="Vehículos pendientes"  value={stats.placas.pendientes}    color="#9a6800" />
        <MiniStat label="Peatones autorizados"  value={stats.personas.autorizadas} color="#166534" />
        <MiniStat label="Peatones pendientes"   value={stats.personas.pendientes}  color="#9a6800" />
        <MiniStat label="Ítems autorizados"     value={stats.items.autorizados}    color="#166534" />
        <MiniStat label="Ítems usados"          value={stats.items.usados} />
        <MiniStat label="Fin de semana"         value={stats.finde.total} />
        <MiniStat label="Administradores"       value={stats.admins.total} />
      </div>

      {/* ── Tabbed detail card ── */}
      <div className="db-card">
        {/* Sub-tabs */}
        <div style={{
          display: 'flex', gap: 2, padding: '0 24px',
          borderBottom: '1px solid var(--g-line)',
          overflowX: 'auto', scrollbarWidth: 'none', flexWrap: 'nowrap',
        }}>
          {subTabs.map(([t, label, count]) => (
            <button
              key={t}
              type="button"
              onClick={() => changeTab(t)}
              style={{
                padding: '12px 14px', fontSize: 13, fontWeight: 600,
                color: tab === t ? 'var(--g-green-dark)' : 'var(--g-ink-3)',
                background: tab === t ? 'var(--g-green-soft)' : 'transparent',
                border: 'none', borderBottom: tab === t ? '2px solid var(--g-leaf)' : '2px solid transparent',
                cursor: 'pointer', marginBottom: -1, borderRadius: '6px 6px 0 0',
                display: 'flex', alignItems: 'center', gap: 6,
                flexShrink: 0, whiteSpace: 'nowrap', transition: 'color .15s, background .15s',
              }}
            >
              {label}
              <span style={{
                background: tab === t ? 'var(--g-leaf)' : 'var(--g-line)',
                color: tab === t ? '#fff' : 'var(--g-ink-3)',
                borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                minWidth: 22, textAlign: 'center',
              }}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Resumen ── */}
        {tab === 'resumen' && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

            <SectionHead>Registros de entrada / salida</SectionHead>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
              <InnerStat label="Total"      value={stats.registros.total} />
              <InnerStat label="Aprobados"  value={stats.registros.aprobados}  color="#166534" bg="#dcfce7" />
              <InnerStat label="Negados"    value={stats.registros.negados}    color="#a8200a" bg="var(--g-coral-soft)" />
              <InnerStat label="Pendientes" value={stats.registros.pendientes} color="#8a5c00" bg="var(--g-amber-soft)" />
              <InnerStat label="Vehículos"  value={stats.registros.vehiculos} />
              <InnerStat label="Peatones"   value={stats.registros.peatones} />
              <InnerStat label="Fin semana" value={stats.registros.finde} />
            </div>

            <SectionHead>Vehículos — tabla Placas</SectionHead>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
              <InnerStat label="Total"       value={stats.placas.total} />
              <InnerStat label="Autorizados" value={stats.placas.autorizadas}  color="#166534" bg="#dcfce7" />
              <InnerStat label="Pendientes"  value={stats.placas.pendientes}   color="#8a5c00" bg="var(--g-amber-soft)" />
              <InnerStat label="Rechazados"  value={stats.placas.rechazadas}   color="#a8200a" bg="var(--g-coral-soft)" />
            </div>

            <SectionHead>Peatones — tabla Personas</SectionHead>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
              <InnerStat label="Total"       value={stats.personas.total} />
              <InnerStat label="Autorizados" value={stats.personas.autorizadas}  color="#166534" bg="#dcfce7" />
              <InnerStat label="Pendientes"  value={stats.personas.pendientes}   color="#8a5c00" bg="var(--g-amber-soft)" />
              <InnerStat label="Rechazados"  value={stats.personas.rechazadas}   color="#a8200a" bg="var(--g-coral-soft)" />
            </div>

            <SectionHead>Ítems / Órdenes de salida</SectionHead>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
              <InnerStat label="Total"        value={stats.items.total} />
              <InnerStat label="Autorizados"  value={stats.items.autorizados}  color="#166534" bg="#dcfce7" />
              <InnerStat label="Sin autorizar" value={stats.items.pendientes}  color="#8a5c00" bg="var(--g-amber-soft)" />
              <InnerStat label="Usados"       value={stats.items.usados} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SectionHead>Fin de semana</SectionHead>
                <InnerStat label="Total registros" value={stats.finde.total} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SectionHead>Administradores</SectionHead>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <InnerStat label="Total"       value={stats.admins.total} />
                  <InnerStat label="Superadmin"  value={stats.admins.superadmins} />
                  <InnerStat label="Autorizan"   value={stats.admins.autorizan} />
                  <InnerStat label="Invitan"     value={stats.admins.invitan} />
                  <InnerStat label="Portería"    value={stats.admins.porteria} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Registros ── */}
        {tab === 'registros' && (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar por placa, cédula, conductor, estado, motivo…" />
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Conductor</th>
                    <th>Cédula</th>
                    <th>Tipo</th>
                    <th>Categoría</th>
                    <th>Estado</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Aprobado por</th>
                    <th>Notas / Motivo</th>
                    <th>Peatones</th>
                    <th>Supervisor</th>
                    <th>Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegistros.length === 0
                    ? <EmptyRow cols={13} />
                    : filteredRegistros.map(r => (
                      <tr key={r.id}>
                        <td><span className="db-placa" style={{ fontSize: 12 }}>{r.placa || '—'}</span></td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{(r.conductores?.[0] as string | undefined) || '—'}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{r.cedula || '—'}</td>
                        <td><TipoBadge tipo={r.tipo} /></td>
                        <td style={{ fontSize: 11, color: 'var(--g-ink-3)' }}>{r.categoria || '—'}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(r.entry_time)}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{r.exit_time ? fmt(r.exit_time) : '—'}</td>
                        <td style={{ fontSize: 12 }}>{r.approved_by || '—'}</td>
                        <td style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(r.notas_placas?.[0] as string | undefined) || r.motivo_visita || '—'}
                        </td>
                        <td style={{ fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(r.nombres_personas as string[] | undefined)?.join(', ') || '—'}
                        </td>
                        <td style={{ fontSize: 12 }}>{r.supervisor || '—'}</td>
                        <td style={{ fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.comment || '—'}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <FooterCount shown={filteredRegistros.length} total={registros.length} label="registros" />
          </>
        )}

        {/* ── Vehículos ── */}
        {tab === 'vehiculos' && (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar por placa, conductor, cédula, estado, notas…" />
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Conductor</th>
                    <th>Cédula conductor</th>
                    <th>Estado</th>
                    <th>Vence</th>
                    <th>Registrado por</th>
                    <th>Autorizado por</th>
                    <th>Fecha autorización</th>
                    <th>Fecha creación</th>
                    <th>Notas</th>
                    <th>Acompañantes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlacas.length === 0
                    ? <EmptyRow cols={11} />
                    : filteredPlacas.map(p => (
                      <tr key={p.id}>
                        <td><span className="db-placa" style={{ fontSize: 12 }}>{p.placa}</span></td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{p.conductor || '—'}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{p.cedula || '—'}</td>
                        <td><StatusBadge status={p.estado} /></td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(p.vence)}</td>
                        <td style={{ fontSize: 12 }}>{p.responsable_visita || '—'}</td>
                        <td style={{ fontSize: 12 }}>{p.autoriza_visita || '—'}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(p.fecha_autorizado)}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(p.creada)}</td>
                        <td style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.notas || '—'}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--g-ink-3)' }}>
                          {p.acompañanteIds?.length ? `${p.acompañanteIds.length} acomp.` : '—'}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <FooterCount shown={filteredPlacas.length} total={placas.length} label="vehículos" />
          </>
        )}

        {/* ── Peatones ── */}
        {tab === 'peatones' && (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, cédula, cargo, estado, notas…" />
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Cédula</th>
                    <th>Cargo</th>
                    <th>Estado</th>
                    <th>Vence</th>
                    <th>Registrado por</th>
                    <th>Autorizado por</th>
                    <th>Fecha autorización</th>
                    <th>Fecha creación</th>
                    <th>Notas</th>
                    <th>Acompañantes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPersonas.length === 0
                    ? <EmptyRow cols={11} />
                    : filteredPersonas.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{p.nombre || '—'}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{p.cedula || '—'}</td>
                        <td style={{ fontSize: 12 }}>{p.cargo || '—'}</td>
                        <td><StatusBadge status={p.estado} /></td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(p.vence)}</td>
                        <td style={{ fontSize: 12 }}>{p.responsable_visita || '—'}</td>
                        <td style={{ fontSize: 12 }}>{p.autoriza_visita || '—'}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(p.fecha_autorizado)}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(p.creada)}</td>
                        <td style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.notas || '—'}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--g-ink-3)' }}>
                          {p.acompañanteIds?.length ? `${p.acompañanteIds.length} acomp.` : '—'}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <FooterCount shown={filteredPersonas.length} total={personas.length} label="peatones" />
          </>
        )}

        {/* ── Ítems ── */}
        {tab === 'items' && (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, cédula, concepto, destino, área…" />
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nombre</th>
                    <th>Cédula</th>
                    <th>Concepto</th>
                    <th>Destino</th>
                    <th>Área</th>
                    <th>Autorizado</th>
                    <th>Usado</th>
                    <th>Autorizado por</th>
                    <th>Fecha autorización</th>
                    <th>Fecha salida</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0
                    ? <EmptyRow cols={12} />
                    : filteredItems.map(i => (
                      <tr key={i.id}>
                        <td style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{i.numero || '—'}</td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{i.nombre || '—'}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{i.cedula || '—'}</td>
                        <td style={{ fontSize: 11, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {i.concepto || '—'}
                        </td>
                        <td style={{ fontSize: 12 }}>{i.destino || '—'}</td>
                        <td style={{ fontSize: 12 }}>{i.area || '—'}</td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', padding: '2px 9px',
                            borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: i.autorizado ? '#dcfce7' : 'var(--g-amber-soft)',
                            color: i.autorizado ? '#166534' : '#8a5c00',
                          }}>
                            {i.autorizado ? '✓ Sí' : '— No'}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', padding: '2px 9px',
                            borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: i.usado ? '#dcfce7' : 'var(--g-line)',
                            color: i.usado ? '#166534' : 'var(--g-ink-3)',
                          }}>
                            {i.usado ? '✓ Sí' : '— No'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>{i.autorizado_por || '—'}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(i.fecha_autorizacion)}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(i.fecha_salida)}</td>
                        <td style={{ fontSize: 11, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {i.notas || '—'}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <FooterCount shown={filteredItems.length} total={items.length} label="ítems" />
          </>
        )}

        {/* ── Fin de semana ── */}
        {tab === 'finde' && (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, cédula, área, estado…" />
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Cédula</th>
                    <th>Área</th>
                    <th>Estado</th>
                    <th>Fecha inicio</th>
                    <th>Fecha fin</th>
                    <th>Motivo visita</th>
                    <th>Resumen</th>
                    <th>Notificado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFinde.length === 0
                    ? <EmptyRow cols={9} />
                    : filteredFinde.map(f => (
                      <tr key={f.id}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{f.nombre || '—'}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{f.cedula || '—'}</td>
                        <td style={{ fontSize: 12 }}>{f.area || '—'}</td>
                        <td><StatusBadge status={f.estado} /></td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(f.fecha_inicio)}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(f.fecha_fin)}</td>
                        <td style={{ fontSize: 11 }}>{f.motivo_visita || '—'}</td>
                        <td style={{ fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.resumen || '—'}
                        </td>
                        <td style={{ fontSize: 11, textAlign: 'center' }}>{f.resultado_notificado ? '✓' : '—'}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <FooterCount shown={filteredFinde.length} total={finDeSemana.length} label="registros fin de semana" />
          </>
        )}

        {/* ── Administradores ── */}
        {tab === 'admins' && (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, cédula, tipo, área…" />
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Cédula</th>
                    <th>Tipo</th>
                    <th>Áreas asignadas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdmins.length === 0
                    ? <EmptyRow cols={4} />
                    : filteredAdmins.map(a => {
                      const typeColors: Record<string, { bg: string; color: string }> = {
                        Superadmin: { bg: '#f0fdf4',              color: '#166534' },
                        Autoriza:   { bg: 'var(--g-green-soft)',  color: 'var(--g-green-dark)' },
                        Invita:     { bg: 'var(--g-amber-soft)',  color: '#8a5c00' },
                        Porteria:   { bg: '#f3e8ff',              color: '#6b21a8' },
                      };
                      const tc = a.tipo ? (typeColors[a.tipo] ?? { bg: 'var(--g-line)', color: 'var(--g-ink-3)' }) : { bg: 'var(--g-line)', color: 'var(--g-ink-3)' };
                      return (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{a.nombre || '—'}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{a.cedula || '—'}</td>
                          <td>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', padding: '2px 9px',
                              borderRadius: 20, fontSize: 11, fontWeight: 700,
                              background: tc.bg, color: tc.color,
                            }}>
                              {a.tipo || '—'}
                            </span>
                          </td>
                          <td>
                            {a.areas?.length
                              ? (
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {a.areas.map((area, idx) => (
                                    <span key={idx} style={{
                                      background: 'var(--g-green-soft)', color: 'var(--g-green-dark)',
                                      padding: '1px 7px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                                    }}>
                                      {area}
                                    </span>
                                  ))}
                                </div>
                              )
                              : <span style={{ color: 'var(--g-ink-3)', fontSize: 12 }}>Sin áreas</span>
                            }
                          </td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
            <FooterCount shown={filteredAdmins.length} total={admins.length} label="administradores" />
          </>
        )}
      </div>
    </>
  );
}
