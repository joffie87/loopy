/*
@TVN_META
role: service_worker
desc: Service worker
last_updated: 2026-02-10
@END_META
*/

/**
 * Loopy PWA Service Worker
 *
 * Provides offline-first caching for the Loopy web app.
 * Uses a cache-first strategy for core assets.
 *
 * Version management:
 * - Increment CACHE_VERSION when updating assets
 * - Old caches are automatically cleared on activation
 */

const CACHE_VERSION = 'loopy-pwa-v1.2.7';
const RUNTIME_CACHE = 'loopy-runtime-v1.2.7';

/**
 * Core assets to precache on install
 * These files are required for offline functionality
 *
 * IMPORTANT: Preserve any ?v=X query params to match actual requests
 */
const CORE_ASSETS = [
  // Main HTML
  './index.html',

  // Stylesheets
  './css/loopy.css',
  './css/balloon.css',

  // JavaScript files (with version query params preserved)
  './js/helpers.js',
  './js/minpubsub.js',
  './js/Mouse.js?v=3',
  './js/Key.js?v=2',
  './js/Camera.js',
  './js/TouchMode.js',
  './js/TouchGestures.js',
  './js/SelectionManager.js?v=2',
  './js/Loopy.js?v=5',
  './js/Model.js?v=4',
  './js/Node.js?v=3',
  './js/Edge.js?v=2',
  './js/Label.js',
  './js/PageUI.js',
  './js/Sidebar.js?v=2',
  './js/Toolbar.js',
  './js/PlayControls.js',
  './js/Modal.js?v=4',
  './js/Ink.js',
  './js/Dragger.js',
  './js/Eraser.js',
  './js/Labeller.js',

  // Icons and UI assets
  './favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',

  // Cursors
  './css/cursors/ink.png',
  './css/cursors/drag.png',
  './css/cursors/erase.png',
  './css/cursors/label.png',

  // Toolbar icons
  './css/icons/controls.png',
  './css/icons/drag.png',
  './css/icons/erase.png',
  './css/icons/ink.png',
  './css/icons/label.png',

  // Slider images
  './css/sliders/color.png',
  './css/sliders/initial.png',
  './css/sliders/slider_pointer.png',
  './css/sliders/strength.png',
];

/**
 * INSTALL EVENT
 * Precache all core assets when the service worker is installed
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker:', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] Precaching core assets...');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Core assets precached successfully');
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Precache failed:', error);
        throw error;
      })
  );
});

/**
 * ACTIVATE EVENT
 * Clean up old caches when a new service worker activates
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker:', CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches that don't match current version
            if (cacheName !== CACHE_VERSION && cacheName !== RUNTIME_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

/**
 * FETCH EVENT
 * Intercept network requests and serve from cache when possible
 *
 * Strategy: Cache-first with network fallback
 * - Try to serve from cache
 * - If not in cache, fetch from network
 * - Cache the network response for future use (runtime cache)
 * - If offline and not in cache, return offline fallback
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached response
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((networkResponse) => {
            // Don't cache non-successful responses
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Clone the response (can only be read once)
            const responseToCache = networkResponse.clone();

            // Cache the fetched resource in runtime cache
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return networkResponse;
          })
          .catch((error) => {
            console.error('[SW] Fetch failed:', error);

            // Return offline fallback for HTML pages
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }

            // For other resources, just fail
            throw error;
          });
      })
  );
});

/**
 * MESSAGE EVENT
 * Handle messages from the main app
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
