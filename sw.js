// Service Worker — BioInnova PWA (offline-first del "app shell")
// Estrategia: stale-while-revalidate. La app abre sin señal; cuando hay red,
// actualiza el caché en segundo plano. Los datos de visitas viven en localStorage.
const CACHE = 'bioinnova-v5';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './logo.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // no interceptar terceros (ej. futura API)
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)); }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
