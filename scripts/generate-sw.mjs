import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import swTemplate from './sw-template.js'

const { renderServiceWorker } = swTemplate

const STATIC_EXTENSIONS = new Set([
  '.avif', '.css', '.gif', '.html', '.ico', '.jpeg', '.jpg', '.js',
  '.png', '.svg', '.webp', '.woff', '.woff2',
])

function normalizeBasePath(basePath) {
  const trimmed = `/${basePath}`.replace(/\/{2,}/g, '/').replace(/\/$/, '')
  return `${trimmed}/`
}

async function walk(dir, relativeDir = '') {
  const entries = await readdir(path.join(dir, relativeDir), { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relativePath = path.posix.join(relativeDir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(dir, relativePath))
    else files.push(relativePath)
  }
  return files
}

function isPrecacheFile(relativePath) {
  if (relativePath === 'sw.js') return false
  if (relativePath === 'manifest.json') return true
  return STATIC_EXTENSIONS.has(path.extname(relativePath).toLowerCase())
}

function toPublicUrl(relativePath, basePath) {
  if (relativePath === 'index.html') return basePath
  if (relativePath.endsWith('/index.html')) {
    return `${basePath}${relativePath.slice(0, -'index.html'.length)}`
  }
  return `${basePath}${relativePath}`
}

export async function generateServiceWorker({ outDir, basePath }) {
  const normalizedBasePath = normalizeBasePath(basePath)
  const files = (await walk(outDir)).filter(isPrecacheFile).sort()
  const hash = createHash('sha256')

  for (const relativePath of files) {
    hash.update(relativePath)
    hash.update('\0')
    hash.update(await readFile(path.join(outDir, relativePath)))
    hash.update('\0')
  }

  const cacheName = `baby-feed-${hash.digest('hex').slice(0, 12)}`
  const precacheUrls = files.map(file => toPublicUrl(file, normalizedBasePath))
  const worker = renderServiceWorker({ cacheName, basePath: normalizedBasePath, precacheUrls })
  await writeFile(path.join(outDir, 'sw.js'), worker)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await generateServiceWorker({
    outDir: path.resolve(process.argv[2] || 'out'),
    basePath: process.argv[3] || '/baby-feed',
  })
}
