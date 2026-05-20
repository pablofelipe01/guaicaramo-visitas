'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wordmark, PalmDecoration } from '@/components/decorations';
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
import { submitVisitorRequest, adminLogin, checkAdminUser, setAdminPassword } from '@/app/actions';
import type { VisitorResult } from '@/app/actions';

type Mode = 'visitor' | 'admin';

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

/* ─────────────────────────────────────────────────────────────────
   Root page
   ───────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('visitor');

  return (
    <div className="login">
      {/* ── Left: brand panel ── */}
      <div className="login-panel">
        <div className="login-brand">
          <Wordmark />
        </div>

        <div>
          <p className="login-quote">
            Cada llegada,<br />
            <em>cada salida,</em><br />
            bajo control.
          </p>
          <p className="login-quote-sub">
            Sistema de control y autorización de visitas para porterías,
            plantas, lotes y oficinas de Guaicaramo&nbsp;S.A.S.
          </p>
        </div>

        <div className="login-meta">
          <div>
            <strong>24/7</strong>
            Control continuo
          </div>
          <div>
            <strong>100%</strong>
            Digitalizado
          </div>
          <div>
            <strong>v&nbsp;1.0</strong>
            Sistema activo
          </div>
        </div>

        <PalmDecoration className="login-panel-art" style={{ color: 'var(--g-leaf)' }} />
      </div>

      {/* ── Right: form panel ── */}
      <div className="login-form-wrap">
        <div className="login-form">
          <Link href="/" className="login-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            Volver al inicio
          </Link>

          {/* Mode switcher */}
          <div className="login-mode-tabs" role="tablist" aria-label="Tipo de acceso">
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
          </div>

          {mode === 'visitor' ? <VisitorForm /> : <AdminForm />}
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
  const [placa, setPlaca] = useState('');
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
    if (!placa.trim()) {
      e.placa = 'Ingresa la placa del vehículo';
    } else if (!/^[A-Za-z0-9]{5,7}$/.test(placa.trim())) {
      e.placa = 'Formato de placa inválido (ej: ABC123)';
    }
    if (!motivoVisita.trim()) {
      e.motivoVisita = 'Indica el motivo de tu visita';
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
      const res = await submitVisitorRequest(cedula, nombre, placa, motivoVisita, acompanantes);
      setResult(res);
    });
  }

  function reset() {
    setResult(null);
    setCedula('');
    setNombre('');
    setPlaca('');
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
          Cédula: <strong>{cedula}</strong> · Placa: <strong>{placa.toUpperCase()}</strong>
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

      {/* Placa */}
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
   Admin login form — flujo en 2 pasos
   Paso 1: ingresa usuario → verifica si existe y si tiene contraseña
   Paso 2a: tiene contraseña → muestra campo contraseña
   Paso 2b: sin contraseña → muestra formulario de creación
   ───────────────────────────────────────────────────────────── */
function AdminForm() {
  const router = useRouter();

  // Paso: 'user' | 'password' | 'create-password'
  const [step, setStep] = useState<'user' | 'password' | 'create-password'>('user');

  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  /* ── Paso 1: verificar usuario ── */
  function handleCheckUser(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario.trim()) { setError('Ingresa tu nombre de usuario.'); return; }
    setError('');
    startTransition(async () => {
      const res = await checkAdminUser(usuario);
      if (!res.found) {
        setError('Usuario no encontrado. Verifica e intenta de nuevo.');
        return;
      }
      setStep(res.hasPassword ? 'password' : 'create-password');
    });
  }

  /* ── Paso 2a: iniciar sesión ── */
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!contraseña) { setError('Ingresa tu contraseña.'); return; }
    setError('');
    startTransition(async () => {
      const res = await adminLogin(usuario, contraseña);
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push('/dashboard'), 800);
      } else {
        setError(res.message);
      }
    });
  }

  /* ── Paso 2b: crear contraseña ── */
  function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError('');
    startTransition(async () => {
      const res = await setAdminPassword(usuario, newPwd);
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push('/dashboard'), 800);
      } else {
        setError(res.message);
      }
    });
  }

  const heading = step === 'create-password' ? 'Crea tu contraseña' : 'Bienvenido';
  const sub =
    step === 'create-password'
      ? 'Es tu primer acceso. Elige una contraseña segura para continuar.'
      : step === 'password'
      ? `Ingresa la contraseña de ${usuario}.`
      : 'Accede con tus credenciales de plataforma.';

  return (
    <form
      onSubmit={
        step === 'user'
          ? handleCheckUser
          : step === 'password'
          ? handleLogin
          : handleSetPassword
      }
      noValidate
    >
      <div className="login-form-head">
        <p className="login-form-eyebrow">Panel administrativo</p>
        <h2 className="login-form-title">{heading}</h2>
        <p className="login-form-sub">{sub}</p>
      </div>

      {/* ── Paso 1: usuario ── */}
      <div className="field">
        <label className="field-label" htmlFor="a-usuario">Usuario</label>
        <div className="field-input-wrap">
          <input
            id="a-usuario"
            type="text"
            placeholder="tu.usuario"
            value={usuario}
            onChange={e => { setUsuario(e.target.value); setError(''); }}
            autoComplete="username"
            disabled={isPending || done || step !== 'user'}
            autoFocus={step === 'user'}
          />
          <span className="field-icon"><IconUser width={18} height={18} /></span>
        </div>
      </div>

      {/* ── Paso 2a: contraseña ── */}
      {step === 'password' && (
        <div className="field">
          <label className="field-label" htmlFor="a-pwd">Contraseña</label>
          <div className="field-input-wrap">
            <input
              id="a-pwd"
              type={showPwd ? 'text' : 'password'}
              placeholder="••••••••"
              value={contraseña}
              onChange={e => { setContraseña(e.target.value); setError(''); }}
              autoComplete="current-password"
              disabled={isPending || done}
              autoFocus
            />
            <span className="field-icon"><IconLock width={18} height={18} /></span>
            <button
              type="button"
              className="field-pwd-toggle"
              aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onClick={() => setShowPwd(v => !v)}
            >
              {showPwd ? <IconEyeOff width={18} height={18} /> : <IconEye width={18} height={18} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 2b: crear contraseña ── */}
      {step === 'create-password' && (
        <>
          <div className="field">
            <label className="field-label" htmlFor="a-new-pwd">Nueva contraseña</label>
            <div className="field-input-wrap">
              <input
                id="a-new-pwd"
                type={showNewPwd ? 'text' : 'password'}
                placeholder="Mínimo 4 caracteres"
                value={newPwd}
                onChange={e => { setNewPwd(e.target.value); setError(''); }}
                autoComplete="new-password"
                disabled={isPending || done}
                autoFocus
              />
              <span className="field-icon"><IconLock width={18} height={18} /></span>
              <button
                type="button"
                className="field-pwd-toggle"
                aria-label={showNewPwd ? 'Ocultar' : 'Mostrar'}
                onClick={() => setShowNewPwd(v => !v)}
              >
                {showNewPwd ? <IconEyeOff width={18} height={18} /> : <IconEye width={18} height={18} />}
              </button>
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="a-confirm-pwd">Confirmar contraseña</label>
            <div className="field-input-wrap">
              <input
                id="a-confirm-pwd"
                type={showNewPwd ? 'text' : 'password'}
                placeholder="Repite la contraseña"
                value={confirmPwd}
                onChange={e => { setConfirmPwd(e.target.value); setError(''); }}
                autoComplete="new-password"
                disabled={isPending || done}
              />
              <span className="field-icon"><IconLock width={18} height={18} /></span>
            </div>
          </div>
        </>
      )}

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
        <span className="label">
          {step === 'user' ? 'Continuar' : step === 'create-password' ? 'Crear contraseña e ingresar' : 'Ingresar'}
        </span>
        <IconArrow width={18} height={18} className="arrow" aria-hidden="true" />
        <div className="spinner" role="status" aria-label="Verificando…" />
        <div className="login-success" aria-live="polite">
          <svg className="check-anim" viewBox="0 0 24 24" aria-label="Acceso concedido">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
      </button>

      {step !== 'user' && (
        <button
          type="button"
          className="btn btn-ghost btn-block"
          style={{ marginTop: 8, fontSize: 13 }}
          onClick={() => { setStep('user'); setContraseña(''); setNewPwd(''); setConfirmPwd(''); setError(''); }}
          disabled={isPending || done}
        >
          ← Cambiar usuario
        </button>
      )}
    </form>
  );
}
