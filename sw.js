// Service Worker — BioInnova PWA
// Estrategia: el DOCUMENTO (index.html) va NETWORK-FIRST → siempre la última
// versión cuando hay internet; cae al caché solo si está offline. El resto de
// los assets, stale-while-revalidate. Así la app se actualiza sola online y
// sigue funcionando sin señal. Los datos viven en localStorage + Supabase.
const CACHE = 'bioinnova-v123';
const ASSETS = ['./', './index.html', './js/costeo.js', './js/metas.js', './manifest.webmanifest', './icon.svg', './logo.svg', './logo.jpg', './html2pdf.bundle.min.js', './jspdf.umd.min.js', './jspdf.plugin.autotable.min.js'];

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
  // El código propio de la app (index.html y /js/*.js) va SIEMPRE junto: si el index se
  // actualiza y costeo.js queda servido del caché viejo, el motor de cálculo no coincide
  // con la pantalla. Por eso /js/ también es network-first, no stale-while-revalidate.
  const isDoc = req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html') || url.pathname.includes('/js/');
  if (isDoc) {
    // network-first con bypass del cache HTTP ({cache:'reload'}): siempre trae el index.html
    // fresco desde la red (evita que la copia cacheada ~10 min de GitHub Pages muestre una
    // version vieja). Cae al cache solo si no hay conexion.
    e.respondWith(
      fetch(req, { cache: 'reload' }).then(res => { if (res && res.status === 200) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); } return res; })
        .catch(() => fetch(req).catch(() => caches.match(req).then(m => m || (url.pathname.includes('/js/') ? Response.error() : caches.match('./index.html')))))
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
