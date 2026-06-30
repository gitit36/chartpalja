import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload, YearlyDatum } from '@/types/chart'
import { buildLifeChartData } from '@/lib/saju/life-chart-data'
import {
  alignedScores,
  complementScore,
  dayPillarMetrics,
  getOhangCounts,
  pearson,
} from './classify'
import type { CompatEventBand, CompatEventKind, RelationshipYearPoint } from './types'

const ELEMENTS = ['木', '火', '土', '金', '水'] as const
type Element = (typeof ELEMENTS)[number]

export function scoreToDots(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 85) return 5
  if (score >= 70) return 4
  if (score >= 55) return 3
  if (score >= 40) return 2
  return 1
}

export function formatCompatDots(dots: number): string {
  const n = Math.max(1, Math.min(5, Math.round(dots)))
  return '●'.repeat(n) + '○'.repeat(5 - n)
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 50
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.floor((sorted.length - 1) * p)
  return sorted[idx] ?? 50
}

function rollingPearson(xs: number[], ys: number[], i: number, window = 3): number {
  const half = Math.floor(window / 2)
  const start = Math.max(0, i - half)
  const end = Math.min(xs.length, i + half + 1)
  return pearson(xs.slice(start, end), ys.slice(start, end))
}

function yearRelationClashScore(yd: YearlyDatum | undefined, natalHarmony: number, natalClash: number): number {
  let harmony = 0
  let clash = 0
  for (const g of yd?.세운_관계_with_원국 ?? []) {
    for (const r of g.relations ?? []) {
      if (/合|합|삼합|방합/.test(r)) harmony += 1
      if (/冲|충|刑|害|破/.test(r)) clash += 1
    }
  }
  const relBreak = typeof yd?.breakdown?.relations === 'number' ? yd.breakdown.relations : 0
  const h = natalHarmony * 0.35 + Math.min(1, harmony * 0.12) + (relBreak > 0 ? 0.15 : 0)
  const c = natalClash * 0.35 + Math.min(1, clash * 0.12)
  return clamp01(h * 0.65 + (1 - c) * 0.35)
}

function combinedOhangBalance(a: number, b: number): number {
  const combined = clamp01((a + b) / 2)
  return 1 - Math.abs(combined - 0.5) * 2
}

function ohangYearScore(
  ohangA: Record<Element, number>,
  ohangB: Record<Element, number>,
  balanceA: number,
  balanceB: number,
): number {
  const complement = complementScore(ohangA, ohangB)
  const combined = { ...ohangA }
  for (const el of ELEMENTS) {
    combined[el] = (ohangA[el] ?? 0) + (ohangB[el] ?? 0)
  }
  const vals = ELEMENTS.map(el => combined[el] ?? 0)
  const spread = Math.max(...vals) - Math.min(...vals)
  const spreadPenalty = clamp01(spread / 8)
  const balanceBonus = combinedOhangBalance(balanceA, balanceB)
  return clamp01(complement * 0.55 + balanceBonus * 0.25 + (1 - spreadPenalty) * 0.2)
}

function syncYearScore(
  scoresA: number[],
  scoresB: number[],
  i: number,
): number {
  const corr = rollingPearson(scoresA, scoresB, i, 3)
  const corrNorm = clamp01((corr + 1) / 2)
  const prevA = i > 0 ? scoresA[i - 1]! : scoresA[i]!
  const prevB = i > 0 ? scoresB[i - 1]! : scoresB[i]!
  const deltaA = scoresA[i]! - prevA
  const deltaB = scoresB[i]! - prevB
  const sameDir = (deltaA >= 0 && deltaB >= 0) || (deltaA < 0 && deltaB < 0)
  const diverge = Math.abs(deltaA - deltaB) / 30
  let score = corrNorm * 0.7
  if (sameDir && deltaA > 0 && deltaB > 0) score += 0.15
  if (!sameDir) score = score * 0.75 + (1 - clamp01(diverge)) * 0.25
  return clamp01(score)
}

