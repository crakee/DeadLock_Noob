// Service worker : rend le site installable et utilisable hors ligne.
// Réseau d'abord pour tout (pages, CSS, JS, données) : le site change à chaque patch, on ne sert le
// cache que si le réseau est indisponible. Changer VERSION vide les anciens caches à l'activation.
const VERSION = 'dln-v2';
const ESSENTIEL = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css', './css/partie.css', './css/etiquettes.css',
  './js/commun.js', './js/sons.js', './js/timeline.js', './js/enface.js', './js/etiquettes.js', './js/partie.js', './js/carte-mini.js',
  './data/timeline.json', './data/niveaux.json', './data/profil.json', './data/heroes.json', './data/roles.json',
  './data/conseils-roles.json', './data/heros-details.json', './data/map.json', './data/counters.json', './data/items.json',
  './data/tempo.json', './icones/icone-192.png'
];

self.addEventListener('install', (e) => {
  // Précache au mieux : un fichier manquant ne bloque pas l'installation.
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(ESSENTIEL.map((u) => c.add(new Request(u, { cache: 'no-cache' })).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const memeSite = url.origin === self.location.origin;
  e.respondWith(
    fetch(req).then((rep) => {
      // On garde une copie des réponses du site (et des images de l'API) pour le hors-ligne.
      if (rep.ok && (memeSite || url.hostname.endsWith('deadlock-api.com'))) {
        const copie = rep.clone();
        caches.open(VERSION).then((c) => c.put(req, copie)).catch(() => null);
      }
      return rep;
    }).catch(() => caches.match(req, { ignoreSearch: memeSite }).then((r) => r || Response.error()))
  );
});
