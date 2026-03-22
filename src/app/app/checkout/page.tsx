'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { ProductSelector } from '@/components/payment/ProductSelector'
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector'
import { OrderSummaryCard } from '@/components/payment/OrderSummaryCard'
import { formatPrice, getProduct } from '@/lib/payment/products'
import type { CreateOrderResponse, PaymentMethod } from '@/lib/payment/types'

declare global {
  interface Window {
    PortOne?: {
      requestPayment: (params: Record<string, unknown>) => Promise<{ code?: string; paymentId?: string; message?: string }>
    }
    Paddle?: {
      Checkout: {
        open: (params: Record<string, unknown>) => void
      }
    }
  }
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    const gid = localStorage.getItem('saju_guest_id')
    if (gid) h['x-guest-id'] = gid
  }
  return h
}

async function createAndPay(
  productCode: string,
  paymentMethod: PaymentMethod,
  router: ReturnType<typeof useRouter>,
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const product = getProduct(productCode)
  if (!product) return { success: false, error: '상품 정보 오류' }

  const orderRes = await fetch('/api/orders/create', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ productCode, paymentMethod }),
  })
  if (!orderRes.ok) {
    const err = await orderRes.json().catch(() => ({}))
    return { success: false, error: err.error || '주문 생성 실패' }
  }
  const orderData = await orderRes.json() as CreateOrderResponse
  const { orderId, amount, paymentConfig } = orderData

  const isMock = process.env.NEXT_PUBLIC_PAYMENT_MOCK === 'true'
  if (isMock) {
    const confirmRes = await fetch('/api/payments/portone/confirm', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ orderId, paymentId: `mock_${Date.now()}` }),
    })
    const result = await confirmRes.json()
    return { success: result.success, orderId, error: result.message }
  }

  if (paymentMethod === 'paddle') {
    if (!window.Paddle) return { success: false, error: 'Paddle SDK 미로드' }
    window.Paddle.Checkout.open({
      settings: { displayMode: 'overlay' },
      items: [{ priceId: `pri_${product.code}`, quantity: 1 }],
      customData: { orderId },
      successUrl: `${window.location.origin}/app/checkout/success?orderId=${orderId}`,
    })
    return { success: true, orderId }
  }

  if (!window.PortOne) return { success: false, error: '결제 모듈 미로드' }

  const storeId = paymentConfig?.storeId ?? ''
  const channelKey = paymentConfig?.channelKey ?? ''
  if (!storeId || !channelKey) {
    return { success: false, orderId, error: '결제 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.' }
  }
  const payMethodMap: Record<string, string> = { kakaopay: 'EASY_PAY', tosspay: 'EASY_PAY', card: 'CARD' }
  const easyPayMap: Record<string, Record<string, string>> = { kakaopay: { provider: 'KAKAOPAY' }, tosspay: { provider: 'TOSSPAY' } }

  const params: Record<string, unknown> = {
    storeId,
    channelKey,
    paymentId: `payment_${orderId}_${Date.now()}`,
    orderName: product.name,
    totalAmount: amount,
    currency: 'CURRENCY_KRW',
    payMethod: payMethodMap[paymentMethod] ?? 'CARD',
    customData: JSON.stringify({ orderId }),
  }
  if (easyPayMap[paymentMethod]) params.easyPay = easyPayMap[paymentMethod]

  const response = await window.PortOne.requestPayment(params)

  if (response.code) {
    if (response.code === 'FAILURE_TYPE_PG' || response.message?.includes('cancel')) {
      return { success: false, orderId, error: 'cancel' }
    }
    return { success: false, orderId, error: response.message || '결제 실패' }
  }

  if (response.paymentId) {
    const confirmRes = await fetch('/api/payments/portone/confirm', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ orderId, paymentId: response.paymentId }),
    })
    const result = await confirmRes.json()
    return { success: result.success, orderId, error: result.message }
  }

  return { success: false, orderId, error: '결제 응답 없음' }
}

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')
  const [chartCode, setChartCode] = useState<string | null>(null)
  const [periodCode, setPeriodCode] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chartProduct = chartCode ? getProduct(chartCode) : null
  const periodProduct = periodCode ? getProduct(periodCode) : null
  const hasSelection = chartProduct || periodProduct
  const totalPrice = (chartProduct?.price ?? 0) + (periodProduct?.price ?? 0)
  const canPay = hasSelection && paymentMethod && agreed && !loading

  const orderName = useMemo(() => {
    const parts: string[] = []
    if (chartProduct) parts.push(chartProduct.name)
    if (periodProduct) parts.push(periodProduct.name)
    return parts.join(' + ')
  }, [chartProduct, periodProduct])

  const handlePay = useCallback(async () => {
    if (!hasSelection || !paymentMethod) return
    setLoading(true)
    setError(null)

    try {
      const codes: string[] = []
      if (chartCode) codes.push(chartCode)
      if (periodCode) codes.push(periodCode)

      let lastOrderId: string | undefined

      for (const code of codes) {
        const result = await createAndPay(code, paymentMethod, router)
        lastOrderId = result.orderId

        if (!result.success) {
          if (result.error === 'cancel') {
            router.push(`/app/checkout/cancel?orderId=${result.orderId}`)
            return
          }
          router.push(`/app/checkout/fail?orderId=${result.orderId}&message=${encodeURIComponent(result.error || '')}`)
          return
        }
      }

      const successUrl = `/app/checkout/success?orderId=${lastOrderId}${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`
      router.push(successUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : '결제 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [hasSelection, paymentMethod, chartCode, periodCode, router])

  return (
    <MobileContainer>
      <script src="https://cdn.portone.io/v2/browser-sdk.js" async />

      <div className="px-4 pt-4 pb-32 min-h-screen">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 text-lg">
            &larr;
          </button>
          <h1 className="text-lg font-bold text-gray-900">이용권 구매</h1>
        </div>

        <section className="mb-6">
          <ProductSelector
            selectedChart={chartCode}
            selectedPeriod={periodCode}
            onSelectChart={setChartCode}
            onSelectPeriod={setPeriodCode}
          />
        </section>

        {hasSelection && (
          <section className="mb-6">
            <OrderSummaryCard chartProduct={chartProduct} periodProduct={periodProduct} totalPrice={totalPrice} />
          </section>
        )}

        {hasSelection && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">결제수단 선택</h2>
            <PaymentMethodSelector selected={paymentMethod} onSelect={setPaymentMethod} />
          </section>
        )}

        {hasSelection && paymentMethod && (
          <section className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-600 leading-relaxed">
                구매 조건을 확인했으며, 결제에 동의합니다.
                <br />
                <span className="text-xs text-gray-400">디지털 콘텐츠 특성상 이용 시작 후 환불이 제한될 수 있습니다.</span>
              </span>
            </label>
          </section>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>
        )}
      </div>

      {hasSelection && (
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="mx-auto max-w-[446px] p-4 bg-white border-t border-gray-100">
            <button
              onClick={handlePay}
              disabled={!canPay}
              className={`w-full py-4 rounded-2xl text-base font-bold transition-all ${
                canPay
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {loading ? '결제 진행 중...' : `${formatPrice(totalPrice)}원 결제하기`}
            </button>
          </div>
        </div>
      )}
    </MobileContainer>
  )
}
