// Service Worker — Guaicaramo Visitas
// Recibe push notifications y maneja clicks en notificaciones.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Guaicaramo Visitas', body: event.data.text() };
  }

  const { title = 'Guaicaramo Visitas', body = '', url = '/', tag = 'porteria' } = payload;

  const options = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag,
    data: { url },
    requireInteraction: true,  // la notificación no desaparece sola — requiere acción del admin
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si la app ya está abierta en una pestaña, enfocarla y navegar
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Si no hay pestaña abierta, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
  );
});
