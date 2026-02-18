/**
 * 인생차트 데이터 빌더.
 * chart_data(ChartPayload)가 있으면 엔진 데이터를 직접 사용하고,
 * 없으면 기존 대운기둥10 + 시드 로직으로 폴백합니다.
 */
import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload, YearlyDatum } from '@/types/chart'
import { pillarToHangul } from './hanja-hangul'

const NUM_YEARS = 86

// ── ChartDatum (캔들 + 보조지표 8종) ──

export type ChartDatum = {
  year: number
  age: number
  // 캔들
  open: number
  close: number
  high: number
  low: number
  candleType: string
  // 기존 호환
  score: number
  trend: number
  // 보조지표
  yongshinPower: number
  energyTotal: number
  energyDirection: number
  noblePower: number
  ohangBalance: number
  unseongCurve: number
  // 십성 (레이더)
  tengo비겁: number
  tengo식상: number
  tengo재성: number
  tengo관살: number
  tengo인성: number
  // 도메인
  domainJob: number
  domainWealth: number
  domainHealth: number
  domainLove: number
  domainMarriage: number
  // 메타
  daewoonPillar: string
  sewoonPillar: string
  grade: string
  seasonTag: string
  seasonEmoji: string
  seasonDesc: string
  // 이벤트확률
  eventCareer: number
  eventLove: number
  eventHealth: number
  eventWealth: number
  eventStudy: number
  eventConflict: number
}

export type DaewoonLabel = {
  year: number
  pillar: string
  grade: string
  score: number
}

export type LifeStage = {
  label: string
  x1: number
  x2: number
  fillOpacity?: number
}

export type SeasonBand = {
  startYear: number
  endYear: number
  tag: string
  emoji: string
}

export type AnnotationItem = { year: number; text: string }

export type LifeChartData = {
  years: number[]
  data: ChartDatum[]
  boundaryYears: number[]
  daewoonLabels: DaewoonLabel[]
  annotations: AnnotationItem[]
  lifeStages: LifeStage[]
  seasonBands: SeasonBand[]
}

// ── 새 엔진 데이터 기반 빌더 ──

function buildFromChartPayload(chartPayload: ChartPayload): LifeChartData {
  const { meta } = chartPayload
  const dwBlocks = chartPayload['대운기둥10']
  const timeline = chartPayload['연도별_타임라인']
  const birthYear = meta.birthYear

  const boundaryYears = dwBlocks.map(dw => dw.start_year)

  const daewoonLabels: DaewoonLabel[] = dwBlocks.map(dw => ({
    year: dw.start_year,
    pillar: dw.daewoon_pillar,
    grade: dw['등급'],
    score: dw['종합운점수'],
  }))

  const dwMap = new Map<number, typeof dwBlocks[number]>()
  for (const dw of dwBlocks) {
    for (let y = dw.start_year; y < dw.end_year; y++) {
      dwMap.set(y, dw)
    }
  }

  const timelineMap = new Map<number, YearlyDatum>()
  for (const yd of timeline) {
    timelineMap.set(yd.year, yd)
  }

  const years: number[] = []
  const data: ChartDatum[] = []

  for (let i = 0; i < NUM_YEARS; i++) {
    const year = birthYear + i
    years.push(year)

    const yd = timelineMap.get(year)
    const dw = dwMap.get(year) ?? dwBlocks[0]
    const trend = dw ? dw['종합운점수'] : 50

    if (yd) {
      const ind = yd.indicators
      const ev = yd['이벤트확률']
      const season = yd['시즌태그']
      data.push({
        year,
        age: yd.age,
        open: yd.candle.open,
        close: yd.candle.close,
        high: yd.candle.high,
        low: yd.candle.low,
        candleType: yd.candle.type,
        score: yd.scores['종합'],
        trend,
        yongshinPower: ind['용신력'],
        energyTotal: ind['에너지장'].total,
        energyDirection: ind['에너지장'].direction,
        noblePower: ind['귀인력'],
        ohangBalance: ind['오행균형도'],
        unseongCurve: ind['12운성곡선'],
        tengo비겁: ind['십성밸런스']['비겁'],
        tengo식상: ind['십성밸런스']['식상'],
        tengo재성: ind['십성밸런스']['재성'],
        tengo관살: ind['십성밸런스']['관살'],
        tengo인성: ind['십성밸런스']['인성'],
        domainJob: yd.scores['직업'],
        domainWealth: yd.scores['재물'],
        domainHealth: yd.scores['건강'],
        domainLove: yd.scores['연애'],
        domainMarriage: yd.scores['결혼'],
        daewoonPillar: yd['대운_pillar'],
        sewoonPillar: yd['세운_pillar'],
        grade: dw ? dw['등급'] : '',
        seasonTag: season.tag,
        seasonEmoji: season.emoji,
        seasonDesc: season.desc,
        eventCareer: ev['이직_전환'],
        eventLove: ev['연애_결혼'],
        eventHealth: ev['건강_주의'],
        eventWealth: ev['재물_기회'],
        eventStudy: ev['학업_시험'],
        eventConflict: ev['대인_갈등'],
      })
    } else {
      data.push(emptyDatum(year, i, trend))
    }
  }

  const annotations: AnnotationItem[] = boundaryYears.slice(1).map((y, i) => ({
    year: y,
    text: dwBlocks[i + 1]!.daewoon_pillar + ' ' + dwBlocks[i + 1]!['등급'],
  }))

  const lifeStages = buildLifeStages(boundaryYears, birthYear)
  const seasonBands = buildSeasonBands(data)

  return { years, data, boundaryYears, daewoonLabels, annotations, lifeStages, seasonBands }
}

