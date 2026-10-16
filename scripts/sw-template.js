function renderServiceWorker({ cacheName, basePath, precacheUrls }) {
  const cachePrefix = 'baby-feed-'
  const navigationFallback = `${basePath}offline/`

  return `/// <reference lib="webworker" />

const CACHE_PREFIX = ${JSON.stringify(cachePrefix)}
const CACHE_NAME = ${JSON.stringify(cacheName)}
const BASE_PATH = ${JSON.stringify(basePath)}
const NAVIGATION_FALLBACK = ${JSON.stringify(navigationFallback)}
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

function navigationPath(pathname) {
  if (pathname.endsWith('/')) return pathname
  return pathname + '/'
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE_PATH)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const page = await cache.match(navigationPath(url.pathname), { ignoreSearch: true })
        if (page) return page
        const fallback = await cache.match(NAVIGATION_FALLBACK)
        return fallback || new Response('Offline', { status: 503 })
      })
    )
    return
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
        }
        return response
      })
    })
  )
})
`
}

module.exports = { renderServiceWorker }
