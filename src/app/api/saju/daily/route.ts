import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import {
  computeDailyFortunes,
  extractYongshinOverride,
  type DailyComputeEntry,
} from '@/lib/saju/daily-fortune'
import { kstRecentDates, deltaDirection, buildDailyComment } from '@/lib/saju/daily-util'

export const runtime = 'nodejs'

const WINDOW_DAYS = 7
// 한 요청에서 동기로 계산할 최대 엔트리 수. compute_all이 엔트리당 ~1s라
// 엔트리가 많으면 첫 로드가 수십 초가 된다. 대표+상단부터 조금씩 채우고
// 나머지는 pending=true로 알려서 클라이언트가 이어받아 폴링하게 한다.
const MAX_COMPUTE_PER_REQUEST = 8

function getGuestId(req: NextRequest): string | null {
  return req.headers.get('x-guest-id') || null
}

type DomainScores = Record<string, number>

interface DailyEntryResponse {
  id: string
  name: string
  score: number | null
  grade: string | null
  delta: number
  direction: 'up' | 'down' | 'flat'
  domains: DomainScores | null
  /** 6개 도메인 중 50에서 가장 멀리 벗어난(가장 두드러진) 도메인 */
  standoutDomain: string | null
  standoutScore: number | null
  series: (number | null)[]
}

function asDomains(v: unknown): DomainScores | null {
  if (!v || typeof v !== 'object') return null
  const out: DomainScores = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'number') out[k] = val
  }
  return Object.keys(out).length ? out : null
}

/** 50에서 가장 멀리 벗어난 도메인 (좋든 나쁘든 가장 눈에 띄는 신호) */
function pickStandout(domains: DomainScores | null): { domain: string | null; score: number | null } {
  if (!domains) return { domain: null, score: null }
  let dk: string | null = null, dv: number | null = null, dev = -1
  for (const [k, v] of Object.entries(domains)) {
    const d = Math.abs(v - 50)
    if (d > dev) { dev = d; dk = k; dv = v }
  }
  return { domain: dk, score: dv }
}

