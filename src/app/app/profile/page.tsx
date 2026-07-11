'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { AppPageHeader } from '@/components/AppPageHeader'
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

// 레거시 상품코드(chart_5, period_1 등) → 사람이 읽는 라벨.
const LEGACY_PREFIX_LABEL: Record<string, string> = {
  chart: '차트 해설',
  period: '구간 해설',
  fortune: '운세 해설',
  compat: '궁합 해설',
  ju: '주(株) 충전',
}

function productName(code: string): string {
  const known = PRODUCTS[code]?.name
  if (known) return known
  // 레거시 포맷 "<prefix>_<n>" 디코딩.
  const [prefix, nStr] = code.split('_')
  const base = prefix ? LEGACY_PREFIX_LABEL[prefix] : undefined
  if (base) {
    const n = parseInt(nStr ?? '', 10)
    return Number.isFinite(n) && n > 0 ? `${base} ${n}회` : base
  }
  return code
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
        <AppPageHeader title="내 프로필" />

        {loading ? (
          <div className="min-h-[60vh] flex items-center justify-center text-cp-muted">불러오는 중...</div>
        ) : (
          <div className="px-4 pt-5 space-y-6">
            {/* Balance */}
            <section>
              <h2 className="text-sm font-semibold text-cp-muted mb-3">나의 주(株)</h2>
              <div className="bg-cp-surface rounded-xl p-4 text-center">
                <p className="text-xs text-cp-accent font-medium mb-1">보유 주</p>
                <p className="text-2xl font-bold text-cp-text">{balance?.ju ?? 0}<span className="text-sm font-medium text-cp-muted ml-0.5">주</span></p>
                <p className="text-[11px] text-cp-muted mt-2">구간 1주 · 운세·궁합 5주</p>
              </div>

              <button
                onClick={() => router.push('/app/checkout')}
                className="w-full mt-3 py-3 rounded-xl bg-cp-accent text-white text-sm font-bold active:scale-[0.98] transition-all"
              >
                이용권 구매
              </button>
            </section>

            {/* Purchase History */}
            <section>
              <h2 className="text-sm font-semibold text-cp-muted mb-3">이용 내역</h2>
              {orders.length === 0 ? (
                <div className="bg-cp-surface/60 border border-cp-border rounded-xl p-6 text-center">
                  <p className="text-sm text-cp-muted">아직 이용 내역이 없어요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(showAllOrders ? orders : orders.slice(0, 3)).map(o => (
                    <div key={o.id} className="bg-cp-surface/70 border border-cp-border rounded-xl px-4 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-cp-text truncate">{productName(o.productCode)}</p>
                          <p className="text-xs text-cp-muted mt-0.5">{formatDate(o.paidAt)} · {payMethodLabel(o.paymentMethod)}</p>
                        </div>
                        <p className="text-sm font-bold text-cp-secondary tabular-nums shrink-0">{formatPrice(o.amount)}원</p>
                      </div>
                    </div>
                  ))}
                  {!showAllOrders && orders.length > 3 && (
                    <div className="relative pt-1">
                      <div className="absolute -top-14 left-0 right-0 h-14 bg-gradient-to-t from-cp-raised via-cp-raised/80 to-transparent pointer-events-none" />
                      <button onClick={() => setShowAllOrders(true)}
                        className="relative w-full py-2.5 text-sm font-medium text-cp-muted hover:text-cp-secondary transition-colors">
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
                className="w-full py-3 rounded-xl border border-cp-border text-sm font-medium text-cp-muted hover:bg-cp-hover/40 transition-colors"
              >
                {loggingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </section>
          </div>
        )}

        {!loading && <MinimalLegalFooter className="mt-8" />}
      </div>
    </MobileContainer>
  )
}
