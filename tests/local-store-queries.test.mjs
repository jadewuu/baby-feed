import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'

import 'fake-indexeddb/auto'

import { createBaby } from '../lib/local-store/babies.ts'
import { resetBabyFeedDbForTests } from '../lib/local-store/db.ts'
import { createMemo } from '../lib/local-store/memos.ts'
import {
  getDashboardSnapshot,
  getStatsSnapshot,
  getTimelineDay,
  listTimelineDates,
} from '../lib/local-store/queries.ts'
import { createFeedingRecord, createHealthRecord } from '../lib/local-store/records.ts'
import { setQuickRecordKeys } from '../lib/local-store/settings.ts'

let baby
let otherBaby

beforeEach(async () => {
  await resetBabyFeedDbForTests(true)
  baby = await createBaby({ name: '小满', birthDate: '2026-04-08', gender: 'FEMALE' })
  otherBaby = await createBaby({ name: '小禾', birthDate: '2025-05-01', gender: 'MALE' })
  await setQuickRecordKeys(['FORMULA', 'GROUP_MEMO'])
})

afterEach(async () => {
  await resetBabyFeedDbForTests(true)
})

async function seedRepresentativeData() {
  await createFeedingRecord({
    babyId: baby.id, type: 'BREAST_MILK', leftBreastDuration: 300, rightBreastDuration: 180,
    startTime: '2026-10-14T14:00:00.000Z', notes: null,
  })
  await createFeedingRecord({
    babyId: baby.id, type: 'FORMULA', formulaAmount: 120,
    startTime: '2026-10-14T18:00:00.000Z', notes: null,
  })
  await createFeedingRecord({
    babyId: baby.id, type: 'BREAST_MILK_BOTTLE', breastMilkAmount: 90,
    startTime: '2026-10-15T02:00:00.000Z', notes: null,
  })
  await createFeedingRecord({
    babyId: otherBaby.id, type: 'FORMULA', formulaAmount: 999,
    startTime: '2026-10-15T03:00:00.000Z', notes: null,
  })

  await createHealthRecord({
    babyId: baby.id, type: 'SLEEP',
    sleepStartTime: '2026-10-14T15:30:00.000Z', sleepEndTime: '2026-10-14T16:30:00.000Z',
    recordedAt: '2026-10-14T16:30:00.000Z', sleepQuality: '安稳', notes: null,
  })
  await createHealthRecord({
    babyId: baby.id, type: 'DIAPER', diaperType: 'BOTH',
    recordedAt: '2026-10-15T01:00:00.000Z', notes: null,
  })
  await createHealthRecord({
    babyId: baby.id, type: 'AD_VITAMIN', adGiven: true, vitaminDGiven: true,
    recordedAt: '2026-10-15T01:10:00.000Z', notes: null,
  })
  await createHealthRecord({
    babyId: baby.id, type: 'WEIGHT', weight: 8.1,
    recordedAt: '2026-10-14T01:00:00.000Z', notes: null,
  })
  await createHealthRecord({
    babyId: baby.id, type: 'WEIGHT', weight: 8.2,
    recordedAt: '2026-10-15T01:20:00.000Z', notes: null,
  })
  await createHealthRecord({
    babyId: baby.id, type: 'HEIGHT', height: 70.5,
    recordedAt: '2026-10-15T01:30:00.000Z', notes: null,
  })
  await createHealthRecord({
    babyId: baby.id, type: 'TEMPERATURE', temperature: 37.1,
    recordedAt: '2026-10-15T01:40:00.000Z', notes: null,
  })
  await createHealthRecord({
    babyId: baby.id, type: 'VACCINE', vaccineName: '乙肝', vaccineManufacturer: '示例厂商',
    vaccineDoseNumber: 2, vaccineTotalDoses: 3,
    recordedAt: '2026-10-15T02:30:00.000Z', notes: '第二针',
  })
  await createHealthRecord({
    babyId: baby.id, type: 'MEDICATION', medicationName: '维生素', medicationDose: '1ml',
    recordedAt: '2026-10-15T03:00:00.000Z', notes: null,
  })
  await createHealthRecord({
    babyId: baby.id, type: 'TOOTH_ERUPTION', toothCodes: ['51'],
    recordedAt: '2026-10-15T03:30:00.000Z', notes: null,
  })

  await createMemo({
    babyId: baby.id, title: '复诊', content: '带记录',
    scheduledAt: '2026-10-16T04:00:00.000Z',
  })
  await createMemo({
    babyId: baby.id, title: '太远', content: null,
    scheduledAt: '2026-10-25T04:00:00.000Z',
  })
}

