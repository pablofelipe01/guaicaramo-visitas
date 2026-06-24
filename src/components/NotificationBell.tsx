'use client';

import { useState, useEffect } from 'react';

type Estado = 'cargando' | 'no_soportado' | 'bloqueado' | 'activo' | 'inactivo';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export default function NotificationBell() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [activando, setActivando] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado('no_soportado');
      return;
    }
    if (Notification.permission === 'denied') {
      setEstado('bloqueado');
      return;
    }
    navigator.serviceWorker.register('/sw.js').then(reg =>
      reg.pushManager.getSubscription().then(sub => {
        setEstado(sub ? 'activo' : 'inactivo');
      })
    ).catch(() => setEstado('inactivo'));
  }, []);

  async function activar() {
    setActivando(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');

      const keyRes = await fetch('/api/push/subscribe');
      if (!keyRes.ok) throw new Error('Servidor no configurado');
      const { publicKey } = await keyRes.json() as { publicKey: string };

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setEstado('bloqueado');
        return;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });

      if (saveRes.ok) setEstado('activo');
    } catch (err) {
      console.error('[push] Error al activar:', err);
    } finally {
      setActivando(false);
    }
  }

  if (estado === 'cargando' || estado === 'no_soportado') return null;

  if (estado === 'activo') {
    return (
      <span
        title="Notificaciones de portería activas"
        style={{ fontSize: 18, cursor: 'default', opacity: 0.85 }}
      >
        🔔
      </span>
    );
  }

  if (estado === 'bloqueado') {
    return (
      <span
        title="Notificaciones bloqueadas — actívalas en la configuración del navegador"
        style={{ fontSize: 18, cursor: 'default', opacity: 0.5 }}
      >
        🔕
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={activar}
      disabled={activando}
      className="btn btn-ghost btn-sm"
      title="Activar notificaciones de portería"
      style={{ opacity: activando ? 0.6 : 1 }}
    >
      {activando ? '...' : '🔔 Activar notificaciones'}
    </button>
  );
}
