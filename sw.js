// Service Worker — BioInnova PWA
// Estrategia: el DOCUMENTO (index.html) va NETWORK-FIRST → siempre la última
// versión cuando hay internet; cae al caché solo si está offline. El resto de
// los assets, stale-while-revalidate. Así la app se actualiza sola online y
// sigue funcionando sin señal. Los datos viven en localStorage + Supabase.
const CACHE = 'bioinnova-v38';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './logo.svg', './logo.jpg'];

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
  if (url.origin !== self.location.origin) return;   // no interceptar terceros (Supabase, etc.)
  const isDoc = req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isDoc) {
    // network-first: siempre lo último; caché como respaldo offline
    e.respondWith(
      fetch(req).then(res => { if (res && res.status === 200) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); } return res; })
        .catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
  } else {
    // stale-while-revalidate para el resto
    e.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => { if (res && res.status === 200) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); } return res; }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
