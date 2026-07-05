'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { clearBalanceCache, prefetchBalance } from '@/lib/hooks/useBalance'

interface Props {
  /** 로그인 여부 — false면 로그인 안내를 노출. null(확인 중)이면 입력은 허용. */
  isLoggedIn: boolean | null
  onRedeemed?: (addedJu: number, balance: number) => void
}

export function CouponRedeemSection({ isLoggedIn, onRedeemed }: Props) {
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ addedJu: number; balance: number } | null>(null)

  // ?coupon=EARLY15 딥링크 → 자동 펼침 + 채움.
  useEffect(() => {
    const c = searchParams.get('coupon')
    if (c) {
      setCode(c.toUpperCase())
      setOpen(true)
    }
  }, [searchParams])

  const handleRedeem = useCallback(async () => {
    const trimmed = code.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/coupon/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || '쿠폰 등록에 실패했어요.')
        return
      }
      setSuccess({ addedJu: data.addedJu, balance: data.balance })
      setCode('')
      // 메뉴 등 다른 곳의 잔액 캐시 무효화 후 재조회.
      clearBalanceCache()
      prefetchBalance()
      onRedeemed?.(data.addedJu, data.balance)
    } catch {
      setError('네트워크 오류가 발생했어요.')
    } finally {
      setLoading(false)
    }
  }, [code, loading, onRedeemed])

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4.5 h-4.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-[13px] leading-snug">
          <span className="font-bold text-emerald-700">+{success.addedJu}주</span>
          <span className="text-emerald-700"> 적용됐어요!</span>
          <span className="text-emerald-600/80"> 현재 {success.balance}주</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <span className="text-base">🎟</span>
        <span className="text-[13px] font-medium text-gray-700 flex-1">쿠폰 코드가 있으신가요?</span>
        <svg className={`w-4 h-4 text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-50">
          {isLoggedIn === false ? (
            <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
              쿠폰 등록은 로그인 후 이용할 수 있어요. 카카오로 로그인한 뒤 다시 시도해 주세요.
            </p>
          ) : (
            <div className="mt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem() }}
                  placeholder="예: CHARTPALJA26"
                  autoCapitalize="characters"
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 tracking-wide focus:outline-none focus:border-gray-400"
                />
                <button
                  type="button"
                  onClick={handleRedeem}
                  disabled={!code.trim() || loading}
                  className={`px-4 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                    code.trim() && !loading
                      ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {loading ? '확인 중' : '등록'}
                </button>
              </div>
              {error && <p className="text-[12px] text-red-500 mt-2">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
