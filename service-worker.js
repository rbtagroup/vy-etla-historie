const CACHE_PREFIX = "rb-taxi-vycetka-";
// Verze cache = verze appky + datum nasazení. Při každé změně bump tuto
// konstantu, ať je invalidace cache explicitní (nespoléhá se jen na network-first).
const CACHE_VERSION = "v3.21.0-2026-07-06-pills-spacing";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
// Knihovna Supabase z CDN — kešujeme, ať přihlašovací brána funguje i offline
// pro už přihlášeného řidiče (jinak by se offline nenačetla a nešlo by dovnitř).
const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./calc.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./screenshot-wide.png",
  "./screenshot-mobile.png"
];

const NETWORK_FIRST_ASSETS = new Set([
  "/",
  "/index.html",
  "/calc.js",
  "/manifest.json",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll(APP_SHELL);
    // CDN skript kešujeme best-effort (když selže, install kvůli tomu nespadne)
    try { await cache.add(SUPABASE_CDN); } catch (e) { /* offline při instalaci */ }
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  // Supabase CDN skript: cache-first (ať brána funguje offline)
  if (requestUrl.hostname === "cdn.jsdelivr.net") {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return caches.match(SUPABASE_CDN);
      }
    })());
    return;
  }

  if (requestUrl.origin !== self.location.origin) return;

  const shouldUseNetworkFirst =
    event.request.mode === "navigate" ||
    [...NETWORK_FIRST_ASSETS].some((assetPath) => requestUrl.pathname.endsWith(assetPath));

  event.respondWith((async () => {
    if (shouldUseNetworkFirst) {
      try {
        const fresh = await fetch(event.request, { cache: "no-store" });
        if (fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, fresh.clone());
          if (event.request.mode === "navigate") await cache.put("./index.html", fresh.clone());
        }
        return fresh;
      } catch {
        return caches.match(event.request) || caches.match("./index.html");
      }
    }

    const cached = await caches.match(event.request);
    if (cached) return cached;

    const response = await fetch(event.request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
