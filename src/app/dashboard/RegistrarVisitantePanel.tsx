'use client';

import { useState, useTransition } from 'react';
import {
  IconUser,
  IconIdCard,
  IconCar,
  IconArrow,
  IconCheck,
} from '@/components/icons';
import { submitVisitorRequest } from '@/app/actions';
import type { VisitorResult } from '@/app/actions';

/* ── Local icons ── */
function IconWalk() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13" cy="4" r="1.5" /><path d="M10 8.5l-2 5.5 3 1 1 5" />
      <path d="M10 8.5l2.5-1 2 3-3 2" /><path d="M14.5 10.5l2 5-3-1" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 2h6a1 1 0 0 1 1 1v1H8V3a1 1 0 0 1 1-1z" /><rect x="4" y="4" width="16" height="18" rx="2" />
      <path d="M8 11h8M8 15h5" />
    </svg>
  );
}

/* ── Section divider ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '24px 0 16px',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--g-ink-3)',
        whiteSpace: 'nowrap',
      }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--g-line)' }} />
    </div>
  );
}

/* ── Field error ── */
function FieldError({ id, msg }: { id: string; msg: string }) {
  return (
    <span className="field-error" id={id} role="alert">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
      </svg>
      {msg}
    </span>
  );
}

/* ── Shared textarea style ── */
const textareaStyle: React.CSSProperties = {
  width: '100%', resize: 'vertical', padding: '12px 14px',
  borderRadius: 12, border: '1.5px solid var(--g-line)',
  background: 'var(--g-paper)', color: 'var(--g-ink)',
  fontSize: 15, fontFamily: 'inherit', lineHeight: 1.5,
  outline: 'none', transition: 'border-color .15s, box-shadow .15s',
};

