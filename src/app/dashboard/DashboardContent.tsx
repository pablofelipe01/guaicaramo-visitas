'use client';

import { useState } from 'react';
import NotificationBell from '@/components/NotificationBell';
import type { RegistroRecord, PlacaRecord, PersonaRecord, ItemRecord, FinDeSemanaRecord, AdminFullRecord } from '@/lib/airtable';
import RegistrosPanel from './RegistrosPanel';
import RegistrarVisitantePanel from './RegistrarVisitantePanel';
import VisitantesPanel from './VisitantesPanel';
import ProgramacionSemanalPanel from './ProgramacionSemanalPanel';
import OrdenesSalidaPanel from './OrdenesSalidaPanel';
import ResumenAutorizaPanel from './ResumenAutorizaPanel';
import PanelDeControlPanel from './PanelDeControlPanel';

type Tab = 'resumen' | 'registros' | 'visitantes' | 'registrar' | 'programacion' | 'ordenes' | 'control';

interface Props {
  registros: RegistroRecord[];
  placas: PlacaRecord[];
  personas: PersonaRecord[];
  usuario: string;
  tipo: string;
  stats: { total: number; pendientes: number; aprobados: number; negados: number };
  items: ItemRecord[];
  finDeSemana: FinDeSemanaRecord[];
  admins: AdminFullRecord[];
  highlightId?: string;
}

export default function DashboardContent({ registros, placas, personas, usuario, tipo, stats, items, finDeSemana, admins, highlightId }: Props) {
  const isPorteria  = tipo === 'Porteria';
  const isAutoriza  = tipo === 'Autoriza';
  const [tab, setTab] = useState<Tab>(isAutoriza ? 'resumen' : 'registros');

  const isSuperadmin = tipo === 'Superadmin';

  const pendientesCount =
    placas.filter(p => !p.autorizado && p.estado !== 'RECHAZADO').length +
    personas.filter(p => !p.autorizado && p.estado !== 'RECHAZADO').length;

  const visitantesPendientes = pendientesCount;

  return (
    <>
      {(isAutoriza || tipo === 'Superadmin') && <NotificationBell />}

      {/* Tab switcher */}
      <div className="db-tabs" style={{ marginBottom: 24 }}>
        <button
          type="button"
          className={`db-tab${tab === 'registros' ? ' active' : ''}`}
          onClick={() => setTab('registros')}
        >
          Registros de visitas
          <span className="db-tab-count">{stats.total}</span>
        </button>
        <button
          type="button"
          className={`db-tab${tab === 'visitantes' ? ' active' : ''}${visitantesPendientes > 0 ? ' has-pending' : ''}`}
          onClick={() => setTab('visitantes')}
        >
          Visitantes
          <span className="db-tab-count">{placas.length + personas.length}</span>
          {pendientesCount > 0 && (
            <span className="db-tab-alert" title={`${pendientesCount} pendiente(s) por autorizar`}>
              {pendientesCount} pendiente{pendientesCount !== 1 ? 's' : ''}
            </span>
          )}
        </button>
        {!isPorteria && (
          <button
            type="button"
            className={`db-tab${tab === 'registrar' ? ' active' : ''}`}
            onClick={() => setTab('registrar')}
          >
            Registrar visitante
          </button>
        )}
        {isAutoriza && (
          <button
            type="button"
            className={`db-tab${tab === 'resumen' ? ' active' : ''}`}
            onClick={() => setTab('resumen')}
          >
            Monitor
          </button>
        )}
        {tipo === 'Superadmin' && (
          <button
            type="button"
            className={`db-tab${tab === 'control' ? ' active' : ''}`}
            onClick={() => setTab('control')}
          >
            Panel de control
          </button>
        )}
        {tipo === 'Superadmin' && (
          <button
            type="button"
            className={`db-tab${tab === 'programacion' ? ' active' : ''}`}
            onClick={() => setTab('programacion')}
          >
            Programación semanal
          </button>
        )}
        {tipo === 'Superadmin' && (
          <button
            type="button"
            className={`db-tab${tab === 'ordenes' ? ' active' : ''}`}
            onClick={() => setTab('ordenes')}
          >
            Órdenes de salida
          </button>
        )}
      </div>

      {tab === 'registros' && (
        <>
          {/* Stats */}
          <div className="db-stats">
            <div className="db-stat-card">
              <span className="db-stat-label">Total registros</span>
              <span className="db-stat-value">{stats.total}</span>
            </div>
            <div className="db-stat-card stat-aprobado">
              <span className="db-stat-label">Aprobados</span>
              <span className="db-stat-value">{stats.aprobados}</span>
            </div>
            <div className="db-stat-card stat-negado">
              <span className="db-stat-label">Negados</span>
              <span className="db-stat-value">{stats.negados}</span>
            </div>
          </div>
          <RegistrosPanel registros={registros} usuario={usuario} tipo={tipo} />
        </>
      )}

      {tab === 'visitantes' && (
        <>
          <div className="db-stats">
            <div className="db-stat-card">
              <span className="db-stat-label">Total visitantes</span>
              <span className="db-stat-value">{placas.length + personas.length}</span>
            </div>
            <div className="db-stat-card stat-pendiente">
              <span className="db-stat-label">Pendientes</span>
              <span className="db-stat-value">{pendientesCount}</span>
            </div>
            <div className="db-stat-card stat-aprobado">
              <span className="db-stat-label">Autorizados</span>
              <span className="db-stat-value">{placas.filter(p => p.autorizado).length + personas.filter(p => p.autorizado).length}</span>
            </div>
            <div className="db-stat-card stat-negado">
              <span className="db-stat-label">Rechazados</span>
              <span className="db-stat-value">{placas.filter(p => p.estado === 'RECHAZADO').length + personas.filter(p => p.estado === 'RECHAZADO').length}</span>
            </div>
          </div>
          <VisitantesPanel placas={placas} personas={personas} tipo={tipo} />
        </>
      )}

      {tab === 'resumen' && isAutoriza && (
        <ResumenAutorizaPanel
          placas={placas}
          personas={personas}
          registros={registros}
          usuario={usuario}
          highlightId={highlightId}
        />
      )}
      {tab === 'control' && tipo === 'Superadmin' && (
        <PanelDeControlPanel
          registros={registros}
          placas={placas}
          personas={personas}
          items={items}
          finDeSemana={finDeSemana}
          admins={admins}
        />
      )}
      {tab === 'registrar' && !isPorteria && <RegistrarVisitantePanel />}
      {tab === 'programacion' && tipo === 'Superadmin' && <ProgramacionSemanalPanel />}
      {tab === 'ordenes' && tipo === 'Superadmin' && <OrdenesSalidaPanel items={items} />}
    </>
  );
}
