/** KST(UTC+9) 기준 날짜 유틸. */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export type AdminRangeKey = '1d' | '7d' | '30d'

export function parseRangeKey(raw: string | null | undefined): AdminRangeKey {
  if (raw === '1d' || raw === '7d' || raw === '30d') return raw
  return '7d'
}

export function rangeDays(key: AdminRangeKey): number {
  if (key === '1d') return 1
  if (key === '30d') return 30
  return 7
}

/** KST 자정에 해당하는 UTC Date */
export function startOfKstDay(d = new Date()): Date {
  const kst = new Date(d.getTime() + KST_OFFSET_MS)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth()
  const day = kst.getUTCDate()
  return new Date(Date.UTC(y, m, day) - KST_OFFSET_MS)
}

export function rangeStart(key: AdminRangeKey): Date {
  const days = rangeDays(key)
  const start = startOfKstDay()
  start.setTime(start.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
  return start
}

export function formatKstDate(d: Date): string {
  const kst = new Date(d.getTime() + KST_OFFSET_MS)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const day = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatKstDateTime(d: Date): string {
  const kst = new Date(d.getTime() + KST_OFFSET_MS)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const day = String(kst.getUTCDate()).padStart(2, '0')
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mm = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

/** range 시작일부터 오늘(KST)까지 inclusive 날짜 키 */
export function eachKstDateKey(start: Date): string[] {
  const keys: string[] = []
  let cursor = startOfKstDay(start)
  const today = startOfKstDay()
  while (cursor.getTime() <= today.getTime()) {
    keys.push(formatKstDate(cursor))
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }
  return keys
}
