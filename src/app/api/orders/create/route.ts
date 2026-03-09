import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/session'
import { getProduct } from '@/lib/payment/products'
import type { CreateOrderRequest } from '@/lib/payment/types'
import { getProvider } from '@/lib/payment/types'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body: CreateOrderRequest = await request.json()

    const product = getProduct(body.productCode)
    if (!product) {
      return NextResponse.json({ error: '존재하지 않는 상품입니다.' }, { status: 400 })
    }

    const provider = getProvider(body.paymentMethod)

    const order = await prisma.paymentOrder.create({
      data: {
        userId: user.id,
        productCode: product.code,
        productType: product.type,
        quantity: product.quantity,
        amount: product.price,
        currency: 'KRW',
        status: 'pending',
        paymentMethod: body.paymentMethod,
        provider,
      },
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      productCode: product.code,
      productName: product.name,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    console.error('POST /api/orders/create error:', error)
    return NextResponse.json({ error: '주문 생성에 실패했습니다.' }, { status: 500 })
  }
}
