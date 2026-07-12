import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import {
  computeDailyFortunes,
  extractYongshinOverride,
  type DailyComputeEntry,
} from '@/lib/saju/daily-fortune'
import { kstRecentDates, deltaDirection, buildDailyComment, buildDailySignals, weekScoreRange } from '@/lib/saju/daily-util'

export const runtime = 'nodejs'

const WINDOW_DAYS = 7
// 한 요청에서 동기로 계산할 최대 엔트리 수. compute_all이 엔트리당 ~1s라
// 이 값이 크면 대표 카드까지 그만큼 늦게 반환된다(첫 페인트 지연).
// 대표+상단 소수만 빠르게 반환하고 나머지는 pending=true로 클라이언트가 폴링해 채운다.
// (클라이언트는 미로딩 항목을 스피너로 표시하므로 배치를 작게 두는 편이 체감이 빠르다.)
const MAX_COMPUTE_PER_REQUEST = 4

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
    if (k.startsWith('_') || k.startsWith('__')) continue
    if (typeof val === 'number') out[k as keyof DomainScores] = val
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

    // 2) 리스트 윈도우(오늘-6~오늘)에 빈 날짜가 있으면 backfill.
    //    상세 페이지는 ±3일만 채워 두므로, "오늘만 있으면 OK"로 두면 앞쪽 null → 스파크라인 짧아짐.
    //    한 요청당 MAX_COMPUTE_PER_REQUEST개로 제한 (대표 먼저, 그다음 목록 순).
    const missingDatesFor = (entryId: string): string[] => {
      const byDate = cacheMap.get(entryId)
      return dates.filter((d) => !byDate?.has(d))
    }
    const incomplete = entries.filter((e) => missingDatesFor(e.id).length > 0)
    const orderedIncomplete = [
      ...incomplete.filter((e) => e.id === repId),
      ...incomplete.filter((e) => e.id !== repId),
    ]
    const needCompute = orderedIncomplete.slice(0, MAX_COMPUTE_PER_REQUEST)
    const pending = incomplete.length > needCompute.length
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

      // 배치에 필요한 빈 날짜만 계산 (이미 있는 ±3일은 스킵)
      const datesToCompute = [...new Set(needCompute.flatMap((e) => missingDatesFor(e.id)))]
      const computed = computeDailyFortunes(computeEntries, datesToCompute)

      const rows: {
        entryId: string; date: string; score: number; grade: string
        seasonTag: string | null; seasonEmoji: string | null
        domainsJson: object
      }[] = []
      for (const [eid, byDate] of Object.entries(computed)) {
        const stillMissing = new Set(missingDatesFor(eid))
        for (const [date, s] of Object.entries(byDate)) {
          // 이미 캐시에 있는 날짜는 쓰지 않음 (상세 ±3과 겹쳐도 skipDuplicates로 안전)
          if (!stillMissing.has(date)) continue
          const domains = (s.domains ?? {}) as DomainScores
          const domainsJson: Record<string, unknown> = { ...domains }
          if (s.chart || s.seasonDesc) {
            domainsJson.__chart = { ...(s.chart ?? {}), ...(s.seasonDesc ? { seasonDesc: s.seasonDesc } : {}) }
          }
          rows.push({
            entryId: eid, date, score: s.score, grade: s.grade,
            seasonTag: s.seasonTag || null, seasonEmoji: s.seasonEmoji || null,
            domainsJson,
          })
          if (!cacheMap.has(eid)) cacheMap.set(eid, new Map())
          cacheMap.get(eid)!.set(date, {
            id: '', entryId: eid, date, score: s.score, grade: s.grade,
            seasonTag: s.seasonTag || null, seasonEmoji: s.seasonEmoji || null,
            domainsJson,
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

    // 4) 대표 차트 카드 (주간 위치 + 소식 신호, LLM 0).
    const repEntry = responseEntries.find((r) => r.id === repId) ?? null
    const repBW = bestWorst(repEntry?.domains ?? null)
    const signalOpts = repEntry && repEntry.score != null
      ? {
          score: repEntry.score,
          delta: repEntry.delta,
          bestDomain: repBW.bestDomain,
          bestScore: repBW.bestScore,
          worstDomain: repBW.worstDomain,
          worstScore: repBW.worstScore,
          standoutDomain: repEntry.standoutDomain,
          standoutScore: repEntry.standoutScore,
          series: repEntry.series,
        }
      : null
    const representative = signalOpts
      ? {
          id: repEntry!.id,
          name: repEntry!.name,
          score: repEntry!.score!,
          delta: repEntry!.delta,
          direction: repEntry!.direction,
          bestDomain: repBW.bestDomain,
          bestScore: repBW.bestScore,
          worstDomain: repBW.worstDomain,
          worstScore: repBW.worstScore,
          domains: repEntry!.domains,
          comment: buildDailyComment(signalOpts),
          signals: buildDailySignals(signalOpts),
          weekRange: weekScoreRange(signalOpts.score, signalOpts.series),
        }
      : null

    return NextResponse.json({ today, entries: responseEntries, representative, pending })
  } catch (error) {
    console.error('GET /api/saju/daily error:', error)
    return NextResponse.json({ error: 'Failed to fetch daily fortune' }, { status: 500 })
  }
}