export default function RegistrarVisitantePanel() {
  const [cedula, setCedula]                     = useState('');
  const [nombre, setNombre]                     = useState('');
  const [tipoTransporte, setTipoTransporte]     = useState<'vehiculo' | 'peaton'>('vehiculo');
  const [placa, setPlaca]                       = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [motivoVisita, setMotivoVisita]         = useState('');
  const [acompanantes, setAcompanantes]         = useState<{ cedula: string; nombre: string }[]>([]);
  const [errors, setErrors]                     = useState<Record<string, string>>({});
  const [result, setResult]                     = useState<VisitorResult | null>(null);
  const [isPending, startTransition]            = useTransition();

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!cedula.trim())                                   e.cedula           = 'Ingresa el número de cédula';
    else if (!/^\d{5,12}$/.test(cedula.trim()))           e.cedula           = 'Solo números, entre 5 y 12 dígitos';
    if (!nombre.trim())                                   e.nombre           = 'Ingresa el nombre completo';
    else if (nombre.trim().length < 4)                    e.nombre           = 'Nombre demasiado corto';
    if (tipoTransporte === 'vehiculo') {
      if (!placa.trim())                                  e.placa            = 'Ingresa la placa del vehículo';
      else if (!/^[A-Za-z0-9]{5,7}$/.test(placa.trim())) e.placa            = 'Formato inválido (ej: ABC123)';
    }
    if (!motivoVisita.trim())                             e.motivoVisita     = 'Indica el motivo de la visita';
    if (!fechaVencimiento) {
      e.fechaVencimiento = 'Indica la fecha de vencimiento';
    }
    acompanantes.forEach((ac, i) => {
      if (!ac.cedula.trim())                              e[`ac_cedula_${i}`] = 'Ingresa el número de cédula';
      else if (!/^\d{5,12}$/.test(ac.cedula.trim()))      e[`ac_cedula_${i}`] = 'Solo números, entre 5 y 12 dígitos';
      if (!ac.nombre.trim())                              e[`ac_nombre_${i}`] = 'Ingresa el nombre completo';
      else if (ac.nombre.trim().length < 4)               e[`ac_nombre_${i}`] = 'Nombre demasiado corto';
    });
    return e;
  }

  function addAcompanante() {
    setAcompanantes(prev => [...prev, { cedula: '', nombre: '' }]);
  }
  function removeAcompanante(idx: number) {
    setAcompanantes(prev => prev.filter((_, i) => i !== idx));
    setErrors(prev => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith('ac_')) next[k] = v;
      }
      return next;
    });
  }
  function updateAcompanante(idx: number, field: 'cedula' | 'nombre', value: string) {
    setAcompanantes(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('[handleSubmit] Iniciando validación', {
      cedula, nombre, placa, motivoVisita, fechaVencimiento,
      tipoTransporte, acompanantes,
    });
    const errs = validate();
    console.log('[handleSubmit] Errores encontrados:', errs);
    if (Object.keys(errs).length) {
      setErrors(errs);
      console.log('[handleSubmit] Validación fallida, mostrando errores');
      return;
    }
    console.log('[handleSubmit] Validación exitosa, enviando solicitud');
    setErrors({});
    startTransition(async () => {
      const res = await submitVisitorRequest(
        cedula, nombre, placa, motivoVisita, acompanantes, tipoTransporte,
        fechaVencimiento ? `${fechaVencimiento}T17:00` : undefined,
        true, // requireSession: este formulario siempre corre autenticado
      );
      console.log('[handleSubmit] Respuesta de servidor:', res);
      setResult(res);
    });
  }

  function reset() {
    setResult(null);
    setCedula(''); setNombre(''); setPlaca('');
    setTipoTransporte('vehiculo'); setFechaVencimiento('');
    setMotivoVisita(''); setAcompanantes([]); setErrors({});
  }

  function fillTestData() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const isoDate = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

    setCedula('1121917552');
    setNombre('Sergio Ricardo Oliveros');
    setPlaca('HJV606');
    setMotivoVisita('Visita Comercial - Test');
    setFechaVencimiento(isoDate);
    setAcompanantes([
      { cedula: '1018203040', nombre: 'Juan Pérez García' },
      { cedula: '1015487923', nombre: 'María López Rodríguez' },
      { cedula: '1098765432', nombre: 'Carlos Gómez Martínez' },
    ]);
    setErrors({});
  }

  /* ── Success state ── */
  if (result?.status === 'PENDIENTE') {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div className="db-card db-form-result-pad">
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--g-green-soft)', color: 'var(--g-green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <IconCheck />
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 28, fontWeight: 600, color: 'var(--g-green-dark)', marginBottom: 10 }}>
            ¡Visita registrada!
          </h3>
          <p style={{ color: 'var(--g-ink-2)', marginBottom: 6 }}>
            La solicitud fue creada y está pendiente de revisión.
          </p>
          <p style={{ fontSize: 13, color: 'var(--g-ink-3)', marginBottom: 32 }}>
            Cédula: <strong>{cedula}</strong>
            {tipoTransporte === 'vehiculo' && placa && <> · Placa: <strong>{placa.toUpperCase()}</strong></>}
            {tipoTransporte === 'peaton' && <> · <strong>A pie</strong></>}
          </p>
          <button className="btn btn-primary" onClick={reset}>Registrar otra visita</button>
        </div>
      </div>
    );
  }

  /* ── Session expired state ── */
  if (result?.status === 'SESSION_EXPIRED') {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div className="db-card db-form-result-pad">
          <h3 style={{ color: 'var(--g-coral)', marginBottom: 8 }}>Tu sesión expiró</h3>
          <p style={{ color: 'var(--g-ink-2)', marginBottom: 24 }}>
            Por seguridad tu sesión se cerró y no se pudo identificar quién registra la visita.
            Vuelve a iniciar sesión para registrarla — no se creó ningún registro.
          </p>
          <a className="btn btn-primary" href="/login">Iniciar sesión</a>
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (result?.status === 'ERROR') {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div className="db-card db-form-result-pad">
          <h3 style={{ color: 'var(--g-coral)', marginBottom: 8 }}>Error de conexión</h3>
          <p style={{ color: 'var(--g-ink-2)', marginBottom: 24 }}>{result.message}</p>
          <button className="btn btn-ghost" onClick={reset}>Volver al formulario</button>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="db-card">

        {/* Card header */}
        <div className="db-form-header-pad">
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--g-green-soft)', color: 'var(--g-green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <IconClipboard />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--g-green)', margin: '0 0 3px' }}>
              Control de acceso
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, fontWeight: 600, color: 'var(--g-green-dark)', margin: 0, lineHeight: 1 }}>
              Registrar visitante
            </h2>
          </div>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate className="db-form-body-pad">

          <SectionLabel>Datos personales</SectionLabel>

          {/* Cédula + Nombre — two columns on wide screens */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 20px' }}>
            <div className="field">
              <label className="field-label" htmlFor="rv-cedula">Cédula</label>
              <div className="field-input-wrap">
                <input id="rv-cedula" type="text" inputMode="numeric" pattern="\d*"
                  placeholder="Ej: 1018203040" value={cedula}
                  onChange={e => setCedula(e.target.value.replace(/\D/g, ''))}
                  autoComplete="off" disabled={isPending}
                  aria-describedby={errors.cedula ? 'rv-err-cedula' : undefined} />
                <span className="field-icon"><IconIdCard width={18} height={18} /></span>
              </div>
              {errors.cedula && <FieldError id="rv-err-cedula" msg={errors.cedula} />}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="rv-nombre">Nombre completo</label>
              <div className="field-input-wrap">
                <input id="rv-nombre" type="text" placeholder="Nombres y apellidos"
                  value={nombre} onChange={e => setNombre(e.target.value)}
                  autoComplete="off" disabled={isPending}
                  aria-describedby={errors.nombre ? 'rv-err-nombre' : undefined} />
                <span className="field-icon"><IconUser width={18} height={18} /></span>
              </div>
              {errors.nombre && <FieldError id="rv-err-nombre" msg={errors.nombre} />}
            </div>
          </div>

          <SectionLabel>Transporte</SectionLabel>

          {/* Tipo transporte toggle */}
          <div className="field">
            <label className="field-label">¿Cómo llega el visitante?</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
              {([
                { id: 'vehiculo', label: 'Vehículo', icon: <IconCar width={17} height={17} /> },
                { id: 'peaton',   label: 'Persona',  icon: <IconWalk /> },
              ] as const).map(({ id, label, icon }) => (
                <button key={id} type="button" disabled={isPending}
                  onClick={() => {
                    setTipoTransporte(id);
                    if (id === 'peaton') { setPlaca(''); setErrors(p => { const n = { ...p }; delete n.placa; return n; }); }
                  }}
                  style={{
                    padding: '11px 12px',
                    border: `1.5px solid ${tipoTransporte === id ? 'var(--g-green)' : 'var(--g-line)'}`,
                    borderRadius: 12,
                    background: tipoTransporte === id ? 'var(--g-green-soft)' : 'var(--g-paper)',
                    color: tipoTransporte === id ? 'var(--g-green-dark)' : 'var(--g-ink-2)',
                    fontWeight: tipoTransporte === id ? 700 : 500,
                    fontSize: 14, cursor: isPending ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all .15s',
                  }}
                >{icon}{label}</button>
              ))}
            </div>
          </div>

          {/* Placa — only when vehiculo */}
          {tipoTransporte === 'vehiculo' && (
            <div className="field" style={{ maxWidth: 260 }}>
              <label className="field-label" htmlFor="rv-placa">Placa del vehículo</label>
              <div className="field-input-wrap">
                <input id="rv-placa" type="text" placeholder="Ej: ABC123"
                  value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())}
                  autoComplete="off" maxLength={7} disabled={isPending}
                  aria-describedby={errors.placa ? 'rv-err-placa' : undefined} />
                <span className="field-icon"><IconCar width={18} height={18} /></span>
              </div>
              {errors.placa && <FieldError id="rv-err-placa" msg={errors.placa} />}
            </div>
          )}

          <SectionLabel>Detalle de la visita</SectionLabel>

          {/* Motivo + fecha — two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 20px' }}>
            <div className="field">
              <label className="field-label" htmlFor="rv-motivo">Motivo de la visita</label>
              <textarea id="rv-motivo" placeholder="Describe brevemente el motivo…"
                value={motivoVisita} onChange={e => setMotivoVisita(e.target.value)}
                rows={3} disabled={isPending}
                aria-describedby={errors.motivoVisita ? 'rv-err-motivo' : undefined}
                style={textareaStyle}
              />
              {errors.motivoVisita && <FieldError id="rv-err-motivo" msg={errors.motivoVisita} />}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="rv-vence">
                Fecha de vencimiento
                <span style={{ fontWeight: 400, color: 'var(--g-ink-3)', marginLeft: 6 }}>
                  (vence a las 5:00 PM)
                </span>
              </label>
              <div className="field-input-wrap">
                <input id="rv-vence" type="date" value={fechaVencimiento}
                  onChange={e => setFechaVencimiento(e.target.value)}
                  min={(() => { const n = new Date(); const p = (x: number) => String(x).padStart(2,'0'); return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`; })()} disabled={isPending}
                  style={{ paddingRight: 40 }}
                  aria-describedby={errors.fechaVencimiento ? 'rv-err-vence' : undefined} />
                <span className="field-icon"><IconCalendar /></span>
              </div>
              {errors.fechaVencimiento && <FieldError id="rv-err-vence" msg={errors.fechaVencimiento} />}
            </div>
          </div>

          {/* Acompañantes */}
          {acompanantes.length > 0 && <SectionLabel>Acompañantes</SectionLabel>}
          <div style={{ marginBottom: acompanantes.length ? 0 : 4 }}>
            {acompanantes.map((ac, i) => (
              <div key={i} style={{
                background: 'var(--g-green-soft)', border: '1.5px solid rgba(122,157,74,.3)',
                borderRadius: 12, padding: '14px 16px 6px', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--g-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Acompañante {i + 1}
                  </span>
                  <button type="button" onClick={() => removeAcompanante(i)} disabled={isPending}
                    style={{ background: 'none', border: 'none', color: 'var(--g-coral)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                    aria-label={`Eliminar acompañante ${i + 1}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    Eliminar
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 16px' }}>
                  <div className="field">
                    <label className="field-label" htmlFor={`rv-ac-cedula-${i}`}>Cédula</label>
                    <div className="field-input-wrap">
                      <input id={`rv-ac-cedula-${i}`} type="text" inputMode="numeric" pattern="\d*"
                        placeholder="Ej: 1018203040" value={ac.cedula}
                        onChange={e => updateAcompanante(i, 'cedula', e.target.value.replace(/\D/g, ''))}
                        autoComplete="off" disabled={isPending}
                        aria-describedby={errors[`ac_cedula_${i}`] ? `rv-err-ac-cedula-${i}` : undefined} />
                      <span className="field-icon"><IconIdCard width={18} height={18} /></span>
                    </div>
                    {errors[`ac_cedula_${i}`] && <FieldError id={`rv-err-ac-cedula-${i}`} msg={errors[`ac_cedula_${i}`]} />}
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor={`rv-ac-nombre-${i}`}>Nombre completo</label>
                    <div className="field-input-wrap">
                      <input id={`rv-ac-nombre-${i}`} type="text" placeholder="Nombres y apellidos"
                        value={ac.nombre} onChange={e => updateAcompanante(i, 'nombre', e.target.value)}
                        autoComplete="off" disabled={isPending}
                        aria-describedby={errors[`ac_nombre_${i}`] ? `rv-err-ac-nombre-${i}` : undefined} />
                      <span className="field-icon"><IconUser width={18} height={18} /></span>
                    </div>
                    {errors[`ac_nombre_${i}`] && <FieldError id={`rv-err-ac-nombre-${i}`} msg={errors[`ac_nombre_${i}`]} />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add companion + submit row */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 20 }}>
            <button type="button" onClick={addAcompanante} disabled={isPending}
              style={{
                flexShrink: 0, background: 'transparent',
                border: '1.5px dashed rgba(122,157,74,.5)', borderRadius: 12,
                padding: '13px 20px', color: 'var(--g-green-dark)',
                fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'border-color .2s, background .2s', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--g-green)'; b.style.background = 'var(--g-green-soft)'; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'rgba(122,157,74,.5)'; b.style.background = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
              Agregar acompañante
            </button>

            <button type="submit" disabled={isPending}
              className={`btn btn-primary btn-block login-submit${isPending ? ' loading' : ''}`}
              style={{ flex: 1 }}>
              <span className="label">Registrar visita</span>
              <IconArrow width={18} height={18} className="arrow" aria-hidden="true" />
              <div className="spinner" role="status" aria-label="Registrando…" />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
