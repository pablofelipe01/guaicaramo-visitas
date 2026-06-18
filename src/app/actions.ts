'use server';

import { cookies, headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import {
  // findPlacaByPlaca,  // TODO: descomentar cuando se active la lógica de autorización por placa
  // createRegistro,    // TODO: reactivar cuando se retome la lógica de Registros
  createPlacaSolicitud,
  createPersona,
  findAdminByUsuario,
  findAdminByCedula,
  updateAdminPassword,
  updateRegistroStatus,
  updatePlacaAutorizado,
  updatePlacaAcompanantes,
  updatePersonaAutorizado,
  updatePersonaAcompanantes,
  createFinDeSemanaRecords,
  type FinDeSemanaPersona,
  createItem,
  type ItemCreateFields,
  deletePlacas,
  deletePersonas,
} from '@/lib/airtable';
import { isAllowed } from '@/lib/rate-limit';
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';

const BCRYPT_ROUNDS = 12;

/** Extrae la IP del cliente de los headers de la request. */
async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  );
}

/* ─────────────────────────────────────────────────────────────
   Visitor / Solicitar ingreso
   ───────────────────────────────────────────────────────── */

export type VisitorResult =
  | { status: 'PENDIENTE' }
  | { status: 'SESSION_EXPIRED' }
  | { status: 'ERROR'; message: string };

/*
 * Por ahora solo crea el registro en la tabla Registros con status PENDIENTE.
 * La lógica de consulta a la tabla Placas (autorización, vencimiento, etc.)
 * está comentada más abajo y se puede activar en el futuro.
 */
