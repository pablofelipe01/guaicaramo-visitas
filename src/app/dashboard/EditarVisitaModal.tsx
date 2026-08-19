'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { editarVisitaPendiente } from '@/app/actions';

/** Mismas áreas que ofrece el formulario de registro. */
const AREAS_DISPONIBLES = [
  'Administración',
  'Agronómico',
  'Báscula y almacén',
  'Fondo de empleados',
  'Logistica y transporte',
  'Planta de beneficio',
  'Sirius',
];

const SUBAREAS_ADMIN = [
  'Ambiental',
  'Contabilidad',
  'Ganadería',
  'Gestión humana',
  'Planeación y formación',
  'Taller agrícola',
  'TIC',
];

export interface VisitaEditable {
  id: string;
  tipo: 'vehiculo' | 'persona';
  placa?: string;
  conductor?: string;
  nombre?: string;
  cargo?: string;
  cedula?: string;
  vence?: string;
  notas?: string;
  motivo_visita?: string;
  areas_destino?: string;
}

/** Convierte un ISO a "YYYY-MM-DDTHH:mm" en hora de la finca, para <input datetime-local>. */
function toDatetimeLocal(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const hour = g('hour') === '24' ? '00' : g('hour');
  return `${g('year')}-${g('month')}-${g('day')}T${hour}:${g('minute')}`;
}

/** Separa "Área - Subárea" en sus dos partes. */
function splitArea(valor?: string): { area: string; sub: string } {
  if (!valor) return { area: '', sub: '' };
  const exacta = AREAS_DISPONIBLES.find(a => a === valor);
  if (exacta) return { area: exacta, sub: '' };
  const base = AREAS_DISPONIBLES.find(a => valor.startsWith(`${a} - `));
  if (base) return { area: base, sub: valor.slice(base.length + 3).trim() };
  return { area: '', sub: '' };
}

interface Props {
  visita: VisitaEditable;
  onClose: () => void;
  /** Se llama tras un guardado exitoso para refrescar la tabla. */
  onSaved: () => void;
}

export default function EditarVisitaModal({ visita, onClose, onSaved }: Props) {
  const esVehiculo = visita.tipo === 'vehiculo';
  const areaInicial = splitArea(visita.areas_destino);

  const [placa, setPlaca]           = useState(visita.placa ?? '');
  const [conductor, setConductor]   = useState(visita.conductor ?? '');
  const [nombre, setNombre]         = useState(visita.nombre ?? '');
  const [cargo, setCargo]           = useState(visita.cargo ?? '');
  const [cedula, setCedula]         = useState(visita.cedula ?? '');
  const [vence, setVence]           = useState(toDatetimeLocal(visita.vence));
  const [notas, setNotas]           = useState(visita.notas ?? '');
  const [motivo, setMotivo]         = useState(visita.motivo_visita ?? '');
  const [area, setArea]             = useState(areaInicial.area);
  const [subArea, setSubArea]       = useState(areaInicial.sub);

  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setErrors({});
    startTransition(async () => {
      const res = await editarVisitaPendiente(visita.id, visita.tipo, {
        cedula,
        vence,
        notas,
        motivoVisita: motivo,
        areaDestino: area,
        subAreaAdmin: area === 'Administración' ? subArea : '',
        ...(esVehiculo ? { placa, conductor } : { nombre, cargo }),
      });
      if (!res.ok) {
        setError(res.message);
        if (res.errors) setErrors(res.errors);
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="db-modal-overlay" onClick={onClose}>
      <div
        className="db-modal"
        style={{ maxWidth: 560, gap: 0, maxHeight: '88vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h3 className="db-modal-title" style={{ marginBottom: 0 }}>Editar visita pendiente</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: 'var(--g-ink-3)', padding: 4 }}
          >
            ×
          </button>
        </div>

        <p style={{ margin: '6px 0 18px', fontSize: 13, color: 'var(--g-ink-3)' }}>
          Solo se pueden editar solicitudes que aún están pendientes. Cada cambio queda registrado en la auditoría.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {esVehiculo ? (
            <>
              <Campo label="Placa" error={errors.placa}>
                <input
                  style={inputStyle}
                  value={placa}
                  onChange={e => setPlaca(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={7}
                />
              </Campo>
              <Campo label="Conductor" error={errors.conductor}>
                <input style={inputStyle} value={conductor} onChange={e => setConductor(e.target.value)} />
              </Campo>
            </>
          ) : (
            <>
              <Campo label="Nombre" error={errors.nombre}>
                <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} />
              </Campo>
              <Campo label="Cargo" error={errors.cargo}>
                <input style={inputStyle} value={cargo} onChange={e => setCargo(e.target.value)} />
              </Campo>
            </>
          )}

          <Campo label="Cédula" error={errors.cedula}>
            <input
              style={inputStyle}
              value={cedula}
              inputMode="numeric"
              onChange={e => setCedula(e.target.value.replace(/\D/g, ''))}
              maxLength={12}
            />
          </Campo>

          <Campo label="Vence" error={errors.vence}>
            <input
              style={inputStyle}
              type="datetime-local"
              value={vence}
              onChange={e => setVence(e.target.value)}
            />
          </Campo>

          <Campo label="Área destino" error={errors.areaDestino}>
            <select
              style={inputStyle}
              value={area}
              onChange={e => { setArea(e.target.value); setSubArea(''); }}
            >
              <option value="">Sin área</option>
              {AREAS_DISPONIBLES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </Campo>

          {area === 'Administración' && (
            <Campo label="Subárea de administración" error={errors.subAreaAdmin}>
              <select style={inputStyle} value={subArea} onChange={e => setSubArea(e.target.value)}>
                <option value="">Selecciona la subárea…</option>
                {SUBAREAS_ADMIN.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Campo>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <Campo label="Motivo de la visita" error={errors.motivoVisita}>
            <input style={inputStyle} value={motivo} onChange={e => setMotivo(e.target.value)} />
          </Campo>
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="db-modal-label">Notas</label>
          <textarea
            className="db-modal-textarea"
            value={notas}
            onChange={e => setNotas(e.target.value)}
          />
        </div>

        {error && <div className="db-modal-error" style={{ marginTop: 14 }}>{error}</div>}

        <div className="db-modal-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={isPending}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="db-modal-label">{label}</label>
      {children}
      {error && <div style={{ fontSize: 12, color: 'var(--g-coral)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--g-line)',
  borderRadius: 10,
  fontFamily: 'inherit',
  fontSize: 14,
  color: 'var(--g-ink)',
  background: 'var(--g-cream)',
  outline: 'none',
};
