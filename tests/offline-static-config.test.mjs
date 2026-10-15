import assert from 'node:assert/strict'
import test from 'node:test'

import nextConfig from '../next.config.mjs'
import { BASE_PATH, withBasePath } from '../lib/base-path.ts'

test('offline static config exports the application below /baby-feed', () => {
  assert.equal(nextConfig.output, 'export')
  assert.equal(nextConfig.basePath, '/baby-feed')
  assert.equal(nextConfig.trailingSlash, true)
  assert.equal(nextConfig.images?.unoptimized, true)
})

test('base-path helper prefixes application routes and assets once', () => {
  assert.equal(BASE_PATH, '/baby-feed')
  assert.equal(withBasePath('/'), '/baby-feed/')
  assert.equal(withBasePath('icons/icon-192x192.png'), '/baby-feed/icons/icon-192x192.png')
  assert.equal(withBasePath('/manifest.json'), '/baby-feed/manifest.json')
  assert.equal(withBasePath('/sw.js'), '/baby-feed/sw.js')
  assert.equal(withBasePath('/baby-feed/stats/'), '/baby-feed/stats/')
})
