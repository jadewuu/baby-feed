import { deleteDB, openDB, type IDBPDatabase, type IDBPTransaction } from 'idb'
import {
  BABY_FEED_DB_NAME,
  BABY_FEED_DB_VERSION,
  STORE_NAMES,
  type BabyFeedDb,
  type BabyFeedStoreName,
} from './schema.ts'

let databasePromise: Promise<IDBPDatabase<BabyFeedDb>> | undefined

function createVersion1Stores(db: IDBPDatabase<BabyFeedDb>) {
  if (!db.objectStoreNames.contains(STORE_NAMES.metadata)) {
    db.createObjectStore(STORE_NAMES.metadata, { keyPath: 'key' })
  }
  if (!db.objectStoreNames.contains(STORE_NAMES.babies)) {
    db.createObjectStore(STORE_NAMES.babies, { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains(STORE_NAMES.settings)) {
    db.createObjectStore(STORE_NAMES.settings, { keyPath: 'key' })
  }
}

function upgradeToVersion2(
  db: IDBPDatabase<BabyFeedDb>,
  transaction: IDBPTransaction<BabyFeedDb, BabyFeedStoreName[], 'versionchange'>,
) {
  const babies = transaction.objectStore(STORE_NAMES.babies)
  if (!babies.indexNames.contains('by-created-at')) {
    babies.createIndex('by-created-at', 'createdAt')
  }

  const feeding = db.objectStoreNames.contains(STORE_NAMES.feedingRecords)
    ? transaction.objectStore(STORE_NAMES.feedingRecords)
    : db.createObjectStore(STORE_NAMES.feedingRecords, { keyPath: 'id' })
  if (!feeding.indexNames.contains('by-baby-time')) {
    feeding.createIndex('by-baby-time', ['babyId', 'startTime'])
  }

  const health = db.objectStoreNames.contains(STORE_NAMES.healthRecords)
    ? transaction.objectStore(STORE_NAMES.healthRecords)
    : db.createObjectStore(STORE_NAMES.healthRecords, { keyPath: 'id' })
  if (!health.indexNames.contains('by-baby-time')) {
    health.createIndex('by-baby-time', ['babyId', 'recordedAt'])
  }
  if (!health.indexNames.contains('by-baby-type-time')) {
    health.createIndex('by-baby-type-time', ['babyId', 'type', 'recordedAt'])
  }

  const teeth = db.objectStoreNames.contains(STORE_NAMES.toothEruptions)
    ? transaction.objectStore(STORE_NAMES.toothEruptions)
    : db.createObjectStore(STORE_NAMES.toothEruptions, { keyPath: 'id' })
  if (!teeth.indexNames.contains('by-health-record')) {
    teeth.createIndex('by-health-record', 'healthRecordId')
  }
  if (!teeth.indexNames.contains('by-baby-tooth')) {
    teeth.createIndex('by-baby-tooth', ['babyId', 'toothCode'], { unique: true })
  }

  const memos = db.objectStoreNames.contains(STORE_NAMES.memos)
    ? transaction.objectStore(STORE_NAMES.memos)
    : db.createObjectStore(STORE_NAMES.memos, { keyPath: 'id' })
  if (!memos.indexNames.contains('by-baby-time')) {
    memos.createIndex('by-baby-time', ['babyId', 'scheduledAt'])
  }
  if (!memos.indexNames.contains('by-baby-status-time')) {
    memos.createIndex('by-baby-status-time', ['babyId', 'status', 'scheduledAt'])
  }
}

export function openBabyFeedDb(): Promise<IDBPDatabase<BabyFeedDb>> {
  databasePromise ??= openDB<BabyFeedDb>(BABY_FEED_DB_NAME, BABY_FEED_DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) createVersion1Stores(db)
      if (oldVersion < 2) upgradeToVersion2(db, transaction)
    },
    blocking() {
      void closeBabyFeedDb()
    },
  })
  return databasePromise
}

export async function closeBabyFeedDb(): Promise<void> {
  if (!databasePromise) return
  const db = await databasePromise
  db.close()
  databasePromise = undefined
}

export async function resetBabyFeedDbForTests(deleteDatabase = false): Promise<void> {
  await closeBabyFeedDb()
  if (deleteDatabase) await deleteDB(BABY_FEED_DB_NAME)
}
