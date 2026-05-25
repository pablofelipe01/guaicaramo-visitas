'use client';

import { useState, useRef, useTransition } from 'react';
import type { ItemRecord } from '@/lib/airtable';
import { submitOrdenSalida } from '@/app/actions';

/* -- Icons ----------------------------------------------------------------- */

function IconMic({ size = 14, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="1" width="6" height="11" rx="3" fill={filled ? 'currentColor' : 'none'} />
      <path d="M5 10a7 7 0 0 0 14 0M12 19v4M8 23h8" />
    </svg>
  );
}

function RecDot() {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: 'currentColor', flexShrink: 0,
      animation: 'db-pulse 1s ease-in-out infinite',
    }} />
  );
}

function DictarBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 6,
        border: `1.5px solid ${active ? '#e53935' : 'var(--g-line)'}`,
        background: active ? 'rgba(229,57,53,.07)' : 'transparent',
        color: active ? '#e53935' : 'var(--g-ink-3)',
        fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
        whiteSpace: 'nowrap', transition: 'all .15s',
      }}
    >
      <IconMic size={12} filled={active} />
      {active ? 'Detener' : 'Dictar'}
      {active && <RecDot />}
    </button>
  );
}

/* -- Voice hook ------------------------------------------------------------ */

type RecTarget = 'concepto' | 'notas';

function useVoice(onTranscript: (target: RecTarget, text: string) => void) {
  const [activeTarget, setActiveTarget] = useState<RecTarget | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  function toggle(target: RecTarget) {
    if (activeTarget === target) {
      recRef.current?.stop();
      recRef.current = null;
      setActiveTarget(null);
      return;
    }
    recRef.current?.stop();
    recRef.current = null;
    setActiveTarget(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz.\nUsa Chrome o Edge.'); return; }
    const rec = new SR();
    rec.lang = 'es-CO';
    rec.continuous = true;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = Array.from(e.results as any[])
        .slice(e.resultIndex)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((r: any) => r.isFinal)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript as string)
        .join(' ').trim();
      if (text) onTranscript(target, text);
    };
    rec.onend  = () => { setActiveTarget(null); recRef.current = null; };
    rec.onerror = () => { setActiveTarget(null); recRef.current = null; };
    rec.start();
    recRef.current = rec;
    setActiveTarget(target);
  }

  return { activeTarget, toggle };
}

interface FormState {
  nombre: string;
  cedula: string;
  concepto: string;
  destino: string;
  area: string;
  notas: string;
}

const EMPTY_FORM: FormState = {
  nombre: '',
  cedula: '',
  concepto: '',
  destino: '',
  area: '',
  notas: '',
};

interface Props {
  items: ItemRecord[];
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function OrdenesSalidaPanel({ items: initial }: Props) {
  const [ordenes, setOrdenes] = useState<ItemRecord[]>(initial);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const { activeTarget, toggle } = useVoice((target, text) => {
    setForm(prev => ({
      ...prev,
      [target]: prev[target] ? prev[target] + ' ' + text : text,
    }));
  });

  /** Calcula el siguiente número de orden basado en el máximo existente. */
  function nextNumero(): string {
    const max = ordenes.reduce((acc, item) => {
      const n = parseInt(item.numero ?? '0', 10);
      return isNaN(n) ? acc : Math.max(acc, n);
    }, 0);
    return String(max + 1);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setMsg({ ok: false, text: 'El nombre es obligatorio.' }); return; }
    if (!form.cedula.trim()) { setMsg({ ok: false, text: 'La cédula es obligatoria.' }); return; }

    const numero = nextNumero();

    startTransition(async () => {
      const result = await submitOrdenSalida({
        numero,
        nombre:         form.nombre.trim(),
        cedula:         form.cedula.trim(),
        concepto:       form.concepto.trim()       || undefined,
        destino:        form.destino.trim()        || undefined,
        area:           form.area.trim()           || undefined,
        notas:          form.notas.trim()          || undefined,
      });

      if (!result.ok) {
        setMsg({ ok: false, text: result.message ?? 'Error al guardar.' });
        return;
      }

      // Prepend optimistic record to list
      const newItem: ItemRecord = {
        id: result.id ?? `tmp-${Date.now()}`,
        numero,
        nombre:         form.nombre.trim(),
        cedula:         form.cedula.trim(),
        concepto:       form.concepto.trim()       || undefined,
        destino:        form.destino.trim()        || undefined,
        area:           form.area.trim()           || undefined,
        autorizado:     false,
        usado:          false,
        notas:          form.notas.trim()          || undefined,
      };
      setOrdenes(prev => [newItem, ...prev]);
      setMsg({ ok: true, text: `Orden #${numero} guardada correctamente.` });
      setForm(EMPTY_FORM);
      setShowForm(false);
    });
  }

  function handleCancel() {
    setForm(EMPTY_FORM);
    setMsg(null);
    setShowForm(false);
  }

