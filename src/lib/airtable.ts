/**
 * Airtable REST client — Guaicaramo Visitas
 * Sólo se ejecuta en el servidor (importado desde Server Actions).
 * Configuración vía variables de entorno (.env.local).
 */

const BASE_ID = process.env.AIRTABLE_BASE_ID;

function getTable(name: 'ADMINISTRADORES' | 'PLACAS' | 'REGISTROS' | 'PERSONAS' | 'FINDE_SEMANA' | 'ITEMS'): string {
  const env: Record<string, string | undefined> = {
    ADMINISTRADORES: process.env.AIRTABLE_TABLE_ADMINISTRADORES,
    PLACAS:          process.env.AIRTABLE_TABLE_PLACAS,
    REGISTROS:       process.env.AIRTABLE_TABLE_REGISTROS,
    PERSONAS:        process.env.AIRTABLE_TABLE_PERSONAS,
    FINDE_SEMANA:    process.env.AIRTABLE_TABLE_FINDE_SEMANA,
    ITEMS:           process.env.AIRTABLE_TABLE_ITEMS,
  };
  const val = env[name];
  if (!val) throw new Error(`Falta variable de entorno AIRTABLE_TABLE_${name}`);
  return val;
}

function apiUrl(table: string) {
  if (!BASE_ID) throw new Error('Falta variable de entorno AIRTABLE_BASE_ID');
  return `https://api.airtable.com/v0/${BASE_ID}/${table}`;
}

function authHeaders() {
  const key = process.env.AIRTABLE_GUAICARAMO_VISITAS_API_KEY;
  if (!key) throw new Error('AIRTABLE_GUAICARAMO_VISITAS_API_KEY not set');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

// Referencia al fetch nativo para usar dentro del wrapper de reintento sin recursión.
const nativeFetch = fetch;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * fetch con reintento ante rate limit (429) y errores transitorios del servidor (5xx).
 * Airtable limita a ~5 req/seg por base; los registros de visita disparan varias
 * escrituras en paralelo, por lo que sin reintento se pierden vínculos "a veces".
 * Respeta el header `Retry-After` cuando viene; si no, usa backoff exponencial con jitter.
 * No reintenta ante 4xx (excepto 429) porque son fallas del cliente, no transitorias.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 4,
): Promise<Response> {
  let res: Response | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      res = await nativeFetch(url, init);
    } catch (networkErr) {
      // Error de red (DNS, conexión perdida) — reintentar si quedan intentos.
      if (i === attempts - 1) throw networkErr;
      await sleep(Math.min(2 ** i * 500, 4000) + Math.floor(Math.random() * 250));
      continue;
    }
    if (res.ok) return res;
    if (res.status !== 429 && res.status < 500) return res; // 4xx no transitorio
    if (i === attempts - 1) return res;
    const retryAfter = Number(res.headers.get('Retry-After'));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(2 ** i * 500, 4000) + Math.floor(Math.random() * 250);
    await sleep(backoff);
  }
  return res!;
}

