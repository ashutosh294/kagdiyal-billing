/* ══════════════════════════════════════════
   Kagdiyal Holidays Billing — Service Worker
   Version: 1.0
══════════════════════════════════════════ */

const CACHE_NAME = 'kh-billing-v1';

// Cache karne wali files (app shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

// ── INSTALL: cache static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Main HTML cache karo
      return cache.addAll(['/index.html', '/']).catch(() => {
        // Agar koi fail ho toh ignore karo
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: purana cache hataao ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: Network first, cache fallback ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase API calls — sirf network, kabhi cache mat karo
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // CDN scripts — cache first (ye rarely change hote hain)
  if (
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // App shell (HTML, manifest) — Network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Fresh response cache mein save karo
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        // Offline hai — cache se serve karo
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Koi bhi page request pe index.html return karo
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
