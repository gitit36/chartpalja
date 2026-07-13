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
        scrolled ? 'bg-cp-surface border-t border-cp-border' : 'bg-cp-raised'
      }`}
    >
      <p className="flex-1 min-w-0 text-[11px] text-cp-text font-medium whitespace-nowrap overflow-hidden text-ellipsis">
        <span className="font-bold">{myName}</span>
        <span className="text-cp-muted mx-1">✕</span>
        <span className="font-bold">{info.overlayName}</span>
        <span className="text-cp-muted mx-1">·</span>
        <span className="text-cp-down font-semibold">궁합 {overall}</span>
      </p>
      <button
        type="button"
        onClick={onCta}
        className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.98] ${
          shareMode
            ? 'text-cp-line bg-cp-surface border border-cp-border/70 hover:bg-cp-border/80'
            : 'text-cp-down bg-cp-surface border border-cp-border/70 hover:bg-cp-border/80'
        }`}
      >
        {ctaLabel}
      </button>
    </div>
  )
}
