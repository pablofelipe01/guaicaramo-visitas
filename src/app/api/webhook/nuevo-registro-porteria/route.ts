import { type NextRequest } from 'next/server';
import {
  getPersonaById,
  getPlacaById,
  updatePersonaVence,
  updatePlacaVence,
  getAdminsAutorizaConPush,
} from '@/lib/airtable';
import { sendPush } from '@/lib/webpush';
import type { AdminPushRecord } from '@/lib/airtable';

// Airtable llama este endpoint cuando se crea un registro NUEVO desde portería.
// La automatización detecta registros creados desde portería y envía el ID.
interface WebhookBody {
  recordId?: string;
  tableName?: 'PERSONAS' | 'PLACAS';
  nodo?: string; // opcional — nodo de portería desde donde se registró
}

/**
 * Mapeo de áreas de usuario → áreas destino que puede autorizar.
 * Un admin con área X puede autorizar visitas hacia áreas destino Y, Z.
 *
 * Ejemplo:
 *   Admin con área "Logistica y transporte" → puede autorizar visitas a "Báscula y almacén" y "Logistica y transporte"
 */
const AREAS_DESTINO_PERMITIDAS: Record<string, string[]> = {
  'Logistica y transporte': ['Báscula y almacén', 'Logistica y transporte'],
  // Agregar más mapeos según se requiera
  // 'Administración': ['Administración', 'Oficinas generales'],
  // 'Producción': ['Producción', 'Planta', 'Almacén'],
};

/**
 * Determina si un admin debe recibir notificación para un área destino específica.
 *
 * Lógica:
 * - Superadmin: siempre recibe (sin filtro de área)
 * - Autoriza sin áreas asignadas: recibe todas las notificaciones
 * - Autoriza con áreas: solo recibe si el área destino del visitante está en su mapeo
 */
function debeNotificar(admin: AdminPushRecord, areaDestinoVisitante: string | undefined): boolean {
  // Superadmin: siempre recibe
  if (admin.tipo === 'Superadmin') {
    return true;
  }

  // Autoriza sin áreas asignadas: recibe todo (backward compatibility)
  if (!admin.areas || admin.areas.length === 0) {
    return true;
  }

  // Si el visitante no tiene área destino, no notificar (no hay forma de matchear)
  if (!areaDestinoVisitante) {
    return false;
  }

  // Autoriza con áreas: verificar si alguna de sus áreas mapea al área destino del visitante
  for (const areaAdmin of admin.areas) {
    const destinosPermitidos = AREAS_DESTINO_PERMITIDAS[areaAdmin] || [areaAdmin];
    if (destinosPermitidos.includes(areaDestinoVisitante)) {
      return true;
    }
  }

  return false;
}

/**
 * Calcula fecha de vencimiento: mismo día que la fecha de creación, hora 5:00 PM en zona horaria Colombia.
 *
 * @param creada - ISO datetime UTC de creación del registro (ej: "2026-07-14T15:30:00.000Z")
 * @returns ISO datetime UTC para vencimiento a las 5:00 PM Colombia del mismo día
 */
function calcularVencimiento(creada: string): string {
  const tzOffset = process.env.APP_TZ_OFFSET ?? '-05:00';
  const offsetHours = parseInt(tzOffset.split(':')[0], 10); // -5

  // Convertir creada (UTC) a fecha local Colombia
  const fechaCreacion = new Date(creada);
  const fechaLocal = new Date(fechaCreacion.getTime() + (offsetHours * 3600000));

  // Mismo día, hora 5:00 PM Colombia
  const venceLocal = new Date(fechaLocal);
  venceLocal.setHours(17, 0, 0, 0); // 5:00 PM

  // Convertir de vuelta a UTC
  const venceUTC = new Date(venceLocal.getTime() - (offsetHours * 3600000));

  return venceUTC.toISOString();
}

