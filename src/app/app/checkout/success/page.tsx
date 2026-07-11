'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ResultScreen } from '@/components/ResultScreen'

interface OrderInfo {
  productName: string
  quantity: number
  amount: number
  status: string
}

function SuccessContent() {
  const searchParams = useSearchParams()
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

  const detail = loading ? (
    <div className="text-cp-muted text-sm mb-8">주문 정보 확인 중...</div>
  ) : order ? (
    <div className="w-full max-w-sm bg-cp-surface rounded-2xl p-5 mb-8 border border-cp-border">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-cp-muted">구매 상품</span>
        <span className="font-semibold text-cp-text">{order.productName}</span>
      </div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-cp-muted">지급 수량</span>
        <span className="font-semibold text-cp-line">{order.quantity}회</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-cp-muted">결제 금액</span>
        <span className="font-semibold text-cp-text">{order.amount?.toLocaleString()}원</span>
      </div>
    </div>
  ) : null

  return (
    <ResultScreen
      variant="success"
      title="결제가 완료되었어요!"
      description="이용권이 바로 지급되었어요."
      detail={detail}
      actions={[
        { label: returnUrl ? '돌아가기' : '서비스 이용하러 가기', href: returnUrl || '/app/list', primary: true },
      ]}
    />
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-cp-muted">로딩 중...</div>}>
      <SuccessContent />
    </Suspense>
  )
}
