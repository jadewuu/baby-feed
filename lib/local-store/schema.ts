import type { FeedingType } from '../feeding-records.ts'
import type { HealthType } from '../health-records.ts'
import type { QuickRecordKey } from '../quick-records.ts'
import type { PrimaryToothCode } from '../tooth-eruptions.ts'
import type { DBSchema } from 'idb'

export const BABY_FEED_DB_NAME = 'baby-feed-offline'
export const BABY_FEED_DB_VERSION = 2

export const STORE_NAMES = {
  metadata: 'metadata',
  babies: 'babies',
  feedingRecords: 'feedingRecords',
  healthRecords: 'healthRecords',
  toothEruptions: 'toothEruptions',
  memos: 'memos',
  settings: 'settings',
} as const

export type BabyFeedStoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES]

export interface LocalBaby {
  id: string
  name: string
  birthDate: string
  gender: 'MALE' | 'FEMALE'
  createdAt: string
  updatedAt: string
}

export interface BabyInput {
  name: string
  birthDate: string
  gender: 'MALE' | 'FEMALE'
}

export interface LocalSettings {
  activeBabyId: string | null
  quickRecordKeys: QuickRecordKey[]
}

export interface PersistedSettings extends LocalSettings {
  key: 'app'
}

export interface LocalFeedingRecord {
  id: string
  babyId: string
  type: FeedingType
  leftBreastDuration?: number | null
  rightBreastDuration?: number | null
  breastMilkAmount?: number | null
  formulaAmount?: number | null
  solidFoodName?: string | null
  solidFoodAmount?: string | null
  adGiven?: boolean | null
  startTime: string
  endTime?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface LocalHealthRecord {
  id: string
  babyId: string
  type: HealthType
  weight?: number | null
  height?: number | null
  temperature?: number | null
  medicationName?: string | null
  medicationDose?: string | null
  vaccineName?: string | null
  vaccineManufacturer?: string | null
  vaccineDoseNumber?: number | null
  vaccineTotalDoses?: number | null
  diaperType?: 'PEE' | 'POOP' | 'BOTH' | null
  diaperStatus?: string | null
  adGiven?: boolean | null
  vitaminDGiven?: boolean | null
  customName?: string | null
  sleepStartTime?: string | null
  sleepEndTime?: string | null
  sleepQuality?: string | null
  recordedAt: string
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface LocalToothEruption {
  id: string
  healthRecordId: string
  babyId: string
  toothCode: PrimaryToothCode
  createdAt: string
  updatedAt: string
}

export interface LocalMemo {
  id: string
  babyId: string
  title: string
  content: string | null
  scheduledAt: string
  completed: boolean
  status: 'pending' | 'completed'
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LocalMetadata {
  key: string
  value: unknown
}

export interface BabyFeedDb extends DBSchema {
  metadata: {
    key: string
    value: LocalMetadata
  }
  babies: {
    key: string
    value: LocalBaby
    indexes: { 'by-created-at': string }
  }
  feedingRecords: {
    key: string
    value: LocalFeedingRecord
    indexes: { 'by-baby-time': [string, string] }
  }
  healthRecords: {
    key: string
    value: LocalHealthRecord
    indexes: {
      'by-baby-time': [string, string]
      'by-baby-type-time': [string, HealthType, string]
    }
  }
  toothEruptions: {
    key: string
    value: LocalToothEruption
    indexes: {
      'by-health-record': string
      'by-baby-tooth': [string, PrimaryToothCode]
    }
  }
  memos: {
    key: string
    value: LocalMemo
    indexes: {
      'by-baby-time': [string, string]
      'by-baby-status-time': [string, 'pending' | 'completed', string]
    }
  }
  settings: {
    key: 'app'
    value: PersistedSettings
  }
}
