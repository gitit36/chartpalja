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
    <span className="text-cp-border text-sm leading-none ml-auto" aria-hidden>🔒</span>
  )

  const itemClass = (locked: boolean) =>
    `w-full px-5 py-3 text-left text-sm flex items-center gap-3 min-h-[44px] ${
      locked
        ? 'text-cp-muted cursor-not-allowed select-none'
        : 'text-cp-text hover:bg-cp-bg'
    }`

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-72 max-w-[80vw] bg-cp-bg h-full shadow-xl flex flex-col animate-slide-in-right">
        <div className="px-5 pt-5 pb-4 border-b border-cp-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-cp-text">메뉴</h2>
            <button onClick={onClose} className="text-cp-muted hover:text-cp-muted text-xl leading-none">&times;</button>
          </div>

          <div className={`rounded-lg px-3 py-2.5 text-center ${isGuest ? 'bg-cp-bg' : 'bg-cp-surface'}`}>
            <p className={`text-[10px] font-medium ${isGuest ? 'text-cp-muted' : 'text-cp-line'}`}>보유 주(株)</p>
            <p className={`text-lg font-bold ${isGuest ? 'text-cp-muted' : 'text-cp-line'}`}>
              {ju != null ? ju : <span className="text-cp-border">-</span>}
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
          {/* 문의하기: 게스트 포함 누구나 접근 가능 (지원 채널). */}
          <button
            type="button"
            onClick={() => goPath('/app/inquiry')}
            className={itemClass(false)}
          >
            <span className="text-base">✉️</span>
            <span>문의하기</span>
          </button>
        </nav>

        <div className="px-5 py-4 border-t border-cp-border space-y-3">
          <div className="flex items-center justify-center gap-x-1 text-[10px] text-cp-border whitespace-nowrap tracking-tight">
            <Link href="/terms" onClick={onClose} className="text-cp-border hover:text-cp-muted transition-colors">이용약관</Link>
            <span className="text-cp-border">·</span>
            <Link href="/privacy" onClick={onClose} className="text-cp-border hover:text-cp-muted transition-colors">개인정보처리방침</Link>
            <span className="text-cp-border">·</span>
            <Link href="/refund" onClick={onClose} className="text-cp-border hover:text-cp-muted transition-colors">환불정책</Link>
            <span className="text-cp-border">·</span>
            <Link href="/business" onClick={onClose} className="text-cp-border hover:text-cp-muted transition-colors">사업자정보</Link>
          </div>

          {isLoggedIn === true ? (
            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl border border-cp-border text-sm font-medium text-cp-muted hover:bg-cp-bg transition-colors min-h-[44px]"
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
            <div className="w-full h-[44px] rounded-xl bg-cp-surface/60" aria-hidden />
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
        className="w-8 h-8 flex items-center justify-center text-cp-muted hover:text-cp-text transition-colors"
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