  return (
    <div className="db-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div
        className="db-form-header-pad"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--g-green-dark)' }}>
          Órdenes de salida
          <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 13, color: 'var(--g-ink-3)' }}>
            ({ordenes.length})
          </span>
        </span>
        {!showForm && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: 13, padding: '6px 16px' }}
            onClick={() => { setShowForm(true); setMsg(null); }}
          >
            + Nueva orden
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ borderBottom: '1px solid var(--g-line)', background: 'var(--g-green-soft)' }}>
          <form onSubmit={handleSubmit}>
            {/* Section: identificación */}
            <div style={{ padding: '18px 24px 0' }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--g-ink-3)', marginBottom: 12 }}>
                Identificación
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label className="field-label">Nombre *</label>
                  <div className="field-input-wrap">
                    <input className="field-input" name="nombre" value={form.nombre}
                      onChange={handleChange} placeholder="Nombre completo" autoComplete="off" />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Cédula *</label>
                  <div className="field-input-wrap">
                    <input className="field-input" name="cedula" value={form.cedula}
                      onChange={handleChange} placeholder="Número de cédula" autoComplete="off" />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Área</label>
                  <div className="field-input-wrap">
                    <input className="field-input" name="area" value={form.area}
                      onChange={handleChange} placeholder="ej. Mantenimiento" autoComplete="off" />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Destino</label>
                  <div className="field-input-wrap">
                    <input className="field-input" name="destino" value={form.destino}
                      onChange={handleChange} placeholder="ej. Taller Cabuyaro" autoComplete="off" />
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--g-line)', margin: '16px 0' }} />

            {/* Section: descripción */}
            <div style={{ padding: '0 24px 18px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--g-ink-3)', marginBottom: 12 }}>
                Descripción
              </p>

              <div className="field" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="field-label" style={{ margin: 0 }}>Concepto <span style={{ color: 'var(--g-ink-3)', fontWeight: 400 }}>(ítems que salen)</span></label>
                  <DictarBtn active={activeTarget === 'concepto'} onClick={() => toggle('concepto')} />
                </div>
                <div className="field-input-wrap">
                  <textarea
                    className="field-input"
                    name="concepto"
                    value={form.concepto}
                    onChange={handleChange}
                    placeholder="ej. Taladro Bosch GSB 18V con batería y cargador."
                    rows={3}
                    style={{
                      resize: 'vertical',
                      border: activeTarget === 'concepto' ? '1.5px solid #e53935' : undefined,
                      transition: 'border .15s',
                    }}
                  />
                </div>
              </div>

              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="field-label" style={{ margin: 0 }}>Notas adicionales</label>
                  <DictarBtn active={activeTarget === 'notas'} onClick={() => toggle('notas')} />
                </div>
                <div className="field-input-wrap">
                  <textarea
                    className="field-input"
                    name="notas"
                    value={form.notas}
                    onChange={handleChange}
                    placeholder="Observaciones..."
                    rows={2}
                    style={{
                      resize: 'vertical',
                      border: activeTarget === 'notas' ? '1.5px solid #e53935' : undefined,
                      transition: 'border .15s',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 24px 18px', borderTop: '1px solid var(--g-line)', background: 'var(--g-paper)' }}>
              {msg && (
                <div style={{
                  marginBottom: 12, padding: '8px 12px', borderRadius: 8,
                  background: msg.ok ? '#e8f5e9' : '#fce4e4',
                  color: msg.ok ? '#2e7d32' : '#c62828', fontSize: 13,
                }}>
                  {msg.text}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" disabled={isPending} style={{ flex: 1 }}>
                  {isPending ? 'Guardando...' : 'Guardar orden'}
                </button>
                <button type="button" className="btn" onClick={handleCancel} style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="db-form-body-pad">
        {msg && !showForm && (
          <div
            style={{
              marginBottom: 14,
              padding: '8px 12px',
              borderRadius: 8,
              background: msg.ok ? '#e8f5e9' : '#fce4e4',
              color: msg.ok ? '#2e7d32' : '#c62828',
              fontSize: 13,
            }}
          >
            {msg.text}
          </div>
        )}
        {ordenes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--g-ink-3)', fontSize: 14 }}>
            No hay órdenes de salida registradas.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ordenes.map(orden => (
              <div
                key={orden.id}
                style={{
                  border: '1px solid var(--g-line)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  background: 'var(--g-green-soft)',
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    {orden.numero && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--g-leaf)', marginRight: 8 }}>
                        #{orden.numero}
                      </span>
                    )}
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--g-green-dark)' }}>
                      {orden.nombre}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--g-ink-3)', marginLeft: 8 }}>
                      CC {orden.cedula}
                    </span>
                    {orden.area && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          padding: '1px 7px',
                          borderRadius: 10,
                          background: 'rgba(13,177,75,.12)',
                          color: 'var(--g-leaf)',
                        }}
                      >
                        {orden.area}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {orden.autorizado && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: '#e8f5e9',
                          color: '#2e7d32',
                          fontWeight: 600,
                        }}
                      >
                        ✓ Autorizado
                      </span>
                    )}
                    {orden.usado && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: '#e3f2fd',
                          color: '#1565c0',
                          fontWeight: 600,
                        }}
                      >
                        Usado
                      </span>
                    )}
                  </div>
                </div>

                {/* Meta row */}
                <div style={{ fontSize: 12, color: 'var(--g-ink-3)', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginBottom: orden.concepto || orden.notas ? 6 : 0 }}>
                  {orden.destino && <span>→ {orden.destino}</span>}
                  {orden.fecha_salida && <span>Salida: {fmtDate(orden.fecha_salida)}</span>}
                  {orden.fecha_autorizacion && <span>Aut: {fmtDate(orden.fecha_autorizacion)}</span>}
                </div>

                {/* Concepto */}
                {orden.concepto && (
                  <div style={{ fontSize: 13, color: 'var(--g-green-dark)', marginBottom: orden.notas ? 4 : 0 }}>
                    {orden.concepto}
                  </div>
                )}

                {/* Notas */}
                {orden.notas && (
                  <div style={{ fontSize: 12, color: 'var(--g-ink-3)', fontStyle: 'italic' }}>
                    {orden.notas}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
