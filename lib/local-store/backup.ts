import { FEEDING_TYPES } from '../feeding-records.ts'
import { HEALTH_TYPES } from '../health-records.ts'
import { DEFAULT_QUICK_RECORD_KEYS, validateQuickRecordKeys } from '../quick-records.ts'
import { isPrimaryToothCode } from '../tooth-eruptions.ts'
import { openBabyFeedDb } from './db.ts'
import { LocalStoreError, toLocalStoreError } from './errors.ts'
import {
  STORE_NAMES,
  type LocalBaby,
  type LocalFeedingRecord,
  type LocalHealthRecord,
  type LocalMemo,
  type LocalMetadata,
  type LocalSettings,
  type LocalToothEruption,
  type PersistedSettings,
} from './schema.ts'

export const BACKUP_SCHEMA_VERSION = 1

export interface BackupData {
  metadata: LocalMetadata[]
  babies: LocalBaby[]
  feedingRecords: LocalFeedingRecord[]
  healthRecords: LocalHealthRecord[]
  toothEruptions: LocalToothEruption[]
  memos: LocalMemo[]
  settings: LocalSettings
}

export interface BabyFeedBackup {
  format: 'baby-feed-backup'
  schemaVersion: number
  exportedAt: string
  data: BackupData
}

export type ValidatedBackup = BabyFeedBackup

export interface RestoreSummary {
  babies: number
  feedingRecords: number
  healthRecords: number
  toothEruptions: number
  memos: number
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) throw new LocalStoreError('validation', `${label}格式不正确`)
  return value
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new LocalStoreError('validation', `${label}格式不正确`)
  return value
}

function requireDate(value: unknown, label: string): string {
  const date = requireString(value, label)
  if (Number.isNaN(Date.parse(date))) throw new LocalStoreError('validation', `${label}格式不正确`)
  return date
}

function requireArray(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new LocalStoreError('validation', `${label}格式不正确`)
  return value.map((item, index) => requireObject(item, `${label}[${index}]`))
}

function ensureUniqueIds(rows: Record<string, unknown>[], label: string) {
  const ids = new Set<string>()
  for (const row of rows) {
    const id = requireString(row.id, `${label} ID`)
    if (ids.has(id)) throw new LocalStoreError('validation', `${label}包含重复 ID`)
    ids.add(id)
  }
  return ids
}

function validateEntityTimestamps(row: Record<string, unknown>, label: string) {
  requireDate(row.createdAt, `${label}创建时间`)
  requireDate(row.updatedAt, `${label}更新时间`)
}

function validateOptionalDate(value: unknown, label: string) {
  if (value !== null && value !== undefined) requireDate(value, label)
}

export function validateBackup(value: unknown): ValidatedBackup {
  const backup = requireObject(value, '备份文件')
  if (backup.format !== 'baby-feed-backup') throw new LocalStoreError('validation', '不是 Baby Feed 备份文件')
  if (backup.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new LocalStoreError('validation', '备份版本不受支持')
  }
  requireDate(backup.exportedAt, '导出时间')
  const data = requireObject(backup.data, '备份数据')
  const metadata = requireArray(data.metadata, '元数据')
  const babies = requireArray(data.babies, '宝宝数据')
  const feeding = requireArray(data.feedingRecords, '喂养记录')
  const health = requireArray(data.healthRecords, '健康记录')
  const teeth = requireArray(data.toothEruptions, '牙齿记录')
  const memos = requireArray(data.memos, '备忘记录')
  const settings = requireObject(data.settings, '设置')

  ensureUniqueIds(metadata.map(row => ({ ...row, id: row.key })), '元数据')
  const babyIds = ensureUniqueIds(babies, '宝宝数据')
  const feedingIds = ensureUniqueIds(feeding, '喂养记录')
  const healthIds = ensureUniqueIds(health, '健康记录')
  ensureUniqueIds(teeth, '牙齿记录')
  ensureUniqueIds(memos, '备忘记录')
  void feedingIds

  for (const baby of babies) {
    requireString(baby.name, '宝宝姓名')
    requireDate(baby.birthDate, '宝宝出生日期')
    if (baby.gender !== 'MALE' && baby.gender !== 'FEMALE') throw new LocalStoreError('validation', '宝宝性别格式不正确')
    validateEntityTimestamps(baby, '宝宝')
  }
  for (const record of feeding) {
    if (!babyIds.has(requireString(record.babyId, '喂养记录宝宝 ID'))) throw new LocalStoreError('validation', '喂养记录引用了不存在的宝宝')
    if (!FEEDING_TYPES.includes(record.type as never)) throw new LocalStoreError('validation', '喂养记录类型不正确')
    requireDate(record.startTime, '喂养记录时间')
    validateOptionalDate(record.endTime, '喂养结束时间')
    validateEntityTimestamps(record, '喂养记录')
  }
  const healthById = new Map<string, Record<string, unknown>>()
  for (const record of health) {
    if (!babyIds.has(requireString(record.babyId, '健康记录宝宝 ID'))) throw new LocalStoreError('validation', '健康记录引用了不存在的宝宝')
    if (!HEALTH_TYPES.includes(record.type as never)) throw new LocalStoreError('validation', '健康记录类型不正确')
    requireDate(record.recordedAt, '健康记录时间')
    validateOptionalDate(record.sleepStartTime, '入睡时间')
    validateOptionalDate(record.sleepEndTime, '醒来时间')
    validateEntityTimestamps(record, '健康记录')
    healthById.set(record.id as string, record)
  }
  const toothKeys = new Set<string>()
  for (const tooth of teeth) {
    const babyId = requireString(tooth.babyId, '牙齿记录宝宝 ID')
    if (!babyIds.has(babyId)) throw new LocalStoreError('validation', '牙齿记录引用了不存在的宝宝')
    const code = requireString(tooth.toothCode, '牙位')
    if (!isPrimaryToothCode(code)) throw new LocalStoreError('validation', '牙位格式不正确')
    const key = `${babyId}|${code}`
    if (toothKeys.has(key)) throw new LocalStoreError('validation', '同一宝宝包含重复牙位')
    toothKeys.add(key)
    const healthRecord = healthById.get(requireString(tooth.healthRecordId, '牙齿健康记录 ID'))
    if (!healthRecord || healthRecord.type !== 'TOOTH_ERUPTION') {
      throw new LocalStoreError('validation', '牙齿记录未关联长牙健康记录')
    }
    if (healthRecord.babyId !== babyId) throw new LocalStoreError('validation', '牙齿记录与健康记录宝宝不一致')
    validateEntityTimestamps(tooth, '牙齿记录')
  }
  for (const memo of memos) {
    if (!babyIds.has(requireString(memo.babyId, '备忘宝宝 ID'))) throw new LocalStoreError('validation', '备忘引用了不存在的宝宝')
    requireString(memo.title, '备忘标题')
    requireDate(memo.scheduledAt, '备忘时间')
    if (typeof memo.completed !== 'boolean') throw new LocalStoreError('validation', '备忘完成状态不正确')
    if (memo.status !== (memo.completed ? 'completed' : 'pending')) throw new LocalStoreError('validation', '备忘索引状态不一致')
    validateOptionalDate(memo.completedAt, '备忘完成时间')
    validateEntityTimestamps(memo, '备忘')
  }

  const activeBabyId = settings.activeBabyId
  if (activeBabyId !== null && (typeof activeBabyId !== 'string' || !babyIds.has(activeBabyId))) {
    throw new LocalStoreError('validation', '当前宝宝不存在')
  }
  const quickRecordError = validateQuickRecordKeys(settings.quickRecordKeys)
  if (quickRecordError) throw new LocalStoreError('validation', quickRecordError)

  return structuredClone(value) as ValidatedBackup
}

