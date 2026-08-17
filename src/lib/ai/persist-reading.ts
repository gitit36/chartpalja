/**
 * fortuneJson 저장 + 주 차감을 한 트랜잭션으로 묶어
 * "저장만 되고 미차감 / 차감만 되고 미저장" 불일치를 줄인다.
 */

import { prisma } from '@/lib/db/prisma'

export async function persistFortuneJsonAndConsume(opts: {
  entryId: string
  fortuneJson: object
  userId: string
  cost: number
  reason: 'use:fortune' | 'use:period' | 'use:compat'
}): Promise<void> {
  const { entryId, fortuneJson, userId, cost, reason } = opts

  await prisma.$transaction(async (tx) => {
    await tx.sajuEntry.update({
      where: { id: entryId },
      data: { fortuneJson },
    })

    if (cost > 0) {
      const balance = await tx.userBalance.findUnique({ where: { userId } })
      if (!balance || balance.ju < cost) {
        throw new Error(`insufficient_ju: need=${cost} have=${balance?.ju ?? 0}`)
      }
      await tx.entitlementLedger.create({
        data: { userId, creditType: 'ju', delta: -cost, reason },
      })
      await tx.userBalance.update({
        where: { userId },
        data: { ju: { decrement: cost } },
      })
    }
  })
}
