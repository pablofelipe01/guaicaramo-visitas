# Guaicaramo Visitas

Sistema de control de acceso y gestión de visitantes para la Finca Guaicaramo. Portal web full-stack que permite registrar solicitudes de ingreso, autorizar visitantes y auditar entradas/salidas en tiempo real.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Runtime | Node.js — server components + server actions |
| Base de datos | Airtable REST API |
| Autenticación | Sesiones HTTPOnly cookie + bcrypt |
| Estilos | Tailwind CSS 4 + CSS custom properties |
| Lenguaje | TypeScript 5 |
| Rate limiting | In-memory sliding window (`src/lib/rate-limit.ts`) |

---

## Arquitectura

```
Browser → Next.js Server (App Router)
               ├─ Server Components → leen Airtable directamente (no exponen credenciales)
               ├─ Server Actions    → mutaciones (auth, authorize, deny, register)
               └─ API Route         → /api/logout (limpia cookie de sesión)
```

No hay API layer propia. Toda la persistencia va directamente a Airtable via REST desde el servidor.

---

## Modelo de datos (Airtable)

### ADMINISTRADORES
| Campo | Tipo | Descripción |
|---|---|---|
| `usuario` | text | Nombre de usuario |
| `cedula` | text | Cédula (identificador de login) |
| `nombre` | text | Nombre completo |
| `contraseña` | text | Hash bcrypt |
| `tipo` | select | `Invita` \| `Autoriza` \| `Superadmin` |
| `areas` | multiSelect | Áreas de responsabilidad |

### PLACAS
| Campo | Tipo | Descripción |
|---|---|---|
| `placa` | text | Número de placa |
| `cedula` | text | Cédula del conductor |
| `conductor` | text | Nombre del conductor |
| `autorizado` | boolean | Acceso activo al gate |
| `estado` | singleSelect | `PENDIENTE` \| `AUTORIZADO` \| `RECHAZADO` |
| `vence` | date | Fecha de expiración |
| `notas` | text | Observaciones |
| `responsable_visita` | text | Quien registró la solicitud |
| `autoriza_visita` | text | Quien autorizó |
| `Administradores` | link | Admins vinculados |
| `Acompañantes` | link → PERSONAS | Personas en el vehículo |

### PERSONAS
| Campo | Tipo | Descripción |
|---|---|---|
| `cedula` | text | Número de cédula |
| `nombre` | text | Nombre completo |
| `cargo` | text | Cargo o rol |
| `autorizado` | boolean | Acceso activo al gate |
| `estado` | singleSelect | `PENDIENTE` \| `AUTORIZADO` \| `RECHAZADO` |
| `vence` | date | Fecha de expiración |
| `notas` | text | Observaciones |
| `responsable_visita` | text | Quien registró la solicitud |
| `autoriza_visita` | text | Quien autorizó |
| `fecha_autorizado` | dateTime | Fecha/hora en que se autorizó |
| `Administradores` | link | Admins vinculados |
| `Acompañantes` | link → PERSONAS | Personas asociadas |

### REGISTROS
| Campo | Tipo | Descripción |
|---|---|---|
| `placa` | text | Placa del vehículo |
| `cedula` | text | Cédula del visitante |
| `tipo` | select | `ENTRADA` \| `SALIDA` \| `MANUAL` \| `SALIDA_SIN_ENTRADA` |
| `status` | select | `PENDIENTE` \| `APROBADO` \| `NEGADO` \| `SALIDA_SIN_ENTRADA` |
| `categoria` | select | `VEHICULO` \| `PEATON` \| `FIN_DE_SEMANA` |
| `entry_time` | datetime | Hora de entrada |
| `exit_time` | datetime | Hora de salida |
| `approved_by` | text | Quien aprobó |
| `supervisor` | text | Supervisor de turno |
| `comment` | text | Motivo de rechazo |
| `motivo_visita` | text | Motivo declarado |
| `nombre_visitante` | text | Nombre del visitante |
| `rejected_time` | datetime | Hora de rechazo |
| `nodo_origen` | text | Punto de ingreso |
| `placaIds` | link → PLACAS | Placa vinculada |
| `personaIds` | link → PERSONAS | Persona vinculada |

### FINDE_SEMANA
Programación semanal de personal autorizado para fines de semana. Gestionado exclusivamente por Superadmin.

### ITEMS
Órdenes de salida de materiales/bienes. Campos incluyen `concepto`, `destino`, `autorizado_por`, `usado`, `fecha_autorizacion`.

---

## Roles y permisos

