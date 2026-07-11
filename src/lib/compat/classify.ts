import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload } from '@/types/chart'
import { buildLifeChartData } from '@/lib/saju/life-chart-data'
import { COMPAT_TYPES, type CompatType } from './types'

const ELEMENTS = ['木', '火', '土', '金', '水'] as const
type Element = (typeof ELEMENTS)[number]

const STEM_ELEMENT: Record<string, Element> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土',
  庚: '金', 辛: '金', 壬: '水', 癸: '水',
}

const BRANCH_ELEMENT: Record<string, Element> = {
  寅: '木', 卯: '木', 巳: '火', 午: '火', 辰: '土', 戌: '土', 丑: '土', 未: '土',
  申: '金', 酉: '金', 子: '水', 亥: '水',
}

const CLASH_PAIRS = new Set([
  '子午', '午子', '丑未', '未丑', '寅申', '申寅', '卯酉', '酉卯', '辰戌', '戌辰', '巳亥', '亥巳',
])

const HARMONY_PAIRS = new Set([
  '子丑', '丑子', '寅亥', '亥寅', '卯戌', '戌卯', '辰酉', '酉辰', '巳申', '申巳', '午未', '未午',
])

export function getOhangCounts(report: SajuReportJson): Record<Element, number> {
  const counts: Record<Element, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  const raw = report.오행분포 as Record<string, number> | undefined
  if (raw) {
    for (const el of ELEMENTS) {
      counts[el] = raw[el] ?? 0
    }
    return counts
  }
  const wonkuk = report.만세력_사주원국
  const pillars = [wonkuk?.연주, wonkuk?.월주, wonkuk?.일주, wonkuk?.시주].filter(Boolean) as string[]
  for (const p of pillars) {
    const stem = p[0]
    const branch = p[1]
    if (stem && STEM_ELEMENT[stem]) counts[STEM_ELEMENT[stem]] += 1
    if (branch && BRANCH_ELEMENT[branch]) counts[BRANCH_ELEMENT[branch]] += 0.8
  }
  return counts
}

export function complementScore(a: Record<Element, number>, b: Record<Element, number>): number {
  let score = 0
  for (const el of ELEMENTS) {
    const aWeak = a[el] <= 1
    const bStrong = b[el] >= 2.5
    if (aWeak && bStrong) score += 1
    const bWeak = b[el] <= 1
    const aStrong = a[el] >= 2.5
    if (bWeak && aStrong) score += 1
  }
  return Math.min(1, score / 4)
}

function diversityScore(a: Record<Element, number>, b: Record<Element, number>): number {
  let diff = 0
  for (const el of ELEMENTS) {
    diff += Math.abs((a[el] ?? 0) - (b[el] ?? 0))
  }
  const maxDiff = ELEMENTS.length * 4
  return Math.min(1, diff / maxDiff)
}

export function dayPillarMetrics(reportA: SajuReportJson, reportB: SajuReportJson): { clash: number; harmony: number } {
  const dayA = reportA.만세력_사주원국?.일주 ?? ''
  const dayB = reportB.만세력_사주원국?.일주 ?? ''
  if (dayA.length < 2 || dayB.length < 2) return { clash: 0.3, harmony: 0.3 }
  const pair = `${dayA[1]}${dayB[1]}`
  const stemPair = `${dayA[0]}${dayB[0]}`
  let clash = CLASH_PAIRS.has(pair) ? 1 : 0.25
  let harmony = HARMONY_PAIRS.has(pair) ? 1 : 0.2
  if (STEM_ELEMENT[dayA[0]] && STEM_ELEMENT[dayB[0]]) {
    const eA = STEM_ELEMENT[dayA[0]]!
    const eB = STEM_ELEMENT[dayB[0]]!
    const gen: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
    const ctrl: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }
    if (gen[eA] === eB || gen[eB] === eA) harmony = Math.max(harmony, 0.7)
    if (ctrl[eA] === eB || ctrl[eB] === eA) clash = Math.max(clash, 0.65)
  }
  if (CLASH_PAIRS.has(stemPair)) clash = Math.max(clash, 0.5)
  return { clash, harmony }
}

export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return 0
  const x = xs.slice(0, n)
  const y = ys.slice(0, n)
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const a = x[i]! - mx
    const b = y[i]! - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  const den = Math.sqrt(dx * dy)
  return den > 0 ? num / den : 0
}

function volatility(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.min(1, Math.sqrt(variance) / 25)
}

export function alignedScores(
  reportA: SajuReportJson,
  birthYearA: number,
  reportB: SajuReportJson,
  birthYearB: number,
): { scoresA: number[]; scoresB: number[] } {
  const chartA = buildLifeChartData(reportA.chartData as ChartPayload | undefined, reportA, birthYearA)
  const chartB = buildLifeChartData(reportB.chartData as ChartPayload | undefined, reportB, birthYearB)
  if (!chartA?.data?.length || !chartB?.data?.length) return { scoresA: [], scoresB: [] }
  const mapB = new Map(chartB.data.map(d => [d.year, d.score]))
  const scoresA: number[] = []
  const scoresB: number[] = []
  for (const d of chartA.data) {
    const sb = mapB.get(d.year)
    if (sb != null) {
      scoresA.push(d.score)
      scoresB.push(sb)
    }
  }
  return { scoresA, scoresB }
}

