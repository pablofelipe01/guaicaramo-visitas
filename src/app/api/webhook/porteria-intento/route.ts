import { type NextRequest } from 'next/server';
import { getPersonaById, getPlacaById, getAdminsAutorizaConPush } from '@/lib/airtable';
import { sendPush } from '@/lib/webpush';

// Airtable llama este endpoint cuando nodo_origen se llena en PERSONAS o PLACAS.
// El body que envía Airtable se configura en la automatización (ver README de la automatización).
interface WebhookBody {
  recordId?: string;
  tableName?: 'PERSONAS' | 'PLACAS';
  nodo?: string; // opcional — ya viene en el registro, pero útil para logs rápidos
}

export async function POST(request: NextRequest): Promise<Response> {
  // 1. Validar el secret compartido con Airtable
  const secret = request.headers.get('x-airtable-secret');
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    console.warn('[webhook/porteria-intento] Secret inválido o ausente');
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
    console.error(`[webhook/porteria-intento] Registro ${recordId} no encontrado en ${tableName}`);
    return Response.json({ error: 'Registro no encontrado' }, { status: 404 });
  }

  // 4. Guardia: si la persona ya fue autorizada entre el disparo y la llegada del webhook, no notificar
  if (record.estado === 'AUTORIZADO' || record.autorizado === true) {
    return Response.json({ ok: true, skipped: 'ya_autorizado' });
  }

  // 5. Extraer datos del visitante para los mensajes
  const nombre = tableName === 'PERSONAS'
    ? (record as import('@/lib/airtable').PersonaRecord).nombre
    : (record as import('@/lib/airtable').PlacaRecord).conductor;
  const cedula     = record.cedula;
  const nodo       = record.nodo_origen ?? body.nodo ?? 'Portería';
  const motivo     = record.notas ? ` — ${record.notas}` : '';

  // 6. Obtener admins Autoriza y Superadmin con push_subscription registrada
  const admins     = await getAdminsAutorizaConPush();
  const conPush    = admins.filter(a => a.push_subscription);

  if (!conPush.length) {
    console.warn('[webhook/porteria-intento] Sin admins con push_subscription — notificación omitida');
    return Response.json({ ok: true, notified: 0, reason: 'sin_suscriptores' });
  }

  // 7. Construir payloads diferenciados por rol
  //    Autoriza → notificación accionable con link directo al registro
  //    Superadmin → informativa, sin presión de acción
  const payloadAutoriza = {
    title: `🔔 Solicitud de ingreso — ${nodo}`,
    body: `${nombre} (CC ${cedula}) espera autorización${motivo}.`,
    url: `/dashboard?panel=autoriza&id=${recordId}`,
    tag: `porteria-${recordId}`,
  };

  const payloadSuperadmin = {
    title: `ℹ️ Intento de ingreso — ${nodo}`,
    body: `${nombre} (CC ${cedula}) está en portería. Un autorizador fue notificado.`,
    url: `/dashboard`,
    tag: `porteria-info-${recordId}`,
  };

  // 8. Enviar push en paralelo, tolerando fallos individuales
  const results = await Promise.allSettled(
    conPush.map(admin =>
      sendPush(
        admin.push_subscription!,
        admin.tipo === 'Autoriza' ? payloadAutoriza : payloadSuperadmin,
      ),
    ),
  );

  const notified = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  console.log(`[webhook/porteria-intento] Notificados: ${notified}/${conPush.length} — ${nombre} (${cedula})`);

  return Response.json({ ok: true, notified });
}