function bestWorst(domains: DomainScores | null): {
  bestDomain: string | null; bestScore: number | null
  worstDomain: string | null; worstScore: number | null
} {
  if (!domains || !Object.keys(domains).length) {
    return { bestDomain: null, bestScore: null, worstDomain: null, worstScore: null }
  }
  const entries = Object.entries(domains)
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a))
  const worst = entries.reduce((a, b) => (b[1] < a[1] ? b : a))
  return { bestDomain: best[0], bestScore: best[1], worstDomain: worst[0], worstScore: worst[1] }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession().catch(() => null)
    const guestId = getGuestId(request)
    if (!user && !guestId) {
      return NextResponse.json({ today: kstRecentDates(1)[0], entries: [], representative: null })
    }

    const where = user ? { userId: user.id } : { guestId: guestId! }
    const entries = await prisma.sajuEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, gender: true, birthDate: true, birthTime: true,
        timeUnknown: true, isLunar: true, isLeapMonth: true, createdAt: true,
        isRepresentative: true, sajuReportJson: true,
      },
    })

    const dates = kstRecentDates(WINDOW_DAYS)
    const today = dates[dates.length - 1]
    const yesterday = dates[dates.length - 2]

    if (entries.length === 0) {
      return NextResponse.json({ today, entries: [], representative: null })
    }

    const entryIds = entries.map((e) => e.id)

    // 1) 캐시 조회
    const cached = await prisma.dailyFortune.findMany({
      where: { entryId: { in: entryIds }, date: { in: dates } },
    })
    // map[entryId][date] = row
    const cacheMap = new Map<string, Map<string, typeof cached[number]>>()
    for (const row of cached) {
      if (!cacheMap.has(row.entryId)) cacheMap.set(row.entryId, new Map())
      cacheMap.get(row.entryId)!.set(row.date, row)
    }

    // 대표 차트 = 사용자가 지정한 대표 사주, 없으면 가장 먼저 만든 사주 (보통 본인)
    const repId =
      entries.find((e) => e.isRepresentative)?.id ??
      [...entries].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )[0]?.id

    // 2) 오늘 점수가 없는 엔트리는 전체 윈도우를 계산.
    //    단, 한 요청당 MAX_COMPUTE_PER_REQUEST개로 제한 (대표 먼저, 그다음 목록 순).
    const missing = entries.filter((e) => !cacheMap.get(e.id)?.has(today))
    const orderedMissing = [
      ...missing.filter((e) => e.id === repId),
      ...missing.filter((e) => e.id !== repId),
    ]
    const needCompute = orderedMissing.slice(0, MAX_COMPUTE_PER_REQUEST)
    const pending = missing.length > needCompute.length
    if (needCompute.length > 0) {
      const computeEntries: DailyComputeEntry[] = needCompute.map((e) => ({
        id: e.id,
        birthDate: e.birthDate,
        birthTime: e.birthTime,
        timeUnknown: e.timeUnknown,
        gender: e.gender,
        isLunar: e.isLunar,
        isLeapMonth: e.isLeapMonth,
        yongshinOverride: extractYongshinOverride(e.sajuReportJson),
      }))

      const computed = computeDailyFortunes(computeEntries, dates)

      const rows: {
        entryId: string; date: string; score: number; grade: string
        seasonTag: string | null; seasonEmoji: string | null
        domainsJson: DomainScores
      }[] = []
      for (const [eid, byDate] of Object.entries(computed)) {
        for (const [date, s] of Object.entries(byDate)) {
          const domains = (s.domains ?? {}) as DomainScores
          rows.push({
            entryId: eid, date, score: s.score, grade: s.grade,
            seasonTag: s.seasonTag || null, seasonEmoji: s.seasonEmoji || null,
            domainsJson: domains,
          })
          if (!cacheMap.has(eid)) cacheMap.set(eid, new Map())
          cacheMap.get(eid)!.set(date, {
            id: '', entryId: eid, date, score: s.score, grade: s.grade,
            seasonTag: s.seasonTag || null, seasonEmoji: s.seasonEmoji || null,
            domainsJson: domains,
            createdAt: new Date(),
          } as typeof cached[number])
        }
      }
      if (rows.length > 0) {
        await prisma.dailyFortune.createMany({ data: rows, skipDuplicates: true })
      }
    }

    // 3) 응답 구성
    const responseEntries: DailyEntryResponse[] = entries.map((e) => {
      const byDate = cacheMap.get(e.id)
      const todayRow = byDate?.get(today) ?? null
      const yRow = byDate?.get(yesterday) ?? null
      const score = todayRow?.score ?? null
      const delta = score != null && yRow?.score != null ? score - yRow.score : 0
      const series = dates.map((d) => byDate?.get(d)?.score ?? null)
      const domains = asDomains(todayRow?.domainsJson)
      const standout = pickStandout(domains)
      return {
        id: e.id,
        name: e.name,
        score,
        grade: todayRow?.grade ?? null,
        delta,
        direction: deltaDirection(delta),
        domains,
        standoutDomain: standout.domain,
        standoutScore: standout.score,
        series,
      }
    })

    // 4) 대표 차트 카드 (좋은 운/주의 운 + 규칙 기반 코멘트, LLM 0).
    const repEntry = responseEntries.find((r) => r.id === repId) ?? null
    const repBW = bestWorst(repEntry?.domains ?? null)
    const representative = repEntry && repEntry.score != null
      ? {
          id: repEntry.id,
          name: repEntry.name,
          score: repEntry.score,
          delta: repEntry.delta,
          direction: repEntry.direction,
          bestDomain: repBW.bestDomain,
          bestScore: repBW.bestScore,
          worstDomain: repBW.worstDomain,
          worstScore: repBW.worstScore,
          comment: buildDailyComment({
            score: repEntry.score,
            bestDomain: repBW.bestDomain,
            worstDomain: repBW.worstDomain,
          }),
        }
      : null

    return NextResponse.json({ today, entries: responseEntries, representative, pending })
  } catch (error) {
    console.error('GET /api/saju/daily error:', error)
    return NextResponse.json({ error: 'Failed to fetch daily fortune' }, { status: 500 })
  }
}
