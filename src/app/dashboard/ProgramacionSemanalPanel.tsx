'use client';

import { useState, useRef, useTransition } from 'react';
import { submitProgramacionSemanal } from '@/app/actions';

interface Persona {
  cedula: string;
  nombre: string;
  area: string;
  fechaInicio: string;
  fechaFin: string;
  notas: string;
}

const EMPTY_PERSONA: Persona = {
  cedula: '', nombre: '', area: '', fechaInicio: '', fechaFin: '', notas: '',
};

/* -- Icons ----------------------------------------------------------------- */

function IconMic({ size = 16, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="1" width="6" height="11" rx="3" fill={filled ? 'currentColor' : 'none'} />
      <path d="M5 10a7 7 0 0 0 14 0M12 19v4M8 23h8" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RecDot() {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: 'currentColor', flexShrink: 0,
      animation: 'db-pulse 1s ease-in-out infinite',
    }} />
  );
}

/* -- Voice hook ------------------------------------------------------------ */

type RecTarget = 'session' | number;

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

/* -- Small Dictar button --------------------------------------------------- */

function DictarBtn({ active, disabled, onClick }: { active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 11px', borderRadius: 7,
        border: `1.5px solid ${active ? 'var(--g-coral)' : 'var(--g-line)'}`,
        background: active ? 'rgba(211,75,75,.07)' : 'transparent',
        color: active ? 'var(--g-coral)' : 'var(--g-ink-3)',
        fontSize: 11.5, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap', transition: 'all .15s', flexShrink: 0,
      }}>
      <IconMic size={12} filled={active} />
      {active ? 'Detener' : 'Dictar'}
      {active && <RecDot />}
    </button>
  );
}

/* -- Main component -------------------------------------------------------- */