function supportYearScore(
  scoreA: number,
  scoreB: number,
  p40A: number,
  p40B: number,
  eventLoveA: number,
  eventLoveB: number,
  eventConflictA: number,
  eventConflictB: number,
): number {
  const lowA = scoreA < p40A
  const lowB = scoreB < p40B
  let s = 0.5
  if (lowA && scoreB >= 55) s = 0.85
  else if (lowB && scoreA >= 55) s = 0.85
  else if (lowA && lowB) s = 0.2
  else if (!lowA && !lowB) s = 0.65
  const loveAvg = (eventLoveA + eventLoveB) / 2
  const conflictAvg = (eventConflictA + eventConflictB) / 2
  s += (loveAvg / 100) * 0.08 - (conflictAvg / 100) * 0.08
  return clamp01(s)
}

function detectEvents(
  point: RelationshipYearPoint,
  prev: RelationshipYearPoint | null,
  scoresA: number[],
  scoresB: number[],
  years: number[],
  i: number,
  eventLoveA: number[],
  eventLoveB: number[],
  harmonyYears: number[],
  relGoodTh: number,
  relCautionTh: number,
): CompatEventKind[] {
  const events: CompatEventKind[] = []
  const p30A = percentile(scoresA, 0.3)
  const p30B = percentile(scoresB, 0.3)
  const scoreA = point.scoreA
  const scoreB = point.scoreB
  const loveTop = percentile([...eventLoveA, ...eventLoveB], 0.75)
  const diffTop = percentile(years.map((_, j) => Math.abs(scoresA[j]! - scoresB[j]!)), 0.7)

  if (point.score <= relCautionTh || (scoreA < 38 && scoreB < 38)) {
    events.push('caution')
  } else if (point.score >= relGoodTh && scoreA >= p30A && scoreB >= p30B) {
    events.push('good')
  }
  if (eventLoveA[i]! + eventLoveB[i]! >= loveTop * 1.6 && harmonyYears[i]! > 0.55) events.push('closer')
  if (Math.abs(scoreA - scoreB) >= diffTop && rollingPearson(scoresA, scoresB, i, 3) < 0) events.push('drift')
  if (point.components.ohang > 0.62 && prev && point.score - prev.score >= 7) events.push('synergy')
  if ((scoreA < percentile(scoresA, 0.4) && scoreB >= 52) || (scoreB < percentile(scoresB, 0.4) && scoreA >= 52)) {
    events.push('support')
  }

  return events
}

