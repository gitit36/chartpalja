import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/session'
import { getProduct } from '@/lib/payment/products'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params

    const order = await prisma.paymentOrder.findUnique({ where: { id } })
    if (!order || order.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const product = getProduct(order.productCode)

    return NextResponse.json({
      id: order.id,
      productCode: order.productCode,
      productName: product?.name ?? order.productCode,
      quantity: order.quantity,
      amount: order.amount,
      status: order.status,
      paidAt: order.paidAt,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
