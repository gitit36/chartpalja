'use client'

import { useMemo } from 'react'

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
 * - 접힘(scrolled=true): 점수·델타 + 미니 스파크라인 (주식 시세 헤더 느낌)
 *
 * 개인 사주 상세 페이지와 공유 페이지가 동일한 UX 를 갖도록 공용으로 둔다.
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
  const { linePath, areaPath, dotPos } = useMemo(() => {
    const series = data.sparkData
    if (series.length < 2) return { linePath: '', areaPath: '', dotPos: null }
    const min = Math.min(...series)
    const max = Math.max(...series)
    const range = max - min || 1
    const w = 70
    const h = 20
    const pad = 1
    const pts = series.map((v, i) => ({
      x: (i / (series.length - 1)) * w,
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
    const cidx = data.currentIdx
    const dot = cidx >= 0 && cidx < n ? { x: pts[cidx]!.x, y: pts[cidx]!.y } : null
    return { linePath: line, areaPath: area, dotPos: dot }
  }, [data.sparkData, data.currentIdx])

  const strokeColor = isUp ? '#d63031' : '#2d6cdf'
  const fillColor = isUp ? 'rgba(214,48,49,0.1)' : 'rgba(45,108,223,0.1)'

  return (
    <div
      className={`px-4 h-[36px] flex items-center transition-colors ${
        scrolled
          ? isUp
            ? 'bg-[#fff0f0] border-t border-[#ffcccc]'
            : 'bg-[#f0f4ff] border-t border-[#ccd6ff]'
          : 'bg-white'
      }`}
    >
      {!scrolled ? (
        <p className="text-[11px] text-gray-700 text-center font-medium w-full whitespace-nowrap overflow-hidden text-ellipsis">
          올해 운세 <span className="font-bold">{data.score}점</span> | {data.label}, {data.desc} {data.emoji}
        </p>
      ) : (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-baseline gap-2">
            <span className={`text-lg font-bold ${isUp ? 'text-[#d63031]' : 'text-[#2d6cdf]'}`}>{data.score}</span>
            <span className={`text-xs font-semibold ${isUp ? 'text-[#e05050]' : 'text-[#4a8af4]'}`}>
              {isUp ? '\u25b2' : '\u25bc'}{Math.abs(data.delta)}
            </span>
            <span className={`text-[10px] ${isUp ? 'text-[#e87070]' : 'text-[#6fa0f6]'}`}>
              ({isUp ? '+' : ''}{data.deltaPercent}%)
            </span>
          </div>
          <svg width="70" height="20" viewBox="0 0 70 20" className="flex-shrink-0">
            <path d={areaPath} fill={fillColor} />
            <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
            {dotPos && <circle cx={dotPos.x} cy={dotPos.y} r="2.5" fill={strokeColor} stroke="white" strokeWidth="1" />}
          </svg>
        </div>
      )}
    </div>
  )
}
