// Backline Service Worker.
//
// Externalisé Phase 7.8 : la version blob URL (Phase 5.2+) avait un scope
// distinct de la page (origin blob:…) → le SW se registrait mais ne
// contrôlait jamais les fetchs du document. Servi maintenant depuis
// public/sw.js, scope = origine du site, le SW reprend en main offline +
// stale-while-revalidate sur le HTML.
//
// Bump CACHE à chaque release. Le filtre k !== CACHE dans activate purge
// les anciens caches automatiquement.

const CACHE = 'backline-v127';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([self.registration.scope + 'index.html'])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Stale-while-revalidate sur le HTML (navigation ou request explicite
  // index.html). On sert le cache immédiatement, fetch en background,
  // met à jour pour la prochaine visite.
  const isHtml = req.mode === 'navigate'
    || (req.method === 'GET' && req.url.includes('index.html'));
  if (isHtml) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req)
        || await cache.match(self.registration.scope + 'index.html');
      const networkPromise = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => null);
      // Sert cache immédiatement si dispo, sinon attend réseau (1er chargement).
      return cached || (await networkPromise) || new Response('Offline', { status: 503 });
    })());
    return;
  }
  // Autres requêtes : network-first avec fallback cache.
  e.respondWith(
    fetch(req).then((res) => res).catch(() => caches.match(req))
  );
});
