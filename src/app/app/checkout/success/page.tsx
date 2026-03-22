'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'

interface OrderInfo {
  productName: string
  quantity: number
  amount: number
  status: string
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('orderId')
  const returnUrl = searchParams.get('returnUrl')
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) { setLoading(false); return }
    fetch(`/api/orders/${orderId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setOrder(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orderId])

  return (
    <MobileContainer>
      <div className="px-4 pt-16 pb-8 min-h-screen flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-6">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">결제가 완료되었어요!</h1>
        <p className="text-gray-500 text-sm mb-8">이용권이 바로 지급되었어요.</p>

        {loading ? (
          <div className="text-gray-400 text-sm">주문 정보 확인 중...</div>
        ) : order ? (
          <div className="w-full max-w-sm bg-gray-50 rounded-2xl p-5 mb-8">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">구매 상품</span>
              <span className="font-semibold text-gray-900">{order.productName}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">지급 수량</span>
              <span className="font-semibold text-purple-700">{order.quantity}회</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">결제 금액</span>
              <span className="font-semibold text-gray-900">{order.amount?.toLocaleString()}원</span>
            </div>
          </div>
        ) : null}

        <button
          onClick={() => router.push(returnUrl || '/app/list')}
          className="w-full max-w-sm py-4 rounded-2xl text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
        >
          {returnUrl ? '돌아가기' : '서비스 이용하러 가기'}
        </button>
      </div>
    </MobileContainer>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">로딩 중...</div>}>
      <SuccessContent />
    </Suspense>
  )
}