/** Elimina registros en lotes de 10 (límite de Airtable). */
async function deleteRecords(table: string, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const q = new URLSearchParams();
    batch.forEach(id => q.append('records[]', id));
    await fetchWithRetry(`${apiUrl(table)}?${q.toString()}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  }
}

/** Elimina solicitudes de Placas (usado para limpiar registros huérfanos). */
export async function deletePlacas(ids: string[]): Promise<void> {
  return deleteRecords(getTable('PLACAS'), ids);
}

/** Elimina registros de Personas (usado para limpiar registros huérfanos). */
export async function deletePersonas(ids: string[]): Promise<void> {
  return deleteRecords(getTable('PERSONAS'), ids);
}

/** Pagina a través de todos los registros de una tabla sin límite artificial. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllRecords(table: string, params: URLSearchParams): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  let offset: string | undefined;
  do {
    const q = new URLSearchParams(params);
    if (offset) q.set('offset', offset);
    const res = await fetchWithRetry(`${apiUrl(table)}?${q.toString()}`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
    // No truncar en silencio: si una página falla tras reintentos, devolver una
    // lista parcial ocultaría visitantes registrados. Mejor fallar de forma visible.
    if (!res.ok) {
      throw new Error(`Error ${res.status} al leer "${table}" desde Airtable`);
    }
    const data = await res.json();
    all.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset);
  return all;
}

/* ─────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────── */

export interface PlacaRecord {
  id: string;
  placa: string;
  cedula: string;
  conductor: string;
  autorizado: boolean;
  estado?: 'PENDIENTE' | 'AUTORIZADO' | 'RECHAZADO';
  vence?: string;   // ISO date "YYYY-MM-DD"
  notas?: string;
  adminIds?: string[];  // linked Administradores record IDs
  responsable_visita?: string;  // quien registró la solicitud
  autoriza_visita?: string;     // quien autorizó la visita
  fecha_autorizado?: string;    // ISO datetime en que se autorizó
  creada?: string;              // ISO datetime de creación del registro
  acompañanteIds?: string[];  // linked Personas record IDs (acompañantes en el vehículo)
}

export interface RegistroCreateFields {
  placa: string;
  tipo: 'ENTRADA' | 'SALIDA' | 'MANUAL' | 'SALIDA_SIN_ENTRADA';
  cedula: string;
  entry_time: string;
  exit_time?: string;
  approved_by: string;
  status: 'APROBADO' | 'NEGADO' | 'PENDIENTE' | 'SALIDA_SIN_ENTRADA';
  supervisor?: string;
  comment?: string;
  rejected_time?: string;
  nodo_origen?: string;
  motivo_visita?: string;
  nombre_visitante?: string;
}

export interface PersonaCreateFields {
  cedula: string;
  nombre: string;
  cargo?: string;
  notas?: string;
  vence?: string; // ISO date "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm:ss.sssZ"
  registrado_por?: string;
  adminId?: string;
}

export interface PersonaRecord {
  id: string;
  cedula: string;
  nombre: string;
  autorizado: boolean;
  estado?: 'PENDIENTE' | 'AUTORIZADO' | 'RECHAZADO';
  vence?: string;
  cargo?: string;
  notas?: string;
  adminIds?: string[];
  responsable_visita?: string;  // quien registró la solicitud
  autoriza_visita?: string;     // quien autorizó la visita
  fecha_autorizado?: string;    // ISO datetime en que se autorizó
  creada?: string;              // ISO datetime de creación del registro
  acompañanteIds?: string[];
}

export interface AdminRecord {
  id: string;
  usuario: string;
  cedula: string;
  nombre: string;
  contraseña: string;
  tipo?: 'Invita' | 'Autoriza' | 'Superadmin' | 'Porteria';
  areas?: string[];
}

export interface RegistroRecord {
  id: string;
  placa: string;
  tipo: string;
  cedula: string;
  entry_time: string;
  exit_time?: string;
  approved_by?: string;
  status: 'APROBADO' | 'NEGADO' | 'PENDIENTE' | 'SALIDA_SIN_ENTRADA';
  supervisor?: string;
  comment?: string;
  motivo_visita?: string;
  nodo_origen?: string;
  rejected_time?: string;
  nombre_visitante?: string;
  // New fields from Registros table
  categoria?: 'VEHICULO' | 'PEATON' | 'FIN_DE_SEMANA';
  acompanantes?: string;
  conductores?: string[];        // lookup: conductor (from Placas)
  notas_placas?: string[];       // lookup: notas (from Placas)
  nombres_personas?: string[];   // lookup: nombre (from Personas)
  notas_personas?: string[];     // lookup: notas (from Personas)
  placaIds?: string[];           // linked Placas record IDs
  personaIds?: string[];         // linked Personas record IDs
}

/* ─────────────────────────────────────────────────────────────
   Placas
   ───────────────────────────────────────────────────────── */

export async function findPlacaByPlaca(placa: string): Promise<PlacaRecord | null> {
  const formula = encodeURIComponent(`{placa}="${placa.toUpperCase()}"`);
  const res = await fetchWithRetry(
    `${apiUrl(getTable('PLACAS'))}?filterByFormula=${formula}&maxRecords=1`,
    { headers: authHeaders(), cache: 'no-store' },
  );

  if (!res.ok) return null;

  const data = await res.json();
  if (!data.records?.length) return null;

  const r = data.records[0];
  return {
    id: r.id,
    placa: r.fields.placa ?? '',
    cedula: r.fields.cedula ?? '',
    conductor: r.fields.conductor ?? '',
    autorizado: r.fields.autorizado === true,
    estado: r.fields.estado ?? undefined,
    vence: r.fields.vence,
    notas: r.fields.notas,
    acompañanteIds: r.fields.Acompañantes ?? [],
  };
}

/**
 * Crea una solicitud de visita en la tabla Placas.
 * autorizado = false hasta que un administrador la apruebe.
 */
export async function createPlacaSolicitud(fields: {
  placa: string;
  cedula: string;
  conductor: string;
  notas?: string;
  vence?: string;
  registrado_por?: string;
  adminId?: string;
}): Promise<string | null> {
  const body = {
    records: [{
      fields: {
        placa:     fields.placa,
        cedula:    fields.cedula,
        conductor: fields.conductor,
        autorizado: false,
        estado: 'PENDIENTE',
        ...(fields.notas           ? { notas:              fields.notas              } : {}),
        ...(fields.vence           ? { vence:              fields.vence              } : {}),
        ...(fields.registrado_por  ? { responsable_visita: fields.registrado_por     } : {}),
        ...(fields.adminId         ? { Administradores:    [fields.adminId]          } : {}),
      },
    }],
  };
  const res = await fetchWithRetry(apiUrl(getTable('PLACAS')), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.records?.[0]?.id ?? null;
}

/**
 * Crea un registro en la tabla Personas (peatones / visitantes sin vehículo).
 * autorizado = false hasta que un administrador la apruebe.
 */
export async function createPersona(fields: PersonaCreateFields): Promise<string | null> {
  const body = {
    records: [{
      fields: {
        cedula:  fields.cedula,
        nombre:  fields.nombre,
        autorizado: false,
        estado: 'PENDIENTE',
        ...(fields.cargo           ? { cargo:              fields.cargo              } : {}),
        ...(fields.notas           ? { notas:              fields.notas              } : {}),
        ...(fields.vence           ? { vence:              fields.vence              } : {}),
        ...(fields.registrado_por  ? { responsable_visita: fields.registrado_por     } : {}),
        ...(fields.adminId         ? { Administradores:    [fields.adminId]          } : {}),
      },
    }],
  };
  const res = await fetchWithRetry(apiUrl(getTable('PERSONAS')), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.records?.[0]?.id ?? null;
}

/* ─────────────────────────────────────────────────────────────
   Registros
   ───────────────────────────────────────────────────────── */

export async function createRegistro(fields: RegistroCreateFields): Promise<string | null> {
  const res = await fetchWithRetry(apiUrl(getTable('REGISTROS')), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ records: [{ fields }] }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.records?.[0]?.id ?? null;
}

/* ─────────────────────────────────────────────────────────────
   Administradores
   ───────────────────────────────────────────────────────── */

export async function findAdminByUsuario(usuario: string): Promise<AdminRecord | null> {
  // Escape double quotes in the usuario value to prevent formula injection
  const safe = usuario.replace(/"/g, '\\"');
  const formula = encodeURIComponent(`{usuario}="${safe}"`);
  const res = await fetchWithRetry(
    `${apiUrl(getTable('ADMINISTRADORES'))}?filterByFormula=${formula}&maxRecords=1`,
    { headers: authHeaders(), cache: 'no-store' },
  );

  if (!res.ok) return null;

  const data = await res.json();
  if (!data.records?.length) return null;

  const r = data.records[0];
  return {
    id: r.id,
    usuario: r.fields.usuario ?? '',
    cedula: r.fields.cedula ?? '',
    nombre: r.fields.nombre ?? '',
    contraseña: r.fields['contraseña'] ?? '',
    tipo: r.fields.tipo ?? undefined,
    areas: r.fields.areas ?? [],
  };
}

export async function findAdminByCedula(cedula: string): Promise<AdminRecord | null> {
  const safe = cedula.replace(/"/g, '\\"');
  const formula = encodeURIComponent(`{cedula}="${safe}"`);
  const res = await fetchWithRetry(
    `${apiUrl(getTable('ADMINISTRADORES'))}?filterByFormula=${formula}&maxRecords=1`,
    { headers: authHeaders(), cache: 'no-store' },
  );

  if (!res.ok) return null;

  const data = await res.json();
  if (!data.records?.length) return null;

  const r = data.records[0];
  return {
    id: r.id,
    usuario: r.fields.usuario ?? '',
    cedula: r.fields.cedula ?? '',
    nombre: r.fields.nombre ?? '',
    contraseña: r.fields['contraseña'] ?? '',
    tipo: r.fields.tipo ?? undefined,
    areas: r.fields.areas ?? [],
  };
}

/**
 * Actualiza el campo `contraseña` de un administrador con un hash bcrypt.
 * Solo se llama cuando el admin no tiene contraseña registrada todavía.
 */
export async function updateAdminPassword(id: string, hashedPassword: string): Promise<boolean> {
  const res = await fetchWithRetry(`${apiUrl(getTable('ADMINISTRADORES'))}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields: { contraseña: hashedPassword } }),
  });
  return res.ok;
}

