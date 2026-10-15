import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'

import 'fake-indexeddb/auto'

import {
  createBaby,
  deleteBaby,
  listBabies,
  updateBaby,
} from '../lib/local-store/babies.ts'
import {
  openBabyFeedDb,
  resetBabyFeedDbForTests,
} from '../lib/local-store/db.ts'
import { STORE_NAMES } from '../lib/local-store/schema.ts'
import {
  getSettings,
  setActiveBabyId,
  setQuickRecordKeys,
} from '../lib/local-store/settings.ts'

beforeEach(async () => {
  await resetBabyFeedDbForTests(true)
})

afterEach(async () => {
  await resetBabyFeedDbForTests(true)
})

test('baby creation assigns stable identifiers and selects the first baby', async () => {
  const baby = await createBaby({
    name: '  小满  ',
    birthDate: '2026-04-08',
    gender: 'FEMALE',
  })

  assert.match(baby.id, /^[0-9a-f-]{36}$/i)
  assert.equal(baby.name, '小满')
  assert.equal(baby.createdAt, baby.updatedAt)
  assert.equal(Number.isNaN(Date.parse(baby.createdAt)), false)
  assert.equal((await getSettings()).activeBabyId, baby.id)
})

test('babies have deterministic creation order and edits keep their id', async () => {
  const first = await createBaby({ name: '大宝', birthDate: '2025-01-01', gender: 'MALE' })
  await new Promise(resolve => setTimeout(resolve, 2))
  const second = await createBaby({ name: '二宝', birthDate: '2026-01-01', gender: 'FEMALE' })
  await new Promise(resolve => setTimeout(resolve, 2))

  const updated = await updateBaby(first.id, {
    name: '大宝贝',
    birthDate: '2025-01-02',
    gender: 'MALE',
  })

  assert.equal(updated.id, first.id)
  assert.equal(updated.createdAt, first.createdAt)
  assert.notEqual(updated.updatedAt, first.updatedAt)
  assert.deepEqual((await listBabies()).map(baby => baby.id), [first.id, second.id])
})

test('settings normalize quick records and reject an unknown active baby', async () => {
  const baby = await createBaby({ name: '小满', birthDate: '2026-04-08', gender: 'FEMALE' })

  await setQuickRecordKeys(['FORMULA', 'FORMULA', 'unknown'])
  assert.deepEqual((await getSettings()).quickRecordKeys, ['FORMULA'])

  const before = await getSettings()
  await assert.rejects(setActiveBabyId('missing'), /宝宝不存在/)
  assert.deepEqual(await getSettings(), before)

  await setActiveBabyId(null)
  assert.equal((await getSettings()).activeBabyId, null)
  await setActiveBabyId(baby.id)
  assert.equal((await getSettings()).activeBabyId, baby.id)
})

test('deleting the active baby cascades its data and selects the next baby', async () => {
  const first = await createBaby({ name: '大宝', birthDate: '2025-01-01', gender: 'MALE' })
  const second = await createBaby({ name: '二宝', birthDate: '2026-01-01', gender: 'FEMALE' })
  const db = await openBabyFeedDb()
  await db.put(STORE_NAMES.feedingRecords, {
    id: 'feeding-1', babyId: first.id, type: 'FORMULA', formulaAmount: 90,
    startTime: '2026-10-15T01:00:00.000Z', createdAt: '2026-10-15T01:00:00.000Z', updatedAt: '2026-10-15T01:00:00.000Z',
  })
  await db.put(STORE_NAMES.healthRecords, {
    id: 'health-1', babyId: first.id, type: 'TOOTH_ERUPTION', recordedAt: '2026-10-15T01:00:00.000Z',
    createdAt: '2026-10-15T01:00:00.000Z', updatedAt: '2026-10-15T01:00:00.000Z',
  })
  await db.put(STORE_NAMES.toothEruptions, {
    id: 'tooth-1', healthRecordId: 'health-1', babyId: first.id, toothCode: '51',
    createdAt: '2026-10-15T01:00:00.000Z', updatedAt: '2026-10-15T01:00:00.000Z',
  })
  await db.put(STORE_NAMES.memos, {
    id: 'memo-1', babyId: first.id, title: '复诊', content: null,
    scheduledAt: '2026-10-16T01:00:00.000Z', completed: false, status: 'pending', completedAt: null,
    createdAt: '2026-10-15T01:00:00.000Z', updatedAt: '2026-10-15T01:00:00.000Z',
  })

  await deleteBaby(first.id)

  assert.deepEqual((await listBabies()).map(baby => baby.id), [second.id])
  assert.equal((await getSettings()).activeBabyId, second.id)
  assert.equal(await db.count(STORE_NAMES.feedingRecords), 0)
  assert.equal(await db.count(STORE_NAMES.healthRecords), 0)
  assert.equal(await db.count(STORE_NAMES.toothEruptions), 0)
  assert.equal(await db.count(STORE_NAMES.memos), 0)
})
