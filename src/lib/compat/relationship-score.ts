import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload, YearlyDatum } from '@/types/chart'
import { buildLifeChartData } from '@/lib/saju/life-chart-data'
import {
  alignedScores,
  canonicalizePair,
  complementScore,
  dayPillarMetrics,
  getOhangCounts,
  pearson,
} from './classify'
import type {
  CompatArchetype,
  CompatCardData,
  CompatEventBand,
  CompatEventKind,
  CompatSpectrum,
  RelationshipYearPoint,
  YearCompatLevel,
} from './types'

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

/**
 * 관계 점수 성분 가중치 (관계 유형 중립 기본값).
 * - clash(합·충 조화): 전통 사주 궁합의 핵심 신호 → 가장 크게(0.45).
 * - ohang(오행 보완) / support(상생): 구조적 궁합 축 → 그다음(각 0.25).
 * - sync(인생운 동조): "두 사람 개인운이 같은 시점에 오르내렸나"일 뿐 관계의 질과
 *   상관이 약하고 오히려 서사를 오판(예: 이별 시기를 '좋음'으로)시켜 최소로(0.05).
 * 연도 점수와 헤드라인이 반드시 같은 가중치를 쓰도록 이 상수를 공유한다.
 */
export const RELATIONSHIP_WEIGHTS = { ohang: 0.25, sync: 0.05, support: 0.25, clash: 0.45 } as const

function combineRaw(c: { ohang: number; sync: number; support: number; clash: number }): number {
  const w = RELATIONSHIP_WEIGHTS
  return w.ohang * c.ohang + w.sync * c.sync + w.support * c.support + w.clash * c.clash
}

/**
 * 원시 가중합(0~1)을 사람이 읽기 좋은 궁합 점수(0~100)로 재매핑한다.
 * 성분 특성상 raw 는 좁은 구간에 몰려 그대로 ×100 하면 전부 40점대가 된다.
 * 로지스틱으로 중립(≈모집단 중앙값 0.48)을 ~60점으로 올리고 양끝을 넓게 펴 분포를 살린다.
 * 단조 증가이므로 연도 간 상대 순위(좋음/주의 백분위)는 보존된다.
 */
function calibrateRelScore(raw01: number): number {
  const k = 8
  const x0 = 0.42
  const s = 1 / (1 + Math.exp(-k * (clamp01(raw01) - x0)))
  return Math.round(clamp01(s) * 100)
}

/**
 * 궁합 성분/헤드라인 모집단 분포 (3160 페어 샘플, 2026-07 기준).
 * 각 축·헤드라인을 "다른 커플 대비 어디쯤인가"의 상대 위치로 펴는 기준값이다.
 * 원시값은 축마다 평균·폭이 제각각(예: lean 은 0.63에 몰려 std 0.06)이라
 * 그대로 표시하면 커플 간 차이가 안 보인다 → z-점수로 재중심(평균→0.5)·확대한다.
 */
const POP = {
  energy: { mean: 0.320, std: 0.128 },
  rhythm: { mean: 0.444, std: 0.106 },
  lean: { mean: 0.633, std: 0.059 },
  temp: { mean: 0.520, std: 0.092 },
  // raw 는 RELATIONSHIP_WEIGHTS(0.25/0.05/0.25/0.45) 기준 3160 페어 샘플 분포.
  raw: { mean: 0.477, std: 0.056 },
} as const

// 축 정규화 폭: ±2σ 를 [0,1] 양끝에 매핑(값이 클수록 완만).
const AXIS_SPREAD = 4

/** 원시 축 값을 모집단 기준 상대 위치(0~1, 평균=0.5)로 재매핑한다. */
function normAxis(value: number, m: number, s: number): number {
  return clamp01(0.5 + (value - m) / (s * AXIS_SPREAD))
}

/**
 * 커플 평균 원시 궁합값을 모집단 대비 헤드라인 점수(0~100)로 변환.
 * rawMean 은 커플 간 std 가 0.05 수준으로 촘촘해 그대로 쓰면 전부 60점대에 몰린다.
 * z-점수를 넓게 펴 사람마다 뚜렷한 차이가 나게 하되, 소비자용 궁합 지표답게
 * 중심을 넉넉히(모집단 중앙값 → 72점) 잡아 평균 이하인 사람도 기죽지 않게 한다.
 * (±1σ≈±14점, 대체로 45~95 범위)
 */
