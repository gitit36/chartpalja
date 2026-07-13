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
  up: '#F04452',
  down: '#3182F6',
  flat: '#8B8B93',
}

/**
 * 점들을 부드러운 3차 베지어 곡선으로 잇는다.
 * Fritsch–Carlson 단조(monotone) 보간을 써서 곡선이 데이터 y 범위를 벗어나
 * (overshoot) svg 위/아래로 잘리는 일이 없도록 보장한다.
 * seg 는 시작 M 을 뺀 곡선 명령들 — area path 재사용을 위해 별도로 반환한다.
 */
export function buildSmoothPath(pts: { x: number; y: number }[]): { line: string; seg: string } {
  const n = pts.length
  if (n < 2) return { line: '', seg: '' }
  const f = (v: number) => v.toFixed(1)
  if (n === 2) {
    const seg = ` L${f(pts[1]!.x)},${f(pts[1]!.y)}`
    return { line: `M${f(pts[0]!.x)},${f(pts[0]!.y)}${seg}`, seg }
  }

  // 구간별 기울기(secant)
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const hx = pts[i + 1]!.x - pts[i]!.x
    dx.push(hx)
    slope.push(hx !== 0 ? (pts[i + 1]!.y - pts[i]!.y) / hx : 0)
  }

  // 접선(tangent) 초기값
  const m: number[] = new Array(n)
  m[0] = slope[0]!
  m[n - 1] = slope[n - 2]!
  for (let i = 1; i < n - 1; i++) {
    const s0 = slope[i - 1]!, s1 = slope[i]!
    m[i] = s0 * s1 <= 0 ? 0 : (s0 + s1) / 2
  }
  // 단조성 제약 (overshoot 방지)
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i]! / slope[i]!
    const b = m[i + 1]! / slope[i]!
    const h = a * a + b * b
    if (h > 9) {
      const t = 3 / Math.sqrt(h)
      m[i] = t * a * slope[i]!
      m[i + 1] = t * b * slope[i]!
    }
  }

  let seg = ''
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i]!, p1 = pts[i + 1]!
    const cp1x = p0.x + dx[i]! / 3, cp1y = p0.y + (m[i]! * dx[i]!) / 3
    const cp2x = p1.x - dx[i]! / 3, cp2y = p1.y - (m[i + 1]! * dx[i]!) / 3
    seg += ` C${f(cp1x)},${f(cp1y)} ${f(cp2x)},${f(cp2y)} ${f(p1.x)},${f(p1.y)}`
  }
  return { line: `M${f(pts[0]!.x)},${f(pts[0]!.y)}${seg}`, seg }
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
  // 끝점 원(r=2)과 곡선이 상/하 가장자리에 닿아 잘리지 않도록 세로 인셋(≥ 원 반지름).
  const pad = 3
  // 끝점 원(r=2)이 좌우로 잘리지 않도록 가로 인셋을 둔다.
  const padX = 3
  const stepX = (width - padX * 2) / (data.length - 1)

  const xAt = (i: number) => padX + i * stepX
  const yAt = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / range)

  const points = pts.map((p) => ({ x: xAt(p.i), y: yAt(p.v) }))
  const { line, seg } = buildSmoothPath(points)

  const color = colorOverride ?? COLORS[trend]
  const first = points[0]!
  const last = points[points.length - 1]!
  const bottomY = height - pad

  // 곡선 아래를 닫아 은은한 그라데이션 fill을 그린다 (선 보조용, 고투명).
  const areaPath = `M${first.x.toFixed(1)},${bottomY.toFixed(1)} L${first.x.toFixed(1)},${first.y.toFixed(1)}${seg} L${last.x.toFixed(1)},${bottomY.toFixed(1)} Z`

  const fillId = `spark-fill-${gradId}`
  const edgeId = `spark-edge-${gradId}`
  const maskId = `spark-mask-${gradId}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.24} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        {/* 좌우 가장자리로 갈수록 서서히 사라지는 마스크 (양옆 abrupt cut 방지) */}
        <linearGradient id={edgeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="14%" stopColor="#fff" stopOpacity={1} />
          <stop offset="86%" stopColor="#fff" stopOpacity={1} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <mask id={maskId}>
          <rect x="0" y="0" width={width} height={height} fill={`url(#${edgeId})`} />
        </mask>
      </defs>
      <path d={areaPath} fill={`url(#${fillId})`} stroke="none" mask={`url(#${maskId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={2} fill={color} />
    </svg>
  )
}
