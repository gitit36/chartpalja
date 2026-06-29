/**
 * 공유 카드(OG 이미지 + 공개 공유 페이지 헤더) 공용 계산 유틸.
 *
 * 서버(Node, next/og)와 클라이언트 양쪽에서 import 되므로 DOM/브라우저 API에
 * 의존하지 않는 순수 함수만 둔다. `buildLifeChartData` 도 순수 TS 라 안전하다.
 */
import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload } from '@/types/chart'
import { buildLifeChartData } from '@/lib/saju/life-chart-data'

export interface ShareCard {
  score: number
  delta: number
  deltaPercent: number
  isUp: boolean
  label: string
  desc: string
  emoji: string
  /** 100년 곡선(연도별 세운 점수). 스파크라인/배경 곡선용. */
  sparkData: number[]
  /** sparkData 내 올해 인덱스 (-1 이면 없음) */
  currentIdx: number
}

type StockEntry = { label: string; desc: string; emoji: string }

/**
 * 점수·추세로 "○○ 같은 △△주" 메타포를 고른다.
 * (개인 사주 상세 페이지의 pickStock 과 동일 기준 — 수신자가 보는 텍스트가
 *  소유자가 본 화면과 일치하도록 유지한다.)
 */
function pickStock(score: number, delta: number): StockEntry {
  const isRising = delta > 3
  const isFalling = delta < -3

  if (score >= 95) return { label: '엔비디아 같은 초고성장 모멘텀주', desc: '폭발적 상승 구간, 지금이 전성기', emoji: '🚀' }
  if (score >= 90) {
    if (isRising) return { label: '테슬라 같은 혁신 고성장주', desc: '가속 붙은 강한 상승세', emoji: '🚀' }
    return { label: '아마존 같은 메가트렌드주', desc: '큰 흐름 위에 올라탄 시기', emoji: '🚀' }
  }
  if (score >= 85) {
    if (isRising) return { label: '애플 같은 대형 퀄리티주', desc: '안정 속 꾸준한 상승세', emoji: '📈' }
    if (isFalling) return { label: '구글 같은 플랫폼 독점주', desc: '높은 위치에서 조정 중, 기반은 탄탄', emoji: '📈' }
    return { label: '마이크로소프트 같은 장기복리주', desc: '꾸준히 우상향하는 안정 궤도', emoji: '📈' }
  }
  if (score >= 80) {
    if (isRising) return { label: '코스트코 같은 고ROE 실적주', desc: '실적이 뒷받침하는 상승 흐름', emoji: '📈' }
    return { label: '비자 같은 현금흐름 우량주', desc: '조용하지만 확실한 성장 경로', emoji: '📈' }
  }
  if (score >= 75) {
    if (isRising) return { label: '스타벅스 같은 배당성장주', desc: '안정적 기반 위에 성장 가속', emoji: '📊' }
    if (isFalling) return { label: '나이키 같은 글로벌 소비재주', desc: '일시적 둔화, 브랜드 파워는 건재', emoji: '📊' }
    return { label: '존슨앤존슨 같은 디펜시브 우량주', desc: '흔들려도 방향은 유지', emoji: '📊' }
  }
  if (score >= 70) {
    if (isRising) return { label: '맥도날드 같은 방어주', desc: '흔들림 속에서도 꾸준한 반등 조짐', emoji: '📊' }
    if (isFalling) return { label: '월마트 같은 내수 안정주', desc: '하락 폭 제한적, 바닥이 단단함', emoji: '📊' }
    return { label: 'P&G 같은 로우베타 안정주', desc: '변동성 낮은 안전 항해 구간', emoji: '📊' }
  }
  if (score >= 65) {
    if (isRising) return { label: '코카콜라 같은 고배당주', desc: '바닥을 지나 서서히 올라가는 중', emoji: '📊' }
    return { label: '펩시 같은 안정 인컴주', desc: '큰 점프는 없지만 안정적 흐름', emoji: '📊' }
  }
  if (score >= 60) {
    if (isRising) return { label: '리얼티인컴 같은 리츠(REITs)', desc: '회복세 진입, 속도보단 방향이 중요', emoji: '🏢' }
    if (isFalling) return { label: 'AT&T 같은 고배당 가치주', desc: '하락 압력 있지만 배당이 버팀목', emoji: '🏢' }
    return { label: '리츠 같은 인컴주', desc: '속도보단 안정 수익 흐름', emoji: '🏢' }
  }
  if (score >= 55) {
    if (isRising) return { label: '인텔 같은 턴어라운드주', desc: '반등을 준비하는 시기', emoji: '🔄' }
    return { label: 'IBM 같은 사이클 전환주', desc: '바닥 근처, 전환점을 기다리는 중', emoji: '🔄' }
  }
  if (score >= 50) {
    if (isRising) return { label: '포드 같은 경기민감 회복주', desc: '사이클이 돌기 시작하는 구간', emoji: '🔄' }
    return { label: '시티그룹 같은 저PBR 금융주', desc: '저평가 구간, 인내의 시기', emoji: '🔄' }
  }
  if (score >= 45) {
    if (isRising) return { label: 'GE 같은 구조조정 후 회복주', desc: '최악은 지났고, 회복 신호가 보임', emoji: '🔧' }
    return { label: '구조조정 중인 가치주', desc: '기다림이 필요한 시기, 기반 재정비 중', emoji: '🔧' }
  }
  if (score >= 40) {
    if (isRising) return { label: '스핀오프 직후 독립 성장주', desc: '새 출발, 아직 방향을 잡는 중', emoji: '🔧' }
    return { label: '저부채 자산주', desc: '보이지 않는 가치가 축적되는 시기', emoji: '🔧' }
  }
  if (score >= 35) return { label: '바닥을 다지는 디스카운트주', desc: '가장 어두울 때가 새벽 직전', emoji: '⏳' }
  if (isRising) return { label: '극초기 스몰캡 성장주', desc: '바닥에서 반등 에너지가 모이는 중', emoji: '⏳' }
  return { label: '겨울잠 중인 니치마켓주', desc: '지금은 쉬는 구간, 다음 시즌을 준비', emoji: '⏳' }
}