/**
 * 궁합은 쌍(pair) 고유값이어야 하므로, 두 사주의 입력 순서를 결정적으로 정규화한다.
 * 사주 여덟 글자(원국) + 출생연도로 안정적인 키를 만들어 정렬하면, A→B 로 넣든
 * B→A 로 넣든 항상 같은 순서로 계산돼 어느 페이지에서 봐도 점수가 일치한다.
 * (키가 같으면 사실상 동일 사주라 순서와 무관하게 대칭)
 */
export function canonicalPairKey(report: SajuReportJson, birthYear: number): string {
  const w = report.만세력_사주원국
  const pillars = `${w?.연주 ?? ''}${w?.월주 ?? ''}${w?.일주 ?? ''}${w?.시주 ?? ''}`
  // 같은 원국·출생연도라도 성별(대운 방향)이 다르면 차트가 달라지므로,
  // 대운 기둥 시퀀스를 덧붙여 순서를 완전히 결정적으로 만든다.
  const cp = report.chartData as ChartPayload | undefined
  const dae = (cp?.대운기둥10 ?? []).map(d => d?.daewoon_pillar ?? '').join('')
  return `${birthYear}|${pillars}|${dae}`
}

export function canonicalizePair(
  reportA: SajuReportJson,
  birthYearA: number,
  reportB: SajuReportJson,
  birthYearB: number,
): { rA: SajuReportJson; byA: number; rB: SajuReportJson; byB: number } {
  const keyA = canonicalPairKey(reportA, birthYearA)
  const keyB = canonicalPairKey(reportB, birthYearB)
  if (keyA <= keyB) return { rA: reportA, byA: birthYearA, rB: reportB, byB: birthYearB }
  return { rA: reportB, byA: birthYearB, rB: reportA, byB: birthYearA }
}

/**
 * 두 사주 리포트로 무료 궁합 유형 6종 중 1개를 분류한다 (v1 휴리스틱).
 */
export function classifyCompat(
  reportA: SajuReportJson,
  birthYearA: number,
  reportB: SajuReportJson,
  birthYearB: number,
): CompatType {
  // 순서 무관(대칭)하게: 쌍 정규화 후 계산.
  const { rA, byA, rB, byB } = canonicalizePair(reportA, birthYearA, reportB, birthYearB)
  const ohangA = getOhangCounts(rA)
  const ohangB = getOhangCounts(rB)
  const complement = complementScore(ohangA, ohangB)
  const diversity = diversityScore(ohangA, ohangB)
  const { clash, harmony } = dayPillarMetrics(rA, rB)
  const { scoresA, scoresB } = alignedScores(rA, byA, rB, byB)
  const corr = pearson(scoresA, scoresB)
  const vol = volatility(scoresA.map((s, i) => Math.abs(s - (scoresB[i] ?? s))))

  const third = Math.max(1, Math.floor(scoresA.length / 3))
  const earlyCorr = pearson(scoresA.slice(0, third), scoresB.slice(0, third))
  const lateCorr = pearson(scoresA.slice(-third), scoresB.slice(-third))
  const upward = lateCorr > earlyCorr + 0.12

  const weights: Record<CompatType, number> = {
    '끌리지만 부딪히는 궁합': clash * 0.55 + (1 - harmony) * 0.25 + vol * 0.2,
    '타이밍이 중요한 궁합': vol * 0.5 + (1 - Math.abs(corr)) * 0.3 + clash * 0.2,
    '서로 채워주는 궁합': complement * 0.5 + harmony * 0.3 + (1 - clash) * 0.2,
    '달라서 끌리는 궁합': complement * 0.35 + diversity * 0.4 + harmony * 0.25,
    '천천히 맞아가는 궁합': upward ? 0.55 + (lateCorr - earlyCorr) : 0,
    '오래 볼수록 좋은 궁합': lateCorr > 0.35 ? lateCorr * 0.6 + corr * 0.4 : corr * 0.35,
  }

  if (clash >= 0.85 && weights['끌리지만 부딪히는 궁합'] >= 0.45) {
    return '끌리지만 부딪히는 궁합'
  }
  if (vol >= 0.55 && weights['타이밍이 중요한 궁합'] >= 0.4) {
    return '타이밍이 중요한 궁합'
  }

  let best: CompatType = COMPAT_TYPES[0]!
  let bestScore = -1
  for (const t of COMPAT_TYPES) {
    const w = weights[t]
    if (w > bestScore) {
      bestScore = w
      best = t
    }
  }
  return best
}
