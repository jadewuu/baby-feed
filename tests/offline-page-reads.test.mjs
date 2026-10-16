import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const offlinePages = [
  'app/page.tsx',
  'app/timeline/page.tsx',
  'app/timeline/TimelinePageClient.tsx',
  'app/stats/page.tsx',
  'app/stats/StatsPageClient.tsx',
  'components/Dashboard.tsx',
  'components/Timeline.tsx',
  'components/Stats.tsx',
  'components/MemoSection.tsx',
]

async function source(path) {
  return readFile(new URL(path, root), 'utf8')
}

test('active pages and read components stay inside the local data boundary', async () => {
  for (const path of offlinePages) {
    const text = await source(path)
    assert.doesNotMatch(
      text,
      /\/api\/|fetch\s*\(|server-(?:babies|dashboard|timeline|stats)|client-request-cache|cache-helpers|next-auth|prisma/,
      `${path} still depends on server data`,
    )
  }
})

test('dashboard, timeline, stats, and memos use the local query and commit interfaces', async () => {
  assert.match(await source('components/Dashboard.tsx'), /getDashboardSnapshot/)
  assert.match(await source('components/Timeline.tsx'), /getTimelineDay/)
  assert.match(await source('components/Timeline.tsx'), /listTimelineDates/)
  assert.match(await source('components/Stats.tsx'), /getStatsSnapshot/)

  const memos = await source('components/MemoSection.tsx')
  assert.match(memos, /createMemo/)
  assert.match(memos, /updateMemo/)
  assert.match(memos, /deleteMemo/)
  assert.match(memos, /commit\s*\(/)
})