test('dashboard returns today records, latest measurements, quick settings, and nearby memos', async () => {
  await seedRepresentativeData()

  const snapshot = await getDashboardSnapshot(baby.id, new Date('2026-10-15T04:00:00.000Z'))

  assert.deepEqual(snapshot.quickRecordKeys, ['FORMULA', 'GROUP_MEMO'])
  assert.deepEqual(snapshot.todayFeedingRecords.map(record => record.type), ['BREAST_MILK_BOTTLE', 'FORMULA'])
  assert.equal(snapshot.todayHealthRecords.find(record => record.type === 'WEIGHT')?.weight, 8.2)
  assert.equal(snapshot.todayHealthRecords.find(record => record.type === 'HEIGHT')?.height, 70.5)
  assert.deepEqual(snapshot.recentMemos.map(memo => memo.title), ['复诊'])
  assert.ok(snapshot.todayFeedingRecords.every(record => record.recordType === 'feeding'))
  assert.ok(snapshot.todayHealthRecords.every(record => record.recordType === 'health'))
})

test('timeline isolates babies, sorts records, and exposes cross-midnight sleep on both dates', async () => {
  await seedRepresentativeData()

  const firstDay = await getTimelineDay(baby.id, '2026-10-14')
  const secondDay = await getTimelineDay(baby.id, '2026-10-15')

  assert.equal(firstDay[0].recordType, 'health')
  assert.equal(firstDay[0].type, 'SLEEP')
  assert.equal(secondDay[0].recordType, 'health')
  assert.equal(secondDay[0].type, 'TOOTH_ERUPTION')
  assert.equal(secondDay.some(record => record.type === 'SLEEP'), true)
  assert.equal(secondDay.some(record => record.recordType === 'feeding' && record.breastMilkAmount === 90), true)
  assert.equal(secondDay.some(record => record.babyId === otherBaby.id), false)
  assert.deepEqual(await listTimelineDates(baby.id), ['2026-10-15', '2026-10-14'])

  const tooth = secondDay.find(record => record.type === 'TOOTH_ERUPTION')
  assert.deepEqual(tooth.toothEruptions, [{ toothCode: '51' }])
})

test('statistics aggregate range totals, trends, history, heatmap, and split sleep by Beijing day', async () => {
  await seedRepresentativeData()

  const stats = await getStatsSnapshot(baby.id, {
    kind: 'custom', startDate: '2026-10-14', endDate: '2026-10-15',
  })
  assert.ok(stats)
  assert.deepEqual(stats.lastDays.map(day => day.date), ['2026-10-14', '2026-10-15'])
  assert.equal(stats.lastDays[0].sleepDurationMinutes, 30)
  assert.equal(stats.lastDays[1].sleepDurationMinutes, 30)
  assert.equal(stats.lastDays[0].sleepCount, 1)
  assert.equal(stats.lastDays[1].sleepCount, 1)
  assert.equal(stats.totalStats.totalFeedings, 3)
  assert.equal(stats.totalStats.totalFormulaAmount, 120)
  assert.equal(stats.totalStats.totalBreastDuration, 480)
  assert.equal(stats.totalStats.totalBreastMilkAmount, 90)
  assert.deepEqual(stats.feedingIntervals, [240, 480])
  assert.deepEqual(stats.feedingHeatmap, [
    { date: '2026-10-14', hour: 22, count: 1 },
    { date: '2026-10-15', hour: 2, count: 1 },
    { date: '2026-10-15', hour: 10, count: 1 },
  ])
  assert.deepEqual(stats.weightTrend.map(item => item.weight), [8.1, 8.2])
  assert.equal(stats.heightTrend[0].height, 70.5)
  assert.equal(stats.vaccineRecords[0].vaccineDoseNumber, 2)
  assert.equal(stats.medicationRecords[0].medicationName, '维生素')
  assert.deepEqual(stats.toothEruptionRecords[0].toothEruptions, [{ toothCode: '51' }])
  assert.deepEqual(stats.memoRecords.map(memo => memo.title), ['复诊', '太远'])
  assert.equal(stats.lastDays[1].peeCount, 1)
  assert.equal(stats.lastDays[1].poopCount, 1)
  assert.equal(stats.lastDays[1].adGiven, true)
  assert.equal(stats.lastDays[1].vitaminDGiven, true)
  assert.equal(stats.babyBirthDate, '2026-04-08')
  assert.equal(stats.babyGender, 'FEMALE')
})

test('preset statistics can end on a deterministic date', async () => {
  await seedRepresentativeData()
  const stats = await getStatsSnapshot(baby.id, { kind: 'preset', days: 2, endDate: '2026-10-15' })
  assert.deepEqual(stats?.lastDays.map(day => day.date), ['2026-10-14', '2026-10-15'])
  assert.equal(await getStatsSnapshot('missing', { kind: 'preset', days: 7, endDate: '2026-10-15' }), null)
})
