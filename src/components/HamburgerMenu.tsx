'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBalance, prefetchBalance, clearBalanceCache } from '@/lib/hooks/useBalance'
import { clearGuestId, getGuestId } from '@/lib/auth/guest'

function getAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  const gid = getGuestId()
  if (gid) h['x-guest-id'] = gid
  return h
}

function MenuDrawer({
  onClose,
  router,
  isLoggedIn,
}: {
  onClose: () => void
  router: ReturnType<typeof useRouter>
  isLoggedIn: boolean | null
}) {
  const balance = useBalance(isLoggedIn)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleLogout = useCallback(async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return
    await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeaders() })
    clearBalanceCache()
    clearGuestId()
    router.push('/')
  }, [router])

  const handleKakaoLogin = useCallback(() => {
    const gid = getGuestId()
    const params = new URLSearchParams()
    if (gid) params.set('gid', gid)
    if (typeof window !== 'undefined') {
      params.set('returnTo', window.location.pathname + window.location.search)
    }
    const qs = params.toString()
    window.location.href = qs ? `/api/auth/kakao/start?${qs}` : '/api/auth/kakao/start'
  }, [])

  // 게스트는 모든 잔액을 0으로 노출 — 다른 사용자의 캐시가 새어들지 않게 보장.
  const ju = isLoggedIn === false ? 0 : balance?.ju

  // 로그인 사용자만 실제 라우팅. 게스트는 메뉴 항목 자체가 unclickable.
  const goPath = useCallback(
    (path: string) => {
      onClose()
      router.push(path)
    },
    [onClose, router],
  )

  const isGuest = isLoggedIn === false

  // 게스트는 클릭/hover/포커스 모두 막힌 상태. 자물쇠만 우측에 표시.
  const LockBadge = () => (
    <span className="text-gray-300 text-sm leading-none ml-auto" aria-hidden>🔒</span>
  )

  const itemClass = (locked: boolean) =>
    `w-full px-5 py-3 text-left text-sm flex items-center gap-3 min-h-[44px] ${
      locked
        ? 'text-gray-400 cursor-not-allowed select-none'
        : 'text-gray-700 hover:bg-gray-50'
    }`

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-72 max-w-[80vw] bg-white h-full shadow-xl flex flex-col animate-slide-in-right">
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">메뉴</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          <div className={`rounded-lg px-3 py-2.5 text-center ${isGuest ? 'bg-gray-50' : 'bg-purple-50'}`}>
            <p className={`text-[10px] font-medium ${isGuest ? 'text-gray-400' : 'text-purple-600'}`}>보유 주(株)</p>
            <p className={`text-lg font-bold ${isGuest ? 'text-gray-400' : 'text-purple-700'}`}>
              {ju != null ? ju : <span className="text-gray-300">-</span>}
              <span className="text-xs ml-0.5">주</span>
            </p>
          </div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          <button
            type="button"
            disabled={isGuest}
            aria-disabled={isGuest}
            onClick={isGuest ? undefined : () => goPath('/app/profile')}
            className={itemClass(isGuest)}
          >
            <span className="text-base">👤</span>
            <span>프로필 관리</span>
            {isGuest && <LockBadge />}
          </button>
          <button
            type="button"
            disabled={isGuest}
            aria-disabled={isGuest}
            onClick={isGuest ? undefined : () => goPath('/app/checkout')}
            className={itemClass(isGuest)}
          >
            <span className="text-base">🛒</span>
            <span>이용권 구매</span>
            {isGuest && <LockBadge />}
          </button>
          <button
            type="button"
            disabled={isGuest}
            aria-disabled={isGuest}
            onClick={isGuest ? undefined : () => goPath('/app/guide')}
            className={itemClass(isGuest)}
          >
            <span className="text-base">📖</span>
            <span>차트 해석 가이드</span>
            {isGuest && <LockBadge />}
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

          {isLoggedIn === true ? (
            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors min-h-[44px]"
            >
              로그아웃
            </button>
          ) : isLoggedIn === false ? (
            <button
              onClick={handleKakaoLogin}
              className="w-full py-3 rounded-xl text-sm font-bold bg-[#FEE500] text-[#3C1E1E] hover:brightness-95 active:scale-[0.98] transition-all min-h-[44px]"
            >
              카카오로 로그인
            </button>
          ) : (
            // 로딩 중에는 placeholder로 자리만 유지 (깜빡임 방지).
            <div className="w-full h-[44px] rounded-xl bg-gray-100/60" aria-hidden />
          )}
        </div>
      </div>
    </div>
  )
}

export function HamburgerMenu() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    setMounted(true)
    let cancelled = false
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        const loggedIn = !!data?.user
        setIsLoggedIn(loggedIn)
        if (loggedIn) prefetchBalance()
      })
      .catch(() => { if (!cancelled) setIsLoggedIn(false) })
    return () => { cancelled = true }
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const handleOpen = useCallback(() => {
    if (isLoggedIn === true) prefetchBalance()
    setOpen(true)
  }, [isLoggedIn])

  return (
    <>
      <button
        onClick={handleOpen}
        onMouseEnter={() => { if (isLoggedIn === true) prefetchBalance() }}
        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="메뉴"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {open && mounted && createPortal(
        <MenuDrawer onClose={close} router={router} isLoggedIn={isLoggedIn} />,
        document.body,
      )}
    </>
  )
}
