'use client'

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import {
  ResponsiveContainer, ComposedChart, LineChart, BarChart, AreaChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Line, Bar, Area, XAxis, YAxis, Tooltip,
  ReferenceArea, ReferenceLine, Cell, Customized,
} from 'recharts'
import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload, ScoreBreakdown } from '@/types/chart'
import { buildLifeChartData } from '@/lib/saju/life-chart-data'
import type { ChartDatum, SeasonBand } from '@/lib/saju/life-chart-data'
import { pillarToHangul } from '@/lib/saju/hanja-hangul'

const THIS_YEAR = new Date().getFullYear()
const THIS_MONTH = new Date().getMonth() + 1
const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = React.useRef<HTMLSpanElement>(null)
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return (
    <span ref={ref} className="relative inline-block ml-1">
      <button onClick={() => setOpen(!open)} className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[8px] leading-none hover:bg-gray-300 focus:outline-none inline-flex items-center justify-center font-normal" aria-label="정보">i</button>
      {open && (
        <div className="absolute right-0 top-5 z-50 w-52 p-2.5 rounded-lg bg-white shadow-lg border border-gray-100 text-[10px] text-gray-600 leading-relaxed font-normal">
          {text}
        </div>
      )}
    </span>
  )
}

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
  { key: 'yongshin', label: '유리한 흐름', color: '#9b59b6' },
  { key: 'energy', label: '변화의 파도', color: '#95a5a6' },
  { key: 'noble', label: '귀인의 도움', color: '#f39c12' },
  { key: 'ohang', label: '오행 균형도', color: '#3498db' },
  { key: 'tengo', label: '십성 밸런스', color: '#1abc9c' },
  { key: 'event', label: '이벤트 확률', color: '#e74c3c' },
] as const

type PeriodKey = '1y' | '5y' | '10y' | 'all'
type MainOverlayKey = (typeof MAIN_OVERLAYS)[number]['key']
type AuxKey = (typeof AUX_PANELS)[number]['key']

const BD_LABEL: Record<string, string> = {
  yongshin_fit: '용신부합', unseong: '12운성', unseong_context: '12운성맥락',
  relations: '관계', trine: '삼합/방합', balance: '오행균형', shinsal: '신살',
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
    const label = BD_LABEL[k] ?? k
    ;(v >= 0 ? up : down).push(`${label} ${v >= 0 ? '+' : ''}${v.toFixed(1)}`)
  }
  return { up: up.slice(0, 2), down: down.slice(0, 2) }
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
  const { formattedGraphicalItems, xAxisMap, yAxisMap, period, hoverYear, isMonthly } = props
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
  if (hoverYear != null) {
    const isCurrentMarker = isMonthly ? hoverYear === THIS_MONTH : (period === 'all' && hoverYear === THIS_YEAR)
    if (!isCurrentMarker) {
      const hx = xAxis.scale(hoverYear)
      if (typeof hx === 'number' && !isNaN(hx)) {
        elements.push(<text key="hover-yr" x={hx} y={labelY} textAnchor="middle" fontSize={8} fill="#6b7280">{isMonthly ? `${hoverYear}월` : hoverYear}</text>)
      }
    }
  }
  return elements.length ? <g>{elements}</g> : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MainTooltip({ active, payload, overlays, monthly, overlayActive, overlayName, currentName }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as (MergedDatum) | undefined
  if (!d) return null
  const ov = overlays as Record<MainOverlayKey, boolean> | undefined

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
}

type MergedDatum = ChartDatum & {
  scoreOv?: number; trendOv?: number; daewoonPillarOv?: string
  yongshinPowerOv?: number; energyTotalOv?: number; energyDirectionOv?: number
  noblePowerOv?: number; ohangBalanceOv?: number
}

interface ChartTabProps {
  report: SajuReportJson | null
  birthYear: number | null
  fortuneJson?: unknown
  entryId?: string
  currentName?: string
  currentGender?: string
  overlayEntries?: OverlayEntry[]
}

