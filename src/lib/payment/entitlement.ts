import { prisma } from '@/lib/db/prisma'
import { getProduct } from './products'

/** 신규 가입 기본 지급 주(株). 5주 = 운세/궁합 해설 1회를 무료로 경험. */
export const SIGNUP_BONUS_JU = 5

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

/** 주문에 포함된 상품들의 주(株) 수량 합계 */
function sumJuFromCodes(codes: string[]): number {
  let total = 0
  for (const code of codes) {
    const p = getProduct(code)
    if (p) total += p.quantity
  }
  return total
}

/**
 * 묶음 결제 대응 주(株) 지급.
 */
export async function grantCredits(userId: string, orderId: string, _primaryProductCode: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new Error(`Order not found: ${orderId}`)

  const codes = collectOrderItemCodes(order.productCode, order.extraItems)
  const juQty = sumJuFromCodes(codes)
  if (juQty <= 0) return

  await prisma.$transaction(async (tx) => {
    await tx.entitlementLedger.create({
      data: { userId, orderId, creditType: 'ju', delta: juQty, reason: 'purchase' },
    })

    const existing = await tx.userBalance.findUnique({ where: { userId } })
    if (existing) {
      await tx.userBalance.update({
        where: { userId },
        data: { ju: { increment: juQty } },
      })
    } else {
      await tx.userBalance.create({
        data: { userId, ju: SIGNUP_BONUS_JU + juQty },
      })
    }
  })
}

export async function getBalance(userId: string) {
  let balance = await prisma.userBalance.findUnique({ where: { userId } })
  if (!balance) {
    balance = await prisma.userBalance.create({
      data: { userId, ju: SIGNUP_BONUS_JU },
    })
  }
  return balance
}

/**
 * 환불 시 주(株) 차감. 묶음 결제(extraItems)도 함께 회수.
 */
export async function revokeCredits(userId: string, orderId: string, _primaryProductCode: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new Error(`Order not found: ${orderId}`)

  const codes = collectOrderItemCodes(order.productCode, order.extraItems)
  const juQty = sumJuFromCodes(codes)
  if (juQty <= 0) return

  await prisma.$transaction(async (tx) => {
    const already = await tx.entitlementLedger.findFirst({
      where: { orderId, reason: 'refund' },
    })
    if (already) return

    await tx.entitlementLedger.create({
      data: { userId, orderId, creditType: 'ju', delta: -juQty, reason: 'refund' },
    })

    const balance = await tx.userBalance.findUnique({ where: { userId } })
    if (!balance) return

    await tx.userBalance.update({
      where: { userId },
      data: { ju: { decrement: juQty } },
    })
  })
}

/**
 * 환불 가능 여부 — 정책:
 *   - 결제일로부터 7일 이내
 *   - 구매한 주를 한 번도 사용하지 않음 (= 현재 잔액 >= 주문 수량)
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

  const codes = collectOrderItemCodes(order.productCode, order.extraItems)
  let juNeeded = 0
  for (const code of codes) {
    const p = getProduct(code)
    if (!p) return { ok: false, reason: 'unknown_product' }
    juNeeded += p.quantity
  }

  const balance = await prisma.userBalance.findUnique({ where: { userId: order.userId } })
  const juAvailable = balance?.ju ?? 0

  if (juAvailable < juNeeded) return { ok: false, reason: 'already_used' }

  return { ok: true }
}

/** 주(株) 잔액이 cost 이상인지 확인 (차감 없음) */
export async function hasUnits(userId: string, cost: number): Promise<boolean> {
  const balance = await getBalance(userId)
  return balance.ju >= cost
}

/**
 * 주(株) 차감. reason 예: use:fortune, use:period, use:compat
 */
export async function consumeUnits(userId: string, cost: number, reason: string): Promise<boolean> {
  if (cost <= 0) return true
  const balance = await getBalance(userId)
  if (balance.ju < cost) return false

  await prisma.$transaction(async (tx) => {
    await tx.entitlementLedger.create({
      data: { userId, creditType: 'ju', delta: -cost, reason },
    })

    await tx.userBalance.update({
      where: { userId },
      data: { ju: { decrement: cost } },
    })
  })

  return true
}

/** @deprecated consumeUnits 사용 */
export async function consumeCredit(_userId: string, _creditType: 'chart' | 'period'): Promise<boolean> {
  return false
}
