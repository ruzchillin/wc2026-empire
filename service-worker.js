/**
 * Service Worker — WC 2026 Intel PWA
 *
 * Handles:
 * - Offline caching (app works without internet)
 * - Push notifications (goal alerts, match start)
 * - Background sync
 *
 * To register: add to any HTML page:
 *   <script>
 *     if ('serviceWorker' in navigator) {
 *       navigator.serviceWorker.register('/service-worker.js');
 *     }
 *   </script>
 *
 * Push notification payload format:
 * {
 *   "title": "⚽ GOAL! Mbappé scores!",
 *   "body": "France 1-0 Argentina (23')",
 *   "icon": "/icons/icon-192.png",
 *   "badge": "/icons/badge-72.png",
 *   "url": "/live-scores.html",
 *   "tag": "goal-france-argentina",
 *   "data": { "matchId": "1001", "type": "GOAL" }
 * }
 */

const CACHE_NAME    = 'wc2026-v2';
const OFFLINE_URL   = '/offline.html';
const STATIC_ASSETS = [
  // Shell
  '/',
  '/offline.html',
  '/manifest.json',
  // PWA icons (required for SW install to succeed)
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/apple-touch-icon.png',
  // OG default image
  '/og-default.png',
  // Core pages (most visited — cache at install)
  '/live-scores.html',
  '/group-standings.html',
  '/golden-boot-tracker.html',
  '/watch-guide.html',
  '/prediction-game.html',
  '/leaderboard.html',
  '/viral-quiz.html',
  '/merch-store.html',
  '/command-center.html',
  // Affiliate / monetization pages
  '/betting-guide.html',
  '/free-bets.html',
];

// ── Install: cache static assets ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fall back to network ─────────────────────────────
self.addEventListener('fetch', event => {
  // Skip non-GET and API requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache successful HTML responses
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    data = {
      title: '⚽ WC 2026 Intel',
      body: event.data?.text() || 'New update available',
    };
  }

  const options = {
    body:    data.body || 'Tap to view',
    icon:    data.icon || '/icons/icon-192.png',
    badge:   data.badge || '/icons/badge-72.png',
    tag:     data.tag || 'wc2026-general',
    data:    data.data || { url: '/live-scores.html' },
    actions: [
      { action: 'view',    title: 'View now' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    vibrate:     [200, 100, 200],
    requireInteraction: data.type === 'GOAL' || data.type === 'RED_CARD',
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '⚽ WC 2026', options)
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/live-scores.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ── Background sync (for offline email submissions) ───────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'email-subscribe') {
    event.waitUntil(syncEmailSubscriptions());
  }
});

async function syncEmailSubscriptions() {
  try {
    const cache = await caches.open('offline-queue');
    const requests = await cache.keys();

    for (const req of requests) {
      if (req.url.includes('subscribe-offline')) {
        const data = await (await cache.match(req)).json();
        await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        await cache.delete(req);
      }
    }
  } catch (err) {
    console.error('[SW] Sync failed:', err);
  }
}
