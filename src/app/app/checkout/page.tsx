'use client'

import { Suspense, useState, useCallback, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { ProductSelector } from '@/components/payment/ProductSelector'
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector'
import { OrderSummaryCard } from '@/components/payment/OrderSummaryCard'
import { LegalFooter } from '@/components/LegalFooter'
import { canPayOverseas, formatPrice, getProduct } from '@/lib/payment/products'
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

interface SessionUserInfo {
  id: string
  email: string | null
  nickname: string | null
}

async function createAndPay(
  productCode: string,
  paymentMethod: PaymentMethod,
  router: ReturnType<typeof useRouter>,
  user: SessionUserInfo | null,
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
  const { orderId, amount, currency, paymentConfig } = orderData

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
  const payMethodMap: Record<string, string> = {
    kakaopay: 'EASY_PAY',
    tosspay: 'EASY_PAY',
    card: 'CARD',
    transfer: 'TRANSFER',
    overseas: 'CARD',
  }
  const easyPayMap: Record<string, Record<string, string>> = {
    kakaopay: { easyPayProvider: 'EASY_PAY_PROVIDER_KAKAOPAY' },
    tosspay:  { easyPayProvider: 'EASY_PAY_PROVIDER_TOSSPAY'  },
  }

  const params: Record<string, unknown> = {
    storeId,
    channelKey,
    paymentId: `payment_${orderId}_${Date.now()}`,
    orderName: product.name,
    totalAmount: amount,
    currency: currency || 'KRW',
    payMethod: payMethodMap[paymentMethod] ?? 'CARD',
    customData: JSON.stringify({ orderId }),
  }
  if (easyPayMap[paymentMethod]) params.easyPay = easyPayMap[paymentMethod]

  // 해외카드(Eximbay)는 고객 이름/이메일이 필수
  if (paymentMethod === 'overseas') {
    const fullName = user?.nickname?.trim() || '고객'
    const email = user?.email?.trim() || `kakao_${user?.id ?? 'guest'}@chartpalja.com`
    params.customer = { fullName, email }
  }

  console.log('[checkout] PortOne.requestPayment params:', params)

  let response: { code?: string; paymentId?: string; message?: string }
  try {
    response = await window.PortOne.requestPayment(params)
  } catch (err) {
    console.error('[checkout] PortOne.requestPayment threw:', err)
    return { success: false, orderId, error: err instanceof Error ? err.message : '결제 모듈 호출 실패' }
  }

  console.log('[checkout] PortOne.requestPayment response:', response)

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
  return (
    <Suspense fallback={<MobileContainer><div className="py-20 text-center text-gray-400 text-sm">로딩 중...</div></MobileContainer>}>
      <CheckoutContent />
    </Suspense>
  )
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')
  const [chartCode, setChartCode] = useState<string | null>(null)
  const [periodCode, setPeriodCode] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionUser, setSessionUser] = useState<SessionUserInfo | null>(null)

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

  // 선택된 상품 중 하나라도 해외카드(USD) 결제 불가면 'overseas' 비활성화
  const overseasDisabledReason = useMemo<string | null>(() => {
    const selectedProducts = [chartProduct, periodProduct].filter((p): p is NonNullable<typeof p> => p !== null)
    if (selectedProducts.length === 0) return null
    const unsupported = selectedProducts.filter((p) => !canPayOverseas(p))
    if (unsupported.length === 0) return null
    return `${unsupported.map((p) => p.name).join(', ')} 상품은 해외카드 결제 미지원 ($1 미만)`
  }, [chartProduct, periodProduct])

  const disabledMethods = useMemo(() => {
    return overseasDisabledReason
      ? { overseas: overseasDisabledReason } as Record<PaymentMethod, string>
      : ({} as Record<PaymentMethod, string>)
  }, [overseasDisabledReason])

  // 선택된 결제수단이 비활성화되면 자동 해제
  useEffect(() => {
    if (paymentMethod && disabledMethods[paymentMethod]) {
      setPaymentMethod(null)
    }
  }, [paymentMethod, disabledMethods])

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data?.user) {
          setSessionUser({
            id: data.user.id,
            email: data.user.email ?? null,
            nickname: data.user.nickname ?? null,
          })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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
        const result = await createAndPay(code, paymentMethod, router, sessionUser)
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
  }, [hasSelection, paymentMethod, chartCode, periodCode, router, sessionUser, returnUrl])

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
            <PaymentMethodSelector
              selected={paymentMethod}
              onSelect={setPaymentMethod}
              disabledMethods={disabledMethods}
            />
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
            <div className="mt-2.5 ml-8 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
              <Link href="/terms" target="_blank" className="underline hover:text-gray-700">
                이용약관
              </Link>
              <Link href="/privacy" target="_blank" className="underline hover:text-gray-700">
                개인정보처리방침
              </Link>
              <Link href="/refund" target="_blank" className="underline hover:text-gray-700">
                환불정책
              </Link>
            </div>
          </section>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>
        )}

        <LegalFooter className="-mx-4 mt-8" />
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
