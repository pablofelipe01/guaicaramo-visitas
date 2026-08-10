import { type NextRequest } from 'next/server';
import {
  getRegistroById,
  getPersonaById,
  getPlacaById,
  getAreaDestinoDeRegistro,
  getAreaDestinoDeVisitante,
  getAdminsAutorizaConPush,
} from '@/lib/airtable';
import { sendPush } from '@/lib/webpush';
import type { PersonaRecord, PlacaRecord } from '@/lib/airtable';

/**
 * Notificación informativa de INGRESO para Superadmin.
 *
 * Airtable llama este endpoint cuando se registra la entrada de un visitante
 * que ya estaba autorizado. Soporta dos disparadores:
 *
 *   1. tableName: 'REGISTROS'          → se creó un registro con tipo ENTRADA
 *   2. tableName: 'PERSONAS'|'PLACAS'  → se marcó el ingreso sobre el visitante
 *                                        (nodo_origen) y ya estaba AUTORIZADO
 *
 * Este endpoint es de solo lectura: no escribe nada en Airtable, no toca los
 * webhooks existentes y solo envía push a los admins con tipo Superadmin.
 */
interface WebhookBody {
  recordId?: string;
  tableName?: 'REGISTROS' | 'PERSONAS' | 'PLACAS';
  nodo?: string; // opcional — normalmente ya viene en el registro, útil para logs
}

const LOG = '[webhook/ingreso-autorizado]';

export async function POST(request: NextRequest): Promise<Response> {
  // 1. Validar el secret compartido con Airtable
  const secret = request.headers.get('x-airtable-secret');
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    console.warn(`${LOG} Secret inválido o ausente`);
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
  if (tableName !== 'REGISTROS' && tableName !== 'PERSONAS' && tableName !== 'PLACAS') {
    return Response.json(
      { error: 'tableName debe ser REGISTROS, PERSONAS o PLACAS' },
      { status: 400 },
    );
  }

  // 3. Re-leer el registro desde Airtable y extraer los datos del ingreso
  let nombre: string;
  let cedula: string;
  let nodo: string;
  let areaDestino: string | undefined;

  if (tableName === 'REGISTROS') {
    const registro = await getRegistroById(recordId);
    if (!registro) {
      console.error(`${LOG} Registro ${recordId} no encontrado en REGISTROS`);
      return Response.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    // Guardia: solo ingresos efectivos (entrada aprobada). Salidas y registros
    // negados/pendientes se ignoran sin error para no reintentar en Airtable.
    if (registro.tipo !== 'ENTRADA') {
      return Response.json({ ok: true, skipped: 'no_es_entrada', tipo: registro.tipo });
    }
    if (registro.status !== 'APROBADO') {
      return Response.json({ ok: true, skipped: 'entrada_no_aprobada', status: registro.status });
    }

    nombre =
      registro.nombre_visitante ||
      registro.nombres_personas?.[0] ||
      registro.conductores?.[0] ||
      'Visitante';
    cedula = registro.cedula;
    nodo = registro.nodo_origen ?? body.nodo ?? 'Portería';
    areaDestino = await getAreaDestinoDeRegistro(registro);
  } else {
    const record: PersonaRecord | PlacaRecord | null =
      tableName === 'PERSONAS' ? await getPersonaById(recordId) : await getPlacaById(recordId);

    if (!record) {
      console.error(`${LOG} Registro ${recordId} no encontrado en ${tableName}`);
      return Response.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    // Guardia: este webhook es solo para visitantes YA autorizados. Los que
    // están pendientes los cubre /api/webhook/porteria-intento.
    const yaAutorizado = record.estado === 'AUTORIZADO' || record.autorizado === true;
    if (!yaAutorizado) {
      return Response.json({ ok: true, skipped: 'no_autorizado', estado: record.estado });
    }

    nombre =
      tableName === 'PERSONAS'
        ? (record as PersonaRecord).nombre
        : (record as PlacaRecord).conductor;
    cedula = record.cedula;
    nodo = record.nodo_origen ?? body.nodo ?? 'Portería';
    areaDestino = await getAreaDestinoDeVisitante(tableName, recordId);
  }

  // 4. Destinatarios: únicamente Superadmin con push_subscription registrada
  const admins = await getAdminsAutorizaConPush();
  const superadmins = admins.filter(a => a.tipo === 'Superadmin' && a.push_subscription);

  if (!superadmins.length) {
    console.warn(`${LOG} Sin superadmins con push_subscription — notificación omitida`);
    return Response.json({ ok: true, notified: 0, reason: 'sin_suscriptores' });
  }

  // 5. Payload informativo: quién ingresa y hacia dónde va
  const destino = areaDestino ?? 'área no especificada';
  const payload = {
    title: `🚪 Ingreso a la plantación — ${nodo}`,
    body: `${nombre} (CC ${cedula}) está ingresando y se dirige a ${destino}.`,
    url: '/dashboard',
    tag: `ingreso-${recordId}`,
  };

  // 6. Enviar push en paralelo, tolerando fallos individuales
  const results = await Promise.allSettled(
    superadmins.map(admin => sendPush(admin.push_subscription!, payload)),
  );

  const notified = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  console.log(
    `${LOG} Notificados: ${notified}/${superadmins.length} ` +
    `(área: "${destino}") — ${nombre} (${cedula}) en ${nodo}`,
  );

  return Response.json({ ok: true, notified, areaDestino });
}
