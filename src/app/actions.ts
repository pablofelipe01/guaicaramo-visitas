'use server';

import { cookies, headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import {
  // findPlacaByPlaca,  // TODO: descomentar cuando se active la lógica de autorización por placa
  createRegistro,
  findAdminByUsuario,
  updateAdminPassword,
  updateRegistroStatus,
} from '@/lib/airtable';
import { isAllowed } from '@/lib/rate-limit';

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
): Promise<VisitorResult> {
  // Rate limit: máx. 5 solicitudes por IP cada 60 segundos
  const ip = await getClientIp();
  if (!isAllowed(`visitor:${ip}`, 5, 60_000)) {
    return { status: 'ERROR', message: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.' };
  }

  const placaUpper = placa.toUpperCase().trim();
  const cedulaTrim = cedula.trim();
  const now = new Date().toISOString();

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

    const nombreTrim = nombre.trim();

    // Registro del conductor principal
    const pendientes: Promise<string | null>[] = [
      createRegistro({
        placa: placaUpper,
        tipo: 'MANUAL',
        cedula: cedulaTrim,
        entry_time: now,
        approved_by: 'GATEWAY',
        status: 'PENDIENTE',
        nombre_visitante: nombreTrim,
        motivo_visita: motivoTrim,
        nodo_origen: 'WEB',
      }),
    ];

    // Un registro por cada acompañante, placa compartida
    for (const ac of (acompanantes ?? [])) {
      pendientes.push(createRegistro({
        placa: placaUpper,
        tipo: 'MANUAL',
        cedula: ac.cedula.trim(),
        entry_time: now,
        approved_by: 'GATEWAY',
        status: 'PENDIENTE',
        nombre_visitante: ac.nombre.trim(),
        comment: `Acompañante de: ${nombreTrim} (cédula: ${cedulaTrim})`,
        motivo_visita: motivoTrim,
        nodo_origen: 'WEB',
      }));
    }

    await Promise.all(pendientes);
    return { status: 'PENDIENTE' };
  } catch {
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
      'g-session',
      JSON.stringify({ id: admin.id, usuario: admin.usuario }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8, // 8 horas
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
      'g-session',
      JSON.stringify({ id: admin.id, usuario: admin.usuario }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8,
      },
    );

    return { ok: true, usuario: admin.usuario };
  } catch {
    return { ok: false, message: 'Error de conexión. Intenta de nuevo.' };
  }
}

/* ─────────────────────────────────────────────────────────────
   Dashboard — aprobar / rechazar registros
   ───────────────────────────────────────────────────────── */

export type RegistroActionResult =
  | { ok: true }
  | { ok: false; message: string };

async function getSessionUsuario(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get('g-session')?.value;
    if (!raw) return null;
    const { usuario } = JSON.parse(raw) as { usuario: string };
    return usuario ?? null;
  } catch {
    return null;
  }
}

export async function approveRegistro(id: string): Promise<RegistroActionResult> {
  const usuario = await getSessionUsuario();
  if (!usuario) return { ok: false, message: 'No autorizado.' };

  const ok = await updateRegistroStatus(id, 'APROBADO', { supervisor: usuario });
  return ok ? { ok: true } : { ok: false, message: 'Error al actualizar el registro.' };
}

export async function rejectRegistro(
  id: string,
  comment: string,
): Promise<RegistroActionResult> {
  const usuario = await getSessionUsuario();
  if (!usuario) return { ok: false, message: 'No autorizado.' };

  const ok = await updateRegistroStatus(id, 'NEGADO', {
    supervisor: usuario,
    comment: comment.trim() || 'Rechazado por administrador.',
    rejected_time: new Date().toISOString(),
  });
  return ok ? { ok: true } : { ok: false, message: 'Error al actualizar el registro.' };
}