export function buildRelationshipSeries(
  reportA: SajuReportJson,
  birthYearA: number,
  reportB: SajuReportJson,
  birthYearB: number,
): RelationshipYearPoint[] {
  const chartA = buildLifeChartData(reportA.chartData as ChartPayload | undefined, reportA, birthYearA)
  const chartB = buildLifeChartData(reportB.chartData as ChartPayload | undefined, reportB, birthYearB)
  if (!chartA?.data?.length || !chartB?.data?.length) return []

  const payloadA = reportA.chartData as ChartPayload | undefined
  const timelineA = payloadA?.연도별_타임라인 ?? []
  const timelineMap = new Map(timelineA.map(yd => [yd.year, yd]))

  const mapB = new Map(chartB.data.map(d => [d.year, d]))
  const ohangA = getOhangCounts(reportA)
  const ohangB = getOhangCounts(reportB)
  const { harmony: natalHarmony, clash: natalClash } = dayPillarMetrics(reportA, reportB)

  const aligned: Array<{
    year: number
    scoreA: number
    scoreB: number
    balanceA: number
    balanceB: number
    eventLoveA: number
    eventLoveB: number
    eventConflictA: number
    eventConflictB: number
    yd: YearlyDatum | undefined
  }> = []

  for (const d of chartA.data) {
    const ov = mapB.get(d.year)
    if (!ov) continue
    aligned.push({
      year: d.year,
      scoreA: d.score,
      scoreB: ov.score,
      balanceA: d.ohangBalance ?? 0.5,
      balanceB: ov.ohangBalance ?? 0.5,
      eventLoveA: d.eventLove ?? 0,
      eventLoveB: ov.eventLove ?? 0,
      eventConflictA: d.eventConflict ?? 0,
      eventConflictB: ov.eventConflict ?? 0,
      yd: timelineMap.get(d.year),
    })
  }

  if (!aligned.length) return []

  const scoresA = aligned.map(a => a.scoreA)
  const scoresB = aligned.map(a => a.scoreB)
  const p40A = percentile(scoresA, 0.4)
  const p40B = percentile(scoresB, 0.4)
  const eventLoveA = aligned.map(a => a.eventLoveA)
  const eventLoveB = aligned.map(a => a.eventLoveB)
  const harmonyYears = aligned.map(a =>
    yearRelationClashScore(a.yd, natalHarmony, natalClash),
  )

  const points: RelationshipYearPoint[] = aligned.map((row, i) => {
    const sync = syncYearScore(scoresA, scoresB, i)
    const ohang = ohangYearScore(ohangA, ohangB, row.balanceA, row.balanceB)
    const support = supportYearScore(
      row.scoreA, row.scoreB, p40A, p40B,
      row.eventLoveA, row.eventLoveB, row.eventConflictA, row.eventConflictB,
    )
    const clash = yearRelationClashScore(row.yd, natalHarmony, natalClash)
    const raw = 0.30 * ohang + 0.25 * sync + 0.25 * support + 0.20 * clash
    const score = Math.round(clamp01(raw) * 100)
    return {
      year: row.year,
      score,
      dots: scoreToDots(score),
      components: { sync, ohang, support, clash },
      events: [] as CompatEventKind[],
      scoreA: row.scoreA,
      scoreB: row.scoreB,
    }
  })

  const relScores = points.map(p => p.score)
  let relGoodTh = Math.max(56, percentile(relScores, 0.58))
  let relCautionTh = Math.min(48, percentile(relScores, 0.35))
  if (relGoodTh <= relCautionTh) {
    const mid = percentile(relScores, 0.5)
    relGoodTh = mid + 6
    relCautionTh = mid - 6
  }

  for (let i = 0; i < points.length; i++) {
    points[i]!.events = detectEvents(
      points[i]!, points[i - 1] ?? null,
      scoresA, scoresB, aligned.map(a => a.year), i,
      eventLoveA, eventLoveB, harmonyYears,
      relGoodTh, relCautionTh,
    )
  }

  return points
}

export function getRelationshipPointForYear(
  series: RelationshipYearPoint[],
  year: number,
): RelationshipYearPoint | null {
  return series.find(p => p.year === year) ?? null
}

export function buildCompatEventBands(
  series: RelationshipYearPoint[],
  fromYear: number,
): CompatEventBand[] {
  const future = series.filter(p => p.year >= fromYear)
  if (future.length < 1) return []

  const scores = future.map(p => p.score)
  let goodTh = Math.max(56, percentile(scores, 0.58))
  let cautionTh = Math.min(48, percentile(scores, 0.35))
  if (goodTh <= cautionTh) {
    const mid = percentile(scores, 0.5)
    goodTh = mid + 6
    cautionTh = mid - 6
  }

  const bands: CompatEventBand[] = []
  const kinds: Array<{ kind: 'good' | 'caution'; match: (p: RelationshipYearPoint) => boolean }> = [
    { kind: 'good', match: p => p.score >= goodTh && p.score > cautionTh },
    { kind: 'caution', match: p => p.score <= cautionTh },
  ]
  for (const { kind, match } of kinds) {
    let start: number | null = null
    for (const p of future) {
      const has = match(p)
      if (has && start == null) start = p.year
      if (!has && start != null) {
        bands.push({ startYear: start, endYear: p.year - 1, kind })
        start = null
      }
    }
    if (start != null) {
      bands.push({ startYear: start, endYear: future[future.length - 1]!.year, kind })
    }
  }
  return bands
}

export const COMPAT_EVENT_LABELS: Record<CompatEventKind, string> = {
  good: '좋은 시기',
  caution: '주의 시기',
  closer: '가까워짐',
  drift: '엇갈림',
  synergy: '시너지',
  support: '도움 받음',
}
