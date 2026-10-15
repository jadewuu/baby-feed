import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'

import 'fake-indexeddb/auto'

import {
  clearAllData,
  exportBackup,
  restoreBackup,
  validateBackup,
} from '../lib/local-store/backup.ts'
import { createBaby } from '../lib/local-store/babies.ts'
import { openBabyFeedDb, resetBabyFeedDbForTests } from '../lib/local-store/db.ts'
import { createMemo } from '../lib/local-store/memos.ts'
import { createFeedingRecord, createHealthRecord } from '../lib/local-store/records.ts'
import { STORE_NAMES } from '../lib/local-store/schema.ts'
import { getSettings, setActiveBabyId, setQuickRecordKeys } from '../lib/local-store/settings.ts'

beforeEach(async () => {
  await resetBabyFeedDbForTests(true)
})

afterEach(async () => {
  await resetBabyFeedDbForTests(true)
})

function normalized(backup) {
  return { ...backup, exportedAt: '<ignored>' }
}

function clone(value) {
  return structuredClone(value)
}

async function seedCompleteDataset(label = '完整') {
  const baby = await createBaby({ name: `${label}宝宝`, birthDate: '2026-04-08', gender: 'FEMALE' })
  const other = await createBaby({ name: `${label}二宝`, birthDate: '2025-01-01', gender: 'MALE' })
  await setActiveBabyId(other.id)
  await setQuickRecordKeys(['FORMULA', 'GROUP_MEMO'])
  await createFeedingRecord({
    babyId: baby.id, type: 'FORMULA', formulaAmount: 120,
    startTime: '2026-10-15T01:00:00.000Z', notes: null,
  })
  await createHealthRecord({
    babyId: baby.id, type: 'WEIGHT', weight: 8.2,
    recordedAt: '2026-10-15T02:00:00.000Z', notes: null,
  })
  await createHealthRecord({
    babyId: baby.id, type: 'TOOTH_ERUPTION', toothCodes: ['51'],
    recordedAt: '2026-10-15T03:00:00.000Z', notes: null,
  })
  await createMemo({
    babyId: baby.id, title: '复诊', content: '带记录',
    scheduledAt: '2026-10-16T01:00:00.000Z',
  })
  const db = await openBabyFeedDb()
  await db.put(STORE_NAMES.metadata, { key: 'seed', value: label })
  return { baby, other }
}

test('backup round trip restores every entity and returns counts', async () => {
  await seedCompleteDataset()
  const before = await exportBackup()

  await clearAllData()
  const summary = await restoreBackup(validateBackup(before))
  const after = await exportBackup()

  assert.deepEqual(normalized(after), normalized(before))
  assert.deepEqual(summary, {
    babies: 2,
    feedingRecords: 1,
    healthRecords: 2,
    toothEruptions: 1,
    memos: 1,
  })
})

test('invalid backups never mutate the current dataset', async () => {
  const { baby } = await seedCompleteDataset('哨兵')
  const sentinel = await exportBackup()
  const valid = clone(sentinel)
  const toothHealth = valid.data.healthRecords.find(record => record.type === 'TOOTH_ERUPTION')

  const cases = [
    ['non-object', null],
    ['wrong format', { ...clone(valid), format: 'other' }],
    ['newer version', { ...clone(valid), schemaVersion: 999 }],
    ['duplicate id', (() => { const value = clone(valid); value.data.babies.push(clone(value.data.babies[0])); return value })()],
    ['invalid timestamp', (() => { const value = clone(valid); value.data.babies[0].createdAt = 'nope'; return value })()],
    ['invalid type', (() => { const value = clone(valid); value.data.feedingRecords[0].type = 'OTHER'; return value })()],
    ['missing baby reference', (() => { const value = clone(valid); value.data.feedingRecords[0].babyId = 'missing'; return value })()],
    ['missing active baby', (() => { const value = clone(valid); value.data.settings.activeBabyId = 'missing'; return value })()],
    ['duplicate tooth', (() => { const value = clone(valid); value.data.toothEruptions.push({ ...clone(value.data.toothEruptions[0]), id: 'duplicate-tooth' }); return value })()],
    ['tooth points to non-tooth health', (() => {
      const value = clone(valid)
      value.data.toothEruptions[0].healthRecordId = value.data.healthRecords.find(record => record.type === 'WEIGHT').id
      return value
    })()],
    ['tooth baby mismatch', (() => {
      const value = clone(valid)
      value.data.toothEruptions[0].babyId = value.data.babies.find(item => item.id !== baby.id).id
      value.data.toothEruptions[0].healthRecordId = toothHealth.id
      return value
    })()],
  ]

  for (const [name, candidate] of cases) {
    await assert.rejects(
      Promise.resolve().then(() => restoreBackup(candidate)),
      undefined,
      name,
    )
    assert.deepEqual(normalized(await exportBackup()), normalized(sentinel), name)
  }
})

test('a mid-restore storage failure aborts the replacement transaction', async () => {
  await seedCompleteDataset('目标')
  const target = await exportBackup()
  await clearAllData()
  await seedCompleteDataset('哨兵')
  const sentinel = await exportBackup()

  const originalPut = IDBObjectStore.prototype.put
  let puts = 0
  IDBObjectStore.prototype.put = function (...args) {
    puts += 1
    if (puts === 3) throw new DOMException('forced failure', 'QuotaExceededError')
    return originalPut.apply(this, args)
  }
  try {
    await assert.rejects(restoreBackup(target), /存储空间不足/)
  } finally {
    IDBObjectStore.prototype.put = originalPut
  }

  assert.deepEqual(normalized(await exportBackup()), normalized(sentinel))
})

test('clear data removes every entity and restores empty default settings', async () => {
  await seedCompleteDataset()

  await clearAllData()
  const backup = await exportBackup()

  assert.equal(backup.data.metadata.length, 0)
  assert.equal(backup.data.babies.length, 0)
  assert.equal(backup.data.feedingRecords.length, 0)
  assert.equal(backup.data.healthRecords.length, 0)
  assert.equal(backup.data.toothEruptions.length, 0)
  assert.equal(backup.data.memos.length, 0)
  assert.deepEqual(await getSettings(), {
    activeBabyId: null,
    quickRecordKeys: ['BREAST_MILK', 'FORMULA', 'GROUP_HEALTH', 'GROUP_MEMO'],
  })
})
