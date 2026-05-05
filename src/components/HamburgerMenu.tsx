'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBalance, prefetchBalance } from '@/lib/hooks/useBalance'

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  if (typeof window !== 'undefined') {
    const gid = localStorage.getItem('saju_guest_id')
    if (gid) h['x-guest-id'] = gid
  }
  return h
}

function MenuDrawer({ onClose, router }: { onClose: () => void; router: ReturnType<typeof useRouter> }) {
  const balance = useBalance()

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleLogout = useCallback(async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return
    await fetch('/api/auth/logout', { method: 'POST', headers: getHeaders() })
    localStorage.removeItem('saju_guest_id')
    router.push('/')
  }, [router])

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-72 max-w-[80vw] bg-white h-full shadow-xl flex flex-col animate-slide-in-right">
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">메뉴</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-purple-50 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-purple-600 font-medium">운세 해설</p>
              <p className="text-lg font-bold text-purple-700">
                {balance ? balance.chartCredits : <span className="text-gray-300">-</span>}
                <span className="text-xs ml-0.5">회</span>
              </p>
            </div>
            <div className="bg-indigo-50 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-indigo-600 font-medium">기간 해설</p>
              <p className="text-lg font-bold text-indigo-700">
                {balance ? balance.periodCredits : <span className="text-gray-300">-</span>}
                <span className="text-xs ml-0.5">회</span>
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          <button
            onClick={() => { onClose(); router.push('/app/profile') }}
            className="w-full px-5 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
          >
            <span className="text-base">👤</span>
            프로필 관리
          </button>
          <button
            onClick={() => { onClose(); router.push('/app/checkout') }}
            className="w-full px-5 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
          >
            <span className="text-base">🛒</span>
            이용권 구매
          </button>
          <button
            onClick={() => { onClose(); router.push('/app/guide') }}
            className="w-full px-5 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
          >
            <span className="text-base">📖</span>
            차트 해석 가이드
          </button>
        </nav>

        <div className="px-5 py-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-center gap-x-1 text-[10px] text-gray-300 whitespace-nowrap tracking-tight">
            <Link href="/terms" onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors">이용약관</Link>
            <span className="text-gray-200">·</span>
            <Link href="/privacy" onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors">개인정보처리방침</Link>
            <span className="text-gray-200">·</span>
            <Link href="/refund" onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors">환불정책</Link>
            <span className="text-gray-200">·</span>
            <Link href="/business" onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors">사업자정보</Link>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}

export function HamburgerMenu() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    prefetchBalance()
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const handleOpen = useCallback(() => {
    prefetchBalance()
    setOpen(true)
  }, [])

  return (
    <>
      <button
        onClick={handleOpen}
        onMouseEnter={prefetchBalance}
        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="메뉴"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {open && mounted && createPortal(
        <MenuDrawer onClose={close} router={router} />,
        document.body,
      )}
    </>
  )
}