export async function submitVisitorRequest(
  cedula: string,
  nombre: string,
  placa: string,
  motivoVisita: string,
  acompanantes?: { cedula: string; nombre: string }[],
  tipoTransporte?: 'vehiculo' | 'peaton',
  fechaVencimiento?: string,
  requireSession?: boolean,
): Promise<VisitorResult> {
  // Rate limit: máx. 5 solicitudes por IP cada 60 segundos
  const ip = await getClientIp();
  if (!isAllowed(`visitor:${ip}`, 5, 60_000)) {
    return { status: 'ERROR', message: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.' };
  }

  const placaUpper = placa.toUpperCase().trim();
  const cedulaTrim = cedula.trim();
  const esVehiculo = (tipoTransporte ?? 'vehiculo') === 'vehiculo';
  // Convierte datetime-local (YYYY-MM-DDTHH:mm, hora local de la finca) a ISO UTC.
  // Se añade el offset de zona horaria para que el servidor (UTC) no lo malinterprete.
  const tzOffset = process.env.APP_TZ_OFFSET ?? '-05:00';
  const venceISO = fechaVencimiento
    ? new Date(`${fechaVencimiento}${tzOffset}`).toISOString()
    : undefined;
  // Quién hace el registro (puede ser undefined si no hay sesión, ej. desde el portal público)
  const session = await getSession();
  const registradoPor = session
    ? `${session.cedula} - ${session.nombre || session.usuario}`.trim().replace(/^-\s*/, '')
    : undefined;
  const adminId = session?.id ?? undefined;

  // Si el registro proviene de un contexto autenticado (dashboard) pero la sesión
  // expiró (cookie vencida con la pestaña abierta), NO crear un registro huérfano
  // sin administrador vinculado: pedir re-login. El proxy renueva la sesión mientras
  // el usuario esté activo, así que esto solo ocurre tras inactividad real.
  if (requireSession && !session) {
    return { status: 'SESSION_EXPIRED' };
  }

  // IDs de registros ya creados, para poder limpiarlos si algo falla a mitad
  // y evitar huérfanos/duplicados al reintentar.
  const created = { placas: [] as string[], personas: [] as string[] };

  try {
    /*
     * ── LÓGICA FUTURA: consulta tabla Placas ──────────────────────────────
     *
     * const found = await findPlacaByPlaca(placaUpper);
     *
     * if (found) {
     *   const isExpired =
     *     found.vence != null && found.vence !== ''
     *       ? new Date(found.vence) < new Date()
     *       : false;
     *
     *   if (found.autorizado && !isExpired) {
     *     // Vehículo autorizado → ENTRADA APROBADA
     *     await createRegistro({ ..., tipo: 'ENTRADA', status: 'APROBADO', approved_by: 'GATEWAY' });
     *     return { status: 'APROBADO', conductor: found.conductor || nombre, placa: placaUpper };
     *   }
     *
     *   // Vehículo en base pero no autorizado o vencido → NEGADO
     *   const motivo = isExpired
     *     ? 'El permiso de este vehículo ha vencido.'
     *     : 'Este vehículo no está autorizado para ingresar.';
     *   await createRegistro({ ..., tipo: 'MANUAL', status: 'NEGADO', comment: motivo, rejected_time: now });
     *   return { status: 'NEGADO', motivo };
     * }
     *
     * ─────────────────────────────────────────────────────────────────────
     */

    const motivoTrim = motivoVisita.trim() || undefined;
    const nombreTrim  = nombre.trim();

    if (esVehiculo) {
      // ── Vehículo: conductor → Placas, acompañantes → Personas ────────────
      const notaAc = (ac: { cedula: string; nombre: string }) =>
        motivoTrim
          ? `${motivoTrim} — acompañante de: ${nombreTrim} (cédula: ${cedulaTrim})`
          : `Acompañante de: ${nombreTrim} (cédula: ${cedulaTrim})`;

      console.log('[submitVisitorRequest] Creando placa:', { placa: placaUpper, conductor: nombreTrim });

      const solicitudes: Promise<string | null>[] = [
        createPlacaSolicitud({
          placa:          placaUpper,
          cedula:         cedulaTrim,
          conductor:      nombreTrim,
          notas:          motivoTrim,
          vence:          venceISO,
          registrado_por: registradoPor,
          adminId,
        }),
        ...(acompanantes ?? []).map((ac, idx) => {
          console.log(`[submitVisitorRequest] Creando acompañante ${idx + 1}:`, { cedula: ac.cedula, nombre: ac.nombre });
          return createPersona({
            cedula:         ac.cedula.trim(),
            nombre:         ac.nombre.trim(),
            cargo:          'Visitante',
            notas:          notaAc(ac),
            vence:          venceISO,
            registrado_por: registradoPor,
            adminId,
          });
        }),
      ];

      const [placaResult, ...acompananteResults] = await Promise.all(solicitudes);
      console.log('[submitVisitorRequest] Resultados:', [placaResult, ...acompananteResults]);

      // Registrar lo que sí se creó para poder limpiarlo si algo falló.
      if (placaResult) created.placas.push(placaResult);
      acompananteResults.forEach(id => { if (id) created.personas.push(id); });

      if (!placaResult || acompananteResults.some(r => !r)) {
        throw new Error('Falla al crear uno o más registros en Airtable');
      }

      // Vincular acompañantes al registro de Placas
      const acompananteIds = acompananteResults as string[];
      if (acompananteIds.length > 0) {
        console.log('[submitVisitorRequest] Vinculando acompañantes a placa:', placaResult, acompananteIds);
        const linked = await updatePlacaAcompanantes(placaResult, acompananteIds);
        if (!linked) {
          throw new Error('Falla al vincular acompañantes a la placa');
        }
      }
    } else {
      // ── Peatón → tabla Personas ──────────────────────────────────────────
      const notaAc = (ac: { cedula: string; nombre: string }) =>
        motivoTrim
          ? `${motivoTrim} — acompañante de: ${nombreTrim} (cédula: ${cedulaTrim})`
          : `Acompañante de: ${nombreTrim} (cédula: ${cedulaTrim})`;

      console.log('[submitVisitorRequest] Creando persona (peatón):', { nombre: nombreTrim });

      const solicitudes: Promise<string | null>[] = [
        createPersona({
          cedula:         cedulaTrim,
          nombre:         nombreTrim,
          cargo:          'Visitante',
          notas:          motivoTrim,
          vence:          venceISO,
          registrado_por: registradoPor,
          adminId,
        }),
        ...(acompanantes ?? []).map((ac, idx) => {
          console.log(`[submitVisitorRequest] Creando acompañante ${idx + 1}:`, { cedula: ac.cedula, nombre: ac.nombre });
          return createPersona({
            cedula:         ac.cedula.trim(),
            nombre:         ac.nombre.trim(),
            cargo:          'Visitante',
            notas:          notaAc(ac),
            vence:          venceISO,
            registrado_por: registradoPor,
            adminId,
          });
        }),
      ];

      const [personaResult, ...acompananteResults] = await Promise.all(solicitudes);
      console.log('[submitVisitorRequest] Resultados:', [personaResult, ...acompananteResults]);

      if (personaResult) created.personas.push(personaResult);
      acompananteResults.forEach(id => { if (id) created.personas.push(id); });

      if (!personaResult || acompananteResults.some(r => !r)) {
        throw new Error('Falla al crear uno o más registros en Airtable');
      }

      // Vincular acompañantes al registro principal de la persona
      const acompananteIds = acompananteResults as string[];
      if (acompananteIds.length > 0) {
        console.log('[submitVisitorRequest] Vinculando acompañantes a persona:', personaResult, acompananteIds);
        const linked = await updatePersonaAcompanantes(personaResult, acompananteIds);
        if (!linked) {
          throw new Error('Falla al vincular acompañantes a la persona');
        }
      }
    }

    /*
     * ── LÓGICA COMENTADA: creación en tabla Registros ─────────────────────
     *
     * const pendientes: Promise<string | null>[] = [
     *   createRegistro({
     *     placa: placaUpper, tipo: 'MANUAL', cedula: cedulaTrim,
     *     entry_time: now, approved_by: 'GATEWAY', status: 'PENDIENTE',
     *     nombre_visitante: nombreTrim, motivo_visita: motivoTrim, nodo_origen: 'WEB',
     *   }),
     * ];
     * for (const ac of (acompanantes ?? [])) {
     *   pendientes.push(createRegistro({
     *     placa: placaUpper, tipo: 'MANUAL', cedula: ac.cedula.trim(),
     *     entry_time: now, approved_by: 'GATEWAY', status: 'PENDIENTE',
     *     nombre_visitante: ac.nombre.trim(),
     *     comment: `Acompañante de: ${nombreTrim} (cédula: ${cedulaTrim})`,
     *     motivo_visita: motivoTrim, nodo_origen: 'WEB',
     *   }));
     * }
     * await Promise.all(pendientes);
     *
     * ─────────────────────────────────────────────────────────────────────
     */
    return { status: 'PENDIENTE' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[submitVisitorRequest] Error:', msg, err);

    // Limpiar registros huérfanos creados antes de la falla, para evitar
    // duplicados o registros sin vínculo cuando el usuario reintenta.
    if (created.placas.length || created.personas.length) {
      console.warn('[submitVisitorRequest] Limpiando huérfanos:', created);
      try {
        await Promise.all([
          created.placas.length   ? deletePlacas(created.placas)     : Promise.resolve(),
          created.personas.length ? deletePersonas(created.personas) : Promise.resolve(),
        ]);
      } catch (cleanupErr) {
        console.error('[submitVisitorRequest] Falla al limpiar huérfanos:', cleanupErr);
      }
    }

    // Exponer mensajes de configuración faltante (no contienen datos sensibles)
    if (msg.startsWith('Falta variable de entorno')) {
      return { status: 'ERROR', message: `Configuración incompleta: ${msg}` };
    }
    if (msg.includes('Falla al')) {
      return { status: 'ERROR', message: 'Error al crear registros en Airtable. Verifica los datos e intenta de nuevo.' };
    }
    return { status: 'ERROR', message: 'Error de conexión. Intenta de nuevo.' };
  }
}

/* ─────────────────────────────────────────────────────────────
   Admin — paso 1: verificar usuario
   ───────────────────────────────────────────────────────── */

export type CheckAdminResult =
  | { found: false }
  | { found: true; hasPassword: boolean };

/**
 * Verifica si el usuario existe en Airtable y si ya tiene contraseña.
 * No expone información sensible más allá de si el usuario existe.
 */
export async function checkAdminUser(usuario: string): Promise<CheckAdminResult> {
  const ip = await getClientIp();
  if (!isAllowed(`admin-check:${ip}`, 15, 5 * 60_000)) {
    // Devolvemos not-found para no dar pistas en caso de flood
    return { found: false };
  }

  try {
    const admin = await findAdminByUsuario(usuario.trim());
    if (!admin) return { found: false };
    return { found: true, hasPassword: admin.contraseña.trim().length > 0 };
  } catch {
    return { found: false };
  }
}

/* ─────────────────────────────────────────────────────────────
   Admin — paso 2a: iniciar sesión con contraseña
   ───────────────────────────────────────────────────────── */

export type AdminLoginResult =
  | { ok: true; usuario: string }
  | { ok: false; message: string };

export async function adminLogin(
  usuario: string,
  contraseña: string,
): Promise<AdminLoginResult> {
  // Rate limit: máx. 10 intentos por IP cada 5 minutos (anti-fuerza-bruta)
  const ip = await getClientIp();
  if (!isAllowed(`admin-login:${ip}`, 10, 5 * 60_000)) {
    return { ok: false, message: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' };
  }

  try {
    const admin = await findAdminByUsuario(usuario.trim());
    if (!admin || !admin.contraseña) {
      return { ok: false, message: 'Usuario o contraseña incorrectos.' };
    }

    // Soporta hashes bcrypt (empieza con $2) y texto plano migrado todavía sin hashear
    let valid = false;
    if (admin.contraseña.startsWith('$2')) {
      valid = await bcrypt.compare(contraseña, admin.contraseña);
    } else {
      // Contraseña en texto plano (legado) — comparar y migrar al hash
      valid = admin.contraseña === contraseña;
      if (valid) {
        const hash = await bcrypt.hash(contraseña, BCRYPT_ROUNDS);
        await updateAdminPassword(admin.id, hash);
      }
    }

    if (!valid) {
      return { ok: false, message: 'Usuario o contraseña incorrectos.' };
    }

    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE,
      JSON.stringify({ id: admin.id, usuario: admin.usuario, cedula: admin.cedula, nombre: admin.nombre, tipo: admin.tipo ?? 'Invita', areas: admin.areas ?? [] }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
      },
    );

    return { ok: true, usuario: admin.usuario };
  } catch {
    return { ok: false, message: 'Error de conexión. Intenta de nuevo.' };
  }
}

/* ─────────────────────────────────────────────────────────────
   Admin — paso 2b: crear contraseña por primera vez
   ───────────────────────────────────────────────────────── */

export type SetPasswordResult =
  | { ok: true; usuario: string }
  | { ok: false; message: string };

export async function setAdminPassword(
  usuario: string,
  newPassword: string,
): Promise<SetPasswordResult> {
  const ip = await getClientIp();
  if (!isAllowed(`admin-setpwd:${ip}`, 5, 10 * 60_000)) {
    return { ok: false, message: 'Demasiados intentos. Espera unos minutos.' };
  }

  try {
    const admin = await findAdminByUsuario(usuario.trim());

    // Doble verificación: solo permitir si realmente no tiene contraseña
    if (!admin) {
      return { ok: false, message: 'Usuario no encontrado.' };
    }
    if (admin.contraseña.trim().length > 0) {
      return { ok: false, message: 'Este usuario ya tiene contraseña configurada.' };
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const saved = await updateAdminPassword(admin.id, hash);
    if (!saved) {
      return { ok: false, message: 'No se pudo guardar la contraseña. Intenta de nuevo.' };
    }

    // Iniciar sesión automáticamente tras crear la contraseña
    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE,
      JSON.stringify({ id: admin.id, usuario: admin.usuario, cedula: admin.cedula, nombre: admin.nombre, tipo: admin.tipo ?? 'Invita', areas: admin.areas ?? [] }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
      },
    );

    return { ok: true, usuario: admin.usuario };
  } catch {
    return { ok: false, message: 'Error de conexión. Intenta de nuevo.' };
  }
}

/* ─────────────────────────────────────────────────────────────   Admin — cédula + PIN
   ──────────────────────────────────────────────────────── */

export async function adminLoginCedula(
  cedula: string,
  pin: string,
): Promise<AdminLoginResult> {
  const ip = await getClientIp();
  if (!isAllowed(`admin-login:${ip}`, 10, 5 * 60_000)) {
    return { ok: false, message: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' };
  }

  if (!/^\d{4,}$/.test(cedula.trim()) || !/^\d{4}$/.test(pin)) {
    return { ok: false, message: 'Cédula o PIN incorrectos.' };
  }

  try {
    const admin = await findAdminByCedula(cedula.trim());
    if (!admin) {
      return { ok: false, message: 'Cédula o PIN incorrectos.' };
    }

    const expectedPin = cedula.trim().slice(-4);
    if (pin !== expectedPin) {
      return { ok: false, message: 'Cédula o PIN incorrectos.' };
    }

    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE,
      JSON.stringify({ id: admin.id, usuario: admin.usuario, cedula: admin.cedula, nombre: admin.nombre, tipo: admin.tipo ?? 'Invita', areas: admin.areas ?? [] }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
      },
    );

    return { ok: true, usuario: admin.usuario };
  } catch {
    return { ok: false, message: 'Error de conexión. Intenta de nuevo.' };
  }
}

/* ─────────────────────────────────────────────────────────────   Dashboard — aprobar / rechazar registros
   ───────────────────────────────────────────────────────── */

export type RegistroActionResult =
  | { ok: true }
  | { ok: false; message: string };

async function getSession(): Promise<{ id: string; usuario: string; cedula: string; nombre: string; tipo: string; areas: string[] } | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; usuario?: string; cedula?: string; nombre?: string; tipo?: string; areas?: string[] };
    // Cookie must have been set by our login (has an id field)
    if (!parsed.id) return null;
    return {
      id:      parsed.id,
      usuario: parsed.usuario || 'Administrador',
      cedula:  parsed.cedula  || '',
      nombre:  parsed.nombre  || '',
      tipo:    parsed.tipo ?? 'Invita',
      areas:   parsed.areas ?? [],
    };
  } catch {
    return null;
  }
}