/** sajuReportJson + 출생연도 → 공유 카드 데이터. 데이터가 없으면 null. */
export function buildShareCard(report: SajuReportJson | null, birthYear: number | null): ShareCard | null {
  if (!report || !birthYear) return null
  const chartPayload = report.chartData as ChartPayload | undefined
  const lifeChart = buildLifeChartData(chartPayload, report, birthYear)
  if (!lifeChart?.data?.length) return null

  const thisYear = new Date().getFullYear()
  const current = lifeChart.data.find(d => d.year === thisYear)
  const prev = lifeChart.data.find(d => d.year === thisYear - 1)
  if (!current) return null

  const score = Math.round(current.score)
  const prevScore = prev ? Math.round(prev.score) : score
  const delta = score - prevScore
  const deltaPercent = prevScore > 0 ? Math.round((delta / prevScore) * 1000) / 10 : 0
  const match = pickStock(score, delta)
  const sparkData = lifeChart.data.map(d => Math.round(d.score))
  const currentIdx = lifeChart.data.findIndex(d => d.year === thisYear)

  return {
    score,
    delta,
    deltaPercent,
    isUp: delta >= 0,
    label: match.label,
    desc: match.desc,
    emoji: match.emoji,
    sparkData,
    currentIdx,
  }
}

/**
 * sparkData → 부드러운 곡선 SVG path (Catmull-Rom 근사). 가로 w, 세로 h 박스 기준.
 * line/area 둘 다 반환. 점이 2개 미만이면 빈 문자열.
 */
export function buildSparkPath(
  sparkData: number[],
  w: number,
  h: number,
  pad = 2
): { line: string; area: string; points: { x: number; y: number }[] } {
  if (sparkData.length < 2) return { line: '', area: '', points: [] }
  const min = Math.min(...sparkData)
  const max = Math.max(...sparkData)
  const range = max - min || 1
  const pts = sparkData.map((v, i) => ({
    x: (i / (sparkData.length - 1)) * w,
    y: pad + (h - 2 * pad) - ((v - min) / range) * (h - 2 * pad),
  }))

  const n = pts.length
  const tangents: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    if (i === 0) tangents.push({ x: pts[1]!.x - pts[0]!.x, y: pts[1]!.y - pts[0]!.y })
    else if (i === n - 1) tangents.push({ x: pts[n - 1]!.x - pts[n - 2]!.x, y: pts[n - 1]!.y - pts[n - 2]!.y })
    else {
      const s0 = (pts[i]!.y - pts[i - 1]!.y) / (pts[i]!.x - pts[i - 1]!.x || 1)
      const s1 = (pts[i + 1]!.y - pts[i]!.y) / (pts[i + 1]!.x - pts[i]!.x || 1)
      const m = (s0 + s1) / 2
      const dx = pts[i + 1]!.x - pts[i - 1]!.x
      tangents.push({ x: dx / 2, y: (m * dx) / 2 })
    }
  }

  let line = `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i]!, p1 = pts[i + 1]!
    const t0 = tangents[i]!, t1 = tangents[i + 1]!
    const cp1x = p0.x + t0.x / 3, cp1y = p0.y + t0.y / 3
    const cp2x = p1.x - t1.x / 3, cp2y = p1.y - t1.y / 3
    line += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`
  }
  const area = `${line} L${pts[n - 1]!.x.toFixed(1)},${h} L${pts[0]!.x.toFixed(1)},${h} Z`
  return { line, area, points: pts }
}
