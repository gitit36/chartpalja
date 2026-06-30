'use client'

import type { OverlayCompatInfo } from '@/lib/compat/types'
import { formatCompatDots } from '@/lib/compat/relationship-score'

interface CompatSummaryBarProps {
  info: OverlayCompatInfo
  myName: string
  scrolled: boolean
  shareMode?: boolean
  onCta: () => void
}

/**
 * 비교 오버레이 활성 시 요약바 — 나/상대 올해 점수 + 유형 + 궁합 해설 CTA.
 */
export function CompatSummaryBar({ info, myName, scrolled, shareMode = false, onCta }: CompatSummaryBarProps) {
  const shortType = info.type.replace(/ 궁합$/, '')
  const ctaLabel = shareMode ? '내 차트 만들기' : '궁합 해설'

  return (
    <div
      className={`px-3 h-[36px] flex items-center gap-2 transition-colors ${
        scrolled ? 'bg-purple-50/90 border-t border-purple-100' : 'bg-white'
      }`}
    >
      <p className="flex-1 min-w-0 text-[11px] text-gray-700 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
        <span className="font-bold">{myName}</span> {info.myScore}
        <span className="text-gray-400 mx-1">·</span>
        <span className="font-bold">{info.overlayName}</span> {info.partnerScore}
        {!scrolled && (
          <>
            <span className="text-gray-400 mx-1">·</span>
            <span className="text-purple-700">{shortType}</span>
            {info.compatDots != null && (
              <>
                <span className="text-gray-400 mx-1">·</span>
                <span className="text-rose-500 tracking-tight text-[10px]">{formatCompatDots(info.compatDots)}</span>
              </>
            )}
          </>
        )}
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
