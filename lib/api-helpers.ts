/**
 * Shared API route helpers
 * Centralizes common constants and server-side time utilities
 */
import {
  getBeijingDateStr,
  getBeijingDayRange,
  splitDurationByBeijingDay,
} from './time.ts'

export { getBeijingDateStr, getBeijingDayRange, splitDurationByBeijingDay }

// Common no-cache response headers used by all API routes
export const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
} as const

/**
 * Get today's date string in Beijing time (YYYY-MM-DD)
 */
export function getBeijingTodayStr(): string {
  return getBeijingDateStr(new Date())
}

/**
 * Get the date string N days ago in Beijing time (YYYY-MM-DD)
 */
export function getBeijingDaysAgoStr(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return getBeijingDateStr(d)
}

/**
 * Build a Prisma OR clause that captures health records for a date range,
 * including SLEEP records whose sleepStartTime falls in range (cross-midnight).
 *
 * Use inside a `where` block: `OR: buildSleepAwareOrClause(start, end)`
 */
export function buildSleepAwareOrClause(start: Date, end: Date) {
  return [
    { recordedAt: { gte: start, lte: end } },
    { type: 'SLEEP', sleepStartTime: { gte: start, lte: end } },
  ]
}
