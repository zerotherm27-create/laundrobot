import { precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { createHandlerBoundToURL } from 'workbox-precaching';

// Take over immediately on update — no waiting for all tabs to close
self.skipWaiting();
self.addEventListener('activate', event => {
  event.waitUntil(
    // Wipe every old cache so browsers don't serve stale assets after a deploy
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => c.navigate(c.url)))
  );
});

precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Laundrobot', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || '/';

  // Validate URL — only allow relative paths or our own domains
  let safeUrl = '/';
  try {
    if (rawUrl.startsWith('/')) {
      safeUrl = rawUrl;
    } else {
      const parsed = new URL(rawUrl);
      const allowedHosts = ['laundrobot.app', 'www.laundrobot.app', 'book.thelaundryproject.app', 'www.thelaundryproject.app'];
      if (allowedHosts.includes(parsed.hostname)) {
        safeUrl = rawUrl;
      }
    }
  } catch (e) {
    safeUrl = '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(safeUrl) && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(safeUrl);
    })
  );
});