export async function exportBackup(): Promise<BabyFeedBackup> {
  const db = await openBabyFeedDb()
  const [metadata, babies, feedingRecords, healthRecords, toothEruptions, memos, persistedSettings] = await Promise.all([
    db.getAll(STORE_NAMES.metadata),
    db.getAll(STORE_NAMES.babies),
    db.getAll(STORE_NAMES.feedingRecords),
    db.getAll(STORE_NAMES.healthRecords),
    db.getAll(STORE_NAMES.toothEruptions),
    db.getAll(STORE_NAMES.memos),
    db.get(STORE_NAMES.settings, 'app'),
  ])
  const settings: LocalSettings = persistedSettings
    ? { activeBabyId: persistedSettings.activeBabyId, quickRecordKeys: persistedSettings.quickRecordKeys }
    : { activeBabyId: null, quickRecordKeys: [...DEFAULT_QUICK_RECORD_KEYS] }
  return {
    format: 'baby-feed-backup',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { metadata, babies, feedingRecords, healthRecords, toothEruptions, memos, settings },
  }
}

export async function restoreBackup(input: ValidatedBackup | unknown): Promise<RestoreSummary> {
  const backup = validateBackup(input)
  const db = await openBabyFeedDb()
  const storeNames = Object.values(STORE_NAMES)
  const transaction = db.transaction(storeNames, 'readwrite')
  try {
    for (const storeName of storeNames) await transaction.objectStore(storeName).clear()
    for (const row of backup.data.metadata) await transaction.objectStore(STORE_NAMES.metadata).put(row)
    for (const row of backup.data.babies) await transaction.objectStore(STORE_NAMES.babies).put(row)
    for (const row of backup.data.feedingRecords) await transaction.objectStore(STORE_NAMES.feedingRecords).put(row)
    for (const row of backup.data.healthRecords) await transaction.objectStore(STORE_NAMES.healthRecords).put(row)
    for (const row of backup.data.toothEruptions) await transaction.objectStore(STORE_NAMES.toothEruptions).put(row)
    for (const row of backup.data.memos) await transaction.objectStore(STORE_NAMES.memos).put(row)
    const settings: PersistedSettings = { key: 'app', ...backup.data.settings }
    await transaction.objectStore(STORE_NAMES.settings).put(settings)
    await transaction.done
  } catch (error) {
    try {
      transaction.abort()
    } catch {
      // The browser may already have aborted the failed transaction.
    }
    await transaction.done.catch(() => undefined)
    throw toLocalStoreError(error, '备份恢复失败，现有数据未更改')
  }
  return {
    babies: backup.data.babies.length,
    feedingRecords: backup.data.feedingRecords.length,
    healthRecords: backup.data.healthRecords.length,
    toothEruptions: backup.data.toothEruptions.length,
    memos: backup.data.memos.length,
  }
}

export async function clearAllData(): Promise<void> {
  const db = await openBabyFeedDb()
  const storeNames = Object.values(STORE_NAMES)
  const transaction = db.transaction(storeNames, 'readwrite')
  try {
    for (const storeName of storeNames) await transaction.objectStore(storeName).clear()
    await transaction.objectStore(STORE_NAMES.settings).put({
      key: 'app',
      activeBabyId: null,
      quickRecordKeys: [...DEFAULT_QUICK_RECORD_KEYS],
    })
    await transaction.done
  } catch (error) {
    try {
      transaction.abort()
    } catch {
      // The browser may already have aborted the failed transaction.
    }
    await transaction.done.catch(() => undefined)
    throw toLocalStoreError(error, '本地数据清除失败，请重试')
  }
}
