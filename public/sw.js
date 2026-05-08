/**
 * Service Worker minimal para Prontara Factory (H4-PWA-01).
 *
 * Estrategia:
 *   - cache-first para estáticos (/_next/static/, /icons, /manifest.json)
 *   - network-first para páginas (HTML)
 *   - bypass total para /api/ — siempre red, los datos no se cachean
 *
 * Sirve un offline-shell mínimo si la red falla y no hay caché.
 */

const CACHE_VERSION = "prontara-v1";
const SHELL_URLS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Same-origin only
  if (url.origin !== location.origin) return;

  // /api/* siempre red — datos vivos.
  if (url.pathname.startsWith("/api/")) return;

  // Estáticos de Next: cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.match(/\.(png|jpg|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
          return res;
        }).catch(() => caches.match("/"));
      })
    );
    return;
  }

  // HTML: network-first con fallback a cache
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("/")))
    );
  }
});
