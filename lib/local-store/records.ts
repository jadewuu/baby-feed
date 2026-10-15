import { FEEDING_TYPES, type FeedingType } from '../feeding-records.ts'
import { HEALTH_TYPES, type HealthType } from '../health-records.ts'
import type { PrimaryToothCode } from '../tooth-eruptions.ts'
import { openBabyFeedDb } from './db.ts'
import { LocalStoreError, toLocalStoreError } from './errors.ts'
import {
  STORE_NAMES,
  type FeedingRecordInput,
  type HealthRecordInput,
  type LocalFeedingRecord,
  type LocalHealthRecord,
  type LocalToothEruption,
} from './schema.ts'

interface TimeRange {
  start?: string
  end?: string
}

function assertIsoDate(value: string, label: string) {
  if (Number.isNaN(Date.parse(value))) {
    throw new LocalStoreError('validation', `${label}格式不正确`)
  }
}

function assertFeedingInput(input: FeedingRecordInput) {
  if (!FEEDING_TYPES.includes(input.type)) throw new LocalStoreError('validation', '喂养类型不正确')
  assertIsoDate(input.startTime, '记录时间')
}

function normalizeToothCodes(type: HealthType, toothCodes: PrimaryToothCode[] | undefined) {
  if (type !== 'TOOTH_ERUPTION') return []
  const codes = toothCodes ?? []
  if (codes.length === 0) throw new LocalStoreError('validation', '请至少选择一个牙位')
  if (new Set(codes).size !== codes.length) throw new LocalStoreError('validation', '牙位不能重复')
  return codes
}

function assertHealthInput(input: HealthRecordInput) {
  if (!HEALTH_TYPES.includes(input.type)) throw new LocalStoreError('validation', '健康类型不正确')
  assertIsoDate(input.recordedAt, '记录时间')
  if (input.type === 'SLEEP') {
    if (input.sleepStartTime) assertIsoDate(input.sleepStartTime, '入睡时间')
    if (input.sleepEndTime) assertIsoDate(input.sleepEndTime, '醒来时间')
  }
}

function feedingRange(babyId: string, range: TimeRange) {
  return IDBKeyRange.bound(
    [babyId, range.start ?? ''],
    [babyId, range.end ?? '\uffff'],
  )
}

function healthRange(babyId: string, type: HealthType) {
  return IDBKeyRange.bound([babyId, type, ''], [babyId, type, '\uffff'])
}

export async function listFeedingRecords(
  babyId: string,
  range: TimeRange = {},
): Promise<LocalFeedingRecord[]> {
  const db = await openBabyFeedDb()
  return db.getAllFromIndex(STORE_NAMES.feedingRecords, 'by-baby-time', feedingRange(babyId, range))
}

export async function createFeedingRecord(input: FeedingRecordInput): Promise<LocalFeedingRecord> {
  assertFeedingInput(input)
  const now = new Date().toISOString()
  const record: LocalFeedingRecord = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
  try {
    const db = await openBabyFeedDb()
    const transaction = db.transaction([STORE_NAMES.babies, STORE_NAMES.feedingRecords], 'readwrite')
    if (!(await transaction.objectStore(STORE_NAMES.babies).get(input.babyId))) {
      transaction.abort()
      throw new LocalStoreError('validation', '宝宝不存在')
    }
    await transaction.objectStore(STORE_NAMES.feedingRecords).add(record)
    await transaction.done
    return record
  } catch (error) {
    throw toLocalStoreError(error, '喂养记录保存失败，请重试')
  }
}

export async function updateFeedingRecord(
  id: string,
  babyId: string,
  input: FeedingRecordInput,
): Promise<LocalFeedingRecord> {
  assertFeedingInput(input)
  if (input.babyId !== babyId) throw new LocalStoreError('validation', '宝宝信息不一致')
  try {
    const db = await openBabyFeedDb()
    const existing = await db.get(STORE_NAMES.feedingRecords, id)
    if (!existing || existing.babyId !== babyId) throw new LocalStoreError('validation', '记录不存在')
    const updated = { ...existing, ...input, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }
    await db.put(STORE_NAMES.feedingRecords, updated)
    return updated
  } catch (error) {
    throw toLocalStoreError(error, '喂养记录更新失败，请重试')
  }
}

export async function deleteFeedingRecord(id: string, babyId: string): Promise<void> {
  try {
    const db = await openBabyFeedDb()
    const existing = await db.get(STORE_NAMES.feedingRecords, id)
    if (!existing || existing.babyId !== babyId) throw new LocalStoreError('validation', '记录不存在')
    await db.delete(STORE_NAMES.feedingRecords, id)
  } catch (error) {
    throw toLocalStoreError(error, '喂养记录删除失败，请重试')
  }
}

