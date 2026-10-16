import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const activeWriteComponents = [
  'components/RecordComposerProvider.tsx',
  'components/record-composer/RecordComposerEditor.tsx',
  'components/FeedingForm.tsx',
  'components/HealthForm.tsx',
  'components/MemoForm.tsx',
  'components/HealthRecordFields.tsx',
  'components/ToothEruptionFields.tsx',
  'components/ToothGrowthStats.tsx',
  'components/TimelineEditRecordModal.tsx',
]

test('active record writers use local repositories only', async () => {
  const sources = await Promise.all(activeWriteComponents.map(async path => ({
    path,
    text: await readFile(new URL(path, root), 'utf8'),
  })))

  for (const source of sources) {
    assert.doesNotMatch(
      source.text,
      /\/api\/|fetch\s*\(|next-auth|cache-helpers|request-cache/,
      `${source.path} still crosses the server data boundary`,
    )
  }
})

test('record writers call the local repository through the local data commit boundary', async () => {
  const composer = await readFile(new URL('components/record-composer/RecordComposerEditor.tsx', root), 'utf8')
  const provider = await readFile(new URL('components/RecordComposerProvider.tsx', root), 'utf8')
  const timeline = await readFile(new URL('components/Timeline.tsx', root), 'utf8')

  assert.match(composer, /createFeedingRecord/)
  assert.match(composer, /createHealthRecord/)
  assert.match(composer, /createMemo/)
  assert.match(composer, /commit\s*\(/)
  assert.match(provider, /deleteFeedingRecord/)
  assert.match(provider, /deleteHealthRecord/)
  assert.match(provider, /deleteMemo/)
  assert.match(timeline, /updateFeedingRecord/)
  assert.match(timeline, /updateHealthRecord/)
})
