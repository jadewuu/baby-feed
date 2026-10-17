import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workflowUrl = new URL('../.github/workflows/pages.yml', import.meta.url)

test('Pages workflow builds, verifies, uploads, and deploys the static export', async () => {
  const workflow = await readFile(workflowUrl, 'utf8')

  assert.match(workflow, /push:\s*\n\s*branches:\s*\[offline-pwa\]/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /concurrency:[\s\S]*group:\s*pages[\s\S]*cancel-in-progress:\s*false/)
  assert.match(workflow, /uses:\s*actions\/checkout@v7/)
  assert.match(workflow, /uses:\s*actions\/setup-node@v7/)
  assert.match(workflow, /node-version:\s*22/)
  assert.match(workflow, /run:\s*npm ci/)
  assert.match(workflow, /run:\s*npm test/)
  assert.match(workflow, /run:\s*npx tsc --noEmit/)
  assert.match(workflow, /run:\s*npm run build/)
  assert.match(workflow, /uses:\s*actions\/upload-pages-artifact@v5[\s\S]*path:\s*out/)
  assert.match(workflow, /deploy:[\s\S]*needs:\s*build/)
  assert.match(workflow, /environment:[\s\S]*name:\s*github-pages/)
  assert.match(workflow, /uses:\s*actions\/deploy-pages@v5/)
})

test('Pages workflow grants only the permissions each job needs', async () => {
  const workflow = await readFile(workflowUrl, 'utf8')

  assert.match(workflow, /permissions:\s*\{\}/)
  assert.match(workflow, /build:[\s\S]*?permissions:\s*\n\s*contents:\s*read/)
  assert.match(workflow, /deploy:[\s\S]*?permissions:\s*\n\s*pages:\s*write\s*\n\s*id-token:\s*write/)
})