// kept for backward compat (checkAdminUser / adminLogin legacy paths)
async function getSessionUsuario(): Promise<string | null> {
  const s = await getSession();
  return s?.usuario ?? null;
}

export async function approveRegistro(id: string): Promise<RegistroActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'No autorizado.' };
  if (session.tipo !== 'Autoriza') return { ok: false, message: 'No tienes permiso para aprobar registros.' };

  const ok = await updateRegistroStatus(id, 'APROBADO', { supervisor: session.usuario });
  return ok ? { ok: true } : { ok: false, message: 'Error al actualizar el registro.' };
}

export async function rejectRegistro(
  id: string,
  comment: string,
): Promise<RegistroActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'No autorizado.' };
  if (session.tipo !== 'Autoriza') return { ok: false, message: 'No tienes permiso para rechazar registros.' };

  const ok = await updateRegistroStatus(id, 'NEGADO', {
    supervisor: session.usuario,
    comment: comment.trim() || 'Rechazado por administrador.',
    rejected_time: new Date().toISOString(),
  });
  return ok ? { ok: true } : { ok: false, message: 'Error al actualizar el registro.' };
}

/* ─────────────────────────────────────────────────────────────
   Placas — autorización
   ───────────────────────────────────────────────────────── */

export async function authorizePlaca(id: string): Promise<RegistroActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'No autorizado.' };
  if (session.tipo !== 'Autoriza') return { ok: false, message: 'Sin permiso.' };
  const adminName = `${session.cedula} - ${session.nombre || session.usuario}`.replace(/^-\s*/, '').trim();
  const ok = await updatePlacaAutorizado(id, true, adminName);
  return ok ? { ok: true } : { ok: false, message: 'Error al autorizar la placa.' };
}

