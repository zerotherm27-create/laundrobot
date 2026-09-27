import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

// Activate the new SW immediately and take control of open tabs.
// vite-plugin-pwa's autoUpdate registration reloads the tabs once we're in control.
// Force update: 2026-06-27
self.skipWaiting();
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// Remove ONLY stale precaches from previous deploys — never the current one.
// (The old code wiped every cache including the fresh precache, so the app
// ran with no caching at all and refetched every asset on each navigation.)
cleanupOutdatedCaches();

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
      // The dashboard is a single-page app — it never updates window.location
      // as you navigate internally, so matching on c.url would almost never
      // find the already-open tab. Any window at our origin is "the app".
      const existing = list.find((c) => 'focus' in c);
      if (existing) {
        existing.postMessage({ type: 'push-navigate', url: safeUrl });
        return existing.focus();
      }
      return clients.openWindow(safeUrl);
    })
  );
});
