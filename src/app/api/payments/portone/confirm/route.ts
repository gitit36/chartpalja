import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/session'
import { verifyPayment } from '@/lib/payment/portone'
import { grantCredits } from '@/lib/payment/entitlement'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const { orderId, paymentId } = await request.json() as { orderId: string; paymentId: string }

    if (!orderId || !paymentId) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 })
    }

    const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (order.userId !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }
    if (order.status === 'paid') {
      return NextResponse.json({ success: true, orderId, message: '이미 처리된 주문입니다.' })
    }

    // Mock mode: skip PortOne verification
    const isMock = process.env.NEXT_PUBLIC_PAYMENT_MOCK === 'true'

    if (isMock) {
      await prisma.paymentOrder.update({
        where: { id: orderId },
        data: {
          status: 'paid',
          providerTxId: `mock_${paymentId}`,
          paidAt: new Date(),
          rawPayload: { mock: true, paymentId },
        },
      })
      await grantCredits(user.id, orderId, order.productCode)
      return NextResponse.json({ success: true, orderId })
    }

    // Production: verify with PortOne API
    const payment = await verifyPayment(paymentId)

    if (payment.status !== 'PAID') {
      await prisma.paymentOrder.update({
        where: { id: orderId },
        data: { status: 'failed', rawPayload: payment as object },
      })
      return NextResponse.json({ success: false, orderId, message: '결제가 완료되지 않았습니다.' }, { status: 400 })
    }

    if (payment.amount.total !== order.amount) {
      await prisma.paymentOrder.update({
        where: { id: orderId },
        data: { status: 'failed', rawPayload: payment as object },
      })
      return NextResponse.json({ success: false, orderId, message: '결제 금액이 일치하지 않습니다.' }, { status: 400 })
    }

    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        providerTxId: payment.id,
        paidAt: new Date(),
        rawPayload: payment as object,
      },
    })

    await grantCredits(user.id, orderId, order.productCode)

    return NextResponse.json({ success: true, orderId })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    console.error('POST /api/payments/portone/confirm error:', error)
    return NextResponse.json({ error: '결제 확인에 실패했습니다.' }, { status: 500 })
  }
}