// ── 시즌밴드 (연속 같은 시즌태그 구간) ──

function buildSeasonBands(data: ChartDatum[]): SeasonBand[] {
  if (!data.length) return []
  const bands: SeasonBand[] = []
  let cur = { tag: data[0]!.seasonTag, emoji: data[0]!.seasonEmoji, start: data[0]!.year }

  for (let i = 1; i < data.length; i++) {
    const d = data[i]!
    if (d.seasonTag !== cur.tag) {
      bands.push({ startYear: cur.start, endYear: data[i - 1]!.year, tag: cur.tag, emoji: cur.emoji })
      cur = { tag: d.seasonTag, emoji: d.seasonEmoji, start: d.year }
    }
  }
  bands.push({ startYear: cur.start, endYear: data[data.length - 1]!.year, tag: cur.tag, emoji: cur.emoji })
  return bands
}

// ── 빈 데이터 포인트 ──

function emptyDatum(year: number, age: number, trend: number): ChartDatum {
  return {
    year, age,
    open: trend, close: trend, high: trend, low: trend, candleType: '양봉',
    score: trend, trend,
    yongshinPower: 0, energyTotal: 0, energyDirection: 0,
    noblePower: 0, ohangBalance: 0.5, unseongCurve: 0,
    tengo비겁: 0, tengo식상: 0, tengo재성: 0, tengo관살: 0, tengo인성: 0,
    domainJob: 5, domainWealth: 5, domainHealth: 5, domainLove: 5, domainMarriage: 5,
    daewoonPillar: '', sewoonPillar: '', grade: '',
    seasonTag: '평온기', seasonEmoji: '', seasonDesc: '',
    eventCareer: 10, eventLove: 10, eventHealth: 10,
    eventWealth: 10, eventStudy: 10, eventConflict: 10,
  }
}

// ── 기존 (폴백) 로직 ──

const DEFAULT_TREND_BY_PERIOD = [65, 45, 30, 85, 70, 60, 80, 82, 80, 78]

function seed(year: number): number {
  let s = year * 1103515245 + 12345
  s = (s & 0x7fffffff) ^ (s >> 31)
  return (s % 7) - 3
}

