'use client'

import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  message: string
  /** ms 단위 — 기본 2400ms */
  duration?: number
  onClose: () => void
  /** Tailwind bottom-* 클래스. 기본 bottom-28 (하단 툴바 위). 로딩 화면 등은 bottom-6 */
  bottomClass?: string
}

/**
 * 모바일 친화 토스트. 하단에 슬라이드 인. 일정 시간 후 자동 사라짐.
 * 도허티: 등장 0.25s, 자동 닫힘 2.4s.
 */
export function Toast({ open, message, duration = 2400, onClose, bottomClass = 'bottom-28' }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!open) { setVisible(false); return }
    setVisible(true)
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 250)
    }, duration)
    return () => clearTimeout(t)
  }, [open, duration, onClose])

  if (!open) return null

  return (
    <div className={`fixed inset-x-0 ${bottomClass} z-50 flex justify-center pointer-events-none px-4`}>
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto w-auto max-w-[min(400px,calc(100%-2rem))] bg-cp-hover border border-cp-borderStrong text-cp-secondary text-sm font-medium px-4 py-3 rounded-xl text-center shadow-[0_8px_28px_rgba(0,0,0,0.45)] transition-all duration-250 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        <span className="leading-snug">{message}</span>
      </div>
    </div>
  )
}
