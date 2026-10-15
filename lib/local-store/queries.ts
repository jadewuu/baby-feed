import { getBeijingDateStr, getBeijingDayRange, getBeijingToday, splitDurationByBeijingDay } from '../time.ts'
import { openBabyFeedDb } from './db.ts'
import { getSettings } from './settings.ts'
import { STORE_NAMES, type LocalHealthRecord, type LocalToothEruption } from './schema.ts'
import type {
  DashboardSnapshot,
  StatsDay,
  StatsRange,
  StatsSnapshot,
  TimelineHealthRecord,
  TimelineRecord,
} from './view-models.ts'

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

function datesBetween(startDate: string, endDate: string): string[] {
  if (startDate > endDate) throw new Error('开始日期不能晚于结束日期')
  const dates: string[] = []
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) dates.push(date)
  return dates
}

function byBabyRange(babyId: string) {
  return IDBKeyRange.bound([babyId, ''], [babyId, '\uffff'])
}

async function getBabyRecords(babyId: string) {
  const db = await openBabyFeedDb()
  const [feeding, health, memos, teeth] = await Promise.all([
    db.getAllFromIndex(STORE_NAMES.feedingRecords, 'by-baby-time', byBabyRange(babyId)),
    db.getAllFromIndex(STORE_NAMES.healthRecords, 'by-baby-time', byBabyRange(babyId)),
    db.getAllFromIndex(STORE_NAMES.memos, 'by-baby-time', byBabyRange(babyId)),
    db.getAllFromIndex(STORE_NAMES.toothEruptions, 'by-baby-tooth', byBabyRange(babyId)),
  ])
  return { feeding, health, memos, teeth }
}

function toothMap(teeth: LocalToothEruption[]) {
  const map = new Map<string, TimelineHealthRecord['toothEruptions']>()
  for (const tooth of teeth) {
    const values = map.get(tooth.healthRecordId) ?? []
    values.push({ toothCode: tooth.toothCode })
    map.set(tooth.healthRecordId, values)
  }
  return map
}

function isWithin(value: string, startMs: number, endMs: number) {
  const time = Date.parse(value)
  return time >= startMs && time <= endMs
}

export async function getDashboardSnapshot(babyId: string, now = new Date()): Promise<DashboardSnapshot> {
  const db = await openBabyFeedDb()
  const baby = await db.get(STORE_NAMES.babies, babyId)
  if (!baby) throw new Error('宝宝不存在')
  const date = getBeijingDateStr(now)
  const { start, end } = getBeijingDayRange(date)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const [{ feeding, health, memos }, settings] = await Promise.all([getBabyRecords(babyId), getSettings()])
  const memoStart = now.getTime() - 3 * 86_400_000
  const memoEnd = now.getTime() + 3 * 86_400_000

  return {
    baby,
    todayFeedingRecords: feeding
      .filter(record => isWithin(record.startTime, startMs, endMs))
      .sort((left, right) => right.startTime.localeCompare(left.startTime))
      .map(record => ({ ...record, recordType: 'feeding' as const })),
    todayHealthRecords: health
      .filter(record => isWithin(record.recordedAt, startMs, endMs))
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
      .map(record => ({ ...record, recordType: 'health' as const })),
    recentMemos: memos.filter(memo => (
      !memo.completed
      && Date.parse(memo.scheduledAt) >= memoStart
      && Date.parse(memo.scheduledAt) <= memoEnd
    )),
    quickRecordKeys: settings.quickRecordKeys,
  }
}

function timelineSortTime(record: TimelineRecord, dayStartMs: number, dayEndMs: number) {
  if (record.recordType === 'feeding') return Date.parse(record.startTime)
  if (record.type === 'SLEEP' && record.sleepStartTime) {
    const sleepStart = Date.parse(record.sleepStartTime)
    if (sleepStart >= dayStartMs && sleepStart <= dayEndMs) return sleepStart
    return Date.parse(record.sleepEndTime ?? record.recordedAt)
  }
  return Date.parse(record.recordedAt)
}

export async function getTimelineDay(babyId: string, date: string): Promise<TimelineRecord[]> {
  const { start, end } = getBeijingDayRange(date)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const { feeding, health, teeth } = await getBabyRecords(babyId)
  const teethByRecord = toothMap(teeth)
  const records: TimelineRecord[] = [
    ...feeding
      .filter(record => isWithin(record.startTime, startMs, endMs))
      .map(record => ({ ...record, recordType: 'feeding' as const })),
    ...health
      .filter(record => (
        isWithin(record.recordedAt, startMs, endMs)
        || (record.type === 'SLEEP' && !!record.sleepStartTime && isWithin(record.sleepStartTime, startMs, endMs))
      ))
      .map(record => ({
        ...record,
        recordType: 'health' as const,
        toothEruptions: teethByRecord.get(record.id) ?? [],
      })),
  ]
  return records.sort((left, right) => (
    timelineSortTime(right, startMs, endMs) - timelineSortTime(left, startMs, endMs)
  ))
}