function buildLegacy(report: SajuReportJson, birthYear: number): LifeChartData | null {
  const daewoon10 = report?.['대운']?.['대운기둥10']
  if (!daewoon10 || !Array.isArray(daewoon10)) return null

  const rows = daewoon10 as Array<{
    daewoon_pillar?: string
    start_age_years?: number
    end_age_years?: number
  }>

  const boundaryYears: number[] = []
  const daewoonLabels: DaewoonLabel[] = []

  for (const row of rows) {
    const start = row.start_age_years != null ? Math.round(row.start_age_years) : 0
    const yr = birthYear + start
    boundaryYears.push(yr)
    const pillar = row.daewoon_pillar ?? ''
    daewoonLabels.push({
      year: yr,
      pillar: pillar ? pillar + ' (' + pillarToHangul(pillar) + ')' : '',
      grade: '',
      score: DEFAULT_TREND_BY_PERIOD[daewoonLabels.length] ?? 70,
    })
  }

  const years: number[] = []
  for (let i = 0; i < NUM_YEARS; i++) years.push(birthYear + i)

  const periodTrend = DEFAULT_TREND_BY_PERIOD.slice(0, rows.length)
  while (periodTrend.length < 10) periodTrend.push(78)

  const data: ChartDatum[] = years.map((year) => {
    let periodIdx = 0
    for (let p = 1; p < boundaryYears.length; p++) {
      if (year >= boundaryYears[p]!) periodIdx = p
    }
    const trend = periodTrend[periodIdx] ?? 70
    const variation = seed(year)
    const score = Math.max(0, Math.min(100, trend + variation))
    return { ...emptyDatum(year, year - birthYear, trend), score, close: score }
  })

  const annotations: AnnotationItem[] = []
  for (let p = 1; p < boundaryYears.length && p < daewoonLabels.length; p++) {
    const yr = boundaryYears[p]!
    if (yr >= years[0]! && yr <= years[years.length - 1]!) {
      annotations.push({
        year: yr,
        text: (p === 1 ? '대운 시작 ' : '대운 진입 ') + daewoonLabels[p]!.pillar,
      })
    }
  }

  const lifeStages = buildLifeStages(boundaryYears, birthYear)

  return { years, data, boundaryYears, daewoonLabels, annotations, lifeStages, seasonBands: [] }
}

// ── 인생 단계 배경 ──

function buildLifeStages(boundaryYears: number[], birthYear: number): LifeStage[] {
  const lastYear = birthYear + NUM_YEARS - 1
  const stages: LifeStage[] = []

  if (boundaryYears.length >= 4) {
    const wEnd = boundaryYears[3]! - 1
    if (birthYear <= wEnd) {
      stages.push({ label: '겨울: 인내와 연단', x1: birthYear, x2: wEnd, fillOpacity: 0.08 })
    }
  }
  if (boundaryYears.length >= 5) {
    stages.push({ label: '봄: 황금기', x1: boundaryYears[3]!, x2: boundaryYears[4]! - 1, fillOpacity: 0.12 })
  }
  if (boundaryYears.length >= 7) {
    stages.push({ label: '여름: 성공과 위기의 공존', x1: boundaryYears[4]!, x2: boundaryYears[6]! - 1, fillOpacity: 0.08 })
  }
  if (boundaryYears.length >= 7) {
    stages.push({ label: '가을: 수확과 안정', x1: boundaryYears[6]!, x2: lastYear, fillOpacity: 0.08 })
  }

  return stages
}

// ── 통합 진입점 (하위 호환) ──

export function buildLifeChartData(
  chartPayload: ChartPayload | null | undefined,
  report: SajuReportJson | null,
  birthYear: number
): LifeChartData | null {
  if (chartPayload?.['연도별_타임라인']?.length) {
    return buildFromChartPayload(chartPayload)
  }
  if (report) {
    return buildLegacy(report, birthYear)
  }
  return null
}
