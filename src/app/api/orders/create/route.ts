import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/session'
import {
  canPayOverseasBundle,
  getProduct,
  OVERSEAS_MIN_CENTS,
  sumUsdCents,
} from '@/lib/payment/products'
import type { Product } from '@/lib/payment/products'
import type { CreateOrderRequest, OrderItemInfo } from '@/lib/payment/types'
import { getProvider, getPortOneChannelKey, getPortOneStoreId } from '@/lib/payment/types'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body: CreateOrderRequest = await request.json()

    // productCodes 우선, 없으면 단일 productCode 사용 (하위 호환)
    const codes: string[] =
      Array.isArray(body.productCodes) && body.productCodes.length > 0
        ? body.productCodes
        : body.productCode
          ? [body.productCode]
          : []

    if (codes.length === 0) {
      return NextResponse.json({ error: '상품이 선택되지 않았습니다.' }, { status: 400 })
    }

    const products: Product[] = []
    for (const code of codes) {
      const p = getProduct(code)
      if (!p) {
        return NextResponse.json({ error: `존재하지 않는 상품: ${code}` }, { status: 400 })
      }
      products.push(p)
    }

    const provider = getProvider(body.paymentMethod)
    const paymentConfig = provider === 'portone'
      ? {
          storeId: getPortOneStoreId(),
          channelKey: getPortOneChannelKey(body.paymentMethod),
        }
      : null

    if (provider === 'portone' && (!paymentConfig?.storeId || !paymentConfig.channelKey)) {
      return NextResponse.json(
        { error: '결제 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.' },
        { status: 500 },
      )
    }

    // 통화/금액 계산
    let orderAmount: number
    let orderCurrency: 'KRW' | 'USD'

    if (body.paymentMethod === 'overseas') {
      if (!canPayOverseasBundle(products)) {
        return NextResponse.json(
          {
            error: `해외카드 결제는 합계 $${(OVERSEAS_MIN_CENTS / 100).toFixed(2)} 이상부터 가능합니다. 다른 결제수단을 이용해 주세요.`,
          },
          { status: 400 },
        )
      }
      orderAmount = sumUsdCents(products)
      orderCurrency = 'USD'
    } else {
      orderAmount = products.reduce((sum, p) => sum + p.price, 0)
      orderCurrency = 'KRW'
    }

    // 정렬: chart 를 primary 로 (없으면 첫 상품). period 보너스가 chart 에만 붙으므로 의미적으로도 자연스러움.
    const chartIndex = products.findIndex((p) => p.type === 'chart')
    const primaryIdx = chartIndex >= 0 ? chartIndex : 0
    const primary = products[primaryIdx]
    const others = products.filter((_, i) => i !== primaryIdx)

    const perItemAmount = (p: Product) => (orderCurrency === 'USD' ? (p.usdPriceCents ?? 0) : p.price)

    const extraItems: OrderItemInfo[] = others.map((p) => ({
      code: p.code,
      type: p.type,
      quantity: p.quantity,
      amount: perItemAmount(p),
      currency: orderCurrency,
    }))

    const order = await prisma.paymentOrder.create({
      data: {
        userId: user.id,
        productCode: primary.code,
        productType: primary.type,
        quantity: primary.quantity,
        extraItems: extraItems.length > 0 ? extraItems : undefined,
        amount: orderAmount,
        currency: orderCurrency,
        status: 'pending',
        paymentMethod: body.paymentMethod,
        provider,
      },
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      productCode: primary.code,
      productName: products.map((p) => p.name).join(' + '),
      paymentConfig,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    console.error('POST /api/orders/create error:', error)
    return NextResponse.json({ error: '주문 생성에 실패했습니다.' }, { status: 500 })
  }
}
