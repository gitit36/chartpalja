'use client'

import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  message: string
  /** ms 단위 — 기본 2400ms */
  duration?: number
  onClose: () => void
}

/**
 * 모바일 친화 토스트. 하단에 슬라이드 인. 일정 시간 후 자동 사라짐.
 * 도허티: 등장 0.25s, 자동 닫힘 2.4s.
 */
export function Toast({ open, message, duration = 2400, onClose }: Props) {
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
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center pointer-events-none px-4">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto max-w-[400px] w-full bg-gray-900/95 text-white text-sm px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 transition-all duration-250 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        <span aria-hidden>✨</span>
        <span className="flex-1 leading-snug">{message}</span>
      </div>
    </div>
  )
}
