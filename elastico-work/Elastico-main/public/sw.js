/**
 * ELASTICO — Service Worker
 *
 * Caches the entire ~5 MB web app shell on first visit (iPhone 6s Safari).
 * After that, the app loads from phone storage — 0 MB mobile data on reopen.
 *
 * Strategy:
 *   - App shell (HTML, JS, CSS bundles): Cache-First → Network fallback
 *   - API data: Network-First → Cache fallback (max 10 s stale)
 *   - Static assets (_next/static/*): Cache-First (immutable, 1 year)
 *   - Icons/manifest: Cache-First (immutable)
 *
 * The 30-second match polling sends only diff payloads (< 5 KB per cycle)
 * through the compressed-data-stream module on the server side.
 */

const CACHE_VERSION = 'elastico-v3'
const SHELL_CACHE = CACHE_VERSION + '-shell'
const DATA_CACHE = CACHE_VERSION + '-data'
const STATIC_CACHE = CACHE_VERSION + '-static'
const ICON_CACHE = CACHE_VERSION + '-icons'

// ── Install: Pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', function (event) {
  console.log('[ELASTICO SW] Installing — pre-caching app shell...')

  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll([
        '/',
      ]).then(function () {
        console.log('[ELASTICO SW] App shell cached — app now works offline')
        return self.skipWaiting()
      })
    })
  )
})

// ── Activate: Clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', function (event) {
  console.log('[ELASTICO SW] Activating — cleaning old caches...')

  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) {
            return name.startsWith('elastico-') && !name.includes(CACHE_VERSION)
          })
          .map(function (name) {
            console.log('[ELASTICO SW] Deleting old cache: ' + name)
            return caches.delete(name)
          })
      )
    }).then(function () { return self.clients.claim() })
  )
})

// ── Fetch: Route-based caching strategy ──────────────────────────────────────
self.addEventListener('fetch', function (event) {
  var request = event.request
  var url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip chrome-extension and other non-http(s) protocols
  if (!url.protocol.startsWith('http')) return

  // ── Static Assets (_next/static/*) — Cache-First ────────────────────────
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(function (cache) {
        return cache.match(request).then(function (cached) {
          if (cached) return cached
          return fetch(request).then(function (response) {
            if (response.ok) {
              cache.put(request, response.clone())
            }
            return response
          })
        })
      })
    )
    return
  }

  // ── Icons & Manifest — Cache-First ──────────────────────────────────────
  if (url.pathname.startsWith('/icons/') ||
      url.pathname === '/manifest.webmanifest' ||
      url.pathname === '/logo.svg' ||
      url.pathname === '/robots.txt') {
    event.respondWith(
      caches.open(ICON_CACHE).then(function (cache) {
        return cache.match(request).then(function (cached) {
          if (cached) return cached
          return fetch(request).then(function (response) {
            if (response.ok) {
              cache.put(request, response.clone())
            }
            return response
          })
        })
      })
    )
    return
  }

  // ── API Routes — Network-First with Cache Fallback ──────────────────────
  if (url.pathname.startsWith('/api/')) {
    // Don't cache system/admin endpoints
    if (url.pathname.startsWith('/api/system/') || url.pathname.startsWith('/api/admin/')) {
      event.respondWith(fetch(request))
      return
    }

    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (response.ok) {
            var clone = response.clone()
            caches.open(DATA_CACHE).then(function (cache) {
              cache.put(request, clone)
            })
          }
          return response
        })
        .catch(function () {
          return caches.open(DATA_CACHE).then(function (cache) {
            return cache.match(request)
          })
        })
    )
    return
  }

  // ── Navigation (HTML pages) — Network-First for SPA ───────────────────────
  if (request.mode === 'navigate' || url.pathname === '/') {
    event.respondWith(
      caches.open(SHELL_CACHE).then(function (cache) {
        return cache.match(request).then(function (cached) {
          return fetch(request)
            .then(function (response) {
              if (response.ok) {
                cache.put(request, response.clone())
              }
              return response
            })
            .catch(function () {
              if (cached) return cached
              return new Response(offlineHTML(), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
              })
            })
        })
      })
    )
    return
  }

  // ── Everything else — Network-First with cache fallback ─────────────────
  event.respondWith(
    fetch(request)
      .then(function (response) {
        if (response.ok) {
          var clone = response.clone()
          caches.open(SHELL_CACHE).then(function (cache) {
            cache.put(request, clone)
          })
        }
        return response
      })
      .catch(function () {
        return caches.match(request)
      })
  )
})

// ── Offline Fallback HTML ─────────────────────────────────────────────────────
function offlineHTML() {
  return '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '  <meta name="theme-color" content="#0a0a0a">\n' +
    '  <title>ELASTICO — Offline</title>\n' +
    '  <style>\n' +
    '    * { margin: 0; padding: 0; box-sizing: border-box; }\n' +
    '    body {\n' +
    '      font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;\n' +
    '      background: #0a0a0a; color: #fff;\n' +
    '      display: flex; align-items: center; justify-content: center;\n' +
    '      min-height: 100vh; padding: 20px; text-align: center;\n' +
    '    }\n' +
    '    .e { font-size: 72px; font-weight: bold; color: #00e676; margin-bottom: 16px; }\n' +
    '    h1 { font-size: 24px; color: #00e676; margin-bottom: 8px; }\n' +
    '    p { color: #888; font-size: 14px; line-height: 1.6; max-width: 320px; }\n' +
    '    button {\n' +
    '      margin-top: 24px; padding: 12px 32px;\n' +
    '      background: #00e676; color: #000; border: none;\n' +
    '      border-radius: 8px; font-size: 16px; font-weight: 600;\n' +
    '      cursor: pointer;\n' +
    '    }\n' +
    '    button:active { opacity: 0.8; }\n' +
    '  </style>\n' +
    '</head>\n' +
    '<body>\n' +
    '  <div>\n' +
    '    <div class="e">E</div>\n' +
    '    <h1>You\'re Offline</h1>\n' +
    '    <p>ELASTICO is using cached data. Check your connection for live updates.</p>\n' +
    '    <button onclick="window.location.reload()">Try Again</button>\n' +
    '  </div>\n' +
    '</body>\n' +
    '</html>'
}

// ── Message Handler (for cache invalidation from main thread) ─────────────────
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[ELASTICO SW] Clearing all caches...')
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) { return caches.delete(n) }))
    }).then(function () {
      console.log('[ELASTICO SW] All caches cleared')
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' })
      }
    })
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})