export async function POST(request: NextRequest): Promise<Response> {
  // 1. Validar el secret compartido con Airtable
  const secret = request.headers.get('x-airtable-secret');
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    console.warn('[webhook/nuevo-registro-porteria] Secret inválido o ausente');
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  // 2. Parsear el body
  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { recordId, tableName } = body;
  if (!recordId || !tableName) {
    return Response.json({ error: 'Faltan recordId o tableName' }, { status: 400 });
  }
  if (tableName !== 'PERSONAS' && tableName !== 'PLACAS') {
    return Response.json({ error: 'tableName debe ser PERSONAS o PLACAS' }, { status: 400 });
  }

  // 3. Re-leer el registro desde Airtable para obtener datos frescos
  const record = tableName === 'PERSONAS'
    ? await getPersonaById(recordId)
    : await getPlacaById(recordId);

  if (!record) {
    console.error(`[webhook/nuevo-registro-porteria] Registro ${recordId} no encontrado en ${tableName}`);
    return Response.json({ error: 'Registro no encontrado' }, { status: 404 });
  }

  // 4. Guardia: si el registro ya tiene vencimiento, no procesar (no es registro nuevo de portería)
  if (record.vence) {
    console.warn(
      `[webhook/nuevo-registro-porteria] Registro ${recordId} ya tiene vencimiento — omitido`,
    );
    return Response.json({ ok: true, skipped: 'ya_tiene_vencimiento' });
  }

  // 5. Calcular y actualizar fecha de vencimiento (5:00 PM del día de creación)
  const creada = record.creada;
  if (!creada) {
    console.error(`[webhook/nuevo-registro-porteria] Registro ${recordId} sin fecha de creación`);
    return Response.json({ error: 'Registro sin fecha de creación' }, { status: 400 });
  }

  const venceISO = calcularVencimiento(creada);
  const updateOk = tableName === 'PERSONAS'
    ? await updatePersonaVence(recordId, venceISO)
    : await updatePlacaVence(recordId, venceISO);

  if (!updateOk) {
    console.error(`[webhook/nuevo-registro-porteria] Error actualizando vencimiento de ${recordId}`);
    return Response.json({ error: 'Error actualizando vencimiento' }, { status: 500 });
  }

  console.log(`[webhook/nuevo-registro-porteria] Vencimiento actualizado: ${recordId} → ${venceISO}`);

  // 6. Extraer datos del visitante para los mensajes
  const nombre = tableName === 'PERSONAS'
    ? (record as import('@/lib/airtable').PersonaRecord).nombre
    : (record as import('@/lib/airtable').PlacaRecord).conductor;
  const cedula         = record.cedula;
  const nodo           = record.nodo_origen ?? body.nodo ?? 'Portería';
  const motivo         = record.notas ? ` — ${record.notas}` : '';
  const areaDestino    = record.areas_destino; // área destino del visitante

  // 7. Obtener admins Autoriza y Superadmin con push_subscription registrada
  const admins     = await getAdminsAutorizaConPush();
  const conPush    = admins.filter(a => a.push_subscription);

  if (!conPush.length) {
    console.warn('[webhook/nuevo-registro-porteria] Sin admins con push_subscription — notificación omitida');
    return Response.json({ ok: true, notified: 0, reason: 'sin_suscriptores', venceActualizado: venceISO });
  }

  // 8. Filtrar admins según área destino del visitante
  const adminsANotificar = conPush.filter(admin => debeNotificar(admin, areaDestino));

  if (!adminsANotificar.length) {
    console.warn(
      `[webhook/nuevo-registro-porteria] Sin admins elegibles para área destino "${areaDestino}" — ${nombre} (${cedula})`,
    );
    return Response.json({
      ok: true,
      notified: 0,
      reason: 'sin_admins_para_area',
      areaDestino,
      venceActualizado: venceISO,
    });
  }

  // 9. Construir payloads diferenciados por rol
  //    Autoriza → notificación accionable con link directo al registro
  //    Superadmin → informativa
  const areaTag = areaDestino ? ` → ${areaDestino}` : '';
  const payloadAutoriza = {
    title: `⚠️ Nuevo visitante en portería — ${nodo}`,
    body: `${nombre} (CC ${cedula}) NO REGISTRADO${areaTag}. Requiere aprobación${motivo}.`,
    url: `/dashboard?panel=autoriza&id=${recordId}`,
    tag: `nuevo-registro-${recordId}`,
  };

  const payloadSuperadmin = {
    title: `ℹ️ Nuevo visitante — ${nodo}`,
    body: `${nombre} (CC ${cedula}) registrado desde portería${areaTag}. Un autorizador fue notificado.`,
    url: `/dashboard`,
    tag: `nuevo-registro-info-${recordId}`,
  };

  // 10. Enviar push en paralelo, tolerando fallos individuales (solo a admins filtrados por área)
  const results = await Promise.allSettled(
    adminsANotificar.map(admin =>
      sendPush(
        admin.push_subscription!,
        admin.tipo === 'Autoriza' ? payloadAutoriza : payloadSuperadmin,
      ),
    ),
  );

  const notified = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  console.log(
    `[webhook/nuevo-registro-porteria] Notificados: ${notified}/${adminsANotificar.length} ` +
    `(área: "${areaDestino}") — ${nombre} (${cedula}) — vence: ${venceISO}`,
  );

  return Response.json({ ok: true, notified, areaDestino, venceActualizado: venceISO });
}
