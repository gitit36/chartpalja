import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPublicShareEntry } from '@/lib/share/get-share-entry'
import { buildShareCard, buildSparkPath } from '@/lib/share/share-card'

export const runtime = 'nodejs'
export const alt = '차트팔자 — 인생 차트'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BG = 'linear-gradient(135deg, #faf7ff 0%, #efe7fe 50%, #e3d4fb 100%)'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [boldFont, semiFont, logoBuf] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Pretendard-Bold.otf')),
    readFile(join(process.cwd(), 'public/fonts/Pretendard-SemiBold.otf')),
    readFile(join(process.cwd(), 'public/svc_logo.png')),
  ])
  const logoSrc = `data:image/png;base64,${logoBuf.toString('base64')}`

  const fonts = [
    { name: 'Pretendard', data: boldFont, weight: 700 as const, style: 'normal' as const },
    { name: 'Pretendard', data: semiFont, weight: 600 as const, style: 'normal' as const },
  ]

  const entry = await getPublicShareEntry(id).catch(() => null)
  const card = entry ? buildShareCard(entry.sajuReportJson, entry.birthYear) : null

  // 공유 비공개거나 데이터 없음 → 브랜드 기본 카드
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
            background: BG,
            color: '#2e1065',
            fontFamily: 'Pretendard',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={120} height={109} alt="" />
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, marginTop: 24 }}>차트팔자</div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 600, opacity: 0.7, marginTop: 12 }}>
            사주도 주식처럼 차트로 분석해요
          </div>
        </div>
      ),
      { ...size, fonts }
    )
  }

  const accent = card.isUp ? '#e74c3c' : '#3498db'
  const fillColor = card.isUp ? 'rgba(231,76,60,0.12)' : 'rgba(52,152,219,0.12)'

  // 점수 우측 스파크라인 (app/list 메인 카드와 동일 스타일, 크게)
  const sparkW = 520
  const sparkH = 200
  const spark = buildSparkPath(card.sparkData, sparkW, sparkH, 10)
  const curDot =
    card.currentIdx >= 0 && card.currentIdx < spark.points.length ? spark.points[card.currentIdx] : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BG,
          color: '#2e1065',
          fontFamily: 'Pretendard',
          padding: 72,
        }}
      >
        {/* 상단: 태그라인(좌) · 로고(우) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 600, color: '#7c3aed' }}>
            사주도 주식처럼 차트로 분석해요
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={86} height={78} alt="" />
        </div>

        {/* 중단: 이름 → (점수+델타 | 스파크라인) */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 600, color: '#4c1d95', opacity: 0.9 }}>
            {`${entry.name}님의 인생 차트`}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, color: '#6b7280' }}>올해 운세 점수</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
                <div style={{ display: 'flex', fontSize: 150, fontWeight: 700, lineHeight: 1, color: accent }}>
                  {card.score}
                </div>
                <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: accent, marginBottom: 18 }}>
                  {`${card.isUp ? '▲' : '▼'} ${Math.abs(card.delta)} (${card.isUp ? '+' : ''}${card.deltaPercent}%)`}
                </div>
              </div>
            </div>

            <svg width={sparkW} height={sparkH} viewBox={`0 0 ${sparkW} ${sparkH}`}>
              <path d={spark.area} fill={fillColor} />
              <path
                d={spark.line}
                fill="none"
                stroke={accent}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {curDot ? <circle cx={curDot.x} cy={curDot.y} r={9} fill={accent} stroke="#ffffff" strokeWidth={4} /> : null}
            </svg>
          </div>
        </div>

        {/* 하단: 라벨 + 설명 */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, color: '#1f1937' }}>{card.label}</div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, color: '#6b7280', marginTop: 8 }}>
            {card.desc}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}
