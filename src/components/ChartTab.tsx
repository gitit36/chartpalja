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
import { buildWeekChartData, buildWeekChartFromHydrated, weekTickLabel, weekFullLabel, evenYearTicks, WEEK_TICKS, WEEK_X_DOMAIN, WEEK_TODAY_X } from '@/lib/saju/week-chart-data'
import { kstCenteredWeekDates, kstRecentDates } from '@/lib/saju/daily-util'
import { pillarToHangul } from '@/lib/saju/hanja-hangul'
import { getGuestId } from '@/lib/auth/guest'
import { LockedPreview } from '@/components/LockedPreview'
import { JuShortageNudge } from '@/components/JuShortageNudge'
import { InfoTip } from '@/components/InfoTip'
import { READING_COST } from '@/lib/payment/products'
import { fetchBalance, clearBalanceCache } from '@/lib/hooks/useBalance'
import { classifyCompat } from '@/lib/compat/classify'
import { listCompatEntries, getGeneratedRelationships, compatShareStorageKey } from '@/lib/compat/storage'
import { compatCardKey, RELATIONSHIP_LABELS } from '@/lib/compat/relationship'
import type { OverlayCompatInfo, CompatGenerationState, CompatReportEntry, RelationshipType, CompatCardData, CompatFlowPoint, YearCompatLevel } from '@/lib/compat/types'
import { CompatChemistry } from '@/components/CompatChemistry'
import {
  buildRelationshipSeries,
  buildCompatCard,
  buildYearLevels,
  getRelationshipPointForYear,
  YEAR_LEVEL_LABELS,
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

type PeriodKey = 'week' | 'year' | 'all'
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
  yongshin_fit: '필요한 기운 유입', unseong: '타이밍이 잘 맞는 시기', unseong_context: '대운과 조화',
  relations: '인연의 도움', trine: '기운이 한데 모임', balance: '기운 균형 개선', shinsal: '좋은 기운 발동',
  disease_resolution: '약점이 보완됨', haegong: '막힘이 풀림', structural_adj: '구조가 받쳐줌',
}
const BD_LABEL_NEG: Record<string, string> = {
  yongshin_fit: '필요한 기운 부족', unseong: '타이밍이 엇갈리는 시기', unseong_context: '대운과 엇박자',
  relations: '관계의 마찰', trine: '에너지 분산', balance: '기운 편중 심화', shinsal: '안 좋은 기운 발동',
  disease_resolution: '약점이 드러남', haegong: '빈 기운이 드러남', structural_adj: '구조가 부담됨',
}

function intensityWord(v: number): string {
  const a = Math.abs(v)
  if (a >= 8) return '강+'
  if (a >= 5) return '강'
  if (a >= 2) return '중'
  return '약'
}

function breakdownFactors(bd: ScoreBreakdown | undefined): { up: string[]; down: string[] } {
  if (!bd) return { up: [], down: [] }
  const skip = new Set(['base', 'monthly_base', 'daily_independent', 'synergy', 'blend_mw', 'blend_daily'])
  const entries = Object.entries(bd)
    .filter(([k]) => !skip.has(k))
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

type ExtremePoint = { year: number; score: number }

/** 상단 라벨들이 겹치지 않도록 x 근접 시 y를 엇갈리게 배치한다. */
function staggerLabelYs(
  items: Array<{ key: string; x: number; preferTop: boolean }>,
  baseTop: number,
  baseBottom: number,
): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.x - b.x)
  const ys = new Map<string, number>()
  const MIN_GAP = 28
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!
    let y = cur.preferTop ? baseTop : baseBottom
    const prev = sorted[i - 1]
    if (prev && Math.abs(cur.x - prev.x) < MIN_GAP) {
      const prevY = ys.get(prev.key) ?? baseTop
      y = prevY === baseTop ? baseBottom : baseTop
    }
    ys.set(cur.key, y)
  }
  return ys
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ThisYearMarker(props: any) {
  const {
    formattedGraphicalItems, xAxisMap, yAxisMap, period, markerYear, selection, rangeMode, isMonthly, isWeekly, weekLen, weekLabelAt,
    peak, low, showExtremes, extremesOpaque,
  } = props
  if (!formattedGraphicalItems?.length || !xAxisMap || !yAxisMap) return null
  const xAxis = Object.values(xAxisMap)[0] as { scale?: ((v: number) => number) & { domain?: () => number[] } } | undefined
  const yAxis = Object.values(yAxisMap)[0] as { scale?: ((v: number) => number) & { domain?: () => number[] } } | undefined
  if (!xAxis?.scale || !yAxis?.scale) return null
  const elements: React.ReactElement[] = []
  const yTop = yAxis.scale(yAxis.scale.domain?.()[1] ?? 110) ?? 0
  const yBottom = yAxis.scale(yAxis.scale.domain?.()[0] ?? 0) ?? 280
  const labelYTop = Math.max(yTop - 4, 6)
  const labelYAlt = labelYTop + 12

  type LabelSpec = { key: string; x: number; text: string; fill: string; bold?: boolean; preferTop: boolean }
  const labels: LabelSpec[] = []

  if (isWeekly) {
    const todayX = weekLen || WEEK_TODAY_X
    const cx = xAxis.scale(todayX)
    if (typeof cx === 'number' && !isNaN(cx)) {
      elements.push(
        <line key="tw-line" x1={cx} y1={yTop} x2={cx} y2={yBottom} stroke="#F04452" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>,
      )
      labels.push({ key: 'tw', x: cx, text: '오늘', fill: '#F04452', bold: true, preferTop: true })
    }
  } else if (isMonthly) {
    const cx = xAxis.scale(THIS_MONTH)
    if (typeof cx === 'number' && !isNaN(cx)) {
      elements.push(
        <line key="tm-line" x1={cx} y1={yTop} x2={cx} y2={yBottom} stroke="#F04452" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>,
      )
      labels.push({ key: 'tm', x: cx, text: '이번달', fill: '#F04452', bold: true, preferTop: true })
    }
  } else if (period === 'all' || period === 'year') {
    const cx = xAxis.scale(THIS_YEAR)
    if (typeof cx === 'number' && !isNaN(cx)) {
      elements.push(
        <line key="ty-line" x1={cx} y1={yTop} x2={cx} y2={yBottom} stroke="#F04452" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>,
      )
      labels.push({ key: 'ty', x: cx, text: '올해', fill: '#F04452', bold: true, preferTop: true })
    }
  }

  if (rangeMode && selection) {
    const { startYear, endYear } = selection as { startYear: number; endYear: number }
    const sx = xAxis.scale(startYear)
    if (typeof sx === 'number' && !isNaN(sx)) {
      elements.push(
        <line key="sel-s-line" x1={sx} y1={yTop} x2={sx} y2={yBottom} stroke="#F04452" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.6}/>,
      )
      labels.push({
        key: 'sel-s',
        x: sx,
        text: isWeekly
          ? (typeof weekLabelAt === 'function' ? weekLabelAt(startYear) : String(startYear))
          : isMonthly ? `${startYear}월` : String(startYear),
        fill: '#F04452',
        bold: true,
        preferTop: true,
      })
    }
    if (endYear !== startYear) {
      const ex = xAxis.scale(endYear)
      if (typeof ex === 'number' && !isNaN(ex)) {
        elements.push(
          <line key="sel-e-line" x1={ex} y1={yTop} x2={ex} y2={yBottom} stroke="#F04452" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.6}/>,
        )
        labels.push({
          key: 'sel-e',
          x: ex,
          text: isWeekly
            ? (typeof weekLabelAt === 'function' ? weekLabelAt(endYear) : String(endYear))
            : isMonthly ? `${endYear}월` : String(endYear),
          fill: '#F04452',
          bold: true,
          // 시작 연도와 같은 높이로 맞춤
          preferTop: true,
        })
      }
    }
  } else if (markerYear != null) {
    const isCurrentMarker = isWeekly
      ? markerYear === (weekLen || WEEK_TODAY_X)
      : isMonthly
        ? markerYear === THIS_MONTH
        : ((period === 'all' || period === 'year') && markerYear === THIS_YEAR)
    if (!isCurrentMarker) {
      const hx = xAxis.scale(markerYear)
      if (typeof hx === 'number' && !isNaN(hx)) {
        elements.push(
          <line key="marker-line" x1={hx} y1={yTop} x2={hx} y2={yBottom} stroke="#F04452" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>,
        )
        labels.push({
          key: 'marker',
          x: hx,
          text: isWeekly
            ? (typeof weekLabelAt === 'function' ? weekLabelAt(markerYear) : String(markerYear))
            : isMonthly ? `${markerYear}월` : String(markerYear),
          fill: '#6b7280',
          preferTop: true,
        })
      }
    }
  }

  const labelYs = staggerLabelYs(
    labels.map(l => ({ key: l.key, x: l.x, preferTop: l.preferTop })),
    labelYTop,
    labelYAlt,
  )
  for (const l of labels) {
    elements.push(
      <text
        key={`${l.key}-text`}
        x={l.x}
        y={labelYs.get(l.key) ?? labelYTop}
        textAnchor="middle"
        fontSize={l.key === 'ty' || l.key === 'tm' ? 9 : 8}
        fontWeight={l.bold ? 'bold' : 'normal'}
        fill={l.fill}
      >
        {l.text}
      </text>,
    )
  }

  // 최고/최저 — 라인 종료 후 표시. opacity는 부모 state로 1회만 올려 hover 깜빡임 방지
  if (showExtremes && !rangeMode) {
    const peakPt = peak as ExtremePoint | null | undefined
    const lowPt = low as ExtremePoint | null | undefined
    const fade = {
      opacity: extremesOpaque ? 1 : 0,
      transition: 'opacity 0.45s ease-out',
      pointerEvents: 'none' as const,
    }
    if (peakPt) {
      const px = xAxis.scale(peakPt.year)
      const py = yAxis.scale(peakPt.score)
      if (typeof px === 'number' && !isNaN(px) && typeof py === 'number' && !isNaN(py)) {
        elements.push(
          <g key="peak-g" style={fade}>
            <circle cx={px} cy={py} r={3.5} fill="#F5A524" stroke="#1F1E25" strokeWidth={1.5} />
            <text
              x={px}
              y={py - 8}
              textAnchor="middle"
              fontSize={8}
              fontWeight="bold"
              fill="#F5A524"
            >
              {`최고 ${Math.round(peakPt.score)}`}
            </text>
          </g>,
        )
      }
    }
    if (lowPt && (!peakPt || lowPt.year !== peakPt.year)) {
      const lx = xAxis.scale(lowPt.year)
      const ly = yAxis.scale(lowPt.score)
      if (typeof lx === 'number' && !isNaN(lx) && typeof ly === 'number' && !isNaN(ly)) {
        elements.push(
          <g key="low-g" style={{ ...fade, transitionDelay: '120ms' }}>
            <circle cx={lx} cy={ly} r={3.5} fill="#3182F6" stroke="#1F1E25" strokeWidth={1.5} />
            <text
              x={lx}
              y={ly + 14}
              textAnchor="middle"
              fontSize={8}
              fontWeight="bold"
              fill="#3182F6"
            >
              {`최저 ${Math.round(lowPt.score)}`}
            </text>
          </g>,
        )
      }
    }
  }

  return elements.length ? <g>{elements}</g> : null
}

const YEAR_LEVEL_COLORS: Record<YearCompatLevel, string> = {
  good: '#14B8A6',
  normal: '#6B6B75',
  caution: '#F5A524',
}

const YEAR_LEVEL_TEXT: Record<YearCompatLevel, string> = {
  good: '#5EEAD4',
  normal: '#8B8B93',
  caution: '#FBBF24',
}

