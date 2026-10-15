import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'

import 'fake-indexeddb/auto'

import { openDB } from 'idb'
import {
  BABY_FEED_DB_NAME,
  BABY_FEED_DB_VERSION,
  STORE_NAMES,
} from '../lib/local-store/schema.ts'
import {
  openBabyFeedDb,
  resetBabyFeedDbForTests,
} from '../lib/local-store/db.ts'

afterEach(async () => {
  await resetBabyFeedDbForTests(true)
})

test('fresh database creates the version 2 stores and query indexes', async () => {
  const db = await openBabyFeedDb()

  assert.equal(db.version, BABY_FEED_DB_VERSION)
  assert.deepEqual(
    [...db.objectStoreNames].sort(),
    Object.values(STORE_NAMES).sort(),
  )

  assert.deepEqual(
    [...db.transaction(STORE_NAMES.feedingRecords).store.indexNames].sort(),
    ['by-baby-time'],
  )
  assert.deepEqual(
    [...db.transaction(STORE_NAMES.healthRecords).store.indexNames].sort(),
    ['by-baby-time', 'by-baby-type-time'],
  )
  assert.deepEqual(
    [...db.transaction(STORE_NAMES.toothEruptions).store.indexNames].sort(),
    ['by-baby-tooth', 'by-health-record'],
  )
  assert.deepEqual(
    [...db.transaction(STORE_NAMES.memos).store.indexNames].sort(),
    ['by-baby-status-time', 'by-baby-time'],
  )
})

test('version 1 baby and settings rows survive the version 2 upgrade', async () => {
  const oldDb = await openDB(BABY_FEED_DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAMES.metadata, { keyPath: 'key' })
      db.createObjectStore(STORE_NAMES.babies, { keyPath: 'id' })
      db.createObjectStore(STORE_NAMES.settings, { keyPath: 'key' })
    },
  })
  await oldDb.put(STORE_NAMES.babies, {
    id: 'baby-v1',
    name: '小满',
    birthDate: '2026-01-01',
    gender: 'FEMALE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
  await oldDb.put(STORE_NAMES.settings, {
    key: 'app',
    activeBabyId: 'baby-v1',
    quickRecordKeys: ['FORMULA'],
  })
  oldDb.close()

  const upgraded = await openBabyFeedDb()

  assert.equal(upgraded.version, 2)
  assert.equal((await upgraded.get(STORE_NAMES.babies, 'baby-v1'))?.name, '小满')
  assert.deepEqual(await upgraded.get(STORE_NAMES.settings, 'app'), {
    key: 'app',
    activeBabyId: 'baby-v1',
    quickRecordKeys: ['FORMULA'],
  })
  assert.ok(upgraded.objectStoreNames.contains(STORE_NAMES.feedingRecords))
})

test('aborting a multi-store transaction preserves the prior snapshot', async () => {
  const db = await openBabyFeedDb()
  const before = await db.getAll(STORE_NAMES.babies)
  const transaction = db.transaction(
    [STORE_NAMES.babies, STORE_NAMES.settings],
    'readwrite',
  )
  await transaction.objectStore(STORE_NAMES.babies).put({
    id: 'rolled-back',
    name: '不会保存',
    birthDate: '2026-01-01',
    gender: 'MALE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
  transaction.abort()
  await assert.rejects(transaction.done)

  assert.deepEqual(await db.getAll(STORE_NAMES.babies), before)
})
