import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { generateServiceWorker } from '../scripts/generate-sw.mjs'

const projectRoot = new URL('../', import.meta.url)

async function createSampleExport() {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'baby-feed-sw-'))
  await mkdir(path.join(outDir, '_next/static/chunks'), { recursive: true })
  await mkdir(path.join(outDir, 'timeline'), { recursive: true })
  await mkdir(path.join(outDir, 'offline'), { recursive: true })
  await mkdir(path.join(outDir, 'unexpected'), { recursive: true })
  await writeFile(path.join(outDir, 'index.html'), '<main>home</main>')
  await writeFile(path.join(outDir, 'timeline/index.html'), '<main>timeline</main>')
  await writeFile(path.join(outDir, 'offline/index.html'), '<main>offline</main>')
  await writeFile(path.join(outDir, '_next/static/chunks/app.js'), 'self.app=true')
  await writeFile(path.join(outDir, '_next/static/chunks/app.js.map'), '{}')
  await writeFile(path.join(outDir, 'manifest.json'), '{"name":"Baby Feed"}')
  await writeFile(path.join(outDir, 'unexpected/data.json'), '{"private":true}')
  await writeFile(path.join(outDir, 'timeline.txt'), 'rsc payload')
  return outDir
}

test('generator creates a scoped, versioned offline worker from exported pages and assets', async t => {
  const outDir = await createSampleExport()
  t.after(() => rm(outDir, { recursive: true, force: true }))

  await generateServiceWorker({ outDir, basePath: '/baby-feed' })
  const worker = await readFile(path.join(outDir, 'sw.js'), 'utf8')

  assert.match(worker, /baby-feed-[a-f0-9]{12}/)
  assert.match(worker, /const BASE_PATH = ['"]\/baby-feed\/['"]/)
  assert.match(worker, /\/baby-feed\/timeline\//)
  assert.match(worker, /\/baby-feed\/offline\//)
  assert.match(worker, /\/baby-feed\/_next\/static\/chunks\/app\.js/)
  assert.match(worker, /\/baby-feed\/manifest\.json/)
  assert.doesNotMatch(worker, /app\.js\.map|unexpected\/data\.json|timeline\.txt/)
  assert.match(worker, /url\.origin !== self\.location\.origin/)
  assert.match(worker, /request\.mode === ['"]navigate['"]/)
  assert.match(worker, /NAVIGATION_FALLBACK/)
  assert.match(worker, /SKIP_WAITING/)
  assert.doesNotMatch(worker, /indexedDB|babyProfiles|feedingRecords|healthRecords|memos/)
})

test('cache version changes when an exported asset changes', async t => {
  const outDir = await createSampleExport()
  t.after(() => rm(outDir, { recursive: true, force: true }))

  await generateServiceWorker({ outDir, basePath: '/baby-feed/' })
  const first = await readFile(path.join(outDir, 'sw.js'), 'utf8')
  const firstCache = first.match(/baby-feed-[a-f0-9]{12}/)?.[0]

  await writeFile(path.join(outDir, '_next/static/chunks/app.js'), 'self.app=false')
  await generateServiceWorker({ outDir, basePath: '/baby-feed/' })
  const second = await readFile(path.join(outDir, 'sw.js'), 'utf8')
  const secondCache = second.match(/baby-feed-[a-f0-9]{12}/)?.[0]

  assert.ok(firstCache)
  assert.ok(secondCache)
  assert.notEqual(firstCache, secondCache)
})

test('web manifest is scoped to the deployed application path', async () => {
  const manifest = JSON.parse(await readFile(new URL('public/manifest.json', projectRoot), 'utf8'))
  assert.equal(manifest.start_url, '/baby-feed/')
  assert.equal(manifest.scope, '/baby-feed/')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.orientation, 'portrait-primary')
  for (const icon of manifest.icons) assert.match(icon.src, /^\/baby-feed\//)
})
