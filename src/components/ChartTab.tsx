'use client'

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import {
  ResponsiveContainer, ComposedChart, LineChart, BarChart, AreaChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Line, Bar, Area, XAxis, YAxis, Tooltip,
  ReferenceArea, ReferenceLine, Cell, Customized,
} from 'recharts'
import type { SajuReportJson } from '@/types/saju-report'
import { SajuCharacterAvatar, normalizeElement } from '@/components/SajuCharacterAvatar'
import { BottomSheet } from '@/components/BottomSheet'
import type { ChartPayload, ScoreBreakdown } from '@/types/chart'
import { buildLifeChartData } from '@/lib/saju/life-chart-data'
import type { ChartDatum, SeasonBand } from '@/lib/saju/life-chart-data'
import { pillarToHangul } from '@/lib/saju/hanja-hangul'
import { getGuestId } from '@/lib/auth/guest'
import { LockedPreview } from '@/components/LockedPreview'
import { JuShortageNudge } from '@/components/JuShortageNudge'
import { InfoTip } from '@/components/InfoTip'
import { READING_COST } from '@/lib/payment/products'
import { classifyCompat } from '@/lib/compat/classify'
import { listCompatEntries, getGeneratedRelationships, compatShareStorageKey } from '@/lib/compat/storage'
import { compatCardKey, RELATIONSHIP_LABELS } from '@/lib/compat/relationship'
import type { OverlayCompatInfo, CompatGenerationState, CompatReportEntry, RelationshipType, CompatEventKind } from '@/lib/compat/types'
import {
  buildRelationshipSeries,
  buildCompatEventBands,
  formatCompatDots,
  getRelationshipPointForYear,
} from '@/lib/compat/relationship-score'

const THIS_YEAR = new Date().getFullYear()
const THIS_MONTH = new Date().getMonth() + 1
const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const SEASON_COLORS: Record<string, string> = {
  '확장기': 'rgba(46,204,113,0.12)', '안정기': 'rgba(52,152,219,0.08)',
  '전환기': 'rgba(241,196,15,0.12)', '인내기': 'rgba(149,165,166,0.12)',
  '격변기': 'rgba(231,76,60,0.12)', '평온기': 'rgba(255,255,255,0.04)',
}

const SEASON_TAG_COLORS: Record<string, string> = {
  '확장기': '#2ecc71', '안정기': '#3498db',
  '전환기': '#f1c40f', '인내기': '#95a5a6',
  '격변기': '#e74c3c', '평온기': '#999',
}

const MAIN_OVERLAYS = [
  { key: 'daewoon', label: '대운 흐름선' },
  { key: 'candle', label: '캔들스틱' },
  { key: 'season', label: '시즌 배경색' },
] as const

const AUX_PANELS = [
  { key: 'yongshin', label: '필요한 기운', color: '#9b59b6' },
  { key: 'energy', label: '변화의 파도', color: '#95a5a6' },
  { key: 'noble', label: '귀인의 도움', color: '#f39c12' },
  { key: 'ohang', label: '오행 균형도', color: '#3498db' },
  { key: 'tengo', label: '십성 밸런스', color: '#1abc9c' },
  { key: 'event', label: '이벤트 확률', color: '#e74c3c' },
] as const

// 메인 차트 위에 겹쳐 그릴 수 있는 5대 생활 도메인 운세 점수 선 (0~100, 높을수록 좋음).
// 세운 종합점수와 동일한 "운세 점수" 축이다. (이벤트 발생 확률이 아님)
// 엔진의 domainScore는 0~10 스케일이라 ×10 하여 세운 점수(0~100)와 같은 축에 맞춘다.
const DOMAIN_SCORE_SCALE = 10
const DOMAIN_OVERLAYS = [
  { key: 'job',      label: '직업운', color: '#e67e22', field: 'domainJob' },
  { key: 'wealth',   label: '재물운', color: '#4caf50', field: 'domainWealth' },
  { key: 'love',     label: '연애운', color: '#e91e63', field: 'domainLove' },
  { key: 'health',   label: '건강운', color: '#16a085', field: 'domainHealth' },
  { key: 'marriage', label: '결혼운', color: '#9c27b0', field: 'domainMarriage' },
] as const

type PeriodKey = '1y' | '10y' | 'all'
type MainOverlayKey = (typeof MAIN_OVERLAYS)[number]['key']
type AuxKey = (typeof AUX_PANELS)[number]['key']
type DomainOverlayKey = (typeof DOMAIN_OVERLAYS)[number]['key']

/** 데이터 포인트에서 도메인 운세 점수(0~100)를 뽑는다. (엔진 0~10 → ×10) */
function domainValue(d: Record<string, unknown>, field: string): number | null {
  const v = d?.[field]
  if (typeof v !== 'number') return null
  return Math.max(0, Math.min(100, Math.round(v * DOMAIN_SCORE_SCALE)))
}

const BD_LABEL_POS: Record<string, string> = {
  yongshin_fit: '필요한 기운 충만', unseong: '좋은 시기', unseong_context: '대운과 시너지',
  relations: '좋은 인연·합', trine: '삼합·방합 길운', balance: '기운 균형 개선', shinsal: '길성 발동',
  disease_resolution: '약점 보완됨', haegong: '공망 해소', structural_adj: '구조적 호재',
}
const BD_LABEL_NEG: Record<string, string> = {
  yongshin_fit: '필요한 기운 부족', unseong: '어려운 시기', unseong_context: '대운과 엇박자',
  relations: '갈등·충돌', trine: '에너지 분산', balance: '기운 편중 심화', shinsal: '흉살 작용',
  disease_resolution: '약점 노출됨', haegong: '공망 해소', structural_adj: '구조적 악재',
}

function intensityWord(v: number): string {
  const a = Math.abs(v)
  if (a >= 8) return '매우 강'
  if (a >= 5) return '강'
  if (a >= 2) return '보통'
  return '약'
}

function breakdownFactors(bd: ScoreBreakdown | undefined): { up: string[]; down: string[] } {
  if (!bd) return { up: [], down: [] }
  const entries = Object.entries(bd)
    .filter(([k]) => k !== 'base')
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 4)
  const up: string[] = []
  const down: string[] = []
  for (const [k, v] of entries) {
    if (Math.abs(v) < 0.3) continue
    const label = v >= 0 ? (BD_LABEL_POS[k] ?? k) : (BD_LABEL_NEG[k] ?? k)
    ;(v >= 0 ? up : down).push(`${label} (${intensityWord(v)})`)
  }
  return { up: up.slice(0, 2), down: down.slice(0, 2) }
}

function getShinsalTags(tags?: string[], adj?: Record<string, number>): string[] {
  if (tags && tags.length > 0) {
    const unique = [...new Set(tags)]
    return unique.slice(0, 6)
  }
  if (!adj) return []
  return Object.keys(adj).map(k => k.replace(/\(.*\)/, '').trim()).slice(0, 6)
}

function fmtPillar(pillar: string | undefined): string {
  if (!pillar || pillar.length < 2) return ''
  return `${pillarToHangul(pillar)}(${pillar})`
}

const MARGIN = { top: 16, right: 16, bottom: 20, left: 8 }
const SUB_MARGIN = { top: 4, right: 16, bottom: 0, left: 8 }

function CandleShape(props: Record<string, unknown>) {
  const { x: rawX, y: barY, width: rawW, height: barHeight, payload } = props as {
    x: number; y: number; width: number; height: number; payload: ChartDatum
  }
  const { open, close, high, low } = payload
  if (!barHeight || !close) return null
  const isYang = close >= open
  const color = isYang ? '#e74c3c' : '#3498db'
  const pixelBottom = barY + barHeight
  const pxPerUnit = barHeight / close
  const toY = (v: number) => pixelBottom - v * pxPerUnit
  const yHigh = toY(high), yLow = toY(low), yOpen = toY(open), yClose = toY(close)
  const bodyTop = Math.min(yOpen, yClose)
  const bodyH = Math.max(2, Math.abs(yOpen - yClose))
  const cx = rawX + rawW / 2
  const bw = Math.min(Math.max(rawW * 0.55, 3), 8)
  const bx = rawX + (rawW - bw) / 2
  return (<g>
    <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={0.5}/>
    <rect x={bx} y={bodyTop} width={bw} height={bodyH} fill={color} fillOpacity={isYang ? 0.9 : 0.65}/>
  </g>)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ThisYearMarker(props: any) {
  const { formattedGraphicalItems, xAxisMap, yAxisMap, period, markerYear, selection, rangeMode, isMonthly } = props
  if (!formattedGraphicalItems?.length || !xAxisMap || !yAxisMap) return null
  const xAxis = Object.values(xAxisMap)[0] as { scale?: ((v: number) => number) & { domain?: () => number[] } } | undefined
  const yAxis = Object.values(yAxisMap)[0] as { scale?: ((v: number) => number) & { domain?: () => number[] } } | undefined
  if (!xAxis?.scale || !yAxis?.scale) return null
  const elements: React.ReactElement[] = []
  const yTop = yAxis.scale(yAxis.scale.domain?.()[1] ?? 110) ?? 0
  const yBottom = yAxis.scale(yAxis.scale.domain?.()[0] ?? 0) ?? 280
  const labelY = Math.max(yTop - 4, 6)
  if (isMonthly) {
    const cx = xAxis.scale(THIS_MONTH)
    if (typeof cx === 'number' && !isNaN(cx)) {
      elements.push(
        <line key="tm-line" x1={cx} y1={yTop} x2={cx} y2={yBottom} stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>,
        <text key="tm-text" x={cx} y={labelY} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#7c3aed">이번달</text>
      )
    }
  } else if (period === 'all') {
    const cx = xAxis.scale(THIS_YEAR)
    if (typeof cx === 'number' && !isNaN(cx)) {
      elements.push(
        <line key="ty-line" x1={cx} y1={yTop} x2={cx} y2={yBottom} stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>,
        <text key="ty-text" x={cx} y={labelY} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#7c3aed">올해</text>
      )
    }
  }
  if (rangeMode && selection) {
    const { startYear, endYear } = selection as { startYear: number; endYear: number }
    const sx = xAxis.scale(startYear)
    if (typeof sx === 'number' && !isNaN(sx)) {
      elements.push(
        <line key="sel-s-line" x1={sx} y1={yTop} x2={sx} y2={yBottom} stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.6}/>,
        <text key="sel-s-text" x={sx} y={labelY} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#7c3aed">{isMonthly ? `${startYear}월` : startYear}</text>
      )
    }
    if (endYear !== startYear) {
      const ex = xAxis.scale(endYear)
      if (typeof ex === 'number' && !isNaN(ex)) {
        elements.push(
          <line key="sel-e-line" x1={ex} y1={yTop} x2={ex} y2={yBottom} stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.6}/>,
          <text key="sel-e-text" x={ex} y={labelY} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#7c3aed">{isMonthly ? `${endYear}월` : endYear}</text>
        )
      }
    }
  } else if (markerYear != null) {
    const isCurrentMarker = isMonthly ? markerYear === THIS_MONTH : (period === 'all' && markerYear === THIS_YEAR)
    if (!isCurrentMarker) {
      const hx = xAxis.scale(markerYear)
      if (typeof hx === 'number' && !isNaN(hx)) {
        elements.push(
          <line key="marker-line" x1={hx} y1={yTop} x2={hx} y2={yBottom} stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>,
          <text key="marker-text" x={hx} y={labelY} textAnchor="middle" fontSize={8} fill="#6b7280">{isMonthly ? `${markerYear}월` : markerYear}</text>
        )
      }
    }
  }
  return elements.length ? <g>{elements}</g> : null
}

