// Canetthèque — service worker v2
// Réseau d'abord pour tout ce qui vient du site ; le cache ne sert que si le téléphone est vraiment hors ligne.
// Seules les réponses valides (200) sont gardées, jamais une page d'erreur.
const CACHE = 'canettheque-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // un fichier manquant ne bloque pas l'installation
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function keep(req, res) {
  if (res && res.status === 200) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Ouverture de l'appli
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.status === 200) keep('./index.html', res.clone());
        return res;
      } catch (err) {
        return (await caches.match('./index.html', { ignoreSearch: true }))
          || (await caches.match('./', { ignoreSearch: true }))
          || new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="background:#060706;color:#f1f5ec;font:16px system-ui;padding:24px">Pas de réseau pour le premier lancement. Reconnecte-toi puis rouvre la Canetthèque.</body>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // Fichiers du site, polices et lecteur de code-barres
  const ours = url.origin === location.origin
    || url.hostname === 'fonts.googleapis.com'
    || url.hostname === 'fonts.gstatic.com'
    || url.hostname === 'unpkg.com';
  if (!ours) return;
  e.respondWith(
    fetch(req)
      .then(res => keep(req, res))
      .catch(() => caches.match(req).then(hit => hit || Response.error()))
  );
});
