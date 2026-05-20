/**
 * Airtable REST client — Guaicaramo Visitas
 * Sólo se ejecuta en el servidor (importado desde Server Actions).
 * Configuración vía variables de entorno (.env.local).
 */

const BASE_ID = process.env.AIRTABLE_BASE_ID;

function getTables() {
  const administradores = process.env.AIRTABLE_TABLE_ADMINISTRADORES;
  const placas = process.env.AIRTABLE_TABLE_PLACAS;
  const registros = process.env.AIRTABLE_TABLE_REGISTROS;
  if (!administradores || !placas || !registros) {
    throw new Error('Faltan variables de entorno AIRTABLE_TABLE_*');
  }
  return { ADMINISTRADORES: administradores, PLACAS: placas, REGISTROS: registros } as const;
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

/* ─────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────── */

export interface PlacaRecord {
  id: string;
  placa: string;
  cedula: string;
  conductor: string;
  autorizado: boolean;
  vence?: string;   // ISO date "YYYY-MM-DD"
  notas?: string;
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

export interface AdminRecord {
  id: string;
  usuario: string;
  contraseña: string;
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
}

/* ─────────────────────────────────────────────────────────────
   Placas
   ───────────────────────────────────────────────────────── */

export async function findPlacaByPlaca(placa: string): Promise<PlacaRecord | null> {
  const formula = encodeURIComponent(`{placa}="${placa.toUpperCase()}"`);
  const res = await fetch(
    `${apiUrl(getTables().PLACAS)}?filterByFormula=${formula}&maxRecords=1`,
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
    vence: r.fields.vence,
    notas: r.fields.notas,
  };
}

/* ─────────────────────────────────────────────────────────────
   Registros
   ───────────────────────────────────────────────────────── */

export async function createRegistro(fields: RegistroCreateFields): Promise<string | null> {
  const res = await fetch(apiUrl(getTables().REGISTROS), {
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
  const res = await fetch(
    `${apiUrl(getTables().ADMINISTRADORES)}?filterByFormula=${formula}&maxRecords=1`,
    { headers: authHeaders(), cache: 'no-store' },
  );

  if (!res.ok) return null;

  const data = await res.json();
  if (!data.records?.length) return null;

  const r = data.records[0];
  return {
    id: r.id,
    usuario: r.fields.usuario ?? '',
    contraseña: r.fields['contraseña'] ?? '',
  };
}

/**
 * Actualiza el campo `contraseña` de un administrador con un hash bcrypt.
 * Solo se llama cuando el admin no tiene contraseña registrada todavía.
 */
export async function updateAdminPassword(id: string, hashedPassword: string): Promise<boolean> {
  const res = await fetch(`${apiUrl(getTables().ADMINISTRADORES)}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields: { contraseña: hashedPassword } }),
  });
  return res.ok;
}

/* ─────────────────────────────────────────────────────────────
   Registros — lectura y actualización de estado
   ───────────────────────────────────────────────────────── */

/** Devuelve hasta 100 registros ordenados por fecha de entrada (más recientes primero). */
export async function getRegistros(): Promise<RegistroRecord[]> {
  const params = new URLSearchParams({
    maxRecords: '100',
    'sort[0][field]': 'entry_time',
    'sort[0][direction]': 'desc',
  });
  const res = await fetch(
    `${apiUrl(getTables().REGISTROS)}?${params.toString()}`,
    { headers: authHeaders(), cache: 'no-store' },
  );
  if (!res.ok) return [];
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.records ?? []).map((r: any): RegistroRecord => ({
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

  const res = await fetch(`${apiUrl(getTables().REGISTROS)}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields }),
  });
  return res.ok;
}