export async function unauthorizePlaca(id: string): Promise<RegistroActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'No autorizado.' };
  if (session.tipo !== 'Autoriza') return { ok: false, message: 'Sin permiso.' };
  const ok = await updatePlacaAutorizado(id, false);
  return ok ? { ok: true } : { ok: false, message: 'Error al revocar la placa.' };
}

export async function denyPlaca(id: string): Promise<RegistroActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'No autorizado.' };
  if (session.tipo !== 'Autoriza') return { ok: false, message: 'Sin permiso.' };
  const ok = await updatePlacaAutorizado(id, false, undefined, 'RECHAZADO');
  return ok ? { ok: true } : { ok: false, message: 'Error al denegar la placa.' };
}

/* ─────────────────────────────────────────────────────────────
   Personas — autorización
   ───────────────────────────────────────────────────────── */

export async function authorizePersona(id: string): Promise<RegistroActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'No autorizado.' };
  if (session.tipo !== 'Autoriza') return { ok: false, message: 'Sin permiso.' };
  const adminName = `${session.cedula} - ${session.nombre || session.usuario}`.replace(/^-\s*/, '').trim();
  const ok = await updatePersonaAutorizado(id, true, adminName);
  return ok ? { ok: true } : { ok: false, message: 'Error al autorizar la persona.' };
}

