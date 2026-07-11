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
 * 주(株) 부족 시 하단 슬라이드 넛지 — 잠시 떴다가 사라짐.
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
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4 pointer-events-none animate-slide-up">
      <div className="mx-auto max-w-[446px] pointer-events-auto">
        <button
          type="button"
          onClick={goCheckout}
          className="w-full flex items-center justify-between gap-3 px-4 py-4 rounded-2xl bg-gray-900 text-white shadow-xl border border-white/15 ring-2 ring-cp-line/40 active:scale-[0.99] transition-transform"
        >
          <span className="flex items-center gap-2.5 text-sm font-medium text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cp-line/30 text-base" aria-hidden>
              ⚡
            </span>
            <span>
              <span className="font-bold text-base">{shortage}주</span> 부족해요
              <span className="block text-[11px] text-white/60 font-normal mt-0.5">충전하면 바로 이어서 볼 수 있어요</span>
            </span>
          </span>
          <span className="text-sm font-bold text-cp-muted shrink-0 px-2.5 py-1.5 rounded-lg bg-cp-line/25">충전하기 →</span>
        </button>
      </div>
    </div>
  )
}
