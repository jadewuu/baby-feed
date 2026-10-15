import { DEFAULT_QUICK_RECORD_KEYS, normalizeQuickRecordKeys, type QuickRecordKey } from '../quick-records.ts'
import { openBabyFeedDb } from './db.ts'
import { STORE_NAMES, type LocalSettings, type PersistedSettings } from './schema.ts'

const SETTINGS_KEY = 'app' as const

function defaultSettings(): PersistedSettings {
  return {
    key: SETTINGS_KEY,
    activeBabyId: null,
    quickRecordKeys: [...DEFAULT_QUICK_RECORD_KEYS],
  }
}

export async function getPersistedSettings(): Promise<PersistedSettings> {
  const db = await openBabyFeedDb()
  const stored = await db.get(STORE_NAMES.settings, SETTINGS_KEY)
  if (stored) {
    return {
      ...stored,
      quickRecordKeys: normalizeQuickRecordKeys(stored.quickRecordKeys),
    }
  }
  const initial = defaultSettings()
  await db.put(STORE_NAMES.settings, initial)
  return initial
}

export async function getSettings(): Promise<LocalSettings> {
  const { activeBabyId, quickRecordKeys } = await getPersistedSettings()
  return { activeBabyId, quickRecordKeys }
}

export async function setActiveBabyId(id: string | null): Promise<void> {
  const db = await openBabyFeedDb()
  if (id !== null && !(await db.get(STORE_NAMES.babies, id))) {
    throw new Error('宝宝不存在')
  }
  const settings = await getPersistedSettings()
  await db.put(STORE_NAMES.settings, { ...settings, activeBabyId: id })
}

export async function setQuickRecordKeys(keys: QuickRecordKey[]): Promise<void> {
  const db = await openBabyFeedDb()
  const settings = await getPersistedSettings()
  await db.put(STORE_NAMES.settings, {
    ...settings,
    quickRecordKeys: normalizeQuickRecordKeys(keys),
  })
}
