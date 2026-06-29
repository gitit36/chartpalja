import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPublicShareEntry } from '@/lib/share/get-share-entry'
import { buildShareCard } from '@/lib/share/share-card'

export const runtime = 'nodejs'
export const alt = '차트팔자 — 인생 차트'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** sparkData 를 막대 개수에 맞춰 다운샘플링. */
function downsample(data: number[], target: number): number[] {
  if (data.length <= target) return data
  const step = data.length / target
  const out: number[] = []
  for (let i = 0; i < target; i++) out.push(data[Math.floor(i * step)]!)
  return out
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [boldFont, semiFont] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Pretendard-Bold.otf')),
    readFile(join(process.cwd(), 'public/fonts/Pretendard-SemiBold.otf')),
  ])

  const entry = await getPublicShareEntry(id).catch(() => null)
  const card = entry ? buildShareCard(entry.sajuReportJson, entry.birthYear) : null

  const fonts = [
    { name: 'Pretendard', data: boldFont, weight: 700 as const, style: 'normal' as const },
    { name: 'Pretendard', data: semiFont, weight: 600 as const, style: 'normal' as const },
  ]

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
            background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 55%, #6d28d9 100%)',
            color: 'white',
            fontFamily: 'Pretendard',
          }}
        >
          <div style={{ fontSize: 40, fontWeight: 600, opacity: 0.7, letterSpacing: 4 }}>차트팔자</div>
          <div style={{ fontSize: 80, fontWeight: 700, marginTop: 16 }}>내 인생의 리듬</div>
          <div style={{ fontSize: 36, fontWeight: 600, opacity: 0.8, marginTop: 20 }}>100년의 흐름을 하나의 차트로</div>
        </div>
      ),
      { ...size, fonts }
    )
  }

  const accent = card.isUp ? '#ff7a7a' : '#7aa8ff'
  const accentSoft = card.isUp ? 'rgba(255,122,122,0.85)' : 'rgba(122,168,255,0.85)'
  const bars = downsample(card.sparkData, 64)
  const maxBar = Math.max(...bars, 1)
  const minBar = Math.min(...bars)
  const barRange = maxBar - minBar || 1
  const currentRatio = card.currentIdx >= 0 ? card.currentIdx / Math.max(card.sparkData.length - 1, 1) : -1
  const currentBarIdx = currentRatio >= 0 ? Math.round(currentRatio * (bars.length - 1)) : -1

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(140deg, #15132e 0%, #2a1b54 60%, #3b1f70 100%)',
          color: 'white',
          fontFamily: 'Pretendard',
          padding: 64,
          position: 'relative',
        }}
      >
        {/* 배경 100년 곡선(막대 area) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 300,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 3,
            paddingLeft: 40,
            paddingRight: 40,
            opacity: 0.55,
          }}
        >
          {bars.map((v, i) => {
            const hpct = 12 + ((v - minBar) / barRange) * 78
            const isCur = i === currentBarIdx
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${hpct}%`,
                  borderRadius: 4,
                  background: isCur ? accent : accentSoft,
                  opacity: isCur ? 1 : 0.35,
                }}
              />
            )
          })}
        </div>

        {/* 상단 브랜드 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, zIndex: 2 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 700,
              padding: '8px 20px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            차트팔자
          </div>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, opacity: 0.6 }}>인생 차트 · 100년의 흐름</div>
        </div>

        {/* 본문 */}
        <div style={{ display: 'flex', flexDirection: 'column', zIndex: 2 }}>
          <div style={{ display: 'flex', fontSize: 38, fontWeight: 600, opacity: 0.85 }}>
            {`${entry.name}님의 인생 차트`}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginTop: 8 }}>
            <div style={{ display: 'flex', fontSize: 130, fontWeight: 700, lineHeight: 1, color: accent }}>
              {card.score}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
              <div style={{ display: 'flex', fontSize: 34, fontWeight: 600, opacity: 0.7 }}>올해 운세 점수</div>
              <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: accent }}>
                {`${card.isUp ? '▲' : '▼'} ${Math.abs(card.delta)} (${card.isUp ? '+' : ''}${card.deltaPercent}%)`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, marginTop: 18 }}>
            {card.label}
          </div>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 600, opacity: 0.8, marginTop: 8 }}>
            {card.desc}
          </div>
        </div>

        {/* 하단 CTA 라인 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', zIndex: 2 }}>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, opacity: 0.75 }}>
            내 차트는 몇 점일까? · chartpalja.com
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}