export async function listHealthHistory(
  babyId: string,
  type: HealthType,
): Promise<LocalHealthRecord[]> {
  const db = await openBabyFeedDb()
  const records = await db.getAllFromIndex(STORE_NAMES.healthRecords, 'by-baby-type-time', healthRange(babyId, type))
  return records.reverse()
}

async function assertTeethAvailable(
  index: { get(query: [string, PrimaryToothCode]): Promise<LocalToothEruption | undefined> },
  babyId: string,
  codes: PrimaryToothCode[],
  excludingHealthRecordId?: string,
) {
  for (const code of codes) {
    const existing = await index.get([babyId, code]) as LocalToothEruption | undefined
    if (existing && existing.healthRecordId !== excludingHealthRecordId) {
      throw new LocalStoreError('constraint', `牙位已存在记录：${code}`)
    }
  }
}

export async function createHealthRecord(input: HealthRecordInput): Promise<LocalHealthRecord> {
  assertHealthInput(input)
  const toothCodes = normalizeToothCodes(input.type, input.toothCodes)
  const { toothCodes: _ignored, ...storedInput } = input
  const now = new Date().toISOString()
  const record: LocalHealthRecord = {
    ...storedInput,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
  try {
    const db = await openBabyFeedDb()
    const transaction = db.transaction(
      [STORE_NAMES.babies, STORE_NAMES.healthRecords, STORE_NAMES.toothEruptions],
      'readwrite',
    )
    if (!(await transaction.objectStore(STORE_NAMES.babies).get(input.babyId))) {
      transaction.abort()
      throw new LocalStoreError('validation', '宝宝不存在')
    }
    const toothStore = transaction.objectStore(STORE_NAMES.toothEruptions)
    await assertTeethAvailable(toothStore.index('by-baby-tooth'), input.babyId, toothCodes)
    await transaction.objectStore(STORE_NAMES.healthRecords).add(record)
    for (const toothCode of toothCodes) {
      await toothStore.add({
        id: crypto.randomUUID(),
        healthRecordId: record.id,
        babyId: record.babyId,
        toothCode,
        createdAt: now,
        updatedAt: now,
      })
    }
    await transaction.done
    return record
  } catch (error) {
    throw toLocalStoreError(error, '健康记录保存失败，请重试')
  }
}

export async function updateHealthRecord(
  id: string,
  babyId: string,
  input: HealthRecordInput,
): Promise<LocalHealthRecord> {
  assertHealthInput(input)
  if (input.babyId !== babyId) throw new LocalStoreError('validation', '宝宝信息不一致')
  const toothCodes = normalizeToothCodes(input.type, input.toothCodes)
  const { toothCodes: _ignored, ...storedInput } = input
  try {
    const db = await openBabyFeedDb()
    const transaction = db.transaction([STORE_NAMES.healthRecords, STORE_NAMES.toothEruptions], 'readwrite')
    const healthStore = transaction.objectStore(STORE_NAMES.healthRecords)
    const existing = await healthStore.get(id)
    if (!existing || existing.babyId !== babyId) {
      transaction.abort()
      throw new LocalStoreError('validation', '记录不存在')
    }
    const toothStore = transaction.objectStore(STORE_NAMES.toothEruptions)
    await assertTeethAvailable(toothStore.index('by-baby-tooth'), babyId, toothCodes, id)
    const existingToothKeys = await toothStore.index('by-health-record').getAllKeys(id)
    for (const key of existingToothKeys) await toothStore.delete(key)

    const now = new Date().toISOString()
    const updated: LocalHealthRecord = {
      ...existing,
      ...storedInput,
      id,
      createdAt: existing.createdAt,
      updatedAt: now,
    }
    await healthStore.put(updated)
    for (const toothCode of toothCodes) {
      await toothStore.add({
        id: crypto.randomUUID(), healthRecordId: id, babyId, toothCode,
        createdAt: now, updatedAt: now,
      })
    }
    await transaction.done
    return updated
  } catch (error) {
    throw toLocalStoreError(error, '健康记录更新失败，请重试')
  }
}

export async function deleteHealthRecord(id: string, babyId: string): Promise<void> {
  try {
    const db = await openBabyFeedDb()
    const transaction = db.transaction([STORE_NAMES.healthRecords, STORE_NAMES.toothEruptions], 'readwrite')
    const healthStore = transaction.objectStore(STORE_NAMES.healthRecords)
    const existing = await healthStore.get(id)
    if (!existing || existing.babyId !== babyId) {
      transaction.abort()
      throw new LocalStoreError('validation', '记录不存在')
    }
    const toothStore = transaction.objectStore(STORE_NAMES.toothEruptions)
    for (const key of await toothStore.index('by-health-record').getAllKeys(id)) await toothStore.delete(key)
    await healthStore.delete(id)
    await transaction.done
  } catch (error) {
    throw toLocalStoreError(error, '健康记录删除失败，请重试')
  }
}
