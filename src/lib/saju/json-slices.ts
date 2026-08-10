/**
 * Postgres jsonb path helpers — pull tiny fragments instead of full sajuReportJson.
 *
 * IMPORTANT: every query below uses SQL jsonb operators (`->`, `#>>`) so Postgres
 * extracts and transmits only the slice. Do NOT replace with findMany + JS slicing
 * of full `sajuReportJson` — that would load ~300KB/entry into Node.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  extractYongshinOverride,
  type DailyComputeEntry,
} from '@/lib/saju/daily-fortune'

/** Wrap a raw 용신희신/용신 jsonb object for extractYongshinOverride. */
export function yongshinOverrideFromSlice(
  yongshin: unknown,
): DailyComputeEntry['yongshinOverride'] {
  if (!yongshin || typeof yongshin !== 'object') return null
  return extractYongshinOverride({ 용신희신: yongshin })
}

export type DailyListEntryRow = {
  id: string
  name: string
  gender: string
  birthDate: string
  birthTime: string | null
  timeUnknown: boolean
  isLunar: boolean
  isLeapMonth: boolean
  createdAt: Date
  isRepresentative: boolean
  yongshin: unknown
}

/** List entries for /api/saju/daily — metadata + 용신 slice only. */
export async function findDailyListEntries(where: {
  userId?: string
  guestId?: string
}): Promise<DailyListEntryRow[]> {
  if (where.userId) {
    return prisma.$queryRaw<DailyListEntryRow[]>`
      SELECT
        id, name, gender, "birthDate", "birthTime", "timeUnknown",
        "isLunar", "isLeapMonth", "createdAt", "isRepresentative",
        COALESCE("sajuReportJson"->'용신희신', "sajuReportJson"->'용신') AS yongshin
      FROM "SajuEntry"
      WHERE "userId" = ${where.userId}
      ORDER BY "createdAt" DESC
    `
  }
  if (where.guestId) {
    return prisma.$queryRaw<DailyListEntryRow[]>`
      SELECT
        id, name, gender, "birthDate", "birthTime", "timeUnknown",
        "isLunar", "isLeapMonth", "createdAt", "isRepresentative",
        COALESCE("sajuReportJson"->'용신희신', "sajuReportJson"->'용신') AS yongshin
      FROM "SajuEntry"
      WHERE "guestId" = ${where.guestId}
      ORDER BY "createdAt" DESC
    `
  }
  return []
}

/** dayElement backfill without loading full reports. */
export async function findDayElementsByIds(
  ids: string[],
): Promise<Array<{ id: string; dayElement: string | null }>> {
  if (ids.length === 0) return []
  return prisma.$queryRaw<Array<{ id: string; dayElement: string | null }>>`
    SELECT
      id,
      "sajuReportJson"#>>'{오행십성_상세,천간,2,element}' AS "dayElement"
    FROM "SajuEntry"
    WHERE id IN (${Prisma.join(ids)})
  `
}

/** 월운 캐시 키용 target_year only (~bytes, not full chartData). */
export async function findMonthlyTargetYear(entryId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ targetYear: string | null }>>`
    SELECT "sajuReportJson"->'chartData'->'월운_타임라인'->>'target_year' AS "targetYear"
    FROM "SajuEntry"
    WHERE id = ${entryId}
    LIMIT 1
  `
  const n = rows[0]?.targetYear ? parseInt(rows[0].targetYear, 10) : NaN
  return Number.isFinite(n) ? n : new Date().getFullYear()
}

/** 용신 slice for a single entry (week hydrate / daily compute). */
export async function findYongshinSlice(entryId: string): Promise<unknown> {
  const rows = await prisma.$queryRaw<Array<{ yongshin: unknown }>>`
    SELECT COALESCE("sajuReportJson"->'용신희신', "sajuReportJson"->'용신') AS yongshin
    FROM "SajuEntry"
    WHERE id = ${entryId}
    LIMIT 1
  `
  return rows[0]?.yongshin ?? null
}
