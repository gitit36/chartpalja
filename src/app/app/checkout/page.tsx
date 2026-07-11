'use client'

import { Suspense, useState, useCallback, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { AppPageHeader } from '@/components/AppPageHeader'
import { ProductSelector } from '@/components/payment/ProductSelector'
import { CouponRedeemSection } from '@/components/payment/CouponRedeemSection'
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector'
import { OrderSummaryCard } from '@/components/payment/OrderSummaryCard'
import { MinimalLegalFooter } from '@/components/MinimalLegalFooter'
import { canPayOverseasBundle, formatPrice, getProduct } from '@/lib/payment/products'
import { getActiveMethodKeys, PAYMENT_METHOD_META, PAYMENT_INACTIVE_NOTE } from '@/lib/payment/methods'
import type { Product } from '@/lib/payment/products'
import type { CreateOrderResponse, PaymentMethod } from '@/lib/payment/types'
import { getGuestHeaders } from '@/lib/auth/guest'

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
  return getGuestHeaders()
}

/** 숫자만 들어있는 휴대폰 문자열을 010-1234-5678 형태로 표시한다. */
function formatKoreanMobile(raw: string): string {
  if (raw.length <= 3) return raw
  if (raw.length <= 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`
  return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`
}

interface SessionUserInfo {
  id: string
  email: string | null
  nickname: string | null
}

async function createAndPay(
  productCodes: string[],
  paymentMethod: PaymentMethod,
  _router: ReturnType<typeof useRouter>,
  user: SessionUserInfo | null,
  phoneNumber: string,
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const products = productCodes.map(getProduct).filter((p): p is Product => p !== null)
  if (products.length === 0) return { success: false, error: '상품 정보 오류' }

  const orderRes = await fetch('/api/orders/create', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ productCodes, paymentMethod }),
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
      items: products.map((p) => ({ priceId: `pri_${p.code}`, quantity: 1 })),
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

  const orderName = products.map((p) => p.name).join(' + ')

  const params: Record<string, unknown> = {
    storeId,
    channelKey,
    // KG이니시스 oid 한도 40자. cuid(25) + base36 timestamp(~8) = ~35자.
    paymentId: `p_${orderId}_${Date.now().toString(36)}`,
    orderName,
    totalAmount: amount,
    currency: currency || 'KRW',
    payMethod: payMethodMap[paymentMethod] ?? 'CARD',
    customData: JSON.stringify({ orderId }),
  }
  if (easyPayMap[paymentMethod]) params.easyPay = easyPayMap[paymentMethod]

  // PortOne 공통 customer 정보. KG이니시스 V2 일반결제(card/transfer) PC는
  // email/phoneNumber 둘 다 SDK 레벨에서 필수. Eximbay(overseas)는 email 필수.
  // 다른 PG에서도 무해하므로 항상 전달한다.
  {
    const fullName = user?.nickname?.trim() || '고객'
    const email = user?.email?.trim() || `kakao_${user?.id ?? 'guest'}@chartpalja.com`
    const customer: Record<string, string> = { fullName, email }
    if (phoneNumber) customer.phoneNumber = phoneNumber
    params.customer = customer
  }

  let response: { code?: string; paymentId?: string; message?: string }
  try {
    response = await window.PortOne.requestPayment(params)
  } catch (err) {
    console.error('[checkout] PortOne.requestPayment threw:', err)
    return { success: false, orderId, error: err instanceof Error ? err.message : '결제 모듈 호출 실패' }
  }

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
    <Suspense fallback={<MobileContainer><div className="py-20 text-center text-cp-muted text-sm">로딩 중...</div></MobileContainer>}>
      <CheckoutContent />
    </Suspense>
  )
}

