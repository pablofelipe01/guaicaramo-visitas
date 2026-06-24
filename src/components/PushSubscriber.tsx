'use client';

import { useEffect } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export default function PushSubscriber() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    async function subscribe() {
      try {
        // 1. Registrar el Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js');

        // 2. Obtener la clave pública VAPID del servidor
        const keyRes = await fetch('/api/push/subscribe');
        if (!keyRes.ok) return; // push no configurado en el servidor
        const { publicKey } = await keyRes.json() as { publicKey?: string };
        if (!publicKey) return;

        // 3. Si ya hay una suscripción activa, no pedir permiso de nuevo
        const existing = await registration.pushManager.getSubscription();
        if (existing) return;

        // 4. Pedir permiso de notificaciones al usuario
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // 5. Suscribirse al push del navegador
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        // 6. Guardar la suscripción en el servidor (→ campo push_subscription en ADMINISTRADORES)
        const saveRes = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        });

        if (saveRes.ok) {
          console.log('[push] Suscripción guardada correctamente');
        }
      } catch (err) {
        // Error silencioso — no interrumpe la UI
        console.warn('[push] No se pudo activar las notificaciones:', err);
      }
    }

    subscribe();
  }, []);

  return null; // no renderiza nada visible
}
