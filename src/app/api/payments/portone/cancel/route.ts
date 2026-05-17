import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/session'
import { canRefundOrder, revokeCredits } from '@/lib/payment/entitlement'
import { cancelPayment } from '@/lib/payment/portone'
import { notifyPaymentCancelled, notifyPaymentFailed } from '@/lib/notifications'

// 사용자 본인 환불 요청
// 정책:
//   - 결제일로부터 7일 이내
//   - 미사용분 (현재 잔액 >= 주문 수량)만 100% 환불
//   - 부분 환불 미지원
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const { orderId, reason } = await request.json() as { orderId?: string; reason?: string }

    if (!orderId) {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 })
    }

    const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (order.userId !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const refundCheck = await canRefundOrder(orderId)
    if (!refundCheck.ok) {
      const reasonMap: Record<string, string> = {
        not_paid: '결제 완료된 주문만 환불 가능합니다.',
        expired_7d: '결제일로부터 7일이 지나 환불이 불가합니다.',
        already_used: '이미 사용한 이용권은 환불이 불가합니다.',
        order_not_found: '주문을 찾을 수 없습니다.',
        unknown_product: '상품 정보가 올바르지 않습니다.',
      }
      return NextResponse.json(
        { error: reasonMap[refundCheck.reason ?? ''] ?? '환불할 수 없는 주문입니다.' },
        { status: 400 },
      )
    }

    if (!order.providerTxId) {
      return NextResponse.json({ error: '결제 정보를 찾을 수 없습니다.' }, { status: 400 })
    }

    try {
      await cancelPayment({
        paymentId: order.providerTxId,
        reason: reason || '고객 요청',
        currentCancellableAmount: order.amount,
      })
    } catch (err) {
      console.error('[refund] portone cancelPayment failed:', err)
      await notifyPaymentFailed(order, `환불 API 실패: ${err instanceof Error ? err.message : String(err)}`)
      return NextResponse.json({ error: '환불 처리 중 오류가 발생했습니다.' }, { status: 502 })
    }

    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: { status: 'canceled' },
    })

    await revokeCredits(order.userId, orderId, order.productCode)

    await notifyPaymentCancelled(order, reason || '사용자 요청 환불')

    return NextResponse.json({ success: true, orderId })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    console.error('POST /api/payments/portone/cancel error:', error)
    return NextResponse.json({ error: '환불 처리에 실패했습니다.' }, { status: 500 })
  }
}