const VALID_PAYMENT_METHODS: PaymentMethod[] = ['kakaopay', 'tosspay', 'card', 'transfer', 'overseas', 'paddle']

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')

  // URL 쿼리에서 초기값 복원 (약관 페이지에서 뒤로 돌아왔을 때 선택 상태 유지)
  const initialJu = searchParams.get('ju') ?? searchParams.get('chart') ?? searchParams.get('period')
  const initialMethodParam = searchParams.get('method')
  const initialMethod: PaymentMethod | null =
    initialMethodParam && (VALID_PAYMENT_METHODS as string[]).includes(initialMethodParam)
      ? (initialMethodParam as PaymentMethod)
      : null

  const [juCode, setJuCode] = useState<string | null>(initialJu && getProduct(initialJu) ? initialJu : null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(initialMethod)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionUser, setSessionUser] = useState<SessionUserInfo | null>(null)
  // 휴대폰 번호: 숫자만 저장(예: '01012345678'). KG이니시스 PC 결제 필수.
  const [phoneRaw, setPhoneRaw] = useState<string>('')

  // 선택 상태가 바뀌면 URL 쿼리에 반영 (replace로 히스토리는 늘리지 않음)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (juCode) params.set('ju', juCode); else params.delete('ju')
    params.delete('chart')
    params.delete('period')
    if (paymentMethod) params.set('method', paymentMethod); else params.delete('method')
    const qs = params.toString()
    const next = qs ? `/app/checkout?${qs}` : '/app/checkout'
    const current = window.location.pathname + window.location.search
    if (current !== next) {
      router.replace(next, { scroll: false })
    }
  }, [juCode, paymentMethod, router])

  const juProduct = juCode ? getProduct(juCode) : null
  const hasSelection = !!juProduct
  const totalPrice = juProduct?.price ?? 0

  // KG이니시스 PC 결제(card/transfer)는 SDK 레벨에서 phoneNumber 필수.
  const phoneRequired = paymentMethod === 'card' || paymentMethod === 'transfer'
  const isPhoneValid = /^010\d{8}$/.test(phoneRaw)
  const phoneOk = !phoneRequired || isPhoneValid

  const canPay = hasSelection && paymentMethod && agreed && phoneOk && !loading

  // sessionStorage에서 이전 입력 휴대폰 번호 복원 (브라우저 세션 동안 자동 채움)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.sessionStorage.getItem('checkout_phone')
    if (saved && /^010\d{8}$/.test(saved)) setPhoneRaw(saved)
  }, [])

  const orderName = useMemo(() => juProduct?.name ? `${juProduct.name} 충전` : '', [juProduct])

  const overseasDisabledReason = useMemo<string | null>(() => {
    if (!juProduct) return null
    if (canPayOverseasBundle([juProduct])) return null
    return '해외카드 결제는 합계 $1.00 이상부터 가능해요'
  }, [juProduct])

  // 현재 라이브 모드에서 비활성('준비 중')인 결제수단 (테스트 모드면 비어 있음)
  const inactiveMethods = useMemo(() => {
    const active = new Set(getActiveMethodKeys())
    const map: Partial<Record<PaymentMethod, string>> = {}
    for (const m of PAYMENT_METHOD_META) {
      if (!active.has(m.key)) map[m.key] = PAYMENT_INACTIVE_NOTE
    }
    return map
  }, [])

  const disabledMethods = useMemo(() => {
    const map: Partial<Record<PaymentMethod, string>> = { ...inactiveMethods }
    if (overseasDisabledReason) map.overseas = overseasDisabledReason
    return map as Record<PaymentMethod, string>
  }, [inactiveMethods, overseasDisabledReason])

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
      if (juCode) codes.push(juCode)

      if (phoneRequired && isPhoneValid && typeof window !== 'undefined') {
        window.sessionStorage.setItem('checkout_phone', phoneRaw)
      }
      const result = await createAndPay(codes, paymentMethod, router, sessionUser, phoneRaw)

      if (!result.success) {
        if (result.error === 'cancel') {
          router.push(`/app/checkout/cancel?orderId=${result.orderId}`)
          return
        }
        router.push(`/app/checkout/fail?orderId=${result.orderId}&message=${encodeURIComponent(result.error || '')}`)
        return
      }

      const successUrl = `/app/checkout/success?orderId=${result.orderId}${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`
      router.push(successUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : '결제 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [hasSelection, paymentMethod, juCode, router, sessionUser, returnUrl, phoneRaw, phoneRequired, isPhoneValid])

  return (
    <MobileContainer>
      <script src="https://cdn.portone.io/v2/browser-sdk.js" async />

      <div className="min-h-screen pb-32">
        <AppPageHeader title="이용권 구매" backHref={returnUrl || '/app/list'} />

        <div className="px-4 pt-5">
        <section className="mb-6">
          <ProductSelector
            selectedCode={juCode}
            onSelect={setJuCode}
          />
        </section>

        <section className="mb-6">
          <CouponRedeemSection isLoggedIn={sessionUser ? true : null} />
        </section>

        {hasSelection && (
          <section className="mb-6">
            <OrderSummaryCard product={juProduct} totalPrice={totalPrice} />
          </section>
        )}

        {hasSelection && (
          <section className="mb-6">
            <h3 className="text-sm font-semibold text-cp-text mb-3">결제수단</h3>
            <PaymentMethodSelector
              selected={paymentMethod}
              onSelect={setPaymentMethod}
              disabledMethods={disabledMethods}
            />
          </section>
        )}

        {hasSelection && paymentMethod && phoneRequired && (
          <section className="mb-5">
            <label className="block">
              <span className="text-sm font-semibold text-cp-text mb-1.5 block">연락처</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={formatKoreanMobile(phoneRaw)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                  setPhoneRaw(digits)
                }}
                placeholder="010-1234-5678"
                maxLength={13}
                aria-invalid={phoneRaw.length > 0 && !isPhoneValid}
                className={`w-full px-4 py-3 rounded-xl border bg-cp-input text-sm text-cp-text placeholder-cp-muted focus:outline-none ${
                  phoneRaw.length > 0 && !isPhoneValid
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-cp-border focus:border-cp-line'
                }`}
              />
              <span className="text-[11px] text-cp-muted mt-1.5 block">
                결제 영수증 발송 등 결제 처리에만 사용됩니다.
              </span>
            </label>
          </section>
        )}

        {hasSelection && paymentMethod && (
          <section className="mb-6">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-4 h-4 rounded border-cp-border text-cp-text focus:ring-gray-300"
              />
              <span className="text-[13px] text-cp-text">
                <Link href="/terms" className="underline decoration-cp-border hover:text-cp-secondary">이용약관</Link>
                {' · '}
                <Link href="/privacy" className="underline decoration-cp-border hover:text-cp-secondary">개인정보처리방침</Link>
                {' · '}
                <Link href="/refund" className="underline decoration-cp-border hover:text-cp-secondary">환불정책</Link>
                <span className="text-cp-muted">에 동의합니다.</span>
              </span>
            </label>
          </section>
        )}

        {error && (
          <div className="mb-4 p-3 bg-cp-line/10 rounded-xl text-sm text-cp-up">{error}</div>
        )}

        <MinimalLegalFooter className="mt-8" />
        </div>
      </div>

      {hasSelection && (
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="mx-auto max-w-[446px] p-4 bg-cp-raised border-t border-cp-border">
            <button
              onClick={handlePay}
              disabled={!canPay}
              className={`w-full py-4 rounded-2xl text-base font-bold transition-all ${
                canPay
                  ? 'bg-cp-accent text-white active:scale-[0.98]'
                  : 'bg-cp-border text-cp-muted cursor-not-allowed'
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