export function ChartTab({ report, birthYear, fortuneJson, entryId, currentName, currentGender, overlayEntries }: ChartTabProps) {
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [panelOpen, setPanelOpen] = useState(false)
  const [mainOverlays, setMainOverlays] = useState<Record<MainOverlayKey, boolean>>({ daewoon: false, candle: false, season: false })
  const [auxPanels, setAuxPanels] = useState<Record<AuxKey, boolean>>({ yongshin: false, energy: false, noble: false, ohang: false, tengo: false, event: false })
  const [hoverYear, setHoverYear] = useState<number | null>(null)
  const [selection, setSelection] = useState<{ startYear: number; endYear: number } | null>(null)
  const [yearSummary, setYearSummary] = useState<{ startYear: number; endYear: number; text: string; compatText?: string } | null>(null)
  const [yearSummaryLoading, setYearSummaryLoading] = useState(false)
  const [summaryCache] = useState<Map<string, { text: string; compatText?: string }>>(() => new Map())
  const chartRef = React.useRef<HTMLDivElement>(null)
  const lastHapticYear = React.useRef<number | null>(null)
  const dragStartYear = React.useRef<number | null>(null)
  const isDragging = React.useRef(false)
  const hasAnimated = React.useRef(false)

  useEffect(() => {
    const t = setTimeout(() => { hasAnimated.current = true }, 2500)
    return () => clearTimeout(t)
  }, [])

  // Overlay (comparison) state
  const [overlayEntryId, setOverlayEntryId] = useState<string | null>(null)
  const [overlayReport, setOverlayReport] = useState<SajuReportJson | null>(null)
  const [overlayBirthYear, setOverlayBirthYear] = useState<number | null>(null)
  const [overlayName, setOverlayName] = useState('')
  const [overlayGender, setOverlayGender] = useState('')
  const [compareSheetOpen, setCompareSheetOpen] = useState(false)
  const overlayFetchedRef = React.useRef<string | null>(null)

  useEffect(() => {
    if (!overlayEntryId) { setOverlayReport(null); setOverlayBirthYear(null); overlayFetchedRef.current = null; return }
    if (overlayEntryId === overlayFetchedRef.current) return
    overlayFetchedRef.current = overlayEntryId
    const gid = typeof window !== 'undefined' ? localStorage.getItem('saju_guest_id') : null
    const headers: Record<string, string> = {}
    if (gid) headers['x-guest-id'] = gid
    fetch(`/api/saju/${overlayEntryId}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.sajuReportJson) {
          setOverlayReport(d.sajuReportJson)
          setOverlayBirthYear(parseInt(d.birthDate.slice(0, 4), 10))
          setOverlayName(d.name || '')
          setOverlayGender(d.gender || '')
        }
      })
      .catch(() => {})
  }, [overlayEntryId])

  const clearOverlay = useCallback(() => {
    setOverlayEntryId(null); setOverlayReport(null); setOverlayBirthYear(null)
    setOverlayName(''); setOverlayGender('')
    setSelection(null); setYearSummary(null)
  }, [])

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
      case '5y': filtered = all.filter(d => d.year >= THIS_YEAR && d.year < THIS_YEAR + 5); break
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

  const mergedData = useMemo<MergedDatum[]>(() => {
    if (!overlayActive) return filteredData
    const ovSrc = isMonthly ? overlayChartData!.monthlyData : overlayChartData!.data
    if (!ovSrc?.length) return filteredData
    const ovMap = new Map(ovSrc.map(d => [d.year, d]))
    return filteredData.map(d => {
      const ov = ovMap.get(d.year)
      if (!ov) return d
      return { ...d, scoreOv: ov.score, trendOv: ov.trend, daewoonPillarOv: ov.daewoonPillar,
        yongshinPowerOv: ov.yongshinPower, energyTotalOv: ov.energyTotal,
        energyDirectionOv: ov.energyDirection, noblePowerOv: ov.noblePower, ohangBalanceOv: ov.ohangBalance }
    })
  }, [filteredData, overlayActive, overlayChartData, isMonthly])

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

  const currentYearScore = useMemo(() => {
    const target = isMonthly ? THIS_MONTH : THIS_YEAR
    const d = mergedData.find(d => d.year === target)
    return d ? Math.round(d.score) : null
  }, [mergedData, isMonthly])

  const selectedData = useMemo(() => {
    const yr = hoverYear ?? selection?.startYear
    return yr ? mergedData.find(d => d.year === yr) ?? null : null
  }, [hoverYear, selection, mergedData])

  const selectedOverlayData = useMemo(() => {
    if (!overlayActive) return null
    const yr = hoverYear ?? selection?.startYear
    if (!yr) return null
    const ovSrc = isMonthly ? overlayChartData!.monthlyData : overlayChartData!.data
    return ovSrc?.find(d => d.year === yr) ?? null
  }, [hoverYear, selection, overlayActive, overlayChartData, isMonthly])

  const hasEngineData = !!(chartPayload?.['연도별_타임라인']?.length)
  const seasonBands = fullChartData?.seasonBands ?? []

  const fetchSummary = useCallback((startYear: number, endYear: number, monthly = false) => {
    if (!entryId) return
    const prefix = monthly ? 'm_' : ''
    const ovSuffix = overlayEntryId ? `_ov${overlayEntryId.slice(0, 6)}` : ''
    const cacheKey = startYear === endYear ? `${prefix}${startYear}${ovSuffix}` : `${prefix}${startYear}_${endYear}${ovSuffix}`
    const cached = summaryCache.get(cacheKey)
    if (cached) { setYearSummary({ startYear, endYear, ...cached }); return }
    setYearSummaryLoading(true); setYearSummary(null)
    const gid = typeof window !== 'undefined' ? localStorage.getItem('saju_guest_id') : null
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
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error ?? 'Failed'); return d })
      .then(d => {
        const result = { text: d?.summary ?? '해석을 불러오지 못했습니다.', compatText: d?.compatSummary }
        summaryCache.set(cacheKey, result)
        setYearSummary({ startYear, endYear, ...result })
      })
      .catch(() => setYearSummary({ startYear, endYear, text: '해설을 불러오지 못했습니다.' }))
      .finally(() => setYearSummaryLoading(false))
  }, [entryId, summaryCache, overlayEntryId])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseDown = useCallback((state: any) => {
    if (state?.activeTooltipIndex != null) {
      const yr = mergedData[state.activeTooltipIndex]?.year
      if (yr) { dragStartYear.current = yr; isDragging.current = false }
    }
  }, [mergedData])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseUp = useCallback((state: any) => {
    const startYr = dragStartYear.current; dragStartYear.current = null
    if (!startYr) return
    const endIdx = state?.activeTooltipIndex
    const endYr = endIdx != null ? mergedData[endIdx]?.year : null
    if (endYr && endYr !== startYr) {
      setSelection({ startYear: Math.min(startYr, endYr), endYear: Math.max(startYr, endYr) })
    } else {
      if (selection && selection.startYear === startYr && selection.endYear === startYr) return
      setSelection({ startYear: startYr, endYear: startYr })
    }
  }, [mergedData, selection])

  const toggleMain = (k: MainOverlayKey) => setMainOverlays(p => ({ ...p, [k]: !p[k] }))
  const toggleAux = (k: AuxKey) => setAuxPanels(p => ({ ...p, [k]: !p[k] }))

  if (!fullChartData) {
    return <div className="py-12 text-center text-gray-400 text-sm">차트 데이터가 없습니다.</div>
  }

  const anyAux = Object.values(auxPanels).some(Boolean)
  const otherEntries = overlayEntries?.filter(e => e.id !== entryId) ?? []

  return (
    <div>
      {/* Chart area */}
      <div className="relative px-2 pt-3" data-capture="01_메인차트">
        {/* Settings gear — top-right of chart area */}
        <button onClick={() => setPanelOpen(true)}
          className="absolute top-3 right-3 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-white/80 backdrop-blur border border-gray-200/60 hover:bg-white hover:border-gray-300 transition-all shadow-sm">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </button>

        {/* Overlay legend — fixed height to prevent layout shift */}
        <div className="h-4 flex justify-center items-center gap-3">
          {overlayActive && (<>
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className="w-4 h-0.5 bg-emerald-400 rounded inline-block" /> {currentName || '나'}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className="w-4 h-0.5 bg-rose-400 rounded inline-block" /> {overlayName}
            </span>
          </>)}
        </div>

        {/* Main chart */}
        <div className="w-full h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={mergedData} syncId="lc" margin={MARGIN}
                onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}
                onMouseMove={(state: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                  if (state?.activeTooltipIndex != null) {
                    const yr = mergedData[state.activeTooltipIndex]?.year ?? null
                    setHoverYear(yr)
                    if (yr && yr !== lastHapticYear.current) { lastHapticYear.current = yr; if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(3) }
                    if (dragStartYear.current && yr && yr !== dragStartYear.current) isDragging.current = true
                  }
                }}
                onMouseLeave={() => { setHoverYear(null); lastHapticYear.current = null; dragStartYear.current = null }}>
              <XAxis dataKey="year" type="number" domain={xDomain} tick={{ fontSize: 8 }} angle={isMonthly ? 0 : -45} textAnchor={isMonthly ? 'middle' : 'end'} height={40}
                    ticks={isMonthly ? [1,2,3,4,5,6,7,8,9,10,11,12] : (period === '5y' || period === '10y') ? filteredData.map(d => d.year) : undefined}
                    tickCount={period === 'all' ? 10 : undefined}
                    tickFormatter={isMonthly ? (v: number) => MONTH_LABELS[v - 1] ?? '' : undefined}
                    padding={{left: 8, right: 8}}/>
              <YAxis domain={yDomain} hide={true} width={0}/>
              <Tooltip content={<MainTooltip overlays={mainOverlays} monthly={isMonthly} overlayActive={overlayActive} overlayName={overlayName} currentName={currentName}/>} cursor={{ stroke: '#a78bfa', strokeWidth: 1, strokeDasharray: '4 2' }}/>
              {currentYearScore != null && <ReferenceLine y={currentYearScore} stroke="#e0e0e0" strokeWidth={0.5} strokeDasharray="3 3" label={{ value: `${currentYearScore}`, position: 'insideLeft', fontSize: 10, fill: '#aaa', offset: 4 }}/>}
              {mainOverlays.season && hasEngineData && seasonBands.map((b: SeasonBand, i: number) => (
                <ReferenceArea key={i} x1={b.startYear} x2={b.endYear} fill={SEASON_COLORS[b.tag] ?? 'rgba(0,0,0,0.03)'} fillOpacity={1}/>
              ))}
              {selection && <ReferenceArea x1={selection.startYear} x2={selection.endYear} fill="#a78bfa" fillOpacity={0.12} stroke="#a78bfa" strokeOpacity={0.3} strokeWidth={1}/>}
              {mainOverlays.daewoon && <Line type="stepAfter" dataKey="trend" stroke="#ffd700" strokeWidth={2} dot={false} name="대운" isAnimationActive={false}/>}
              <Line type="monotone" dataKey="score" stroke="#82ca9d" strokeWidth={1.5} dot={false} name={isMonthly ? '월운' : '세운'} isAnimationActive={!hasAnimated.current} animationDuration={2000} animationEasing="ease-in-out"/>
              {overlayActive && mainOverlays.daewoon && <Line type="stepAfter" dataKey="trendOv" stroke="#fda4af" strokeWidth={2} dot={false} name="대운(비교)" strokeDasharray="6 3" isAnimationActive={false} connectNulls={false}/>}
              {overlayActive && <Line type="monotone" dataKey="scoreOv" stroke="#fb7185" strokeWidth={1.5} dot={false} name={isMonthly ? '월운(비교)' : '세운(비교)'} isAnimationActive={true} animationDuration={1800} animationEasing="ease-in-out" connectNulls={false}/>}
              {mainOverlays.candle && <Bar dataKey="close" name="캔들" shape={<CandleShape/>} isAnimationActive={false}/>}
              <Customized component={(p: any) => <ThisYearMarker {...p} period={period} hoverYear={hoverYear} isMonthly={isMonthly}/>}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {!selection && !yearSummary && (
          <div className="text-center mt-1 mb-0">
            <span className="text-[10px] text-purple-300 animate-pulse">{isMonthly ? '👆 월을 눌러 상세를 확인하세요' : '👆 연도를 누르거나 구간을 드래그하여 해설을 확인하세요'}</span>
          </div>
        )}

        {/* Period selector + compare */}
        <div className="flex justify-center items-center gap-2 mt-2 mb-1" ref={chartRef}>
          {([['1y', '1년'], ['5y', '5년'], ['10y', '10년'], ['all', '전체']] as [PeriodKey, string][]).map(([k, l]) => (
            <button key={k} onClick={() => { setPeriod(k); setSelection(null); setYearSummary(null); setYearSummaryLoading(false) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${period === k ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{l}</button>
          ))}
          {otherEntries.length > 0 && (
            overlayActive ? (
              <button onClick={clearOverlay}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-medium hover:bg-rose-100 transition-all">
                👥 {overlayName} <span className="ml-0.5 text-rose-400">&times;</span>
              </button>
            ) : (
              <button onClick={() => setCompareSheetOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/80 backdrop-blur border border-gray-200/60 hover:bg-white hover:border-gray-300 transition-all shadow-sm group">
                <span className="text-[10px] font-medium text-gray-400 group-hover:text-purple-500 transition-colors">👥 비교</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Selection card */}
      {selection && !yearSummary && !yearSummaryLoading && (
        <div className="mx-4 mt-3 mb-1">
          <div className="relative bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] ring-1 ring-purple-100">
            <button onClick={() => setSelection(null)}
              className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 text-xs leading-none transition-colors">&times;</button>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-600">
                {isMonthly
                  ? (selection.startYear === selection.endYear ? `${selection.startYear}월` : `${selection.startYear}~${selection.endYear}월`)
                  : (selection.startYear === selection.endYear ? `${selection.startYear}년` : `${selection.startYear}~${selection.endYear}년`)}
              </span>
              {(() => {
                const yds = mergedData.filter(d => d.year >= selection.startYear && d.year <= selection.endYear)
                if (!yds.length) return null
                const avg = Math.round(yds.reduce((a, b) => a + b.score, 0) / yds.length)
                return <span className="text-[11px] text-gray-400">평균 {avg}점</span>
              })()}
            </div>
            <button onClick={() => fetchSummary(selection.startYear, selection.endYear, isMonthly)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors">
              {isMonthly
                ? (selection.startYear === selection.endYear ? `${selection.startYear}월 해설 보기` : `${selection.startYear}~${selection.endYear}월 해설 보기`)
                : (selection.startYear === selection.endYear ? `${selection.startYear}년 해설 보기` : `${selection.startYear}~${selection.endYear}년 해설 보기`)}
            </button>
          </div>
        </div>
      )}

      {(yearSummaryLoading || yearSummary) && (
        <div className="mx-4 mt-3 mb-1">
          <div className="relative bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] ring-1 ring-purple-100">
            <button onClick={() => { setYearSummary(null); setYearSummaryLoading(false); setSelection(null) }}
              className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 text-xs leading-none transition-colors">&times;</button>
            {yearSummaryLoading ? (
              <div className="flex items-center gap-2 py-1">
                <div className="w-4 h-4 rounded-full border-2 border-purple-200 border-t-purple-500 animate-spin" />
                <span className="text-xs text-gray-400">해설을 생성하고 있어요...</span>
              </div>
            ) : yearSummary ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-600">
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
                    return <span className="text-[11px] text-gray-400">평균 {avg}점 · 최고 {peak.year}년({Math.round(peak.score)}점)</span>
                  })()}
                </div>
                <p className="text-[13px] text-gray-600 leading-relaxed pr-4">{cleanFortuneText(yearSummary.text)}</p>
                {yearSummary.compatText && (
                  <div className="mt-3 pt-3 border-t border-purple-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">👥 궁합 해설</span>
                      <span className="text-[10px] text-gray-400">{currentName} & {overlayName}</span>
                    </div>
                    <p className="text-[13px] text-gray-600 leading-relaxed">{cleanFortuneText(yearSummary.compatText)}</p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Auxiliary charts */}
      {anyAux && hasEngineData && (
        <div className="px-2 mt-2 space-y-3" data-capture="02_보조지표">
          {auxPanels.yongshin && (
            <div><div className="text-[10px] text-gray-400 text-right pr-2 mb-0.5">유리한 흐름<InfoTip text="용신(내게 가장 필요한 기운)이 얼마나 들어오는지 보여줘요. 양수면 좋은 기운이 충분하고, 음수면 부족한 상태예요." /></div>
            <div className="h-[80px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
              <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{left: 8, right: 8}}/><YAxis domain={[-1,1]} hide={true} width={0}/>
              <Tooltip content={<SubTooltip monthly={isMonthly}/>}/><ReferenceLine y={0} stroke="#666"/>
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
              <div className="text-[10px] text-gray-400">변화의 파도<InfoTip text="그 해/달에 일어날 수 있는 변화의 강도예요. 초록은 좋은 방향의 변화, 빨강은 도전적인 변화를 뜻해요. 막대가 클수록 변화가 큰 시기예요." /></div>
            </div>
            <div className="h-[70px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
              <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{left: 8, right: 8}}/><YAxis domain={[0,8]} hide={true} width={0}/>
              <Tooltip content={<SubTooltip decimals={1} monthly={isMonthly}/>}/>
              <Bar dataKey="energyTotal" isAnimationActive={false}>{mergedData.map((d,i) => <Cell key={i} fill={d.energyDirection>=0?'#27ae60':'#e74c3c'} fillOpacity={0.7}/>)}</Bar>
            </BarChart></ResponsiveContainer></div></div>
          )}
          {auxPanels.noble && (
            <div><div className="text-[10px] text-gray-400 text-right pr-2 mb-0.5">귀인의 도움<InfoTip text="주변 사람과의 관계 에너지예요. 양수면 도움을 주는 인연이 활성화되고, 음수면 관계에서 마찰이 생기기 쉬운 시기예요." /></div>
            <div className="h-[70px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
              <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{left: 8, right: 8}}/><YAxis domain={[-15,15]} hide={true} width={0}/>
              <Tooltip content={<SubTooltip decimals={0} monthly={isMonthly}/>}/><ReferenceLine y={0} stroke="#666"/>
              <Bar dataKey="noblePower" isAnimationActive={false}>{mergedData.map((d,i) => <Cell key={i} fill={d.noblePower>=0?'#f39c12':'#8e44ad'} fillOpacity={0.7}/>)}</Bar>
            </BarChart></ResponsiveContainer></div></div>
          )}
          {auxPanels.ohang && (
            <div><div className="text-[10px] text-gray-400 text-right pr-2 mb-0.5">오행 균형도<InfoTip text="목·화·토·금·수 다섯 기운의 균형 정도예요. 0.5에 가까울수록 균형이 잘 맞는 거고, 0이나 1에 가까우면 특정 기운이 치우쳐 있다는 뜻이에요." /></div>
            <div className="h-[70px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
              <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{left: 8, right: 8}}/><YAxis domain={[0,1]} hide={true} width={0}/>
              <Tooltip content={<SubTooltip monthly={isMonthly}/>}/><ReferenceLine y={0.5} stroke="#999" strokeDasharray="3 3"/>
              <Line dataKey="ohangBalance" stroke="#3498db" dot={false} strokeWidth={1.5}/>
              {overlayActive && <Line dataKey="ohangBalanceOv" stroke="#fb7185" dot={false} strokeWidth={1.5} strokeDasharray="4 2"/>}
            </LineChart></ResponsiveContainer></div></div>
          )}
          {auxPanels.tengo && (
            <div><div className="text-[10px] text-gray-400 text-right pr-2 mb-0.5">십성 밸런스 {selectedData ? `(${selectedData.year}${isMonthly ? '월' : '년'})` : '- 차트 클릭'}<InfoTip text="해당 시점의 다섯 가지 에너지 분포예요. 자아(비겁)=내 주체성, 표현(식상)=창의력·표현, 재물(재성)=돈·현실감각, 직업(관살)=조직·규율, 학업(인성)=배움·사고력. 균형이 잡혀야 안정적이에요." /></div>
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
            <div><div className="text-[10px] text-gray-400 text-right pr-2 mb-0.5">이벤트 확률 {selectedData ? `(${selectedData.year}${isMonthly ? '월' : '년'})` : '- 차트 클릭'}<InfoTip text="총운 점수와는 별개로, 특정 사건이 일어날 가능성을 보여줘요. 총운의 재물 점수는 '재물운의 좋고 나쁨'이고, 이벤트 재물확률은 '큰 돈이 오갈 이벤트가 생길 확률'이에요. 높다고 반드시 좋은 건 아니에요." /></div>
            {selectedData ? (() => {
              const evData = [
                {n:'이직', p:selectedData.eventCareer, pO:selectedOverlayData?.eventCareer ?? 0},
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
      <FortuneSection fortuneJson={fortuneJson} entryId={entryId} />

      {/* Sliding Panel — indicator settings */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setPanelOpen(false)}>
          <div className="absolute inset-0 bg-black/30"/>
          <div className="relative w-[280px] max-w-[80vw] bg-white h-full shadow-xl overflow-y-auto animate-slide-in-right" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="font-bold text-gray-900 mb-4">차트 지표 설정</h3>
              <div className="mb-5">
                <div className="text-xs font-semibold text-gray-500 mb-2">메인 차트 오버레이</div>
                {MAIN_OVERLAYS.map(o => (
                  <label key={o.key} className="flex items-center gap-3 py-2 cursor-pointer">
                    <input type="checkbox" checked={mainOverlays[o.key]} onChange={() => toggleMain(o.key)}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"/>
                    <span className="text-sm text-gray-700">{o.label}</span>
                  </label>
                ))}
              </div>
              <div className="mb-5">
                <div className="text-xs font-semibold text-gray-500 mb-2">보조지표 (차트 아래)</div>
                {AUX_PANELS.map(o => (
                  <label key={o.key} className="flex items-center gap-3 py-2 cursor-pointer">
                    <input type="checkbox" checked={auxPanels[o.key]} onChange={() => toggleAux(o.key)}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"/>
                    <span className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{backgroundColor: o.color}}/> {o.label}
                    </span>
                  </label>
                ))}
              </div>
              <button onClick={() => setPanelOpen(false)}
                className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition-colors">적용</button>
            </div>
          </div>
        </div>
      )}

      {/* Compare bottom sheet */}
      {compareSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setCompareSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-[446px] bg-white rounded-t-2xl p-5 pb-8 max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="font-bold text-gray-900 mb-4">누구와 비교할까요?</h3>
            {otherEntries.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">비교할 다른 사주가 없습니다</p>
            ) : (
              <div className="space-y-1">
                {otherEntries.map(e => (
                  <button key={e.id} onClick={() => { setOverlayEntryId(e.id); setOverlayName(e.name); setCompareSheetOpen(false); setSelection(null); setYearSummary(null) }}
                    className="w-full text-left p-3.5 rounded-xl hover:bg-purple-50 flex items-center gap-3 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-rose-100 flex items-center justify-center text-sm">👤</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm">{e.name}</div>
                      <div className="text-xs text-gray-400">{e.gender === 'female' ? '여성' : '남성'} · {e.birthDate.replace(/-/g, '.')}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setCompareSheetOpen(false)}
              className="w-full py-3 mt-4 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">닫기</button>
          </div>
        </div>
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

function FortuneSection({ fortuneJson, entryId }: { fortuneJson?: unknown; entryId?: string }) {
  const [items, setItems] = useState<FortuneItem[]>([])
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = React.useRef(false)

  const getHeaders = useCallback(() => {
    const h: Record<string, string> = {}
    if (typeof window !== 'undefined') {
      const gid = localStorage.getItem('saju_guest_id')
      if (gid) h['x-guest-id'] = gid
    }
    return h
  }, [])

  const fetchFortune = useCallback((regen = false) => {
    if (!entryId) return
    setError(null); setAiLoading(true)
    const url = regen ? `/api/saju/${entryId}/fortune?regenerate=true` : `/api/saju/${entryId}/fortune`
    fetch(url, { headers: getHeaders() })
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error ?? '운세 해설을 불러오지 못했습니다'); return d })
      .then(d => { if (d?.items?.length) { setItems(d.items); fetchedRef.current = true } else setError('운세 해설 데이터가 없습니다') })
      .catch(e => setError(e?.message ?? '오류가 발생했습니다'))
      .finally(() => setAiLoading(false))
  }, [entryId, getHeaders])

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
    else if (entryId && !fetchedRef.current) { fetchedRef.current = true; fetchFortune() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fortuneJson, entryId])

  const toggle = (i: number) => setOpenIds(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })

  useEffect(() => {
    const handleExpandAll = () => setOpenIds(new Set(items.map((_, i) => i)))
    window.addEventListener('fortune-expand-all', handleExpandAll)
    return () => window.removeEventListener('fortune-expand-all', handleExpandAll)
  }, [items])

  const isLoading = aiLoading && !items.length
  const NEW_CATEGORIES = ['한 줄 사주', '인생의 큰 그림']
  const isNewFormat = items.length >= 2 && NEW_CATEGORIES.includes(items[0]?.category)
  const topCards = isNewFormat ? items.slice(0, 2) : []
  const accordionItems = isNewFormat ? items.slice(2) : items
  const accordionOffset = isNewFormat ? 2 : 0

  return (
    <div className="px-4 mt-6">
      <h3 className="font-bold text-gray-900 mb-3">운세 해설</h3>

      {isLoading ? (
        <FortuneQuoteLoader />
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
          {topCards.map((card, i) => (
            <div key={`card-${i}`} data-capture={i === 0 ? '03_한줄사주' : '04_인생의큰그림'}
              className={`rounded-2xl p-4 ${i === 0 ? 'bg-purple-50 border border-purple-100' : 'bg-indigo-50 border border-indigo-100'}`}>
              <p className={`text-xs font-medium mb-1 ${i === 0 ? 'text-purple-500' : 'text-indigo-500'}`}>{card.category}</p>
              <p className="text-base font-bold text-gray-900 leading-snug mb-2">{card.title}</p>
              <div className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(card.content) }} />
            </div>
          ))}
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
    </div>
  )
}
