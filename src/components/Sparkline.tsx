import { useId } from 'react'

interface SparklineProps {
  /** 0~100 점수 시계열. null은 데이터 없음(구간 끊김)으로 처리. */
  data: (number | null)[]
  width?: number
  height?: number
  /** 'up' | 'down' | 'flat' — 선 색상 결정 (한국 관습: 상승 빨강 / 하락 파랑). */
  trend?: 'up' | 'down' | 'flat'
  /** 지정 시 trend 색상 대신 이 색을 사용 (예: 어두운 배경의 대표 카드). */
  color?: string
}

const COLORS = {
  up: '#e74c3c',
  down: '#3498db',
  flat: '#9ca3af',
}

export function Sparkline({ data, width = 52, height = 24, trend = 'flat', color: colorOverride }: SparklineProps) {
  const gradId = useId()
  const pts = data
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v != null)

  if (pts.length < 2) {
    return <div style={{ width, height }} aria-hidden />
  }

  const vals = pts.map((p) => p.v)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const pad = 2
  // 끝점 원(r=2)이 좌우로 잘리지 않도록 가로 인셋을 둔다.
  const padX = 3
  const stepX = (width - padX * 2) / (data.length - 1)

  const xAt = (i: number) => padX + i * stepX
  const yAt = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / range)

  const coords = pts.map((p) => `${xAt(p.i).toFixed(1)},${yAt(p.v).toFixed(1)}`)

  const color = colorOverride ?? COLORS[trend]
  const first = pts[0]
  const last = pts[pts.length - 1]
  const firstX = xAt(first.i)
  const lastX = xAt(last.i)
  const lastY = yAt(last.v)

  // 선 아래 영역을 닫아 은은한 그라데이션 fill을 그린다 (선 보조용, 고투명).
  const areaPoints = `${firstX.toFixed(1)},${(height - pad).toFixed(1)} ${coords.join(' ')} ${lastX.toFixed(1)},${(height - pad).toFixed(1)}`
  const fillId = `spark-fill-${gradId}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${fillId})`} stroke="none" />
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  )
}
