import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPublicShareEntry } from '@/lib/share/get-share-entry'
import { buildShareCard, buildSparkPath } from '@/lib/share/share-card'

export const runtime = 'nodejs'
export const alt = '차트팔자 — 인생 차트'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/* ── 디자인 상수 (OG 1200×630 기준) ──────────────────────────── */
const C = {
  // 배경: 랜딩(slate-900 → indigo-950 → purple-950) 계열 딥 네이비/퍼플
  bg: 'linear-gradient(140deg, #0d1230 0%, #1b1547 52%, #3a1670 100%)',
  // 우측(차트 영역) 은은한 블루 빛 번짐 + 좌하단 퍼플 빛으로 입체감
  glowChart: 'radial-gradient(760px circle at 82% 48%, rgba(95,182,255,0.22) 0%, rgba(95,182,255,0.0) 60%)',
  glowCorner: 'radial-gradient(620px circle at 14% 92%, rgba(96,90,220,0.28) 0%, rgba(96,90,220,0.0) 55%)',
  score: '#5fb6ff', // electric / sky blue
  white: '#ffffff',
  title: '#e8e9ff',
  sub: '#b7bbe6', // lavender gray
  line: '#5fb6ff', // 스파크라인 (점수 블루와 동일 계열)
  lineFill: 'rgba(95,182,255,0.14)',
  pillBg: 'rgba(255,255,255,0.10)',
  pillBorder: 'rgba(255,255,255,0.24)',
  ctaBg: 'rgba(255,255,255,0.08)',
  ctaBorder: 'rgba(255,255,255,0.16)',
}
const L = {
  padX: 52,
  padTop: 40,
  padBottom: 40,
  textW: 540, // 좌측 텍스트 블록 폭 (차트와 분리)
  // 우측 스파크라인 (시원하게 크게)
  sparkW: 560,
  sparkH: 330,
  sparkRight: 22,
  sparkTop: 162,
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [boldFont, semiFont] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Pretendard-Bold.otf')),
    readFile(join(process.cwd(), 'public/fonts/Pretendard-SemiBold.otf')),
  ])

  const fonts = [
    { name: 'Pretendard', data: boldFont, weight: 700 as const, style: 'normal' as const },
    { name: 'Pretendard', data: semiFont, weight: 600 as const, style: 'normal' as const },
  ]

  const entry = await getPublicShareEntry(id).catch(() => null)
  const card = entry ? buildShareCard(entry.sajuReportJson, entry.birthYear) : null

  // 공유 비공개거나 데이터 없음 → 브랜드 기본 카드 (다크)
  if (!entry || !card) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: C.bg,
            color: C.white,
            fontFamily: 'Pretendard',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 700,
              padding: '8px 22px',
              borderRadius: 999,
              background: C.pillBg,
              border: `1px solid ${C.pillBorder}`,
            }}
          >
            차트팔자
          </div>
          <div style={{ display: 'flex', fontSize: 76, fontWeight: 700, marginTop: 24 }}>내 인생의 리듬</div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 600, color: C.sub, marginTop: 16 }}>
            사주도 주식처럼 차트로 분석해요
          </div>
        </div>
      ),
      { ...size, fonts }
    )
  }

  // 우측 스파크라인 (부드러운 곡선)
  const spark = buildSparkPath(card.sparkData, L.sparkW, L.sparkH, 18)
  const curDot =
    card.currentIdx >= 0 && card.currentIdx < spark.points.length ? spark.points[card.currentIdx] : null

  const deltaText = `${card.isUp ? '▲' : '▼'} ${Math.abs(card.delta)} (${card.isUp ? '+' : ''}${card.deltaPercent}%)`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: C.bg,
          color: C.white,
          fontFamily: 'Pretendard',
          padding: `${L.padTop}px ${L.padX}px ${L.padBottom}px`,
          position: 'relative',
        }}
      >
        {/* 빛 번짐 (입체감 / 차트가 배경에 녹아들도록) */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: C.glowChart }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: C.glowCorner }} />

        {/* 우측 대형 스파크라인 — 텍스트보다 뒤(보조)지만 존재감 있게 */}
        <svg
          width={L.sparkW}
          height={L.sparkH}
          viewBox={`0 0 ${L.sparkW} ${L.sparkH}`}
          style={{ position: 'absolute', top: L.sparkTop, right: L.sparkRight }}
        >
          <path d={spark.area} fill={C.lineFill} />
          <path
            d={spark.line}
            fill="none"
            stroke={C.line}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {curDot ? (
            <circle cx={curDot.x} cy={curDot.y} r={11} fill={C.line} stroke="#0d1230" strokeWidth={5} />
          ) : null}
        </svg>

        {/* 상단 브랜드 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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

        {/* 본문 (좌측 정렬, 폭 제한으로 차트와 분리) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: L.textW }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 600, color: C.title, opacity: 0.92 }}>
            {`${entry.name}님의 인생 차트`}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 30, marginTop: 14 }}>
            <div style={{ display: 'flex', fontSize: 156, fontWeight: 700, lineHeight: 1, color: C.score }}>
              {card.score}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 22, gap: 6 }}>
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, color: C.sub }}>올해 운세 점수</div>
              <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: C.sub }}>{deltaText}</div>
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 48, fontWeight: 700, color: C.white, marginTop: 26 }}>
            {card.label}
          </div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, color: C.sub, marginTop: 10 }}>
            {card.desc}
          </div>
        </div>

        {/* 하단 CTA (우측, 간결) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              fontWeight: 700,
              color: C.white,
              opacity: 0.9,
              padding: '10px 22px',
              borderRadius: 999,
              background: C.ctaBg,
              border: `1px solid ${C.ctaBorder}`,
            }}
          >
            chartpalja.com
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}
