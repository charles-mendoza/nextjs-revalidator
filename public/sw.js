/* Hand-rolled service worker for nextjs-revalidator.
 *
 * Goals: make the app installable and give a graceful offline fallback.
 * Hard rule: NEVER cache /api/* or any non-GET request — those carry live data
 * and (for preview sites) secrets, and revalidation must always hit the network.
 */

const CACHE = 'revalidator-shell-v1';
const OFFLINE_URL = '/offline';

// Minimal app shell: the offline fallback page + icons/manifest.
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Best-effort: don't fail install if one asset 404s.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Never intercept non-GET, cross-origin, or API/auth traffic — pure passthrough.
  if (request.method !== 'GET' || !sameOrigin || url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigations: network-first, fall back to the cached offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ||
            new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
          );
        }
      })()
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  if (url.pathname.startsWith('/_next/static/') || PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => undefined);
        return cached || (await network) || Response.error();
      })()
    );
  }
});
