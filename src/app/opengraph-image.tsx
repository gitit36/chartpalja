import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildSparkPath } from '@/lib/share/share-card'

export const runtime = 'nodejs'
export const alt = '차트팔자 — 사주도 주식처럼 차트로'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/* ── 디자인 상수 (share/[id] OG 와 동일 브랜드 톤) ── */
const C = {
  bg: 'linear-gradient(140deg, #0d1230 0%, #1b1547 52%, #3a1670 100%)',
  glowChart: 'radial-gradient(820px circle at 78% 44%, rgba(95,182,255,0.22) 0%, rgba(95,182,255,0.0) 60%)',
  glowCorner: 'radial-gradient(640px circle at 12% 92%, rgba(96,90,220,0.30) 0%, rgba(96,90,220,0.0) 55%)',
  score: '#5fb6ff',
  white: '#ffffff',
  title: '#e8e9ff',
  sub: '#b7bbe6',
  line: '#5fb6ff',
  grid: 'rgba(255,255,255,0.06)',
  gridStrong: 'rgba(255,255,255,0.10)',
  pillBg: 'rgba(255,255,255,0.08)',
  pillBorder: 'rgba(255,255,255,0.16)',
  domain: 'rgba(232,233,255,0.72)',
}

// 개인정보 없는 데모용 인생 곡선(연도별 세운 점수 느낌).
const DEMO_SPARK = [56, 52, 60, 69, 64, 58, 63, 72, 80, 75, 67, 62, 68, 77, 85, 79, 71, 74, 82, 90, 84, 88]
const DEMO_CURRENT_IDX = 14

const L = {
  padX: 56,
  headerTop: 42,
  bodyTop: 196,
  textW: 566,
  sparkW: 636,
  sparkH: 400,
  sparkRight: 26,
  sparkTop: 150,
}

export default async function Image() {
  const [boldFont, semiFont, logoPng] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Pretendard-Bold.otf')),
    readFile(join(process.cwd(), 'public/fonts/Pretendard-SemiBold.otf')),
    readFile(join(process.cwd(), 'public/svc_logo.png')),
  ])

  const fonts = [
    { name: 'Pretendard', data: boldFont, weight: 700 as const, style: 'normal' as const },
    { name: 'Pretendard', data: semiFont, weight: 600 as const, style: 'normal' as const },
  ]

  const logoSrc = `data:image/png;base64,${logoPng.toString('base64')}`

  const spark = buildSparkPath(DEMO_SPARK, L.sparkW, L.sparkH, 22)
  const curDot =
    DEMO_CURRENT_IDX >= 0 && DEMO_CURRENT_IDX < spark.points.length ? spark.points[DEMO_CURRENT_IDX] : null
  const curScore = DEMO_SPARK[DEMO_CURRENT_IDX]

  // 차트 SVG 의 화면상 좌상단 좌표 (올해 칩 위치 계산용)
  const svgLeft = size.width - L.sparkRight - L.sparkW
  const gridYs = [0.18, 0.42, 0.66, 0.9].map(t => 22 + t * (L.sparkH - 44))

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: C.bg,
          color: C.white,
          fontFamily: 'Pretendard',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 빛 번짐 */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: C.glowChart }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: C.glowCorner }} />

        {/* 우측 대형 인생 차트 */}
        <svg
          width={L.sparkW}
          height={L.sparkH}
          viewBox={`0 0 ${L.sparkW} ${L.sparkH}`}
          style={{ position: 'absolute', top: L.sparkTop, right: L.sparkRight }}
        >
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8f7bff" />
              <stop offset="0.5" stopColor="#5fb6ff" />
              <stop offset="1" stopColor="#5fe6c8" />
            </linearGradient>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(95,182,255,0.30)" />
              <stop offset="0.55" stopColor="rgba(120,140,255,0.10)" />
              <stop offset="1" stopColor="rgba(95,182,255,0)" />
            </linearGradient>
            <radialGradient id="dotHalo" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="rgba(95,182,255,0.55)" />
              <stop offset="1" stopColor="rgba(95,182,255,0)" />
            </radialGradient>
          </defs>

          {/* 배경 그리드 */}
          {gridYs.map((y, i) => (
            <line
              key={i}
              x1={0}
              y1={y}
              x2={L.sparkW}
              y2={y}
              stroke={C.grid}
              strokeWidth={1.5}
              strokeDasharray="2 10"
              strokeLinecap="round"
            />
          ))}

          {/* 면적 채움 */}
          <path d={spark.area} fill="url(#areaGrad)" stroke="none" />

          {/* 부드러운 글로우 라인 */}
          <path
            d={spark.line}
            fill="none"
            stroke="rgba(95,182,255,0.22)"
            strokeWidth={16}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 메인 라인 (그라디언트) */}
          <path
            d={spark.line}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {curDot ? (
            <g>
              {/* 올해 위치 세로 가이드 */}
              <line
                x1={curDot.x}
                y1={curDot.y + 6}
                x2={curDot.x}
                y2={L.sparkH - 8}
                stroke="rgba(95,182,255,0.40)"
                strokeWidth={2}
                strokeDasharray="3 7"
                strokeLinecap="round"
              />
              {/* 후광 + 포인트 */}
              <circle cx={curDot.x} cy={curDot.y} r={26} fill="url(#dotHalo)" />
              <circle cx={curDot.x} cy={curDot.y} r={11} fill="#ffffff" />
              <circle cx={curDot.x} cy={curDot.y} r={7} fill={C.line} />
            </g>
          ) : null}
        </svg>

        {/* 올해 점수 칩 (차트 포인트 위에 떠 있음) */}
        {curDot ? (
          <div
            style={{
              position: 'absolute',
              left: svgLeft + curDot.x - 140,
              top: L.sparkTop + curDot.y - 52,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: 18,
              background: 'rgba(13,18,48,0.72)',
              border: '1px solid rgba(95,182,255,0.45)',
            }}
          >
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, color: C.sub }}>올해</div>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, lineHeight: 1.05, color: C.score }}>
              {curScore}
            </div>
          </div>
        ) : null}

        {/* 상단 브랜드 (로고 마크 + 워드마크) */}
        <div
          style={{
            position: 'absolute',
            top: L.headerTop,
            left: L.padX,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '10px 22px 10px 14px',
              borderRadius: 999,
              background: C.pillBg,
              border: `1px solid ${C.pillBorder}`,
            }}
          >
            <img src={logoSrc} width={52} height={47} alt="" />
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: C.white }}>차트팔자</div>
          </div>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: C.sub }}>
            사주도 주식처럼 차트로 분석해요
          </div>
        </div>

        {/* 본문 헤드라인 */}
        <div
          style={{
            position: 'absolute',
            top: L.bodyTop,
            left: L.padX,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            width: L.textW,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 84, fontWeight: 700, lineHeight: 1.14, color: C.white }}>
            <span>100년의 흐름을</span>
            <span>
              하나의&#160;<span style={{ color: C.score }}>차트</span>로
            </span>
          </div>

          <div style={{ display: 'flex', fontSize: 34, fontWeight: 600, color: C.sub, marginTop: 30, lineHeight: 1.4 }}>
            사주 기반 인생 운세 시각화 서비스
          </div>
        </div>

        {/* 하단 도메인 wordmark */}
        <div
          style={{
            position: 'absolute',
            right: L.padX,
            bottom: 40,
            display: 'flex',
            fontSize: 24,
            fontWeight: 700,
            color: C.domain,
            letterSpacing: '-0.2px',
          }}
        >
          chartpalja.com
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}