export async function listTimelineDates(babyId: string): Promise<string[]> {
  const { feeding, health } = await getBabyRecords(babyId)
  const dates = new Set(feeding.map(record => getBeijingDateStr(new Date(record.startTime))))
  for (const record of health) {
    dates.add(getBeijingDateStr(new Date(record.recordedAt)))
    if (record.type === 'SLEEP' && record.sleepStartTime) {
      dates.add(getBeijingDateStr(new Date(record.sleepStartTime)))
    }
  }
  return [...dates].sort((left, right) => right.localeCompare(left))
}

function emptyStatsDay(date: string): StatsDay {
  return {
    date,
    breastFeedingCount: 0,
    totalBreastDuration: 0,
    leftBreastDuration: 0,
    rightBreastDuration: 0,
    breastBottleCount: 0,
    totalBreastMilkAmount: 0,
    formulaCount: 0,
    totalFormulaAmount: 0,
    solidFoodCount: 0,
    adGiven: false,
    vitaminDGiven: false,
    peeCount: 0,
    poopCount: 0,
    nightFeedingCount: 0,
    sleepDurationMinutes: 0,
    sleepCount: 0,
  }
}

function resolveRange(range: StatsRange) {
  if (range.kind === 'custom') return { startDate: range.startDate, endDate: range.endDate }
  if (!Number.isInteger(range.days) || range.days < 1) throw new Error('统计天数不正确')
  const endDate = range.endDate ?? getBeijingToday()
  return { startDate: addDays(endDate, -(range.days - 1)), endDate }
}

function withinStatsRange(record: LocalHealthRecord, startMs: number, endMs: number) {
  if (isWithin(record.recordedAt, startMs, endMs)) return true
  if (record.type !== 'SLEEP' || !record.sleepStartTime) return false
  const sleepStart = Date.parse(record.sleepStartTime)
  const sleepEnd = Date.parse(record.sleepEndTime ?? record.recordedAt)
  return sleepStart <= endMs && sleepEnd >= startMs
}