/* ─────────────────────────────────────────────────────────────
   Registros — lectura y actualización de estado
   ───────────────────────────────────────────────────────── */

/** Devuelve todos los registros ordenados por fecha de entrada (más recientes primero). */
export async function getRegistros(): Promise<RegistroRecord[]> {
  const params = new URLSearchParams({
    'sort[0][field]': 'entry_time',
    'sort[0][direction]': 'desc',
  });
  const records = await fetchAllRecords(getTable('REGISTROS'), params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return records.map((r: any): RegistroRecord => ({
    id: r.id,
    placa: r.fields.placa ?? '',
    tipo: r.fields.tipo ?? '',
    cedula: r.fields.cedula ?? '',
    entry_time: r.fields.entry_time ?? '',
    exit_time: r.fields.exit_time,
    approved_by: r.fields.approved_by,
    status: r.fields.status ?? 'PENDIENTE',
    supervisor: r.fields.supervisor,
    comment: r.fields.comment,
    motivo_visita: r.fields.motivo_visita,
    nodo_origen: r.fields.nodo_origen,
    rejected_time: r.fields.rejected_time,
    nombre_visitante: r.fields.nombre_visitante,
    categoria: r.fields.categoria,
    acompanantes: r.fields.acompanantes,
    conductores: r.fields['conductor (from Placas)'] ?? [],
    notas_placas: r.fields['notas (from Placas)'] ?? [],
    nombres_personas: r.fields['nombre (from Personas)'] ?? [],
    notas_personas: r.fields['notas (from Personas)'] ?? [],
    placaIds: r.fields['Placas'] ?? [],
    personaIds: r.fields['Personas'] ?? [],
  }));
}

/** Actualiza el estado de un registro (APROBADO o NEGADO). */
export async function updateRegistroStatus(
  id: string,
  status: 'APROBADO' | 'NEGADO',
  extra?: { comment?: string; supervisor?: string; rejected_time?: string },
): Promise<boolean> {
  const fields: Record<string, string> = { status };
  if (extra?.comment)        fields.comment = extra.comment;
  if (extra?.supervisor)     fields.supervisor = extra.supervisor;
  if (extra?.rejected_time)  fields.rejected_time = extra.rejected_time;

  const res = await fetchWithRetry(`${apiUrl(getTable('REGISTROS'))}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields }),
  });
  return res.ok;
}

/* ─────────────────────────────────────────────────────────────
   Placas — lista y autorización
   ───────────────────────────────────────────────────────── */

/** Devuelve todos los registros de la tabla Placas ordenados por placa. */
export async function getPlacas(): Promise<PlacaRecord[]> {
  const params = new URLSearchParams({
    'sort[0][field]': 'placa',
    'sort[0][direction]': 'asc',
  });
  const records = await fetchAllRecords(getTable('PLACAS'), params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return records.map((r: any): PlacaRecord => ({
    id: r.id,
    placa:      r.fields.placa      ?? '',
    cedula:     r.fields.cedula     ?? '',
    conductor:  r.fields.conductor  ?? '',
    autorizado: r.fields.autorizado === true,
    estado:     r.fields.estado     ?? undefined,
    vence:      r.fields.vence,
    notas:      r.fields.notas,
    adminIds:   r.fields.Administradores ?? [],
    responsable_visita: r.fields.responsable_visita,
    autoriza_visita:    r.fields.autoriza_visita,
    fecha_autorizado:   r.fields.fecha_autorizado,
    creada:             r.fields.Creada,
    acompañanteIds: r.fields.Acompañantes ?? [],
  }));
}

/** Marca o desmarca `autorizado` en un registro de Placas.
 *  Si se pasa `autorizadoPor`, escribe el nombre en el campo `autoriza_visita`.
 *  `estadoOverride` permite forzar RECHAZADO; por defecto se deriva de `autorizado`.
 */
export async function updatePlacaAutorizado(
  id: string,
  autorizado: boolean,
  autorizadoPor?: string,
  estadoOverride?: 'PENDIENTE' | 'AUTORIZADO' | 'RECHAZADO',
): Promise<boolean> {
  const estado = estadoOverride ?? (autorizado ? 'AUTORIZADO' : 'PENDIENTE');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = { autorizado, estado };
  if (autorizado && autorizadoPor) {
    fields.autoriza_visita = autorizadoPor;
    fields.fecha_autorizado = new Date().toISOString();
  } else if (!autorizado) {
    fields.autoriza_visita = '';
    fields.fecha_autorizado = null;
  }
  const res = await fetchWithRetry(`${apiUrl(getTable('PLACAS'))}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields }),
  });
  return res.ok;
}

