import { prisma } from '@/lib/db/prisma'
import { getProduct } from './products'
import { grantCredits, revokeCredits } from './entitlement'
import { getPayment } from './portone'
import {
  notifyPaymentCancelled,
  notifyPaymentFailed,
  notifyPaymentPaid,
} from '@/lib/notifications'

export type SyncResult =
  | { ok: true; action: 'paid' | 'already_paid' | 'cancelled' | 'partial_cancelled' | 'failed' | 'noop'; orderId: string }
  | { ok: false; reason: 'order_not_found' | 'payment_not_found' | 'invalid_custom_data' | 'amount_mismatch' | 'currency_mismatch' | 'order_name_mismatch' | 'error'; orderId?: string; detail?: string }

function extractOrderId(paymentId: string, customData: unknown): string | null {
  if (typeof customData === 'string') {
    try {
      const parsed = JSON.parse(customData) as { orderId?: unknown }
      if (typeof parsed.orderId === 'string') return parsed.orderId
    } catch {
      // ignore
    }
  }
  if (paymentId.startsWith('payment_')) {
    const parts = paymentId.split('_')
    if (parts.length >= 2 && parts[1]) return parts[1]
  }
  return null
}

/**
 * 포트원의 결제건과 우리 DB를 동기화한다.
 * confirm(클라이언트 redirect)과 webhook(서버 알림) 양쪽에서 호출되며,
 * status='paid' 멱등성, providerTxId unique 제약으로 race condition 안전.
 */
interface ActualPaymentLike {
  id: string
  status: string
  amount: { total: number }
  orderName: string
  currency: string
  paidAt?: string
  customData?: string
}

export async function syncPaymentByPaymentId(paymentId: string): Promise<SyncResult> {
  const raw = await getPayment(paymentId)
  if (!raw) {
    return { ok: false, reason: 'payment_not_found', detail: paymentId }
  }
  // SDK의 Payment는 status 기준 discriminated union이라 공통 접근이 어렵다.
  // 모든 결제 상태에 공통적으로 존재하는 핵심 필드만 사용하므로 ActualPaymentLike로 좁힌다.
  const actual = raw as unknown as ActualPaymentLike

  const orderId = extractOrderId(paymentId, actual.customData)
  if (!orderId) {
    return { ok: false, reason: 'invalid_custom_data', detail: paymentId }
  }

  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
  if (!order) {
    return { ok: false, reason: 'order_not_found', orderId }
  }

  switch (actual.status) {
    case 'PAID':
      return handlePaid(orderId, paymentId, actual)
    case 'CANCELLED':
    case 'PARTIAL_CANCELLED':
      return handleCancelled(orderId, paymentId, actual)
    case 'FAILED':
      return handleFailed(orderId, paymentId, actual)
    default:
      return { ok: true, action: 'noop', orderId }
  }
}

async function handlePaid(
  orderId: string,
  paymentId: string,
  actual: ActualPaymentLike,
): Promise<SyncResult> {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, reason: 'order_not_found', orderId }

  if (order.status === 'paid') {
    return { ok: true, action: 'already_paid', orderId }
  }

  const product = getProduct(order.productCode)
  if (!product) {
    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: { status: 'failed', rawPayload: actual as object },
    })
    await notifyPaymentFailed(order, `상품코드 ${order.productCode} 미존재`)
    return { ok: false, reason: 'invalid_custom_data', orderId, detail: 'unknown product' }
  }

  if (actual.amount.total !== order.amount) {
    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: { status: 'failed', rawPayload: actual as object },
    })
    await notifyPaymentFailed(
      order,
      `금액 불일치: 주문 ${order.amount} vs 결제 ${actual.amount.total}`,
    )
    return { ok: false, reason: 'amount_mismatch', orderId }
  }

  if (actual.currency !== order.currency) {
    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: { status: 'failed', rawPayload: actual as object },
    })
    await notifyPaymentFailed(
      order,
      `통화 불일치: 주문 ${order.currency} vs 결제 ${actual.currency}`,
    )
    return { ok: false, reason: 'currency_mismatch', orderId }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.paymentOrder.findUnique({ where: { id: orderId } })
      if (!fresh) throw new Error('order_not_found')
      if (fresh.status === 'paid') {
        return
      }
      await tx.paymentOrder.update({
        where: { id: orderId },
        data: {
          status: 'paid',
          providerTxId: actual.id,
          paidAt: actual.paidAt ? new Date(actual.paidAt) : new Date(),
          rawPayload: actual as object,
        },
      })
    })
  } catch (err) {
    if (err instanceof Error && /Unique constraint/i.test(err.message)) {
      return { ok: true, action: 'already_paid', orderId }
    }
    throw err
  }

  const after = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
  if (after && after.status === 'paid') {
    const granted = await prisma.entitlementLedger.findFirst({
      where: { orderId, reason: 'purchase' },
    })
    if (!granted) {
      await grantCredits(order.userId, orderId, order.productCode)
    }
    await notifyPaymentPaid({
      id: orderId,
      userId: order.userId,
      productCode: order.productCode,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      provider: order.provider,
      providerTxId: actual.id,
    })
  }

  return { ok: true, action: 'paid', orderId }
}

async function handleCancelled(
  orderId: string,
  _paymentId: string,
  actual: ActualPaymentLike,
): Promise<SyncResult> {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, reason: 'order_not_found', orderId }

  const isPartial = actual.status === 'PARTIAL_CANCELLED'
  const nextStatus = isPartial ? 'partial_canceled' : 'canceled'

  if (order.status === nextStatus) {
    return { ok: true, action: isPartial ? 'partial_cancelled' : 'cancelled', orderId }
  }

  await prisma.paymentOrder.update({
    where: { id: orderId },
    data: { status: nextStatus, rawPayload: actual as object },
  })

  if (!isPartial) {
    const revoked = await prisma.entitlementLedger.findFirst({
      where: { orderId, reason: 'refund' },
    })
    if (!revoked) {
      await revokeCredits(order.userId, orderId, order.productCode)
    }
  }

  await notifyPaymentCancelled(
    {
      id: orderId,
      userId: order.userId,
      productCode: order.productCode,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      provider: order.provider,
      providerTxId: order.providerTxId,
    },
    isPartial ? '부분 취소' : '전액 취소',
    isPartial,
  )

  return { ok: true, action: isPartial ? 'partial_cancelled' : 'cancelled', orderId }
}

async function handleFailed(
  orderId: string,
  _paymentId: string,
  actual: ActualPaymentLike,
): Promise<SyncResult> {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, reason: 'order_not_found', orderId }

  if (order.status === 'failed') {
    return { ok: true, action: 'noop', orderId }
  }

  await prisma.paymentOrder.update({
    where: { id: orderId },
    data: { status: 'failed', rawPayload: actual as object },
  })

  await notifyPaymentFailed(order, '포트원 측에서 FAILED 상태로 통보됨')

  return { ok: true, action: 'failed', orderId }
}
