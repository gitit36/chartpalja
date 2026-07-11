'use client'

import { useCallback, type KeyboardEvent, type ReactNode } from 'react'

interface LockedPreviewProps {
  /**
   * 잠금 영역의 placeholder/example 콘텐츠.
   * 실제 유료/로그인 데이터가 아닌 가벼운 예시 JSX를 넣는다.
   */
  children: ReactNode
  /** 클릭 시 호출. 부모에서 LoginPromptSheet를 띄운다. */
  onUnlock: () => void
  /**
   * 잠금 배지에 표시할 짧은 카피.
   * 기본값: "로그인하면 풀려요".
   * "잠겨있어요" 같은 부정 문구는 사용하지 않는다.
   */
  badgeText?: string
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

/**
 * 잠긴 콘텐츠를 "예시 콘텐츠 + blur + 🔒 오버레이" 형태로 보여주는 공통 컴포넌트.
 *
 * 디자인 의도:
 * - 연보라 통 블록이 아니라, 실제 콘텐츠가 아래에 있는 듯한 preview/teaser 느낌.
 * - 예시 콘텐츠는 children으로 받고, 블러 + pointer-events 차단으로 인터랙션을 막는다.
 * - 카드 위에는 둥근 화이트 배지(🔒 + 짧은 카피 + "로그인 →") 하나만 떠 있어
 *   시각적 노이즈를 최소화한다.
 *
 * 카피 톤:
 * - "잠겨있어요", "사용할 수 없어요" 등 부정 표현 금지.
 * - 동사: "로그인하기", 보상 명사: "운세 해설"/"프리미엄"/"모든 기능".
 */
export function LockedPreview({
  children,
  onUnlock,
  badgeText = '로그인하면 풀려요',
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

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? badgeText}
      onClick={onUnlock}
      onKeyDown={handleKey}
      className={`relative w-full block text-left group cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cp-line/40 ${className}`}
      style={minHeight ? { minHeight } : undefined}
    >
      {/* 예시 콘텐츠 — 블러 처리 + 인터랙션 차단 */}
      <div
        className="pointer-events-none select-none [filter:blur(5px)] opacity-70 transition-opacity group-hover:opacity-80"
        aria-hidden
      >
        {children}
      </div>

      {/* 오버레이: 항상 배경 블러 레이어는 깔되, 배지(버튼)는 옵션에 따라 표시 */}
      <div className="absolute inset-0 bg-cp-bg/30 backdrop-blur-[2px] group-hover:bg-cp-surface/40 transition-colors rounded-2xl pointer-events-none" />

      {showBadge && (
        badgeUseTopOffset ? (
          <div
            className="absolute left-0 right-0 flex justify-center pointer-events-none"
            style={{ top: badgeOffsetTop }}
          >
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-cp-bg shadow-md border border-cp-border group-hover:shadow-lg transition-shadow">
              <span className="text-base leading-none" aria-hidden>🔒</span>
              <span className="text-xs font-medium text-cp-text">{badgeText}</span>
              <span className="text-xs font-bold text-cp-line">로그인 →</span>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-cp-bg shadow-md border border-cp-border group-hover:shadow-lg transition-shadow">
              <span className="text-base leading-none" aria-hidden>🔒</span>
              <span className="text-xs font-medium text-cp-text">{badgeText}</span>
              <span className="text-xs font-bold text-cp-line">로그인 →</span>
            </div>
          </div>
        )
      )}
    </div>
  )
}