/** Vincula acompañantes a una persona peatón (campo Acompañantes en Personas). */
export async function updatePersonaAcompanantes(
  id: string,
  acompananteIds: string[],
): Promise<boolean> {
  const res = await fetchWithRetry(`${apiUrl(getTable('PERSONAS'))}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields: { Acompañantes: acompananteIds } }),
  });
  return res.ok;
}

/** Actualiza los acompañantes de una placa (personas vinculadas).
 *  Recibe un array de IDs de personas que acompañan al conductor.
 */
export async function updatePlacaAcompanantes(
  id: string,
  acompanianteIds: string[],
): Promise<boolean> {
  const res = await fetchWithRetry(`${apiUrl(getTable('PLACAS'))}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      fields: {
        Acompañantes: acompanianteIds,
      },
    }),
  });
  return res.ok;
}

/* ─────────────────────────────────────────────────────────────
   Personas — lista y autorización
   ───────────────────────────────────────────────────────── */

/** Devuelve todos los registros de la tabla Personas, ordenados por nombre. */
export async function getPersonas(): Promise<PersonaRecord[]> {
  const params = new URLSearchParams({
    'sort[0][field]': 'nombre',
    'sort[0][direction]': 'asc',
  });
  const records = await fetchAllRecords(getTable('PERSONAS'), params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return records.map((r: any): PersonaRecord => ({
    id: r.id,
    cedula:          r.fields.cedula          ?? '',
    nombre:          r.fields.nombre          ?? '',
    autorizado:      r.fields.autorizado      === true,
    estado:          r.fields.estado          ?? undefined,
    vence:           r.fields.vence,
    cargo:           r.fields.cargo,
    notas:           r.fields.notas,
    adminIds:        r.fields.Administradores ?? [],
    responsable_visita: r.fields.responsable_visita,
    autoriza_visita:    r.fields.autoriza_visita,
    fecha_autorizado:   r.fields.fecha_autorizado,
    creada:             r.fields.Creada,
    acompañanteIds:  r.fields['Acompañantes'] ?? [],
  }));
}

/** Marca o desmarca `autorizado` en un registro de Personas.
 *  Si se pasa `autorizadoPor`, escribe el nombre en el campo `autoriza_visita`
 *  y registra la fecha de autorización en `fecha_autorizado`.
 *  `estadoOverride` permite forzar RECHAZADO; por defecto se deriva de `autorizado`.
 */
export async function updatePersonaAutorizado(
  id: string,
  autorizado: boolean,
  autorizadoPor?: string,
  estadoOverride?: 'PENDIENTE' | 'AUTORIZADO' | 'RECHAZADO',
): Promise<boolean> {
  const estado = estadoOverride ?? (autorizado ? 'AUTORIZADO' : 'PENDIENTE');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = { autorizado, estado };
  if (autorizado && autorizadoPor) {
    fields.autoriza_visita = autorizadoPor;
    fields.fecha_autorizado = new Date().toISOString();
  } else if (!autorizado) {
    fields.autoriza_visita = '';
    fields.fecha_autorizado = null;
  }
  const res = await fetchWithRetry(`${apiUrl(getTable('PERSONAS'))}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields }),
  });
  return res.ok;
}

/* ─────────────────────────────────────────────────────────────
   Administradores — lista ligera para filtrado por área
   ───────────────────────────────────────────────────────── */

export interface AdminListRecord {
  id: string;
  areas: string[];
}

/** Devuelve todos los administradores con sus áreas asignadas. */
export async function getAdmins(): Promise<AdminListRecord[]> {
  const params = new URLSearchParams({
    maxRecords: '200',
    'fields[]': 'areas',
  });
  const res = await fetchWithRetry(
    `${apiUrl(getTable('ADMINISTRADORES'))}?${params.toString()}`,
    { headers: authHeaders(), cache: 'no-store' },
  );
  if (!res.ok) return [];
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.records ?? []).map((r: any): AdminListRecord => ({
    id: r.id,
    areas: r.fields.areas ?? [],
  }));
}

/* ─────────────────────────────────────────────────────────────
   FinDeSemana
   ───────────────────────────────────────────────────────── */

export interface FinDeSemanaPersona {
  cedula: string;
  nombre: string;
  area?: string;
  fecha_inicio?: string; // ISO UTC
  fecha_fin?: string;    // ISO UTC
  resumen?: string;
}

export async function createFinDeSemanaRecords(
  records: FinDeSemanaPersona[],
): Promise<{ ok: boolean; ids?: string[]; error?: string }> {
  const ids: string[] = [];
  // Airtable allows max 10 records per request
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const body = {
      records: batch.map(p => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields: Record<string, any> = { cedula: p.cedula, nombre: p.nombre };
        if (p.area)         fields.area         = p.area;
        if (p.fecha_inicio) fields.fecha_inicio = p.fecha_inicio;
        if (p.fecha_fin)    fields.fecha_fin    = p.fecha_fin;
        if (p.resumen)      fields.resumen      = p.resumen;
        return { fields };
      }),
    };
    const res = await fetchWithRetry(apiUrl(getTable('FINDE_SEMANA')), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error?.message ?? `Error HTTP ${res.status}` };
    }
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ids.push(...(data.records ?? []).map((r: any) => r.id as string));
  }
  return { ok: true, ids };
}

/* ─────────────────────────────────────────────────────────────
   Items (Órdenes de salida)
   ───────────────────────────────────────────────────────── */

export interface ItemRecord {
  id: string;
  numero?: string;
  nombre: string;
  cedula: string;
  concepto?: string;
  destino?: string;
  autorizado_por?: string;
  area?: string;
  autorizado: boolean;
  usado: boolean;
  fecha_autorizacion?: string; // ISO UTC
  fecha_salida?: string;       // ISO UTC
  nodo_origen?: string;
  notas?: string;
}

export interface ItemCreateFields {
  numero?: string;
  nombre: string;
  cedula: string;
  concepto?: string;
  destino?: string;
  autorizado_por?: string;
  area?: string;
  autorizado?: boolean;
  fecha_salida?: string; // ISO UTC
  notas?: string;
}

/** Devuelve todos los órdenes de salida, más recientes primero. */
export async function getItems(): Promise<ItemRecord[]> {
  const params = new URLSearchParams({
    'sort[0][field]': 'fecha_salida',
    'sort[0][direction]': 'desc',
  });
  const records = await fetchAllRecords(getTable('ITEMS'), params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return records.map((r: any): ItemRecord => ({
    id: r.id,
    numero:              r.fields.numero,
    nombre:              r.fields.nombre              ?? '',
    cedula:              r.fields.cedula              ?? '',
    concepto:            r.fields.concepto,
    destino:             r.fields.destino,
    autorizado_por:      r.fields.autorizado_por,
    area:                r.fields.area,
    autorizado:          r.fields.autorizado          === true,
    usado:               r.fields.usado               === true,
    fecha_autorizacion:  r.fields.fecha_autorizacion,
    fecha_salida:        r.fields.fecha_salida,
    nodo_origen:         r.fields.nodo_origen,
    notas:               r.fields.notas,
  }));
}

/** Crea una nueva orden de salida en la tabla Items. */
export async function createItem(
  fields: ItemCreateFields,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f: Record<string, any> = {
    nombre: fields.nombre,
    cedula: fields.cedula,
  };
  if (fields.numero)        f.numero        = fields.numero;
  if (fields.concepto)      f.concepto      = fields.concepto;
  if (fields.destino)       f.destino       = fields.destino;
  if (fields.autorizado_por)f.autorizado_por= fields.autorizado_por;
  if (fields.area)          f.area          = fields.area;
  if (fields.autorizado)    f.autorizado    = fields.autorizado;
  if (fields.fecha_salida)  f.fecha_salida  = fields.fecha_salida;
  if (fields.notas)         f.notas         = fields.notas;

  const res = await fetchWithRetry(apiUrl(getTable('ITEMS')), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ records: [{ fields: f }] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error?.message ?? `Error HTTP ${res.status}` };
  }
  const data = await res.json();
  return { ok: true, id: data.records?.[0]?.id };
}
