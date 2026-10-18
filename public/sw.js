// Toasted Almond service worker: offline-first caching for the app shell and built assets.
// Bump CACHE_VERSION when the caching strategy changes. Built asset files are hashed, so
// cache-first is safe for them; navigations fall back to the cached shell when offline.
const CACHE_VERSION = 'v1'
const CACHE = `toasted-almond-${CACHE_VERSION}`
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('toasted-almond-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function putIfOk(request, response) {
  if (response.ok) {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => putIfOk(request, response))
        .catch(async () => (await caches.match(request)) || (await caches.match('/index.html')) || Response.error()),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => putIfOk(request, response)),
    ),
  )
})
