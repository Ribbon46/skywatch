/* SkyWatch service worker
 * Strategy:
 *   - Network-first for Open-Meteo (fresh forecast wins, cache as fallback)
 *   - Cache-first for app shell + data + scripts (offline-first)
 *   - Skip-waiting + claim so updates take effect on next reload
 */
const VERSION = 'skywatch-v6';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css',
  './js/catalogs.js',
  './js/app.js', './js/astronomy.js', './js/forecast.js',
  './js/camera.js', './js/sites.js', './js/calendar.js', './js/log.js',
  './js/planner.js', './js/spots-discovery.js', './js/ar.js',
  './data/messier.json', './data/ngc.json', './data/stars.json',
  './data/meteor-showers.json', './data/cameras.json', './data/lenses.json',
  './data/planner-spots.json',
  './icon.svg', './icon-192.png', './icon-512.png',
  './icon-192-maskable.png', './icon-512-maskable.png', './icon-monochrome.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL).catch(()=>{}))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if(url.hostname.endsWith('open-meteo.com') || url.hostname === 'overpass-api.de'){
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(resp => {
        if(resp.ok && resp.type === 'basic'){
          const copy = resp.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
