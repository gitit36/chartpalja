'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 랜딩 상단 카루셀 (3장).
 *
 * 설계 메모:
 * - 첫 카드 = 시그니처(인생 차트). SSR로 즉시 그려지고, SVG inline이라 LCP에 외부 요청이 없다.
 * - 카루셀은 native scroll-snap(CSS만)으로 동작 → JS hydration 전에도 첫 카드가 보인다.
 * - autoplay/외부 라이브러리 없음. 사용자가 스와이프하거나 도트를 누른다.
 * - 카드 자체는 다크 글래스(랜딩 다크 그라데이션 위에 자연스럽게 얹힘).
 */

interface Slide {
  title: string
  desc: string
  visual: ReactNode
}

const SLIDES: Slide[] = [
  {
    title: '사주도 주식처럼 분석해요',
    desc: '100년 × 35개 지표, 매 사주마다',
    visual: <ChartFlowMini />,
  },
  {
    title: '9개 영역으로 풀어낸 운세',
    desc: '궁금한 시기를 골라 성향·직업·재물·관계까지',
    visual: <RangeAIMini />,
  },
  {
    title: '8가지 관계로 비교해보는 인연',
    desc: '합·충·형·해까지 겹쳐보는 흐름',
    visual: <CompareMini />,
  },
]