export async function unauthorizePersona(id: string): Promise<RegistroActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'No autorizado.' };
  if (session.tipo !== 'Autoriza') return { ok: false, message: 'Sin permiso.' };
  const ok = await updatePersonaAutorizado(id, false);
  return ok ? { ok: true } : { ok: false, message: 'Error al revocar la persona.' };
}

export async function denyPersona(id: string): Promise<RegistroActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'No autorizado.' };
  if (session.tipo !== 'Autoriza') return { ok: false, message: 'Sin permiso.' };
  const ok = await updatePersonaAutorizado(id, false, undefined, 'RECHAZADO');
  return ok ? { ok: true } : { ok: false, message: 'Error al denegar la persona.' };
}

/* ─────────────────────────────────────────────────────────────
   Programación Semanal (FinDeSemana)
   ───────────────────────────────────────────────────────── */

export interface ProgramacionResult {
  ok: boolean;
  count?: number;
  message?: string;
}

export async function submitProgramacionSemanal(
  personas: Array<{
    cedula: string;
    nombre: string;
    area?: string;
    fechaInicio?: string; // ISO UTC
    fechaFin?: string;    // ISO UTC
    notas?: string;
  }>,
  sessionNotes?: string,
): Promise<ProgramacionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'No autorizado.' };
  if (session.tipo !== 'Superadmin') return { ok: false, message: 'Solo el Superadmin puede acceder a esta función.' };
  if (!personas.length) return { ok: false, message: 'Agrega al menos una persona.' };

  const records: FinDeSemanaPersona[] = personas.map(p => {
    const resumenParts = [sessionNotes?.trim(), p.notas?.trim()].filter(Boolean);
    return {
      cedula: p.cedula.trim(),
      nombre: p.nombre.trim(),
      ...(p.area?.trim()      && { area: p.area.trim() }),
      ...(p.fechaInicio       && { fecha_inicio: p.fechaInicio }),
      ...(p.fechaFin          && { fecha_fin: p.fechaFin }),
      ...(resumenParts.length && { resumen: resumenParts.join('\n\n') }),
    };
  });

  const result = await createFinDeSemanaRecords(records);
  if (!result.ok) return { ok: false, message: result.error ?? 'Error al guardar.' };
  return { ok: true, count: result.ids?.length ?? 0 };
}

/* ─────────────────────────────────────────────────────────────
   Items — Órdenes de salida
   ───────────────────────────────────────────────────────── */

export interface OrdenSalidaResult {
  ok: boolean;
  id?: string;
  message?: string;
}

export async function submitOrdenSalida(
  fields: ItemCreateFields,
): Promise<OrdenSalidaResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'No autorizado.' };
  if (session.tipo !== 'Superadmin') return { ok: false, message: 'Solo el Superadmin puede registrar órdenes de salida.' };

  if (!fields.nombre.trim()) return { ok: false, message: 'El nombre es obligatorio.' };
  if (!fields.cedula.trim()) return { ok: false, message: 'La cédula es obligatoria.' };

  const result = await createItem(fields);
  if (!result.ok) return { ok: false, message: result.error ?? 'Error al guardar.' };
  return { ok: true, id: result.id };
}
