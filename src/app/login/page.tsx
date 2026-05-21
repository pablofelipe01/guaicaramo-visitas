'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  IconUser,
  IconIdCard,
  IconCar,
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconCheck,
  IconArrow,
} from '@/components/icons';
import { Wordmark } from '@/components/decorations';
import { submitVisitorRequest, adminLoginCedula } from '@/app/actions';
import type { VisitorResult } from '@/app/actions';

// type Mode = 'visitor' | 'admin';

function IconInfo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}
function IconWarn() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function IconWalk() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13" cy="4" r="1.5" />
      <path d="M10 8.5l-2 5.5 3 1 1 5" />
      <path d="M10 8.5l2.5-1 2 3-3 2" />
      <path d="M14.5 10.5l2 5-3-1" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Root page
   ───────────────────────────────────────────────────────────── */
export default function LoginPage() {
  return (
    <div className="login">
      {/* ── Form panel ── */}
      <div className="login-form-wrap">
        <div className="login-form">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <Wordmark />
          </div>

          <Link href="/" className="login-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            Volver al inicio
          </Link>

          {/* Mode switcher */}
          {/* <div className="login-mode-tabs" role="tablist" aria-label="Tipo de acceso">
            <button
              role="tab"
              aria-selected={mode === 'visitor'}
              className={'login-mode-tab' + (mode === 'visitor' ? ' active' : '')}
              onClick={() => setMode('visitor')}
            >
              Solicitar ingreso
            </button>
            <button
              role="tab"
              aria-selected={mode === 'admin'}
              className={'login-mode-tab' + (mode === 'admin' ? ' active' : '')}
              onClick={() => setMode('admin')}
            >
              Acceso administrativo
            </button>
          </div> */}

          {/* mode === 'visitor' ? <VisitorForm /> : */ <AdminForm />}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Visitor / Request form
   ───────────────────────────────────────────────────────────── */
function VisitorForm() {
  const [cedula, setCedula] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipoTransporte, setTipoTransporte] = useState<'vehiculo' | 'peaton'>('vehiculo');
  const [placa, setPlaca] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [motivoVisita, setMotivoVisita] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<VisitorResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [acompanantes, setAcompanantes] = useState<{ cedula: string; nombre: string }[]>([]);
  const [autorizaDatos, setAutorizaDatos] = useState(false);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!cedula.trim()) {
      e.cedula = 'Ingresa tu número de cédula';
    } else if (!/^\d{5,12}$/.test(cedula.trim())) {
      e.cedula = 'Solo números, entre 5 y 12 dígitos';
    }
    if (!nombre.trim()) {
      e.nombre = 'Ingresa tu nombre completo';
    } else if (nombre.trim().length < 4) {
      e.nombre = 'Nombre demasiado corto';
    }
    if (tipoTransporte === 'vehiculo') {
      if (!placa.trim()) {
        e.placa = 'Ingresa la placa del vehículo';
      } else if (!/^[A-Za-z0-9]{5,7}$/.test(placa.trim())) {
        e.placa = 'Formato de placa inválido (ej: ABC123)';
      }
    }
    if (!motivoVisita.trim()) {
      e.motivoVisita = 'Indica el motivo de tu visita';
    }
    if (!fechaVencimiento) {
      e.fechaVencimiento = 'Indica la fecha de vencimiento de la visita';
    }
    acompanantes.forEach((ac, i) => {
      if (!ac.cedula.trim()) {
        e[`ac_cedula_${i}`] = 'Ingresa el número de cédula';
      } else if (!/^\d{5,12}$/.test(ac.cedula.trim())) {
        e[`ac_cedula_${i}`] = 'Solo números, entre 5 y 12 dígitos';
      }
      if (!ac.nombre.trim()) {
        e[`ac_nombre_${i}`] = 'Ingresa el nombre completo';
      } else if (ac.nombre.trim().length < 4) {
        e[`ac_nombre_${i}`] = 'Nombre demasiado corto';
      }
    });
    if (!autorizaDatos) {
      e.autorizaDatos = 'Debes autorizar el tratamiento de tus datos personales para continuar';
    }
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
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    startTransition(async () => {
      const res = await submitVisitorRequest(
        cedula, nombre, placa, motivoVisita, acompanantes, tipoTransporte, fechaVencimiento || undefined,
      );
      setResult(res);
    });
  }

  function reset() {
    setResult(null);
    setCedula('');
    setNombre('');
    setTipoTransporte('vehiculo');
    setPlaca('');
    setFechaVencimiento('');
    setMotivoVisita('');
    setAcompanantes([]);
    setAutorizaDatos(false);
    setErrors({});
  }

  if (result?.status === 'PENDIENTE') {
    return (
      <div className="visitor-success">
        <div className="visitor-success-icon">
          <IconCheck />
        </div>
        <h3>¡Solicitud enviada!</h3>
        <p>
          Tu solicitud fue registrada correctamente. El personal de Recepción
          la revisará y te informará sobre el acceso.
        </p>
        <p className="visitor-success-note">
          <IconInfo />
          Cédula: <strong>{cedula}</strong>
          {tipoTransporte === 'vehiculo' && placa && (
            <> · Placa: <strong>{placa.toUpperCase()}</strong></>
          )}
          {tipoTransporte === 'peaton' && <> · <strong>A pie</strong></>}
        </p>
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={reset}>
          Nueva solicitud
        </button>
      </div>
    );
  }

  if (result?.status === 'ERROR') {
    return (
      <div className="visitor-success">
        <div className="visitor-success-icon" style={{ background: 'var(--g-coral-soft)', color: 'var(--g-coral)' }}>
          <IconWarn />
        </div>
        <h3 style={{ color: 'var(--g-coral)' }}>Error de conexión</h3>
        <p>{result.message}</p>
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={reset}>
          Volver al formulario
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="login-form-head">
        <p className="login-form-eyebrow">Solicitud de ingreso</p>
        <h2 className="login-form-title">Registra una nueva visita</h2>
        <p className="login-form-sub">
          Ingresa los datos del visitante para solicitar autorización de entrada a las instalaciones.
        </p>
      </div>

      {/* Cédula */}
      <div className="field">
        <label className="field-label" htmlFor="v-cedula">Número de cédula</label>
        <div className="field-input-wrap">
          <input
            id="v-cedula"
            type="text"
            inputMode="numeric"
            pattern="\d*"
            placeholder="Ej: 1018203040"
            value={cedula}
            onChange={e => setCedula(e.target.value.replace(/\D/g, ''))}
            autoComplete="off"
            aria-describedby={errors.cedula ? 'err-cedula' : undefined}
          />
          <span className="field-icon">
            <IconIdCard width={18} height={18} />
          </span>
        </div>
        {errors.cedula && (
          <span className="field-error" id="err-cedula" role="alert">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            {errors.cedula}
          </span>
        )}
      </div>

      {/* Nombre */}
      <div className="field">
        <label className="field-label" htmlFor="v-nombre">Nombre completo</label>
        <div className="field-input-wrap">
          <input
            id="v-nombre"
            type="text"
            placeholder="Nombres y apellidos"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            autoComplete="name"
            aria-describedby={errors.nombre ? 'err-nombre' : undefined}
          />
          <span className="field-icon">
            <IconUser width={18} height={18} />
          </span>
        </div>
        {errors.nombre && (
          <span className="field-error" id="err-nombre" role="alert">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            {errors.nombre}
          </span>
        )}
      </div>

      {/* ── Tipo de transporte ── */}
      <div className="field">
        <label className="field-label">¿Cómo llega el visitante?</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {([
            { id: 'vehiculo', label: 'En vehículo', icon: <IconCar width={17} height={17} /> },
            { id: 'peaton',   label: 'A pie',        icon: <IconWalk /> },
          ] as const).map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              disabled={isPending}
              onClick={() => {
                setTipoTransporte(id);
                if (id === 'peaton') { setPlaca(''); setErrors(prev => { const n = { ...prev }; delete n.placa; return n; }); }
              }}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: `1.5px solid ${tipoTransporte === id ? 'var(--g-green)' : 'var(--g-line)'}`,
                borderRadius: 'var(--radius)',
                background: tipoTransporte === id ? 'var(--g-green-soft)' : 'var(--g-paper)',
                color: tipoTransporte === id ? 'var(--g-green-dark)' : 'var(--g-ink-2)',
                fontWeight: tipoTransporte === id ? 700 : 500,
                fontSize: 13.5,
                cursor: isPending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                transition: 'all .15s',
              }}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* Placa — solo si viene en vehículo */}
      {tipoTransporte === 'vehiculo' && (
        <div className="field">
          <label className="field-label" htmlFor="v-placa">Placa del vehículo</label>
          <div className="field-input-wrap">
            <input
              id="v-placa"
              type="text"
              placeholder="Ej: ABC123"
              value={placa}
              onChange={e => setPlaca(e.target.value.toUpperCase())}
              autoComplete="off"
              maxLength={7}
              disabled={isPending}
              aria-describedby={errors.placa ? 'err-placa' : undefined}
            />
            <span className="field-icon">
              <IconCar width={18} height={18} />
            </span>
          </div>
          {errors.placa && (
            <span className="field-error" id="err-placa" role="alert">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              {errors.placa}
            </span>
          )}
        </div>
      )}

      {/* Motivo de visita */}
      <div className="field">
        <label className="field-label" htmlFor="v-motivo">Motivo de la visita</label>
        <textarea
          id="v-motivo"
          placeholder="Describe brevemente el motivo de tu visita…"
          value={motivoVisita}
          onChange={e => { setMotivoVisita(e.target.value); }}
          rows={3}
          disabled={isPending}
          aria-describedby={errors.motivoVisita ? 'err-motivo' : undefined}
          style={{
            width: '100%',
            resize: 'vertical',
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            border: '1.5px solid var(--g-line)',
            background: 'var(--g-paper)',
            color: 'var(--g-ink)',
            fontSize: 14,
            fontFamily: 'inherit',
            lineHeight: 1.5,
            outline: 'none',
            transition: 'border-color .15s',
          }}
        />
        {errors.motivoVisita && (
          <span className="field-error" id="err-motivo" role="alert">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            {errors.motivoVisita}
          </span>
        )}
      </div>

      {/* Fecha de vencimiento de la visita */}
      <div className="field">
        <label className="field-label" htmlFor="v-vence">Fecha y hora de vencimiento de la visita</label>
        <div className="field-input-wrap">
          <input
            id="v-vence"
            type="datetime-local"
            value={fechaVencimiento}
            onChange={e => setFechaVencimiento(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            disabled={isPending}
            style={{ paddingRight: 40 }}
            aria-describedby={errors.fechaVencimiento ? 'err-vence' : undefined}
          />
          <span className="field-icon">
            <IconCalendar />
          </span>
        </div>
        {errors.fechaVencimiento && (
          <span className="field-error" id="err-vence" role="alert">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            {errors.fechaVencimiento}
          </span>
        )}
      </div>

      {/* ── Acompañantes ── */}
      <div style={{ marginBottom: 18 }}>
        {acompanantes.map((ac, i) => (
          <div key={i} style={{ background: 'var(--g-green-soft)', border: '1.5px solid rgba(122,157,74,.3)', borderRadius: 12, padding: '14px 14px 4px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--g-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Acompañante {i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeAcompanante(i)}
                disabled={isPending}
                style={{ background: 'none', border: 'none', color: 'var(--g-coral)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                aria-label={`Eliminar acompañante ${i + 1}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
                Eliminar
              </button>
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`ac-cedula-${i}`}>Cédula</label>
              <div className="field-input-wrap">
                <input
                  id={`ac-cedula-${i}`}
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  placeholder="Ej: 1018203040"
                  value={ac.cedula}
                  onChange={e => updateAcompanante(i, 'cedula', e.target.value.replace(/\D/g, ''))}
                  autoComplete="off"
                  disabled={isPending}
                  aria-describedby={errors[`ac_cedula_${i}`] ? `err-ac-cedula-${i}` : undefined}
                />
                <span className="field-icon"><IconIdCard width={18} height={18} /></span>
              </div>
              {errors[`ac_cedula_${i}`] && (
                <span className="field-error" id={`err-ac-cedula-${i}`} role="alert">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  {errors[`ac_cedula_${i}`]}
                </span>
              )}
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`ac-nombre-${i}`}>Nombre completo</label>
              <div className="field-input-wrap">
                <input
                  id={`ac-nombre-${i}`}
                  type="text"
                  placeholder="Nombres y apellidos"
                  value={ac.nombre}
                  onChange={e => updateAcompanante(i, 'nombre', e.target.value)}
                  autoComplete="off"
                  disabled={isPending}
                  aria-describedby={errors[`ac_nombre_${i}`] ? `err-ac-nombre-${i}` : undefined}
                />
                <span className="field-icon"><IconUser width={18} height={18} /></span>
              </div>
              {errors[`ac_nombre_${i}`] && (
                <span className="field-error" id={`err-ac-nombre-${i}`} role="alert">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  {errors[`ac_nombre_${i}`]}
                </span>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addAcompanante}
          disabled={isPending}
          style={{ width: '100%', background: 'transparent', border: '1.5px dashed rgba(122,157,74,.5)', borderRadius: 12, padding: '11px 16px', color: 'var(--g-green-dark)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'border-color .2s, background .2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--g-green)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--g-green-soft)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(122,157,74,.5)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          Agregar acompañante
        </button>
      </div>

      {/* ── Autorización Ley 1581 de 2012 ── */}
      <div style={{ marginBottom: 20 }}>
        <label className="checkbox" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autorizaDatos}
            onChange={e => { setAutorizaDatos(e.target.checked); if (errors.autorizaDatos) setErrors(prev => { const n = { ...prev }; delete n.autorizaDatos; return n; }); }}
            disabled={isPending}
          />
          <span className="box" style={{ marginTop: 2, flexShrink: 0 }}>
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 6l3 3 5-5" />
            </svg>
          </span>
          <span style={{ fontSize: 13, color: 'var(--g-ink-2)', lineHeight: 1.55 }}>
            Autorizo el tratamiento de mis datos personales conforme a la{' '}
            <strong style={{ color: 'var(--g-green-dark)' }}>Ley 1581 de 2012</strong>{' '}
            de protección de datos personales y a las políticas de privacidad de Guaicaramo&nbsp;S.A.S.
          </span>
        </label>
        {errors.autorizaDatos && (
          <span className="field-error" role="alert" style={{ marginTop: 6, display: 'flex' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            {errors.autorizaDatos}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={`btn btn-primary btn-block btn-lg login-submit${isPending ? ' loading' : ''}`}
        style={{ marginTop: 8 }}
      >
        <span className="label">Enviar solicitud</span>
        <IconArrow width={18} height={18} className="arrow" aria-hidden="true" />
        <div className="spinner" role="status" aria-label="Enviando…" />
      </button>

      <p className="login-foot">
        Personal de planta — usa{' '}
        <span style={{ color: 'var(--g-green)', fontWeight: 600 }}>Acceso administrativo</span>
      </p>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Admin form — cédula + PIN
   ─────────────────────────────────────────────────────────────── */
function AdminForm() {
  const router = useRouter();

  const [cedula, setCedula] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cedula.trim()) { setError('Ingresa tu número de cédula.'); return; }
    if (pin.length !== 4) { setError('El PIN debe tener 4 dígitos.'); return; }
    setError('');
    startTransition(async () => {
      const res = await adminLoginCedula(cedula, pin);
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push('/dashboard'), 800);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="login-form-head">
        <p className="login-form-eyebrow">Panel administrativo</p>
        <h2 className="login-form-title">Bienvenido</h2>
        <p className="login-form-sub">Accede con tu cédula y PIN personal.</p>
      </div>

      {/* Cédula */}
      <div className="field">
        <label className="field-label" htmlFor="a-cedula">Cédula</label>
        <div className="field-input-wrap">
          <input
            id="a-cedula"
            type="text"
            inputMode="numeric"
            pattern="\d*"
            placeholder="Ej: 1018203040"
            value={cedula}
            onChange={e => { setCedula(e.target.value.replace(/\D/g, '')); setError(''); }}
            autoComplete="username"
            disabled={isPending || done}
            autoFocus
          />
          <span className="field-icon"><IconIdCard width={18} height={18} /></span>
        </div>
      </div>

      {/* PIN */}
      <div className="field">
        <label className="field-label" htmlFor="a-pin">PIN</label>
        <div className="field-input-wrap">
          <input
            id="a-pin"
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            pattern="\d*"
            placeholder="••••"
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
            autoComplete="current-password"
            maxLength={4}
            disabled={isPending || done}
          />
          <span className="field-icon"><IconLock width={18} height={18} /></span>
          <button
            type="button"
            className="field-pwd-toggle"
            aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
            onClick={() => setShowPin(v => !v)}
          >
            {showPin ? <IconEyeOff width={18} height={18} /> : <IconEye width={18} height={18} />}
          </button>
        </div>
      </div>

      {error && (
        <p className="field-error" role="alert" style={{ marginBottom: 16 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || done}
        className={`btn btn-primary btn-block btn-lg login-submit${isPending ? ' loading' : ''}${done ? ' success' : ''}`}
      >
        <span className="label">Ingresar</span>
        <IconArrow width={18} height={18} className="arrow" aria-hidden="true" />
        <div className="spinner" role="status" aria-label="Verificando…" />
        <div className="login-success" aria-live="polite">
          <svg className="check-anim" viewBox="0 0 24 24" aria-label="Acceso concedido">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
      </button>
    </form>
  );
}
