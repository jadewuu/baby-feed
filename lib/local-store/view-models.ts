import type { QuickRecordKey } from '../quick-records.ts'
import type { PrimaryToothCode } from '../tooth-eruptions.ts'
import type { LocalBaby, LocalFeedingRecord, LocalHealthRecord, LocalMemo } from './schema.ts'

export type DashboardFeedingRecord = LocalFeedingRecord & { recordType: 'feeding' }
export type DashboardHealthRecord = LocalHealthRecord & { recordType: 'health' }

export interface DashboardSnapshot {
  baby: LocalBaby
  todayFeedingRecords: DashboardFeedingRecord[]
  todayHealthRecords: DashboardHealthRecord[]
  recentMemos: LocalMemo[]
  quickRecordKeys: QuickRecordKey[]
}

export type TimelineFeedingRecord = LocalFeedingRecord & {
  recordType: 'feeding'
  baby?: Pick<LocalBaby, 'id' | 'name'>
}

export type TimelineHealthRecord = LocalHealthRecord & {
  recordType: 'health'
  toothEruptions: { toothCode: PrimaryToothCode }[]
  baby?: Pick<LocalBaby, 'id' | 'name'>
}

export type TimelineRecord = TimelineFeedingRecord | TimelineHealthRecord

export interface StatsDay {
  date: string
  breastFeedingCount: number
  totalBreastDuration: number
  leftBreastDuration: number
  rightBreastDuration: number
  breastBottleCount: number
  totalBreastMilkAmount: number
  formulaCount: number
  totalFormulaAmount: number
  solidFoodCount: number
  adGiven: boolean
  vitaminDGiven: boolean
  peeCount: number
  poopCount: number
  nightFeedingCount: number
  sleepDurationMinutes: number
  sleepCount: number
  weight?: number
  height?: number
  temperature?: number
}

export type StatsRange =
  | { kind: 'preset'; days: number; endDate?: string }
  | { kind: 'custom'; startDate: string; endDate: string }

export interface StatsSnapshot {
  baby: Pick<LocalBaby, 'id' | 'name'>
  todayStats: StatsDay
  lastDays: StatsDay[]
  totalStats: {
    totalFeedings: number
    totalFormulaAmount: number
    totalBreastDuration: number
    totalBreastMilkAmount: number
  }
  weightTrend: { date: string; recordedAt: string; weight: number }[]
  heightTrend: { date: string; recordedAt: string; height: number }[]
  vaccineRecords: {
    id: string
    vaccineName: string
    vaccineManufacturer: string | null
    date: string
    recordedAt: string
    notes: string | null
    vaccineDoseNumber: number | null
    vaccineTotalDoses: number | null
  }[]
  toothEruptionRecords: {
    id: string
    date: string
    recordedAt: string
    createdAt: string
    notes: string | null
    toothEruptions: { toothCode: PrimaryToothCode }[]
  }[]
  medicationRecords: {
    id: string
    medicationName: string
    medicationDose: string | null
    date: string
    recordedAt: string
    notes: string | null
  }[]
  memoRecords: Pick<LocalMemo, 'id' | 'title' | 'content' | 'scheduledAt' | 'completed' | 'completedAt'>[]
  feedingIntervals: number[]
  feedingHeatmap: { date: string; hour: number; count: number }[]
  babyBirthDate: string | null
  babyGender: string | null
}
