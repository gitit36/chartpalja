/**
 * 리스트/차트 공용 — 오늘 중심 7일 일운 → ChartDatum.
 */
import type { ChartDatum } from '@/lib/saju/life-chart-data'
import { kstCenteredWeekDates, kstRecentDates } from '@/lib/saju/daily-util'
import type { DomainScores, DailyChartIndicators } from '@/lib/saju/daily-fortune'
import type { WeekSeriesDay, WeekSeriesPayload } from '@/lib/saju/hydrate-week-series'

/** X축 틱 — 1..7 (오늘 = 4) */
export const WEEK_TICKS = [1, 2, 3, 4, 5, 6, 7] as const
export const WEEK_X_DOMAIN: [number, number] = [0.5, 7.5]
export { WEEK_TODAY_X } from '@/lib/saju/daily-util'

const SHORT = ['월', '화', '수', '목', '금', '토', '일'] as const
const FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const

/** YYYY-MM-DD → 월요일 … */
export function weekdayLabelFromDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return FULL[dt.getUTCDay()] ?? dateStr
}

export function weekdayShortFromDate(dateStr: string): string {
  const full = weekdayLabelFromDate(dateStr)
  return full.replace('요일', '') || full
}

/** 도메인 0~100 → ChartDatum 0~10 (domainValue ×10 = 0~100) */
function dom10(domains: DomainScores | null | undefined, key: keyof DomainScores): number {
  const v = domains?.[key]
  if (typeof v !== 'number') return 0
  return Math.max(0, Math.min(10, v / 10))
}

function dayToDatum(x: number, day: WeekSeriesDay): ChartDatum {
  const s = Math.round(day.score ?? 0)
  const chart: DailyChartIndicators = day.chart ?? {
    yongshinPower: 0,
    energyTotal: 0,
    energyDirection: 0,
    noblePower: 0,
    ohangBalance: 0.5,
    unseongCurve: 0,
  }
  const domains = day.domains
  const dayLabel = weekdayLabelFromDate(day.date)
  const tengo = chart.tengo
  const events = chart.events
  return {
    year: x,
    age: 0,
    open: s,
    close: s,
    high: s,
    low: s,
    candleType: '양봉',
    score: s,
    trend: s,
    yongshinPower: chart.yongshinPower,
    energyTotal: chart.energyTotal,
    energyDirection: chart.energyDirection,
    noblePower: chart.noblePower,
    ohangBalance: chart.ohangBalance,
    unseongCurve: chart.unseongCurve,
    tengo비겁: tengo?.비겁 ?? 0,
    tengo식상: tengo?.식상 ?? 0,
    tengo재성: tengo?.재성 ?? 0,
    tengo관살: tengo?.관살 ?? 0,
    tengo인성: tengo?.인성 ?? 0,
    domainJob: dom10(domains, '직업'),
    domainWealth: dom10(domains, '재물'),
    domainHealth: dom10(domains, '건강'),
    domainLove: dom10(domains, '연애'),
    // 일운에 결혼 도메인 없음 → 대인으로 대체
    domainMarriage: dom10(domains, '대인'),
    daewoonPillar: '',
    sewoonPillar: day.date,
    grade: day.grade ?? '',
    seasonTag: day.seasonTag ?? '',
    seasonEmoji: day.seasonEmoji ?? '',
    seasonDesc: day.seasonDesc ?? '',
    eventCareer: events?.이직_전환 ?? 0,
    eventLove: events?.연애_결혼 ?? 0,
    eventHealth: events?.건강_주의 ?? 0,
    eventWealth: events?.재물_기회 ?? 0,
    eventStudy: events?.학업_시험 ?? 0,
    eventConflict: events?.대인_갈등 ?? 0,
    dayLabel,
  }
}

/**
 * rolling/캘린더 날짜 매핑 — 폴백용 (점수만).
 */
export function buildWeekChartData(
  series: (number | null)[],
  recentDates?: string[],
  weekDates: string[] = kstCenteredWeekDates(),
): ChartDatum[] {
  const ds = recentDates?.length === series.length ? recentDates : kstRecentDates(series.length || 7)
  const byDate = new Map<string, number>()
  for (let i = 0; i < series.length; i++) {
    const v = series[i]
    if (v == null || Number.isNaN(v)) continue
    byDate.set(ds[i]!, v)
  }
  const out: ChartDatum[] = []
  for (let i = 0; i < weekDates.length; i++) {
    const dateStr = weekDates[i]!
    const v = byDate.get(dateStr)
    if (v == null) continue
    out.push(dayToDatum(i + 1, { date: dateStr, score: v }))
  }
  return out
}

/** API hydrate → ChartDatum[] (도메인·보조지표 포함). 미래일 점수 null이면 생략하지 않고 연결용으로 스킵 */
export function buildWeekChartFromHydrated(
  weekSeries: WeekSeriesPayload | { dates: string[]; scores: (number | null)[]; days?: WeekSeriesDay[] } | null | undefined,
): ChartDatum[] {
  if (!weekSeries?.dates?.length) return []
  const out: ChartDatum[] = []
  for (let i = 0; i < weekSeries.dates.length; i++) {
    const date = weekSeries.dates[i]!
    const rich = weekSeries.days?.[i]
    const score = rich?.score ?? weekSeries.scores?.[i] ?? null
    if (score == null || Number.isNaN(score)) continue
    out.push(dayToDatum(i + 1, rich ?? { date, score }))
  }
  return out
}

export function weekTickLabel(weekData: ChartDatum[], x: number): string {
  const d = weekData.find((p) => p.year === Math.round(x))
  if (d?.dayLabel) return d.dayLabel.replace('요일', '')
  if (d?.sewoonPillar) return weekdayShortFromDate(d.sewoonPillar)
  return SHORT[Math.round(x) - 1] ?? String(x)
}

export function weekFullLabel(x: number, weekData?: ChartDatum[]): string {
  const d = weekData?.find((p) => p.year === Math.round(x))
  if (d?.dayLabel) return d.dayLabel
  if (d?.sewoonPillar) return weekdayLabelFromDate(d.sewoonPillar)
  return String(x)
}

/** 전체 뷰 X축 — 시작~끝 사이 균등 연도 틱 */
export function evenYearTicks(data: { year: number }[], count = 8): number[] {
  if (!data.length) return []
  const start = data[0]!.year
  const end = data[data.length - 1]!.year
  if (end <= start) return [start]
  const n = Math.max(2, Math.min(count, end - start + 1))
  const ticks: number[] = []
  for (let i = 0; i < n; i++) {
    ticks.push(Math.round(start + ((end - start) * i) / (n - 1)))
  }
  return [...new Set(ticks)]
}
