'use client'

import { useCallback, type KeyboardEvent, type ReactNode } from 'react'

interface LockedPreviewProps {
  /**
   * 잠금 영역의 placeholder/example 콘텐츠.
   * 실제 유료/로그인 데이터가 아닌 가벼운 예시 JSX를 넣는다.
   */
  children: ReactNode
  /** 클릭 시 호출. 부모에서 LoginPromptSheet / 공유 CTA를 띄운다. */
  onUnlock: () => void
  /**
   * 잠금 배지에 표시할 짧은 카피.
   * 기본값: "로그인하면 풀려요".
   * "잠겨있어요" 같은 부정 문구는 사용하지 않는다.
   */
  badgeText?: string
  /** 배지 우측 CTA. 기본 "로그인 →" / 공유 페이지는 "만들기 →" */
  ctaText?: string
  /** 잠금 영역의 최소 높이 (px). 예시 콘텐츠가 짧을 때 시각적 안정성용. */
  minHeight?: number
  className?: string
  /** 접근성 라벨. 예: "사주관계 — 로그인하면 풀려요" */
  ariaLabel?: string
  /** false면 배지(잠금 버튼)를 그리지 않는다. 블러 + 클릭만 유지. */
  showBadge?: boolean
  /**
   * 배지를 가운데가 아니라 상단에서 N px 떨어진 위치에 배치.
   * 예: 운세 해설 첫 카드 하단에 배지 하단을 맞추고 싶을 때 사용.
   */
  badgeOffsetTop?: number
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-cp-muted">
      <path
        d="M7 11V8a5 5 0 0110 0v3M6 11h12v10H6V11z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 잠긴 콘텐츠 preview — 앱 셸(cp-raised / borderStrong) 톤의 배지 + 블러 티저.
 */
export function LockedPreview({
  children,
  onUnlock,
  badgeText = '로그인하면 풀려요',
  ctaText = '로그인 →',
  minHeight,
  className = '',
  ariaLabel,
  showBadge = true,
  badgeOffsetTop,
}: LockedPreviewProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onUnlock()
      }
    },
    [onUnlock],
  )

  const badgeUseTopOffset = typeof badgeOffsetTop === 'number'

  const badge = (
    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-cp-raised border border-cp-borderStrong shadow-[0_8px_28px_rgba(0,0,0,0.35)] group-hover:border-cp-line/40 transition-colors">
      <LockIcon />
      <span className="text-xs font-medium text-cp-secondary">{badgeText}</span>
      <span className="text-xs font-bold text-cp-accent shrink-0">{ctaText}</span>
    </div>
  )

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? badgeText}
      onClick={onUnlock}
      onKeyDown={handleKey}
      className={`relative w-full block text-left group cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cp-accent/40 ${className}`}
      style={minHeight ? { minHeight } : undefined}
    >
      <div
        className="pointer-events-none select-none [filter:blur(5px)] opacity-65 transition-opacity group-hover:opacity-75"
        aria-hidden
      >
        {children}
      </div>

      <div className="absolute inset-0 bg-cp-bg/40 group-hover:bg-cp-bg/50 transition-colors rounded-2xl pointer-events-none" />

      {showBadge && (
        badgeUseTopOffset ? (
          <div
            className="absolute left-0 right-0 flex justify-center pointer-events-none px-3"
            style={{ top: badgeOffsetTop }}
          >
            {badge}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-3">
            {badge}
          </div>
        )
      )}
    </div>
  )
}