export default function ProgramacionSemanalPanel() {
  const [personas, setPersonas] = useState<Persona[]>([{ ...EMPTY_PERSONA }]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const { activeTarget, toggle } = useVoice((target, text) => {
    if (target === 'session') {
      setSessionNotes(prev => (prev ? prev + ' ' + text : text));
    } else {
      const idx = target as number;
      setPersonas(prev => prev.map((p, i) =>
        i === idx ? { ...p, notas: p.notas ? p.notas + ' ' + text : text } : p,
      ));
    }
  });

  function addPersona() {
    setPersonas(prev => [...prev, { ...EMPTY_PERSONA }]);
  }

  function removePersona(idx: number) {
    setPersonas(prev => prev.filter((_, i) => i !== idx));
    setErrors(prev => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.endsWith(`_${idx}`)) next[k] = v;
      }
      return next;
    });
  }

  function update<K extends keyof Persona>(idx: number, field: K, value: Persona[K]) {
    setPersonas(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    personas.forEach((p, i) => {
      if (!p.cedula.trim())                          e[`cedula_${i}`] = 'Requerido';
      else if (!/^\d{5,12}$/.test(p.cedula.trim())) e[`cedula_${i}`] = 'Solo numeros (5-12 digitos)';
      if (!p.nombre.trim())                          e[`nombre_${i}`] = 'Requerido';
      else if (p.nombre.trim().length < 4)           e[`nombre_${i}`] = 'Nombre demasiado corto';
    });
    return e;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({}); setSubmitError(null);
    startTransition(async () => {
      const res = await submitProgramacionSemanal(
        personas.map(p => ({
          cedula: p.cedula,
          nombre: p.nombre,
          area: p.area || undefined,
          fechaInicio: p.fechaInicio ? new Date(p.fechaInicio).toISOString() : undefined,
          fechaFin:    p.fechaFin    ? new Date(p.fechaFin).toISOString()    : undefined,
          notas:       p.notas       || undefined,
        })),
        sessionNotes.trim() || undefined,
      );
      if (!res.ok) setSubmitError(res.message ?? 'Error desconocido.');
      else setSaved(res.count ?? 0);
    });
  }

  function reset() {
    setPersonas([{ ...EMPTY_PERSONA }]);
    setSessionNotes(''); setErrors({}); setSubmitError(null); setSaved(null);
  }

  if (saved !== null) {
    return (
      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        <div className="db-card db-form-result-pad" style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--g-green-soft)', color: 'var(--g-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <IconCheck />
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, fontWeight: 600, color: 'var(--g-green-dark)', marginBottom: 10 }}>
            Programacion guardada!
          </h3>
          <p style={{ color: 'var(--g-ink-2)', marginBottom: 32 }}>
            Se registraron <strong>{saved}</strong> persona{saved !== 1 ? 's' : ''} en la tabla FinDeSemana.
          </p>
          <button className="btn btn-primary" onClick={reset}>Nueva programacion</button>
        </div>
      </div>
    );
  }

  const sessionRecording = activeTarget === 'session';

  return (
    <div style={{ maxWidth: 740, margin: '0 auto' }}>
      <form onSubmit={handleSubmit} noValidate>

        {/* Top card: session mic + notes */}
        <div className="db-card" style={{ marginBottom: 20 }}>
          <div className="db-form-header-pad">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--g-green-soft)', color: 'var(--g-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>
              📅
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--g-green)', margin: '0 0 3px' }}>
                Superadmin - FinDeSemana
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, fontWeight: 600, color: 'var(--g-green-dark)', margin: 0, lineHeight: 1 }}>
                Programacion semanal
              </h2>
            </div>
          </div>

          <div className="db-form-body-pad" style={{ paddingTop: 0 }}>
            <div style={{
              background: 'var(--g-green-soft)',
              border: `1.5px solid ${sessionRecording ? 'var(--g-coral)' : 'rgba(122,157,74,.25)'}`,
              borderRadius: 16, padding: '28px 24px 22px',
              textAlign: 'center', transition: 'border-color .2s',
            }}>
              <button
                type="button"
                onClick={() => toggle('session')}
                disabled={isPending}
                aria-pressed={sessionRecording}
                style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: sessionRecording ? 'var(--g-coral)' : 'var(--g-paper)',
                  color: sessionRecording ? '#fff' : 'var(--g-green)',
                  border: `2.5px solid ${sessionRecording ? 'var(--g-coral)' : 'var(--g-green)'}`,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px', flexShrink: 0,
                  boxShadow: sessionRecording
                    ? '0 0 0 10px rgba(211,75,75,.12), 0 4px 12px rgba(211,75,75,.2)'
                    : '0 2px 10px rgba(78,91,49,.12)',
                  transition: 'all .2s',
                }}
              >
                <IconMic size={32} filled={sessionRecording} />
              </button>

              <p style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 18, color: sessionRecording ? 'var(--g-coral)' : 'var(--g-ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {sessionRecording
                  ? <><RecDot />Grabando nota de sesion — haz clic al microfono para detener</>
                  : 'Haz clic para dictar una nota general de la sesion'}
              </p>

              <textarea
                placeholder="O escribe aqui las notas generales: contexto, instrucciones, area de trabajo..."
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                rows={3}
                disabled={isPending}
                style={{ width: '100%', resize: 'vertical', padding: '10px 14px', borderRadius: 10, border: '1.5px solid rgba(122,157,74,.3)', fontSize: 14, fontFamily: 'inherit', color: 'var(--g-ink-1)', background: 'var(--g-paper)', outline: 'none', boxSizing: 'border-box', lineHeight: 1.55, textAlign: 'left', transition: 'border-color .15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--g-green)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(122,157,74,.3)'; }}
              />
              <p style={{ fontSize: 11.5, color: 'var(--g-ink-3)', marginTop: 8, textAlign: 'left' }}>
                Esta nota se adjuntara al resumen de cada persona registrada.
              </p>
            </div>
          </div>
        </div>

        {/* Person cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
          {personas.map((p, i) => (
            <div key={i} className="db-card" style={{ padding: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 12px', borderBottom: '1px solid var(--g-line)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--g-green-dark)' }}>
                  Persona {i + 1}
                </span>
                {personas.length > 1 && (
                  <button type="button" onClick={() => removePersona(i)} disabled={isPending}
                    style={{ background: 'none', border: 'none', color: 'var(--g-coral)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                    aria-label={`Eliminar persona ${i + 1}`}>
                    <IconX />Eliminar
                  </button>
                )}
              </div>

              <div style={{ padding: '16px 20px 20px' }}>
                {/* Cedula / Nombre / Area */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0 16px', marginBottom: 4 }}>
                  <div className="field">
                    <label className="field-label" htmlFor={`ps-cedula-${i}`}>Cedula</label>
                    <div className="field-input-wrap">
                      <input id={`ps-cedula-${i}`} type="text" inputMode="numeric" pattern="\d*"
                        placeholder="Ej: 1018203040" value={p.cedula}
                        onChange={e => update(i, 'cedula', e.target.value.replace(/\D/g, ''))}
                        autoComplete="off" disabled={isPending} />
                    </div>
                    {errors[`cedula_${i}`] && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--g-coral)' }}>{errors[`cedula_${i}`]}</p>}
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor={`ps-nombre-${i}`}>Nombre</label>
                    <div className="field-input-wrap">
                      <input id={`ps-nombre-${i}`} type="text" placeholder="Nombres y apellidos"
                        value={p.nombre} onChange={e => update(i, 'nombre', e.target.value)}
                        autoComplete="off" disabled={isPending} />
                    </div>
                    {errors[`nombre_${i}`] && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--g-coral)' }}>{errors[`nombre_${i}`]}</p>}
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor={`ps-area-${i}`}>Area</label>
                    <div className="field-input-wrap">
                      <input id={`ps-area-${i}`} type="text" placeholder="Ej: Agricultura"
                        value={p.area} onChange={e => update(i, 'area', e.target.value)}
                        autoComplete="off" disabled={isPending} />
                    </div>
                  </div>
                </div>

                {/* Fechas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 16px', marginBottom: 4 }}>
                  <div className="field">
                    <label className="field-label" htmlFor={`ps-inicio-${i}`}>Fecha inicio</label>
                    <div className="field-input-wrap">
                      <input id={`ps-inicio-${i}`} type="datetime-local" value={p.fechaInicio}
                        onChange={e => update(i, 'fechaInicio', e.target.value)} disabled={isPending} />
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor={`ps-fin-${i}`}>Fecha fin</label>
                    <div className="field-input-wrap">
                      <input id={`ps-fin-${i}`} type="datetime-local" value={p.fechaFin}
                        onChange={e => update(i, 'fechaFin', e.target.value)} disabled={isPending} />
                    </div>
                  </div>
                </div>

                {/* Notas + Dictar */}
                <div className="field" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="field-label" htmlFor={`ps-notas-${i}`} style={{ margin: 0 }}>
                      Notas / Resumen
                    </label>
                    <DictarBtn active={activeTarget === i} disabled={isPending} onClick={() => toggle(i)} />
                  </div>
                  <textarea
                    id={`ps-notas-${i}`}
                    placeholder="Escribe o dicta las notas especificas de esta persona..."
                    value={p.notas}
                    onChange={e => update(i, 'notas', e.target.value)}
                    rows={2}
                    disabled={isPending}
                    style={{
                      width: '100%', resize: 'vertical', padding: '10px 14px', borderRadius: 10,
                      border: `1.5px solid ${activeTarget === i ? 'var(--g-green)' : 'var(--g-line)'}`,
                      fontSize: 13.5, fontFamily: 'inherit', color: 'var(--g-ink-1)',
                      background: 'var(--g-paper)', outline: 'none', boxSizing: 'border-box',
                      lineHeight: 1.5, transition: 'border-color .15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--g-green)'; }}
                    onBlur={e => { if (activeTarget !== i) e.currentTarget.style.borderColor = 'var(--g-line)'; }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {submitError && (
          <p style={{ color: 'var(--g-coral)', fontSize: 13, margin: '0 0 12px' }}>{submitError}</p>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <button type="button" onClick={addPersona} disabled={isPending}
            style={{ flexShrink: 0, background: 'transparent', border: '1.5px dashed rgba(122,157,74,.5)', borderRadius: 12, padding: '13px 20px', color: 'var(--g-green-dark)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: 'border-color .2s, background .2s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--g-green)'; b.style.background = 'var(--g-green-soft)'; }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'rgba(122,157,74,.5)'; b.style.background = 'transparent'; }}
          >
            <IconPlus />Agregar persona
          </button>
          <button type="submit" disabled={isPending}
            className={`btn btn-primary btn-block login-submit${isPending ? ' loading' : ''}`}
            style={{ flex: 1 }}>
            <span className="label">Guardar programacion</span>
            <div className="spinner" role="status" aria-label="Guardando..." />
          </button>
        </div>

      </form>
    </div>
  );
}