export function LandingHeroCarousel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el || el.clientWidth === 0) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    if (idx !== active) setActive(idx)
  }, [active])

  const goTo = useCallback((i: number) => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }, [])

  // resize 시 현재 슬라이드 위치를 유지
  useEffect(() => {
    const onResize = () => {
      const el = containerRef.current
      if (!el) return
      el.scrollLeft = active * el.clientWidth
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active])

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-x-auto snap-x snap-mandatory flex"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        aria-label="서비스 미리보기"
      >
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className="flex-none w-full snap-center px-6"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${SLIDES.length}: ${s.title}`}
          >
            <SlideCard slide={s} />
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-1.5 mt-3.5" role="tablist" aria-label="슬라이드 인디케이터">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            role="tab"
            aria-selected={i === active}
            aria-label={`슬라이드 ${i + 1}로 이동`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? 'w-6 bg-white/75' : 'w-1.5 bg-white/25 hover:bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function SlideCard({ slide }: { slide: Slide }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] border border-white/15 px-4 pt-4 pb-5 backdrop-blur-sm">
      <div className="flex justify-center">{slide.visual}</div>
      <p className="text-white text-base font-bold leading-snug text-center mt-3">
        {slide.title}
      </p>
      <p className="text-white/55 text-xs text-center mt-1">{slide.desc}</p>
    </div>
  )
}

/* ─────────── 카드별 비주얼 (inline SVG) ─────────── */

/** 시그니처 인생 차트 미니어처 — 첫 화면 LCP 대상이라 가장 디테일하게.
 *  구성: 세운 곡선 + 시즌 배경 + 거래량(보조지표) 막대. 대운선은 제외해서
 *  "기본 차트 + 분석형 보조지표" 느낌으로 단순화한다. */
function ChartFlowMini() {
  // 거래량(에너지장) 막대 — 기존보다 크게 키워 분석형 차트 느낌을 강화.
  const bars: Array<{ h: number; up: boolean }> = [
    { h: 10, up: false }, { h: 14, up: true }, { h: 18, up: true }, { h: 12, up: false },
    { h: 16, up: true }, { h: 22, up: true }, { h: 19, up: true }, { h: 13, up: false },
    { h: 10, up: false }, { h: 17, up: true }, { h: 24, up: true }, { h: 29, up: true },
    { h: 20, up: false }, { h: 13, up: false }, { h: 18, up: true }, { h: 27, up: true },
    { h: 32, up: true }, { h: 23, up: true }, { h: 16, up: false }, { h: 10, up: false },
    { h: 13, up: true }, { h: 20, up: true }, { h: 26, up: true }, { h: 21, up: true },
    { h: 14, up: false }, { h: 9, up: false }, { h: 16, up: true }, { h: 22, up: true },
    { h: 17, up: true }, { h: 11, up: false },
  ]

  const barW = 7
  const barGap = 1
  const barBaseY = 134

  return (
    <div className="w-full max-w-[280px] aspect-[16/10] relative rounded-xl bg-white/[0.04] border border-white/10 overflow-hidden">
      <svg viewBox="0 0 240 165" className="w-full h-full" aria-hidden>
        {/* 시즌 배경 — 차트와 거래량을 하나의 영역으로 묶음 */}
        <rect x="0" y="18" width="55" height="128" fill="#27ae60" fillOpacity="0.07" />
        <rect x="55" y="18" width="80" height="128" fill="#3498db" fillOpacity="0.06" />
        <rect x="135" y="18" width="65" height="128" fill="#f1c40f" fillOpacity="0.07" />
        <rect x="200" y="18" width="40" height="128" fill="#e74c3c" fillOpacity="0.06" />

        {/* 기준선 */}
        <line x1="0" y1="58" x2="240" y2="58" stroke="#fff" strokeOpacity="0.05" strokeDasharray="2 3" />
        <line x1="0" y1={barBaseY} x2="240" y2={barBaseY} stroke="#fff" strokeOpacity="0.06" />

        {/* 세운 main curve — 전체적으로 조금 더 아래로 이동 */}
        <path
          d="M0,88 C12,65 24,62 36,80 C48,98 58,78 70,55 C82,30 96,38 106,54 C118,73 126,40 138,32 C150,24 158,56 170,68 C184,84 196,34 211,28 C224,22 232,40 240,52"
          fill="none"
          stroke="#82ca9d"
          strokeWidth="2.3"
          strokeLinecap="round"
        />

        {/* 이번해 마커 — 차트 + 거래량 전체 관통 */}
        <line
          x1="125"
          y1="20"
          x2="125"
          y2="145"
          stroke="#a78bfa"
          strokeWidth="1"
          strokeDasharray="3 2"
          strokeOpacity="0.55"
        />
        <circle cx="125" cy="48" r="3.5" fill="#a78bfa" stroke="white" strokeWidth="1" />
        <text x="125" y="12" textAnchor="middle" fontSize="8" fontWeight="600" fill="#d8b4fe">
          2026 · 87점
        </text>

        {/* 거래량(보조지표) 막대 — 더 크고 세운 그래프와 더 가깝게 */}
        {bars.map((b, i) => (
          <rect
            key={i}
            x={i * (barW + barGap)}
            y={barBaseY - b.h}
            width={barW}
            height={b.h}
            fill={b.up ? '#e74c3c' : '#3498db'}
            fillOpacity={0.68}
            rx={0.6}
          />
        ))}

        {/* 시간 축 라벨 — 거래량과 겹치지 않게 아래로 이동 */}
        <g fontSize="8" fontWeight="500" fill="rgba(255,255,255,0.32)">
          <text x="12" y="158" textAnchor="middle">0세</text>
          <text x="82" y="158" textAnchor="middle">30세</text>
          <text x="158" y="158" textAnchor="middle">60세</text>
          <text x="228" y="158" textAnchor="middle">90세</text>
        </g>
      </svg>
    </div>
  )
}

/** AI가 선택 구간을 해설해주는 화면. */
function RangeAIMini() {
  return (
    <div className="w-full max-w-[280px] aspect-[16/10] relative rounded-xl bg-white/[0.04] border border-white/10 overflow-hidden">
      <svg viewBox="0 0 240 150" className="w-full h-full" aria-hidden>
        <path d="M0,100 Q30,70 60,85 Q90,98 120,60 Q150,32 180,55 Q210,72 240,48" fill="none" stroke="#82ca9d" strokeWidth="1.8" strokeOpacity="0.55" />
        {/* selected range */}
        <rect x="80" y="22" width="80" height="116" rx="5" fill="#a78bfa" fillOpacity="0.16" stroke="#a78bfa" strokeWidth="1.2" strokeOpacity="0.6" />
        <text x="120" y="147" textAnchor="middle" fontSize="8" fontWeight="600" fill="#d8b4fe">
          2030~2035년
        </text>
      </svg>

      {/* AI 해설 카드 미리보기 */}
      <div className="absolute top-2.5 right-2.5 bg-white/[0.12] border border-white/20 rounded-lg px-2 py-1.5 backdrop-blur-sm w-[70px]">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[9px]">✨</span>
          <span className="text-[8px] text-white/85 font-semibold tracking-tight">운세 해설</span>
        </div>
        <div className="w-full h-0.5 bg-white/30 rounded mb-0.5" />
        <div className="w-full h-0.5 bg-white/30 rounded mb-0.5" />
        <div className="w-full h-0.5 bg-white/30 rounded mb-0.5" />
        <div className="w-1/2 h-0.5 bg-white/18 rounded" />
      </div>
    </div>
  )
}

/** 두 사람 차트 겹쳐 보기. */
function CompareMini() {
  return (
    <div className="w-full max-w-[280px] aspect-[16/10] relative rounded-xl bg-white/[0.04] border border-white/10 overflow-hidden">
      <svg viewBox="0 0 240 150" className="w-full h-full" aria-hidden>
        {/* 나 */}
        <path d="M0,85 Q35,45 70,72 Q105,98 135,55 Q165,28 195,52 Q220,68 240,42" fill="none" stroke="#82ca9d" strokeWidth="2.2" strokeLinecap="round" />
        {/* 상대 */}
        <path
          d="M0,95 Q35,82 70,55 Q105,32 135,65 Q165,90 195,48 Q220,28 240,68"
          fill="none"
          stroke="#fb7185"
          strokeWidth="2"
          strokeDasharray="4 2"
          strokeLinecap="round"
        />
      </svg>

      {/* 범례 */}
      <div className="absolute top-2.5 left-3 flex items-center gap-3">
        <span className="flex items-center gap-1 text-[9px] text-white/75 font-medium">
          <span className="w-3 h-[2px] bg-emerald-400 rounded inline-block" />
          나
        </span>
        <span className="flex items-center gap-1 text-[9px] text-white/75 font-medium">
          <span className="w-3 h-[2px] bg-rose-400 rounded inline-block" />
          상대
        </span>
      </div>

      {/* 궁합 점수 힌트 */}
      <div className="absolute bottom-2 right-3 text-[9px] text-white/45 font-medium">
        <span className="text-white/80 font-bold mr-1">💞 78</span>· 잘 맞아요
      </div>
    </div>
  )
}