/**
 * 메인 차트 하단 리듬 바 — X축에 붙어 솟아나는 관계 수준(좋음/보통/주의) 3단계.
 * 월(올해) 뷰에서는 monthLevels(1~12)를, 전체/연 뷰에서는 yearLevels를 사용한다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CompatYearBar(props: any) {
  const { xAxisMap, yAxisMap, yearLevels, isMonthly } = props
  if (!xAxisMap || !yAxisMap) return null
  const xAxis = Object.values(xAxisMap)[0] as { scale?: ((v: number) => number) & { range?: () => number[] } } | undefined
  const yAxis = Object.values(yAxisMap)[0] as { scale?: ((v: number) => number) & { domain?: () => number[] } } | undefined
  const scale = xAxis?.scale
  const yScale = yAxis?.scale
  if (!scale || !yScale) return null

  type Cell = { pos: number; level: YearCompatLevel }
  const cells: Cell[] = []
  const levels = yearLevels as Map<number, YearCompatLevel> | undefined
  if (!levels?.size) return null
  if (isMonthly) {
    for (let m = 1; m <= 12; m++) {
      const level = levels.get(m)
      if (!level) continue
      const pos = scale(m)
      if (typeof pos === 'number' && !isNaN(pos)) cells.push({ pos, level })
    }
  } else {
    for (const [year, level] of levels) {
      const pos = scale(year)
      if (typeof pos === 'number' && !isNaN(pos)) cells.push({ pos, level })
    }
  }
  if (cells.length < 1) return null
  cells.sort((a, b) => a.pos - b.pos)

  // 인접 셀 간격의 중앙값을 셀 너비로 사용해 빈틈 없이 이어 붙인다.
  const gaps: number[] = []
  for (let i = 1; i < cells.length; i++) gaps.push(cells[i]!.pos - cells[i - 1]!.pos)
  gaps.sort((a, b) => a - b)
  const step = gaps.length ? gaps[Math.floor(gaps.length / 2)]! : 40
  const w = Math.max(2, step)

  const range = scale.range?.() ?? []
  const left = range.length ? Math.min(range[0]!, range[range.length - 1]!) : cells[0]!.pos
  const right = range.length ? Math.max(range[0]!, range[range.length - 1]!) : cells[cells.length - 1]!.pos
  const barH = 5
  const plotBottom = yScale(yScale.domain?.()[0] ?? 0) ?? 0

  const rects: React.ReactElement[] = []
  cells.forEach((c, i) => {
    let x = c.pos - w / 2
    let cw = w
    if (x < left) { cw -= (left - x); x = left }
    if (x + cw > right) cw = right - x
    if (cw <= 0.5) return
    rects.push(
      <rect
        key={i}
        x={x}
        y={plotBottom - barH}
        width={cw}
        height={barH}
        fill={YEAR_LEVEL_COLORS[c.level]}
        fillOpacity={c.level === 'normal' ? 0.85 : 0.95}
      />,
    )
  })
  return rects.length ? <g>{rects}</g> : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MainTooltip({ active, payload, overlays, domainOverlays, monthly, overlayActive, overlayName, currentName, yearLevels, hideDetail }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as (MergedDatum & { dayLabel?: string }) | undefined
  if (!d) return null
  const timeLabel = d.dayLabel ? d.dayLabel : monthly ? `${d.year}월` : `${d.year}년`
  const scoreName = d.dayLabel ? '일운' : monthly ? '월운' : '세운'
  const ov = overlays as Record<MainOverlayKey, boolean> | undefined
  const dom = domainOverlays as Record<DomainOverlayKey, boolean> | undefined
  const activeDomains = dom
    ? DOMAIN_OVERLAYS.filter(o => dom[o.key])
        .map(o => ({ label: o.label, color: o.color, val: domainValue(d as unknown as Record<string, unknown>, o.field) }))
        .filter(x => x.val != null)
    : []

  if (overlayActive && d.scoreOv != null) {
    const level = yearLevels?.get?.(d.year) as YearCompatLevel | undefined
    return (
      <div className="bg-cp-surface border border-cp-border rounded-lg text-[10px] leading-tight overflow-hidden min-w-[150px]">
        <div className="font-bold text-cp-text px-2.5 py-1 flex items-center gap-1.5">
          <span>{timeLabel}</span>
          {level && (
            <>
              <span className="text-cp-border">·</span>
              <span style={{ color: YEAR_LEVEL_TEXT[level] }}>관계 {YEAR_LEVEL_LABELS[level]}</span>
            </>
          )}
        </div>
        <div className="px-2.5 py-1 border-t border-cp-border flex items-center justify-between gap-3">
          <span className="font-semibold text-cp-line">{currentName || '나'} {Math.round(d.score)}</span>
          <span className="font-semibold text-cp-down">{overlayName || '상대'} {Math.round(d.scoreOv)}</span>
        </div>
        {ov?.daewoon && (d.trend != null || d.trendOv != null) && (
          <div className="px-2.5 py-1 border-t border-cp-border flex items-center justify-between gap-3 text-[9px] text-cp-muted">
            <span>{d.trend != null ? `대운 ${Math.round(d.trend)}` : ''}</span>
            <span>{d.trendOv != null ? `대운 ${Math.round(d.trendOv)}` : ''}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-cp-surface/95 backdrop-blur border border-cp-border rounded-lg px-2.5 py-1.5 shadow-sm text-[10px] leading-tight">
      <div className="font-bold text-cp-text mb-0.5">{timeLabel}</div>
      <div className="text-cp-muted">{scoreName}: <span className="font-semibold text-green-600">{Math.round(d.score)}</span></div>
      {ov?.daewoon && d.trend != null && (
        <div className="text-cp-muted">대운: <span className="font-semibold text-yellow-600">{Math.round(d.trend)}</span>{d.daewoonPillar && <span className="text-cp-muted ml-1">{fmtPillar(d.daewoonPillar)}</span>}</div>
      )}
      {ov?.candle && d.high != null && <div className="text-cp-muted">고/저: {d.high?.toFixed(0)}~{d.low?.toFixed(0)}</div>}
      {ov?.season && d.seasonTag && <div className="text-cp-muted">시즌: <span className="font-semibold" style={{color: SEASON_TAG_COLORS[d.seasonTag] || '#666'}}>{d.seasonEmoji} {d.seasonTag}</span></div>}
      {activeDomains.length > 0 && (
        <div className="mt-0.5 pt-0.5 border-t border-cp-border grid grid-cols-2 gap-x-2">
          {activeDomains.map(x => (
            <div key={x.label} className="flex items-center gap-1">
              <span className="w-2 h-0.5 rounded inline-block" style={{ backgroundColor: x.color }} />
              <span className="text-cp-muted">{x.label}</span>
              <span className="font-semibold" style={{ color: x.color }}>{Math.round(x.val as number)}</span>
            </div>
          ))}
        </div>
      )}
      {!hideDetail && (() => {
        const { up, down } = breakdownFactors(d.breakdown)
        if (!up.length && !down.length) return null
        return (
          <div className="mt-0.5 pt-0.5 border-t border-cp-border">
            {up.length > 0 && <div className="text-cp-up">▲ {up.join(', ')}</div>}
            {down.length > 0 && <div className="text-cp-down">▼ {down.join(', ')}</div>}
          </div>
        )
      })()}
      {!hideDetail && (() => {
        const tags = getShinsalTags(d.shinsalTags, d.shinsalContextAdj)
        if (!tags.length) return null
        return <div className="mt-0.5 pt-0.5 border-t border-cp-border text-cp-muted">🏷️ {tags.join(' · ')}</div>
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
  const label = entry.payload?.dayLabel
    ? String(entry.payload.dayLabel).replace('요일', '')
    : `${entry.payload?.year ?? ''}${monthly ? '월' : ''}`
  return (
    <div className="bg-cp-surface/95 backdrop-blur border border-cp-border rounded-lg px-2 py-1 shadow-sm text-[10px]">
      <span className="text-cp-muted">{label}: </span>
      <span className="font-semibold text-cp-text tabular-nums">{val}</span>
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
  /** 관계 케미 카드의 '궁합 해설' CTA — 부모의 handleCompatCta 로 연결 */
  onCompatCta?: () => void
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
  /** 리스트 '오늘' 카드 진입 — 올해 월운 + 이번 달 포커스 */
  initialFocus?: 'today' | null
  /**
   * GET /api/saju/[id] 가 hydrate 한 이번 주(월~일) 일운.
   * 있으면 /api/saju/daily 재호출 없이 바로 그린다.
   */
  weekSeries?: { dates: string[]; scores: (number | null)[] } | null
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
  onOverlayChange, onCompatCta, expandCompatCardKey, onFortuneJsonUpdate, compatGeneration,
  entryName, myGender, initialOverlayId, initialFocus, sharePartner, weekSeries,
}: ChartTabProps) {
  const [period, setPeriod] = useState<PeriodKey>(
    isLocked ? 'all' : (initialFocus === 'today' ? 'week' : 'all'),
  )
  const [panelOpen, setPanelOpen] = useState(false)
  const [mainOverlays, setMainOverlays] = useState<Record<MainOverlayKey, boolean>>({ daewoon: false, candle: false, season: false })
  const [domainOverlays, setDomainOverlays] = useState<Record<DomainOverlayKey, boolean>>({ job: false, wealth: false, love: false, health: false, marriage: false })
  /** 기본 세운/월운(초록) 선 — 다른 선이 켜져 있을 때만 끌 수 있음 */
  const [baseLineVisible, setBaseLineVisible] = useState(true)
  const [auxPanels, setAuxPanels] = useState<Record<AuxKey, boolean>>({ yongshin: false, energy: false, noble: false, ohang: false, tengo: false, event: false })
  const [hoverYear, setHoverYear] = useState<number | null>(null)
  const [clickedYear, setClickedYear] = useState<number | null>(initialFocus === 'today' ? WEEK_TODAY_X : null)
  const [weekData, setWeekData] = useState<ChartDatum[]>(() => buildWeekChartFromHydrated(weekSeries))
  const [weekDataOv, setWeekDataOv] = useState<ChartDatum[]>([])
  const [weekLoading, setWeekLoading] = useState(false)
  const [selection, setSelection] = useState<{ startYear: number; endYear: number } | null>(null)
  /** 일반 모드에서 차트 클릭으로 고른 단일 시점 — 하단 「n년 해설 보기」 CTA용 (구간 모드와 별개) */
  const [quickPick, setQuickPick] = useState<number | null>(null)
  const [yearSummary, setYearSummary] = useState<{ startYear: number; endYear: number; text: string } | null>(null)
  const [yearSummaryLoading, setYearSummaryLoading] = useState(false)
  const [rangeMode, setRangeMode] = useState(false)
  const rangeFirst = React.useRef<number | null>(null)
  const [juShortage, setJuShortage] = useState<{ needed: number; current: number } | null>(null)

  // 비로그인·공유: 이번 주/올해는 잠금 — 전체 곡선만 공개
  useEffect(() => {
    if (!isLocked) return
    if (period !== 'all') {
      setPeriod('all')
      setClickedYear(THIS_YEAR)
      setRangeMode(false)
      setSelection(null)
      setQuickPick(null)
      rangeFirst.current = null
    }
  }, [isLocked, period])

  const [settingsBadge, setSettingsBadge] = useState(false)
  const [chartHint, setChartHint] = useState(false)
  const [summaryCache] = useState<Map<string, { text: string }>>(() => new Map())
  const chartRef = React.useRef<HTMLDivElement>(null)
  const auxSectionRef = React.useRef<HTMLDivElement>(null)
  const pendingAuxScroll = React.useRef(false)
  const lastHapticYear = React.useRef<number | null>(null)
  const hasAnimated = React.useRef(false)
  const [lineAnimDone, setLineAnimDone] = useState(false)
  const [extremesOpaque, setExtremesOpaque] = useState(false)
  const isTouchRef = React.useRef(false)
  useEffect(() => {
    const onTouch = () => { isTouchRef.current = true }
    window.addEventListener('touchstart', onTouch, { once: true, passive: true })
    return () => window.removeEventListener('touchstart', onTouch)
  }, [])

  // 라인 드로잉(2s) 끝난 뒤 최고/최저 표시 — 첫 진입에서만 대기
  useEffect(() => {
    if (hasAnimated.current) {
      setLineAnimDone(true)
      setExtremesOpaque(true)
      return
    }
    const t = setTimeout(() => {
      hasAnimated.current = true
      setLineAnimDone(true)
    }, 2100)
    return () => clearTimeout(t)
  }, [])

  // opacity 전환은 한 번만 (hover 재마운트 시에도 opaque 유지 → 깜빡임 없음)
  useEffect(() => {
    if (!lineAnimDone || extremesOpaque) return
    const id = requestAnimationFrame(() => setExtremesOpaque(true))
    return () => cancelAnimationFrame(id)
  }, [lineAnimDone, extremesOpaque])

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

  // 이번 주 일운 — entry.weekSeries(hydrate) 우선. 없거나 주가 바뀌었을 때만 /daily 폴백.
  useEffect(() => {
    const week = kstCenteredWeekDates()
    const fresh =
      weekSeries?.dates?.length === 7 &&
      weekSeries.dates[0] === week[0] &&
      weekSeries.dates[6] === week[6] &&
      weekSeries.dates[3] === week[3]

    if (fresh) {
      const built = buildWeekChartFromHydrated(weekSeries)
      setWeekData(built)
      setWeekLoading(false)
      if (period === 'week' && built.length) {
        const todayPt = built.find((p) => p.year === WEEK_TODAY_X) ?? built[built.length - 1]!
        setClickedYear(todayPt.year)
      }
      return
    }

    // hydrate 없음/스테일 → 기존 daily API 폴백 (shareMode·딥링크 등)
    if (!entryId || shareMode) {
      setWeekData([])
      return
    }
    if (period !== 'week') return
    let cancelled = false
    setWeekLoading(true)
    const gid = getGuestId()
    const headers: Record<string, string> = {}
    if (gid) headers['x-guest-id'] = gid
    fetch('/api/saju/daily', { headers, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        const entries = (d.entries ?? []) as { id: string; series?: (number | null)[] }[]
        const row = entries.find((e) => e.id === entryId)
        const series = row?.series
        if (!series?.length) {
          setWeekData([])
          return
        }
        const recentDates = kstRecentDates(series.length)
        const built = buildWeekChartData(series, recentDates, week)
        setWeekData(built)
        if (built.length) {
          const todayPt = built.find((p) => p.year === WEEK_TODAY_X) ?? built[built.length - 1]!
          setClickedYear(todayPt.year)
        }
      })
      .catch(() => {
        if (!cancelled) setWeekData([])
      })
      .finally(() => {
        if (!cancelled) setWeekLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entryId, shareMode, period, weekSeries])

  // 비교 상대 — 오버레이 entry fetch (weekSeries 포함)
  useEffect(() => {
    if (!overlayEntryId) { setOverlayReport(null); setOverlayBirthYear(null); overlayFetchedRef.current = null; setWeekDataOv([]); return }
    if (sharePartner && overlayEntryId === sharePartner.id) {
      setOverlayReport(sharePartner.report)
      setOverlayBirthYear(sharePartner.birthYear)
      setOverlayName(sharePartner.name)
      setOverlayGender(sharePartner.gender)
      overlayFetchedRef.current = overlayEntryId
      setWeekDataOv([])
      return
    }
    if (overlayEntryId === overlayFetchedRef.current) return
    overlayFetchedRef.current = overlayEntryId
    const gid = getGuestId()
    const headers: Record<string, string> = {}
    if (gid) headers['x-guest-id'] = gid
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
        setWeekDataOv(buildWeekChartFromHydrated(d?.weekSeries))
      })
      .catch(() => {
        setWeekDataOv([])
      })
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
    setWeekDataOv([])
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
    const card = buildCompatCard(series)
    onOverlayChange({
      overlayId: overlayEntryId,
      overlayName: overlayName || '상대',
      overlayGender: overlayGender || 'male',
      myScore: Math.round(myDatum?.score ?? 0),
      partnerScore: Math.round(ovDatum?.score ?? 0),
      type,
      generatedRelationships: getGeneratedRelationships(fortuneJson, overlayEntryId),
      compatDots: relPoint?.dots,
      overallScore: card?.overallScore,
    })
  }, [
    onOverlayChange, overlayActive, overlayReport, overlayBirthYear, birthYear, report,
    overlayEntryId, overlayName, overlayGender, fullChartData, overlayChartData, fortuneJson,
  ])

  const { filteredData, xDomain, isMonthly, isWeekly } = useMemo(() => {
    if (!fullChartData && period !== 'week') {
      return { filteredData: [] as ChartDatum[], xDomain: [2000, 2080] as [number, number], isMonthly: false, isWeekly: false }
    }
    if (period === 'week') {
      return {
        filteredData: weekData,
        xDomain: WEEK_X_DOMAIN,
        isMonthly: false,
        isWeekly: true,
      }
    }
    const all = fullChartData!.data
    let filtered: ChartDatum[]
    let monthly = false
    switch (period) {
      case 'year':
        if (fullChartData!.monthlyData?.length) {
          filtered = fullChartData!.monthlyData
          monthly = true
        } else {
          filtered = all.filter((d) => d.year === THIS_YEAR)
        }
        break
      default:
        filtered = all
    }
    if (!filtered.length) filtered = all
    if (overlayChartData && !monthly && period === 'all') {
      const ovAll = overlayChartData.data
      if (ovAll.length) {
        const ovStart = ovAll[0]!.year
        const ovEnd = ovAll[ovAll.length - 1]!.year
        filtered = filtered.filter((d) => d.year >= ovStart && d.year <= ovEnd)
      }
    }
    let xd: [number, number]
    if (monthly) {
      xd = [0.5, 12.5]
    } else {
      const pad = filtered.length <= 5 ? 1 : filtered.length <= 12 ? 0.5 : 0
      xd = [filtered[0]!.year - pad, filtered[filtered.length - 1]!.year + pad]
    }
    return { filteredData: filtered, xDomain: xd, isMonthly: monthly, isWeekly: false }
  }, [fullChartData, period, overlayChartData, weekData])

  const relationshipSeries = useMemo(() => {
    if (!overlayActive || !report || !overlayReport || birthYear == null || overlayBirthYear == null) return []
    return buildRelationshipSeries(report, birthYear, overlayReport, overlayBirthYear)
  }, [overlayActive, report, overlayReport, birthYear, overlayBirthYear])

  const yearLevels = useMemo(() => {
    if (!overlayActive) return new Map<number, YearCompatLevel>()
    return buildYearLevels(relationshipSeries)
  }, [relationshipSeries, overlayActive])

  /** 올해(월간) X축 리듬 바 — 양쪽 월운 점수로 월별 좋음/보통/주의 */
  const monthLevels = useMemo(() => {
    if (!isMonthly || !overlayActive) return new Map<number, YearCompatLevel>()
    const mine = fullChartData?.monthlyData ?? []
    const ov = overlayChartData?.monthlyData ?? []
    if (!mine.length || !ov.length) {
      // 월운 없으면 올해 연간 레벨로 12개월 동일 채움(기존 동작)
      const lvl = yearLevels.get(THIS_YEAR)
      const m = new Map<number, YearCompatLevel>()
      if (lvl) for (let i = 1; i <= 12; i++) m.set(i, lvl)
      return m
    }
    const stub = (year: number, score: number): import('@/lib/compat/types').RelationshipYearPoint => ({
      year,
      score,
      dots: 3,
      components: { sync: 0, ohang: 0, support: 0, clash: 0 },
      events: [],
      scoreA: score,
      scoreB: score,
    })
    const ovMap = new Map(ov.map(d => [d.year, d.score]))
    const points = mine
      .filter(d => ovMap.has(d.year))
      .map(d => stub(d.year, (d.score + (ovMap.get(d.year) ?? d.score)) / 2))
    return buildYearLevels(points)
  }, [isMonthly, overlayActive, fullChartData?.monthlyData, overlayChartData?.monthlyData, yearLevels])

  /** 이번 주 X축 리듬 바 — 비교(관계) 활성일 때만 */
  const weekLevels = useMemo(() => {
    if (!isWeekly || !overlayActive || !weekData.length || !weekDataOv.length) {
      return new Map<number, YearCompatLevel>()
    }
    const stub = (year: number, score: number): import('@/lib/compat/types').RelationshipYearPoint => ({
      year,
      score,
      dots: 3,
      components: { sync: 0, ohang: 0, support: 0, clash: 0 },
      events: [],
      scoreA: score,
      scoreB: score,
    })
    const ovMap = new Map(weekDataOv.map(d => [d.year, d.score]))
    const points = weekData
      .filter(d => ovMap.has(d.year))
      .map(d => stub(d.year, (d.score + (ovMap.get(d.year) ?? d.score)) / 2))
    return buildYearLevels(points)
  }, [isWeekly, weekData, weekDataOv, overlayActive])

  const compatCard = useMemo<CompatCardData | null>(() => {
    if (!overlayActive) return null
    return buildCompatCard(relationshipSeries)
  }, [relationshipSeries, overlayActive])

  // 현재 비교(오버레이) 중인 상대의 라이브 케미 — 아직 저장 카드가 없을 때
  // 운세 해설 섹션에서 무료 케미 카드로 보여주기 위해 하향 전달한다.
  const activeCompat = useMemo(() => {
    if (!overlayActive || !overlayEntryId || !compatCard) return null
    return {
      partnerId: overlayEntryId,
      partnerName: overlayName || '상대',
      partnerGender: overlayGender || 'male',
      card: compatCard,
      flow: relationshipSeries.map(p => ({ y: p.year, s: p.score })) as CompatFlowPoint[],
    }
  }, [overlayActive, overlayEntryId, overlayName, overlayGender, compatCard, relationshipSeries])

  const mergedData = useMemo<MergedDatum[]>(() => {
    const relMap = new Map(relationshipSeries.map(p => [p.year, p.score]))
    if (!overlayActive) return filteredData
    if (isWeekly) {
      if (!weekDataOv.length) return filteredData
      const ovMap = new Map(weekDataOv.map(d => [d.year, d]))
      return filteredData.map(d => {
        const ov = ovMap.get(d.year)
        return ov ? { ...d, scoreOv: ov.score } : d
      })
    }
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
  }, [filteredData, overlayActive, overlayChartData, isMonthly, isWeekly, weekDataOv, relationshipSeries])

  const yDomain = useMemo<[number, number]>(() => {
    if (!mergedData.length) return [0, 110]
    let lo = Infinity, hi = -Infinity
    const bump = (v: number | null | undefined) => {
      if (typeof v !== 'number' || isNaN(v)) return
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    for (const d of mergedData) {
      if (baseLineVisible) {
        bump(d.score)
        if (overlayActive) bump(d.scoreOv)
      }
      for (const o of DOMAIN_OVERLAYS) {
        if (!domainOverlays[o.key]) continue
        bump(domainValue(d as unknown as Record<string, unknown>, o.field))
      }
      if (mainOverlays.daewoon) bump(d.trend)
    }
    if (!isFinite(lo)) return [0, 110]
    const pad = Math.max(5, (hi - lo) * 0.15)
    return [Math.max(0, Math.floor(lo - pad)), Math.min(120, Math.ceil(hi + pad))]
  }, [mergedData, baseLineVisible, domainOverlays, mainOverlays.daewoon, overlayActive])

  const currentYearScore = useMemo(() => {
    const target = isWeekly
      ? WEEK_TODAY_X
      : isMonthly
        ? THIS_MONTH
        : THIS_YEAR
    const d = mergedData.find(d => d.year === target)
    if (!d) return null
    if (baseLineVisible) return Math.round(d.score)
    for (const o of DOMAIN_OVERLAYS) {
      if (!domainOverlays[o.key]) continue
      const v = domainValue(d as unknown as Record<string, unknown>, o.field)
      if (v != null) return v
    }
    return null
  }, [mergedData, isMonthly, isWeekly, baseLineVisible, domainOverlays])

  /** 현재 뷰(기간) 기준 최고/최저 — 기본 세운/월운/일운 선이 보일 때만 */
  const extremes = useMemo(() => {
    if (!baseLineVisible || mergedData.length < 2) return { peak: null as ExtremePoint | null, low: null as ExtremePoint | null }
    let peak = mergedData[0]!
    let low = mergedData[0]!
    for (const d of mergedData) {
      if (d.score > peak.score) peak = d
      if (d.score < low.score) low = d
    }
    return {
      peak: { year: peak.year, score: peak.score },
      low: { year: low.year, score: low.score },
    }
  }, [mergedData, baseLineVisible])

  const markerYear = hoverYear ?? clickedYear

  // 십성 밸런스/이벤트 확률 패널은 "마지막으로 본 연도"를 고정해 둔다.
  // 커서/손가락을 떼도(=markerYear 가 null 이 되어도) 직전 값이 남도록 한다.
  const [pinnedYear, setPinnedYear] = useState<number | null>(null)
  useEffect(() => { if (markerYear != null) setPinnedYear(markerYear) }, [markerYear])
  // 우선순위: 현재 가리키는 연도 > 선택 구간 시작 > 마지막 고정 연도 > 기본(오늘/이번달/올해)
  const focusYear = markerYear ?? selection?.startYear ?? pinnedYear ?? (
    isWeekly ? WEEK_TODAY_X
      : isMonthly ? THIS_MONTH : THIS_YEAR
  )

  const selectedData = useMemo(() => {
    return focusYear != null ? mergedData.find(d => d.year === focusYear) ?? null : null
  }, [focusYear, mergedData])

  const selectedOverlayData = useMemo(() => {
    if (!overlayActive || focusYear == null) return null
    if (isWeekly) return weekDataOv.find(d => d.year === focusYear) ?? null
    const ovSrc = isMonthly ? overlayChartData!.monthlyData : overlayChartData!.data
    return ovSrc?.find(d => d.year === focusYear) ?? null
  }, [focusYear, overlayActive, overlayChartData, isMonthly, isWeekly, weekDataOv])

  const hasEngineData = !!(chartPayload?.['연도별_타임라인']?.length)
  const seasonBands = fullChartData?.seasonBands ?? []

  const fetchSummary = useCallback((startYear: number, endYear: number, monthly = false, weekly = false) => {
    // 공유 뷰에서는 소유자 크레딧을 소모하는 구간 해설 생성을 막고 self-CTA 로 유도한다.
    if (shareMode) { onShareCta?.(); return }
    if (!entryId) return

    // 서버가 overlay를 쓰지 않으므로 클라 캐시도 본인 차트 기준만 유지
    const prefix = weekly ? 'w_' : monthly ? 'm_' : ''
    const cacheKey = startYear === endYear ? `${prefix}${startYear}` : `${prefix}${startYear}_${endYear}`
    const cached = summaryCache.get(cacheKey)
    if (cached) { setYearSummary({ startYear, endYear, ...cached }); return }

    const run = async () => {
      const bal = await fetchBalance()
      // 잔액 부족이어도 서버 캐시 hit 가능 → API는 호출. Gemini는 서버에서 잔액 검사 후 스킵.
      if (bal && bal.ju < READING_COST.period) {
        setJuShortage({ needed: READING_COST.period, current: bal.ju })
      }

      setYearSummaryLoading(true); setYearSummary(null)
      const gid = getGuestId()
      const headers: Record<string, string> = {}
      if (gid) headers['x-guest-id'] = gid
      let url: string
      if (weekly) {
        url = startYear === endYear
          ? `/api/saju/${entryId}/fortune/year?weekStart=${startYear}`
          : `/api/saju/${entryId}/fortune/year?weekStart=${startYear}&weekEnd=${endYear}`
      } else if (monthly) {
        url = startYear === endYear
          ? `/api/saju/${entryId}/fortune/year?month=${startYear}`
          : `/api/saju/${entryId}/fortune/year?month=${startYear}&monthEnd=${endYear}`
      } else {
        url = startYear === endYear
          ? `/api/saju/${entryId}/fortune/year?year=${startYear}`
          : `/api/saju/${entryId}/fortune/year?year=${startYear}&yearEnd=${endYear}`
      }

      // 잔액 부족 + 캐시 미스가 확실하면 Gemini 경로를 아예 안 탈 수 있게 early stop
      // → 서버 캐시 가능성을 위해 API는 유지하되, 잔액 0이면 로딩을 짧게만 유지
      try {
        const r = await fetch(url, { headers })
        const d = await r.json().catch(() => null)
        if (r.status === 401) {
          setYearSummary({ startYear, endYear, text: '구간 해설을 보려면 로그인이 필요해요.' })
          return
        }
        if (r.status === 402) {
          const d402 = d as { needed?: number; ju?: number } | null
          setJuShortage({
            needed: d402?.needed ?? READING_COST.period,
            current: d402?.ju ?? bal?.ju ?? 0,
          })
          clearBalanceCache()
          void fetchBalance()
          return
        }
        if (r.status === 409) {
          setYearSummary({
            startYear,
            endYear,
            text: typeof d?.error === 'string' ? d.error : '데이터가 아직 준비되지 않았어요.',
          })
          return
        }
        if (!r.ok) {
          setYearSummary({ startYear, endYear, text: d?.error ?? '해설을 불러오지 못했습니다.' })
          return
        }
        const text = d?.summary ?? '해석을 불러오지 못했습니다.'
        const result = { text }
        if (!/불러오지 못했습니다/.test(text)) summaryCache.set(cacheKey, result)
        setYearSummary({ startYear, endYear, ...result })
        setJuShortage(null)
        clearBalanceCache()
        void fetchBalance()
      } catch {
        setYearSummary({ startYear, endYear, text: '해설을 불러오지 못했습니다.' })
      } finally {
        setYearSummaryLoading(false)
      }
    }
    void run()
  }, [entryId, summaryCache, shareMode, onShareCta])

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

    if (!rangeMode) {
      // 일반 모드: 포커스 + 단일 시점 해설 CTA (공유 뷰는 크레딧 소모라 CTA 생략)
      if (!shareMode) {
        setQuickPick(yr)
        setYearSummary(null)
        setYearSummaryLoading(false)
      }
      return
    }

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
  }, [mergedData, rangeMode, shareMode])

  const toggleMain = (k: MainOverlayKey) => setMainOverlays(p => ({ ...p, [k]: !p[k] }))
  const toggleAux = (k: AuxKey) => {
    setAuxPanels(p => {
      const next = !p[k]
      if (next) pendingAuxScroll.current = true
      return { ...p, [k]: next }
    })
  }
  const toggleDomain = (k: DomainOverlayKey) => setDomainOverlays(p => ({ ...p, [k]: !p[k] }))

  const anyDomainOn = Object.values(domainOverlays).some(Boolean)
  const canHideBase = anyDomainOn || mainOverlays.daewoon || mainOverlays.candle || overlayActive

  useEffect(() => {
    if (!canHideBase && !baseLineVisible) setBaseLineVisible(true)
  }, [canHideBase, baseLineVisible])

  const applyPanelAndScroll = useCallback(() => {
    setPanelOpen(false)
    if (pendingAuxScroll.current) {
      pendingAuxScroll.current = false
      // 패널 닫힘 애니메이션 후 보조지표 영역으로 스크롤
      requestAnimationFrame(() => {
        setTimeout(() => {
          auxSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }, 80)
      })
    }
  }, [])

  /**
   * 잠금 상태에서 인터랙션이 발생하면 카카오 로그인 시트를 띄우고 true를 반환.
   * 호출부에서 true를 받으면 본래 액션을 중단해야 한다.
   */
  const blockIfLocked = useCallback((feature: string): boolean => {
    if (!isLocked) return false
    if (shareMode) onShareCta?.()
    else onLockedClick?.(feature)
    return true
  }, [isLocked, shareMode, onShareCta, onLockedClick])

  /** 해당 도메인만 켜고 기본 세운 선은 끈다 */
  const showDomainSolo = (k: DomainOverlayKey) => {
    if (blockIfLocked(DOMAIN_OVERLAYS.find(o => o.key === k)?.label ?? '도메인')) return
    setDomainOverlays({
      job: k === 'job',
      wealth: k === 'wealth',
      love: k === 'love',
      health: k === 'health',
      marriage: k === 'marriage',
    })
    setBaseLineVisible(false)
  }

  if (!fullChartData) {
    return <div className="py-12 text-center text-cp-muted text-sm">차트 데이터가 없습니다.</div>
  }

  const anyAux = Object.values(auxPanels).some(Boolean)
  const otherEntries = overlayEntries?.filter(e => e.id !== entryId) ?? []

  const formatPeriodLabel = (start: number, end: number) => {
    if (isWeekly) {
      return start === end
        ? weekFullLabel(start, mergedData)
        : `${weekFullLabel(start, mergedData)}~${weekFullLabel(end, mergedData)}`
    }
    if (isMonthly) {
      return start === end ? `${start}월` : `${start}~${end}월`
    }
    return start === end ? `${start}년` : `${start}~${end}년`
  }

  const showRangeCta = rangeMode && selection && !yearSummary && !yearSummaryLoading
  const showQuickCta = !rangeMode && !shareMode && quickPick != null && !yearSummary && !yearSummaryLoading
  const showSummaryCard = !!(yearSummaryLoading || yearSummary) && (rangeMode || !shareMode)

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
          className="absolute top-3 right-3 z-10 flex items-center gap-1 h-8 px-2 rounded-full bg-cp-surface/95 backdrop-blur border border-cp-border/80 hover:bg-cp-surface hover:border-cp-border transition-all shadow-sm">
          <span className="text-sm leading-none">📊</span>
          <span className="text-[10px] font-semibold text-cp-line">지표</span>
          {settingsBadge && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cp-line rounded-full animate-pulse" />}
        </button>

        {/* Overlay legend — fixed height to prevent layout shift */}
        <div className="min-h-4 flex flex-wrap justify-center items-center gap-x-3 gap-y-0.5">
          {baseLineVisible && !overlayActive && (
            <span className="flex items-center gap-1 text-[10px] text-cp-muted">
              <span className="w-4 h-0.5 bg-cp-line rounded inline-block" /> {isWeekly ? '일운' : isMonthly ? '월운' : '세운'}
            </span>
          )}
          {mainOverlays.daewoon && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
              <span className="w-4 h-0.5 rounded inline-block" style={{ backgroundColor: '#ffd700' }} /> 대운
            </span>
          )}
          {overlayActive && (<>
            {baseLineVisible && (
              <span className="flex items-center gap-1 text-[10px] text-cp-muted">
                <span className="w-4 h-0.5 bg-cp-line rounded inline-block" /> {currentName || '나'}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-cp-muted">
              <span className="w-4 h-0.5 bg-cp-down rounded inline-block" /> {overlayName}
            </span>
          </>)}
          {overlayActive && (
            <>
              <span className="flex items-center gap-1 text-[10px] text-cp-muted">
                <span className="w-3 h-2 rounded-sm inline-block" style={{ backgroundColor: YEAR_LEVEL_COLORS.good }} /> 좋음
              </span>
              <span className="flex items-center gap-1 text-[10px] text-cp-muted">
                <span className="w-3 h-2 rounded-sm inline-block border border-cp-border" style={{ backgroundColor: YEAR_LEVEL_COLORS.normal }} /> 보통
              </span>
              <span className="flex items-center gap-1 text-[10px] text-cp-muted">
                <span className="w-3 h-2 rounded-sm inline-block" style={{ backgroundColor: YEAR_LEVEL_COLORS.caution }} /> 주의
              </span>
            </>
          )}
          {DOMAIN_OVERLAYS.filter(o => domainOverlays[o.key]).map(o => (
            <span key={o.key} className="flex items-center gap-1 text-[10px] text-cp-muted">
              <span className="w-4 h-0.5 rounded inline-block" style={{ backgroundColor: o.color }} /> {o.label}
            </span>
          ))}
        </div>

        {/* Main chart */}
        <div className="w-full h-[420px] relative z-0 bg-cp-raised rounded-xl" onPointerDown={dismissChartHint}>
          {chartHint && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none animate-fade-in">
              <span className="bg-cp-surface/95 backdrop-blur-sm text-cp-muted text-xs px-3 py-2 rounded-xl shadow-sm border border-cp-border text-center max-w-[240px] leading-relaxed">
                노란·파란 점은 최고·최저예요
                <span className="block text-[10px] text-cp-muted mt-0.5">차트를 터치해 시기별 흐름을 확인해보세요</span>
              </span>
            </div>
          )}
          {/* 구간 안내 — X축 라벨·눈금보다 확실히 위(플롯 하단) */}
          {rangeMode && !selection && (
            <div className="absolute left-0 right-0 bottom-[76px] z-[5] flex justify-center pointer-events-none">
              <span className="text-[10px] text-cp-violet animate-pulse bg-cp-violetMuted px-2.5 py-0.5 rounded-full border border-cp-violetBorder/50">
                {isWeekly
                  ? '👆 여러 요일을 드래그하거나, 시작·끝을 눌러 주세요'
                  : isMonthly
                    ? '👆 여러 달을 드래그하거나, 시작·끝을 눌러 주세요'
                    : '👆 여러 해를 드래그하거나, 시작·끝을 눌러 주세요'}
              </span>
            </div>
          )}
          {rangeMode && selection && selection.startYear === selection.endYear && rangeFirst.current && (
            <div className="absolute left-0 right-0 bottom-[76px] z-[5] flex justify-center pointer-events-none">
              <span className="text-[10px] text-cp-violet animate-pulse bg-cp-violetMuted px-2.5 py-0.5 rounded-full border border-cp-violetBorder/50">
                {isWeekly
                  ? '👆 끝 요일을 눌러 주세요'
                  : isMonthly
                    ? '👆 끝 달을 눌러 주세요'
                    : '👆 끝 연도를 눌러 주세요'}
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
              <defs>
                <linearGradient id="cpScoreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F04452" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#F04452" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cpScoreEdgeFade" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#fff" stopOpacity={0} />
                  <stop offset="10%" stopColor="#fff" stopOpacity={1} />
                  <stop offset="90%" stopColor="#fff" stopOpacity={1} />
                  <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                </linearGradient>
                <mask id="cpScoreEdgeMask" maskContentUnits="objectBoundingBox">
                  <rect x="0" y="0" width="1" height="1" fill="url(#cpScoreEdgeFade)" />
                </mask>
              </defs>
              <XAxis dataKey="year" type="number" domain={xDomain} tick={{ fontSize: 8, fill: '#8B8B93' }} angle={isMonthly || isWeekly ? 0 : -45} textAnchor={isMonthly || isWeekly ? 'middle' : 'end'} height={40}
                    ticks={
                      isWeekly
                        ? [...WEEK_TICKS]
                        : isMonthly
                          ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
                          : period === 'all'
                            ? evenYearTicks(filteredData, 8)
                            : undefined
                    }
                    interval={0}
                    tickFormatter={
                      isWeekly
                        ? (v: number) => weekTickLabel(filteredData, v)
                        : isMonthly
                          ? (v: number) => MONTH_LABELS[v - 1] ?? ''
                          : undefined
                    }
                    padding={{left: 8, right: 8}}/>
              <YAxis domain={yDomain} hide={true} width={0}/>
              {!rangeMode && <Tooltip content={<MainTooltip overlays={mainOverlays} domainOverlays={domainOverlays} monthly={isMonthly || isWeekly} overlayActive={overlayActive} overlayName={overlayName} currentName={currentName} yearLevels={isWeekly ? weekLevels : isMonthly ? monthLevels : yearLevels} hideDetail={isLocked}/>} cursor={hoverYear != null ? { stroke: '#F04452', strokeWidth: 1, strokeDasharray: '4 2', strokeOpacity: 0.45 } : false}/>}
              {rangeMode && <Tooltip content={() => null} cursor={hoverYear != null ? { stroke: '#F04452', strokeWidth: 1, strokeDasharray: '4 2', strokeOpacity: 0.45 } : false}/>}
              {currentYearScore != null && <ReferenceLine y={currentYearScore} stroke="#2E2F36" strokeWidth={0.5} strokeDasharray="3 3" label={{ value: `${currentYearScore}`, position: 'insideLeft', fontSize: 10, fill: '#8B8B93', offset: 4 }}/>}
              {mainOverlays.season && hasEngineData && !isWeekly && seasonBands.map((b: SeasonBand, i: number) => (
                <ReferenceArea key={i} x1={b.startYear} x2={b.endYear} fill={SEASON_COLORS[b.tag] ?? 'rgba(0,0,0,0.03)'} fillOpacity={1}/>
              ))}
              {rangeMode && selection && <ReferenceArea x1={selection.startYear} x2={selection.endYear} fill="#A78BFA" fillOpacity={0.16} stroke="#A78BFA" strokeOpacity={0.45} strokeWidth={1}/>}
              {mainOverlays.daewoon && !isWeekly && <Line type="stepAfter" dataKey="trend" stroke="#ffd700" strokeWidth={2} dot={false} name="대운" isAnimationActive={false}/>}
              {baseLineVisible && (
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="none"
                  fill="url(#cpScoreFill)"
                  mask="url(#cpScoreEdgeMask)"
                  isAnimationActive={!hasAnimated.current}
                  animationDuration={2000}
                  animationEasing="ease-in-out"
                  legendType="none"
                />
              )}
              {baseLineVisible && (
                <Line type="monotone" dataKey="score" stroke="#F04452" strokeWidth={2} dot={false} name={isWeekly ? '일운' : isMonthly ? '월운' : '세운'} isAnimationActive={!hasAnimated.current} animationDuration={2000} animationEasing="ease-in-out"/>
              )}
              {DOMAIN_OVERLAYS.map(o => domainOverlays[o.key] ? (
                <Line key={o.key} type="monotone"
                  dataKey={(d: Record<string, unknown>) => domainValue(d, o.field)}
                  stroke={o.color} strokeWidth={1.5} dot={false} name={o.label}
                  strokeDasharray={baseLineVisible ? '3 2' : undefined} isAnimationActive={false} connectNulls={false}/>
              ) : null)}
              {overlayActive && mainOverlays.daewoon && !isWeekly && <Line type="stepAfter" dataKey="trendOv" stroke="#4B8FF7" strokeWidth={2} dot={false} name="대운(비교)" strokeDasharray="6 3" isAnimationActive={false} connectNulls={false}/>}
              {overlayActive && baseLineVisible && (
                <Line type="monotone" dataKey="scoreOv" stroke="#3182F6" strokeWidth={1.5} dot={false} name={isWeekly ? '일운(비교)' : isMonthly ? '월운(비교)' : '세운(비교)'} isAnimationActive={true} animationDuration={1800} animationEasing="ease-in-out" connectNulls={false}/>
              )}
              {mainOverlays.candle && !isWeekly && <Bar dataKey="close" name="캔들" shape={<CandleShape/>} isAnimationActive={false}/>}
              {overlayActive && !isWeekly && (
                <Customized component={(p: any) => (
                  <CompatYearBar {...p} yearLevels={isMonthly ? monthLevels : yearLevels} isMonthly={isMonthly} />
                )}/>
              )}
              {overlayActive && isWeekly && weekLevels.size > 0 && (
                <Customized component={(p: any) => (
                  <CompatYearBar {...p} yearLevels={weekLevels} isMonthly={false} />
                )}/>
              )}
              <Customized component={(p: any) => (
                <ThisYearMarker
                  {...p}
                  period={period}
                  markerYear={markerYear}
                  selection={selection}
                  rangeMode={rangeMode}
                  isMonthly={isMonthly}
                  isWeekly={isWeekly}
                  weekLen={WEEK_TODAY_X}
                  weekLabelAt={(x: number) => weekFullLabel(x, filteredData)}
                  peak={extremes.peak}
                  low={extremes.low}
                  showExtremes={lineAnimDone}
                  extremesOpaque={extremesOpaque}
                />
              )}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Period selector — 차트에 가깝게 올리되, z-index로 클릭이 차트에 먹히지 않게 */}
        <div className="relative z-10 flex justify-center items-center gap-1.5 -mt-5 mb-1" ref={chartRef}>
          {([['week', '이번 주'], ['year', '올해'], ['all', '전체']] as [PeriodKey, string][]).map(([k, l]) => (
            <button key={k} onClick={() => {
              if (k !== 'all' && blockIfLocked(k === 'week' ? '이번 주' : '올해')) return
              setPeriod(k)
              setSelection(null)
              setQuickPick(null)
              setYearSummary(null)
              setYearSummaryLoading(false)
              setRangeMode(false)
              rangeFirst.current = null
              setPinnedYear(null)
              if (k === 'week') {
                setClickedYear(WEEK_TODAY_X)
              } else if (k === 'year') {
                setClickedYear(THIS_MONTH)
              } else {
                setClickedYear(THIS_YEAR)
              }
            }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${period === k && !rangeMode ? 'bg-cp-hover text-cp-text' : 'text-cp-muted hover:bg-cp-hover/60 hover:text-cp-secondary'} ${isLocked && k !== 'all' ? 'opacity-60' : ''}`}>{l}{isLocked && k !== 'all' ? ' 🔒' : ''}</button>
          ))}
          {/* 구분선 — 비교/구간 버튼 중 하나라도 보일 때만 */}
          {(otherEntries.length > 0 || !shareMode) && (
            <span className="w-px h-4 bg-cp-border mx-1"/>
          )}
          {/* 비교: 공유 뷰에서도 예시 인물과 비교 가능 (크레딧 무소모) */}
          {otherEntries.length > 0 && (
            overlayActive ? (
              <button onClick={clearOverlay}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-cp-surface border border-cp-border text-cp-down text-[10px] font-medium hover:bg-cp-border transition-all">
                👥 {overlayName} <span className="ml-0.5 text-cp-down">&times;</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (blockIfLocked('비교')) return
                  setCompareSheetOpen(true)
                }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-cp-surface/80 backdrop-blur border border-cp-border/60 hover:bg-cp-surface hover:border-cp-border transition-all shadow-sm group"
              >
                <span className="text-[10px] font-medium text-cp-muted group-hover:text-cp-line transition-colors">
                  👥 궁합{isLocked ? ' 🔒' : ''}
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
                setQuickPick(null)
                if (next) { setSelection(null); setYearSummary(null); rangeFirst.current = null }
                else { setSelection(null); rangeFirst.current = null }
              }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                rangeMode
                  ? 'bg-cp-violetMuted text-cp-violet border border-cp-violetBorder'
                  : 'bg-cp-surface/80 backdrop-blur border border-cp-border/60 hover:bg-cp-violetMuted/50 hover:border-cp-violetBorder/60 text-cp-muted hover:text-cp-violet'
              }`}
            >
              🗓️ 구간{isLocked ? ' 🔒' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Selection CTA — 구간 모드 범위 선택, 또는 일반 모드 단일 클릭 */}
      {showRangeCta && selection && (
        <div className="mx-3 sm:mx-4 mt-3 mb-1">
          <div className="bg-cp-raised rounded-2xl p-3 sm:p-4 ring-1 ring-cp-violetBorder/60 border border-cp-violetBorder/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-cp-violetMuted text-cp-violet whitespace-nowrap flex-shrink-0">
                {formatPeriodLabel(selection.startYear, selection.endYear)}
              </span>
              {(() => {
                const yds = mergedData.filter(d => d.year >= selection.startYear && d.year <= selection.endYear)
                if (!yds.length) return null
                const avg = Math.round(yds.reduce((a, b) => a + b.score, 0) / yds.length)
                return <span className="text-[11px] text-cp-muted truncate min-w-0">평균 {avg}점</span>
              })()}
              <button
                type="button"
                onClick={() => { setSelection(null); rangeFirst.current = null }}
                className="ml-auto w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-cp-surface text-cp-muted hover:bg-cp-hover hover:text-cp-secondary text-xs leading-none transition-colors"
                aria-label="닫기"
              >&times;</button>
            </div>
            <button
              onClick={() => {
                if (blockIfLocked('구간 해설')) return
                fetchSummary(selection.startYear, selection.endYear, isMonthly, isWeekly)
              }}
              className="w-full py-2.5 rounded-xl text-[13px] sm:text-sm font-semibold bg-cp-violetMuted text-cp-violet border border-cp-violetBorder hover:brightness-110 transition-colors truncate">
              {formatPeriodLabel(selection.startYear, selection.endYear)} 해설 보기
            </button>
          </div>
        </div>
      )}

      {showQuickCta && quickPick != null && (
        <div className="mx-3 sm:mx-4 mt-3 mb-1">
          <div className="bg-cp-raised rounded-2xl p-3 sm:p-4 ring-1 ring-cp-violetBorder/60 border border-cp-violetBorder/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-cp-violetMuted text-cp-violet whitespace-nowrap flex-shrink-0">
                {formatPeriodLabel(quickPick, quickPick)}
              </span>
              {(() => {
                const yd = mergedData.find(d => d.year === quickPick)
                if (!yd) return null
                return (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] text-cp-muted">{Math.round(yd.score)}점</span>
                    {!isWeekly && yd.seasonTag && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-cp-border flex-shrink-0" />
                        <span className="text-[11px] text-cp-muted truncate">{yd.seasonTag}</span>
                      </>
                    )}
                  </div>
                )
              })()}
              <button
                type="button"
                onClick={() => setQuickPick(null)}
                className="ml-auto w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-cp-surface text-cp-muted hover:bg-cp-hover hover:text-cp-secondary text-xs leading-none transition-colors"
                aria-label="닫기"
              >&times;</button>
            </div>
            <button
              onClick={() => {
                if (blockIfLocked('구간 해설')) return
                fetchSummary(quickPick, quickPick, isMonthly, isWeekly)
              }}
              className="w-full py-2.5 rounded-xl text-[13px] sm:text-sm font-semibold bg-cp-violetMuted text-cp-violet border border-cp-violetBorder hover:brightness-110 transition-colors truncate">
              {formatPeriodLabel(quickPick, quickPick)} 해설 보기
            </button>
          </div>
        </div>
      )}

      {showSummaryCard && (
        <div className="mx-3 sm:mx-4 mt-3 mb-1">
          <div className="bg-cp-bg rounded-2xl p-3 sm:p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] ring-1 ring-cp-border">
            {yearSummaryLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-cp-border border-t-cp-line animate-spin" />
                <span className="text-xs text-cp-muted flex-1">해설을 생성하고 있어요...</span>
                <button
                  type="button"
                  onClick={() => {
                    setYearSummary(null)
                    setYearSummaryLoading(false)
                    setSelection(null)
                    setQuickPick(null)
                    rangeFirst.current = null
                  }}
                  className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-cp-surface text-cp-muted hover:bg-cp-border hover:text-cp-muted text-xs leading-none transition-colors"
                  aria-label="닫기"
                >&times;</button>
              </div>
            ) : yearSummary ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-cp-surface text-cp-line whitespace-nowrap flex-shrink-0">
                    {formatPeriodLabel(yearSummary.startYear, yearSummary.endYear)}
                  </span>
                  {(() => {
                    const yds = mergedData.filter(d => d.year >= yearSummary.startYear && d.year <= yearSummary.endYear)
                    if (!yds.length) return null
                    if (yds.length === 1) return (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs text-cp-muted">{Math.round(yds[0]!.score)}점</span>
                        {!isWeekly && yds[0]!.seasonTag && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-cp-border" />
                            <span className="text-xs text-cp-muted">{yds[0]!.seasonTag}</span>
                          </>
                        )}
                      </div>
                    )
                    const avg = Math.round(yds.reduce((a, b) => a + b.score, 0) / yds.length)
                    const peak = yds.reduce((a, b) => a.score > b.score ? a : b)
                    const peakLabel = isWeekly
                      ? (peak.dayLabel ?? weekFullLabel(peak.year, mergedData))
                      : isMonthly
                        ? `${peak.year}월`
                        : `${peak.year}년`
                    return <span className="text-[10px] sm:text-[11px] text-cp-muted truncate min-w-0">평균 {avg}점 · 최고 {peakLabel}({Math.round(peak.score)}점)</span>
                  })()}
                  <button
                    type="button"
                    onClick={() => {
                      setYearSummary(null)
                      setYearSummaryLoading(false)
                      setSelection(null)
                      setQuickPick(null)
                      rangeFirst.current = null
                    }}
                    className="ml-auto w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-cp-surface text-cp-muted hover:bg-cp-border hover:text-cp-muted text-xs leading-none transition-colors"
                    aria-label="닫기"
                  >&times;</button>
                </div>
                {/(불러오지 못했습니다|준비되지|부족해요)/.test(yearSummary.text) ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <p className="text-[13px] text-cp-muted text-center">{yearSummary.text}</p>
                    <button
                      type="button"
                      onClick={() => fetchSummary(yearSummary.startYear, yearSummary.endYear, isMonthly, isWeekly)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-cp-surface text-cp-line hover:bg-cp-border transition-colors"
                    >
                      다시 시도
                    </button>
                  </div>
                ) : (
                  <p className="text-[13px] text-cp-muted leading-relaxed pr-2">{cleanFortuneText(yearSummary.text)}</p>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Auxiliary charts */}
      {anyAux && (hasEngineData || (isWeekly && weekData.length > 0)) && (
        <div ref={auxSectionRef} className="px-2 mt-2 space-y-3" data-capture="02_보조지표">
          {auxPanels.yongshin && (
            <div>
              <div className="text-[10px] text-cp-muted text-right pr-2 mb-0.5"><InfoTip align="right" label="필요한 기운" text={"내게 가장 필요한 기운(용신)이 얼마나 들어오는지 보여줘요.\n양수 → 좋은 기운이 충분한 시기\n음수 → 기운이 부족한 시기"} /></div>
              <div className="h-[80px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
              <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{left: 8, right: 8}}/><YAxis domain={[-1,1]} hide={true} width={0}/>
              <Tooltip content={<SubTooltip monthly={isMonthly}/>} cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }}/><ReferenceLine y={0} stroke="#3A3942"/>
              {markerYear != null && <ReferenceLine x={markerYear} stroke="#F04452" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>}
              <Area dataKey="yongshinPower" stroke="#9b59b6" fill="#9b59b6" fillOpacity={0.2} dot={false}/>
              {overlayActive && <Area dataKey="yongshinPowerOv" stroke="#3182F6" fill="#3182F6" fillOpacity={0.15} dot={false} strokeDasharray="4 2"/>}
            </AreaChart></ResponsiveContainer></div>
            </div>
          )}
          {auxPanels.energy && (
            <div><div className="flex items-center justify-between px-2 mb-0.5">
              <div className="flex items-center gap-2 text-[9px] ml-7">
                <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{background:'#27ae60',opacity:0.7}}/><span className="text-cp-muted">길한 변화</span></span>
                <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{background:'#e74c3c',opacity:0.7}}/><span className="text-cp-muted">도전적 변화</span></span>
              </div>
              <div className="text-[10px] text-cp-muted"><InfoTip align="right" label="변화의 파도" text={"그 해/달에 일어날 수 있는 변화의 강도예요.\n🟢 초록 = 좋은 방향의 변화\n🔴 빨강 = 도전적 변화\n막대가 클수록 변화가 큰 시기예요."} /></div>
            </div>
            <div className="h-[70px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
              <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{left: 8, right: 8}}/><YAxis domain={[0,8]} hide={true} width={0}/>
              <Tooltip content={<SubTooltip decimals={1} monthly={isMonthly}/>} cursor={{ fill: 'rgba(255,255,255,0.06)' }}/>
              {markerYear != null && <ReferenceLine x={markerYear} stroke="#F04452" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>}
              <Bar dataKey="energyTotal" isAnimationActive={false}>{mergedData.map((d,i) => <Cell key={i} fill={d.energyDirection>=0?'#27ae60':'#e74c3c'} fillOpacity={0.7}/>)}</Bar>
            </BarChart></ResponsiveContainer></div></div>
          )}
          {auxPanels.noble && (
            <div><div className="text-[10px] text-cp-muted text-right pr-2 mb-0.5"><InfoTip align="right" label="귀인의 도움" text={"주변 사람과의 관계 에너지예요.\n양수 → 도움을 주는 인연이 활성화\n음수 → 관계에서 마찰이 생기기 쉬운 시기"} /></div>
            <div className="h-[70px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
              <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{left: 8, right: 8}}/><YAxis domain={[-15,15]} hide={true} width={0}/>
              <Tooltip content={<SubTooltip decimals={0} monthly={isMonthly}/>} cursor={{ fill: 'rgba(255,255,255,0.06)' }}/><ReferenceLine y={0} stroke="#3A3942"/>
              {markerYear != null && <ReferenceLine x={markerYear} stroke="#F04452" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>}
              <Bar dataKey="noblePower" isAnimationActive={false}>{mergedData.map((d,i) => <Cell key={i} fill={d.noblePower>=0?'#f39c12':'#8e44ad'} fillOpacity={0.7}/>)}</Bar>
            </BarChart></ResponsiveContainer></div></div>
          )}
          {auxPanels.ohang && (
            <div><div className="text-[10px] text-cp-muted text-right pr-2 mb-0.5"><InfoTip align="right" label="오행 균형도" text={"목·화·토·금·수 다섯 기운의 균형 정도예요.\n0.5에 가까울수록 균형이 잘 맞고,\n0이나 1에 가까우면 특정 기운이 치우쳐 있다는 뜻이에요."} /></div>
            <div className="h-[70px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={mergedData} syncId="lc" margin={SUB_MARGIN}>
              <XAxis dataKey="year" type="number" domain={xDomain} hide padding={{left: 8, right: 8}}/><YAxis domain={[0,1]} hide={true} width={0}/>
              <Tooltip content={<SubTooltip monthly={isMonthly}/>} cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }}/><ReferenceLine y={0.5} stroke="#3A3942" strokeDasharray="3 3"/>
              {markerYear != null && <ReferenceLine x={markerYear} stroke="#F04452" strokeWidth={1} strokeDasharray="4 2" strokeOpacity={0.5}/>}
              <Line dataKey="ohangBalance" stroke="#3498db" dot={false} strokeWidth={1.5}/>
              {overlayActive && <Line dataKey="ohangBalanceOv" stroke="#3182F6" dot={false} strokeWidth={1.5} strokeDasharray="4 2"/>}
            </LineChart></ResponsiveContainer></div></div>
          )}
          {auxPanels.tengo && (
            <div><div className="text-[10px] text-cp-muted text-right pr-2 mb-0.5"><InfoTip align="right" label={`십성 밸런스 ${selectedData ? `(${isWeekly ? (selectedData.dayLabel?.replace('요일', '') || selectedData.sewoonPillar) : `${selectedData.year}${isMonthly ? '월' : '년'}`})` : '- 차트 클릭'}`} text={"해당 시점의 다섯 가지 에너지 분포예요.\n자아(비겁) = 내 주체성\n표현(식상) = 창의력·표현\n재물(재성) = 돈·현실감각\n직업(관살) = 조직·규율\n학업(인성) = 배움·사고력\n균형이 잡혀야 안정적이에요."} /></div>
            {selectedData ? (() => {
              const rd = [{a:'자아',v:selectedData['tengo비겁'],vO:selectedOverlayData?.['tengo비겁']},{a:'표현',v:selectedData['tengo식상'],vO:selectedOverlayData?.['tengo식상']},{a:'재물',v:selectedData['tengo재성'],vO:selectedOverlayData?.['tengo재성']},{a:'직업',v:selectedData['tengo관살'],vO:selectedOverlayData?.['tengo관살']},{a:'학업',v:selectedData['tengo인성'],vO:selectedOverlayData?.['tengo인성']}]
              const allVals = rd.flatMap(d => [d.v, d.vO]).filter((v): v is number => typeof v === 'number')
              const radarMax = Math.max(Math.ceil(Math.max(...allVals, 1) * 1.3), 2)
              return (<>
                <div className="flex justify-center"><div className="w-[220px] h-[170px]"><ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={rd}>
                    <PolarGrid/><PolarAngleAxis dataKey="a" tick={{fontSize:9, fill:'#8A898C'}}/><PolarRadiusAxis domain={[0, radarMax]} tick={{fontSize:7, fill:'#8A898C'}}/>
                    <Radar dataKey="v" stroke="#1abc9c" fill="#1abc9c" fillOpacity={0.3} name={currentName || '나'}/>
                    {overlayActive && <Radar dataKey="vO" stroke="#3182F6" fill="#3182F6" fillOpacity={0.2} name={overlayName}/>}
                  </RadarChart>
                </ResponsiveContainer></div></div>
                <div className="flex justify-center gap-3 mt-1">
                  {rd.map(d => (
                    <span key={d.a} className="text-[9px] text-cp-muted">{d.a} <span className="font-semibold text-teal-600">{d.v?.toFixed(1)}</span>
                      {overlayActive && d.vO != null && <span className="text-cp-down ml-0.5">/{d.vO.toFixed(1)}</span>}
                    </span>
                  ))}
                </div>
                {overlayActive && (
                  <div className="flex justify-center gap-3 mt-0.5 text-[9px]">
                    <span className="text-teal-600">■ {currentName || '나'}</span>
                    <span className="text-cp-down">■ {overlayName}</span>
                  </div>
                )}
              </>)
            })() : <div className="text-center text-cp-border text-xs py-4">메인 차트에서 연도를 클릭하세요</div>}
            </div>
          )}
          {auxPanels.event && (
            <div><div className="text-[10px] text-cp-muted text-right pr-2 mb-0.5"><InfoTip align="right" wide label={`이벤트 확률 ${selectedData ? `(${isWeekly ? (selectedData.dayLabel?.replace('요일', '') || selectedData.sewoonPillar) : `${selectedData.year}${isMonthly ? '월' : '년'}`})` : '- 차트 클릭'}`} text={"총운 점수와는 별개로, 특정 사건이 일어날 가능성을 보여줘요.\n예) 총운의 재물 점수 = 재물운의 좋고 나쁨\n이벤트 재물확률 = 큰 돈이 오갈 이벤트가 생길 확률\n높다고 반드시 좋은 건 아니에요."} /></div>
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
                    <XAxis type="number" domain={[0,100]} tick={{fontSize:8, fill:'#8A898C'}}/>
                    <YAxis type="category" dataKey="n" tick={{fontSize:9, fill:'#8A898C'}} width={32} interval={0}/>
                    <Bar dataKey="p" isAnimationActive={false} barSize={overlayActive ? 6 : 10} name={currentName || '나'}
                      label={!overlayActive ? {position:'right',fontSize:9,fill:'#666',formatter:(v:number)=>`${v}%`} : undefined}>
                      {['#e74c3c','#e91e63','#ff9800','#4caf50','#2196f3','#9c27b0'].map((c,i)=><Cell key={i} fill={c} fillOpacity={0.8}/>)}
                    </Bar>
                    {overlayActive && (
                      <Bar dataKey="pO" isAnimationActive={false} barSize={6} name={overlayName}>
                        {evData.map((_,i)=><Cell key={i} fill="#3182F6" fillOpacity={0.6}/>)}
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer></div>
              )
            })() : <div className="text-center text-cp-border text-xs py-4">메인 차트에서 연도를 클릭하세요</div>}
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
        onShareCta={onShareCta}
        expandCompatCardKey={expandCompatCardKey}
        compatGeneration={compatGeneration}
        onFortuneJsonUpdate={onFortuneJsonUpdate}
        activeCompat={activeCompat}
        onCompatCta={onCompatCta}
      />

      {/* Sliding Panel — indicator settings */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={applyPanelAndScroll}>
          <div className="absolute inset-0 bg-black/30"/>
          <div className="relative w-[280px] max-w-[80vw] bg-cp-bg h-full shadow-xl overflow-y-auto animate-slide-in-right" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="font-bold text-cp-text mb-4">차트 지표 설정</h3>
              <div className="mb-5">
                <div className="text-xs font-semibold text-cp-muted mb-2">메인 차트 선</div>
                <div className={isLocked ? '' : 'stagger-fade-in'}>
                  <button
                    type="button"
                    onClick={() => {
                      if (blockIfLocked(isMonthly ? '월운' : '세운')) return
                      if (!canHideBase && baseLineVisible) return
                      setBaseLineVisible(v => !v)
                    }}
                    className="w-full flex items-center justify-between gap-3 py-3 px-1 -mx-1 rounded-lg hover:bg-cp-bg transition-colors min-h-[44px] text-left"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!isLocked && baseLineVisible}
                        readOnly
                        disabled={isLocked || (!canHideBase && baseLineVisible)}
                        className="w-4 h-4 rounded border-cp-border text-cp-line focus:ring-cp-line pointer-events-none"
                      />
                      <span className={`text-sm flex items-center gap-2 ${isLocked ? 'text-cp-muted' : 'text-cp-text'}`}>
                        <span className="w-3 h-0.5 rounded bg-cp-line" />
                        기본 {isWeekly ? '일운' : isMonthly ? '월운' : '세운'}
                      </span>
                    </span>
                    {isLocked ? (
                      <span className="text-cp-border text-sm leading-none">🔒</span>
                    ) : !canHideBase ? (
                      <span className="text-[10px] text-cp-border">필수</span>
                    ) : null}
                  </button>
                  {MAIN_OVERLAYS.map(o => {
                    const weeklyUnsupported = isWeekly && (o.key === 'daewoon' || o.key === 'candle' || o.key === 'season')
                    return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => {
                        if (weeklyUnsupported) return
                        if (blockIfLocked(o.label)) return
                        toggleMain(o.key)
                      }}
                      className="w-full flex items-center justify-between gap-3 py-3 px-1 -mx-1 rounded-lg hover:bg-cp-bg transition-colors min-h-[44px] text-left"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!isLocked && !weeklyUnsupported && mainOverlays[o.key]}
                          readOnly
                          disabled={isLocked || weeklyUnsupported}
                          className="w-4 h-4 rounded border-cp-border text-cp-line focus:ring-cp-line pointer-events-none"
                        />
                        <span className={`text-sm ${isLocked || weeklyUnsupported ? 'text-cp-muted' : 'text-cp-text'}`}>
                          {o.label}
                          {weeklyUnsupported ? <span className="text-[10px] text-cp-border ml-1">이번 주 미지원</span> : null}
                        </span>
                      </span>
                      {isLocked && <span className="text-cp-border text-sm leading-none">🔒</span>}
                    </button>
                    )
                  })}
                </div>
              </div>
              <div className="mb-5">
                <div className="text-xs font-semibold text-cp-muted mb-0.5">도메인 운세 선 (메인 차트)</div>
                <div className="text-[10px] text-cp-muted mb-2">「만」을 누르면 그 운만 단독으로 봐요</div>
                <div className={isLocked ? '' : 'stagger-fade-in'}>
                  {DOMAIN_OVERLAYS.map(o => (
                    <div
                      key={o.key}
                      className="w-full flex items-center justify-between gap-2 py-2 px-1 -mx-1 rounded-lg min-h-[44px]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (blockIfLocked(o.label)) return
                          toggleDomain(o.key)
                        }}
                        className="flex-1 flex items-center gap-3 text-left hover:bg-cp-bg rounded-lg py-1 -my-1 px-1 -mx-1 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!isLocked && domainOverlays[o.key]}
                          readOnly
                          disabled={isLocked}
                          className="w-4 h-4 rounded border-cp-border text-cp-line focus:ring-cp-line pointer-events-none"
                        />
                        <span className={`text-sm flex items-center gap-2 ${isLocked ? 'text-cp-muted' : 'text-cp-text'}`}>
                          <span className="w-3 h-0.5 rounded" style={{ backgroundColor: o.color, opacity: isLocked ? 0.4 : 1 }} />
                          {o.label}
                        </span>
                      </button>
                      {isLocked ? (
                        <span className="text-cp-border text-sm leading-none pr-1">🔒</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => showDomainSolo(o.key)}
                          className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${
                            domainOverlays[o.key] && !baseLineVisible && !DOMAIN_OVERLAYS.some(x => x.key !== o.key && domainOverlays[x.key])
                              ? 'bg-cp-border text-cp-line'
                              : 'bg-cp-surface text-cp-muted hover:bg-cp-surface hover:text-cp-line'
                          }`}
                        >
                          만
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-5">
                <div className="text-xs font-semibold text-cp-muted mb-2">보조지표 (차트 아래)</div>
                <div className={isLocked ? '' : 'stagger-fade-in'}>
                  {AUX_PANELS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => {
                        if (blockIfLocked(o.label)) return
                        toggleAux(o.key)
                      }}
                      className="w-full flex items-center justify-between gap-3 py-3 px-1 -mx-1 rounded-lg hover:bg-cp-bg transition-colors min-h-[44px] text-left"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!isLocked && auxPanels[o.key]}
                          readOnly
                          disabled={isLocked}
                          className="w-4 h-4 rounded border-cp-border text-cp-line focus:ring-cp-line pointer-events-none"
                        />
                        <span className={`text-sm flex items-center gap-2 ${isLocked ? 'text-cp-muted' : 'text-cp-text'}`}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: o.color, opacity: isLocked ? 0.4 : 1 }} />
                          {o.label}
                        </span>
                      </span>
                      {isLocked && <span className="text-cp-border text-sm leading-none">🔒</span>}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={applyPanelAndScroll}
                className="w-full py-3 rounded-xl bg-cp-accent text-white font-semibold text-sm hover:brightness-110 transition-colors">적용</button>
            </div>
          </div>
        </div>
      )}

      {/* Compare bottom sheet */}
      {compareSheetOpen && (
        <BottomSheet
          onClose={() => setCompareSheetOpen(false)}
          header={(
            <div className="pb-3">
              <h3 className="font-bold text-cp-text text-lg leading-tight">누구와 비교할까요?</h3>
              <p className="text-xs text-cp-muted mt-1">
                {shareMode
                  ? '차트팔자에 저장된 공인과 비교해볼 수 있어요'
                  : '저장된 사주를 골라 차트를 겹쳐 봐요'}
              </p>
            </div>
          )}
          footer={(
            <button
              type="button"
              onClick={() => setCompareSheetOpen(false)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-cp-secondary border border-cp-borderStrong bg-cp-input hover:bg-cp-hover active:brightness-95 transition-colors"
            >
              닫기
            </button>
          )}
        >
          {otherEntries.length === 0 ? (
            <div className="text-center py-10 px-2">
              <p className="text-sm font-medium text-cp-text mb-1">비교할 다른 사주가 없어요</p>
              <p className="text-xs text-cp-muted mb-1">
                {shareMode
                  ? '아직 비교할 수 있는 사주가 없어요'
                  : '친구를 초대하거나 새 사주를 등록해 보세요'}
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5 pb-2">
              {otherEntries.map(e => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOverlayEntryId(e.id)
                      setOverlayName(e.name)
                      setOverlayGender(e.gender)
                      setCompareSheetOpen(false)
                      setSelection(null)
                      setYearSummary(null)
                    }}
                    className="w-full text-left px-3.5 py-3.5 rounded-2xl border border-cp-border bg-cp-input hover:bg-cp-hover hover:border-cp-borderStrong active:brightness-95 flex items-center gap-3.5 transition-colors"
                  >
                    <SajuCharacterAvatar
                      gender={e.gender === 'female' ? 'female' : 'male'}
                      element={normalizeElement(e.dayElement ?? undefined)}
                      personId={e.id}
                      size={44}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-cp-text text-base truncate">{e.name}</span>
                        <span className="text-sm text-cp-muted shrink-0">
                          · {e.gender === 'female' ? '여성' : '남성'}
                        </span>
                      </div>
                      <div className="text-sm text-cp-muted mt-0.5 truncate">
                        {e.birthDate.replace(/-/g, '.')}
                        {e.dayElement ? ` · ${e.dayElement} 일간` : ''}
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-cp-muted shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!shareMode && entryId && (
            <div className="mt-3 pt-4 border-t border-cp-border">
              <p className="text-xs text-cp-muted mb-2.5">친구가 아직 차트팔자에 없나요?</p>
              <button
                type="button"
                onClick={handleInviteFriend}
                disabled={inviteBusy || isLocked}
                className="w-full py-3 rounded-xl text-sm font-semibold text-cp-line bg-cp-input border border-cp-borderStrong hover:bg-cp-hover active:brightness-95 transition-colors disabled:opacity-50"
              >
                {inviteBusy ? '링크 만드는 중…' : '친구 초대하기'}
              </button>
              {inviteUrl && (
                <p className="text-[11px] text-cp-down mt-2 text-center">초대 링크가 복사됐어요</p>
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
        <div className="w-1.5 h-1.5 rounded-full bg-cp-line animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-cp-line animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-cp-line animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <div className="h-12 flex items-center justify-center overflow-hidden px-2">
        <p className={`text-xs text-cp-muted text-center leading-relaxed transition-all duration-300 ease-in-out ${animClass}`}>
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
      <div className="rounded-2xl p-4 bg-cp-surface border border-cp-border">
        <p className="text-xs font-medium mb-1 text-cp-line">당신의 기본 성향</p>
        <p className="text-base font-bold text-cp-text leading-snug mb-2">
          깊은 사유와 부드러운 결단력을 함께 지닌 사람
        </p>
        <p className="text-sm text-cp-text leading-relaxed">
          타고난 감수성과 분석력이 균형 잡혀 있어 직관과 논리를 동시에 잘 쓰는 편이에요.
        </p>
      </div>
      <div className="rounded-2xl p-4 bg-cp-surface border border-cp-border">
        <p className="text-xs font-medium mb-1 text-cp-down">인생의 큰 그림</p>
        <p className="text-base font-bold text-cp-text leading-snug mb-2">
          30대 후반부터 본격적인 도약기가 펼쳐져요
        </p>
        <p className="text-sm text-cp-text leading-relaxed">
          초년의 시행착오가 단단한 기반이 되어 중년 이후 큰 폭의 성장이 가능해요.
        </p>
      </div>
      {['성격과 잠재력', '직업과 커리어', '재물과 투자'].map(t => (
        <div key={t} className="border rounded-xl border-cp-border p-3.5 flex items-start gap-2.5">
          <span className="text-cp-muted text-sm mt-0.5">▶</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-cp-text leading-snug">{t} 해설</p>
            <p className="text-[11px] text-cp-muted mt-0.5">{t}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

interface ActiveCompat {
  partnerId: string
  partnerName: string
  partnerGender: string
  card: CompatCardData
  flow: CompatFlowPoint[]
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
  onShareCta?: () => void
  expandCompatCardKey?: string | null
  compatGeneration?: CompatGenerationState | null
  onFortuneJsonUpdate?: (fortuneJson: unknown) => void
  /** 현재 비교 중인 상대의 라이브 케미 (저장 카드가 없을 때 무료 카드로 표시) */
  activeCompat?: ActiveCompat | null
  /** 궁합 해설 생성 CTA — 부모의 handleCompatCta */
  onCompatCta?: () => void
}

function CompatSpinner() {
  return (
    <span className="inline-flex w-4 h-4 items-center justify-center shrink-0 mt-0.5" aria-hidden>
      <svg className="animate-spin w-3.5 h-3.5 text-cp-down" viewBox="0 0 24 24" fill="none">
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
  isLocked = false, onLockedClick, shareMode = false, onShareCta,
  expandCompatCardKey, compatGeneration, onFortuneJsonUpdate,
  activeCompat, onCompatCta,
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
  const [showJuToast, setShowJuToast] = useState(false)
  const fetchedRef = React.useRef(false)
  const compatSectionRef = React.useRef<HTMLDivElement>(null)

  const compatCards = useMemo(() => {
    if (shareMode) return [] as Array<{ key: string; entry: CompatReportEntry }>
    let base = listCompatEntries(fortuneJson)

    // 생성 중 플레이스홀더
    if (compatGeneration) {
      const cardKey = compatCardKey(compatGeneration.partnerId, compatGeneration.relationship)
      const exists = base.some(c => compatCardKey(c.entry.partnerId, c.entry.relationship) === cardKey)
      if (!exists) {
        const placeholder: CompatReportEntry = {
          partnerId: compatGeneration.partnerId,
          partnerName: compatGeneration.partnerName,
          partnerGender: '',
          relationship: compatGeneration.relationship,
          type: compatGeneration.type,
          text: '',
          createdAt: '',
        }
        base = [{ key: `pending_${cardKey}`, entry: placeholder }, ...base]
      }
    }

    // 현재 비교 중인 상대의 무료 케미 카드 (저장/생성 카드가 없을 때만)
    if (activeCompat && !base.some(c => c.entry.partnerId === activeCompat.partnerId)) {
      const synthetic: CompatReportEntry = {
        partnerId: activeCompat.partnerId,
        partnerName: activeCompat.partnerName,
        partnerGender: activeCompat.partnerGender,
        relationship: 'friend',
        type: '서로 채워주는 궁합',
        text: '',
        createdAt: '',
        card: activeCompat.card,
        flow: activeCompat.flow,
      }
      base = [{ key: `active_${activeCompat.partnerId}`, entry: synthetic }, ...base]
    }

    return base
  }, [fortuneJson, shareMode, compatGeneration, activeCompat])

  const getHeaders = useCallback(() => {
    const h: Record<string, string> = {}
    const gid = getGuestId()
    if (gid) h['x-guest-id'] = gid
    return h
  }, [])

  const fetchFortune = useCallback(async (regen = false) => {
    if (!entryId) return
    if (isLocked || shareMode) return
    setError(null)

    const url = regen ? `/api/saju/${entryId}/fortune?regenerate=true` : `/api/saju/${entryId}/fortune`
    const headers = getHeaders()

    const apply402 = (ju?: number) => {
      setJuShortage({ needed: READING_COST.fortune, current: ju ?? 0 })
      setShowJuToast(true)
      clearBalanceCache()
      void fetchBalance()
    }

    // 잔액 선확인 — 부족하면 로더 대신 부족 UI. 캐시 hit면 아래에서 풀림.
    const bal = await fetchBalance()
    if (bal && bal.ju < READING_COST.fortune) {
      if (regen) {
        apply402(bal.ju)
        setAiLoading(false)
        return
      }
      apply402(bal.ju)
      setAiLoading(false)
      try {
        const r = await fetch(url, { headers })
        const d = await r.json().catch(() => null)
        if (r.ok && d?.items?.length) {
          setItems(d.items)
          fetchedRef.current = true
          setJuShortage(null)
          setShowJuToast(false)
        } else if (r.status === 402) {
          apply402((d as { ju?: number } | null)?.ju ?? bal.ju)
        } else if (!r.ok && r.status !== 401) {
          // 캐시 없음 + 생성 불가 — 부족 UI 유지
        }
      } catch { /* keep shortage UI */ }
      return
    }

    setShowJuToast(false)
    setJuShortage(null)
    setAiLoading(true)
    fetch(url, { headers })
      .then(async r => {
        const d = await r.json().catch(() => null)
        if (r.status === 401) { throw new Error('login_required') }
        if (r.status === 402) {
          apply402((d as { ju?: number } | null)?.ju ?? 0)
          throw new Error('이용권 부족')
        }
        if (!r.ok) throw new Error(d?.error ?? '운세 해설을 불러오지 못했습니다')
        return d
      })
      .then(d => {
        if (d?.items?.length) {
          setItems(d.items)
          fetchedRef.current = true
          setJuShortage(null)
          clearBalanceCache()
          void fetchBalance()
        } else setError('운세 해설 데이터가 없습니다')
      })
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
        const isSynthetic = key.startsWith('active_')
        const cardKey = isSynthetic ? key : compatCardKey(ce.partnerId, ce.relationship)
        const isGenerating = !ce.text && !isSynthetic && compatGeneration?.partnerId === ce.partnerId
          && compatGeneration.relationship === ce.relationship
        const chem = ce.card ?? (activeCompat?.partnerId === ce.partnerId ? activeCompat.card : null)
        const flow = ce.flow ?? (activeCompat?.partnerId === ce.partnerId ? activeCompat.flow : undefined)
        const canToggle = !isGenerating && (!!ce.text || !!chem)
        const isOpen = canToggle && openCompatIds.has(cardKey)
        return (
          <div
            key={key}
            className={`group relative border rounded-xl border-cp-border bg-cp-surface/30 transition-colors ${
              isGenerating ? 'opacity-95' : ''
            } ${!isGenerating && canToggle ? (isOpen ? 'bg-cp-surface' : 'hover:bg-cp-surface/60 active:bg-cp-surface/80') : ''}`}
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
                  <span className="text-cp-down text-sm mt-0.5">{isOpen ? '▼' : '▶'}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-cp-text leading-snug">
                    {currentName || '나'} <span className="text-cp-muted">✕</span> {ce.partnerName}
                    {chem && <span className="text-cp-down font-bold"> · 궁합 {chem.overallScore}</span>}
                  </p>
                  <p className="text-[11px] text-cp-secondary mt-0.5 truncate">
                    {isGenerating
                      ? '해설을 작성하고 있어요…'
                      : isSynthetic
                        ? (chem ? `「${chem.archetype.label}」` : '비교 중')
                        : `${RELATIONSHIP_LABELS[ce.relationship]}${chem ? ` · 「${chem.archetype.label}」` : ` · ${ce.type}`}`}
                  </p>
                </div>
              </button>
              {ce.text && !shareMode && !isGenerating && (
                <div className="relative shrink-0 self-center">
                  <button
                    type="button"
                    onClick={ev => { ev.stopPropagation(); setMenuOpenKey(menuOpenKey === cardKey ? null : cardKey) }}
                    className="w-8 h-8 flex items-center justify-center text-cp-muted hover:text-cp-muted transition-colors"
                    aria-label="메뉴"
                  >
                    &#x22EE;
                  </button>
                  {menuOpenKey === cardKey && (
                    <>
                      <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpenKey(null)} />
                      <div className="absolute top-1/2 -translate-y-1/2 right-9 bg-cp-bg border border-cp-border rounded-lg shadow-lg z-20 overflow-hidden w-[68px]">
                        <button
                          type="button"
                          disabled={shareBusyKey === cardKey && shareCopiedKey !== cardKey}
                          onClick={() => handleCompatShareFromMenu(ce, cardKey)}
                          className="block w-full text-center px-2 py-2 text-xs text-cp-text hover:bg-cp-bg"
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
                          className="block w-full text-center px-2 py-2 text-xs text-cp-up hover:bg-cp-line/10 border-t border-cp-border"
                        >
                          삭제
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-cp-border/80 animate-fade-in space-y-3.5">
                {chem && <CompatChemistry card={chem} flow={flow} />}
                {ce.text ? (
                  <div className="text-sm text-cp-text leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(ce.text) }} />
                ) : !shareMode && onCompatCta ? (
                  <button
                    type="button"
                    onClick={onCompatCta}
                    className="w-full py-2.5 rounded-xl bg-cp-accent text-white text-[13px] font-semibold active:scale-[0.99] transition-transform shadow-sm"
                  >
                    궁합 해설 보기
                  </button>
                ) : null}
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
        <h3 className="font-bold text-cp-text mb-3">운세 해설</h3>
        <LockedPreview
          onUnlock={() => (shareMode ? onShareCta?.() : onLockedClick?.('운세 해설'))}
          badgeText={shareMode ? '내 차트를 만들면 풀려요' : '로그인하면 풀려요'}
          ctaText={shareMode ? '만들기 →' : '로그인 →'}
          ariaLabel={shareMode ? '운세 해설 — 내 차트를 만들면 풀려요' : '운세 해설 — 로그인하면 풀려요'}
          badgeOffsetTop={94}
        >
          <FortunePlaceholder />
        </LockedPreview>
      </div>
    )
  }

  return (
    <div className="px-4 mt-6">
      <h3 className="font-bold text-cp-text mb-3">운세 해설</h3>

      {showJuToast && juShortage && (
        <JuShortageNudge
          needed={juShortage.needed}
          current={juShortage.current}
          onDismiss={() => setShowJuToast(false)}
        />
      )}

      {compatSection}

      {juShortage && !items.length ? (
        <div className="rounded-xl border border-cp-border bg-cp-surface p-4 text-center">
          <p className="text-sm text-cp-text font-medium">주(株)가 부족해요</p>
          <p className="text-xs text-cp-muted mt-1">운세 해설은 {READING_COST.fortune}주가 필요해요.</p>
        </div>
      ) : isLoading ? (
        <FortuneQuoteLoader />
      ) : error ? (
        <div className="rounded-xl border border-cp-border bg-cp-bg p-4 text-center">
          <p className="text-sm text-cp-muted">해설을 불러오는 중 문제가 발생했습니다.</p>
          {error.includes('GEMINI_API_KEY') && (
            <p className="text-xs text-cp-muted mt-2">프로젝트 루트에 .env.local 파일을 만들고 GEMINI_API_KEY=발급받은키 를 추가한 뒤 서버를 재시작하세요.</p>
          )}
          <button onClick={() => fetchFortune()} className="mt-3 px-4 py-2 text-sm font-medium text-cp-line bg-cp-surface rounded-lg hover:bg-cp-border transition-colors">다시 시도</button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-cp-muted text-sm py-6">운세 해설을 불러오는 중...</div>
      ) : (
        <div className="space-y-2">
          {topCards.map((card, i) => {
            const displayCategory = card.category === '한 줄 사주' ? '당신의 기본 성향' : card.category
            return (
            <div key={`card-${i}`} data-capture={i === 0 ? '03_기본성향' : '04_인생의큰그림'}
              className={`rounded-2xl p-4 ${i === 0 ? 'bg-cp-surface border border-cp-border' : 'bg-cp-surface border border-cp-border'}`}>
              <p className={`text-xs font-medium mb-1 ${i === 0 ? 'text-cp-line' : 'text-cp-down'}`}>{displayCategory}</p>
              <p className="text-base font-bold text-cp-text leading-snug mb-2">{card.title}</p>
              <div className="text-sm text-cp-text leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(card.content) }} />
            </div>
          )})}
          {accordionItems.map((item, i) => {
            const realIdx = i + accordionOffset
            return (
              <div key={realIdx}
                data-capture={['05_성격과잠재력','06_직업과커리어','07_재물과투자','08_인연과관계','09_건강과에너지','10_결혼과가정','11_개운법'][i] || undefined}
                className="border rounded-xl overflow-hidden border-cp-border">
                <button onClick={() => toggle(realIdx)}
                  className={`w-full text-left p-3.5 flex items-start gap-2.5 transition-colors ${openIds.has(realIdx) ? 'bg-cp-bg' : 'hover:bg-cp-bg/50'}`}>
                  <span className="text-cp-muted text-sm mt-0.5">{openIds.has(realIdx) ? '▼' : '▶'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-cp-text leading-snug">{item.title}</p>
                    <p className="text-[11px] text-cp-muted mt-0.5">{item.category}</p>
                  </div>
                </button>
                {openIds.has(realIdx) && (
                  <div className="px-4 pb-4 pt-1">
                    <div className="text-sm text-cp-text leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(item.content) }} />
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
            className="bg-cp-bg rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            onClick={ev => ev.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-cp-up" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-cp-text mb-1">궁합 해설 삭제</h3>
              <p className="text-sm text-cp-muted">
                <span className="font-semibold text-cp-text">{deleteTarget.partnerName}</span>
                {' · '}
                {RELATIONSHIP_LABELS[deleteTarget.relationship]} 궁합 해설을 삭제할까요?
              </p>
              <p className="text-xs text-cp-muted mt-1">삭제된 해설은 복구할 수 없습니다.</p>
            </div>
            <div className="grid grid-cols-2 border-t border-cp-border">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
                className="py-3.5 text-sm font-medium text-cp-muted hover:bg-cp-bg transition-colors border-r border-cp-border"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={handleCompatDelete}
                className="py-3.5 text-sm font-bold text-cp-up hover:bg-cp-line/10 transition-colors"
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
