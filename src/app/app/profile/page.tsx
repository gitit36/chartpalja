'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { MinimalLegalFooter } from '@/components/MinimalLegalFooter'
import { formatPrice } from '@/lib/payment/products'
import { PRODUCTS } from '@/lib/payment/products'
import { clearGuestId, getGuestId } from '@/lib/auth/guest'
import { clearBalanceCache } from '@/lib/hooks/useBalance'

interface Balance {
  ju: number
}

interface OrderItem {
  id: string
  productCode: string
  productType: string
  quantity: number
  amount: number
  status: string
  paymentMethod: string | null
  paidAt: string | null
  createdAt: string
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  const gid = getGuestId()
  if (gid) h['x-guest-id'] = gid
  return h
}

function productName(code: string): string {
  return PRODUCTS[code]?.name ?? code
}

function formatDate(d: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function payMethodLabel(m: string | null): string {
  const map: Record<string, string> = { kakaopay: '카카오페이', tosspay: '토스페이', card: '카드', paddle: '해외카드' }
  return m ? (map[m] ?? m) : '-'
}

export default function ProfilePage() {
  const router = useRouter()
  const [balance, setBalance] = useState<Balance | null>(null)
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showAllOrders, setShowAllOrders] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/user/balance', { headers: getHeaders() }).then(r => r.ok ? r.json() : null),
      fetch('/api/user/orders', { headers: getHeaders() }).then(r => r.ok ? r.json() : null),
    ]).then(([bal, ord]) => {
      if (bal) setBalance(bal)
      if (ord?.orders) setOrders(ord.orders)
    }).finally(() => setLoading(false))
  }, [])

  const handleLogout = useCallback(async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: getHeaders() })
      clearBalanceCache()
      clearGuestId()
      router.push('/')
    } catch {
      setLoggingOut(false)
    }
  }, [router])

  return (
    <MobileContainer>
      <div className="min-h-screen pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
          <div className="flex items-center px-4 py-3">
            <button
              onClick={() => router.back()}
              aria-label="뒤로가기"
              className="w-11 h-11 -ml-2.5 mr-1 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full text-lg transition-colors"
            >
              &larr;
            </button>
            <h1 className="text-lg font-bold text-gray-900">내 프로필</h1>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-16">불러오는 중...</div>
        ) : (
          <div className="px-4 pt-5 space-y-6">
            {/* Balance */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">나의 주(株)</h2>
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <p className="text-xs text-purple-600 font-medium mb-1">보유 주</p>
                <p className="text-2xl font-bold text-purple-700">{balance?.ju ?? 0}<span className="text-sm font-medium ml-0.5">주</span></p>
                <p className="text-[11px] text-gray-500 mt-2">구간 1주 · 운세·궁합 5주</p>
              </div>

              <button
                onClick={() => router.push('/app/checkout')}
                className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow hover:shadow-lg transition-all active:scale-[0.98]"
              >
                이용권 구매
              </button>
            </section>

            {/* Purchase History */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">이용 내역</h2>
              {orders.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-6 text-center">
                  <p className="text-sm text-gray-400">아직 이용 내역이 없어요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(showAllOrders ? orders : orders.slice(0, 3)).map(o => (
                    <div key={o.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{productName(o.productCode)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(o.paidAt)} · {payMethodLabel(o.paymentMethod)}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-700">{formatPrice(o.amount)}원</p>
                      </div>
                    </div>
                  ))}
                  {!showAllOrders && orders.length > 3 && (
                    <div className="relative">
                      <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                      <button onClick={() => setShowAllOrders(true)}
                        className="w-full py-2.5 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors">
                        이전 내역 {orders.length - 3}건 더보기
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Logout */}
            <section className="pt-2">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {loggingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </section>
          </div>
        )}

        <MinimalLegalFooter className="mt-8" />
      </div>
    </MobileContainer>
  )
}
