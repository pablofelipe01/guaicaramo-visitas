/**
 * Helpers de Web Push (VAPID) — solo se ejecuta en el servidor.
 *
 * Variables de entorno requeridas:
 *   VAPID_PUBLIC_KEY   — clave pública generada con: npx web-push generate-vapid-keys
 *   VAPID_PRIVATE_KEY  — clave privada
 *   VAPID_SUBJECT      — mailto:admin@dominio.com  (o URL del sitio)
 */

import webpush from 'web-push';

const PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT     = process.env.VAPID_SUBJECT;

if (PUBLIC_KEY && PRIVATE_KEY && SUBJECT) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envía una notificación push a una suscripción serializada como JSON.
 * Retorna true si fue enviada, false en caso de error o claves no configuradas.
 */
export async function sendPush(
  subscriptionJson: string,
  payload: PushPayload,
): Promise<boolean> {
  if (!PUBLIC_KEY || !PRIVATE_KEY || !SUBJECT) {
    console.warn('[webpush] VAPID keys no configuradas — push omitido');
    return false;
  }

  let subscription: webpush.PushSubscription;
  try {
    subscription = JSON.parse(subscriptionJson) as webpush.PushSubscription;
  } catch {
    console.error('[webpush] push_subscription inválida — no es JSON válido');
    return false;
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    // 410 = suscripción expirada/cancelada por el browser — no es un error grave
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 410) {
      console.warn('[webpush] Suscripción expirada (410), ignorar y limpiar después');
    } else {
      console.error('[webpush] Error enviando push:', err);
    }
    return false;
  }
}

/** Devuelve la clave pública VAPID para enviar al cliente al registrar el SW. */
export function getVapidPublicKey(): string {
  if (!PUBLIC_KEY) throw new Error('VAPID_PUBLIC_KEY no está configurada');
  return PUBLIC_KEY;
}
