import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { parseBackupText } from '../lib/local-store/backup.ts'

const root = new URL('../', import.meta.url)

test('settings surfaces contain only local device controls', async () => {
  const paths = [
    'app/settings/page.tsx',
    'app/settings/quick-records/page.tsx',
    'components/Settings.tsx',
    'components/QuickRecordSettings.tsx',
    'components/LocalDataSettings.tsx',
  ]
  const sources = await Promise.all(paths.map(path => readFile(new URL(path, root), 'utf8')))
  const text = sources.join('\n')

  assert.doesNotMatch(text, /\/api\/|fetch\s*\(|next-auth|@\/lib\/auth|next\/headers|next\/server|AccountDangerZone|ApiKeyManager|WebhookManager|ReminderManager|SystemVersion/)
  assert.match(text, /createBaby/)
  assert.match(text, /updateBaby/)
  assert.match(text, /deleteBaby/)
  assert.match(text, /selectBaby/)
  assert.match(text, /exportBackup/)
  assert.match(text, /restoreBackup/)
  assert.match(text, /clearAllData/)
  assert.match(text, /敏感数据/)
  assert.match(text, /定期备份/)
})

test('backup text is parsed and validated before restore', () => {
  assert.throws(() => parseBackupText('{'), /JSON|格式/)
  assert.throws(() => parseBackupText(JSON.stringify({ format: 'other' })), /备份/)

  const valid = parseBackupText(JSON.stringify({
    format: 'baby-feed-backup',
    schemaVersion: 1,
    exportedAt: '2026-10-16T00:00:00.000Z',
    data: {
      metadata: [],
      babies: [],
      feedingRecords: [],
      healthRecords: [],
      toothEruptions: [],
      memos: [],
      settings: {
        activeBabyId: null,
        quickRecordKeys: ['BREAST_MILK', 'FORMULA', 'GROUP_HEALTH', 'GROUP_MEMO'],
      },
    },
  }))

  assert.deepEqual({
    babies: valid.data.babies.length,
    feedingRecords: valid.data.feedingRecords.length,
    healthRecords: valid.data.healthRecords.length,
    toothEruptions: valid.data.toothEruptions.length,
    memos: valid.data.memos.length,
  }, {
    babies: 0,
    feedingRecords: 0,
    healthRecords: 0,
    toothEruptions: 0,
    memos: 0,
  })
})
