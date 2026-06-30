'use client'

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react'

interface InfoTipProps {
  text: string
  /** 팝업 기본 방향 힌트 (auto 시 뷰포트에 맞게 보정) */
  align?: 'left' | 'right' | 'auto'
  /** 제목(h3) 등 큰 텍스트 옆 — 아이콘을 살짝 위로 */
  lift?: boolean
}

const POPUP_W = 224
const VIEWPORT_PAD = 8

/** (i) 아이콘 — 원 하단이 옆 텍스트 하단과 맞도록 align-text-bottom */
export function InfoTip({ text, align = 'auto', lift = false }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const updatePopupPos = () => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    let left = align === 'right' ? rect.right - POPUP_W : rect.left
    if (align === 'auto' || align === 'left') {
      if (left + POPUP_W > window.innerWidth - VIEWPORT_PAD) {
        left = rect.right - POPUP_W
      }
    }
    if (left < VIEWPORT_PAD) left = VIEWPORT_PAD
    if (left + POPUP_W > window.innerWidth - VIEWPORT_PAD) {
      left = window.innerWidth - VIEWPORT_PAD - POPUP_W
    }
    setPopupPos({ top: rect.bottom + 4, left })
  }

  useLayoutEffect(() => {
    if (!open) {
      setPopupPos(null)
      return
    }
    updatePopupPos()
    window.addEventListener('resize', updatePopupPos)
    window.addEventListener('scroll', updatePopupPos, true)
    return () => {
      window.removeEventListener('resize', updatePopupPos)
      window.removeEventListener('scroll', updatePopupPos, true)
    }
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <span ref={wrapRef} className="relative inline ml-1">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-block w-3.5 h-3.5 align-text-bottom rounded-full bg-gray-200 text-gray-500 text-[8px] leading-none hover:bg-gray-300 focus:outline-none font-normal${lift ? ' -translate-y-[1.5px]' : ''}`}
        aria-label="정보"
      >
        <span className="flex h-full w-full items-center justify-center">i</span>
      </button>
      {open && popupPos && (
        <div
          className="fixed z-[100] w-56 p-2.5 rounded-lg bg-white shadow-lg border border-gray-100 text-[10px] text-gray-600 leading-relaxed font-normal text-left whitespace-pre-line"
          style={{ top: popupPos.top, left: popupPos.left }}
        >
          {text}
        </div>
      )}
    </span>
  )
}
