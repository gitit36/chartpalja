import { prisma } from '@/lib/db/prisma'
import { FREE_PERIOD_PER_CHART, getProduct } from './products'

interface OrderItemLike {
  code: string
  type?: string
  quantity?: number
}

/** PaymentOrder.extraItems(JSON)를 안전하게 OrderItemLike[] 로 파싱 */
function parseExtraItems(raw: unknown): OrderItemLike[] {
  if (!Array.isArray(raw)) return []
  const out: OrderItemLike[] = []
  for (const it of raw) {
    if (it && typeof it === 'object' && 'code' in it && typeof (it as { code: unknown }).code === 'string') {
      out.push(it as OrderItemLike)
    }
  }
  return out
}

/** 주문의 모든 상품 코드(primary + extra) 목록 */
function collectOrderItemCodes(orderProductCode: string, extraItemsRaw: unknown): string[] {
  return [orderProductCode, ...parseExtraItems(extraItemsRaw).map((it) => it.code)]
}

/**
 * 묶음 결제(주문 1건에 chart + period 등 여러 상품 포함) 대응 크레딧 지급.
 * - 주문의 primary productCode + extraItems 모두를 합산하여 chart/period 크레딧을 한 번에 증가.
 * - chart 구매분은 FREE_PERIOD_PER_CHART × quantity 만큼 period 보너스를 함께 부여.
 */
export async function grantCredits(userId: string, orderId: string, _primaryProductCode: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new Error(`Order not found: ${orderId}`)

  const codes = collectOrderItemCodes(order.productCode, order.extraItems)
  let chartQty = 0
  let periodQty = 0
  for (const code of codes) {
    const p = getProduct(code)
    if (!p) continue
    if (p.type === 'chart') chartQty += p.quantity
    else periodQty += p.quantity
  }
  const bonusPeriod = chartQty * FREE_PERIOD_PER_CHART
  const totalPeriod = periodQty + bonusPeriod

  await prisma.$transaction(async (tx) => {
    if (chartQty > 0) {
      await tx.entitlementLedger.create({
        data: { userId, orderId, creditType: 'chart', delta: chartQty, reason: 'purchase' },
      })
    }
    if (periodQty > 0) {
      await tx.entitlementLedger.create({
        data: { userId, orderId, creditType: 'period', delta: periodQty, reason: 'purchase' },
      })
    }
    if (bonusPeriod > 0) {
      await tx.entitlementLedger.create({
        data: { userId, orderId, creditType: 'period', delta: bonusPeriod, reason: 'purchase_bonus' },
      })
    }

    const existing = await tx.userBalance.findUnique({ where: { userId } })
    if (existing) {
      await tx.userBalance.update({
        where: { userId },
        data: {
          chartCredits: { increment: chartQty },
          periodCredits: { increment: totalPeriod },
        },
      })
    } else {
      // 첫 결제. 신규가입자 체험용 기본 periodCredits=3 + 구매분.
      await tx.userBalance.create({
        data: {
          userId,
          chartCredits: chartQty,
          periodCredits: 3 + totalPeriod,
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

/**
 * 환불 시 크레딧 차감. 묶음 결제(extraItems)도 함께 회수.
 * - 주문에 포함된 모든 chart/period 구매분 차감 + chart 보너스 period 도 함께 회수.
 */
export async function revokeCredits(userId: string, orderId: string, _primaryProductCode: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new Error(`Order not found: ${orderId}`)

  const codes = collectOrderItemCodes(order.productCode, order.extraItems)
  let chartQty = 0
  let periodQty = 0
  for (const code of codes) {
    const p = getProduct(code)
    if (!p) continue
    if (p.type === 'chart') chartQty += p.quantity
    else periodQty += p.quantity
  }
  const bonusPeriod = chartQty * FREE_PERIOD_PER_CHART
  const totalPeriod = periodQty + bonusPeriod

  await prisma.$transaction(async (tx) => {
    const already = await tx.entitlementLedger.findFirst({
      where: { orderId, reason: 'refund' },
    })
    if (already) return

    if (chartQty > 0) {
      await tx.entitlementLedger.create({
        data: { userId, orderId, creditType: 'chart', delta: -chartQty, reason: 'refund' },
      })
    }
    if (periodQty > 0) {
      await tx.entitlementLedger.create({
        data: { userId, orderId, creditType: 'period', delta: -periodQty, reason: 'refund' },
      })
    }
    if (bonusPeriod > 0) {
      await tx.entitlementLedger.create({
        data: { userId, orderId, creditType: 'period', delta: -bonusPeriod, reason: 'refund_bonus' },
      })
    }

    const balance = await tx.userBalance.findUnique({ where: { userId } })
    if (!balance) return

    await tx.userBalance.update({
      where: { userId },
      data: {
        chartCredits: { decrement: chartQty },
        periodCredits: { decrement: totalPeriod },
      },
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

  if (order.paidAt) {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    if (Date.now() - order.paidAt.getTime() > sevenDaysMs) {
      return { ok: false, reason: 'expired_7d' }
    }
  }

  // 묶음 결제(extraItems) 까지 합산하여 잔액이 충분히 남아 있는지 확인
  const codes = collectOrderItemCodes(order.productCode, order.extraItems)
  let chartQty = 0
  let periodQty = 0
  for (const code of codes) {
    const p = getProduct(code)
    if (!p) return { ok: false, reason: 'unknown_product' }
    if (p.type === 'chart') chartQty += p.quantity
    else periodQty += p.quantity
  }
  const bonusPeriod = chartQty * FREE_PERIOD_PER_CHART
  const periodNeeded = periodQty + bonusPeriod

  const balance = await prisma.userBalance.findUnique({ where: { userId: order.userId } })
  const chartAvailable = balance?.chartCredits ?? 0
  const periodAvailable = balance?.periodCredits ?? 0

  if (chartAvailable < chartQty) return { ok: false, reason: 'already_used' }
  if (periodAvailable < periodNeeded) return { ok: false, reason: 'already_used' }

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
