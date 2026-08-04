import { prisma } from '@/lib/db/prisma'
import { CouponsClient } from './CouponsClient'

export const dynamic = 'force-dynamic'

export default async function AdminCouponsPage() {
  const [coupons, campaigns] = await Promise.all([
    prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: { select: { id: true, name: true } },
        _count: { select: { redemptions: true } },
      },
    }),
    prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    }),
  ])

  const serialized = coupons.map((c) => ({
    ...c,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  return <CouponsClient initialCoupons={serialized} campaigns={campaigns} />
}
