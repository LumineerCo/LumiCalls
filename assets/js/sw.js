// ============================================================
// LumiConnect Service Worker
// ============================================================
const CACHE = 'lumiconnect-v1';
const ASSETS = [
  './',
  './index.html',
  './assets/css/style.css',
  './assets/js/config.js',
  './assets/js/api.js',
  './assets/js/auth.js',
  './assets/js/webrtc.js',
  './assets/js/chat.js',
  './assets/js/forum.js',
  './assets/js/points.js',
  './assets/js/admin.js',
  './assets/js/app.js',
  './pages/about.html',
  './pages/privacy.html',
  './pages/terms.html',
  './pages/contact.html'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('script.google.com') ||
      e.request.url.includes('peerjs.com') ||
      e.request.url.includes('ipapi.co') ||
      e.request.url.includes('fonts.googleapis.com')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
