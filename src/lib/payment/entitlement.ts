import { prisma } from '@/lib/db/prisma'
import { getProduct } from './products'

export async function grantCredits(userId: string, orderId: string, productCode: string) {
  const product = getProduct(productCode)
  if (!product) throw new Error(`Unknown product: ${productCode}`)

  const creditType = product.type
  const delta = product.quantity

  await prisma.$transaction(async (tx) => {
    await tx.entitlementLedger.create({
      data: {
        userId,
        orderId,
        creditType,
        delta,
        reason: 'purchase',
      },
    })

    const existing = await tx.userBalance.findUnique({ where: { userId } })

    if (existing) {
      await tx.userBalance.update({
        where: { userId },
        data: creditType === 'chart'
          ? { chartCredits: { increment: delta } }
          : { periodCredits: { increment: delta } },
      })
    } else {
      await tx.userBalance.create({
        data: {
          userId,
          chartCredits: creditType === 'chart' ? delta : 0,
          periodCredits: creditType === 'period' ? 3 + delta : 3,
        },
      })
    }
  })
}

export async function getBalance(userId: string) {
  let balance = await prisma.userBalance.findUnique({ where: { userId } })
  if (!balance) {
    balance = await prisma.userBalance.create({
      data: { userId, chartCredits: 0, periodCredits: 3 },
    })
  }
  return balance
}

export async function revokeCredits(userId: string, orderId: string, productCode: string) {
  const product = getProduct(productCode)
  if (!product) throw new Error(`Unknown product: ${productCode}`)

  const creditType = product.type
  const delta = product.quantity

  await prisma.$transaction(async (tx) => {
    const already = await tx.entitlementLedger.findFirst({
      where: { orderId, reason: 'refund' },
    })
    if (already) return

    await tx.entitlementLedger.create({
      data: {
        userId,
        orderId,
        creditType,
        delta: -delta,
        reason: 'refund',
      },
    })

    const balance = await tx.userBalance.findUnique({ where: { userId } })
    if (!balance) return

    await tx.userBalance.update({
      where: { userId },
      data: creditType === 'chart'
        ? { chartCredits: { decrement: delta } }
        : { periodCredits: { decrement: delta } },
    })
  })
}

/**
 * 환불 가능 여부 — 정책:
 *   - 결제일로부터 7일 이내
 *   - 구매한 크레딧을 한 번도 사용하지 않음 (= 현재 잔액 >= 주문 수량)
 */
export async function canRefundOrder(orderId: string): Promise<{
  ok: boolean
  reason?: 'not_paid' | 'expired_7d' | 'already_used' | 'order_not_found' | 'unknown_product'
}> {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, reason: 'order_not_found' }
  if (order.status !== 'paid') return { ok: false, reason: 'not_paid' }

  const product = getProduct(order.productCode)
  if (!product) return { ok: false, reason: 'unknown_product' }

  if (order.paidAt) {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    if (Date.now() - order.paidAt.getTime() > sevenDaysMs) {
      return { ok: false, reason: 'expired_7d' }
    }
  }

  const balance = await prisma.userBalance.findUnique({ where: { userId: order.userId } })
  const available = balance
    ? (product.type === 'chart' ? balance.chartCredits : balance.periodCredits)
    : 0

  if (available < product.quantity) return { ok: false, reason: 'already_used' }

  return { ok: true }
}

export async function consumeCredit(userId: string, creditType: 'chart' | 'period'): Promise<boolean> {
  const balance = await getBalance(userId)
  const available = creditType === 'chart' ? balance.chartCredits : balance.periodCredits

  if (available <= 0) return false

  await prisma.$transaction(async (tx) => {
    await tx.entitlementLedger.create({
      data: { userId, creditType, delta: -1, reason: 'use' },
    })

    await tx.userBalance.update({
      where: { userId },
      data: creditType === 'chart'
        ? { chartCredits: { decrement: 1 } }
        : { periodCredits: { decrement: 1 } },
    })
  })

  return true
}
