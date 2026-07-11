'use client'

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react'

interface InfoTipProps {
  text: string
  /** 팝업 기본 방향 힌트 (auto 시 뷰포트에 맞게 보정) */
  align?: 'left' | 'right' | 'auto'
  /** 제목(h3) 등 큰 텍스트 옆 — 아이콘을 살짝 위로 */
  lift?: boolean
  /**
   * 제목 전체를 클릭 가능하게 만들 때 사용.
   * 예: <InfoTip label="대운" text="..." /> → "대운 i" 전체가 토글
   */
  label?: React.ReactNode
}

const POPUP_W = 224
const POPUP_EST_H = 120
const VIEWPORT_PAD = 8

/** 얇은 원형 정보 아이콘 — 터치 영역은 크게, 비주얼은 절제 */
function InfoIcon({ lift = false }: { lift?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={`shrink-0 text-cp-muted${lift ? ' -translate-y-[1px]' : ''}`}
    >
      <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="4.4" r="0.7" fill="currentColor" />
      <path d="M7 6.2v3.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

/** (i) 아이콘 — 원 하단이 옆 텍스트 하단과 맞도록 align-text-bottom */
export function InfoTip({ text, align = 'auto', lift = false, label }: InfoTipProps) {
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
    // 그래프/하단을 가리지 않도록: 아래 공간이 부족하면 위로 띄운다.
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD
    const top = spaceBelow < POPUP_EST_H
      ? Math.max(VIEWPORT_PAD, rect.top - POPUP_EST_H - 4)
      : rect.bottom + 4
    setPopupPos({ top, left })
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

  const toggle = () => setOpen(v => !v)

  return (
    <span ref={wrapRef} className={`relative inline-flex items-center align-middle${label != null ? '' : ' ml-0.5'}`}>
      {label != null ? (
        <button
          ref={btnRef}
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1 min-h-[40px] -my-2 py-2 pr-0.5 text-inherit font-inherit focus:outline-none"
          aria-label="정보"
          aria-expanded={open}
        >
          <span>{label}</span>
          <InfoIcon lift={lift} />
        </button>
      ) : (
        <button
          ref={btnRef}
          type="button"
          onClick={toggle}
          className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] -mx-2.5 -my-2.5 text-cp-muted hover:text-cp-muted focus:outline-none transition-colors"
          aria-label="정보"
          aria-expanded={open}
        >
          <InfoIcon lift={lift} />
        </button>
      )}
      {open && popupPos && (
        <div
          className="fixed z-[100] w-56 p-3 rounded-xl bg-cp-bg shadow-lg border border-cp-border text-[11px] text-cp-muted leading-relaxed font-normal text-left whitespace-pre-line"
          style={{ top: popupPos.top, left: popupPos.left }}
        >
          {text}
        </div>
      )}
    </span>
  )
}
