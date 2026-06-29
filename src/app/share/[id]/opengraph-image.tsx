import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPublicShareEntry } from '@/lib/share/get-share-entry'
import { buildShareCard } from '@/lib/share/share-card'

export const runtime = 'nodejs'
export const alt = '차트팔자 — 인생 차트'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/* ── 디자인 상수 (OG 1200×630 기준) ──────────────────────────── */
const C = {
  // 배경: 랜딩(slate-900 → indigo-950 → purple-950) 계열 딥 네이비/퍼플
  bg: 'linear-gradient(140deg, #0d1230 0%, #1b1547 52%, #3a1670 100%)',
  // 우상단 은은한 보라/블루 빛 번짐 (입체감)
  glow: 'radial-gradient(820px circle at 86% 6%, rgba(120,130,255,0.40) 0%, rgba(120,130,255,0.0) 60%)',
  glow2: 'radial-gradient(620px circle at 18% 92%, rgba(96,90,220,0.28) 0%, rgba(96,90,220,0.0) 55%)',
  score: '#5fb6ff', // electric / sky blue
  white: '#ffffff',
  title: '#e8e9ff',
  sub: '#b7bbe6', // lavender gray
  barBase: '#7b82ff', // purple-blue
  barHi: '#5fb6ff',
  pillBg: 'rgba(255,255,255,0.10)',
  pillBorder: 'rgba(255,255,255,0.24)',
  ctaBg: 'rgba(255,255,255,0.08)',
  ctaBorder: 'rgba(255,255,255,0.16)',
}
const L = {
  padX: 52,
  padTop: 40,
  padBottom: 40,
  chartH: 360, // 하단 배경 차트 높이
  bars: 66, // 막대 개수
}

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

  // 배경 막대 차트 데이터
  const bars = downsample(card.sparkData, L.bars)
  const maxBar = Math.max(...bars, 1)
  const minBar = Math.min(...bars)
  const barRange = maxBar - minBar || 1
  const currentRatio = card.currentIdx >= 0 ? card.currentIdx / Math.max(card.sparkData.length - 1, 1) : -1
  const currentBarIdx = currentRatio >= 0 ? Math.round(currentRatio * (bars.length - 1)) : -1

  const downArrow = card.isUp ? '▲' : '▼'
  const deltaText = `${downArrow} ${Math.abs(card.delta)} (${card.isUp ? '+' : ''}${card.deltaPercent}%)`

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
        {/* 빛 번짐 (입체감) */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: C.glow }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: C.glow2 }} />

        {/* 배경 100년 막대 차트 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: L.chartH,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 4,
            paddingLeft: L.padX,
            paddingRight: L.padX,
          }}
        >
          {bars.map((v, i) => {
            const norm = (v - minBar) / barRange
            const hpct = 14 + norm * 80
            const isCur = i === currentBarIdx
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${hpct}%`,
                  borderRadius: 5,
                  background: isCur ? C.barHi : C.barBase,
                  // 높을수록(좋은 해일수록) 더 밝게 → 묻히지 않게
                  opacity: isCur ? 1 : 0.3 + norm * 0.45,
                }}
              />
            )
          })}
        </div>

        {/* 텍스트 가독성용 그라데이션 마스크 (차트 상단을 배경색으로 페이드) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: L.chartH,
            display: 'flex',
            background: 'linear-gradient(180deg, #150f38 0%, rgba(21,15,56,0.72) 32%, rgba(21,15,56,0) 64%)',
          }}
        />

        {/* 상단 브랜드 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 2 }}>
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

        {/* 본문 (좌측 정렬) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', zIndex: 2 }}>
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

        {/* 하단 CTA (우측, 클릭 유도) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', zIndex: 2 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 27,
              fontWeight: 600,
              color: C.white,
              opacity: 0.92,
              padding: '11px 22px',
              borderRadius: 999,
              background: C.ctaBg,
              border: `1px solid ${C.ctaBorder}`,
            }}
          >
            내 사주팔자는 몇 점일까? · chartpalja.com
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}