export async function getStatsSnapshot(babyId: string, range: StatsRange): Promise<StatsSnapshot | null> {
  const db = await openBabyFeedDb()
  const baby = await db.get(STORE_NAMES.babies, babyId)
  if (!baby) return null
  const { startDate, endDate } = resolveRange(range)
  const dates = datesBetween(startDate, endDate)
  const { start } = getBeijingDayRange(startDate)
  const { end } = getBeijingDayRange(endDate)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const { feeding: allFeeding, health: allHealth, memos, teeth } = await getBabyRecords(babyId)
  const feeding = allFeeding.filter(record => isWithin(record.startTime, startMs, endMs))
  const health = allHealth.filter(record => withinStatsRange(record, startMs, endMs))
  const stats = new Map(dates.map(date => [date, emptyStatsDay(date)]))

  for (const record of feeding) {
    const day = stats.get(getBeijingDateStr(new Date(record.startTime)))
    if (!day) continue
    const left = record.leftBreastDuration ?? 0
    const right = record.rightBreastDuration ?? 0
    if (record.type === 'BREAST_MILK') {
      day.breastFeedingCount += 1
      day.totalBreastDuration += left + right
      day.leftBreastDuration += left
      day.rightBreastDuration += right
    } else if (record.type === 'BREAST_MILK_BOTTLE') {
      day.breastBottleCount += 1
      day.totalBreastMilkAmount += record.breastMilkAmount ?? 0
    } else if (record.type === 'FORMULA') {
      day.formulaCount += 1
      day.totalFormulaAmount += record.formulaAmount ?? 0
    } else if (record.type === 'SOLID_FOOD') {
      day.solidFoodCount += 1
    }
    const hour = new Date(Date.parse(record.startTime) + 8 * 3_600_000).getUTCHours()
    if (hour >= 22 || hour < 6) day.nightFeedingCount += 1
  }

  for (const record of health) {
    const day = stats.get(getBeijingDateStr(new Date(record.recordedAt)))
    if (day) {
      if (record.type === 'WEIGHT' && record.weight != null) day.weight = record.weight
      if (record.type === 'HEIGHT' && record.height != null) day.height = record.height
      if (record.type === 'TEMPERATURE' && record.temperature != null) day.temperature = record.temperature
      if (record.type === 'AD_VITAMIN') {
        day.adGiven ||= !!record.adGiven
        day.vitaminDGiven ||= !!record.vitaminDGiven
      }
      if (record.type === 'DIAPER') {
        if (record.diaperType === 'PEE' || record.diaperType === 'BOTH') day.peeCount += 1
        if (record.diaperType === 'POOP' || record.diaperType === 'BOTH') day.poopCount += 1
      }
    }
    if (record.type === 'SLEEP' && record.sleepStartTime && record.sleepEndTime) {
      splitDurationByBeijingDay(Date.parse(record.sleepStartTime), Date.parse(record.sleepEndTime), (date, minutes) => {
        const target = stats.get(date)
        if (target) {
          target.sleepDurationMinutes += minutes
          target.sleepCount += 1
        }
      })
    }
  }

  const sortedFeeding = [...feeding].sort((left, right) => left.startTime.localeCompare(right.startTime))
  const feedingIntervals = sortedFeeding.slice(1).flatMap((record, index) => {
    const minutes = Math.round((Date.parse(record.startTime) - Date.parse(sortedFeeding[index].startTime)) / 60_000)
    return minutes > 0 && minutes < 720 ? [minutes] : []
  })
  const heatmap = new Map<string, number>()
  for (const record of sortedFeeding) {
    const date = getBeijingDateStr(new Date(record.startTime))
    const hour = new Date(Date.parse(record.startTime) + 8 * 3_600_000).getUTCHours()
    const key = `${date}|${hour}`
    heatmap.set(key, (heatmap.get(key) ?? 0) + 1)
  }
  const teethByRecord = toothMap(teeth)

  return {
    baby: { id: baby.id, name: baby.name },
    todayStats: stats.get(endDate) ?? emptyStatsDay(endDate),
    lastDays: dates.map(date => stats.get(date)!),
    totalStats: {
      totalFeedings: feeding.length,
      totalFormulaAmount: feeding.reduce((sum, record) => sum + (record.type === 'FORMULA' ? record.formulaAmount ?? 0 : 0), 0),
      totalBreastDuration: feeding.reduce((sum, record) => sum + (record.type === 'BREAST_MILK' ? (record.leftBreastDuration ?? 0) + (record.rightBreastDuration ?? 0) : 0), 0),
      totalBreastMilkAmount: feeding.reduce((sum, record) => sum + (record.type === 'BREAST_MILK_BOTTLE' ? record.breastMilkAmount ?? 0 : 0), 0),
    },
    weightTrend: allHealth.filter(record => record.type === 'WEIGHT' && record.weight != null).map(record => ({
      date: getBeijingDateStr(new Date(record.recordedAt)), recordedAt: record.recordedAt, weight: record.weight!,
    })),
    heightTrend: allHealth.filter(record => record.type === 'HEIGHT' && record.height != null).map(record => ({
      date: getBeijingDateStr(new Date(record.recordedAt)), recordedAt: record.recordedAt, height: record.height!,
    })),
    vaccineRecords: allHealth.filter(record => record.type === 'VACCINE' && !!record.vaccineName).reverse().map(record => ({
      id: record.id, vaccineName: record.vaccineName!, vaccineManufacturer: record.vaccineManufacturer ?? null,
      date: getBeijingDateStr(new Date(record.recordedAt)), recordedAt: record.recordedAt, notes: record.notes ?? null,
      vaccineDoseNumber: record.vaccineDoseNumber ?? null, vaccineTotalDoses: record.vaccineTotalDoses ?? null,
    })),
    toothEruptionRecords: allHealth.filter(record => record.type === 'TOOTH_ERUPTION').map(record => ({
      id: record.id, date: getBeijingDateStr(new Date(record.recordedAt)), recordedAt: record.recordedAt,
      createdAt: record.createdAt, notes: record.notes ?? null, toothEruptions: teethByRecord.get(record.id) ?? [],
    })),
    medicationRecords: health.filter(record => record.type === 'MEDICATION' && !!record.medicationName).reverse().map(record => ({
      id: record.id, medicationName: record.medicationName!, medicationDose: record.medicationDose ?? null,
      date: getBeijingDateStr(new Date(record.recordedAt)), recordedAt: record.recordedAt, notes: record.notes ?? null,
    })),
    memoRecords: memos.map(({ id, title, content, scheduledAt, completed, completedAt }) => ({
      id, title, content, scheduledAt, completed, completedAt,
    })),
    feedingIntervals,
    feedingHeatmap: [...heatmap.entries()].map(([key, count]) => {
      const [date, hour] = key.split('|')
      return { date, hour: Number(hour), count }
    }),
    babyBirthDate: baby.birthDate || null,
    babyGender: baby.gender || null,
  }
}
