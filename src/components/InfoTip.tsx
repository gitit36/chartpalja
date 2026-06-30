'use client'

import React, { useState, useEffect, useRef } from 'react'

interface InfoTipProps {
  text: string
  align?: 'left' | 'right'
}

/** (i) 아이콘 — 원 하단이 같은 줄 텍스트 기준선에 맞도록 1em 래퍼에 bottom 정렬 */
export function InfoTip({ text, align = 'left' }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <span ref={ref} className="relative inline-block ml-1 h-[1em] w-[0.875rem] align-baseline">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="absolute bottom-0 left-0 w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[8px] leading-none hover:bg-gray-300 focus:outline-none inline-flex items-center justify-center font-normal"
        aria-label="정보"
      >
        i
      </button>
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-[calc(100%+4px)] z-50 w-56 p-2.5 rounded-lg bg-white shadow-lg border border-gray-100 text-[10px] text-gray-600 leading-relaxed font-normal text-left whitespace-pre-line`}
        >
          {text}
        </div>
      )}
    </span>
  )
}
