/**
 * Constantes compartidas de la sesión de administrador.
 * Las usan tanto el Server Action que crea la cookie (`actions.ts`)
 * como el proxy que la renueva (`proxy.ts`), para tener una sola fuente de verdad.
 */

export const SESSION_COOKIE = 'g-session';

// 12 horas: cubre un turno completo. Además el proxy renueva esta expiración
// en cada navegación/acción mientras el usuario esté activo (sliding session),
// de modo que no se cierre la sesión mientras se está registrando un visitante.
export const SESSION_MAX_AGE = 60 * 60 * 12;
