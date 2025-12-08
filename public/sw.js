/**
 * VTracer WASM Service Worker
 * 
 * Provides comprehensive offline functionality for the PWA including:
 * - Precaching of core assets for instant loading
 * - Cache-first strategy for WASM files (critical for offline processing)
 * - Stale-while-revalidate for JS/CSS/assets
 * - Network-first with cache fallback for other requests
 * - Automatic cache cleanup on updates
 */

const CACHE_NAME = 'vtracer-wasm-v1';
const BASE_PATH = '/vtracer-wasm';

const PRECACHE_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/site.webmanifest`,
  `${BASE_PATH}/favicon.svg`,
  `${BASE_PATH}/favicon.ico`,
  `${BASE_PATH}/favicon-16x16.png`,
  `${BASE_PATH}/favicon-32x32.png`,
  `${BASE_PATH}/apple-touch-icon.png`,
  `${BASE_PATH}/android-chrome-192x192.png`,
  `${BASE_PATH}/android-chrome-512x512.png`,
  `${BASE_PATH}/VTRacer-WASM-Square.svg`,
  `${BASE_PATH}/VTRacer-WASM-Full.svg`,
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching core assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Precaching complete, skipping waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Precaching failed:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (url.origin !== self.location.origin) {
    return;
  }
  
  if (request.method !== 'GET') {
    return;
  }
  
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            fetchAndCache(request);
            return cachedResponse;
          }
          return fetchAndCache(request);
        })
        .catch(() => {
          return caches.match(`${BASE_PATH}/`);
        })
    );
    return;
  }
  
  if (url.pathname.endsWith('.wasm')) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetchAndCache(request);
        })
    );
    return;
  }
  
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          const fetchPromise = fetchAndCache(request);
          return cachedResponse || fetchPromise;
        })
    );
    return;
  }
  
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

/**
 * Fetch and cache a request, with cache fallback on network errors
 * @param request - The request to fetch and cache
 * @returns Promise<Response> - The fetched or cached response
 */
async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

/**
 * Handle messages from the main thread
 * Supports SKIP_WAITING for service worker updates
 * and GET_VERSION for cache information
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

/**
 * Background sync event handler
 * Reserved for future enhancement features
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
});

console.log('[SW] Service worker loaded');
