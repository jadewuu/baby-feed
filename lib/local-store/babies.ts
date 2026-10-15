import { DEFAULT_QUICK_RECORD_KEYS } from '../quick-records.ts'
import { openBabyFeedDb } from './db.ts'
import { STORE_NAMES, type BabyInput, type LocalBaby, type PersistedSettings } from './schema.ts'

function normalizeInput(input: BabyInput): BabyInput {
  const name = input.name.trim()
  if (!name) throw new Error('请输入宝宝姓名')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) throw new Error('出生日期格式不正确')
  if (input.gender !== 'MALE' && input.gender !== 'FEMALE') throw new Error('性别格式不正确')
  return { ...input, name }
}

function sortBabies(babies: LocalBaby[]): LocalBaby[] {
  return babies.sort((left, right) => (
    left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
  ))
}

function initialSettings(activeBabyId: string): PersistedSettings {
  return {
    key: 'app',
    activeBabyId,
    quickRecordKeys: [...DEFAULT_QUICK_RECORD_KEYS],
  }
}

export async function listBabies(): Promise<LocalBaby[]> {
  const db = await openBabyFeedDb()
  return sortBabies(await db.getAll(STORE_NAMES.babies))
}

export async function createBaby(input: BabyInput): Promise<LocalBaby> {
  const normalized = normalizeInput(input)
  const now = new Date().toISOString()
  const baby: LocalBaby = {
    id: crypto.randomUUID(),
    ...normalized,
    createdAt: now,
    updatedAt: now,
  }
  const db = await openBabyFeedDb()
  const transaction = db.transaction([STORE_NAMES.babies, STORE_NAMES.settings], 'readwrite')
  await transaction.objectStore(STORE_NAMES.babies).add(baby)
  const settingsStore = transaction.objectStore(STORE_NAMES.settings)
  const settings = await settingsStore.get('app')
  if (!settings?.activeBabyId) {
    await settingsStore.put(settings ? { ...settings, activeBabyId: baby.id } : initialSettings(baby.id))
  }
  await transaction.done
  return baby
}

export async function updateBaby(id: string, input: BabyInput): Promise<LocalBaby> {
  const normalized = normalizeInput(input)
  const db = await openBabyFeedDb()
  const existing = await db.get(STORE_NAMES.babies, id)
  if (!existing) throw new Error('宝宝不存在')
  const updated: LocalBaby = {
    ...existing,
    ...normalized,
    updatedAt: new Date().toISOString(),
  }
  await db.put(STORE_NAMES.babies, updated)
  return updated
}

export async function deleteBaby(id: string): Promise<void> {
  const db = await openBabyFeedDb()
  const stores = [
    STORE_NAMES.babies,
    STORE_NAMES.feedingRecords,
    STORE_NAMES.healthRecords,
    STORE_NAMES.toothEruptions,
    STORE_NAMES.memos,
    STORE_NAMES.settings,
  ] as const
  const transaction = db.transaction(stores, 'readwrite')
  const babyStore = transaction.objectStore(STORE_NAMES.babies)
  if (!(await babyStore.get(id))) throw new Error('宝宝不存在')

  await babyStore.delete(id)
  const range = IDBKeyRange.bound([id, ''], [id, '\uffff'])
  const feedingStore = transaction.objectStore(STORE_NAMES.feedingRecords)
  const healthStore = transaction.objectStore(STORE_NAMES.healthRecords)
  const toothStore = transaction.objectStore(STORE_NAMES.toothEruptions)
  const memoStore = transaction.objectStore(STORE_NAMES.memos)
  for (const key of await feedingStore.index('by-baby-time').getAllKeys(range)) await feedingStore.delete(key)
  for (const key of await healthStore.index('by-baby-time').getAllKeys(range)) await healthStore.delete(key)
  for (const key of await toothStore.index('by-baby-tooth').getAllKeys(range)) await toothStore.delete(key)
  for (const key of await memoStore.index('by-baby-time').getAllKeys(range)) await memoStore.delete(key)

  const settingsStore = transaction.objectStore(STORE_NAMES.settings)
  const settings = await settingsStore.get('app')
  if (settings?.activeBabyId === id) {
    const remaining = sortBabies(await babyStore.getAll())
    await settingsStore.put({ ...settings, activeBabyId: remaining[0]?.id ?? null })
  }
  await transaction.done
}
