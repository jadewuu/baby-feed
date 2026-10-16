import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function source(path) {
  return readFile(new URL(path, root), 'utf8')
}

test('the application shell has no server authentication dependency', async () => {
  const files = await Promise.all([
    source('app/layout.tsx'),
    source('components/Providers.tsx'),
    source('components/Navbar.tsx'),
  ])

  const shell = files.join('\n')
  assert.doesNotMatch(shell, /next-auth|@\/lib\/auth|next\/headers|next\/server/)
})

test('the application shell boots through local data state', async () => {
  const providers = await source('components/Providers.tsx')
  const localDataProvider = await source('components/LocalDataProvider.tsx')
  const firstRunSetup = await source('components/FirstRunSetup.tsx')

  assert.match(providers, /LocalDataProvider/)
  assert.match(providers, /FirstRunSetup/)
  assert.match(localDataProvider, /needs-setup/)
  assert.match(localDataProvider, /activeBabyId/)
  assert.match(firstRunSetup, /只保存在这台设备/)
  assert.match(firstRunSetup, /不会上传/)
})

test('static shell assets use the GitHub Pages base path', async () => {
  const layout = await source('app/layout.tsx')
  const serviceWorkerManager = await source('components/ServiceWorkerManager.tsx')

  assert.match(layout, /\/baby-feed\/manifest\.json/)
  assert.match(layout, /\/baby-feed\/icon\.svg/)
  assert.match(serviceWorkerManager, /withBasePath\('\/sw\.js'\)/)
})

test('navbar keeps care navigation without account controls', async () => {
  const navbar = await source('components/Navbar.tsx')

  assert.doesNotMatch(navbar, /useSession|signOut|退出登录/)
  assert.match(navbar, /记录/)
  assert.match(navbar, /统计/)
})
