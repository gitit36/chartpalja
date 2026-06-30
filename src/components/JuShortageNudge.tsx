'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface JuShortageNudgeProps {
  needed: number
  current: number
  onDismiss: () => void
  /** 자동 소멸 ms (기본 3.5초) */
  durationMs?: number
}

/**
 * 주(株) 부족 시 하단 슬라이드 넛지 — 잠시 떴다가 사라짐.
 */
export function JuShortageNudge({ needed, current, onDismiss, durationMs = 3500 }: JuShortageNudgeProps) {
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
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4 pointer-events-none animate-slide-up">
      <div className="mx-auto max-w-[446px] pointer-events-auto">
        <button
          type="button"
          onClick={goCheckout}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-gray-900/92 text-white shadow-lg backdrop-blur-sm active:scale-[0.99] transition-transform"
        >
          <span className="text-sm font-medium">
            <span className="font-bold">{shortage}주</span> 부족해요
          </span>
          <span className="text-sm font-bold text-purple-200 shrink-0">충전하기 →</span>
        </button>
      </div>
    </div>
  )
}
