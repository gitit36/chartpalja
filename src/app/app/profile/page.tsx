'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { formatPrice } from '@/lib/payment/products'
import { PRODUCTS } from '@/lib/payment/products'

interface Balance {
  chartCredits: number
  periodCredits: number
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
  if (typeof window !== 'undefined') {
    const gid = localStorage.getItem('saju_guest_id')
    if (gid) h['x-guest-id'] = gid
  }
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
      localStorage.removeItem('saju_guest_id')
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
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-lg mr-3">&larr;</button>
            <h1 className="text-lg font-bold text-gray-900">내 프로필</h1>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-16">불러오는 중...</div>
        ) : (
          <div className="px-4 pt-5 space-y-6">
            {/* Balance */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">나의 이용권</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-purple-600 font-medium mb-1">운세 해설</p>
                  <p className="text-2xl font-bold text-purple-700">{balance?.chartCredits ?? 0}<span className="text-sm font-medium ml-0.5">회</span></p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-indigo-600 font-medium mb-1">기간 해설</p>
                  <p className="text-2xl font-bold text-indigo-700">{balance?.periodCredits ?? 0}<span className="text-sm font-medium ml-0.5">회</span></p>
                </div>
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
                  {orders.map(o => (
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
      </div>
    </MobileContainer>
  )
}
