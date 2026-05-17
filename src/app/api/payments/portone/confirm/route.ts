import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/session'
import { grantCredits } from '@/lib/payment/entitlement'
import { syncPaymentByPaymentId } from '@/lib/payment/sync'

// 클라이언트 결제창에서 성공 응답을 받은 직후 호출되는 확인 엔드포인트.
// 실제 결제 정보는 PortOne API 조회로 재확인하고 DB 동기화한다.
// 웹훅과 동일 로직(syncPaymentByPaymentId)을 통해 멱등성을 보장한다.
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

    const result = await syncPaymentByPaymentId(paymentId)

    if (!result.ok) {
      const msgMap: Record<string, string> = {
        order_not_found: '주문을 찾을 수 없습니다.',
        payment_not_found: '결제 정보를 조회할 수 없습니다.',
        invalid_custom_data: '결제 정보가 올바르지 않습니다.',
        amount_mismatch: '결제 금액이 일치하지 않습니다.',
        currency_mismatch: '결제 통화가 일치하지 않습니다.',
        order_name_mismatch: '주문 정보가 일치하지 않습니다.',
        error: '결제 확인 중 오류가 발생했습니다.',
      }
      return NextResponse.json(
        { success: false, orderId, message: msgMap[result.reason] ?? '결제 확인에 실패했습니다.' },
        { status: 400 },
      )
    }

    if (result.action === 'paid' || result.action === 'already_paid') {
      return NextResponse.json({ success: true, orderId })
    }

    return NextResponse.json(
      { success: false, orderId, message: '결제가 아직 완료되지 않았습니다.' },
      { status: 400 },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    console.error('POST /api/payments/portone/confirm error:', error)
    return NextResponse.json({ error: '결제 확인에 실패했습니다.' }, { status: 500 })
  }
}
