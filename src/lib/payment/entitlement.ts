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