function headlineScore(rawMean: number): number {
  const z = (rawMean - POP.raw.mean) / POP.raw.std
  return Math.round(Math.max(40, Math.min(98, 72 + z * 14)))
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
  // 궁합 점수는 쌍(pair) 고유값이어야 하므로 입력 순서를 정규화한다.
  // (어느 쪽 사주 페이지에서 봐도 동일한 점수가 나오도록. scoreA/scoreB 역할은
  //  표시에 쓰이지 않고 내부 계산용이라 순서를 바꿔도 안전하다.)
  const { rA, byA, rB, byB } = canonicalizePair(reportA, birthYearA, reportB, birthYearB)
  const chartA = buildLifeChartData(rA.chartData as ChartPayload | undefined, rA, byA)
  const chartB = buildLifeChartData(rB.chartData as ChartPayload | undefined, rB, byB)
  if (!chartA?.data?.length || !chartB?.data?.length) return []

  const payloadA = rA.chartData as ChartPayload | undefined
  const timelineA = payloadA?.연도별_타임라인 ?? []
  const timelineMap = new Map(timelineA.map(yd => [yd.year, yd]))

  const mapB = new Map(chartB.data.map(d => [d.year, d]))
  const ohangA = getOhangCounts(rA)
  const ohangB = getOhangCounts(rB)
  const { harmony: natalHarmony, clash: natalClash } = dayPillarMetrics(rA, rB)

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
    const raw = combineRaw({ ohang, sync, support, clash })
    const score = calibrateRelScore(raw)
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

export const YEAR_LEVEL_LABELS: Record<YearCompatLevel, string> = {
  good: '좋음',
  normal: '보통',
  caution: '주의',
}

/**
 * 연도별 관계 수준 3단계(좋음/보통/주의).
 * 전체 시리즈 점수 분포 기준의 상대 임계치를 사용해 색이 항상 나타나게 한다.
 * — 하단 리듬 바 / 툴팁에서 공용으로 사용.
 */
export function buildYearLevels(series: RelationshipYearPoint[]): Map<number, YearCompatLevel> {
  const map = new Map<number, YearCompatLevel>()
  if (!series.length) return map
  const scores = series.map(p => p.score)
  // 순수 백분위: 상위 1/3 = 좋음, 하위 1/3 = 주의, 중간 = 보통.
  // 커플의 절대 점수대가 낮아도 좋음/주의가 균형 있게 잡히도록 상대 기준만 사용한다.
  let goodTh = percentile(scores, 0.66)
  let cautionTh = percentile(scores, 0.34)
  if (goodTh <= cautionTh) {
    const mid = percentile(scores, 0.5)
    goodTh = mid + 4
    cautionTh = mid - 4
  }
  for (const p of series) {
    const level: YearCompatLevel = p.score >= goodTh ? 'good' : p.score <= cautionTh ? 'caution' : 'normal'
    map.set(p.year, level)
  }
  return map
}

function pickArchetype(v: { energy: number; rhythm: number; lean: number; temp: number }): CompatArchetype {
  const { energy, rhythm, lean, temp } = v
  // 우선순위: 뚜렷한 축부터 라벨을 부여한다.
  if (lean >= 0.7) return { category: '이끔형', label: '기대는 언덕이 되어주는 사이' }
  if (temp >= 0.62 && rhythm < 0.45) return { category: '자극형', label: '부딪히며 크는 사이' }
  if (energy >= 0.6 && rhythm >= 0.55) return { category: '팀형', label: '서로의 빈칸을 채우는 사이' }
  if (energy >= 0.6 && temp >= 0.55) return { category: '매력형', label: '달라서 끌리는 사이' }
  if (temp < 0.45 && rhythm >= 0.55) return { category: '동행형', label: '나란히 함께 걷는 사이' }
  if (temp < 0.45) return { category: '안정형', label: '곁에 있으면 편안한 사이' }
  if (rhythm >= 0.55) return { category: '동행형', label: '리듬이 잘 맞는 사이' }
  return { category: '균형형', label: '천천히 맞아가는 사이' }
}

/**
 * 관계 케미 카드의 코어 데이터.
 * 관계 유형(연애/친구/비즈니스/가족)과 무관하게 두 사주만으로 결정된다.
 * 유형 선택은 유료 해설의 서술 초점에만 반영되고, 이 값들은 바뀌지 않는다.
 */
export function buildCompatCard(series: RelationshipYearPoint[]): CompatCardData | null {
  if (!series.length) return null
  const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0)

  // 커플 평균 원시 성분값 → 모집단 대비 상대 위치로 재매핑(축 간 차이가 보이도록).
  const engRaw = mean(series.map(p => p.components.ohang))
  const rhyRaw = mean(series.map(p => p.components.sync))
  const leaRaw = mean(series.map(p => p.components.support))
  const clashRaw = mean(series.map(p => p.components.clash))
  const rawMean = combineRaw({ ohang: engRaw, sync: rhyRaw, support: leaRaw, clash: clashRaw })

  const overallScore = headlineScore(rawMean)
  const energy = normAxis(engRaw, POP.energy.mean, POP.energy.std)
  const rhythm = normAxis(rhyRaw, POP.rhythm.mean, POP.rhythm.std)
  const lean = normAxis(leaRaw, POP.lean.mean, POP.lean.std)
  // components.clash 는 조화(harmony)가 높을수록 큰 값 → 온도(자극도)는 그 반대.
  const temp = normAxis(1 - clashRaw, POP.temp.mean, POP.temp.std)

  const spectrums: CompatSpectrum[] = [
    { key: 'energy', title: '에너지 궁합', leftLabel: '닮은 결', rightLabel: '보완의 결', caption: '성향이 비슷한지, 부족한 걸 서로 채우는지', value: energy },
    { key: 'rhythm', title: '인생 리듬', leftLabel: '따로 리듬', rightLabel: '함께 리듬', caption: '좋을 때·힘들 때 타이밍이 겹치는지', value: rhythm },
    { key: 'lean', title: '기대는 방향', leftLabel: '서로 받쳐줌', rightLabel: '한쪽이 이끎', caption: '힘을 주고받는 균형', value: lean },
    { key: 'temp', title: '관계 온도', leftLabel: '편안·안정', rightLabel: '자극·긴장', caption: '무난하게 편한지, 부딪히며 끌리는지', value: temp },
  ]

  const levels = buildYearLevels(series)
  const now = new Date().getFullYear()
  const goodYears = series.filter(p => p.year >= now && levels.get(p.year) === 'good').map(p => p.year)
  const cautionYears = series.filter(p => p.year >= now && levels.get(p.year) === 'caution').map(p => p.year)
  const archetype = pickArchetype({ energy, rhythm, lean, temp })

  return { overallScore, archetype, spectrums, goodYears, cautionYears }
}
