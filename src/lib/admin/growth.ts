import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { addKstDays, eachKstDateKey, formatKstDate, startOfKstDay } from './dates'

const DAY_MS = 24 * 60 * 60 * 1000
const RETENTION_OFFSETS = 14
const LOOKBACK_DAYS = 29
const LOOKAHEAD_DAYS = 14

export type DauPoint = {
  date: string
  dau: number
  nau: number
  eau: number
  rau: number
  wau: number
  mau: number
  stickinessWau: number
  stickinessMau: number
}

export type RetentionPoint = {
  day: string
  offset: number
  classic: number
  rolling: number
  cohortN: number
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 1000) / 10
}

function addUserDay(map: Map<string, Set<string>>, userId: string, at: Date) {
  const key = formatKstDate(at)
  let set = map.get(key)
  if (!set) {
    set = new Set()
    map.set(key, set)
  }
  set.add(userId)
}

function usersOn(map: Map<string, Set<string>>, key: string): Set<string> {
  return map.get(key) ?? new Set()
}

function uniqueInKeys(map: Map<string, Set<string>>, keys: string[]): Set<string> {
  const out = new Set<string>()
  for (const k of keys) {
    const s = map.get(k)
    if (!s) continue
    for (const id of s) out.add(id)
  }
  return out
}

/**
 * 활성 = 가입 · 사주 생성 · 주 사용(use:*) · 결제.
 * NAU: 그날 가입한 활성 유저
 * EAU: 전날에도 활성이었던 유저
 * RAU: 전날 비활성 + 그 이전 가입 복귀
 * DAU = NAU + EAU + RAU
 */
export async function getGrowthMetrics(since: Date, until: Date, dateKeys: string[]) {
  const todayEnd = addKstDays(startOfKstDay(), 1)
  const activityStart = new Date(since.getTime() - LOOKBACK_DAYS * DAY_MS)
  const retentionUntil = new Date(until.getTime() + LOOKAHEAD_DAYS * DAY_MS)
  const activityUntil = retentionUntil.getTime() < todayEnd.getTime() ? retentionUntil : todayEnd
  const inAct = { gte: activityStart, lt: activityUntil }

  const [signups, entries, ledger, payments] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: inAct, role: UserRole.USER },
      select: { id: true, createdAt: true },
    }),
    prisma.sajuEntry.findMany({
      where: { createdAt: inAct, userId: { not: null }, user: { role: UserRole.USER } },
      select: { userId: true, createdAt: true },
    }),
    prisma.entitlementLedger.findMany({
      where: { createdAt: inAct, reason: { startsWith: 'use:' }, user: { role: UserRole.USER } },
      select: { userId: true, createdAt: true },
    }),
    prisma.paymentOrder.findMany({
      where: {
        status: 'paid',
        paidAt: { gte: activityStart, lt: activityUntil },
        user: { role: UserRole.USER },
      },
      select: { userId: true, paidAt: true },
    }),
  ])

  const byDay = new Map<string, Set<string>>()
  const firstSeen = new Map<string, string>()

  for (const u of signups) {
    addUserDay(byDay, u.id, u.createdAt)
    firstSeen.set(u.id, formatKstDate(u.createdAt))
  }
  for (const e of entries) {
    if (!e.userId) continue
    addUserDay(byDay, e.userId, e.createdAt)
  }
  for (const row of ledger) {
    addUserDay(byDay, row.userId, row.createdAt)
  }
  for (const o of payments) {
    if (!o.paidAt) continue
    addUserDay(byDay, o.userId, o.paidAt)
  }

  const missing: string[] = []
  for (const set of byDay.values()) {
    for (const id of set) {
      if (!firstSeen.has(id)) missing.push(id)
    }
  }
  if (missing.length) {
    const extras = await prisma.user.findMany({
      where: { id: { in: [...new Set(missing)] } },
      select: { id: true, createdAt: true },
    })
    for (const u of extras) firstSeen.set(u.id, formatKstDate(u.createdAt))
  }

  const calendarKeys = eachKstDateKey(activityStart, activityUntil)
  const keyIndex = new Map(calendarKeys.map((k, i) => [k, i]))
  const lastWindowKey = formatKstDate(addKstDays(activityUntil, -1))
  const lastIdx = keyIndex.get(lastWindowKey) ?? calendarKeys.length - 1

  const dauSeries: DauPoint[] = dateKeys.map((date, i) => {
    const today = usersOn(byDay, date)
    const yKey = i === 0 ? formatKstDate(new Date(since.getTime() - DAY_MS)) : dateKeys[i - 1]!
    const yesterday = usersOn(byDay, yKey)

    let nau = 0
    let eau = 0
    let rau = 0
    for (const id of today) {
      const born = firstSeen.get(id)
      if (born === date) nau += 1
      else if (yesterday.has(id)) eau += 1
      else rau += 1
    }

    const idx = keyIndex.get(date) ?? calendarKeys.indexOf(date)
    const wauKeys = idx >= 0 ? calendarKeys.slice(Math.max(0, idx - 6), idx + 1) : [date]
    const mauKeys = idx >= 0 ? calendarKeys.slice(Math.max(0, idx - 29), idx + 1) : [date]
    const wau = uniqueInKeys(byDay, wauKeys).size
    const mau = uniqueInKeys(byDay, mauKeys).size
    const dau = today.size

    return {
      date,
      dau,
      nau,
      eau,
      rau,
      wau,
      mau,
      stickinessWau: pct(dau, wau),
      stickinessMau: pct(dau, mau),
    }
  })

  const retention: RetentionPoint[] = []
  for (let offset = 0; offset <= RETENTION_OFFSETS; offset++) {
    let classicN = 0
    let rollingN = 0
    let denom = 0
    for (const cohortDay of dateKeys) {
      const cIdx = keyIndex.get(cohortDay)
      if (cIdx == null) continue
      const targetIdx = cIdx + offset
      if (targetIdx > lastIdx) continue
      const cohort = [...usersOn(byDay, cohortDay)].filter((id) => firstSeen.get(id) === cohortDay)
      if (!cohort.length) continue
      denom += cohort.length
      const targetKey = calendarKeys[targetIdx]
      if (targetKey && usersOn(byDay, targetKey).size >= 0) {
        const activeThatDay = usersOn(byDay, targetKey)
        for (const id of cohort) {
          if (activeThatDay.has(id)) classicN += 1
        }
      }
      const laterKeys = calendarKeys.slice(targetIdx, lastIdx + 1)
      const later = uniqueInKeys(byDay, laterKeys)
      for (const id of cohort) {
        if (later.has(id)) rollingN += 1
      }
    }
    retention.push({
      day: `D${offset}`,
      offset,
      classic: pct(classicN, denom),
      rolling: pct(rollingN, denom),
      cohortN: denom,
    })
  }

  const latest = dauSeries[dauSeries.length - 1]
  return {
    dauSeries,
    retention,
    latest: latest
      ? {
          dau: latest.dau,
          nau: latest.nau,
          eau: latest.eau,
          rau: latest.rau,
          stickinessWau: latest.stickinessWau,
          stickinessMau: latest.stickinessMau,
        }
      : { dau: 0, nau: 0, eau: 0, rau: 0, stickinessWau: 0, stickinessMau: 0 },
  }
}

export type GrowthMetrics = Awaited<ReturnType<typeof getGrowthMetrics>>
