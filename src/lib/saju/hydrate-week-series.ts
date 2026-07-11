/**
 * GET /api/saju/[id] 응답용 — 오늘 중심 7일(±3) 일운 시리즈 hydrate.
 * DB DailyFortune 캐시 우선, 빈 날짜는 엔진으로 채운다(미래 3일 포함).
 */
import { prisma } from '@/lib/db/prisma'
import { kstCenteredWeekDates } from '@/lib/saju/daily-util'
import {
  computeDailyFortunes,
  extractYongshinOverride,
  type DailyChartIndicators,
  type DailyComputeEntry,
  type DomainScores,
} from '@/lib/saju/daily-fortune'

export interface WeekSeriesDay {
  date: string
  score: number | null
  grade?: string
  seasonTag?: string
  seasonEmoji?: string
  seasonDesc?: string
  domains?: DomainScores | null
  chart?: DailyChartIndicators | null
}

export interface WeekSeriesPayload {
  /** 오늘 중심 7일 YYYY-MM-DD (index 0 = 3일 전 … 3 = 오늘 … 6 = 3일 후) */
  dates: string[]
  scores: (number | null)[]
  /** dates와 동일 길이 — 도메인·보조지표 */
  days: WeekSeriesDay[]
  /** 오늘 X (1-based) = 4 */
  todayIndex: number
}

type EntryForDaily = {
  id: string
  birthDate: string
  birthTime: string | null
  timeUnknown: boolean
  gender: string
  isLunar: boolean
  isLeapMonth: boolean
  sajuReportJson: unknown
}

type CacheRow = {
  date: string
  score: number
  grade: string
  seasonTag: string | null
  seasonEmoji: string | null
  domainsJson: unknown
}

function packDomainsJson(domains: DomainScores, chart?: DailyChartIndicators | null, seasonDesc?: string): object {
  const out: Record<string, unknown> = { ...domains }
  if (chart || seasonDesc) {
    out.__chart = { ...(chart ?? {}), ...(seasonDesc ? { seasonDesc } : {}) }
  }
  return out
}

function unpackChart(meta: Partial<DailyChartIndicators> & { seasonDesc?: string } | undefined): DailyChartIndicators | null {
  if (!meta) return null
  const tengo = meta.tengo
  const events = meta.events
  return {
    v: typeof meta.v === 'number' ? meta.v : undefined,
    yongshinPower: Number(meta.yongshinPower) || 0,
    energyTotal: Number(meta.energyTotal) || 0,
    energyDirection: Number(meta.energyDirection) || 0,
    noblePower: Number(meta.noblePower) || 0,
    ohangBalance: typeof meta.ohangBalance === 'number' ? meta.ohangBalance : 0.5,
    unseongCurve: Number(meta.unseongCurve) || 0,
    tengo: tengo
      ? {
          비겁: Number(tengo.비겁) || 0,
          식상: Number(tengo.식상) || 0,
          재성: Number(tengo.재성) || 0,
          관살: Number(tengo.관살) || 0,
          인성: Number(tengo.인성) || 0,
        }
      : undefined,
    events: events
      ? {
          이직_전환: Number(events.이직_전환) || 0,
          연애_결혼: Number(events.연애_결혼) || 0,
          건강_주의: Number(events.건강_주의) || 0,
          재물_기회: Number(events.재물_기회) || 0,
          학업_시험: Number(events.학업_시험) || 0,
          대인_갈등: Number(events.대인_갈등) || 0,
        }
      : undefined,
  }
}

function unpackRow(row: CacheRow): WeekSeriesDay {
  const raw = (row.domainsJson && typeof row.domainsJson === 'object')
    ? (row.domainsJson as Record<string, unknown>)
    : {}
  const domains: DomainScores = {}
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_')) continue
    if (typeof v === 'number') domains[k as keyof DomainScores] = v
  }
  const meta = raw.__chart as (Partial<DailyChartIndicators> & { seasonDesc?: string }) | undefined
  const chart = unpackChart(meta)
  return {
    date: row.date,
    score: row.score,
    grade: row.grade,
    seasonTag: row.seasonTag ?? undefined,
    seasonEmoji: row.seasonEmoji ?? undefined,
    seasonDesc: typeof meta?.seasonDesc === 'string' ? meta.seasonDesc : undefined,
    domains: Object.keys(domains).length ? domains : null,
    chart,
  }
}

function needsChartRefresh(row: CacheRow | undefined): boolean {
  if (!row) return true
  const raw = row.domainsJson
  if (!raw || typeof raw !== 'object') return true
  const chart = (raw as { __chart?: { v?: number; tengo?: unknown } }).__chart
  if (!chart || typeof chart !== 'object') return true
  // v2 = 십성·이벤트 포함. 옛 __chart 만 있으면 재계산.
  return chart.v !== 2 || !chart.tengo
}

export async function hydrateWeekSeries(entry: EntryForDaily): Promise<WeekSeriesPayload> {
  const dates = kstCenteredWeekDates()
  const cached = await prisma.dailyFortune.findMany({
    where: { entryId: entry.id, date: { in: dates } },
  })
  const byDate = new Map(cached.map((r) => [r.date, r as CacheRow]))

  // 점수만 있거나 옛 __chart(십성·이벤트 없음)면 재계산
  const missing = dates.filter((d) => needsChartRefresh(byDate.get(d)))

  if (missing.length > 0) {
    const computeEntry: DailyComputeEntry = {
      id: entry.id,
      birthDate: entry.birthDate,
      birthTime: entry.birthTime,
      timeUnknown: entry.timeUnknown,
      gender: entry.gender,
      isLunar: entry.isLunar,
      isLeapMonth: entry.isLeapMonth,
      yongshinOverride: extractYongshinOverride(entry.sajuReportJson),
    }
    const computed = computeDailyFortunes([computeEntry], missing)
    const rows: {
      entryId: string
      date: string
      score: number
      grade: string
      seasonTag: string | null
      seasonEmoji: string | null
      domainsJson: object
    }[] = []
    for (const date of missing) {
      const s = computed[entry.id]?.[date]
      if (!s) continue
      const domains = (s.domains ?? {}) as DomainScores
      const packed = packDomainsJson(domains, s.chart, s.seasonDesc)
      const row: CacheRow = {
        date,
        score: s.score,
        grade: s.grade,
        seasonTag: s.seasonTag || null,
        seasonEmoji: s.seasonEmoji || null,
        domainsJson: packed,
      }
      byDate.set(date, row)
      rows.push({
        entryId: entry.id,
        date,
        score: s.score,
        grade: s.grade,
        seasonTag: s.seasonTag || null,
        seasonEmoji: s.seasonEmoji || null,
        domainsJson: packed,
      })
    }
    if (rows.length > 0) {
      // 재계산 분은 upsert — 옛 캐시(지표 없음) 덮어쓰기
      for (const r of rows) {
        await prisma.dailyFortune.upsert({
          where: { entryId_date: { entryId: r.entryId, date: r.date } },
          create: r,
          update: {
            score: r.score,
            grade: r.grade,
            seasonTag: r.seasonTag,
            seasonEmoji: r.seasonEmoji,
            domainsJson: r.domainsJson,
          },
        })
      }
    }
  }

  const days: WeekSeriesDay[] = dates.map((d) => {
    const row = byDate.get(d)
    if (!row) return { date: d, score: null, domains: null, chart: null }
    return unpackRow(row)
  })

  return {
    dates,
    scores: days.map((d) => d.score),
    days,
    todayIndex: 4,
  }
}
