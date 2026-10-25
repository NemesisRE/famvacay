/*
 * FamVacay service worker: installable app + offline fallback. Deliberately small:
 * - Next.js build assets (/_next/static, content-hashed): cache first
 * - public pages: network first, the last copy offline (the start page then restores the last
 *   search results from local storage); account and sign-in pages are never stored
 * - everything else (search API, analytics, account data): network only, never cached
 * Bump CACHE_VERSION when this file's caching rules change.
 */
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `famvacay-static-${CACHE_VERSION}`;
const PAGE_CACHE = `famvacay-pages-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';
const CACHED_PAGES = ['/', '/about', '/imprint', '/privacy', OFFLINE_URL];
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('famvacay-') && k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isRscRequest(request, url) {
  return request.headers.get('RSC') === '1' || url.searchParams.has('_rsc');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  if (request.mode === 'navigate' && !isRscRequest(request, url)) {
    const cacheable = CACHED_PAGES.includes(url.pathname);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (cacheable && response.ok) {
            const copy = response.clone();
            // Store under the path only: query strings (share links) must not pile up copies
            caches.open(PAGE_CACHE).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(PAGE_CACHE);
          return (cacheable && (await cache.match(url.pathname))) || (await cache.match(OFFLINE_URL)) || Response.error();
        })
    );
  }
  // Anything else: the browser's normal network handling
});
