'use client'

import React, { useRef, useState, useCallback } from 'react'

interface BottomSheetProps {
  onClose: () => void
  children: React.ReactNode
}

const DISMISS_THRESHOLD = 0.3
const VELOCITY_THRESHOLD = 600

export function BottomSheet({ onClose, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragY = useRef<number | null>(null)
  const dragStartTime = useRef(0)
  const [offsetY, setOffsetY] = useState(0)
  const [closing, setClosing] = useState(false)

  const dismiss = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, 250)
  }, [onClose])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollEl = scrollRef.current
    if (scrollEl && scrollEl.scrollTop > 0) return
    dragY.current = e.touches[0].clientY
    dragStartTime.current = Date.now()
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragY.current == null) return
    const dy = e.touches[0].clientY - dragY.current
    if (dy < 0) { setOffsetY(0); return }
    setOffsetY(dy)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (dragY.current == null) return
    const elapsed = Date.now() - dragStartTime.current
    const velocity = offsetY / Math.max(elapsed, 1) * 1000
    const sheetH = sheetRef.current?.offsetHeight ?? 400
    if (offsetY > sheetH * DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      dismiss()
    } else {
      setOffsetY(0)
    }
    dragY.current = null
  }, [offsetY, dismiss])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={dismiss}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-250 ${closing ? 'opacity-0' : 'opacity-100'}`} />
      <div
        ref={sheetRef}
        className={`relative w-full max-w-[446px] bg-white rounded-t-2xl p-5 pb-8 transition-transform ${
          closing ? 'duration-250 ease-in' : offsetY > 0 ? 'duration-0' : 'duration-300 ease-out'
        }`}
        style={{ transform: closing ? 'translateY(100%)' : `translateY(${offsetY}px)` }}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 cursor-grab" />
        <div ref={scrollRef} className="max-h-[55vh] overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  )
}