| Tipo | Acceso |
|---|---|
| `Invita` | Puede registrar visitantes; no puede autorizar |
| `Autoriza` | Registrar + autorizar/denegar placas, personas y registros pendientes |
| `Superadmin` | Todo lo anterior + Programación Semanal + Órdenes de Salida |

---

## Flujo de autorización de visitantes

```
[Público] Solicita ingreso
    ↓ submitVisitorRequest()
    Crea PLACA o PERSONA con autorizado=false, estado='PENDIENTE'
    ↓
[Admin Autoriza] Revisa panel Visitantes
    ├─ Autorizar  → autorizado=true,  estado='AUTORIZADO'
    ├─ Denegar    → autorizado=false, estado='RECHAZADO'
    └─ Revocar    → autorizado=false, estado='PENDIENTE'  (solo desde AUTORIZADO)

[Gate / Sistema de entrada]
    Lee campo `autorizado` (boolean) para decisión de acceso
```

`autorizado` (boolean) y `estado` (select) se escriben siempre en el mismo PATCH.
`autorizado` es el campo de decisión binaria del gate; `estado` es la fuente de verdad para la UI de administración.

---

## Autenticación

- Sesión almacenada en cookie HTTPOnly cifrada (`session`)
- Login por cédula + PIN (4 dígitos, hasheado con bcrypt)
- Rate limiter: máximo N intentos por IP en ventana deslizante (`src/lib/rate-limit.ts`)
- Logout: `POST /api/logout` limpia la cookie y redirige a `/login`

---

## Variables de entorno requeridas

```
# Airtable
AIRTABLE_GUAICARAMO_VISITAS_API_KEY=
AIRTABLE_BASE_ID=
AIRTABLE_TABLE_ADMINISTRADORES=
AIRTABLE_TABLE_PLACAS=
AIRTABLE_TABLE_REGISTROS=
AIRTABLE_TABLE_PERSONAS=
AIRTABLE_TABLE_FINDE_SEMANA=
AIRTABLE_TABLE_ITEMS=

# Zona horaria (Colombia: -05:00)
APP_TZ_OFFSET=
```

---

## Estructura de directorios

```
src/
├── app/
│   ├── page.tsx                     — Landing page pública
│   ├── layout.tsx                   — Root layout (fuentes, metadata)
│   ├── globals.css                  — Design tokens y estilos globales
│   ├── actions.ts                   — Server actions (toda la lógica de negocio)
│   ├── login/page.tsx               — Página de autenticación
│   ├── dashboard/
│   │   ├── page.tsx                 — Carga datos y valida sesión (Server Component)
│   │   ├── DashboardContent.tsx     — Shell con tabs por rol
│   │   ├── RegistrosPanel.tsx       — Auditoría de entradas/salidas
│   │   ├── VisitantesPanel.tsx      — Gestión unificada de placas + personas
│   │   ├── PlacasPanel.tsx          — Gestión de vehículos
│   │   ├── PersonasPanel.tsx        — Gestión de peatones
│   │   ├── RegistrarVisitantePanel.tsx — Formulario de nueva solicitud
│   │   ├── ProgramacionSemanalPanel.tsx — Programación fines de semana (Superadmin)
│   │   └── OrdenesSalidaPanel.tsx   — Órdenes de salida de items (Superadmin)
│   └── api/logout/route.ts          — Endpoint de cierre de sesión
├── lib/
│   ├── airtable.ts                  — Cliente REST Airtable: tipos, mappers, funciones CRUD
│   ├── hooks.ts                     — useReveal, useCounter
│   └── rate-limit.ts                — Rate limiter en memoria
└── components/
    ├── nav.tsx                      — Barra de navegación
    ├── icons.tsx                    — Iconos SVG
    ├── decorations.tsx              — Wordmark, fondos decorativos
    └── landing/
        ├── hero.tsx                 — Sección principal de la landing
        └── footer.tsx               — Pie de página
```

---

## Instalación y desarrollo

```bash
npm install
cp .env.example .env.local   # completar con credenciales reales
npm run dev
```

---

## Convenciones de código

- Toda mutación de datos va en `src/app/actions.ts` como Server Action (`'use server'`)
- Toda lectura de Airtable en `src/lib/airtable.ts`; los componentes no llaman a `fetch` directamente
- Los Server Components del dashboard hacen la carga de datos; los Client Components solo manejan estado UI
- Zona horaria: se usa `APP_TZ_OFFSET` y `America/Bogota` en los formateos de fecha; no usar `new Date().toLocaleString()` sin zona explícita
