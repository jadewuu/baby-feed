import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function exists(path) {
  try {
    await access(new URL(path, root))
    return true
  } catch {
    return false
  }
}

test('static route tree has no server entry points', async () => {
  const forbidden = [
    'app/api/',
    'app/login/',
    'app/register/',
    'app/admin/',
    'app/settings/api-keys/',
    'app/settings/reminders/',
    'app/settings/webhooks/',
    'middleware.ts',
    'instrumentation.ts',
  ]

  for (const path of forbidden) assert.equal(await exists(path), false, `${path} must be removed`)
})

test('offline package surface has no server runtime dependencies', async () => {
  const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
  for (const name of [
    '@prisma/adapter-libsql',
    '@prisma/client',
    'prisma',
    'next-auth',
    'bcryptjs',
    'cross-fetch',
    'node-fetch',
  ]) {
    assert.equal(dependencies[name], undefined, `${name} must be removed`)
  }
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /prisma|db push/)
})

test('active application source has no server-only imports', async () => {
  const files = [
    'app/layout.tsx',
    'app/page.tsx',
    'components/Providers.tsx',
    'components/Dashboard.tsx',
    'components/Timeline.tsx',
    'components/Stats.tsx',
    'components/Settings.tsx',
  ]
  const text = (await Promise.all(files.map(path => readFile(new URL(path, root), 'utf8')))).join('\n')
  assert.doesNotMatch(text, /next-auth|@prisma|@\/lib\/(?:auth|db|server-)|next\/headers|next\/server|\/api\//)
})

test('README describes the offline deployment and backup model', async () => {
  const readme = await readFile(new URL('README.md', root), 'utf8')
  assert.match(readme, /https:\/\/jadewu\.online\/baby-feed\//)
  assert.match(readme, /\/baby-feed\//)
  assert.match(readme, /IndexedDB/)
  assert.match(readme, /备份/)
})
