/**
 * Airtable REST client — Guaicaramo Visitas
 * Sólo se ejecuta en el servidor (importado desde Server Actions).
 * Configuración vía variables de entorno (.env.local).
 */

const BASE_ID = process.env.AIRTABLE_BASE_ID;

function getTable(name: 'ADMINISTRADORES' | 'PLACAS' | 'REGISTROS' | 'PERSONAS'): string {
  const env: Record<string, string | undefined> = {
    ADMINISTRADORES: process.env.AIRTABLE_TABLE_ADMINISTRADORES,
    PLACAS:          process.env.AIRTABLE_TABLE_PLACAS,
    REGISTROS:       process.env.AIRTABLE_TABLE_REGISTROS,
    PERSONAS:        process.env.AIRTABLE_TABLE_PERSONAS,
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
  vence?: string;
  cargo?: string;
  notas?: string;
}

export interface AdminRecord {
  id: string;
  usuario: string;
  cedula: string;
  nombre: string;
  contraseña: string;
  tipo?: 'Invita' | 'Autoriza';
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
    vence: r.fields.vence,
    notas: r.fields.notas,
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
        ...(fields.notas           ? { notas:              fields.notas              } : {}),
        ...(fields.vence           ? { vence:              fields.vence              } : {}),
        ...(fields.registrado_por  ? { responsable_visita: fields.registrado_por     } : {}),
        ...(fields.adminId         ? { Administradores:    [fields.adminId]          } : {}),
      },
    }],
  };
  const res = await fetch(apiUrl(getTable('PLACAS')), {
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
        ...(fields.cargo           ? { cargo:              fields.cargo              } : {}),
        ...(fields.notas           ? { notas:              fields.notas              } : {}),
        ...(fields.vence           ? { vence:              fields.vence              } : {}),
        ...(fields.registrado_por  ? { responsable_visita: fields.registrado_por     } : {}),
        ...(fields.adminId         ? { Administradores:    [fields.adminId]          } : {}),
      },
    }],
  };
  const res = await fetch(apiUrl(getTable('PERSONAS')), {
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
  const res = await fetch(apiUrl(getTable('REGISTROS')), {
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
  };
}

export async function findAdminByCedula(cedula: string): Promise<AdminRecord | null> {
  const safe = cedula.replace(/"/g, '\\"');
  const formula = encodeURIComponent(`{cedula}="${safe}"`);
  const res = await fetch(
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
  };
}

/**
 * Actualiza el campo `contraseña` de un administrador con un hash bcrypt.
 * Solo se llama cuando el admin no tiene contraseña registrada todavía.
 */
export async function updateAdminPassword(id: string, hashedPassword: string): Promise<boolean> {
  const res = await fetch(`${apiUrl(getTable('ADMINISTRADORES'))}/${id}`, {
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
    `${apiUrl(getTable('REGISTROS'))}?${params.toString()}`,
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

  const res = await fetch(`${apiUrl(getTable('REGISTROS'))}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields }),
  });
  return res.ok;
}

/* ─────────────────────────────────────────────────────────────
   Placas — lista y autorización
   ───────────────────────────────────────────────────────── */

/** Devuelve hasta 100 registros de la tabla Placas, más recientes primero. */
export async function getPlacas(): Promise<PlacaRecord[]> {
  const params = new URLSearchParams({
    maxRecords: '100',
    'sort[0][field]': 'placa',
    'sort[0][direction]': 'asc',
  });
  const res = await fetch(
    `${apiUrl(getTable('PLACAS'))}?${params.toString()}`,
    { headers: authHeaders(), cache: 'no-store' },
  );
  if (!res.ok) return [];
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.records ?? []).map((r: any): PlacaRecord => ({
    id: r.id,
    placa:      r.fields.placa      ?? '',
    cedula:     r.fields.cedula     ?? '',
    conductor:  r.fields.conductor  ?? '',
    autorizado: r.fields.autorizado === true,
    vence:      r.fields.vence,
    notas:      r.fields.notas,
  }));
}

/** Marca o desmarca `autorizado` en un registro de Placas. */
export async function updatePlacaAutorizado(id: string, autorizado: boolean): Promise<boolean> {
  const res = await fetch(`${apiUrl(getTable('PLACAS'))}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields: { autorizado } }),
  });
  return res.ok;
}

/* ─────────────────────────────────────────────────────────────
   Personas — lista y autorización
   ───────────────────────────────────────────────────────── */

/** Devuelve hasta 100 registros de la tabla Personas, ordenados por nombre. */
export async function getPersonas(): Promise<PersonaRecord[]> {
  const params = new URLSearchParams({
    maxRecords: '100',
    'sort[0][field]': 'nombre',
    'sort[0][direction]': 'asc',
  });
  const res = await fetch(
    `${apiUrl(getTable('PERSONAS'))}?${params.toString()}`,
    { headers: authHeaders(), cache: 'no-store' },
  );
  if (!res.ok) return [];
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.records ?? []).map((r: any): PersonaRecord => ({
    id: r.id,
    cedula:     r.fields.cedula     ?? '',
    nombre:     r.fields.nombre     ?? '',
    autorizado: r.fields.autorizado === true,
    vence:      r.fields.vence,
    cargo:      r.fields.cargo,
    notas:      r.fields.notas,
  }));
}

/** Marca o desmarca `autorizado` en un registro de Personas. */
export async function updatePersonaAutorizado(id: string, autorizado: boolean): Promise<boolean> {
  const res = await fetch(`${apiUrl(getTable('PERSONAS'))}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields: { autorizado } }),
  });
  return res.ok;
}
