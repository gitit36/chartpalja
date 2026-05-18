import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/session'
import { canPayOverseas, getProduct } from '@/lib/payment/products'
import type { CreateOrderRequest } from '@/lib/payment/types'
import { getProvider, getPortOneChannelKey, getPortOneStoreId } from '@/lib/payment/types'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body: CreateOrderRequest = await request.json()

    const product = getProduct(body.productCode)
    if (!product) {
      return NextResponse.json({ error: '존재하지 않는 상품입니다.' }, { status: 400 })
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

    // 해외카드(Eximbay)는 KRW 미지원 + 최소 결제 금액 $1 → USD/cents로 환산해 저장
    let orderAmount = product.price
    let orderCurrency: 'KRW' | 'USD' = 'KRW'
    if (body.paymentMethod === 'overseas') {
      if (!canPayOverseas(product)) {
        return NextResponse.json(
          { error: '이 상품은 해외카드 결제를 지원하지 않습니다. 다른 결제수단을 이용해 주세요.' },
          { status: 400 },
        )
      }
      orderAmount = product.usdPriceCents!
      orderCurrency = 'USD'
    }

    const order = await prisma.paymentOrder.create({
      data: {
        userId: user.id,
        productCode: product.code,
        productType: product.type,
        quantity: product.quantity,
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
      productCode: product.code,
      productName: product.name,
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
