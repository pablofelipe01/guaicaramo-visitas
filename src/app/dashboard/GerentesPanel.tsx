'use client';

import { useState } from 'react';
import type { IngresoGerenteRecord } from '@/lib/airtable';
import { usePagination } from '@/lib/usePagination';
import Pagination from './Pagination';
import {
  PERIODOS, calcularRango, enRango, describirRango, formatFechaHora, formatMinutos,
  minutosEstadia, generarInformePdf, type Periodo,
} from './gerentesReporte';

type EstadoFilter = '' | 'EN_SITIO' | 'SALIO';

interface Props {
  ingresos: IngresoGerenteRecord[];
  usuario: string;
}

function EstadoBadge({ r }: { r: IngresoGerenteRecord }) {
  return r.fecha_hora_salida
    ? <span className="badge badge-negado">Salió</span>
    : <span className="badge badge-aprobado">En sitio</span>;
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M3.5 16.5h13" />
    </svg>
  );
}

export default function GerentesPanel({ ingresos, usuario }: Props) {
  const [search,       setSearch]       = useState('');
  const [periodo,      setPeriodo]      = useState<Periodo>('todo');
  const [desde,        setDesde]        = useState('');
  const [hasta,        setHasta]        = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoFilter>('');
  const [filterUea,    setFilterUea]    = useState('');
  const [detalle,      setDetalle]      = useState<IngresoGerenteRecord | null>(null);
  const [generando,    setGenerando]    = useState(false);
  const [pdfError,     setPdfError]     = useState<string | null>(null);

  // Primero se acota por periodo; indicadores y contadores de los filtros se
  // calculan sobre ese subconjunto.
  const rango = calcularRango(periodo, desde, hasta);
  const rangoInvalido = !!(rango.desde && rango.hasta && rango.desde >= rango.hasta);
  const enPeriodo = ingresos.filter(r => enRango(r.fecha_hora_ingreso, rango));

  const ueas = [...new Set(enPeriodo.map(r => r.uea).filter(Boolean))].sort();
  const enSitio = enPeriodo.filter(r => !r.fecha_hora_salida).length;
  const gerentesDistintos = new Set(enPeriodo.map(r => r.gerente_id).filter(Boolean)).size;

  const q = search.trim().toLowerCase();
  const filtered = enPeriodo.filter(r => {
    if (filterEstado === 'EN_SITIO' && r.fecha_hora_salida) return false;
    if (filterEstado === 'SALIO' && !r.fecha_hora_salida) return false;
    if (filterUea && r.uea !== filterUea) return false;
    if (!q) return true;
    return [r.nombre, r.cedula, r.uea, r.placa_ingreso, r.area_destino, r.nota_vigilante]
      .some(v => v?.toLowerCase().includes(q));
  });

  const pagination = usePagination(filtered, {
    pageSize: 25,
    resetKey: `${q}|${periodo}|${desde}|${hasta}|${filterEstado}|${filterUea}`,
  });

  async function descargarPdf() {
    setPdfError(null);
    setGenerando(true);
    try {
      const filtros: string[] = [];
      if (filterEstado === 'EN_SITIO') filtros.push('Estado: En sitio');
      if (filterEstado === 'SALIO') filtros.push('Estado: Salió');
      if (filterUea) filtros.push(`UEA: ${filterUea}`);
      if (q) filtros.push(`Búsqueda: "${search.trim()}"`);
      await generarInformePdf({
        ingresos: filtered,
        periodoLabel: PERIODOS.find(p => p.value === periodo)?.label ?? '',
        rango,
        filtros,
        usuario,
      });
    } catch {
      setPdfError('No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <>
      <div className="db-stats">
        <div className="db-stat-card">
          <span className="db-stat-label">Total ingresos</span>
          <span className="db-stat-value">{enPeriodo.length}</span>
        </div>
        <div className="db-stat-card stat-aprobado">
          <span className="db-stat-label">En sitio</span>
          <span className="db-stat-value">{enSitio}</span>
        </div>
        <div className="db-stat-card">
          <span className="db-stat-label">Gerentes</span>
          <span className="db-stat-value">{gerentesDistintos}</span>
        </div>
        <div className="db-stat-card">
          <span className="db-stat-label">Unidades externas</span>
          <span className="db-stat-value">{ueas.length}</span>
        </div>
      </div>

      <div className="db-card">
        <div className="db-card-head">
          <h2 className="db-card-title">Ingresos de gerentes de unidades externas</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {pdfError && <span className="db-modal-error" style={{ margin: 0 }}>{pdfError}</span>}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={descargarPdf}
              disabled={generando || rangoInvalido}
              title="Descarga un informe PDF con el periodo y los filtros actuales"
            >
              <IconDownload />
              {generando ? 'Generando…' : 'Descargar informe PDF'}
            </button>
          </div>
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
              placeholder="Buscar por gerente, cédula, UEA, placa o nota…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="db-search-clear" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">×</button>
            )}
          </div>
        </div>

        <div className="db-filter-bar">
          <div className="db-filter-group">
            <span className="db-filter-label">Periodo</span>
            <select
              className={`db-filter-select${periodo !== 'todo' ? ' is-active' : ''}`}
              value={periodo}
              onChange={e => setPeriodo(e.target.value as Periodo)}
            >
              {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {periodo === 'personalizado' && (
            <div className="db-filter-group">
              <span className="db-filter-label">Desde</span>
              <input
                type="date"
                className={`db-filter-date${desde ? ' is-active' : ''}`}
                value={desde}
                max={hasta || undefined}
                onChange={e => setDesde(e.target.value)}
                aria-label="Fecha desde"
              />
              <span className="db-filter-label">Hasta</span>
              <input
                type="date"
                className={`db-filter-date${hasta ? ' is-active' : ''}`}
                value={hasta}
                min={desde || undefined}
                onChange={e => setHasta(e.target.value)}
                aria-label="Fecha hasta"
              />
            </div>
          )}
          <div className="db-filter-group">
            <span className="db-filter-label">Estado</span>
            <select
              className={`db-filter-select${filterEstado !== '' ? ' is-active' : ''}`}
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value as EstadoFilter)}
            >
              <option value="">Todos ({enPeriodo.length})</option>
              <option value="EN_SITIO">En sitio ({enSitio})</option>
              <option value="SALIO">Salió ({enPeriodo.length - enSitio})</option>
            </select>
          </div>
          <div className="db-filter-group">
            <span className="db-filter-label">UEA</span>
            <select
              className={`db-filter-select${filterUea !== '' ? ' is-active' : ''}`}
              value={filterUea}
              onChange={e => setFilterUea(e.target.value)}
            >
              <option value="">Todas</option>
              {ueas.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <span className="db-filter-count">
            {periodo !== 'todo' && !rangoInvalido && <>{describirRango(rango)} · </>}
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {rangoInvalido ? (
          <p className="db-table-empty">La fecha &ldquo;desde&rdquo; debe ser anterior o igual a la fecha &ldquo;hasta&rdquo;.</p>
        ) : filtered.length === 0 ? (
          <p className="db-table-empty">
            {ingresos.length === 0 ? 'No hay ingresos de gerentes registrados.' : 'Ningún ingreso coincide con el periodo y los filtros.'}
          </p>
        ) : (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Ingreso</th>
                  <th>Gerente</th>
                  <th>Cédula</th>
                  <th>UEA</th>
                  <th>Placa</th>
                  <th>Área destino</th>
                  <th>Salida</th>
                  <th>Duración</th>
                  <th>Estado</th>
                  <th>Nota del vigilante</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map(r => (
                  <tr key={r.id} onClick={() => setDetalle(r)} style={{ cursor: 'pointer' }} title="Ver detalle">
                    <td className="db-td-date">{formatFechaHora(r.fecha_hora_ingreso)}</td>
                    <td className="db-td-name">{r.nombre || '—'}</td>
                    <td>{r.cedula || '—'}</td>
                    <td>{r.uea || '—'}</td>
                    <td>
                      {r.placa_ingreso
                        ? <span className="db-placa">{r.placa_ingreso}</span>
                        : <span className="db-td-muted">—</span>}
                    </td>
                    <td>{r.area_destino || <span className="db-td-muted">—</span>}</td>
                    <td className="db-td-date">{r.fecha_hora_salida ? formatFechaHora(r.fecha_hora_salida) : <span className="db-td-muted">—</span>}</td>
                    <td>{formatMinutos(minutosEstadia(r))}</td>
                    <td><EstadoBadge r={r} /></td>
                    <td className="db-td-truncate">{r.nota_vigilante || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!rangoInvalido && filtered.length > 0 && <Pagination pagination={pagination} label="ingresos" />}
      </div>

      {/* ── Detalle del ingreso ── */}
      {detalle && (
        <div className="db-modal-overlay" onClick={() => setDetalle(null)}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <h3 className="db-modal-title">{detalle.nombre || 'Gerente'}</h3>
            <div className="db-record-card-meta">
              <div className="db-record-field">
                <span className="db-record-field-label">Cédula</span>
                <span className="db-record-field-value">{detalle.cedula || '—'}</span>
              </div>
              <div className="db-record-field">
                <span className="db-record-field-label">UEA</span>
                <span className="db-record-field-value">{detalle.uea || '—'}</span>
              </div>
              <div className="db-record-field">
                <span className="db-record-field-label">Placa de ingreso</span>
                <span className="db-record-field-value">{detalle.placa_ingreso || '—'}</span>
              </div>
              <div className="db-record-field">
                <span className="db-record-field-label">Placas registradas</span>
                <span className="db-record-field-value">{detalle.placas_gerente || '—'}</span>
              </div>
              <div className="db-record-field">
                <span className="db-record-field-label">Área destino</span>
                <span className="db-record-field-value">{detalle.area_destino || '—'}</span>
              </div>
              <div className="db-record-field">
                <span className="db-record-field-label">Gerente autorizado</span>
                <span className="db-record-field-value">{detalle.gerente_autorizado ? 'Sí' : 'No'}</span>
              </div>
              <div className="db-record-field">
                <span className="db-record-field-label">Ingreso</span>
                <span className="db-record-field-value">{formatFechaHora(detalle.fecha_hora_ingreso)}</span>
              </div>
              <div className="db-record-field">
                <span className="db-record-field-label">Salida</span>
                <span className="db-record-field-value">{formatFechaHora(detalle.fecha_hora_salida)}</span>
              </div>
              <div className="db-record-field">
                <span className="db-record-field-label">Duración</span>
                <span className="db-record-field-value">{formatMinutos(minutosEstadia(detalle))}</span>
              </div>
            </div>
            {detalle.nota_vigilante && (
              <div className="db-record-card-section">
                <span className="db-record-field-label">Nota del vigilante</span>
                <p className="db-record-card-text" style={{ whiteSpace: 'pre-line' }}>{detalle.nota_vigilante}</p>
              </div>
            )}
            <div className="db-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setDetalle(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
