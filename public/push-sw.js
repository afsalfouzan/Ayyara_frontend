/*
 * Added to the generated service worker (see vite.config.ts → workbox.importScripts).
 * Shows alerts sent by the backend, even when the admin is closed, and opens
 * the right page when one is tapped.
 */
self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : '' };
  }
  const title = message.title || 'Ayyara Rebirth';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: message.body || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      // Alerts about the same thing replace each other instead of piling up.
      tag: message.tag || 'ayyara',
      renotify: true,
      data: { url: message.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Reuse the admin if it is already open; otherwise open it.
      const open = windows.find((client) => 'focus' in client);
      if (open) return open.navigate(target).then((client) => (client || open).focus()).catch(() => open.focus());
      return self.clients.openWindow(target);
    }),
  );
});