const COMPAT_DOT_COLORS: Record<'closer' | 'drift', string> = {
  closer: '#fb7185',
  drift: '#9ca3af',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CompatEventMarkers(props: any) {
  const { formattedGraphicalItems, xAxisMap, yAxisMap, compatPoints, fromYear, isMonthly, period } = props
  if (!compatPoints?.length || isMonthly || period === '1y' || !formattedGraphicalItems?.length || !xAxisMap || !yAxisMap) return null
  const xAxis = Object.values(xAxisMap)[0] as { scale?: ((v: number) => number) } | undefined
  const yAxis = Object.values(yAxisMap)[0] as { scale?: ((v: number) => number) & { domain?: () => number[] } } | undefined
  if (!xAxis?.scale || !yAxis?.scale) return null
  const yTop = yAxis.scale(yAxis.scale.domain?.()[1] ?? 110) ?? 0
  const elements: React.ReactElement[] = []
  const dotKinds: Array<'closer' | 'drift'> = ['closer', 'drift']
  for (const p of compatPoints as Array<{ year: number; events: CompatEventKind[] }>) {
    if (p.year < fromYear) continue
    const cx = xAxis.scale(p.year)
    if (typeof cx !== 'number' || isNaN(cx)) continue
    const kind = dotKinds.find(k => p.events.includes(k))
    if (!kind) continue
    elements.push(
      <circle
        key={`${p.year}-${kind}`}
        cx={cx}
        cy={yTop + 10}
        r={4}
        fill={COMPAT_DOT_COLORS[kind]}
        fillOpacity={0.9}
        stroke="#fff"
        strokeWidth={1.5}
      />,
    )
  }
  return elements.length ? <g>{elements}</g> : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MainTooltip({ active, payload, overlays, domainOverlays, monthly, overlayActive, overlayName, currentName }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as (MergedDatum) | undefined
  if (!d) return null
  const ov = overlays as Record<MainOverlayKey, boolean> | undefined
  const dom = domainOverlays as Record<DomainOverlayKey, boolean> | undefined
  const activeDomains = dom
    ? DOMAIN_OVERLAYS.filter(o => dom[o.key])
        .map(o => ({ label: o.label, color: o.color, val: domainValue(d as unknown as Record<string, unknown>, o.field) }))
        .filter(x => x.val != null)
    : []

  if (overlayActive && d.scoreOv != null) {
    return (
      <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-sm text-[10px] leading-tight overflow-hidden min-w-[140px]">
        <div className="font-bold text-gray-800 px-2.5 py-1">{monthly ? `${d.year}월` : `${d.year}년`}</div>
        <div className="px-2.5 py-1 bg-emerald-50 border-t border-emerald-100">
          <div className="font-semibold text-emerald-800">{currentName || '나'} — {monthly ? '월운' : '세운'}: {Math.round(d.score)}점</div>
          {ov?.daewoon && d.trend != null && (
            <div className="text-emerald-600 text-[9px]">대운 {Math.round(d.trend)}점{d.daewoonPillar ? ` ${fmtPillar(d.daewoonPillar)}` : ''}</div>
          )}
        </div>
        <div className="px-2.5 py-1 bg-rose-50 border-t border-rose-100">
          <div className="font-semibold text-rose-800">{overlayName || '비교'} — {monthly ? '월운' : '세운'}: {Math.round(d.scoreOv)}점</div>
          {ov?.daewoon && d.trendOv != null && (
            <div className="text-rose-600 text-[9px]">대운 {Math.round(d.trendOv)}점{d.daewoonPillarOv ? ` ${fmtPillar(d.daewoonPillarOv)}` : ''}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm text-[10px] leading-tight">
      <div className="font-bold text-gray-800 mb-0.5">{monthly ? `${d.year}월` : `${d.year}년`}</div>
      <div className="text-gray-600">{monthly ? '월운' : '세운'}: <span className="font-semibold text-green-600">{Math.round(d.score)}</span></div>
      {ov?.daewoon && d.trend != null && (
        <div className="text-gray-600">대운: <span className="font-semibold text-yellow-600">{Math.round(d.trend)}</span>{d.daewoonPillar && <span className="text-gray-400 ml-1">{fmtPillar(d.daewoonPillar)}</span>}</div>
      )}
      {ov?.candle && d.high != null && <div className="text-gray-500">고/저: {d.high?.toFixed(0)}~{d.low?.toFixed(0)}</div>}
      {ov?.season && d.seasonTag && <div className="text-gray-500">시즌: <span className="font-semibold" style={{color: SEASON_TAG_COLORS[d.seasonTag] || '#666'}}>{d.seasonEmoji} {d.seasonTag}</span></div>}
      {activeDomains.length > 0 && (
        <div className="mt-0.5 pt-0.5 border-t border-gray-100 grid grid-cols-2 gap-x-2">
          {activeDomains.map(x => (
            <div key={x.label} className="flex items-center gap-1">
              <span className="w-2 h-0.5 rounded inline-block" style={{ backgroundColor: x.color }} />
              <span className="text-gray-500">{x.label}</span>
              <span className="font-semibold" style={{ color: x.color }}>{Math.round(x.val as number)}</span>
            </div>
          ))}
        </div>
      )}
      {(() => {
        const { up, down } = breakdownFactors(d.breakdown)
        if (!up.length && !down.length) return null
        return (
          <div className="mt-0.5 pt-0.5 border-t border-gray-100">
            {up.length > 0 && <div className="text-emerald-600">▲ {up.join(', ')}</div>}
            {down.length > 0 && <div className="text-red-500">▼ {down.join(', ')}</div>}
          </div>
        )
      })()}
      {(() => {
        const tags = getShinsalTags(d.shinsalTags, d.shinsalContextAdj)
        if (!tags.length) return null
        return <div className="mt-0.5 pt-0.5 border-t border-gray-100 text-gray-400">🏷️ {tags.join(' · ')}</div>
      })()}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SubTooltip({ active, payload, decimals = 2, monthly = false }: any) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  if (!entry) return null
  const dec = typeof decimals === 'number' ? decimals : 2
  const val = typeof entry.value === 'number' ? (dec === 0 ? Math.round(entry.value) : entry.value.toFixed(dec)) : entry.value
  return (
    <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-lg px-2 py-1 shadow-sm text-[10px]">
      <span className="text-gray-600">{entry.payload?.year}{monthly ? '월' : ''}: </span>
      <span className="font-semibold" style={{color: entry.color || '#333'}}>{val}</span>
    </div>
  )
}

export interface OverlayEntry {
  id: string
  name: string
  gender: string
  birthDate: string
  dayElement?: string | null
  isLinked?: boolean
}

type MergedDatum = ChartDatum & {
  scoreOv?: number; trendOv?: number; daewoonPillarOv?: string
  yongshinPowerOv?: number; energyTotalOv?: number; energyDirectionOv?: number
  noblePowerOv?: number; ohangBalanceOv?: number
  compatFlow?: number
}

interface ChartTabProps {
  report: SajuReportJson | null
  birthYear: number | null
  fortuneJson?: unknown
  entryId?: string
  currentName?: string
  currentGender?: string
  overlayEntries?: OverlayEntry[]
  /**
   * 비로그인 게스트일 때 true. 기본 세운 라인 외 모든 인터랙션을 잠근다.
   */
  isLocked?: boolean
  /**
   * 잠금 클릭 시 카카오 로그인을 유도하는 콜백.
   * 부모(`/app/saju/[id]/page.tsx`)에서 LoginPromptSheet를 띄운다.
   */
  onLockedClick?: (feature: string) => void
  /**
   * 공유 공개 뷰. 차트 시각화는 모두 보여주되, 소유자 크레딧을 소모하는
   * 구간 해설/운세 자동 생성과 비교 같은 소유자 전용 인터랙션은 차단한다.
   */
  shareMode?: boolean
  /** shareMode 에서 잠긴 액션을 누르면 호출 — 보통 "내 차트 만들기" CTA. */
  onShareCta?: () => void
  /** 비교 오버레이 활성 시 요약바용 정보 상향 */
  onOverlayChange?: (info: OverlayCompatInfo | null) => void
  /** 생성 직후 펼칠 궁합 카드 (partnerId|relationship) */
  expandCompatCardKey?: string | null
  /** 궁합 해설 생성 중 — 플레이스홀더 카드 표시 */
  compatGeneration?: CompatGenerationState | null
  entryName?: string
  myGender?: string
  /** fortuneJson 갱신 콜백 (궁합 생성 후) */
  onFortuneJsonUpdate?: (fortuneJson: unknown) => void
  /** URL ?overlay= 등 초기 비교 대상 */
  initialOverlayId?: string | null
  /** 궁합 공유 페이지 — 상대 리포트 인라인 (공개 API 없이) */
  sharePartner?: {
    id: string
    name: string
    gender: string
    birthYear: number
    report: SajuReportJson
  }
}

export function ChartTab({
  report, birthYear, fortuneJson, entryId, currentName, currentGender, overlayEntries,
  isLocked = false, onLockedClick, shareMode = false, onShareCta,
  onOverlayChange, expandCompatCardKey, onFortuneJsonUpdate, compatGeneration,
  entryName, myGender, initialOverlayId, sharePartner,
}: ChartTabProps) {
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [panelOpen, setPanelOpen] = useState(false)
  const [mainOverlays, setMainOverlays] = useState<Record<MainOverlayKey, boolean>>({ daewoon: false, candle: false, season: false })
  const [domainOverlays, setDomainOverlays] = useState<Record<DomainOverlayKey, boolean>>({ job: false, wealth: false, love: false, health: false, marriage: false })
  const [auxPanels, setAuxPanels] = useState<Record<AuxKey, boolean>>({ yongshin: false, energy: false, noble: false, ohang: false, tengo: false, event: false })
  const [hoverYear, setHoverYear] = useState<number | null>(null)
  const [clickedYear, setClickedYear] = useState<number | null>(null)
  const [selection, setSelection] = useState<{ startYear: number; endYear: number } | null>(null)
  const [yearSummary, setYearSummary] = useState<{ startYear: number; endYear: number; text: string } | null>(null)
  const [yearSummaryLoading, setYearSummaryLoading] = useState(false)
  const [rangeMode, setRangeMode] = useState(false)
  const rangeFirst = React.useRef<number | null>(null)
  const [juShortage, setJuShortage] = useState<{ needed: number; current: number } | null>(null)
  const [settingsBadge, setSettingsBadge] = useState(false)
  const [chartHint, setChartHint] = useState(false)
  const [summaryCache] = useState<Map<string, { text: string }>>(() => new Map())
  const chartRef = React.useRef<HTMLDivElement>(null)
  const lastHapticYear = React.useRef<number | null>(null)
  const hasAnimated = React.useRef(false)
  const isTouchRef = React.useRef(false)
  useEffect(() => {
    const onTouch = () => { isTouchRef.current = true }
    window.addEventListener('touchstart', onTouch, { once: true, passive: true })
    return () => window.removeEventListener('touchstart', onTouch)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { hasAnimated.current = true }, 2500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('chartpalja_opened_settings')) {
      setSettingsBadge(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('chartpalja_chart_touched')) return
    const t = setTimeout(() => setChartHint(true), 2000)
    return () => clearTimeout(t)
  }, [])

  const dismissChartHint = useCallback(() => {
    if (chartHint) {
      setChartHint(false)
      localStorage.setItem('chartpalja_chart_touched', '1')
    }
  }, [chartHint])

  // Overlay (comparison) state
  const [overlayEntryId, setOverlayEntryId] = useState<string | null>(initialOverlayId ?? null)
  const [overlayReport, setOverlayReport] = useState<SajuReportJson | null>(null)
  const [overlayBirthYear, setOverlayBirthYear] = useState<number | null>(null)
  const [overlayName, setOverlayName] = useState('')
  const [overlayGender, setOverlayGender] = useState('')
  const [compareSheetOpen, setCompareSheetOpen] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const overlayFetchedRef = React.useRef<string | null>(null)

  useEffect(() => {
    if (!overlayEntryId) { setOverlayReport(null); setOverlayBirthYear(null); overlayFetchedRef.current = null; return }
    if (sharePartner && overlayEntryId === sharePartner.id) {
      setOverlayReport(sharePartner.report)
      setOverlayBirthYear(sharePartner.birthYear)
      setOverlayName(sharePartner.name)
      setOverlayGender(sharePartner.gender)
      overlayFetchedRef.current = overlayEntryId
      return
    }
    if (overlayEntryId === overlayFetchedRef.current) return
    overlayFetchedRef.current = overlayEntryId
    const gid = getGuestId()
    const headers: Record<string, string> = {}
    if (gid) headers['x-guest-id'] = gid
    // 공유 뷰에서는 인증 없이 접근 가능한 공개 엔드포인트를 쓴다.
    const url = shareMode
      ? `/api/share/${overlayEntryId}`
      : `/api/saju/${overlayEntryId}${entryId ? `?contextEntryId=${encodeURIComponent(entryId)}` : ''}`
    fetch(url, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.sajuReportJson) {
          setOverlayReport(d.sajuReportJson)
          const by = typeof d.birthYear === 'number'
            ? d.birthYear
            : parseInt(String(d.birthDate ?? '').slice(0, 4), 10)
          setOverlayBirthYear(Number.isFinite(by) ? by : null)
          setOverlayName(d.name || '')
          setOverlayGender(d.gender || '')
        }
      })
      .catch(() => {})
  }, [overlayEntryId, shareMode, entryId, sharePartner])

  useEffect(() => {
    if (!initialOverlayId || overlayEntryId) return
    const match = overlayEntries?.find(e => e.id === initialOverlayId)
    if (match) {
      setOverlayEntryId(match.id)
      setOverlayName(match.name)
      setOverlayGender(match.gender)
    }
  }, [initialOverlayId, overlayEntryId, overlayEntries])

  const clearOverlay = useCallback(() => {
    setOverlayEntryId(null); setOverlayReport(null); setOverlayBirthYear(null)
    setOverlayName(''); setOverlayGender('')
    setSelection(null); setYearSummary(null)
    onOverlayChange?.(null)
  }, [onOverlayChange])

  const handleInviteFriend = useCallback(async () => {
    if (!entryId || shareMode || isLocked) return
    setInviteBusy(true)
    setInviteUrl(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const gid = getGuestId()
      if (gid) headers['x-guest-id'] = gid
      const res = await fetch('/api/compat/invite', {
        method: 'POST',
        headers,
        body: JSON.stringify({ entryId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '초대 링크 생성 실패')
      setInviteUrl(data.shareUrl as string)
      if (data.shareUrl) await navigator.clipboard.writeText(data.shareUrl)
    } catch { /* ignore */ }
    setInviteBusy(false)
  }, [entryId, shareMode, isLocked])

  const chartPayload: ChartPayload | null | undefined = report?.chartData
  const fullChartData = useMemo(() => {
    if (birthYear == null) return null
    return buildLifeChartData(chartPayload, report, birthYear)
  }, [chartPayload, report, birthYear])

  const overlayChartData = useMemo(() => {
    if (!overlayReport || !overlayBirthYear) return null
    const cp = overlayReport.chartData as ChartPayload | undefined
    return buildLifeChartData(cp, overlayReport, overlayBirthYear)
  }, [overlayReport, overlayBirthYear])

  const overlayActive = !!(overlayEntryId && overlayChartData)

  useEffect(() => {
    if (!onOverlayChange) return
    if (!overlayActive || !overlayReport || overlayBirthYear == null || birthYear == null || !report || !overlayEntryId) {
      if (!overlayEntryId) onOverlayChange(null)
      return
    }
    const type = classifyCompat(report, birthYear, overlayReport, overlayBirthYear)
    const myDatum = fullChartData?.data.find(d => d.year === THIS_YEAR)
    const ovDatum = overlayChartData?.data.find(d => d.year === THIS_YEAR)
    const series = buildRelationshipSeries(report, birthYear, overlayReport, overlayBirthYear)
    const relPoint = getRelationshipPointForYear(series, THIS_YEAR)
    onOverlayChange({
      overlayId: overlayEntryId,
      overlayName: overlayName || '상대',
      overlayGender: overlayGender || 'male',
      myScore: Math.round(myDatum?.score ?? 0),
      partnerScore: Math.round(ovDatum?.score ?? 0),
      type,
      generatedRelationships: getGeneratedRelationships(fortuneJson, overlayEntryId),
      compatDots: relPoint?.dots,
    })
  }, [
    onOverlayChange, overlayActive, overlayReport, overlayBirthYear, birthYear, report,
    overlayEntryId, overlayName, overlayGender, fullChartData, overlayChartData, fortuneJson,
  ])

  const { filteredData, xDomain, isMonthly } = useMemo(() => {
    if (!fullChartData) return { filteredData: [], xDomain: [2000, 2080] as [number, number], isMonthly: false }
    const all = fullChartData.data
    let filtered: ChartDatum[]
    let monthly = false
    switch (period) {
      case '1y':
        if (fullChartData.monthlyData?.length) { filtered = fullChartData.monthlyData; monthly = true }
        else { filtered = all.filter(d => d.year === THIS_YEAR) }
        break
      case '10y': filtered = all.filter(d => d.year >= THIS_YEAR && d.year < THIS_YEAR + 10); break
      default: filtered = all
    }
    if (!filtered.length) filtered = all
    if (overlayChartData && !monthly && period === 'all') {
      const ovAll = overlayChartData.data
      if (ovAll.length) {
        const ovStart = ovAll[0]!.year
        const ovEnd = ovAll[ovAll.length - 1]!.year
        filtered = filtered.filter(d => d.year >= ovStart && d.year <= ovEnd)
      }
    }
    let xd: [number, number]
    if (monthly) { xd = [0.5, 12.5] }
    else {
      const pad = filtered.length <= 5 ? 1 : filtered.length <= 12 ? 0.5 : 0
      xd = [filtered[0]!.year - pad, filtered[filtered.length - 1]!.year + pad]
    }
    return { filteredData: filtered, xDomain: xd, isMonthly: monthly }
  }, [fullChartData, period, overlayChartData])

  const relationshipSeries = useMemo(() => {
    if (!overlayActive || !report || !overlayReport || birthYear == null || overlayBirthYear == null) return []
    return buildRelationshipSeries(report, birthYear, overlayReport, overlayBirthYear)
  }, [overlayActive, report, overlayReport, birthYear, overlayBirthYear])

  const compatEventBands = useMemo(() => {
    if (!overlayActive || isMonthly) return []
    return buildCompatEventBands(relationshipSeries, THIS_YEAR)
  }, [relationshipSeries, overlayActive, isMonthly])

  const mergedData = useMemo<MergedDatum[]>(() => {
    const relMap = new Map(relationshipSeries.map(p => [p.year, p.score]))
    if (!overlayActive) return filteredData
    const ovSrc = isMonthly ? overlayChartData!.monthlyData : overlayChartData!.data
    if (!ovSrc?.length) return filteredData.map(d => ({ ...d, compatFlow: relMap.get(d.year) }))
    const ovMap = new Map(ovSrc.map(d => [d.year, d]))
    return filteredData.map(d => {
      const ov = ovMap.get(d.year)
      const base = ov
        ? { ...d, scoreOv: ov.score, trendOv: ov.trend, daewoonPillarOv: ov.daewoonPillar,
          yongshinPowerOv: ov.yongshinPower, energyTotalOv: ov.energyTotal,
          energyDirectionOv: ov.energyDirection, noblePowerOv: ov.noblePower, ohangBalanceOv: ov.ohangBalance }
        : d
      return { ...base, compatFlow: relMap.get(d.year) }
    })
  }, [filteredData, overlayActive, overlayChartData, isMonthly, relationshipSeries])

  const yDomain = useMemo<[number, number]>(() => {
    if (!mergedData.length) return [0, 110]
    let lo = Infinity, hi = -Infinity
    for (const d of mergedData) {
      for (const v of [d.score, d.scoreOv].filter(v => typeof v === 'number' && !isNaN(v)) as number[]) {
        if (v < lo) lo = v; if (v > hi) hi = v
      }
    }
    if (!isFinite(lo)) return [0, 110]
    const pad = Math.max(5, (hi - lo) * 0.15)
    return [Math.max(0, Math.floor(lo - pad)), Math.min(120, Math.ceil(hi + pad))]
  }, [mergedData])

  const compatFlowDomain = useMemo<[number, number]>(() => {
    if (!mergedData.length) return [0, 100]
    let lo = Infinity, hi = -Infinity
    for (const d of mergedData) {
      const v = d.compatFlow
      if (typeof v === 'number' && !isNaN(v)) {
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
    if (!isFinite(lo)) return [0, 100]
    const range = hi - lo
    const minSpan = 40
    if (range < minSpan) {
      const mid = (lo + hi) / 2
      lo = mid - minSpan / 2
      hi = mid + minSpan / 2
    } else {
      const pad = Math.max(18, range * 0.4)
      lo -= pad
      hi += pad
    }
    return [Math.max(0, Math.floor(lo)), Math.min(100, Math.ceil(hi))]
  }, [mergedData])

  const currentYearScore = useMemo(() => {
    const target = isMonthly ? THIS_MONTH : THIS_YEAR
    const d = mergedData.find(d => d.year === target)
    return d ? Math.round(d.score) : null
  }, [mergedData, isMonthly])

  const markerYear = hoverYear ?? clickedYear

  // 십성 밸런스/이벤트 확률 패널은 "마지막으로 본 연도"를 고정해 둔다.
  // 커서/손가락을 떼도(=markerYear 가 null 이 되어도) 직전 값이 남도록 한다.
  const [pinnedYear, setPinnedYear] = useState<number | null>(null)
  useEffect(() => { if (markerYear != null) setPinnedYear(markerYear) }, [markerYear])
  // 우선순위: 현재 가리키는 연도 > 선택 구간 시작 > 마지막 고정 연도 > 올해(월)
  const focusYear = markerYear ?? selection?.startYear ?? pinnedYear ?? (isMonthly ? THIS_MONTH : THIS_YEAR)

  const selectedData = useMemo(() => {
    return focusYear != null ? mergedData.find(d => d.year === focusYear) ?? null : null
  }, [focusYear, mergedData])

  const selectedOverlayData = useMemo(() => {
    if (!overlayActive || focusYear == null) return null
    const ovSrc = isMonthly ? overlayChartData!.monthlyData : overlayChartData!.data
    return ovSrc?.find(d => d.year === focusYear) ?? null
  }, [focusYear, overlayActive, overlayChartData, isMonthly])

  const hasEngineData = !!(chartPayload?.['연도별_타임라인']?.length)
  const seasonBands = fullChartData?.seasonBands ?? []

  const fetchSummary = useCallback((startYear: number, endYear: number, monthly = false) => {
    // 공유 뷰에서는 소유자 크레딧을 소모하는 구간 해설 생성을 막고 self-CTA 로 유도한다.
    if (shareMode) { onShareCta?.(); return }
    if (!entryId) return
    const prefix = monthly ? 'm_' : ''
    const ovSuffix = overlayEntryId ? `_ov${overlayEntryId.slice(0, 6)}` : ''
    const cacheKey = startYear === endYear ? `${prefix}${startYear}${ovSuffix}` : `${prefix}${startYear}_${endYear}${ovSuffix}`
    const cached = summaryCache.get(cacheKey)
    if (cached) { setYearSummary({ startYear, endYear, ...cached }); return }
    setYearSummaryLoading(true); setYearSummary(null)
    const gid = getGuestId()
    const headers: Record<string, string> = {}
    if (gid) headers['x-guest-id'] = gid
    let url: string
    if (monthly) {
      url = startYear === endYear
        ? `/api/saju/${entryId}/fortune/year?month=${startYear}`
        : `/api/saju/${entryId}/fortune/year?month=${startYear}&monthEnd=${endYear}`
    } else {
      url = startYear === endYear
        ? `/api/saju/${entryId}/fortune/year?year=${startYear}`
        : `/api/saju/${entryId}/fortune/year?year=${startYear}&yearEnd=${endYear}`
    }
    if (overlayEntryId) url += `&overlayId=${overlayEntryId}`
    fetch(url, { headers })
      .then(async r => {
        const d = await r.json().catch(() => null)
        if (r.status === 402) {
          const d402 = d as { needed?: number; ju?: number } | null
          setJuShortage({
            needed: d402?.needed ?? READING_COST.period,
            current: d402?.ju ?? 0,
          })
          throw new Error('이용권 부족')
        }
        if (!r.ok) throw new Error(d?.error ?? 'Failed')
        return d
      })
      .then(d => {
        const result = { text: d?.summary ?? '해석을 불러오지 못했습니다.' }
        summaryCache.set(cacheKey, result)
        setYearSummary({ startYear, endYear, ...result })
      })
      .catch(e => {
        if (!e?.message?.includes('이용권')) setYearSummary({ startYear, endYear, text: '해설을 불러오지 못했습니다.' })
      })
      .finally(() => setYearSummaryLoading(false))
  }, [entryId, summaryCache, overlayEntryId, shareMode, onShareCta])

  const dragStartYear = React.useRef<number | null>(null)
  const didDrag = React.useRef(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseDown = useCallback((state: any) => {
    if (!rangeMode) return
    didDrag.current = false
    if (state?.activeTooltipIndex != null) {
      const yr = mergedData[state.activeTooltipIndex]?.year
      if (yr) dragStartYear.current = yr
    }
  }, [mergedData, rangeMode])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseUp = useCallback((state: any) => {
    const startYr = dragStartYear.current; dragStartYear.current = null
    if (!startYr || !rangeMode) return
    const endIdx = state?.activeTooltipIndex
    const endYr = endIdx != null ? mergedData[endIdx]?.year : null
    if (endYr && endYr !== startYr) {
      didDrag.current = true
      setSelection({ startYear: Math.min(startYr, endYr), endYear: Math.max(startYr, endYr) })
      rangeFirst.current = null
      setClickedYear(null)
    }
  }, [mergedData, rangeMode])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = useCallback((state: any) => {
    if (didDrag.current) { didDrag.current = false; return }
    if (state?.activeTooltipIndex == null) return
    const yr = mergedData[state.activeTooltipIndex]?.year
    if (!yr) return

    setClickedYear(yr)

    if (!rangeMode) return

    if (!rangeFirst.current) {
      rangeFirst.current = yr
      setSelection({ startYear: yr, endYear: yr })
    } else {
      const a = rangeFirst.current, b = yr
      const sel = { startYear: Math.min(a, b), endYear: Math.max(a, b) }
      setSelection(sel)
      rangeFirst.current = null
      setClickedYear(null)
    }
  }, [mergedData, rangeMode])

  const toggleMain = (k: MainOverlayKey) => setMainOverlays(p => ({ ...p, [k]: !p[k] }))
  const toggleAux = (k: AuxKey) => setAuxPanels(p => ({ ...p, [k]: !p[k] }))
  const toggleDomain = (k: DomainOverlayKey) => setDomainOverlays(p => ({ ...p, [k]: !p[k] }))

  /**
   * 잠금 상태에서 인터랙션이 발생하면 카카오 로그인 시트를 띄우고 true를 반환.
   * 호출부에서 true를 받으면 본래 액션을 중단해야 한다.
   */
  const blockIfLocked = useCallback((feature: string): boolean => {
    if (!isLocked) return false
    onLockedClick?.(feature)
    return true
  }, [isLocked, onLockedClick])

  if (!fullChartData) {
    return <div className="py-12 text-center text-gray-400 text-sm">차트 데이터가 없습니다.</div>
  }

  const anyAux = Object.values(auxPanels).some(Boolean)
  const otherEntries = overlayEntries?.filter(e => e.id !== entryId) ?? []

  return (
    <div>
      {juShortage && (
        <JuShortageNudge
          needed={juShortage.needed}
          current={juShortage.current}
          onDismiss={() => setJuShortage(null)}
        />
      )}
      {/* Chart area */}
      <div className="relative px-2 pt-3" data-capture="01_메인차트">
        {/* Settings gear — top-right of chart area */}
        <button onClick={() => {
          setPanelOpen(true)
          if (settingsBadge) {
            setSettingsBadge(false)
            localStorage.setItem('chartpalja_opened_settings', '1')
          }
        }}
          className="absolute top-3 right-3 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-white/80 backdrop-blur border border-gray-200/60 hover:bg-white hover:border-gray-300 transition-all shadow-sm">
          <span className="text-sm leading-none">📊</span>
          {settingsBadge && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 rounded-full animate-pulse" />}
        </button>

        {/* Overlay legend — fixed height to prevent layout shift */}
        <div className="min-h-4 flex flex-wrap justify-center items-center gap-x-3 gap-y-0.5">
          {overlayActive && (<>
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className="w-4 h-0.5 bg-emerald-400 rounded inline-block" /> {currentName || '나'}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className="w-4 h-0.5 bg-rose-400 rounded inline-block" /> {overlayName}
            </span>
          </>)}
          {overlayActive && !isMonthly && (
            <>
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-3 h-2 rounded-sm bg-emerald-400/35 border border-emerald-400/40 inline-block" /> 좋은 시기
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-3 h-2 rounded-sm bg-amber-400/35 border border-amber-400/40 inline-block" /> 주의 시기
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> 가까워짐
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> 엇갈림
              </span>
            </>
          )}
          {DOMAIN_OVERLAYS.filter(o => domainOverlays[o.key]).map(o => (
            <span key={o.key} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className="w-4 h-0.5 rounded inline-block" style={{ backgroundColor: o.color }} /> {o.label}
            </span>
          ))}
        </div>

        {/* Main chart */}
        <div className="w-full h-[420px] relative" onPointerDown={dismissChartHint}>
          {chartHint && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none animate-fade-in">
              <span className="bg-white/90 backdrop-blur-sm text-gray-500 text-xs px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
                👆 차트를 터치해서 시기별 흐름을 확인해보세요
              </span>
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={mergedData} syncId="lc" margin={MARGIN}
                onClick={handleChartClick}
                onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}
                onMouseMove={(state: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                  if (state?.activeTooltipIndex != null) {
                    const yr = mergedData[state.activeTooltipIndex]?.year ?? null
                    setHoverYear(yr)
                    if (yr && yr !== lastHapticYear.current) { lastHapticYear.current = yr; if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(3) }
                  }
                }}
                onMouseLeave={() => {
                  setHoverYear(null); lastHapticYear.current = null; dragStartYear.current = null
                  if (!isTouchRef.current) setClickedYear(null)
                }}>
              <XAxis dataKey="year" type="number" domain={xDomain} tick={{ fontSize: 8 }} angle={isMonthly ? 0 : -45} textAnchor={isMonthly ? 'middle' : 'end'} height={40}
                    ticks={isMonthly ? [1,2,3,4,5,6,7,8,9,10,11,12] : period === '10y' ? filteredData.map(d => d.year) : undefined}
                    tickCount={period === 'all' ? 10 : undefined}
                    tickFormatter={isMonthly ? (v: number) => MONTH_LABELS[v - 1] ?? '' : undefined}
                    padding={{left: 8, right: 8}}/>
              <YAxis domain={yDomain} hide={true} width={0}/>
              {!rangeMode && <Tooltip content={<MainTooltip overlays={mainOverlays} domainOverlays={domainOverlays} monthly={isMonthly} overlayActive={overlayActive} overlayName={overlayName} currentName={currentName}/>} cursor={hoverYear != null ? { stroke: '#a78bfa', strokeWidth: 1, strokeDasharray: '4 2' } : false}/>}
              {rangeMode && <Tooltip content={() => null} cursor={hoverYear != null ? { stroke: '#a78bfa', strokeWidth: 1, strokeDasharray: '4 2' } : false}/>}
              {currentYearScore != null && <ReferenceLine y={currentYearScore} stroke="#e0e0e0" strokeWidth={0.5} strokeDasharray="3 3" label={{ value: `${currentYearScore}`, position: 'insideLeft', fontSize: 10, fill: '#aaa', offset: 4 }}/>}
              {mainOverlays.season && hasEngineData && seasonBands.map((b: SeasonBand, i: number) => (
                <ReferenceArea key={i} x1={b.startYear} x2={b.endYear} fill={SEASON_COLORS[b.tag] ?? 'rgba(0,0,0,0.03)'} fillOpacity={1}/>
              ))}
              {rangeMode && selection && <ReferenceArea x1={selection.startYear} x2={selection.endYear} fill="#a78bfa" fillOpacity={0.12} stroke="#a78bfa" strokeOpacity={0.3} strokeWidth={1}/>}
              {overlayActive && !isMonthly && compatEventBands.map((b, i) => (
                <ReferenceArea
                  key={`compat-band-${i}`}
                  x1={b.startYear}
                  x2={b.endYear + 0.95}
                  fill={b.kind === 'good' ? '#34d399' : '#fbbf24'}
                  fillOpacity={b.kind === 'good' ? 0.16 : 0.14}
                  stroke={b.kind === 'good' ? '#34d399' : '#fbbf24'}
                  strokeOpacity={0.25}
                  strokeWidth={1}
                />
              ))}
              {mainOverlays.daewoon && <Line type="stepAfter" dataKey="trend" stroke="#ffd700" strokeWidth={2} dot={false} name="대운" isAnimationActive={false}/>}
              <Line type="monotone" dataKey="score" stroke="#82ca9d" strokeWidth={1.5} dot={false} name={isMonthly ? '월운' : '세운'} isAnimationActive={!hasAnimated.current} animationDuration={2000} animationEasing="ease-in-out"/>
              {DOMAIN_OVERLAYS.map(o => domainOverlays[o.key] ? (
                <Line key={o.key} type="monotone"
                  dataKey={(d: Record<string, unknown>) => domainValue(d, o.field)}
                  stroke={o.color} strokeWidth={1.5} dot={false} name={o.label}
                  strokeDasharray="3 2" isAnimationActive={false} connectNulls={false}/>
              ) : null)}
              {overlayActive && mainOverlays.daewoon && <Line type="stepAfter" dataKey="trendOv" stroke="#fda4af" strokeWidth={2} dot={false} name="대운(비교)" strokeDasharray="6 3" isAnimationActive={false} connectNulls={false}/>}
              {overlayActive && <Line type="monotone" dataKey="scoreOv" stroke="#fb7185" strokeWidth={1.5} dot={false} name={isMonthly ? '월운(비교)' : '세운(비교)'} isAnimationActive={true} animationDuration={1800} animationEasing="ease-in-out" connectNulls={false}/>}
              {mainOverlays.candle && <Bar dataKey="close" name="캔들" shape={<CandleShape/>} isAnimationActive={false}/>}
              <Customized component={(p: any) => <ThisYearMarker {...p} period={period} markerYear={markerYear} selection={selection} rangeMode={rangeMode} isMonthly={isMonthly}/>}/>
              {overlayActive && !isMonthly && (
                <Customized component={(p: any) => (
                  <CompatEventMarkers
                    {...p}
                    compatPoints={relationshipSeries}
                    fromYear={THIS_YEAR}
                    isMonthly={isMonthly}
                    period={period}
                  />
                )}/>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {rangeMode && !selection && (
          <div className="text-center mt-1 mb-0">
            <span className="text-[10px] text-purple-400 animate-pulse">👆 시작 연도를 선택하거나 드래그하세요</span>
          </div>
        )}
        {rangeMode && selection && selection.startYear === selection.endYear && rangeFirst.current && (
          <div className="text-center mt-1 mb-0">
            <span className="text-[10px] text-purple-400 animate-pulse">👆 끝 연도를 선택하세요</span>
          </div>
        )}

        {/* Period selector + function buttons */}
        <div className="flex justify-center items-center gap-1.5 mt-2 mb-1" ref={chartRef}>
          {([['1y', '1년'], ['10y', '10년'], ['all', '전체']] as [PeriodKey, string][]).map(([k, l]) => (
            <button key={k} onClick={() => { setPeriod(k); setSelection(null); setYearSummary(null); setYearSummaryLoading(false); setRangeMode(false); rangeFirst.current = null; setPinnedYear(null) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${period === k && !rangeMode ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{l}</button>
          ))}
          {/* 구분선 — 비교/구간 버튼 중 하나라도 보일 때만 */}
          {(otherEntries.length > 0 || !shareMode) && (
            <span className="w-px h-4 bg-gray-200 mx-1"/>
          )}
          {/* 비교: 공유 뷰에서도 예시 인물과 비교 가능 (크레딧 무소모) */}
          {otherEntries.length > 0 && (
            overlayActive ? (
              <button onClick={clearOverlay}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-medium hover:bg-rose-100 transition-all">
                👥 {overlayName} <span className="ml-0.5 text-rose-400">&times;</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (blockIfLocked('비교')) return
                  setCompareSheetOpen(true)
                }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/80 backdrop-blur border border-gray-200/60 hover:bg-white hover:border-gray-300 transition-all shadow-sm group"
              >
                <span className="text-[10px] font-medium text-gray-400 group-hover:text-purple-500 transition-colors">
                  👥 비교{isLocked ? ' 🔒' : ''}
                </span>
              </button>
            )
          )}
          {/* 구간 해설은 소유자 크레딧을 쓰는 기능이라 공유 뷰에서는 숨긴다. */}
          {!shareMode && (
            <button
              onClick={() => {
                if (blockIfLocked('구간 해설')) return
                const next = !rangeMode
                setRangeMode(next)
                if (next) { setSelection(null); setYearSummary(null); rangeFirst.current = null }
                else { setSelection(null); rangeFirst.current = null }
              }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                rangeMode
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/80 backdrop-blur border border-gray-200/60 hover:bg-white hover:border-gray-300 shadow-sm text-gray-400 hover:text-purple-500'
              }`}
            >
              🗓️ 구간{isLocked ? ' 🔒' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Selection card — only in range mode */}
      {rangeMode && selection && !yearSummary && !yearSummaryLoading && (
        <div className="mx-3 sm:mx-4 mt-3 mb-1">
          <div className="relative bg-white rounded-2xl p-3 sm:p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] ring-1 ring-purple-100">
            <button onClick={() => { setSelection(null); rangeFirst.current = null }}
              className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 text-xs leading-none transition-colors">&times;</button>
            <div className="flex items-center gap-2 mb-3 pr-6">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-600 whitespace-nowrap flex-shrink-0">
                {isMonthly
                  ? (selection.startYear === selection.endYear ? `${selection.startYear}월` : `${selection.startYear}~${selection.endYear}월`)
                  : (selection.startYear === selection.endYear ? `${selection.startYear}년` : `${selection.startYear}~${selection.endYear}년`)}
              </span>
              {(() => {
                const yds = mergedData.filter(d => d.year >= selection.startYear && d.year <= selection.endYear)
                if (!yds.length) return null
                const avg = Math.round(yds.reduce((a, b) => a + b.score, 0) / yds.length)
                return <span className="text-[11px] text-gray-400 truncate">평균 {avg}점</span>
              })()}
            </div>
            <button onClick={() => fetchSummary(selection.startYear, selection.endYear, isMonthly)}
              className="w-full py-2.5 rounded-xl text-[13px] sm:text-sm font-semibold bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors truncate">
              {isMonthly
                ? (selection.startYear === selection.endYear ? `${selection.startYear}월 해설 보기` : `${selection.startYear}~${selection.endYear}월 해설 보기`)
                : (selection.startYear === selection.endYear ? `${selection.startYear}년 해설 보기` : `${selection.startYear}~${selection.endYear}년 해설 보기`)}
            </button>
          </div>
        </div>
      )}

      {rangeMode && (yearSummaryLoading || yearSummary) && (
        <div className="mx-3 sm:mx-4 mt-3 mb-1">
          <div className="relative bg-white rounded-2xl p-3 sm:p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] ring-1 ring-purple-100">
            <button onClick={() => { setYearSummary(null); setYearSummaryLoading(false); setSelection(null); rangeFirst.current = null }}
              className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 text-xs leading-none transition-colors">&times;</button>
            {yearSummaryLoading ? (
              <div className="flex items-center gap-2 py-1">
                <div className="w-4 h-4 rounded-full border-2 border-purple-200 border-t-purple-500 animate-spin" />
                <span className="text-xs text-gray-400">해설을 생성하고 있어요...</span>
              </div>
            ) : yearSummary ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 pr-6">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-600 whitespace-nowrap flex-shrink-0">
                    {isMonthly
                      ? (yearSummary.startYear === yearSummary.endYear ? `${yearSummary.startYear}월` : `${yearSummary.startYear}~${yearSummary.endYear}월`)
                      : (yearSummary.startYear === yearSummary.endYear ? `${yearSummary.startYear}년` : `${yearSummary.startYear}~${yearSummary.endYear}년`)}
                  </span>
                  {(() => {
                    const yds = mergedData.filter(d => d.year >= yearSummary.startYear && d.year <= yearSummary.endYear)
                    if (!yds.length) return null
                    if (yds.length === 1) return (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">{Math.round(yds[0]!.score)}점</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="text-xs text-gray-400">{yds[0]!.seasonTag}</span>
                      </div>
                    )
                    const avg = Math.round(yds.reduce((a, b) => a + b.score, 0) / yds.length)
                    const peak = yds.reduce((a, b) => a.score > b.score ? a : b)
                    return <span className="text-[10px] sm:text-[11px] text-gray-400 truncate">평균 {avg}점 · 최고 {peak.year}년({Math.round(peak.score)}점)</span>
                  })()}
                </div>
                <p className="text-[13px] text-gray-600 leading-relaxed pr-2">{cleanFortuneText(yearSummary.text)}</p>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* 궁합 흐름 — 비교 오버레이 활성 시 */}
      {overlayActive && !isMonthly && relationshipSeries.length > 0 && (
        <div className="px-2 mt-2" data-capture="02_궁합흐름">
          <div className="text-[10px] text-gray-400 text-right pr-2 mb-0.5">
            궁합 흐름<InfoTip text={'두 사람 사주를 오행·동기화·상생·충돌 네 가지로 합산한 관계 흐름이에요.\n선이 높을수록 관계가 순조로운 시기, 낮을수록 조율이 필요한 시기예요.'} />
          </div>
          <div className="h-[70px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
                <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{ left: 8, right: 8 }} />
                <YAxis domain={compatFlowDomain} hide width={0} />
                <Tooltip content={<SubTooltip decimals={0} monthly={false} />} />
                {markerYear != null && (
                  <ReferenceLine x={markerYear} stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5} />
                )}
                <Line dataKey="compatFlow" stroke="#e879a9" strokeWidth={1.5} dot={false} connectNulls={false} name="궁합" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Auxiliary charts */}
      {anyAux && hasEngineData && (
        <div className="px-2 mt-2 space-y-3" data-capture="02_보조지표">
          {auxPanels.yongshin && (
            <div><div className="text-[10px] text-gray-400 text-right pr-2 mb-0.5">필요한 기운<InfoTip text={"내게 가장 필요한 기운(용신)이 얼마나 들어오는지 보여줘요.\n양수 → 좋은 기운이 충분한 시기\n음수 → 기운이 부족한 시기"} /></div>
            <div className="h-[80px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
              <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{left: 8, right: 8}}/><YAxis domain={[-1,1]} hide={true} width={0}/>
              <Tooltip content={<SubTooltip monthly={isMonthly}/>}/><ReferenceLine y={0} stroke="#666"/>
              {markerYear != null && <ReferenceLine x={markerYear} stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>}
              <Area dataKey="yongshinPower" stroke="#9b59b6" fill="#9b59b6" fillOpacity={0.2} dot={false}/>
              {overlayActive && <Area dataKey="yongshinPowerOv" stroke="#fb7185" fill="#fb7185" fillOpacity={0.15} dot={false} strokeDasharray="4 2"/>}
            </AreaChart></ResponsiveContainer></div></div>
          )}
          {auxPanels.energy && (
            <div><div className="flex items-center justify-between px-2 mb-0.5">
              <div className="flex items-center gap-2 text-[9px] ml-7">
                <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{background:'#27ae60',opacity:0.7}}/><span className="text-gray-400">길한 변화</span></span>
                <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{background:'#e74c3c',opacity:0.7}}/><span className="text-gray-400">도전적 변화</span></span>
              </div>
              <div className="text-[10px] text-gray-400">변화의 파도<InfoTip text={"그 해/달에 일어날 수 있는 변화의 강도예요.\n🟢 초록 = 좋은 방향의 변화\n🔴 빨강 = 도전적 변화\n막대가 클수록 변화가 큰 시기예요."} /></div>
            </div>
            <div className="h-[70px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
              <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{left: 8, right: 8}}/><YAxis domain={[0,8]} hide={true} width={0}/>
              <Tooltip content={<SubTooltip decimals={1} monthly={isMonthly}/>}/>
              {markerYear != null && <ReferenceLine x={markerYear} stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>}
              <Bar dataKey="energyTotal" isAnimationActive={false}>{mergedData.map((d,i) => <Cell key={i} fill={d.energyDirection>=0?'#27ae60':'#e74c3c'} fillOpacity={0.7}/>)}</Bar>
            </BarChart></ResponsiveContainer></div></div>
          )}
          {auxPanels.noble && (
            <div><div className="text-[10px] text-gray-400 text-right pr-2 mb-0.5">귀인의 도움<InfoTip text={"주변 사람과의 관계 에너지예요.\n양수 → 도움을 주는 인연이 활성화\n음수 → 관계에서 마찰이 생기기 쉬운 시기"} /></div>
            <div className="h-[70px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
              <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{left: 8, right: 8}}/><YAxis domain={[-15,15]} hide={true} width={0}/>
              <Tooltip content={<SubTooltip decimals={0} monthly={isMonthly}/>}/><ReferenceLine y={0} stroke="#666"/>
              {markerYear != null && <ReferenceLine x={markerYear} stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>}
              <Bar dataKey="noblePower" isAnimationActive={false}>{mergedData.map((d,i) => <Cell key={i} fill={d.noblePower>=0?'#f39c12':'#8e44ad'} fillOpacity={0.7}/>)}</Bar>
            </BarChart></ResponsiveContainer></div></div>
          )}
          {auxPanels.ohang && (
            <div><div className="text-[10px] text-gray-400 text-right pr-2 mb-0.5">오행 균형도<InfoTip text={"목·화·토·금·수 다섯 기운의 균형 정도예요.\n0.5에 가까울수록 균형이 잘 맞고,\n0이나 1에 가까우면 특정 기운이 치우쳐 있다는 뜻이에요."} /></div>
            <div className="h-[70px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
              <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{left: 8, right: 8}}/><YAxis domain={[0,1]} hide={true} width={0}/>
              <Tooltip content={<SubTooltip monthly={isMonthly}/>}/><ReferenceLine y={0.5} stroke="#999" strokeDasharray="3 3"/>
              {markerYear != null && <ReferenceLine x={markerYear} stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>}
              <Line dataKey="ohangBalance" stroke="#3498db" dot={false} strokeWidth={1.5}/>
              {overlayActive && <Line dataKey="ohangBalanceOv" stroke="#fb7185" dot={false} strokeWidth={1.5} strokeDasharray="4 2"/>}
            </LineChart></ResponsiveContainer></div></div>
          )}
          {auxPanels.tengo && (
            <div><div className="text-[10px] text-gray-400 text-right pr-2 mb-0.5">십성 밸런스 {selectedData ? `(${selectedData.year}${isMonthly ? '월' : '년'})` : '- 차트 클릭'}<InfoTip text={"해당 시점의 다섯 가지 에너지 분포예요.\n자아(비겁) = 내 주체성\n표현(식상) = 창의력·표현\n재물(재성) = 돈·현실감각\n직업(관살) = 조직·규율\n학업(인성) = 배움·사고력\n균형이 잡혀야 안정적이에요."} /></div>
            {selectedData ? (() => {
              const rd = [{a:'자아',v:selectedData['tengo비겁'],vO:selectedOverlayData?.['tengo비겁']},{a:'표현',v:selectedData['tengo식상'],vO:selectedOverlayData?.['tengo식상']},{a:'재물',v:selectedData['tengo재성'],vO:selectedOverlayData?.['tengo재성']},{a:'직업',v:selectedData['tengo관살'],vO:selectedOverlayData?.['tengo관살']},{a:'학업',v:selectedData['tengo인성'],vO:selectedOverlayData?.['tengo인성']}]
              const allVals = rd.flatMap(d => [d.v, d.vO]).filter((v): v is number => typeof v === 'number')
              const radarMax = Math.max(Math.ceil(Math.max(...allVals, 1) * 1.3), 2)
              return (<>
                <div className="flex justify-center"><div className="w-[220px] h-[170px]"><ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={rd}>
                    <PolarGrid/><PolarAngleAxis dataKey="a" tick={{fontSize:9}}/><PolarRadiusAxis domain={[0, radarMax]} tick={{fontSize:7}}/>
                    <Radar dataKey="v" stroke="#1abc9c" fill="#1abc9c" fillOpacity={0.3} name={currentName || '나'}/>
                    {overlayActive && <Radar dataKey="vO" stroke="#fb7185" fill="#fb7185" fillOpacity={0.2} name={overlayName}/>}
                  </RadarChart>
                </ResponsiveContainer></div></div>
                <div className="flex justify-center gap-3 mt-1">
                  {rd.map(d => (
                    <span key={d.a} className="text-[9px] text-gray-500">{d.a} <span className="font-semibold text-teal-600">{d.v?.toFixed(1)}</span>
                      {overlayActive && d.vO != null && <span className="text-rose-500 ml-0.5">/{d.vO.toFixed(1)}</span>}
                    </span>
                  ))}
                </div>
                {overlayActive && (
                  <div className="flex justify-center gap-3 mt-0.5 text-[9px]">
                    <span className="text-teal-600">■ {currentName || '나'}</span>
                    <span className="text-rose-500">■ {overlayName}</span>
                  </div>
                )}
              </>)
            })() : <div className="text-center text-gray-300 text-xs py-4">메인 차트에서 연도를 클릭하세요</div>}
            </div>
          )}
          {auxPanels.event && (
            <div><div className="text-[10px] text-gray-400 text-right pr-2 mb-0.5">이벤트 확률 {selectedData ? `(${selectedData.year}${isMonthly ? '월' : '년'})` : '- 차트 클릭'}<InfoTip text={"총운 점수와는 별개로, 특정 사건이 일어날 가능성을 보여줘요.\n예) 총운의 재물 점수 = 재물운의 좋고 나쁨\n이벤트 재물확률 = 큰 돈이 오갈 이벤트가 생길 확률\n높다고 반드시 좋은 건 아니에요."} /></div>
            {selectedData ? (() => {
              const evData = [
                {n:'직업', p:selectedData.eventCareer, pO:selectedOverlayData?.eventCareer ?? 0},
                {n:'연애', p:selectedData.eventLove, pO:selectedOverlayData?.eventLove ?? 0},
                {n:'건강', p:selectedData.eventHealth, pO:selectedOverlayData?.eventHealth ?? 0},
                {n:'재물', p:selectedData.eventWealth, pO:selectedOverlayData?.eventWealth ?? 0},
                {n:'학업', p:selectedData.eventStudy, pO:selectedOverlayData?.eventStudy ?? 0},
                {n:'대인', p:selectedData.eventConflict, pO:selectedOverlayData?.eventConflict ?? 0},
              ]
              return (
                <div style={{ height: overlayActive ? 140 : 120 }}><ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evData} layout="vertical" margin={{left:4,right:24,top:4,bottom:0}}>
                    <XAxis type="number" domain={[0,100]} tick={{fontSize:8}}/>
                    <YAxis type="category" dataKey="n" tick={{fontSize:9}} width={32} interval={0}/>
                    <Bar dataKey="p" isAnimationActive={false} barSize={overlayActive ? 6 : 10} name={currentName || '나'}
                      label={!overlayActive ? {position:'right',fontSize:9,fill:'#666',formatter:(v:number)=>`${v}%`} : undefined}>
                      {['#e74c3c','#e91e63','#ff9800','#4caf50','#2196f3','#9c27b0'].map((c,i)=><Cell key={i} fill={c} fillOpacity={0.8}/>)}
                    </Bar>
                    {overlayActive && (
                      <Bar dataKey="pO" isAnimationActive={false} barSize={6} name={overlayName}>
                        {evData.map((_,i)=><Cell key={i} fill="#fb7185" fillOpacity={0.6}/>)}
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer></div>
              )
            })() : <div className="text-center text-gray-300 text-xs py-4">메인 차트에서 연도를 클릭하세요</div>}
            </div>
          )}
        </div>
      )}

      {/* Fortune Analysis Section */}
      <FortuneSection
        fortuneJson={fortuneJson}
        entryId={entryId}
        entryName={entryName}
        myGender={myGender}
        currentName={currentName}
        isLocked={isLocked}
        onLockedClick={onLockedClick}
        shareMode={shareMode}
        expandCompatCardKey={expandCompatCardKey}
        compatGeneration={compatGeneration}
        onFortuneJsonUpdate={onFortuneJsonUpdate}
      />

      {/* Sliding Panel — indicator settings */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setPanelOpen(false)}>
          <div className="absolute inset-0 bg-black/30"/>
          <div className="relative w-[280px] max-w-[80vw] bg-white h-full shadow-xl overflow-y-auto animate-slide-in-right" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="font-bold text-gray-900 mb-4">차트 지표 설정</h3>
              <div className="mb-5">
                <div className="text-xs font-semibold text-gray-500 mb-2">메인 차트 오버레이</div>
                <div className={isLocked ? '' : 'stagger-fade-in'}>
                  {MAIN_OVERLAYS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => {
                        if (blockIfLocked(o.label)) return
                        toggleMain(o.key)
                      }}
                      className="w-full flex items-center justify-between gap-3 py-3 px-1 -mx-1 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] text-left"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!isLocked && mainOverlays[o.key]}
                          readOnly
                          disabled={isLocked}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 pointer-events-none"
                        />
                        <span className={`text-sm ${isLocked ? 'text-gray-400' : 'text-gray-700'}`}>{o.label}</span>
                      </span>
                      {isLocked && <span className="text-gray-300 text-sm leading-none">🔒</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-5">
                <div className="text-xs font-semibold text-gray-500 mb-0.5">도메인 운세 선 (메인 차트)</div>
                <div className="text-[10px] text-gray-400 mb-2">세운 점수와 같은 운세 점수(0~100) 기준이에요</div>
                <div className={isLocked ? '' : 'stagger-fade-in'}>
                  {DOMAIN_OVERLAYS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => {
                        if (blockIfLocked(o.label)) return
                        toggleDomain(o.key)
                      }}
                      className="w-full flex items-center justify-between gap-3 py-3 px-1 -mx-1 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] text-left"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!isLocked && domainOverlays[o.key]}
                          readOnly
                          disabled={isLocked}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 pointer-events-none"
                        />
                        <span className={`text-sm flex items-center gap-2 ${isLocked ? 'text-gray-400' : 'text-gray-700'}`}>
                          <span className="w-3 h-0.5 rounded" style={{ backgroundColor: o.color, opacity: isLocked ? 0.4 : 1 }} />
                          {o.label}
                        </span>
                      </span>
                      {isLocked && <span className="text-gray-300 text-sm leading-none">🔒</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-5">
                <div className="text-xs font-semibold text-gray-500 mb-2">보조지표 (차트 아래)</div>
                <div className={isLocked ? '' : 'stagger-fade-in'}>
                  {AUX_PANELS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => {
                        if (blockIfLocked(o.label)) return
                        toggleAux(o.key)
                      }}
                      className="w-full flex items-center justify-between gap-3 py-3 px-1 -mx-1 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] text-left"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!isLocked && auxPanels[o.key]}
                          readOnly
                          disabled={isLocked}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 pointer-events-none"
                        />
                        <span className={`text-sm flex items-center gap-2 ${isLocked ? 'text-gray-400' : 'text-gray-700'}`}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: o.color, opacity: isLocked ? 0.4 : 1 }} />
                          {o.label}
                        </span>
                      </span>
                      {isLocked && <span className="text-gray-300 text-sm leading-none">🔒</span>}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setPanelOpen(false)}
                className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition-colors">적용</button>
            </div>
          </div>
        </div>
      )}

      {/* Compare bottom sheet */}
      {compareSheetOpen && (
        <BottomSheet
          onClose={() => setCompareSheetOpen(false)}
          header={<h3 className="font-bold text-gray-900 pt-1 pb-2">누구와 비교할까요?</h3>}
          footer={(
            <button onClick={() => setCompareSheetOpen(false)}
              className="w-full py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">닫기</button>
          )}
        >
          {shareMode && (
            <p className="text-xs text-gray-400 mb-3">차트팔자에 저장된 공인과 비교해볼 수 있어요</p>
          )}
          {!shareMode && <div className="mb-4" />}
          {otherEntries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">비교할 다른 사주가 없습니다</p>
          ) : (
            <div className="space-y-1">
              {otherEntries.map(e => (
                <button key={e.id} onClick={() => {
                  setOverlayEntryId(e.id)
                  setOverlayName(e.name)
                  setOverlayGender(e.gender)
                  setCompareSheetOpen(false)
                  setSelection(null)
                  setYearSummary(null)
                }}
                  className="w-full text-left p-3.5 rounded-xl hover:bg-purple-50 flex items-center gap-3 transition-colors">
                  <SajuCharacterAvatar gender={e.gender === 'female' ? 'female' : 'male'} element={normalizeElement(e.dayElement ?? undefined)} personId={e.id} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm">{e.name}</div>
                    <div className="text-xs text-gray-400">{e.gender === 'female' ? '여성' : '남성'} · {e.birthDate.replace(/-/g, '.')}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!shareMode && entryId && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">친구가 아직 차트팔자에 없나요?</p>
              <button
                type="button"
                onClick={handleInviteFriend}
                disabled={inviteBusy || isLocked}
                className="w-full py-3 rounded-xl text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200/70 hover:bg-purple-100/80 transition-colors disabled:opacity-50"
              >
                {inviteBusy ? '링크 만드는 중…' : '친구 초대하기'}
              </button>
              {inviteUrl && (
                <p className="text-[11px] text-green-600 mt-2 text-center">초대 링크가 복사됐어요</p>
              )}
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  )
}

const HANJA_TO_HANGUL: Record<string, string> = {
  '甲':'갑','乙':'을','丙':'병','丁':'정','戊':'무','己':'기','庚':'경','辛':'신','壬':'임','癸':'계',
  '子':'자','丑':'축','寅':'인','卯':'묘','辰':'진','巳':'사','午':'오','未':'미','申':'신','酉':'유','戌':'술','亥':'해',
  '木':'목','火':'화','土':'토','金':'금','水':'수',
  '長':'장','生':'생','沐':'목','浴':'욕','冠':'관','帶':'대','建':'건','祿':'록',
  '帝':'제','旺':'왕','衰':'쇠','病':'병','死':'사','墓':'묘','絶':'절','胎':'태','養':'양',
  '比':'비','肩':'견','劫':'겁','財':'재','食':'식','神':'신','傷':'상','官':'관',
  '偏':'편','正':'정','七':'칠','殺':'살','印':'인',
  '沖':'충','合':'합','刑':'형','破':'파','害':'해',
}
const HANJA_CHARS = Object.keys(HANJA_TO_HANGUL).join('')
const HANJA_BLOCK_RE = new RegExp(`([${HANJA_CHARS}]{2,})\\(([^)]+)\\)`, 'g')
const HANJA_BARE_RE = new RegExp(`([${HANJA_CHARS}]{2,})`, 'g')

function toHangul(hanja: string): string {
  return [...hanja].map(ch => HANJA_TO_HANGUL[ch] ?? ch).join('')
}

function convertHanjaInText(text: string): string {
  let result = text.replace(HANJA_BLOCK_RE, (_, hj: string) => {
    const hangul = toHangul(hj)
    return hangul === hj ? hj : `${hangul}(${hj})`
  })
  result = result.replace(HANJA_BARE_RE, (match, _g, offset) => {
    const prev = offset > 0 ? result[offset - 1] : ''
    if (prev === '(' || prev === '（') return match
    const hangul = toHangul(match)
    if (hangul === match) return match
    return `${hangul}(${match})`
  })
  return result
}

function cleanFortuneText(text: string): string {
  return convertHanjaInText(text)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/[#*`]/g, '')
}

function renderMarkdown(text: string): string {
  return convertHanjaInText(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')
}

const FORTUNE_QUOTES = [
  '명을 모르면 군자가 될 수 없다. — 공자',
  '나는 오십에 천명을 알았다. — 공자',
  '삶과 죽음은 명에 있고 부귀는 하늘에 있다. — 공자',
  '할 일을 다하고 하늘의 뜻을 기다린다. — 제갈량',
  '일을 꾀하는 것은 사람이고 이루는 것은 하늘이다. — 제갈량',
  '때가 오면 천지마저 힘을 보탠다. — 두보',
  '이것이 바로 명이다. — 장자',
  '행운이란 준비와 기회가 만나는 것이다. — Seneca',
  '운명은 방향을 바꿔도 계속 따라오는 모래폭풍과 같다. — Haruki Murakami',
  '나는 내 삶의 방향은 선택할 수 있지만 운명 자체는 통제할 수 없다. — Paulo Coelho',
  '승자와 패자를 가르는 것은 운명의 변곡점에 어떻게 반응하느냐이다. — Donald Trump',
  '지금 있는 곳이 결국 있어야 할 자리일지도 모른다. — John Lennon',
  '명이 좋아도 운이 좋은 것만 못하고, 운이 좋아도 마음이 좋은 것만 못하다.',
  '인생을 좌우하는 것은 타고난 명, 운, 풍수, 덕, 공부다.',
  '명은 하늘이 정하지만 운은 사람이 만든다.',
  '부귀는 하늘에 달려 있다.',
  '명은 바꿀 수 없지만 운은 바꿀 수 있다.',
  '명이 좋으면 운이 잠시 나빠도 결국 살아난다.',
  '운이 오면 쇠도 금이 된다.',
  '운이 떠나면 영웅도 자유롭지 못하다.',
  '사람의 계산은 천 가지지만 하늘의 계산은 하나다.',
  '명에 있으면 결국 얻게 되고, 명에 없으면 억지로 구해도 얻지 못한다.',
  '운이 오면 자연히 이루어진다.',
  '명은 결국 스스로 세우는 것이다.',
  '복과 화는 문이 없고 사람이 스스로 부른다.',
  '명 다음으로 중요한 것이 운이고, 그 다음이 풍수다.',
  '명에 있으면 결국 온다.',
  '덕은 명을 바꿀 수 있다.',
  '사람의 계산은 하늘의 계산만 못하다.',
  '운명이 충분히 중요하다면, 승산이 없더라도 해야 한다. — Elon Musk',
  '행운은 가장 강력한 초능력이다. 하나만 고를 수 있다면 나는 운을 고르겠다. — Elon Musk',
  '점들을 앞에서 연결할 수는 없다. 뒤를 돌아보며 연결할 뿐이다. — Steve Jobs',
  '성공은 재능만이 아니라 준비와 기회의 만남이다. — Bill Gates',
  '나는 내 운명의 주인이며 내 영혼의 선장이다. — William Ernest Henley',
  '위대한 선수는 재능이 아니라 운이 올 때 준비되어 있는 사람이다. — Michael Jordan',
  '운명은 우리가 받아들이면 우리를 이끌고, 거부하면 우리를 끌고 간다. — Seneca',
  '운은 스스로 만드는 것이다. 나는 더 많이 시도할수록 더 운이 좋아진다. — Richard Branson',
  '성공한 사람들을 보면 단순히 운이 좋은 것이 아니라 운이 왔을 때 준비되어 있다. — Mark Cuban',
  '타이밍은 거의 모든 것이다. 같은 아이디어라도 언제 하느냐가 중요하다. — Marc Andreessen',
  '우리는 미래를 예측하지 않는다. 우리는 미래를 만든다. — Jensen Huang',
  '성공은 재능보다 타이밍에 더 크게 좌우된다. — Naval Ravikant',
  '인생은 긴 확률의 게임이다. 계속 시도하는 사람이 결국 이긴다. — Jeff Bezos',
  '운이란 통제할 수 없는 것과 통제할 수 있는 것이 만나는 지점이다. — Ray Dalio',
  '나는 매우 운이 좋았다. 성공한 사람들은 대부분 그 사실을 인정하지 않지만, 운은 정말 큰 역할을 한다. — Warren Buffett',
  '내 성공에는 능력보다 운이 훨씬 크게 작용했다. — Bill Gates',
  '나는 인생에서 엄청나게 운이 좋았다. — Jeff Bezos',
  '성공은 능력과 노력만으로 설명되지 않는다. 엄청난 운이 필요하다. — Ray Dalio',
  '인생에서 가장 중요한 것은 좋은 카드가 아니라 운이 올 때 그것을 어떻게 쓰느냐다. — Charlie Munger',
  '나는 엄청나게 운이 좋았다고 생각한다. 성공한 사람이라면 그 사실을 인정해야 한다. — Larry Page',
  '성공한 사람들은 대부분 자신이 얼마나 운이 좋았는지 과소평가한다. — Daniel Kahneman',
  '성공한 기업가들의 이야기를 보면 항상 운이 등장한다. — Marc Andreessen',
  '나는 운이 좋았다는 사실을 절대 부정하지 않는다. — Serena Williams',
  '챔피언이 되는 데는 재능과 노력도 필요하지만 운도 필요하다. — Novak Djokovic',
  '나는 내 커리어에서 운이 좋은 순간들을 많이 만났다. — Roger Federer',
]

function FortuneQuoteLoader() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * FORTUNE_QUOTES.length))
  const [animClass, setAnimClass] = useState('translate-y-0 opacity-100')

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimClass('-translate-y-4 opacity-0')
      setTimeout(() => {
        setIdx(prev => {
          let next = Math.floor(Math.random() * FORTUNE_QUOTES.length)
          while (next === prev && FORTUNE_QUOTES.length > 1) next = Math.floor(Math.random() * FORTUNE_QUOTES.length)
          return next
        })
        setAnimClass('translate-y-4 opacity-0')
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setAnimClass('translate-y-0 opacity-100'))
        })
      }, 300)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="pt-3 pb-4 flex flex-col items-center gap-2">
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <div className="h-12 flex items-center justify-center overflow-hidden px-2">
        <p className={`text-xs text-gray-400 text-center leading-relaxed transition-all duration-300 ease-in-out ${animClass}`}>
          {FORTUNE_QUOTES[idx]}
        </p>
      </div>
    </div>
  )
}

type FortuneItem = { category: string; title: string; content: string }

/** 잠금 미리보기용 — 실제 LLM 데이터 없이 운세 해설 카드/아코디언 형태만 흉내낸다. */
function FortunePlaceholder() {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl p-4 bg-purple-50 border border-purple-100">
        <p className="text-xs font-medium mb-1 text-purple-500">당신의 기본 성향</p>
        <p className="text-base font-bold text-gray-900 leading-snug mb-2">
          깊은 사유와 부드러운 결단력을 함께 지닌 사람
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          타고난 감수성과 분석력이 균형 잡혀 있어 직관과 논리를 동시에 잘 쓰는 편이에요.
        </p>
      </div>
      <div className="rounded-2xl p-4 bg-indigo-50 border border-indigo-100">
        <p className="text-xs font-medium mb-1 text-indigo-500">인생의 큰 그림</p>
        <p className="text-base font-bold text-gray-900 leading-snug mb-2">
          30대 후반부터 본격적인 도약기가 펼쳐져요
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          초년의 시행착오가 단단한 기반이 되어 중년 이후 큰 폭의 성장이 가능해요.
        </p>
      </div>
      {['성격과 잠재력', '직업과 커리어', '재물과 투자'].map(t => (
        <div key={t} className="border rounded-xl border-gray-100 p-3.5 flex items-start gap-2.5">
          <span className="text-gray-400 text-sm mt-0.5">▶</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-snug">{t} 해설</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{t}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

interface FortuneSectionProps {
  fortuneJson?: unknown
  entryId?: string
  entryName?: string
  myGender?: string
  currentName?: string
  isLocked?: boolean
  onLockedClick?: (feature: string) => void
  shareMode?: boolean
  expandCompatCardKey?: string | null
  compatGeneration?: CompatGenerationState | null
  onFortuneJsonUpdate?: (fortuneJson: unknown) => void
}

function CompatSpinner() {
  return (
    <span className="inline-flex w-4 h-4 items-center justify-center shrink-0 mt-0.5" aria-hidden>
      <svg className="animate-spin w-3.5 h-3.5 text-rose-400" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity={0.2} />
        <path
          d="M12 3a9 9 0 0 1 9 9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

function FortuneSection({
  fortuneJson, entryId, entryName, myGender, currentName,
  isLocked = false, onLockedClick, shareMode = false,
  expandCompatCardKey, compatGeneration, onFortuneJsonUpdate,
}: FortuneSectionProps) {
  const [shareBusyKey, setShareBusyKey] = useState<string | null>(null)
  const [shareCopiedKey, setShareCopiedKey] = useState<string | null>(null)
  const [menuOpenKey, setMenuOpenKey] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CompatReportEntry | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [items, setItems] = useState<FortuneItem[]>([])
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())
  const [openCompatIds, setOpenCompatIds] = useState<Set<string>>(new Set())
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [juShortage, setJuShortage] = useState<{ needed: number; current: number } | null>(null)
  const fetchedRef = React.useRef(false)
  const compatSectionRef = React.useRef<HTMLDivElement>(null)

  const compatCards = useMemo(() => {
    if (shareMode) return [] as Array<{ key: string; entry: CompatReportEntry }>
    const fromJson = listCompatEntries(fortuneJson)
    if (!compatGeneration) return fromJson
    const cardKey = compatCardKey(compatGeneration.partnerId, compatGeneration.relationship)
    const exists = fromJson.some(c => compatCardKey(c.entry.partnerId, c.entry.relationship) === cardKey)
    if (exists) return fromJson
    const placeholder: CompatReportEntry = {
      partnerId: compatGeneration.partnerId,
      partnerName: compatGeneration.partnerName,
      partnerGender: '',
      relationship: compatGeneration.relationship,
      type: compatGeneration.type,
      text: '',
      createdAt: '',
    }
    return [{ key: `pending_${cardKey}`, entry: placeholder }, ...fromJson]
  }, [fortuneJson, shareMode, compatGeneration])

  const getHeaders = useCallback(() => {
    const h: Record<string, string> = {}
    const gid = getGuestId()
    if (gid) h['x-guest-id'] = gid
    return h
  }, [])

  const fetchFortune = useCallback((regen = false) => {
    if (!entryId) return
    if (isLocked || shareMode) return
    setError(null); setJuShortage(null); setAiLoading(true)
    const url = regen ? `/api/saju/${entryId}/fortune?regenerate=true` : `/api/saju/${entryId}/fortune`
    fetch(url, { headers: getHeaders() })
      .then(async r => {
        const d = await r.json().catch(() => null)
        if (r.status === 401) { throw new Error('login_required') }
        if (r.status === 402) {
          setJuShortage({ needed: READING_COST.fortune, current: (d as { ju?: number } | null)?.ju ?? 0 })
          throw new Error('이용권 부족')
        }
        if (!r.ok) throw new Error(d?.error ?? '운세 해설을 불러오지 못했습니다')
        return d
      })
      .then(d => { if (d?.items?.length) { setItems(d.items); fetchedRef.current = true } else setError('운세 해설 데이터가 없습니다') })
      .catch(e => {
        if (e?.message === 'login_required') return
        if (!e?.message?.includes('이용권')) setError(e?.message ?? '오류가 발생했습니다')
      })
      .finally(() => setAiLoading(false))
  }, [entryId, getHeaders, isLocked, shareMode])

  useEffect(() => {
    let arr: FortuneItem[] = []
    if (fortuneJson) {
      if (Array.isArray(fortuneJson)) arr = fortuneJson as FortuneItem[]
      else if (typeof fortuneJson === 'object' && fortuneJson !== null && 'items' in fortuneJson) {
        const raw = (fortuneJson as { items?: unknown[] }).items
        if (Array.isArray(raw)) arr = raw as FortuneItem[]
      }
    }
    if (arr.length) { setItems(arr); setError(null); fetchedRef.current = true }
    else if (entryId && !fetchedRef.current && !isLocked && !shareMode) { fetchedRef.current = true; fetchFortune() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fortuneJson, entryId, isLocked, shareMode])

  const toggle = (i: number) => setOpenIds(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })
  const toggleCompat = (cardKey: string, canToggle: boolean) => {
    if (!canToggle) return
    setOpenCompatIds(p => {
      const n = new Set(p)
      n.has(cardKey) ? n.delete(cardKey) : n.add(cardKey)
      return n
    })
  }

  const handleCompatShare = useCallback(async (ce: CompatReportEntry, busyKey?: string) => {
    if (!entryId || !ce.text) return
    if (busyKey) setShareBusyKey(busyKey)
    try {
      const headers = getHeaders()
      const thisYear = new Date().getFullYear()
      let myScore = 0
      let partnerScore = 0
      const [myRes, partnerRes] = await Promise.all([
        fetch(`/api/saju/${entryId}`, { headers }),
        fetch(`/api/saju/${ce.partnerId}?contextEntryId=${encodeURIComponent(entryId)}`, { headers }),
      ])
      if (myRes.ok && partnerRes.ok) {
        const myData = await myRes.json()
        const partnerData = await partnerRes.json()
        const byA = parseInt(String(myData.birthDate ?? '').slice(0, 4), 10)
        const byB = parseInt(String(partnerData.birthDate ?? '').slice(0, 4), 10)
        const chartA = buildLifeChartData(
          (myData.sajuReportJson as SajuReportJson)?.chartData as ChartPayload | undefined,
          myData.sajuReportJson as SajuReportJson,
          byA,
        )
        const chartB = buildLifeChartData(
          (partnerData.sajuReportJson as SajuReportJson)?.chartData as ChartPayload | undefined,
          partnerData.sajuReportJson as SajuReportJson,
          byB,
        )
        myScore = Math.round(chartA?.data.find(d => d.year === thisYear)?.score ?? 0)
        partnerScore = Math.round(chartB?.data.find(d => d.year === thisYear)?.score ?? 0)
      }
      const snapshot = {
        enabled: true,
        sharedAt: new Date().toISOString(),
        myScore,
        partnerScore,
        type: ce.type,
        relationship: ce.relationship,
        partnerName: ce.partnerName,
      }
      const patchHeaders = { ...headers, 'Content-Type': 'application/json' }
      await fetch(`/api/saju/${entryId}`, {
        method: 'PATCH',
        headers: patchHeaders,
        body: JSON.stringify({
          compatShare: {
            partnerId: ce.partnerId,
            relationship: ce.relationship,
            enabled: true,
            snapshot,
          },
        }),
      })
      const shareKey = compatShareStorageKey(ce.partnerId, ce.relationship)
      const existing = (fortuneJson && typeof fortuneJson === 'object')
        ? { ...(fortuneJson as Record<string, unknown>) }
        : {}
      onFortuneJsonUpdate?.({
        ...existing,
        [shareKey]: { ...snapshot, enabled: true, sharedAt: snapshot.sharedAt },
      })
      const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const url = `${siteUrl}/share/${entryId}/compat/${ce.partnerId}?rel=${ce.relationship}`
      await navigator.clipboard.writeText(url)
    } catch { /* ignore */ }
    setShareBusyKey(null)
  }, [entryId, getHeaders, fortuneJson, onFortuneJsonUpdate])

  const handleCompatShareFromMenu = useCallback(async (ce: CompatReportEntry, cardKey: string) => {
    setShareBusyKey(cardKey)
    await handleCompatShare(ce, cardKey)
    setShareCopiedKey(cardKey)
    window.setTimeout(() => setShareCopiedKey(k => (k === cardKey ? null : k)), 2000)
  }, [handleCompatShare])

  const handleCompatDelete = useCallback(async () => {
    if (!entryId || !deleteTarget) return
    setDeleteBusy(true)
    try {
      const headers = { ...getHeaders(), 'Content-Type': 'application/json' }
      const res = await fetch(`/api/saju/${entryId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          deleteCompat: {
            partnerId: deleteTarget.partnerId,
            relationship: deleteTarget.relationship,
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.fortuneJson) onFortuneJsonUpdate?.(data.fortuneJson)
        const ck = compatCardKey(deleteTarget.partnerId, deleteTarget.relationship)
        setOpenCompatIds(prev => {
          const n = new Set(prev)
          n.delete(ck)
          return n
        })
      }
    } catch { /* ignore */ }
    setDeleteBusy(false)
    setDeleteTarget(null)
  }, [entryId, deleteTarget, getHeaders, onFortuneJsonUpdate])

  useEffect(() => {
    if (!compatGeneration) return
    requestAnimationFrame(() => {
      compatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [compatGeneration])

  useEffect(() => {
    if (!expandCompatCardKey) return
    const saved = listCompatEntries(fortuneJson).find(
      c => compatCardKey(c.entry.partnerId, c.entry.relationship) === expandCompatCardKey,
    )
    if (!saved?.entry.text) return
    setOpenCompatIds(prev => new Set(prev).add(expandCompatCardKey))
    requestAnimationFrame(() => {
      compatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [expandCompatCardKey, fortuneJson])

  useEffect(() => {
    const handleExpandAll = () => setOpenIds(new Set(items.map((_, i) => i)))
    window.addEventListener('fortune-expand-all', handleExpandAll)
    return () => window.removeEventListener('fortune-expand-all', handleExpandAll)
  }, [items])

  const isLoading = aiLoading && !items.length
  const TOP_CATEGORIES = ['당신의 기본 성향', '한 줄 사주', '인생의 큰 그림']
  const isNewFormat = items.length >= 2 && TOP_CATEGORIES.includes(items[0]?.category)
  const topCards = isNewFormat ? items.slice(0, 2) : []
  const accordionItems = isNewFormat ? items.slice(2) : items
  const accordionOffset = isNewFormat ? 2 : 0

  const compatSection = compatCards.length > 0 ? (
    <div ref={compatSectionRef} className="space-y-2 mb-3">
      {compatCards.map(({ key, entry: ce }) => {
        const cardKey = compatCardKey(ce.partnerId, ce.relationship)
        const isGenerating = !ce.text && compatGeneration?.partnerId === ce.partnerId
          && compatGeneration.relationship === ce.relationship
        const canToggle = !isGenerating && !!ce.text
        const isOpen = canToggle && openCompatIds.has(cardKey)
        return (
          <div
            key={key}
            className={`group relative border rounded-xl border-rose-100 bg-rose-50/30 transition-colors ${
              isGenerating ? 'opacity-95' : ''
            } ${!isGenerating && canToggle ? (isOpen ? 'bg-rose-50' : 'hover:bg-rose-50/60 active:bg-rose-50/80') : ''}`}
          >
            <div className="flex items-center">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => toggleCompat(cardKey, canToggle)}
                className={`flex-1 text-left p-3.5 flex items-center gap-2.5 min-w-0 ${
                  isGenerating ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                {isGenerating ? (
                  <CompatSpinner />
                ) : (
                  <span className="text-rose-400 text-sm mt-0.5">{isOpen ? '▼' : '▶'}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{ce.partnerName}님과의 궁합</p>
                  <p className="text-[11px] text-rose-500 mt-0.5">
                    {isGenerating
                      ? '해설을 작성하고 있어요…'
                      : `${RELATIONSHIP_LABELS[ce.relationship]} · ${ce.type}`}
                  </p>
                </div>
              </button>
              {ce.text && !shareMode && !isGenerating && (
                <div className="relative shrink-0 self-center">
                  <button
                    type="button"
                    onClick={ev => { ev.stopPropagation(); setMenuOpenKey(menuOpenKey === cardKey ? null : cardKey) }}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="메뉴"
                  >
                    &#x22EE;
                  </button>
                  {menuOpenKey === cardKey && (
                    <>
                      <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpenKey(null)} />
                      <div className="absolute top-1/2 -translate-y-1/2 right-9 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden w-[68px]">
                        <button
                          type="button"
                          disabled={shareBusyKey === cardKey && shareCopiedKey !== cardKey}
                          onClick={() => handleCompatShareFromMenu(ce, cardKey)}
                          className="block w-full text-center px-2 py-2 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          {shareCopiedKey === cardKey ? (
                            <span className="text-green-600 font-medium">✓</span>
                          ) : shareBusyKey === cardKey ? (
                            '...'
                          ) : (
                            '공유'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setMenuOpenKey(null); setDeleteTarget(ce) }}
                          className="block w-full text-center px-2 py-2 text-xs text-red-600 hover:bg-red-50 border-t border-gray-100"
                        >
                          삭제
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {isOpen && ce.text && (
              <div className="px-4 pb-4 pt-1 border-t border-rose-100/80 animate-fade-in">
                <div className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(ce.text) }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  ) : null

  if (isLocked) {
    return (
      <div className="px-4 mt-6">
        <h3 className="font-bold text-gray-900 mb-3">운세 해설</h3>
        <LockedPreview
          onUnlock={() => onLockedClick?.('운세 해설')}
          ariaLabel="운세 해설 — 로그인하면 풀려요"
          /* 첫 "한 줄 해설" 카드(약 130px) 하단에 배지 하단을 맞춘다(배지 ~36px). */
          badgeOffsetTop={94}
        >
          <FortunePlaceholder />
        </LockedPreview>
      </div>
    )
  }

  return (
    <div className="px-4 mt-6">
      <h3 className="font-bold text-gray-900 mb-3">운세 해설</h3>

      {juShortage && (
        <JuShortageNudge
          needed={juShortage.needed}
          current={juShortage.current}
          onDismiss={() => setJuShortage(null)}
        />
      )}

      {compatSection}

      {isLoading ? (
        <FortuneQuoteLoader />
      ) : juShortage ? (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-center">
          <p className="text-sm text-gray-700 font-medium">주(株)가 부족해요</p>
          <p className="text-xs text-gray-500 mt-1">운세 해설은 {READING_COST.fortune}주가 필요해요.</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-600">해설을 불러오는 중 문제가 발생했습니다.</p>
          {error.includes('GEMINI_API_KEY') && (
            <p className="text-xs text-gray-500 mt-2">프로젝트 루트에 .env.local 파일을 만들고 GEMINI_API_KEY=발급받은키 를 추가한 뒤 서버를 재시작하세요.</p>
          )}
          <button onClick={() => fetchFortune()} className="mt-3 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">다시 시도</button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-6">운세 해설을 불러오는 중...</div>
      ) : (
        <div className="space-y-2">
          {topCards.map((card, i) => {
            const displayCategory = card.category === '한 줄 사주' ? '당신의 기본 성향' : card.category
            return (
            <div key={`card-${i}`} data-capture={i === 0 ? '03_기본성향' : '04_인생의큰그림'}
              className={`rounded-2xl p-4 ${i === 0 ? 'bg-purple-50 border border-purple-100' : 'bg-indigo-50 border border-indigo-100'}`}>
              <p className={`text-xs font-medium mb-1 ${i === 0 ? 'text-purple-500' : 'text-indigo-500'}`}>{displayCategory}</p>
              <p className="text-base font-bold text-gray-900 leading-snug mb-2">{card.title}</p>
              <div className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(card.content) }} />
            </div>
          )})}
          {accordionItems.map((item, i) => {
            const realIdx = i + accordionOffset
            return (
              <div key={realIdx}
                data-capture={['05_성격과잠재력','06_직업과커리어','07_재물과투자','08_인연과관계','09_건강과에너지','10_결혼과가정','11_개운법'][i] || undefined}
                className="border rounded-xl overflow-hidden border-gray-100">
                <button onClick={() => toggle(realIdx)}
                  className={`w-full text-left p-3.5 flex items-start gap-2.5 transition-colors ${openIds.has(realIdx) ? 'bg-gray-50' : 'hover:bg-gray-50/50'}`}>
                  <span className="text-gray-400 text-sm mt-0.5">{openIds.has(realIdx) ? '▼' : '▶'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{item.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{item.category}</p>
                  </div>
                </button>
                {openIds.has(realIdx) && (
                  <div className="px-4 pb-4 pt-1">
                    <div className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(item.content) }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => !deleteBusy && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            onClick={ev => ev.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">궁합 해설 삭제</h3>
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-700">{deleteTarget.partnerName}</span>
                {' · '}
                {RELATIONSHIP_LABELS[deleteTarget.relationship]} 궁합 해설을 삭제할까요?
              </p>
              <p className="text-xs text-gray-400 mt-1">삭제된 해설은 복구할 수 없습니다.</p>
            </div>
            <div className="grid grid-cols-2 border-t border-gray-100">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
                className="py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={handleCompatDelete}
                className="py-3.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
              >
                {deleteBusy ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
