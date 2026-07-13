'use client'

import { useId, useMemo } from 'react'
import { buildSmoothPath } from '@/components/Sparkline'

export interface SummaryLineData {
  score: number
  delta: number
  deltaPercent: number
  label: string
  desc: string
  emoji: string
  /** 100년 곡선(연도별 세운 점수) */
  sparkData: number[]
  /** sparkData 내 올해 인덱스 (-1 이면 없음) */
  currentIdx: number
}

/**
 * 스크롤에 따라 접히는 요약 바.
 * - 펼침(scrolled=false): "올해 운세 N점 | ○○주, 설명 emoji" 한 줄
 * - 접힘(scrolled=true): 점수·델타 + 미니 스파크라인 (메인 차트 세운과 동일 전체 구간)
 */
export function SummaryLine({
  data,
  isUp,
  scrolled,
}: {
  data: SummaryLineData
  isUp: boolean
  scrolled: boolean
}) {
  const uid = useId()
  const strokeColor = isUp ? '#F04452' : '#3182F6'

  const spark = useMemo(() => {
    const series = data.sparkData
    if (series.length < 2) return null

    const w = 72
    const h = 24
    const padY = 3
    const padX = 2
    const min = Math.min(...series)
    const max = Math.max(...series)
    const range = max - min || 1

    const pts = series.map((v, i) => ({
      x: padX + (i / (series.length - 1)) * (w - padX * 2),
      y: padY + (h - padY * 2) * (1 - (v - min) / range),
    }))
    const { line, seg } = buildSmoothPath(pts)
    if (!line) return null

    const first = pts[0]!
    const last = pts[pts.length - 1]!
    // 메인 차트 Area 와 같이 곡선 아래를 바닥까지 닫아 fill
    const area = `M${first.x.toFixed(1)},${h} L${first.x.toFixed(1)},${first.y.toFixed(1)}${seg} L${last.x.toFixed(1)},${h} Z`
    const cidx = data.currentIdx
    const dot = cidx >= 0 && cidx < pts.length ? pts[cidx]! : last

    return { w, h, line, area, dot }
  }, [data.sparkData, data.currentIdx])

  const fillId = `sl-fill-${uid}`
  const edgeId = `sl-edge-${uid}`
  const maskId = `sl-mask-${uid}`
  const haloId = `sl-halo-${uid}`

  return (
    <div
      className={`px-4 h-[36px] flex items-center transition-colors ${
        scrolled
          ? isUp
            ? 'bg-cp-line/10 border-t border-cp-line/25'
            : 'bg-cp-down/10 border-t border-cp-down/25'
          : 'bg-cp-raised'
      }`}
    >
      {!scrolled ? (
        <p className="text-[11px] text-cp-text text-center font-medium w-full whitespace-nowrap overflow-hidden text-ellipsis">
          올해 운세 <span className="font-bold">{data.score}점</span> | {data.label}, {data.desc} {data.emoji}
        </p>
      ) : (
        <div className="flex items-center justify-between w-full gap-3">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-lg font-bold tabular-nums leading-none" style={{ color: strokeColor }}>
              {data.score}
            </span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: strokeColor }}>
              {isUp ? '\u25b2' : '\u25bc'}{Math.abs(data.delta)}
            </span>
            <span className="text-[10px] tabular-nums opacity-80" style={{ color: strokeColor }}>
              ({isUp ? '+' : ''}{data.deltaPercent}%)
            </span>
          </div>
          {spark && (
            <svg
              width={spark.w}
              height={spark.h}
              viewBox={`0 0 ${spark.w} ${spark.h}`}
              className="flex-shrink-0"
              aria-hidden
            >
              <defs>
                {/* 아래로 갈수록 사라지는 fill — 메인 차트 cpScoreFill 과 동일 톤 */}
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
                {/* 양옆 fade — 메인 차트 cpScoreEdgeFade 와 동일 비율 */}
                <linearGradient id={edgeId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#fff" stopOpacity={0} />
                  <stop offset="10%" stopColor="#fff" stopOpacity={1} />
                  <stop offset="90%" stopColor="#fff" stopOpacity={1} />
                  <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                </linearGradient>
                <mask id={maskId} maskContentUnits="userSpaceOnUse">
                  <rect x="0" y="0" width={spark.w} height={spark.h} fill={`url(#${edgeId})`} />
                </mask>
                {/* 올해 점 — 흰 테두리가 바깥으로 fade */}
                <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
                  <stop offset="35%" stopColor="#fff" stopOpacity={0.95} />
                  <stop offset="62%" stopColor="#fff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                </radialGradient>
              </defs>
              {/* 메인 차트처럼 fill만 양옆 마스크, 선은 선명하게 */}
              <path d={spark.area} fill={`url(#${fillId})`} stroke="none" mask={`url(#${maskId})`} />
              <path
                d={spark.line}
                fill="none"
                stroke={strokeColor}
                strokeWidth={1.15}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={spark.dot.x} cy={spark.dot.y} r={4.5} fill={`url(#${haloId})`} />
              <circle
                cx={spark.dot.x}
                cy={spark.dot.y}
                r={1.9}
                fill={strokeColor}
                stroke="#fff"
                strokeWidth={0.9}
                strokeOpacity={0.9}
              />
            </svg>
          )}
        </div>
      )}
    </div>
  )
}
