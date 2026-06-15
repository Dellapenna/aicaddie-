// The Caddie — Service Worker
// Handles PWA install, offline fallback, and cache management

const CACHE_NAME = 'caddie-v1';
const OFFLINE_URL = '/';

// On install — cache the shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([OFFLINE_URL])
    ).then(() => self.skipWaiting())
  );
});

// On activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Navigation requests: network first, fall back to cached shell
// - API/Supabase calls: network only (never cache)
// - Static assets: cache first
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Supabase, Anthropic API, or external calls
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('golfcourseapi.com') ||
    url.hostname.includes('qrserver.com') ||
    url.hostname.includes('fonts.g') ||
    url.protocol === 'chrome-extension:'
  ) {
    return; // let browser handle it
  }

  // Navigation requests — serve app shell, network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL)
      )
    );
    return;
  }

  // Static assets — cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Only cache successful same-origin responses
        if (
          response.ok &&
          event.request.url.startsWith(self.location.origin)
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match(OFFLINE_URL))
  );
});
