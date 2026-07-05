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
  glowChart: 'radial-gradient(760px circle at 82% 46%, rgba(95,182,255,0.22) 0%, rgba(95,182,255,0.0) 60%)',
  glowCorner: 'radial-gradient(620px circle at 14% 92%, rgba(96,90,220,0.28) 0%, rgba(96,90,220,0.0) 55%)',
  score: '#5fb6ff',
  white: '#ffffff',
  title: '#e8e9ff',
  sub: '#b7bbe6',
  line: '#5fb6ff',
  lineGlow: 'rgba(95,182,255,0.22)',
  pillBg: 'rgba(255,255,255,0.10)',
  pillBorder: 'rgba(255,255,255,0.24)',
  domain: 'rgba(232,233,255,0.72)',
}

// 개인정보 없는 데모용 인생 곡선(연도별 세운 점수 느낌).
const DEMO_SPARK = [56, 52, 60, 69, 64, 58, 63, 72, 80, 75, 67, 62, 68, 77, 85, 79, 71, 74, 82, 90, 84, 88]
const DEMO_CURRENT_IDX = 14

const L = {
  padX: 56,
  headerTop: 44,
  bodyTop: 176,
  textW: 560,
  sparkW: 600,
  sparkH: 340,
  sparkRight: 40,
  sparkTop: 168,
  domainRight: 56,
  domainBottom: 40,
}

export default async function Image() {
  const [boldFont, semiFont] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Pretendard-Bold.otf')),
    readFile(join(process.cwd(), 'public/fonts/Pretendard-SemiBold.otf')),
  ])

  const fonts = [
    { name: 'Pretendard', data: boldFont, weight: 700 as const, style: 'normal' as const },
    { name: 'Pretendard', data: semiFont, weight: 600 as const, style: 'normal' as const },
  ]

  const spark = buildSparkPath(DEMO_SPARK, L.sparkW, L.sparkH, 18)
  const curDot =
    DEMO_CURRENT_IDX >= 0 && DEMO_CURRENT_IDX < spark.points.length ? spark.points[DEMO_CURRENT_IDX] : null

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

        {/* 우측 대형 데모 스파크라인 */}
        <svg
          width={L.sparkW}
          height={L.sparkH}
          viewBox={`0 0 ${L.sparkW} ${L.sparkH}`}
          style={{ position: 'absolute', top: L.sparkTop, right: L.sparkRight, opacity: 0.96 }}
        >
          <path d={spark.line} fill="none" stroke={C.lineGlow} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
          <path d={spark.line} fill="none" stroke={C.line} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          {curDot ? <circle cx={curDot.x} cy={curDot.y} r={9} fill={C.line} stroke="#0d1230" strokeWidth={4} /> : null}
        </svg>

        {/* 상단 브랜드 */}
        <div
          style={{
            position: 'absolute',
            top: L.headerTop,
            left: L.padX,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 700,
              padding: '9px 22px',
              borderRadius: 999,
              background: C.pillBg,
              border: `1px solid ${C.pillBorder}`,
            }}
          >
            차트팔자
          </div>
          <div style={{ display: 'flex', fontSize: 27, fontWeight: 600, color: C.sub }}>
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
            right: L.domainRight,
            bottom: L.domainBottom,
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
