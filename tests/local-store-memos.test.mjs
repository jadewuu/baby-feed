import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'

import 'fake-indexeddb/auto'

import { createBaby } from '../lib/local-store/babies.ts'
import { resetBabyFeedDbForTests } from '../lib/local-store/db.ts'
import {
  createMemo,
  deleteMemo,
  listMemos,
  updateMemo,
} from '../lib/local-store/memos.ts'

let baby
let otherBaby

beforeEach(async () => {
  await resetBabyFeedDbForTests(true)
  baby = await createBaby({ name: '小满', birthDate: '2026-04-08', gender: 'FEMALE' })
  otherBaby = await createBaby({ name: '小禾', birthDate: '2025-05-01', gender: 'MALE' })
})

afterEach(async () => {
  await resetBabyFeedDbForTests(true)
})

test('memo CRUD orders by completion and scheduled time with baby isolation', async () => {
  const later = await createMemo({
    babyId: baby.id, title: '复诊', content: null,
    scheduledAt: '2026-10-20T01:00:00.000Z',
  })
  const sooner = await createMemo({
    babyId: baby.id, title: '补充用品', content: '纸尿裤',
    scheduledAt: '2026-10-16T01:00:00.000Z',
  })
  await createMemo({
    babyId: otherBaby.id, title: '其他宝宝', content: null,
    scheduledAt: '2026-10-15T01:00:00.000Z',
  })

  assert.deepEqual((await listMemos(baby.id)).map(memo => memo.id), [sooner.id, later.id])
  assert.equal(later.completed, false)
  assert.equal(later.status, 'pending')

  const completed = await updateMemo(sooner.id, baby.id, { completed: true })
  assert.equal(completed.completed, true)
  assert.equal(completed.status, 'completed')
  assert.equal(Number.isNaN(Date.parse(completed.completedAt)), false)
  assert.deepEqual((await listMemos(baby.id, 'completed')).map(memo => memo.id), [sooner.id])

  const reopened = await updateMemo(sooner.id, baby.id, { completed: false })
  assert.equal(reopened.completedAt, null)
  assert.equal(reopened.status, 'pending')

  const edited = await updateMemo(later.id, baby.id, { title: '儿保复诊', content: '带记录' })
  assert.equal(edited.title, '儿保复诊')
  assert.equal(edited.content, '带记录')

  await deleteMemo(later.id, baby.id)
  assert.deepEqual((await listMemos(baby.id)).map(memo => memo.id), [sooner.id])
})

test('a failed memo write leaves the prior record unchanged', async () => {
  const memo = await createMemo({
    babyId: baby.id, title: '复诊', content: null,
    scheduledAt: '2026-10-20T01:00:00.000Z',
  })
  const before = await listMemos(baby.id)

  await assert.rejects(
    updateMemo(memo.id, baby.id, { scheduledAt: 'not-a-date' }),
    /时间格式不正确/,
  )
  assert.deepEqual(await listMemos(baby.id), before)
})
