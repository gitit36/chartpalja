'use client'

import type { OverlayCompatInfo } from '@/lib/compat/types'

interface CompatSummaryBarProps {
  info: OverlayCompatInfo
  myName: string
  scrolled: boolean
  shareMode?: boolean
  onCta: () => void
}

/**
 * 비교 오버레이 활성 시 스티키 요약바 — 「나 ✕ 상대 · 궁합 N」 + 궁합 해설 CTA.
 * 점수는 두 사람의 전반적인 관계 점수(overallScore).
 */
export function CompatSummaryBar({ info, myName, scrolled, shareMode = false, onCta }: CompatSummaryBarProps) {
  const ctaLabel = shareMode ? '내 차트 만들기' : '궁합 해설'
  const overall = info.overallScore ?? Math.round((info.myScore + info.partnerScore) / 2)

  return (
    <div
      className={`px-3 h-[36px] flex items-center gap-2 transition-colors ${
        scrolled ? 'bg-purple-50/90 border-t border-purple-100' : 'bg-white'
      }`}
    >
      <p className="flex-1 min-w-0 text-[11px] text-gray-700 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
        <span className="font-bold">{myName}</span>
        <span className="text-rose-300 mx-1">✕</span>
        <span className="font-bold">{info.overlayName}</span>
        <span className="text-gray-400 mx-1">·</span>
        <span className="text-rose-600 font-semibold">궁합 {overall}</span>
      </p>
      <button
        type="button"
        onClick={onCta}
        className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.98] ${
          shareMode
            ? 'text-purple-700 bg-purple-50 border border-purple-200/70 hover:bg-purple-100/80'
            : 'text-rose-700 bg-rose-50 border border-rose-200/70 hover:bg-rose-100/80'
        }`}
      >
        {ctaLabel}
      </button>
    </div>
  )
}
