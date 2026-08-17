/** KST(UTC+9) 기준 날짜 유틸. */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 직접 선택 최대 일수 ( inclusive ) */
export const ADMIN_RANGE_MAX_DAYS = 90

export type AdminRangeKey = '1d' | '7d' | '30d'
export type AdminRangePreset = AdminRangeKey | 'custom'

export const ADMIN_RANGE_PRESETS: { key: AdminRangeKey; label: string }[] = [
  { key: '1d', label: '오늘' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
]

export const ADMIN_RANGE_LABEL: Record<AdminRangeKey, string> = {
  '1d': '오늘',
  '7d': '최근 7일',
  '30d': '최근 30일',
}

export type AdminRange = {
  preset: AdminRangePreset
  start: Date
  endExclusive: Date
  fromKey: string
  toKey: string
  label: string
}

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

export function addKstDays(start: Date, days: number): Date {
  return new Date(startOfKstDay(start).getTime() + days * DAY_MS)
}

export function rangeStart(key: AdminRangeKey): Date {
  const days = rangeDays(key)
  return addKstDays(startOfKstDay(), -(days - 1))
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

export function parseKstDateKey(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const m = raw.trim().match(DATE_RE)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const start = new Date(Date.UTC(y, mo - 1, d) - KST_OFFSET_MS)
  if (formatKstDate(start) !== `${String(y).padStart(4, '0')}-${m[2]}-${m[3]}`) return null
  return start
}

export function parseAdminRange(sp: { range?: string; from?: string; to?: string }): AdminRange {
  const today = startOfKstDay()
  const todayKey = formatKstDate(today)
  const fromRaw = parseKstDateKey(sp.from)
  const toRaw = parseKstDateKey(sp.to)

  if (fromRaw && toRaw) {
    let from = fromRaw
    let to = toRaw
    if (from.getTime() > to.getTime()) {
      const tmp = from
      from = to
      to = tmp
    }
    if (to.getTime() > today.getTime()) to = today
    const maxStart = addKstDays(to, -(ADMIN_RANGE_MAX_DAYS - 1))
    if (from.getTime() < maxStart.getTime()) from = maxStart
    const fromKey = formatKstDate(from)
    const toKey = formatKstDate(to)
    return {
      preset: 'custom',
      start: from,
      endExclusive: addKstDays(to, 1),
      fromKey,
      toKey,
      label: fromKey === toKey ? fromKey : `${fromKey} ~ ${toKey}`,
    }
  }

  const key = parseRangeKey(sp.range)
  const start = rangeStart(key)
  return {
    preset: key,
    start,
    endExclusive: addKstDays(today, 1),
    fromKey: formatKstDate(start),
    toKey: todayKey,
    label: ADMIN_RANGE_LABEL[key],
  }
}

/** start inclusive ~ endExclusive exclusive, KST 일자 키 */
export function eachKstDateKey(start: Date, endExclusive?: Date): string[] {
  const keys: string[] = []
  let cursor = startOfKstDay(start)
  const last = endExclusive ? addKstDays(endExclusive, -1) : startOfKstDay()
  while (cursor.getTime() <= last.getTime()) {
    keys.push(formatKstDate(cursor))
    cursor = addKstDays(cursor, 1)
  }
  return keys
}
