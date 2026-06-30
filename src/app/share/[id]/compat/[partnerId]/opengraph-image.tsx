import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getCompatShareContext } from '@/lib/share/get-compat-share-context'
import { buildShareCard, buildSparkPath } from '@/lib/share/share-card'
import { RELATIONSHIP_LABELS } from '@/lib/compat/relationship'

export const runtime = 'nodejs'
export const alt = '차트팔자 — 궁합 차트'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const C = {
  bg: 'linear-gradient(140deg, #0d1230 0%, #1b1547 52%, #3a1670 100%)',
  glowChart: 'radial-gradient(760px circle at 82% 48%, rgba(251,113,133,0.20) 0%, rgba(251,113,133,0.0) 60%)',
  glowCorner: 'radial-gradient(620px circle at 14% 92%, rgba(96,90,220,0.28) 0%, rgba(96,90,220,0.0) 55%)',
  scoreA: '#5fb6ff',
  scoreB: '#fb7185',
  white: '#ffffff',
  title: '#e8e9ff',
  sub: '#b7bbe6',
  lineA: '#5fb6ff',
  lineB: '#fb7185',
  pillBg: 'rgba(255,255,255,0.10)',
  pillBorder: 'rgba(255,255,255,0.24)',
  domain: 'rgba(232,233,255,0.72)',
}

const L = {
  padX: 52,
  sparkW: 560,
  sparkH: 330,
  sparkRight: 34,
  sparkTop: 162,
  domainRight: 52,
  domainBottom: 36,
}

function buildDualSparkPaths(
  dataA: number[],
  dataB: number[],
  w: number,
  h: number,
) {
  const sparkA = buildSparkPath(dataA, w, h, 18)
  const sparkB = buildSparkPath(dataB, w, h, 18)
  return { lineA: sparkA.line, lineB: sparkB.line }
}

export default async function Image({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; partnerId: string }>
  searchParams: Promise<{ rel?: string }>
}) {
  const { id, partnerId } = await params
  const { rel } = await searchParams

  const [boldFont, semiFont] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Pretendard-Bold.otf')),
    readFile(join(process.cwd(), 'public/fonts/Pretendard-SemiBold.otf')),
  ])

  const fonts = [
    { name: 'Pretendard', data: boldFont, weight: 700 as const, style: 'normal' as const },
    { name: 'Pretendard', data: semiFont, weight: 600 as const, style: 'normal' as const },
  ]

  const ctx = await getCompatShareContext(id, partnerId, rel ?? null)

  if (!ctx) {
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
          <div style={{ display: 'flex', fontSize: 76, fontWeight: 700 }}>차트팔자</div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 600, color: C.sub, marginTop: 16 }}>
            궁합 차트
          </div>
        </div>
      ),
      { ...size, fonts },
    )
  }

  const cardA = buildShareCard(ctx.entry.sajuReportJson, ctx.entry.birthYear)
  const cardB = buildShareCard(ctx.partner.sajuReportJson, ctx.partner.birthYear)
  const sparkA = cardA?.sparkData ?? []
  const sparkB = cardB?.sparkData ?? []
  const dual = buildDualSparkPaths(sparkA, sparkB, L.sparkW, L.sparkH)
  const relLabel = RELATIONSHIP_LABELS[ctx.relationship]
  const shortType = ctx.snapshot.type.replace(/ 궁합$/, '')

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
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: C.glowChart }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: C.glowCorner }} />

        <svg
          width={L.sparkW}
          height={L.sparkH}
          viewBox={`0 0 ${L.sparkW} ${L.sparkH}`}
          style={{ position: 'absolute', top: L.sparkTop, right: L.sparkRight, opacity: 0.96 }}
        >
          <path d={dual.lineA} fill="none" stroke={C.lineA} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
          <path d={dual.lineB} fill="none" stroke={C.lineB} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        </svg>

        <div style={{ position: 'absolute', top: 40, left: L.padX, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, padding: '9px 22px', borderRadius: 999, background: C.pillBg, border: `1px solid ${C.pillBorder}` }}>
            차트팔자
          </div>
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: C.sub }}>궁합 차트</div>
        </div>

        <div style={{ position: 'absolute', top: 148, left: L.padX, display: 'flex', flexDirection: 'column', width: 540 }}>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, padding: '6px 16px', borderRadius: 999, background: C.pillBg, border: `1px solid ${C.pillBorder}`, alignSelf: 'flex-start' }}>
            {relLabel}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 22 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
              <div style={{ display: 'flex', fontSize: 36, fontWeight: 600, color: C.title, minWidth: 120 }}>{ctx.entry.name}</div>
              <div style={{ display: 'flex', fontSize: 88, fontWeight: 700, lineHeight: 1, color: C.scoreA }}>{ctx.snapshot.myScore}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
              <div style={{ display: 'flex', fontSize: 36, fontWeight: 600, color: C.title, minWidth: 120 }}>{ctx.partner.name}</div>
              <div style={{ display: 'flex', fontSize: 88, fontWeight: 700, lineHeight: 1, color: C.scoreB }}>{ctx.snapshot.partnerScore}</div>
            </div>
          </div>

          <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, color: C.white, marginTop: 28 }}>{shortType}</div>
        </div>

        <div style={{ position: 'absolute', right: L.domainRight, bottom: L.domainBottom, display: 'flex', fontSize: 24, fontWeight: 700, color: C.domain }}>
          chartpalja.com
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
