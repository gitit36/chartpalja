'use client'

interface Props {
  name: string
  onGo: () => void
  onDismiss?: () => void
}

/**
 * 비로그인 게스트가 입력 페이지로 다시 진입했을 때 표시하는 상단 알림 띠.
 * - 이전에 만든 차트가 있으면 "이전에 입력한 ○○ 차트가 있어요"로 안내한다.
 * - 클릭 시 해당 차트의 결과 페이지로 이동한다.
 */
export function RecentEntryBanner({ name, onGo, onDismiss }: Props) {
  return (
    <div className="mb-5 flex items-center gap-2 px-3.5 py-3 rounded-xl bg-cp-surface border border-cp-border min-h-[56px]">
      <span
        aria-hidden
        className="w-7 h-7 rounded-full bg-cp-border text-cp-line text-xs flex items-center justify-center flex-none font-semibold"
      >
        i
      </span>
      <p className="text-sm text-cp-text truncate flex-1 leading-snug">
        이전에 입력한 <span className="font-semibold">{name}</span> 차트가 있어요
      </p>
      <button
        type="button"
        onClick={onGo}
        className="text-sm font-semibold text-cp-line px-3 py-2 rounded-lg hover:bg-cp-border active:bg-cp-border transition-colors min-h-[40px]"
      >
        보러가기
      </button>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="알림 닫기"
          className="w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-cp-muted hover:text-cp-muted hover:bg-gray-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
