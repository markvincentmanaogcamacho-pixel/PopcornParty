/* Popcorn Party service worker
   Caches the app shell so the site still loads when offline.
   Network-first for content (HTML, API calls), cache-first for assets. */

const CACHE_NAME = "popcorn-party-v1";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/js/home.js",
  "/js/playerConfig.js",
  "/js/playerManager.js",
  "/css/home.css",
  "/manifest.json",
  "/logo.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/doubleclick.js",
];

/* Install — pre-cache the app shell */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* Activate — drop old caches */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/* Fetch strategy:
   - Navigation (pages): network-first, fall back to cached shell
   - Assets (js/css/png): cache-first, fall back to network
   - Everything else: network-first with no fallback */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // cross-origin (TMDB, embeds) untouched

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match("/index.html").then((r) => r || fetch(req)))
    );
    return;
  }

  if (/\.(js|css|png|jpe?g|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return res;
          })
      )
    );
    return;
  }
});
