'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface JuShortageNudgeProps {
  needed: number
  current: number
  onDismiss: () => void
  /** 자동 소멸 ms (기본 5초) */
  durationMs?: number
}

/**
 * 주(株) 부족 시 하단 슬라이드 넛지 — Toast와 같은 폭·톤으로 잠시 떴다가 사라짐.
 */
export function JuShortageNudge({ needed, current, onDismiss, durationMs = 5000 }: JuShortageNudgeProps) {
  const router = useRouter()
  const shortage = Math.max(0, needed - current)

  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(t)
  }, [onDismiss, durationMs])

  const goCheckout = () => {
    onDismiss()
    const returnUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/app/list'
    router.push(`/app/checkout?returnUrl=${encodeURIComponent(returnUrl)}`)
  }

  return (
    <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center pointer-events-none px-4 animate-slide-up">
      <button
        type="button"
        onClick={goCheckout}
        className="pointer-events-auto w-auto max-w-[min(300px,calc(100%-2rem))] flex items-center gap-3 px-4 py-3 rounded-xl bg-cp-hover border border-cp-borderStrong text-left shadow-[0_8px_28px_rgba(0,0,0,0.45)] active:scale-[0.99] transition-transform"
      >
        <span className="text-sm text-cp-secondary leading-snug min-w-0">
          <span className="font-semibold text-cp-text">{shortage}주</span> 부족해요
          <span className="block text-[11px] text-cp-muted font-normal mt-0.5">충전하면 바로 이어서 볼 수 있어요</span>
        </span>
        <span className="shrink-0 text-xs font-bold text-cp-accent">충전 →</span>
      </button>
    </div>
  )
}
