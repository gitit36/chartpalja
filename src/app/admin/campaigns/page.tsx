import { prisma } from '@/lib/db/prisma'
import { CampaignsClient } from './CampaignsClient'

export const dynamic = 'force-dynamic'

export default async function AdminCampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      coupons: {
        select: {
          id: true,
          code: true,
          ju: true,
          active: true,
          redeemedCount: true,
          maxRedemptions: true,
        },
      },
    },
  })

  const serialized = campaigns.map((c) => ({
    ...c,
    startsAt: c.startsAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  return <CampaignsClient initial={serialized} />
}
