import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'

import 'fake-indexeddb/auto'

import { createBaby } from '../lib/local-store/babies.ts'
import { openBabyFeedDb, resetBabyFeedDbForTests } from '../lib/local-store/db.ts'
import { LocalStoreError } from '../lib/local-store/errors.ts'
import {
  createFeedingRecord,
  createHealthRecord,
  deleteFeedingRecord,
  deleteHealthRecord,
  listFeedingRecords,
  listHealthHistory,
  updateFeedingRecord,
  updateHealthRecord,
} from '../lib/local-store/records.ts'
import { STORE_NAMES } from '../lib/local-store/schema.ts'

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

test('feeding CRUD covers all types, stable ids, ordering, and baby isolation', async () => {
  const records = []
  records.push(await createFeedingRecord({
    babyId: baby.id, type: 'BREAST_MILK', startTime: '2026-10-15T02:00:00.000Z',
    leftBreastDuration: 300, rightBreastDuration: 240, notes: null,
  }))
  records.push(await createFeedingRecord({
    babyId: baby.id, type: 'BREAST_MILK_BOTTLE', startTime: '2026-10-15T03:00:00.000Z',
    breastMilkAmount: 90, notes: null,
  }))
  records.push(await createFeedingRecord({
    babyId: baby.id, type: 'FORMULA', startTime: '2026-10-15T01:00:00.000Z',
    formulaAmount: 120, notes: '夜奶',
  }))
  records.push(await createFeedingRecord({
    babyId: baby.id, type: 'SOLID_FOOD', startTime: '2026-10-15T04:00:00.000Z',
    solidFoodName: '南瓜泥', solidFoodAmount: '半碗', notes: null,
  }))
  await createFeedingRecord({
    babyId: otherBaby.id, type: 'FORMULA', startTime: '2026-10-15T00:00:00.000Z',
    formulaAmount: 60, notes: null,
  })

  const listed = await listFeedingRecords(baby.id)
  assert.deepEqual(listed.map(record => record.type), ['FORMULA', 'BREAST_MILK', 'BREAST_MILK_BOTTLE', 'SOLID_FOOD'])
  assert.equal(listed.some(record => record.babyId === otherBaby.id), false)
  assert.equal(new Set(records.map(record => record.id)).size, 4)
  assert.ok(records.every(record => record.createdAt === record.updatedAt))

  await new Promise(resolve => setTimeout(resolve, 2))
  const formula = records[2]
  const updated = await updateFeedingRecord(formula.id, baby.id, {
    babyId: baby.id, type: 'FORMULA', startTime: formula.startTime,
    formulaAmount: 150, notes: '加量',
  })
  assert.equal(updated.id, formula.id)
  assert.equal(updated.createdAt, formula.createdAt)
  assert.notEqual(updated.updatedAt, formula.updatedAt)
  assert.equal(updated.formulaAmount, 150)

  await assert.rejects(updateFeedingRecord(formula.id, otherBaby.id, {
    babyId: otherBaby.id, type: 'FORMULA', startTime: formula.startTime,
    formulaAmount: 10, notes: null,
  }), /记录不存在/)
  await deleteFeedingRecord(formula.id, baby.id)
  assert.equal((await listFeedingRecords(baby.id)).some(record => record.id === formula.id), false)
})

test('health CRUD covers every supported type and history is newest first', async () => {
  const cases = [
    ['WEIGHT', { weight: 8.2 }],
    ['HEIGHT', { height: 70.5 }],
    ['TEMPERATURE', { temperature: 37.2 }],
    ['MEDICATION', { medicationName: '维生素', medicationDose: '1ml' }],
    ['VACCINE', { vaccineName: '乙肝', vaccineManufacturer: '示例厂商', vaccineDoseNumber: 2, vaccineTotalDoses: 3 }],
    ['DIAPER', { diaperType: 'BOTH', diaperStatus: '正常' }],
    ['AD_VITAMIN', { adGiven: true, vitaminDGiven: false }],
    ['SLEEP', { sleepStartTime: '2026-10-14T15:30:00.000Z', sleepEndTime: '2026-10-14T17:30:00.000Z', sleepQuality: '安稳' }],
    ['CUSTOM', { customName: '晒太阳' }],
  ]

  for (const [index, [type, fields]] of cases.entries()) {
    await createHealthRecord({
      babyId: baby.id,
      type,
      recordedAt: `2026-10-15T${String(index).padStart(2, '0')}:00:00.000Z`,
      notes: null,
      ...fields,
    })
  }
  await createHealthRecord({
    babyId: otherBaby.id, type: 'WEIGHT', weight: 9.1,
    recordedAt: '2026-10-15T20:00:00.000Z', notes: null,
  })

  const weights = await listHealthHistory(baby.id, 'WEIGHT')
  assert.equal(weights.length, 1)
  assert.equal(weights[0].weight, 8.2)
  assert.equal(weights[0].babyId, baby.id)

  const older = await createHealthRecord({
    babyId: baby.id, type: 'TEMPERATURE', temperature: 36.8,
    recordedAt: '2026-10-14T01:00:00.000Z', notes: null,
  })
  const newer = (await listHealthHistory(baby.id, 'TEMPERATURE'))[0]
  assert.notEqual(newer.id, older.id)

  const vaccine = (await listHealthHistory(baby.id, 'VACCINE'))[0]
  const updated = await updateHealthRecord(vaccine.id, baby.id, {
    babyId: baby.id, type: 'VACCINE', vaccineName: '乙肝', vaccineManufacturer: '示例厂商',
    vaccineDoseNumber: 3, vaccineTotalDoses: 3, recordedAt: vaccine.recordedAt, notes: '完成',
  })
  assert.equal(updated.vaccineDoseNumber, 3)
  await deleteHealthRecord(updated.id, baby.id)
  assert.equal((await listHealthHistory(baby.id, 'VACCINE')).length, 0)
})

test('tooth health rows and unique tooth rows commit, replace, and delete atomically', async () => {
  const first = await createHealthRecord({
    babyId: baby.id, type: 'TOOTH_ERUPTION', toothCodes: ['51', '61'],
    recordedAt: '2026-10-15T01:00:00.000Z', notes: null,
  })
  const db = await openBabyFeedDb()
  assert.deepEqual(
    (await db.getAll(STORE_NAMES.toothEruptions)).map(row => row.toothCode).sort(),
    ['51', '61'],
  )

  const beforeHealth = await db.getAll(STORE_NAMES.healthRecords)
  const beforeTeeth = await db.getAll(STORE_NAMES.toothEruptions)
  await assert.rejects(
    createHealthRecord({
      babyId: baby.id, type: 'TOOTH_ERUPTION', toothCodes: ['51'],
      recordedAt: '2026-10-16T01:00:00.000Z', notes: null,
    }),
    error => error instanceof LocalStoreError && /牙位已存在/.test(error.message),
  )
  assert.deepEqual(await db.getAll(STORE_NAMES.healthRecords), beforeHealth)
  assert.deepEqual(await db.getAll(STORE_NAMES.toothEruptions), beforeTeeth)

  await updateHealthRecord(first.id, baby.id, {
    babyId: baby.id, type: 'TOOTH_ERUPTION', toothCodes: ['52'],
    recordedAt: first.recordedAt, notes: '修正牙位',
  })
  assert.deepEqual((await db.getAll(STORE_NAMES.toothEruptions)).map(row => row.toothCode), ['52'])

  await deleteHealthRecord(first.id, baby.id)
  assert.equal(await db.count(STORE_NAMES.healthRecords), 0)
  assert.equal(await db.count(STORE_NAMES.toothEruptions), 0)
})
