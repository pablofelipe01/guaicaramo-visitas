'use client';

import { useState } from 'react';
import type { RegistroRecord, PlacaRecord, PersonaRecord } from '@/lib/airtable';
import RegistrosPanel from './RegistrosPanel';
import RegistrarVisitantePanel from './RegistrarVisitantePanel';
import PlacasPanel from './PlacasPanel';
import PersonasPanel from './PersonasPanel';

type Tab = 'registros' | 'placas' | 'personas' | 'registrar';

interface Props {
  registros: RegistroRecord[];
  placas: PlacaRecord[];
  personas: PersonaRecord[];
  usuario: string;
  tipo: string;
  stats: { total: number; pendientes: number; aprobados: number; negados: number };
}

export default function DashboardContent({ registros, placas, personas, usuario, tipo, stats }: Props) {
  const [tab, setTab] = useState<Tab>('registros');

  return (
    <>
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
          className={`db-tab${tab === 'placas' ? ' active' : ''}`}
          onClick={() => setTab('placas')}
        >
          Vehículos
          <span className="db-tab-count">{placas.length}</span>
        </button>
        <button
          type="button"
          className={`db-tab${tab === 'personas' ? ' active' : ''}`}
          onClick={() => setTab('personas')}
        >
          Personas
          <span className="db-tab-count">{personas.length}</span>
        </button>
        <button
          type="button"
          className={`db-tab${tab === 'registrar' ? ' active' : ''}`}
          onClick={() => setTab('registrar')}
        >
          Registrar visitante
        </button>
      </div>

      {tab === 'registros' && (
        <>
          {/* Stats */}
          <div className="db-stats">
            <div className="db-stat-card">
              <span className="db-stat-label">Total registros</span>
              <span className="db-stat-value">{stats.total}</span>
            </div>
            <div className="db-stat-card stat-pendiente">
              <span className="db-stat-label">Pendientes</span>
              <span className="db-stat-value">{stats.pendientes}</span>
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

      {tab === 'placas' && (
        <>
          <div className="db-stats">
            <div className="db-stat-card">
              <span className="db-stat-label">Total vehículos</span>
              <span className="db-stat-value">{placas.length}</span>
            </div>
            <div className="db-stat-card stat-pendiente">
              <span className="db-stat-label">Pendientes</span>
              <span className="db-stat-value">{placas.filter(p => !p.autorizado).length}</span>
            </div>
            <div className="db-stat-card stat-aprobado">
              <span className="db-stat-label">Autorizados</span>
              <span className="db-stat-value">{placas.filter(p => p.autorizado).length}</span>
            </div>
          </div>
          <PlacasPanel placas={placas} tipo={tipo} />
        </>
      )}

      {tab === 'personas' && (
        <>
          <div className="db-stats">
            <div className="db-stat-card">
              <span className="db-stat-label">Total personas</span>
              <span className="db-stat-value">{personas.length}</span>
            </div>
            <div className="db-stat-card stat-pendiente">
              <span className="db-stat-label">Pendientes</span>
              <span className="db-stat-value">{personas.filter(p => !p.autorizado).length}</span>
            </div>
            <div className="db-stat-card stat-aprobado">
              <span className="db-stat-label">Autorizadas</span>
              <span className="db-stat-value">{personas.filter(p => p.autorizado).length}</span>
            </div>
          </div>
          <PersonasPanel personas={personas} tipo={tipo} />
        </>
      )}

      {tab === 'registrar' && <RegistrarVisitantePanel />}
    </>
  );
}
